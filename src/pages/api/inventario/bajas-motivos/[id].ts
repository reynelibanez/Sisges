import type { APIRoute } from "astro";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ngBajas } from "@/db/schema";
import { json, requireUser, isResponse } from "@/lib/api";

export const prerender = false;
const schema = z.object({ bajas: z.string().min(1) });

export const PUT: APIRoute = async ({ request, params, locals }) => {
  const user = requireUser(locals, "inventario");
  if (isResponse(user)) return user;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const [row] = await db
    .update(ngBajas)
    .set(parsed.data)
    .where(and(eq(ngBajas.idbajas, Number(params.id)), eq(ngBajas.idempresa, user.idempresa)))
    .returning();
  if (!row) return json({ error: "No encontrado" }, 404);
  return json(row);
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const user = requireUser(locals, "inventario");
  if (isResponse(user)) return user;
  try {
    const result = await db
      .delete(ngBajas)
      .where(and(eq(ngBajas.idbajas, Number(params.id)), eq(ngBajas.idempresa, user.idempresa)))
      .returning();
    if (result.length === 0) return json({ error: "No encontrado" }, 404);
    return json({ ok: true });
  } catch {
    return json({ error: "No se puede eliminar: hay bajas registradas con este motivo" }, 409);
  }
};
