import type { APIRoute } from "astro";
import { z } from "zod";
import { eq, max } from "drizzle-orm";
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

const transferenciaSchema = z
  .object({
    origen: z.coerce.number().int(),
    destino: z.coerce.number().int(),
    nota: z.string().optional().nullable(),
    // Igual que en Recepciones: mientras no esté inventariada es un
    // borrador que no mueve stock todavía.
    inventariada: z.boolean().optional().default(false),
    detalle: z.array(detalleSchema).min(1, "Agrega al menos un producto"),
  })
  .refine((v) => v.origen !== v.destino, {
    message: "El almacén origen y destino no pueden ser el mismo",
    path: ["destino"],
  });

export const GET: APIRoute = async ({ locals }) => {
  const user = requireUser(locals, "inventario");
  if (isResponse(user)) return user;

  const rows = await db.query.ilTransferencias.findMany({
    where: (t, { eq }) => eq(t.idempresa, user.idempresa),
    with: { detalle: true },
    orderBy: (t, { desc }) => desc(t.fecha),
  });

  return json(rows);
};

export const POST: APIRoute = async ({ request, locals }) => {
  const user = requireUser(locals, "inventario");
  if (isResponse(user)) return user;

  const parsed = transferenciaSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const { origen, destino, nota, inventariada, detalle } = parsed.data;

  const row = await db.transaction(async (tx) => {
    const [{ ultimo }] = await tx
      .select({ ultimo: max(ilTransferencias.noconsecutivo) })
      .from(ilTransferencias)
      .where(eq(ilTransferencias.idempresa, user.idempresa));

    const [transferencia] = await tx
      .insert(ilTransferencias)
      .values({
        idempresa: user.idempresa,
        noconsecutivo: (ultimo ?? 0) + 1,
        origen,
        destino,
        nota,
        inventariada,
        creadoPor: user.idusuario,
      })
      .returning();

    for (const linea of detalle) {
      await tx.insert(ilTransferenciasDetalle).values({
        idtransferencia: transferencia.idtransferencia,
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

    return transferencia;
  });

  return json(row, 201);
};
