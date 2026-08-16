import { inArray } from "drizzle-orm";
import type { db as DbType } from "@/db/client";
import { ngProductosAsociados, ilValesSalidaDetalle } from "@/db/schema";
import { ajustarExistencia } from "@/lib/existencias";

/**
 * Reproduce RebajarAsociados() del Caja.cs original: cuando se vende un
 * producto "elaborado" (combo/receta) que tiene productos asociados
 * definidos en Asociar productos (NG_ProductosAsociados — la materia
 * prima que consume), agrega AL MISMO VALE una línea extra por cada
 * materia prima, con Cantidad = cantidad_vendida_del_principal x
 * cantidad_por_unidad, PrecioCosto=0 y Pventa=0 (no suma al total ni se
 * cobra aparte — es puro consumo interno de stock), y descuenta esa
 * existencia igual que la línea principal.
 *
 * Solo expande un nivel (igual que el original: no revisa si la materia
 * prima agregada tiene a su vez productos asociados).
 */
export async function agregarProductosAsociados(
  tx: Parameters<Parameters<typeof DbType.transaction>[0]>[0],
  params: {
    idempresa: number;
    idalmacen: number;
    idvalesalida: number;
    inventariada: boolean;
    detalle: { idproducto: number; cantidad: number }[];
  }
) {
  const { idempresa, idalmacen, idvalesalida, inventariada, detalle } = params;
  if (detalle.length === 0) return;

  const idsProductos = [...new Set(detalle.map((l) => l.idproducto))];
  const asociaciones = await tx
    .select()
    .from(ngProductosAsociados)
    .where(inArray(ngProductosAsociados.idproducto, idsProductos));

  if (asociaciones.length === 0) return;

  for (const linea of detalle) {
    const asociadas = asociaciones.filter((a) => a.idproducto === linea.idproducto);
    for (const asociada of asociadas) {
      const cantidadMP = linea.cantidad * Number(asociada.cantidad);
      if (cantidadMP <= 0) continue;

      await tx.insert(ilValesSalidaDetalle).values({
        idvalesalida,
        idproducto: asociada.idproductoasociado,
        preciocosto: "0",
        pventa: "0",
        cantidad: String(cantidadMP),
      });

      if (inventariada) {
        await ajustarExistencia(tx, {
          idempresa,
          idalmacen,
          idproducto: asociada.idproductoasociado,
          delta: -cantidadMP,
        });
      }
    }
  }
}
