import type { APIRoute } from "astro";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ngProductosTipos } from "@/db/schema";
import { json, requireUser, isResponse } from "@/lib/api";

export const prerender = false;

const schema = z.object({ tipo: z.string().min(1) });

export const GET: APIRoute = async ({ locals }) => {
  const user = requireUser(locals, "inventario");
  if (isResponse(user)) return user;
  const rows = await db
    .select()
    .from(ngProductosTipos)
    .where(eq(ngProductosTipos.idempresa, user.idempresa));
  return json(rows);
};

export const POST: APIRoute = async ({ request, locals }) => {
  const user = requireUser(locals, "inventario");
  if (isResponse(user)) return user;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const [row] = await db
    .insert(ngProductosTipos)
    .values({ ...parsed.data, idempresa: user.idempresa })
    .returning();
  return json(row, 201);
};
