import type { APIRoute } from "astro";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ngAreas } from "@/db/schema";
import { json, requireUser, requireAny, isResponse } from "@/lib/api";

export const prerender = false;

const schema = z.object({
  area: z.string().min(1),
  principal: z.boolean().optional().default(false),
});

export const GET: APIRoute = async ({ locals }) => {
  // Caja también necesita leer las áreas (mesas) para vender, no solo Inventario.
  const user = requireAny(locals, ["caja", "inventario"]);
  if (isResponse(user)) return user;
  const rows = await db.select().from(ngAreas).where(eq(ngAreas.idempresa, user.idempresa));
  return json(rows);
};

export const POST: APIRoute = async ({ request, locals }) => {
  const user = requireUser(locals, "inventario");
  if (isResponse(user)) return user;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const [row] = await db
    .insert(ngAreas)
    .values({ ...parsed.data, idempresa: user.idempresa })
    .returning();
  return json(row, 201);
};
