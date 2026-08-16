import type { APIRoute } from "astro";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ngProductos } from "@/db/schema";
import { json, requireUser, requireAny, isResponse } from "@/lib/api";

export const prerender = false;

const productoSchema = z.object({
  producto: z.string().min(1),
  referencia: z.string().optional().nullable(),
  pcosto: z.coerce.number().min(0),
  pventa: z.coerce.number().min(0),
  um: z.coerce.number().int().optional().nullable(),
  idtipo: z.coerce.number().int().optional().nullable(),
  rutaimagen: z.string().optional().nullable(),
  elaborado: z.boolean().optional().default(false),
});

export const GET: APIRoute = async ({ locals }) => {
  // Caja también necesita leer el catálogo de productos para vender, no solo Inventario.
  const user = requireAny(locals, ["caja", "inventario"]);
  if (isResponse(user)) return user;

  const rows = await db
    .select()
    .from(ngProductos)
    .where(and(eq(ngProductos.idempresa, user.idempresa), eq(ngProductos.activo, true)));

  return json(rows);
};

export const POST: APIRoute = async ({ request, locals }) => {
  const user = requireUser(locals, "inventario");
  if (isResponse(user)) return user;

  const body = await request.json().catch(() => null);
  const parsed = productoSchema.safeParse(body);
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);

  const [row] = await db
    .insert(ngProductos)
    .values({
      ...parsed.data,
      pcosto: String(parsed.data.pcosto),
      pventa: String(parsed.data.pventa),
      idempresa: user.idempresa,
    })
    .returning();

  return json(row, 201);
};
