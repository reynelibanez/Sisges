import type { APIRoute } from "astro";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ngProductosTipos } from "@/db/schema";
import { json, requireUser, isResponse } from "@/lib/api";

export const prerender = false;
const schema = z.object({ tipo: z.string().min(1) });

export const PUT: APIRoute = async ({ request, params, locals }) => {
  const user = requireUser(locals, "inventario");
  if (isResponse(user)) return user;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const [row] = await db
    .update(ngProductosTipos)
    .set(parsed.data)
    .where(and(eq(ngProductosTipos.idtipo, Number(params.id)), eq(ngProductosTipos.idempresa, user.idempresa)))
    .returning();
  if (!row) return json({ error: "No encontrado" }, 404);
  return json(row);
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const user = requireUser(locals, "inventario");
  if (isResponse(user)) return user;
  try {
    const result = await db
      .delete(ngProductosTipos)
      .where(and(eq(ngProductosTipos.idtipo, Number(params.id)), eq(ngProductosTipos.idempresa, user.idempresa)))
      .returning();
    if (result.length === 0) return json({ error: "No encontrado" }, 404);
    return json({ ok: true });
  } catch {
    return json({ error: "No se puede eliminar: hay productos usando este tipo" }, 409);
  }
};
