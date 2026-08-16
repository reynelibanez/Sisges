import type { APIRoute } from "astro";
import { z } from "zod";
import { eq, and, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { ngProductosAsociados, ngProductos } from "@/db/schema";
import { json, requireUser, isResponse } from "@/lib/api";

export const prerender = false;

const schema = z.object({
  idproducto: z.coerce.number().int(),
  idproductoasociado: z.coerce.number().int(),
  cantidad: z.coerce.number().positive(),
});

// "Asociar productos" (antes ListadoProductosAsociados.cs): liga un producto
// principal (por ejemplo un combo o un producto elaborado) con los
// productos/materias primas que se descuentan al venderlo, y en qué
// cantidad. Alimenta el reporte "Consumo de Materia Prima".
export const GET: APIRoute = async ({ locals }) => {
  const user = requireUser(locals, "inventario");
  if (isResponse(user)) return user;

  const principal = alias(ngProductos, "principal");
  const asociado = alias(ngProductos, "asociado");

  const rows = await db
    .select({
      idproductosasociados: ngProductosAsociados.idproductosasociados,
      idproducto: ngProductosAsociados.idproducto,
      producto: principal.producto,
      idproductoasociado: ngProductosAsociados.idproductoasociado,
      productoAsociado: asociado.producto,
      cantidad: ngProductosAsociados.cantidad,
    })
    .from(ngProductosAsociados)
    .innerJoin(principal, eq(principal.idproducto, ngProductosAsociados.idproducto))
    .innerJoin(asociado, eq(asociado.idproducto, ngProductosAsociados.idproductoasociado))
    .where(eq(principal.idempresa, user.idempresa));

  return json(rows);
};

export const POST: APIRoute = async ({ request, locals }) => {
  const user = requireUser(locals, "inventario");
  if (isResponse(user)) return user;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const { idproducto, idproductoasociado, cantidad } = parsed.data;
  if (idproducto === idproductoasociado) {
    return json({ error: "El producto asociado no puede ser el mismo producto principal" }, 400);
  }

  const [row] = await db
    .insert(ngProductosAsociados)
    .values({ idproducto, idproductoasociado, cantidad: String(cantidad) })
    .returning();
  return json(row, 201);
};
