import type { APIRoute } from "astro";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { ilValesSalida, ilValesSalidaDetalle, ngProductos } from "@/db/schema";
import { json, requireUser, isResponse } from "@/lib/api";
import { rangoDelDia } from "@/lib/caja";

export const prerender = false;

// Cuadre X Productos (antes cuadreXProductosToolStripMenuItem_Click): total
// vendido por producto en una fecha, opcionalmente filtrado por punto de
// venta. A diferencia del reporte final de caja, no requiere elegir un
// único almacén — sirve para cuadrar ventas de todos los puntos de venta.
export const GET: APIRoute = async ({ url, locals }) => {
  const user = requireUser(locals, "caja");
  if (isResponse(user)) return user;

  const fecha = url.searchParams.get("fecha");
  if (!fecha) return json({ error: "Falta el parámetro fecha" }, 400);
  const idalmacenParam = url.searchParams.get("idalmacen");
  const idalmacen = idalmacenParam ? Number(idalmacenParam) : null;

  const { inicio, fin } = rangoDelDia(fecha);

  const condiciones = [
    eq(ilValesSalida.idempresa, user.idempresa),
    eq(ilValesSalida.anulada, false),
    sql`${ilValesSalida.fecha} >= ${inicio}`,
    sql`${ilValesSalida.fecha} < ${fin}`,
  ];
  if (idalmacen) condiciones.push(eq(ilValesSalida.idalmacen, idalmacen));

  const filas = await db
    .select({
      idproducto: ngProductos.idproducto,
      producto: ngProductos.producto,
      referencia: ngProductos.referencia,
      cantidad: sql<string>`sum(${ilValesSalidaDetalle.cantidad})`,
      importe: sql<string>`sum(${ilValesSalidaDetalle.cantidad} * ${ilValesSalidaDetalle.pventa})`,
    })
    .from(ilValesSalidaDetalle)
    .innerJoin(ilValesSalida, eq(ilValesSalida.idvalesalida, ilValesSalidaDetalle.idvalesalida))
    .innerJoin(ngProductos, eq(ngProductos.idproducto, ilValesSalidaDetalle.idproducto))
    .where(and(...condiciones))
    .groupBy(ngProductos.idproducto, ngProductos.producto, ngProductos.referencia)
    .orderBy(ngProductos.producto);

  const totalImporte = filas.reduce((acc, f) => acc + Number(f.importe), 0);

  return json({ fecha, idalmacen, productos: filas, totalImporte });
};
