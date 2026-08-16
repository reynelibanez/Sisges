import type { APIRoute } from "astro";
import { and, eq, gte, lte, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { ilValesMonedas, ilValesSalida, ngMonedas, ngAlmacen } from "@/db/schema";
import { json, requireUser, isResponse } from "@/lib/api";

export const prerender = false;

// "Vales con Monedas Extranjeras" (antes VentasConMonedasExtranjeras.cs):
// listado de pagos hechos en una moneda distinta de la base (tc != 1),
// para cuadrar caja cuando hay ventas cobradas en USD/otra divisa.
export const GET: APIRoute = async ({ url, locals }) => {
  const user = requireUser(locals, "inventario");
  if (isResponse(user)) return user;

  const desde = url.searchParams.get("desde");
  const hasta = url.searchParams.get("hasta");
  if (!desde || !hasta) return json({ error: "Faltan desde y hasta" }, 400);

  const rows = await db
    .select({
      id: ilValesMonedas.id,
      idvalesalida: ilValesMonedas.idvalesalida,
      noconsecutivo: ilValesSalida.noconsecutivo,
      fecha: ilValesSalida.fecha,
      almacen: ngAlmacen.almacen,
      moneda: ngMonedas.moneda,
      tc: ilValesMonedas.tc,
      importe: ilValesMonedas.importe,
    })
    .from(ilValesMonedas)
    .innerJoin(ilValesSalida, eq(ilValesSalida.idvalesalida, ilValesMonedas.idvalesalida))
    .innerJoin(ngMonedas, eq(ngMonedas.idmoneda, ilValesMonedas.idmoneda))
    .innerJoin(ngAlmacen, eq(ngAlmacen.idalmacen, ilValesSalida.idalmacen))
    .where(
      and(
        eq(ilValesSalida.idempresa, user.idempresa),
        eq(ilValesSalida.inventariada, true),
        eq(ilValesSalida.anulada, false),
        ne(ilValesMonedas.tc, "1"),
        gte(ilValesSalida.fecha, new Date(`${desde}T00:00:00Z`)),
        lte(ilValesSalida.fecha, new Date(`${hasta}T23:59:59Z`))
      )
    )
    .orderBy(ilValesSalida.fecha);

  return json(rows);
};
