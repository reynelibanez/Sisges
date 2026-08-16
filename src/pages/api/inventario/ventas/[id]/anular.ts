import type { APIRoute } from "astro";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ilValesSalida, ilValesSalidaDetalle } from "@/db/schema";
import { json, requireAny, isResponse } from "@/lib/api";
import { ajustarExistencia } from "@/lib/existencias";

export const prerender = false;

// Tanto Caja (ventas cobradas) como Inventario (vales creados a mano desde
// Documentos) pueden necesitar anular un vale ya inventariado.
export const POST: APIRoute = async ({ params, locals }) => {
  const user = requireAny(locals, ["caja", "inventario"]);
  if (isResponse(user)) return user;

  const id = Number(params.id);

  const result = await db.transaction(async (tx) => {
    const [venta] = await tx
      .select()
      .from(ilValesSalida)
      .where(and(eq(ilValesSalida.idvalesalida, id), eq(ilValesSalida.idempresa, user.idempresa)))
      .limit(1);

    if (!venta) return { status: 404 as const };
    if (!venta.inventariada) return { status: 400 as const };
    if (venta.anulada) return { status: 200 as const, row: venta };

    const lineas = await tx
      .select()
      .from(ilValesSalidaDetalle)
      .where(eq(ilValesSalidaDetalle.idvalesalida, id));

    for (const linea of lineas) {
      // Devuelve al almacén lo que la venta había sacado.
      await ajustarExistencia(tx, {
        idempresa: user.idempresa,
        idalmacen: venta.idalmacen,
        idproducto: linea.idproducto,
        delta: Number(linea.cantidad),
      });
    }

    const [actualizada] = await tx
      .update(ilValesSalida)
      .set({ anulada: true })
      .where(eq(ilValesSalida.idvalesalida, id))
      .returning();

    return { status: 200 as const, row: actualizada };
  });

  if (result.status === 404) return json({ error: "No encontrado" }, 404);
  if (result.status === 400) return json({ error: "Este vale es un borrador (no inventariado); elimínalo en vez de anularlo" }, 400);
  return json(result.row);
};
