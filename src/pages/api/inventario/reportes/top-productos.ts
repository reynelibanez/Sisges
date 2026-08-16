import type { APIRoute } from "astro";
import { and, eq, gte, lte, sql, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { ilValesSalida, ilValesSalidaDetalle, ngProductos } from "@/db/schema";
import { json, requireUser, isResponse } from "@/lib/api";

export const prerender = false;

// "Top - Productos Vendidos" (antes GraficosProductos.cs): ranking de
// productos por cantidad vendida en un rango de fechas, con la opción de
// ver todos o solo el top N.
export const GET: APIRoute = async ({ url, locals }) => {
  const user = requireUser(locals, "inventario");
  if (isResponse(user)) return user;

  const desde = url.searchParams.get("desde");
  const hasta = url.searchParams.get("hasta");
  const topParam = url.searchParams.get("top");
  const top = topParam ? Number(topParam) : 0;
  if (!desde || !hasta) return json({ error: "Faltan desde y hasta" }, 400);

  let query = db
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
        eq(ilValesSalida.inventariada, true),
        eq(ilValesSalida.anulada, false),
        gte(ilValesSalida.fecha, new Date(`${desde}T00:00:00Z`)),
        lte(ilValesSalida.fecha, new Date(`${hasta}T23:59:59Z`))
      )
    )
    .groupBy(ngProductos.idproducto, ngProductos.producto)
    .orderBy(desc(sql`sum(${ilValesSalidaDetalle.cantidad})`))
    .$dynamic();

  if (top > 0) query = query.limit(top);

  const rows = await query;
  const productos = rows.map((r) => ({
    idproducto: r.idproducto,
    producto: r.producto,
    cantidad: Number(r.cantidad),
    importe: Number(r.importe),
  }));
  const max = productos.reduce((m, p) => Math.max(m, p.cantidad), 0);

  return json({ productos, max });
};
