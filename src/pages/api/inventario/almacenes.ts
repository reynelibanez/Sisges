import type { APIRoute } from "astro";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ngAlmacen } from "@/db/schema";
import { json, requireUser, requireAny, isResponse } from "@/lib/api";

export const prerender = false;

const schema = z.object({
  almacen: z.string().min(1),
  codigo: z.string().optional().nullable(),
  abierto: z.boolean().optional().default(true),
  pventa: z.boolean().optional().default(false),
});

export const GET: APIRoute = async ({ locals }) => {
  // Caja también necesita leer los puntos de venta para vender, no solo Inventario.
  const user = requireAny(locals, ["caja", "inventario"]);
  if (isResponse(user)) return user;
  const rows = await db.select().from(ngAlmacen).where(eq(ngAlmacen.idempresa, user.idempresa));
  return json(rows);
};

export const POST: APIRoute = async ({ request, locals }) => {
  const user = requireUser(locals, "inventario");
  if (isResponse(user)) return user;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const [row] = await db
    .insert(ngAlmacen)
    .values({ ...parsed.data, idempresa: user.idempresa })
    .returning();
  return json(row, 201);
};
