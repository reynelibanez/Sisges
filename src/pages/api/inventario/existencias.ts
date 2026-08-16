import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ilExistencias, ngProductos, ngAlmacen } from "@/db/schema";
import { json, requireAny, isResponse } from "@/lib/api";

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  // Caja necesita la existencia en vivo por punto de venta al vender, no solo Inventario.
  const user = requireAny(locals, ["caja", "inventario"]);
  if (isResponse(user)) return user;

  const rows = await db
    .select({
      idexistencia: ilExistencias.idexistencia,
      idalmacen: ilExistencias.idalmacen,
      almacen: ngAlmacen.almacen,
      idproducto: ilExistencias.idproducto,
      producto: ngProductos.producto,
      referencia: ngProductos.referencia,
      saldo: ilExistencias.saldo,
      // Precios actuales del catálogo — se usan para estimar la ganancia
      // potencial si se vendiera toda la existencia (no es un histórico,
      // así que si el precio cambió desde que entró el stock, es solo un
      // estimado).
      pcosto: ngProductos.pcosto,
      pventa: ngProductos.pventa,
    })
    .from(ilExistencias)
    .innerJoin(ngProductos, eq(ngProductos.idproducto, ilExistencias.idproducto))
    .innerJoin(ngAlmacen, eq(ngAlmacen.idalmacen, ilExistencias.idalmacen))
    .where(eq(ilExistencias.idempresa, user.idempresa));

  return json(rows);
};
