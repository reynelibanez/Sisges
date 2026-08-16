import type { APIRoute } from "astro";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ilRecepciones, ilRecepcionesDetalle } from "@/db/schema";
import { json, requireUser, isResponse } from "@/lib/api";
import { ajustarExistencia } from "@/lib/existencias";

export const prerender = false;

const detalleSchema = z.object({
  idproducto: z.coerce.number().int(),
  cantidad: z.coerce.number().positive(),
  pcosto: z.coerce.number().min(0),
  pventa: z.coerce.number().min(0),
});

const editarSchema = z.object({
  idalmacen: z.coerce.number().int(),
  entregadapor: z.string().optional().nullable(),
  nota: z.string().optional().nullable(),
  inventariada: z.boolean().optional().default(false),
  detalle: z.array(detalleSchema).min(1, "Agrega al menos un producto"),
});

// Edita un borrador (inventariada=false) — igual que reabrir
// Recepciones_Nueva sobre un registro existente en el sistema original. Si
// se manda inventariada=true, en este mismo paso se fija: sube existencias
// y la recepción queda bloqueada para siempre (ya no se puede volver a
// editar ni desmarcar, tal como "Ya no podrá modificarla").
export const PUT: APIRoute = async ({ params, request, locals }) => {
  const user = requireUser(locals, "inventario");
  if (isResponse(user)) return user;

  const id = Number(params.id);
  const parsed = editarSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const { idalmacen, entregadapor, nota, inventariada, detalle } = parsed.data;

  const result = await db.transaction(async (tx) => {
    const [existente] = await tx
      .select()
      .from(ilRecepciones)
      .where(and(eq(ilRecepciones.idrecepcion, id), eq(ilRecepciones.idempresa, user.idempresa)))
      .limit(1);

    if (!existente) return { status: 404 as const };
    if (existente.inventariada) return { status: 423 as const }; // ya fija, no se puede tocar

    await tx.delete(ilRecepcionesDetalle).where(eq(ilRecepcionesDetalle.idrecepcion, id));
    for (const linea of detalle) {
      await tx.insert(ilRecepcionesDetalle).values({
        idrecepcion: id,
        idproducto: linea.idproducto,
        pcosto: String(linea.pcosto),
        pventa: String(linea.pventa),
        cantidad: String(linea.cantidad),
      });
      if (inventariada) {
        await ajustarExistencia(tx, {
          idempresa: user.idempresa,
          idalmacen,
          idproducto: linea.idproducto,
          delta: linea.cantidad,
        });
      }
    }

    const [actualizada] = await tx
      .update(ilRecepciones)
      .set({ idalmacen, entregadapor, nota, inventariada })
      .where(eq(ilRecepciones.idrecepcion, id))
      .returning();

    return { status: 200 as const, row: actualizada };
  });

  if (result.status === 404) return json({ error: "No encontrado" }, 404);
  if (result.status === 423) return json({ error: "Esta recepción ya está inventariada y no se puede modificar" }, 423);
  return json(result.row);
};

// Elimina un borrador (nunca tocó existencias, así que se puede borrar sin
// más). Una vez inventariada, se usa "Anular" en vez de esto.
export const DELETE: APIRoute = async ({ params, locals }) => {
  const user = requireUser(locals, "inventario");
  if (isResponse(user)) return user;

  const id = Number(params.id);

  const [existente] = await db
    .select()
    .from(ilRecepciones)
    .where(and(eq(ilRecepciones.idrecepcion, id), eq(ilRecepciones.idempresa, user.idempresa)))
    .limit(1);

  if (!existente) return json({ error: "No encontrado" }, 404);
  if (existente.inventariada) return json({ error: "Esta recepción ya está inventariada; usa Anular en vez de eliminar" }, 423);

  await db.delete(ilRecepciones).where(eq(ilRecepciones.idrecepcion, id));
  return json({ ok: true });
};
