import type { APIRoute } from "astro";
import { and, eq, gte, lte, sql, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { ilValesSalida, ilValesSalidaDetalle, ngProductos } from "@/db/schema";
import { json, requireUser, isResponse } from "@/lib/api";

export const prerender = false;

// "Ganancias" (nuevo — no existía en el sistema original): calcula la
// ganancia real de las ventas ya cobradas/fijadas en un rango de fechas,
// usando el Costo y Venta que quedaron grabados en cada línea del vale
// (no el precio actual del catálogo, para que el reporte sea fiel a lo que
// realmente se cobró). Solo cuenta ventas inventariadas (fijadas) y no
// anuladas — un borrador o una venta anulada no representa una ganancia
// real todavía.
export const GET: APIRoute = async ({ url, locals }) => {
  const user = requireUser(locals, "inventario");
  if (isResponse(user)) return user;

  const desde = url.searchParams.get("desde");
  const hasta = url.searchParams.get("hasta");
  const idalmacenParam = url.searchParams.get("idalmacen");
  const idalmacen = idalmacenParam ? Number(idalmacenParam) : null;
  if (!desde || !hasta) return json({ error: "Faltan desde y hasta" }, 400);

  const condiciones = [
    eq(ilValesSalida.idempresa, user.idempresa),
    eq(ilValesSalida.inventariada, true),
    eq(ilValesSalida.anulada, false),
    gte(ilValesSalida.fecha, new Date(`${desde}T00:00:00Z`)),
    lte(ilValesSalida.fecha, new Date(`${hasta}T23:59:59Z`)),
  ];
  if (idalmacen) condiciones.push(eq(ilValesSalida.idalmacen, idalmacen));

  const rows = await db
    .select({
      idproducto: ngProductos.idproducto,
      producto: ngProductos.producto,
      cantidad: sql<string>`sum(${ilValesSalidaDetalle.cantidad})`,
      ingresos: sql<string>`sum(${ilValesSalidaDetalle.cantidad} * ${ilValesSalidaDetalle.pventa})`,
      costo: sql<string>`sum(${ilValesSalidaDetalle.cantidad} * ${ilValesSalidaDetalle.preciocosto})`,
    })
    .from(ilValesSalidaDetalle)
    .innerJoin(ilValesSalida, eq(ilValesSalida.idvalesalida, ilValesSalidaDetalle.idvalesalida))
    .innerJoin(ngProductos, eq(ngProductos.idproducto, ilValesSalidaDetalle.idproducto))
    .where(and(...condiciones))
    .groupBy(ngProductos.idproducto, ngProductos.producto);

  const productos = rows
    .map((r) => {
      const ingresos = Number(r.ingresos);
      const costo = Number(r.costo);
      const ganancia = ingresos - costo;
      return {
        idproducto: r.idproducto,
        producto: r.producto,
        cantidad: Number(r.cantidad),
        ingresos,
        costo,
        ganancia,
        margenPct: ingresos > 0 ? (ganancia / ingresos) * 100 : 0,
      };
    })
    .sort((a, b) => b.ganancia - a.ganancia);

  const resumen = productos.reduce(
    (acc, p) => {
      acc.ingresos += p.ingresos;
      acc.costo += p.costo;
      acc.ganancia += p.ganancia;
      return acc;
    },
    { ingresos: 0, costo: 0, ganancia: 0 }
  );

  return json({
    resumen: {
      ...resumen,
      margenPct: resumen.ingresos > 0 ? (resumen.ganancia / resumen.ingresos) * 100 : 0,
    },
    productos,
  });
};
