import type { APIRoute } from "astro";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ngProductosAsociados } from "@/db/schema";
import { json, requireUser, isResponse } from "@/lib/api";

export const prerender = false;

const schema = z.object({
  idproducto: z.coerce.number().int(),
  idproductoasociado: z.coerce.number().int(),
  cantidad: z.coerce.number().positive(),
});

export const PUT: APIRoute = async ({ request, params, locals }) => {
  const user = requireUser(locals, "inventario");
  if (isResponse(user)) return user;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const { idproducto, idproductoasociado, cantidad } = parsed.data;
  if (idproducto === idproductoasociado) {
    return json({ error: "El producto asociado no puede ser el mismo producto principal" }, 400);
  }
  const [row] = await db
    .update(ngProductosAsociados)
    .set({ idproducto, idproductoasociado, cantidad: String(cantidad) })
    .where(eq(ngProductosAsociados.idproductosasociados, Number(params.id)))
    .returning();
  if (!row) return json({ error: "No encontrado" }, 404);
  return json(row);
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const user = requireUser(locals, "inventario");
  if (isResponse(user)) return user;
  const [row] = await db
    .delete(ngProductosAsociados)
    .where(eq(ngProductosAsociados.idproductosasociados, Number(params.id)))
    .returning();
  if (!row) return json({ error: "No encontrado" }, 404);
  return json({ ok: true });
};
