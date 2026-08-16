import type { APIRoute } from "astro";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ngProductos } from "@/db/schema";
import { json, requireUser, isResponse } from "@/lib/api";

export const prerender = false;

const productoSchema = z.object({
  producto: z.string().min(1),
  referencia: z.string().optional().nullable(),
  pcosto: z.coerce.number().min(0),
  pventa: z.coerce.number().min(0),
  um: z.coerce.number().int().optional().nullable(),
  idtipo: z.coerce.number().int().optional().nullable(),
  rutaimagen: z.string().optional().nullable(),
  elaborado: z.boolean().optional(),
});

export const PUT: APIRoute = async ({ request, params, locals }) => {
  const user = requireUser(locals, "inventario");
  if (isResponse(user)) return user;

  const id = Number(params.id);
  const body = await request.json().catch(() => null);
  const parsed = productoSchema.safeParse(body);
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);

  const [row] = await db
    .update(ngProductos)
    .set({
      ...parsed.data,
      pcosto: String(parsed.data.pcosto),
      pventa: String(parsed.data.pventa),
    })
    .where(and(eq(ngProductos.idproducto, id), eq(ngProductos.idempresa, user.idempresa)))
    .returning();

  if (!row) return json({ error: "No encontrado" }, 404);
  return json(row);
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const user = requireUser(locals, "inventario");
  if (isResponse(user)) return user;

  const id = Number(params.id);

  // Baja lógica: no borramos físicamente para no romper históricos de
  // recepciones/ventas/transferencias que ya referencian el producto.
  const [row] = await db
    .update(ngProductos)
    .set({ activo: false })
    .where(and(eq(ngProductos.idproducto, id), eq(ngProductos.idempresa, user.idempresa)))
    .returning();

  if (!row) return json({ error: "No encontrado" }, 404);
  return json({ ok: true });
};
