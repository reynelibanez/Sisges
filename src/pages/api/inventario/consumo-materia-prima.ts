import type { APIRoute } from "astro";
import { z } from "zod";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  ilValesSalida,
  ilValesSalidaDetalle,
  ngProductosAsociados,
  ngProductos,
  ngBajas,
  bajasPor,
} from "@/db/schema";
import { json, requireUser, isResponse } from "@/lib/api";
import { ajustarExistencia } from "@/lib/existencias";

export const prerender = false;

const MOTIVO_CONSUMO = "Consumo de Materia Prima";

/**
 * "Consumo de Materia Prima" (antes GenerarVSMateriasPrimas.cs).
 *
 * El sistema de escritorio generaba, para cada materia prima consumida por
 * ventas de productos elaborados/combos, un vale de salida "falso" — eso
 * inflaba las ventas con movimientos que en realidad eran solo consumo
 * interno de stock. Acá se calcula el mismo consumo (ventas del producto
 * principal x cantidad por unidad en NG_ProductosAsociados) pero se
 * registra como una BAJA (bajaspor) — resta la existencia sin tocar el
 * total de ventas/ingresos.
 */
const registrarSchema = z.object({
  desde: z.string(),
  hasta: z.string(),
  idalmacen: z.coerce.number().int(),
  items: z
    .array(
      z.object({
        idproducto: z.coerce.number().int(),
        cantidad: z.coerce.number().positive(),
      })
    )
    .min(1),
});

async function calcularConsumo(idempresa: number, idalmacen: number, desde: string, hasta: string) {
  const rows = await db
    .select({
      idproductoasociado: ngProductosAsociados.idproductoasociado,
      producto: ngProductos.producto,
      cantidadVendidaPrincipal: sql<string>`sum(${ilValesSalidaDetalle.cantidad})`,
      cantidadPorUnidad: ngProductosAsociados.cantidad,
    })
    .from(ilValesSalidaDetalle)
    .innerJoin(ilValesSalida, eq(ilValesSalida.idvalesalida, ilValesSalidaDetalle.idvalesalida))
    .innerJoin(ngProductosAsociados, eq(ngProductosAsociados.idproducto, ilValesSalidaDetalle.idproducto))
    .innerJoin(ngProductos, eq(ngProductos.idproducto, ngProductosAsociados.idproductoasociado))
    .where(
      and(
        eq(ilValesSalida.idempresa, idempresa),
        eq(ilValesSalida.idalmacen, idalmacen),
        eq(ilValesSalida.inventariada, true),
        eq(ilValesSalida.anulada, false),
        gte(ilValesSalida.fecha, new Date(`${desde}T00:00:00Z`)),
        lte(ilValesSalida.fecha, new Date(`${hasta}T23:59:59Z`))
      )
    )
    .groupBy(ngProductosAsociados.idproductoasociado, ngProductos.producto, ngProductosAsociados.cantidad);

  // Un mismo idproductoasociado puede recibir aportes de más de un producto
  // principal (o de varias filas de NG_ProductosAsociados); se suman todos.
  const totales = new Map<number, { producto: string; cantidad: number }>();
  for (const r of rows) {
    const consumo = Number(r.cantidadVendidaPrincipal) * Number(r.cantidadPorUnidad);
    const actual = totales.get(r.idproductoasociado);
    if (actual) {
      actual.cantidad += consumo;
    } else {
      totales.set(r.idproductoasociado, { producto: r.producto, cantidad: consumo });
    }
  }

  return [...totales.entries()].map(([idproducto, v]) => ({
    idproducto,
    producto: v.producto,
    cantidad: Math.round(v.cantidad * 100) / 100,
  }));
}

export const GET: APIRoute = async ({ url, locals }) => {
  const user = requireUser(locals, "inventario");
  if (isResponse(user)) return user;
  const idalmacen = Number(url.searchParams.get("idalmacen"));
  const desde = url.searchParams.get("desde");
  const hasta = url.searchParams.get("hasta");
  if (!idalmacen || !desde || !hasta) {
    return json({ error: "Faltan idalmacen, desde y hasta" }, 400);
  }
  const items = await calcularConsumo(user.idempresa, idalmacen, desde, hasta);
  return json({ items });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const user = requireUser(locals, "inventario");
  if (isResponse(user)) return user;
  const parsed = registrarSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const { idalmacen, items } = parsed.data;

  const productos = await db
    .select()
    .from(ngProductos)
    .where(eq(ngProductos.idempresa, user.idempresa));
  const porId = new Map(productos.map((p) => [p.idproducto, p]));

  const registradas = await db.transaction(async (tx) => {
    let [motivo] = await tx
      .select()
      .from(ngBajas)
      .where(and(eq(ngBajas.idempresa, user.idempresa), eq(ngBajas.bajas, MOTIVO_CONSUMO)))
      .limit(1);
    if (!motivo) {
      [motivo] = await tx
        .insert(ngBajas)
        .values({ idempresa: user.idempresa, bajas: MOTIVO_CONSUMO })
        .returning();
    }

    const filas = [];
    for (const item of items) {
      const producto = porId.get(item.idproducto);
      if (!producto) continue;
      const [fila] = await tx
        .insert(bajasPor)
        .values({
          idbajas: motivo.idbajas,
          idalmacen,
          idproducto: item.idproducto,
          cantidad: String(item.cantidad),
          pcosto: producto.pcosto,
          pventa: producto.pventa,
          creadoPor: user.idusuario,
        })
        .returning();
      await ajustarExistencia(tx, {
        idempresa: user.idempresa,
        idalmacen,
        idproducto: item.idproducto,
        delta: -item.cantidad,
      });
      filas.push(fila);
    }
    return filas;
  });

  return json({ ok: true, registradas: registradas.length }, 201);
};
