import type { APIRoute } from "astro";
import { z } from "zod";
import { eq, max } from "drizzle-orm";
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

const recepcionSchema = z.object({
  idalmacen: z.coerce.number().int(),
  entregadapor: z.string().optional().nullable(),
  nota: z.string().optional().nullable(),
  // Igual que checkEditInventariada en el sistema original: mientras no
  // esté marcada, la recepción es un borrador que NO afecta existencias
  // todavía y se puede seguir editando. Al marcarla, sube el stock y la
  // recepción queda fija (ya no se puede modificar).
  inventariada: z.boolean().optional().default(false),
  detalle: z.array(detalleSchema).min(1, "Agrega al menos un producto"),
});

export const GET: APIRoute = async ({ locals }) => {
  const user = requireUser(locals, "inventario");
  if (isResponse(user)) return user;

  const rows = await db.query.ilRecepciones.findMany({
    where: (t, { eq }) => eq(t.idempresa, user.idempresa),
    with: { detalle: true },
    orderBy: (t, { desc }) => desc(t.fecha),
  });

  return json(rows);
};

export const POST: APIRoute = async ({ request, locals }) => {
  const user = requireUser(locals, "inventario");
  if (isResponse(user)) return user;

  const parsed = recepcionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const { idalmacen, entregadapor, nota, inventariada, detalle } = parsed.data;

  const row = await db.transaction(async (tx) => {
    const [{ ultimo }] = await tx
      .select({ ultimo: max(ilRecepciones.noconsecutivo) })
      .from(ilRecepciones)
      .where(eq(ilRecepciones.idempresa, user.idempresa));

    const [recepcion] = await tx
      .insert(ilRecepciones)
      .values({
        idempresa: user.idempresa,
        noconsecutivo: (ultimo ?? 0) + 1,
        idalmacen,
        entregadapor,
        nota,
        inventariada,
        creadoPor: user.idusuario,
      })
      .returning();

    for (const linea of detalle) {
      await tx.insert(ilRecepcionesDetalle).values({
        idrecepcion: recepcion.idrecepcion,
        idproducto: linea.idproducto,
        pcosto: String(linea.pcosto),
        pventa: String(linea.pventa),
        cantidad: String(linea.cantidad),
      });

      // Una recepción entra mercancía al almacén, pero solo cuando queda
      // inventariada — mientras es borrador no toca el stock todavía.
      if (inventariada) {
        await ajustarExistencia(tx, {
          idempresa: user.idempresa,
          idalmacen,
          idproducto: linea.idproducto,
          delta: linea.cantidad,
        });
      }
    }

    return recepcion;
  });

  return json(row, 201);
};
