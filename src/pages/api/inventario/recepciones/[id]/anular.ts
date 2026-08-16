import type { APIRoute } from "astro";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ilRecepciones, ilRecepcionesDetalle } from "@/db/schema";
import { json, requireUser, isResponse } from "@/lib/api";
import { ajustarExistencia } from "@/lib/existencias";

export const prerender = false;

// Anula una recepción ya registrada: revierte la entrada de mercancía
// (resta del almacén lo que esa recepción había sumado) y la marca como
// anulada, igual que el "Anular" que ya existe para Ventas.
export const POST: APIRoute = async ({ params, locals }) => {
  const user = requireUser(locals, "inventario");
  if (isResponse(user)) return user;

  const id = Number(params.id);

  const result = await db.transaction(async (tx) => {
    const [recepcion] = await tx
      .select()
      .from(ilRecepciones)
      .where(and(eq(ilRecepciones.idrecepcion, id), eq(ilRecepciones.idempresa, user.idempresa)))
      .limit(1);

    if (!recepcion) return { status: 404 as const };
    // Un borrador (no inventariada) nunca tocó existencias — no hay nada
    // que revertir; se borra con DELETE en vez de anularse.
    if (!recepcion.inventariada) return { status: 400 as const };
    if (recepcion.anulada) return { status: 200 as const, row: recepcion };

    const lineas = await tx.select().from(ilRecepcionesDetalle).where(eq(ilRecepcionesDetalle.idrecepcion, id));

    for (const linea of lineas) {
      // Resta del almacén lo que la recepción había sumado.
      await ajustarExistencia(tx, {
        idempresa: user.idempresa,
        idalmacen: recepcion.idalmacen,
        idproducto: linea.idproducto,
        delta: -Number(linea.cantidad),
      });
    }

    const [actualizada] = await tx
      .update(ilRecepciones)
      .set({ anulada: true })
      .where(eq(ilRecepciones.idrecepcion, id))
      .returning();

    return { status: 200 as const, row: actualizada };
  });

  if (result.status === 404) return json({ error: "No encontrado" }, 404);
  if (result.status === 400) return json({ error: "Esta recepción es un borrador (no inventariada); elimínala en vez de anularla" }, 400);
  return json(result.row);
};
