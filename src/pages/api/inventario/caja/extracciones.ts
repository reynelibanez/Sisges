import type { APIRoute } from "astro";
import { z } from "zod";
import { and, eq, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { ilExtracciones } from "@/db/schema";
import { json, requireUser, isResponse } from "@/lib/api";
import { calcularResumenCaja } from "@/lib/caja";

export const prerender = false;

const extraccionSchema = z.object({
  idalmacen: z.coerce.number().int(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  importe: z.coerce.number().positive(),
  nota: z.string().optional().nullable(),
});

// Lista de extracciones de un punto de venta en un día (antes solo se veía
// el total en ExtraccionEfectivo; aquí además se puede ver el detalle).
export const GET: APIRoute = async ({ url, locals }) => {
  const user = requireUser(locals, "caja");
  if (isResponse(user)) return user;

  const idalmacen = Number(url.searchParams.get("idalmacen"));
  const fecha = url.searchParams.get("fecha");
  if (!idalmacen || !fecha) {
    return json({ error: "Faltan los parámetros idalmacen y fecha" }, 400);
  }

  const rows = await db
    .select()
    .from(ilExtracciones)
    .where(
      and(
        eq(ilExtracciones.idempresa, user.idempresa),
        eq(ilExtracciones.idalmacen, idalmacen),
        eq(ilExtracciones.fecha, fecha)
      )
    )
    .orderBy(desc(ilExtracciones.creadoEn));

  return json(rows);
};

// Retiro de efectivo de la caja (antes ExtraccionEfectivo.button4_Click).
// El original tenía el chequeo de "no puede extraer más de lo que hay en
// caja" roto por un punto y coma de más (el if nunca bloqueaba nada); aquí
// se corrige y sí se aplica.
export const POST: APIRoute = async ({ request, locals }) => {
  const user = requireUser(locals, "caja");
  if (isResponse(user)) return user;

  const parsed = extraccionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const { idalmacen, fecha, importe, nota } = parsed.data;

  const resumen = await calcularResumenCaja(user.idempresa, idalmacen, fecha);
  if (resumen.cerrado) {
    return json({ error: "El día ya está cerrado, no se pueden hacer extracciones" }, 400);
  }
  if (importe > resumen.efectivoEnCaja) {
    return json(
      { error: `No puede extraer más de lo que hay en caja (disponible: ${resumen.efectivoEnCaja.toFixed(2)})` },
      400
    );
  }

  const [fila] = await db
    .insert(ilExtracciones)
    .values({
      idempresa: user.idempresa,
      idalmacen,
      fecha,
      importe: String(importe),
      nota,
      creadoPor: user.idusuario,
    })
    .returning();

  return json(fila, 201);
};
