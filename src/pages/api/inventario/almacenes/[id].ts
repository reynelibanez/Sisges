import type { APIRoute } from "astro";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ngAlmacen } from "@/db/schema";
import { json, requireUser, isResponse } from "@/lib/api";

export const prerender = false;

const schema = z.object({
  almacen: z.string().min(1),
  codigo: z.string().optional().nullable(),
  abierto: z.boolean().optional(),
  pventa: z.boolean().optional(),
});

export const PUT: APIRoute = async ({ request, params, locals }) => {
  const user = requireUser(locals, "inventario");
  if (isResponse(user)) return user;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const [row] = await db
    .update(ngAlmacen)
    .set(parsed.data)
    .where(and(eq(ngAlmacen.idalmacen, Number(params.id)), eq(ngAlmacen.idempresa, user.idempresa)))
    .returning();
  if (!row) return json({ error: "No encontrado" }, 404);
  return json(row);
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const user = requireUser(locals, "inventario");
  if (isResponse(user)) return user;
  const [row] = await db
    .update(ngAlmacen)
    .set({ abierto: false })
    .where(and(eq(ngAlmacen.idalmacen, Number(params.id)), eq(ngAlmacen.idempresa, user.idempresa)))
    .returning();
  if (!row) return json({ error: "No encontrado" }, 404);
  return json({ ok: true });
};
