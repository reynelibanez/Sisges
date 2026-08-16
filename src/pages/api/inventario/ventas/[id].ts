import type { APIRoute } from "astro";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ilValesSalida, ilValesSalidaDetalle, ilValesMonedas } from "@/db/schema";
import { json, requireUser, isResponse } from "@/lib/api";
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

const editarSchema = z.object({
  idalmacen: z.coerce.number().int(),
  nota: z.string().optional().nullable(),
  cuentaCasa: z.boolean().optional().default(false),
  promocion: z.boolean().optional().default(false),
  promocionPorcentaje: z.coerce.number().min(0).max(100).optional().default(10),
  masDiezPorciento: z.boolean().optional().default(false),
  inventariada: z.boolean().optional().default(false),
  detalle: z.array(detalleSchema).min(1, "Agrega al menos un producto"),
  pagos: z.array(pagoSchema).default([]),
});

// Edita un vale de salida "manual" mientras sea borrador (no inventariado),
// o lo fija en el mismo paso si se manda inventariada=true — igual que
// Recepciones/Transferencias. Los vales cobrados desde Caja siempre nacen
// inventariados (ver POST /api/inventario/ventas), así que en la práctica
// esta ruta es para los creados a mano desde Documentos → Vales de Salida.
export const PUT: APIRoute = async ({ params, request, locals }) => {
  const user = requireUser(locals, "inventario");
  if (isResponse(user)) return user;

  const id = Number(params.id);
  const parsed = editarSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const { idalmacen, nota, cuentaCasa, promocion, promocionPorcentaje, masDiezPorciento, inventariada, detalle, pagos } =
    parsed.data;

  const factor = cuentaCasa ? 0 : promocion ? Math.max(0, 1 - promocionPorcentaje / 100) : 1;
  const totalBruto = detalle.reduce((acc, l) => acc + l.cantidad * l.pventa, 0);
  const totalNeto = totalBruto * factor;
  const totalACobrar = cuentaCasa ? 0 : masDiezPorciento ? totalNeto * 1.1 : totalNeto;
  const totalPagos = pagos.reduce((acc, p) => acc + p.importe * p.tc, 0);
  if (inventariada && !cuentaCasa && pagos.length > 0 && totalPagos + 0.5 < totalACobrar) {
    return json(
      { error: `El pago (${totalPagos.toFixed(2)}) es menor que el total a cobrar (${totalACobrar.toFixed(2)})` },
      400
    );
  }
  const vuelto = cuentaCasa || pagos.length === 0 ? 0 : totalPagos - totalACobrar;

  const result = await db.transaction(async (tx) => {
    const [existente] = await tx
      .select()
      .from(ilValesSalida)
      .where(and(eq(ilValesSalida.idvalesalida, id), eq(ilValesSalida.idempresa, user.idempresa)))
      .limit(1);

    if (!existente) return { status: 404 as const };
    if (existente.inventariada) return { status: 423 as const };

    await tx.delete(ilValesSalidaDetalle).where(eq(ilValesSalidaDetalle.idvalesalida, id));
    await tx.delete(ilValesMonedas).where(eq(ilValesMonedas.idvalesalida, id));

    for (const linea of detalle) {
      await tx.insert(ilValesSalidaDetalle).values({
        idvalesalida: id,
        idproducto: linea.idproducto,
        idarea: linea.idarea ?? null,
        preciocosto: String(linea.preciocosto),
        pventa: (linea.pventa * factor).toFixed(2),
        cantidad: String(linea.cantidad),
      });
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
        idvalesalida: id,
        idmoneda: pago.idmoneda,
        tc: String(pago.tc),
        importe: String(pago.importe),
        esTransferencia: pago.esTransferencia,
      });
    }

    // Igual que en POST: si algún producto vendido tiene productos
    // asociados, agrega al mismo vale las líneas de materia prima.
    await agregarProductosAsociados(tx, {
      idempresa: user.idempresa,
      idalmacen,
      idvalesalida: id,
      inventariada,
      detalle: detalle.map((l) => ({ idproducto: l.idproducto, cantidad: l.cantidad })),
    });

    const [actualizada] = await tx
      .update(ilValesSalida)
      .set({
        idalmacen,
        nota,
        cuentaCasa,
        promocion,
        promocionPorcentaje: promocion ? String(promocionPorcentaje) : null,
        masDiezPorciento,
        inventariada,
        vuelto: vuelto.toFixed(2),
      })
      .where(eq(ilValesSalida.idvalesalida, id))
      .returning();

    return { status: 200 as const, row: actualizada };
  });

  if (result.status === 404) return json({ error: "No encontrado" }, 404);
  if (result.status === 423) return json({ error: "Este vale ya está inventariado y no se puede modificar" }, 423);
  return json(result.row);
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const user = requireUser(locals, "inventario");
  if (isResponse(user)) return user;

  const id = Number(params.id);

  const [existente] = await db
    .select()
    .from(ilValesSalida)
    .where(and(eq(ilValesSalida.idvalesalida, id), eq(ilValesSalida.idempresa, user.idempresa)))
    .limit(1);

  if (!existente) return json({ error: "No encontrado" }, 404);
  if (existente.inventariada) return json({ error: "Este vale ya está inventariado; usa Anular en vez de eliminar" }, 423);

  await db.delete(ilValesSalida).where(eq(ilValesSalida.idvalesalida, id));
  return json({ ok: true });
};
