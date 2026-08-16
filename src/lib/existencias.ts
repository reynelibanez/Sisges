import { and, eq, sql } from "drizzle-orm";
import type { db as DbType } from "@/db/client";
import { ilExistencias } from "@/db/schema";

/**
 * Suma (o resta, con delta negativo) al saldo de existencia de un producto
 * en un almacén. Si no existe la fila de existencia todavía, la crea.
 *
 * Nota: esto NO valida que el saldo quede negativo. Si quieres bloquear
 * ventas/transferencias cuando no hay stock suficiente, es el lugar para
 * agregar esa validación antes de llamar a esta función.
 */
export async function ajustarExistencia(
  tx: Parameters<Parameters<typeof DbType.transaction>[0]>[0],
  params: { idempresa: number; idalmacen: number; idproducto: number; delta: number }
) {
  const { idempresa, idalmacen, idproducto, delta } = params;

  const [existente] = await tx
    .select()
    .from(ilExistencias)
    .where(and(eq(ilExistencias.idalmacen, idalmacen), eq(ilExistencias.idproducto, idproducto)))
    .limit(1);

  if (existente) {
    await tx
      .update(ilExistencias)
      .set({ saldo: sql`${ilExistencias.saldo} + ${delta}` })
      .where(eq(ilExistencias.idexistencia, existente.idexistencia));
  } else {
    await tx.insert(ilExistencias).values({
      idempresa,
      idalmacen,
      idproducto,
      saldo: String(delta),
    });
  }
}
