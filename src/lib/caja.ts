import { and, eq, gte, lt, sum } from "drizzle-orm";
import { db } from "@/db/client";
import { ilValesSalida, ilValesSalidaDetalle, ilExtracciones, ngFechaCierre } from "@/db/schema";

/** Convierte "YYYY-MM-DD" en el rango [00:00:00, 24:00:00) para filtrar
 * columnas timestamp (il_valessalida.fecha) del día correspondiente. */
export function rangoDelDia(fecha: string) {
  const inicio = new Date(`${fecha}T00:00:00.000Z`);
  const fin = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
  return { inicio, fin };
}

/**
 * Calcula el resumen de caja de un punto de venta (almacén) para un día:
 * total vendido, total extraído y efectivo disponible en caja, más si el
 * día ya fue cerrado. Antes ExtraccionEfectivo.CargarDatos() +
 * CierreInventario (chequeo de NG_FechaCierre).
 */
export async function calcularResumenCaja(idempresa: number, idalmacen: number, fecha: string) {
  const { inicio, fin } = rangoDelDia(fecha);

  // Total vendido: suma de cantidad*pventa de las líneas de ventas no
  // anuladas de ese punto de venta en el día (el original solo sumaba
  // IL_ValesSalida_Detalle.Pventa sin multiplicar por cantidad, lo que era
  // incorrecto si una línea tenía cantidad > 1; aquí se corrige).
  const ventasDelDia = await db
    .select({
      idvalesalida: ilValesSalida.idvalesalida,
      cantidad: ilValesSalidaDetalle.cantidad,
      pventa: ilValesSalidaDetalle.pventa,
    })
    .from(ilValesSalida)
    .innerJoin(ilValesSalidaDetalle, eq(ilValesSalidaDetalle.idvalesalida, ilValesSalida.idvalesalida))
    .where(
      and(
        eq(ilValesSalida.idempresa, idempresa),
        eq(ilValesSalida.idalmacen, idalmacen),
        eq(ilValesSalida.anulada, false),
        gte(ilValesSalida.fecha, inicio),
        lt(ilValesSalida.fecha, fin)
      )
    );

  const totalVentas = ventasDelDia.reduce((acc, l) => acc + Number(l.cantidad) * Number(l.pventa), 0);
  const cantidadVentas = new Set(ventasDelDia.map((l) => l.idvalesalida)).size;

  const [{ total: totalExtraccionesRaw }] = await db
    .select({ total: sum(ilExtracciones.importe) })
    .from(ilExtracciones)
    .where(
      and(
        eq(ilExtracciones.idempresa, idempresa),
        eq(ilExtracciones.idalmacen, idalmacen),
        eq(ilExtracciones.fecha, fecha)
      )
    );
  const totalExtracciones = Number(totalExtraccionesRaw ?? 0);

  const efectivoEnCaja = totalVentas - totalExtracciones;

  const [cierre] = await db
    .select()
    .from(ngFechaCierre)
    .where(
      and(
        eq(ngFechaCierre.idempresa, idempresa),
        eq(ngFechaCierre.idalmacen, idalmacen),
        eq(ngFechaCierre.fecha, fecha)
      )
    )
    .limit(1);

  return {
    idalmacen,
    fecha,
    cantidadVentas,
    totalVentas,
    totalExtracciones,
    efectivoEnCaja,
    cerrado: !!cierre?.cerrado,
    cerradoEn: cierre?.cerradoEn ?? null,
    cerradoPor: cierre?.cerradoPor ?? null,
  };
}
