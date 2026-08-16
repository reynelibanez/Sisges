import type { APIRoute } from "astro";
import { z } from "zod";
import { eq, and, gte, lt, max, count } from "drizzle-orm";
import { db } from "@/db/client";
import { ilValesSalida, ilValesSalidaDetalle, ilValesMonedas } from "@/db/schema";
import { json, requireUser, requireAny, isResponse } from "@/lib/api";
import { ajustarExistencia } from "@/lib/existencias";
import { agregarProductosAsociados } from "@/lib/productosAsociados";

export const prerender = false;

const detalleSchema = z.object({
  idproducto: z.coerce.number().int(),
  idarea: z.coerce.number().int().optional().nullable(),
  cantidad: z.coerce.number().positive(),
  preciocosto: z.coerce.number().min(0),
  pventa: z.coerce.number().min(0),
});

const pagoSchema = z.object({
  idmoneda: z.coerce.number().int(),
  tc: z.coerce.number().positive().default(1),
  importe: z.coerce.number().positive(),
  esTransferencia: z.boolean().optional().default(false),
});

// Esta es la "venta" (antes vale de salida + módulo Caja, ahora unificados
// dentro de Inventario). idalmacen es el punto de venta desde el que se vende.
// cuentaCasa/promocion/masDiezPorciento reproducen la lógica de CobrarVale()
// en el Caja.cs original: "Cuenta Casa" vende a Pventa=0 en todas las
// líneas, "Promoción" aplica un % de descuento proporcional al importe de
// cada línea, y "Más el 10%" es un recargo que se cobra encima del total
// pero que no se refleja en el Pventa grabado por línea.
const ventaSchema = z.object({
  idalmacen: z.coerce.number().int(),
  nota: z.string().optional().nullable(),
  cuentaCasa: z.boolean().optional().default(false),
  promocion: z.boolean().optional().default(false),
  promocionPorcentaje: z.coerce.number().min(0).max(100).optional().default(10),
  masDiezPorciento: z.boolean().optional().default(false),
  // Igual que Recepciones/Transferencias: mientras no esté inventariada es
  // un borrador que no baja existencias ni exige que el pago ya cuadre.
  // El cobro desde Caja siempre manda true (se cobra y se fija al toque,
  // como en el Caja.cs original); esto habilita además crear un vale de
  // salida "a mano" desde Documentos, sin pasar por el POS.
  inventariada: z.boolean().optional().default(true),
  detalle: z.array(detalleSchema).min(1, "Agrega al menos un producto"),
  pagos: z.array(pagoSchema).default([]),
});

// Acepta ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&idalmacen=&anulada=&page=&pageSize=
// para filtrar y paginar del lado del servidor — con miles de ventas
// migradas, mandar todo el histórico de una sola vez a cada carga del
// panel era lo que hacía lenta la grilla (ver migrate-inventario.ts para
// el detalle de por qué). Ahora siempre se pagina: page (base 1, por
// defecto 1) y pageSize (por defecto 50, máximo 200).
export const GET: APIRoute = async ({ url, locals }) => {
  // Tanto Caja (cobrar) como Inventario (consultar/gestionar documentos vía
  // "Vales de Salida") necesitan poder leer este listado.
  const user = requireUser(locals);
  if (isResponse(user)) return user;
  if (!user.administrador && !user.permisos.caja && !user.permisos.inventario) {
    return json({ error: "No tienes permiso de caja o inventario" }, 403);
  }

  const desde = url.searchParams.get("desde");
  const hasta = url.searchParams.get("hasta");
  const idalmacenParam = url.searchParams.get("idalmacen");
  const idalmacen = idalmacenParam ? Number(idalmacenParam) : null;
  const anuladaParam = url.searchParams.get("anulada"); // "true" | "false" | null
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(2000, Math.max(1, Number(url.searchParams.get("pageSize")) || 50));

  const condiciones = [eq(ilValesSalida.idempresa, user.idempresa)];
  if (idalmacen) condiciones.push(eq(ilValesSalida.idalmacen, idalmacen));
  if (desde) condiciones.push(gte(ilValesSalida.fecha, new Date(`${desde}T00:00:00.000Z`)));
  if (hasta)
    condiciones.push(lt(ilValesSalida.fecha, new Date(new Date(`${hasta}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000)));
  if (anuladaParam === "true") condiciones.push(eq(ilValesSalida.anulada, true));
  if (anuladaParam === "false") condiciones.push(eq(ilValesSalida.anulada, false));
  const where = and(...condiciones);

  const [rows, [{ total }]] = await Promise.all([
    db.query.ilValesSalida.findMany({
      where: () => where,
      with: { detalle: true, pagos: true },
      orderBy: (t, { desc }) => desc(t.fecha),
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    db.select({ total: count() }).from(ilValesSalida).where(where),
  ]);

  return json({ rows, total, page, pageSize });
};

export const POST: APIRoute = async ({ request, locals }) => {
  // Caja cobra (siempre queda inventariado de una); Inventario también
  // puede crear un vale de salida "a mano" desde Documentos (puede quedar
  // como borrador primero).
  const user = requireAny(locals, ["caja", "inventario"]);
  if (isResponse(user)) return user;

  const parsed = ventaSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const { idalmacen, nota, cuentaCasa, promocion, promocionPorcentaje, masDiezPorciento, inventariada, detalle, pagos } =
    parsed.data;

  // Factor aplicado al Pventa de cada línea (igual que CobrarVale()):
  // Cuenta Casa -> 0 (no genera ingreso), Promoción -> descuento
  // proporcional, si no ninguno de los dos -> se graba tal cual.
  const factor = cuentaCasa ? 0 : promocion ? Math.max(0, 1 - promocionPorcentaje / 100) : 1;

  const totalBruto = detalle.reduce((acc, l) => acc + l.cantidad * l.pventa, 0);
  const totalNeto = totalBruto * factor;
  // El 10% ("Más el 10%") es un recargo de servicio que se cobra encima del
  // total, pero no se reparte entre las líneas — solo afecta lo que hay que
  // pagar, tal como en el original (txtdiezp).
  const totalACobrar = cuentaCasa ? 0 : masDiezPorciento ? totalNeto * 1.1 : totalNeto;

  const totalPagos = pagos.reduce((acc, p) => acc + p.importe * p.tc, 0);
  // Solo se exige que el pago alcance cuando el vale queda inventariado
  // (fijado) de una — si es un borrador, o si no se registró ningún pago
  // (vale manual sin cobro asociado, p. ej. consumo interno), no se valida.
  if (inventariada && !cuentaCasa && pagos.length > 0 && totalPagos + 0.5 < totalACobrar) {
    return json(
      { error: `El pago (${totalPagos.toFixed(2)}) es menor que el total a cobrar (${totalACobrar.toFixed(2)})` },
      400
    );
  }
  const vuelto = cuentaCasa || pagos.length === 0 ? 0 : totalPagos - totalACobrar;

  const row = await db.transaction(async (tx) => {
    const [{ ultimo }] = await tx
      .select({ ultimo: max(ilValesSalida.noconsecutivo) })
      .from(ilValesSalida)
      .where(eq(ilValesSalida.idempresa, user.idempresa));

    const [venta] = await tx
      .insert(ilValesSalida)
      .values({
        idempresa: user.idempresa,
        noconsecutivo: (ultimo ?? 0) + 1,
        idalmacen,
        nota,
        cuentaCasa,
        promocion,
        promocionPorcentaje: promocion ? String(promocionPorcentaje) : null,
        masDiezPorciento,
        inventariada,
        vuelto: vuelto.toFixed(2),
        creadoPor: user.idusuario,
      })
      .returning();

    for (const linea of detalle) {
      await tx.insert(ilValesSalidaDetalle).values({
        idvalesalida: venta.idvalesalida,
        idproducto: linea.idproducto,
        idarea: linea.idarea ?? null,
        preciocosto: String(linea.preciocosto),
        pventa: (linea.pventa * factor).toFixed(2),
        cantidad: String(linea.cantidad),
      });

      // Una venta saca mercancía del punto de venta, pero solo cuando queda
      // inventariada — un borrador todavía no toca el stock (incluso en
      // Cuenta Casa, que sigue consumiendo stock una vez fijada, aunque no
      // genere ingreso, igual que en el original).
      if (inventariada) {
        await ajustarExistencia(tx, {
          idempresa: user.idempresa,
          idalmacen,
          idproducto: linea.idproducto,
          delta: -linea.cantidad,
        });
      }
    }

    for (const pago of pagos) {
      await tx.insert(ilValesMonedas).values({
        idvalesalida: venta.idvalesalida,
        idmoneda: pago.idmoneda,
        tc: String(pago.tc),
        importe: String(pago.importe),
        esTransferencia: pago.esTransferencia,
      });
    }

    // Si algún producto vendido tiene productos asociados (combos/recetas),
    // agrega al mismo vale las líneas de materia prima que consume.
    await agregarProductosAsociados(tx, {
      idempresa: user.idempresa,
      idalmacen,
      idvalesalida: venta.idvalesalida,
      inventariada,
      detalle: detalle.map((l) => ({ idproducto: l.idproducto, cantidad: l.cantidad })),
    });

    return venta;
  });

  return json(row, 201);
};
