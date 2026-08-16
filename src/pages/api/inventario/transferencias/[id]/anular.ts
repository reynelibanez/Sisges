import type { APIRoute } from "astro";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ilTransferencias, ilTransferenciasDetalle } from "@/db/schema";
import { json, requireUser, isResponse } from "@/lib/api";
import { ajustarExistencia } from "@/lib/existencias";

export const prerender = false;

// Anula una transferencia ya registrada: revierte el movimiento (devuelve
// al almacén origen, resta del almacén destino) y la marca como anulada.
export const POST: APIRoute = async ({ params, locals }) => {
  const user = requireUser(locals, "inventario");
  if (isResponse(user)) return user;

  const id = Number(params.id);

  const result = await db.transaction(async (tx) => {
    const [transferencia] = await tx
      .select()
      .from(ilTransferencias)
      .where(and(eq(ilTransferencias.idtransferencia, id), eq(ilTransferencias.idempresa, user.idempresa)))
      .limit(1);

    if (!transferencia) return { status: 404 as const };
    if (!transferencia.inventariada) return { status: 400 as const };
    if (transferencia.anulada) return { status: 200 as const, row: transferencia };

    const lineas = await tx
      .select()
      .from(ilTransferenciasDetalle)
      .where(eq(ilTransferenciasDetalle.idtransferencia, id));

    for (const linea of lineas) {
      await ajustarExistencia(tx, {
        idempresa: user.idempresa,
        idalmacen: transferencia.origen,
        idproducto: linea.idproducto,
        delta: Number(linea.cantidad),
      });
      await ajustarExistencia(tx, {
        idempresa: user.idempresa,
        idalmacen: transferencia.destino,
        idproducto: linea.idproducto,
        delta: -Number(linea.cantidad),
      });
    }

    const [actualizada] = await tx
      .update(ilTransferencias)
      .set({ anulada: true })
      .where(eq(ilTransferencias.idtransferencia, id))
      .returning();

    return { status: 200 as const, row: actualizada };
  });

  if (result.status === 404) return json({ error: "No encontrado" }, 404);
  if (result.status === 400)
    return json({ error: "Esta transferencia es un borrador (no inventariada); elimínala en vez de anularla" }, 400);
  return json(result.row);
};
