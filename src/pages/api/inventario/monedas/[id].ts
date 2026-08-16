import type { APIRoute } from "astro";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ngMonedas } from "@/db/schema";
import { json, requireUser, isResponse } from "@/lib/api";

export const prerender = false;
const schema = z.object({ moneda: z.string().min(1), tc: z.coerce.number().positive() });

export const PUT: APIRoute = async ({ request, params, locals }) => {
  const user = requireUser(locals, "inventario");
  if (isResponse(user)) return user;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const [row] = await db
    .update(ngMonedas)
    .set({ moneda: parsed.data.moneda, tc: String(parsed.data.tc) })
    .where(and(eq(ngMonedas.idmoneda, Number(params.id)), eq(ngMonedas.idempresa, user.idempresa)))
    .returning();
  if (!row) return json({ error: "No encontrado" }, 404);
  return json(row);
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const user = requireUser(locals, "inventario");
  if (isResponse(user)) return user;
  const result = await db
    .delete(ngMonedas)
    .where(and(eq(ngMonedas.idmoneda, Number(params.id)), eq(ngMonedas.idempresa, user.idempresa)))
    .returning();
  if (result.length === 0) return json({ error: "No encontrado" }, 404);
  return json({ ok: true });
};
