import type { APIRoute } from "astro";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ngFechaCierre, ilExistencias, ilVentaDia } from "@/db/schema";
import { json, requireUser, isResponse } from "@/lib/api";

export const prerender = false;

const cierreSchema = z.object({
  idalmacen: z.coerce.number().int(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
});

// Cierre de caja del día (antes CierreInventario.bAceptar_Click): marca el
// día como cerrado para el punto de venta y guarda una foto del stock de
// ese almacén en IL_VentaDia. No se puede cerrar el mismo día/almacén dos
// veces.
export const POST: APIRoute = async ({ request, locals }) => {
  const user = requireUser(locals, "caja");
  if (isResponse(user)) return user;

  const parsed = cierreSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const { idalmacen, fecha } = parsed.data;

  const resultado = await db.transaction(async (tx) => {
    const [existente] = await tx
      .select()
      .from(ngFechaCierre)
      .where(
        and(
          eq(ngFechaCierre.idempresa, user.idempresa),
          eq(ngFechaCierre.idalmacen, idalmacen),
          eq(ngFechaCierre.fecha, fecha)
        )
      )
      .limit(1);

    if (existente?.cerrado) {
      return { yaEstabaCerrado: true as const };
    }

    const [cierre] = await tx
      .insert(ngFechaCierre)
      .values({
        idempresa: user.idempresa,
        idalmacen,
        fecha,
        cerrado: true,
        cerradoPor: user.idusuario,
      })
      .returning();

    const existencias = await tx
      .select()
      .from(ilExistencias)
      .where(and(eq(ilExistencias.idempresa, user.idempresa), eq(ilExistencias.idalmacen, idalmacen)));

    if (existencias.length > 0) {
      await tx.insert(ilVentaDia).values(
        existencias.map((e) => ({
          idempresa: user.idempresa,
          idalmacen,
          idproducto: e.idproducto,
          cantidad: e.saldo,
          fecha,
        }))
      );
    }

    return { yaEstabaCerrado: false as const, cierre, productos: existencias.length };
  });

  if (resultado.yaEstabaCerrado) {
    return json({ error: "Ya el día está cerrado" }, 400);
  }

  return json(resultado, 201);
};
