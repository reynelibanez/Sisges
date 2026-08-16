import type { APIRoute } from "astro";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  ilValesSalida,
  ilValesSalidaDetalle,
  ilValesMonedas,
  ngProductos,
  ngMonedas,
  ilVentaDia,
  ilExtracciones,
  ngUsuarios,
} from "@/db/schema";
import { json, requireUser, isResponse } from "@/lib/api";
import { calcularResumenCaja, rangoDelDia } from "@/lib/caja";

export const prerender = false;

// Reporte final de ventas del día: resumen de caja + ventas agrupadas por
// producto + pagos agrupados por moneda + (si el día ya está cerrado) la
// foto de existencias que quedó guardada en IL_VentaDia al cerrar.
export const GET: APIRoute = async ({ url, locals }) => {
  const user = requireUser(locals, "caja");
  if (isResponse(user)) return user;

  const idalmacen = Number(url.searchParams.get("idalmacen"));
  const fecha = url.searchParams.get("fecha");
  if (!idalmacen || !fecha) {
    return json({ error: "Faltan los parámetros idalmacen y fecha" }, 400);
  }

  const resumen = await calcularResumenCaja(user.idempresa, idalmacen, fecha);
  const { inicio, fin } = rangoDelDia(fecha);

  const ventasPorProducto = await db
    .select({
      idproducto: ngProductos.idproducto,
      producto: ngProductos.producto,
      cantidad: sql<string>`sum(${ilValesSalidaDetalle.cantidad})`,
      importe: sql<string>`sum(${ilValesSalidaDetalle.cantidad} * ${ilValesSalidaDetalle.pventa})`,
    })
    .from(ilValesSalidaDetalle)
    .innerJoin(ilValesSalida, eq(ilValesSalida.idvalesalida, ilValesSalidaDetalle.idvalesalida))
    .innerJoin(ngProductos, eq(ngProductos.idproducto, ilValesSalidaDetalle.idproducto))
    .where(
      and(
        eq(ilValesSalida.idempresa, user.idempresa),
        eq(ilValesSalida.idalmacen, idalmacen),
        eq(ilValesSalida.anulada, false),
        sql`${ilValesSalida.fecha} >= ${inicio}`,
        sql`${ilValesSalida.fecha} < ${fin}`
      )
    )
    .groupBy(ngProductos.idproducto, ngProductos.producto)
    .orderBy(ngProductos.producto);

  const pagosPorMoneda = await db
    .select({
      idmoneda: ngMonedas.idmoneda,
      moneda: ngMonedas.moneda,
      importe: sql<string>`sum(${ilValesMonedas.importe})`,
    })
    .from(ilValesMonedas)
    .innerJoin(ilValesSalida, eq(ilValesSalida.idvalesalida, ilValesMonedas.idvalesalida))
    .innerJoin(ngMonedas, eq(ngMonedas.idmoneda, ilValesMonedas.idmoneda))
    .where(
      and(
        eq(ilValesSalida.idempresa, user.idempresa),
        eq(ilValesSalida.idalmacen, idalmacen),
        eq(ilValesSalida.anulada, false),
        sql`${ilValesSalida.fecha} >= ${inicio}`,
        sql`${ilValesSalida.fecha} < ${fin}`
      )
    )
    .groupBy(ngMonedas.idmoneda, ngMonedas.moneda)
    .orderBy(ngMonedas.moneda);

  const extracciones = await db
    .select({
      idextraccion: ilExtracciones.idextraccion,
      importe: ilExtracciones.importe,
      nota: ilExtracciones.nota,
      creadoEn: ilExtracciones.creadoEn,
      creadoPor: ngUsuarios.nombreCompleto,
    })
    .from(ilExtracciones)
    .leftJoin(ngUsuarios, eq(ngUsuarios.idusuario, ilExtracciones.creadoPor))
    .where(
      and(
        eq(ilExtracciones.idempresa, user.idempresa),
        eq(ilExtracciones.idalmacen, idalmacen),
        eq(ilExtracciones.fecha, fecha)
      )
    )
    .orderBy(ilExtracciones.creadoEn);

  let stockAlCierre: Array<{ idproducto: number; producto: string; cantidad: string }> = [];
  if (resumen.cerrado) {
    stockAlCierre = await db
      .select({
        idproducto: ngProductos.idproducto,
        producto: ngProductos.producto,
        cantidad: ilVentaDia.cantidad,
      })
      .from(ilVentaDia)
      .innerJoin(ngProductos, eq(ngProductos.idproducto, ilVentaDia.idproducto))
      .where(
        and(
          eq(ilVentaDia.idempresa, user.idempresa),
          eq(ilVentaDia.idalmacen, idalmacen),
          eq(ilVentaDia.fecha, fecha)
        )
      )
      .orderBy(ngProductos.producto);
  }

  return json({ ...resumen, ventasPorProducto, pagosPorMoneda, extracciones, stockAlCierre });
};
