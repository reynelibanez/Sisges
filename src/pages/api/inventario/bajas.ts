import type { APIRoute } from "astro";
import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { bajasPor, ngAlmacen } from "@/db/schema";
import { json, requireUser, isResponse } from "@/lib/api";
import { ajustarExistencia } from "@/lib/existencias";

export const prerender = false;

const schema = z.object({
  idbajas: z.coerce.number().int(),
  idalmacen: z.coerce.number().int(),
  idproducto: z.coerce.number().int(),
  cantidad: z.coerce.number().positive(),
  pcosto: z.coerce.number().min(0),
  pventa: z.coerce.number().min(0),
});

export const GET: APIRoute = async ({ locals }) => {
  const user = requireUser(locals, "inventario");
  if (isResponse(user)) return user;

  // bajaspor no tiene idempresa directo; se filtra por los almacenes de la empresa.
  const almacenes = await db
    .select({ idalmacen: ngAlmacen.idalmacen })
    .from(ngAlmacen)
    .where(eq(ngAlmacen.idempresa, user.idempresa));
  const ids = almacenes.map((a) => a.idalmacen);
  if (ids.length === 0) return json([]);

  const rows = await db.select().from(bajasPor).where(inArray(bajasPor.idalmacen, ids));
  return json(rows);
};

export const POST: APIRoute = async ({ request, locals }) => {
  const user = requireUser(locals, "inventario");
  if (isResponse(user)) return user;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const { idbajas, idalmacen, idproducto, cantidad, pcosto, pventa } = parsed.data;

  const row = await db.transaction(async (tx) => {
    const [baja] = await tx
      .insert(bajasPor)
      .values({
        idbajas,
        idalmacen,
        idproducto,
        cantidad: String(cantidad),
        pcosto: String(pcosto),
        pventa: String(pventa),
        creadoPor: user.idusuario,
      })
      .returning();

    await ajustarExistencia(tx, {
      idempresa: user.idempresa,
      idalmacen,
      idproducto,
      delta: -cantidad,
    });

    return baja;
  });

  return json(row, 201);
};
