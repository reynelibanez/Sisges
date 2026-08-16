import type { APIRoute } from "astro";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ilTransferencias, ilTransferenciasDetalle } from "@/db/schema";
import { json, requireUser, isResponse } from "@/lib/api";
import { ajustarExistencia } from "@/lib/existencias";

export const prerender = false;

const detalleSchema = z.object({
  idproducto: z.coerce.number().int(),
  cantidad: z.coerce.number().positive(),
  preciocosto: z.coerce.number().min(0),
  pventa: z.coerce.number().min(0),
});

const editarSchema = z
  .object({
    origen: z.coerce.number().int(),
    destino: z.coerce.number().int(),
    nota: z.string().optional().nullable(),
    inventariada: z.boolean().optional().default(false),
    detalle: z.array(detalleSchema).min(1, "Agrega al menos un producto"),
  })
  .refine((v) => v.origen !== v.destino, {
    message: "El almacén origen y destino no pueden ser el mismo",
    path: ["destino"],
  });

// Edita un borrador, o lo fija (inventariada=true) moviendo el stock ahora
// y bloqueando la transferencia para siempre.
export const PUT: APIRoute = async ({ params, request, locals }) => {
  const user = requireUser(locals, "inventario");
  if (isResponse(user)) return user;

  const id = Number(params.id);
  const parsed = editarSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const { origen, destino, nota, inventariada, detalle } = parsed.data;

  const result = await db.transaction(async (tx) => {
    const [existente] = await tx
      .select()
      .from(ilTransferencias)
      .where(and(eq(ilTransferencias.idtransferencia, id), eq(ilTransferencias.idempresa, user.idempresa)))
      .limit(1);

    if (!existente) return { status: 404 as const };
    if (existente.inventariada) return { status: 423 as const };

    await tx.delete(ilTransferenciasDetalle).where(eq(ilTransferenciasDetalle.idtransferencia, id));
    for (const linea of detalle) {
      await tx.insert(ilTransferenciasDetalle).values({
        idtransferencia: id,
        idproducto: linea.idproducto,
        preciocosto: String(linea.preciocosto),
        pventa: String(linea.pventa),
        cantidad: String(linea.cantidad),
      });
      if (inventariada) {
        await ajustarExistencia(tx, {
          idempresa: user.idempresa,
          idalmacen: origen,
          idproducto: linea.idproducto,
          delta: -linea.cantidad,
        });
        await ajustarExistencia(tx, {
          idempresa: user.idempresa,
          idalmacen: destino,
          idproducto: linea.idproducto,
          delta: linea.cantidad,
        });
      }
    }

    const [actualizada] = await tx
      .update(ilTransferencias)
      .set({ origen, destino, nota, inventariada })
      .where(eq(ilTransferencias.idtransferencia, id))
      .returning();

    return { status: 200 as const, row: actualizada };
  });

  if (result.status === 404) return json({ error: "No encontrado" }, 404);
  if (result.status === 423) return json({ error: "Esta transferencia ya está inventariada y no se puede modificar" }, 423);
  return json(result.row);
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const user = requireUser(locals, "inventario");
  if (isResponse(user)) return user;

  const id = Number(params.id);

  const [existente] = await db
    .select()
    .from(ilTransferencias)
    .where(and(eq(ilTransferencias.idtransferencia, id), eq(ilTransferencias.idempresa, user.idempresa)))
    .limit(1);

  if (!existente) return json({ error: "No encontrado" }, 404);
  if (existente.inventariada)
    return json({ error: "Esta transferencia ya está inventariada; usa Anular en vez de eliminar" }, 423);

  await db.delete(ilTransferencias).where(eq(ilTransferencias.idtransferencia, id));
  return json({ ok: true });
};
