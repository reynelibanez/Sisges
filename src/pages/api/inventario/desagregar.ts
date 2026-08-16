import type { APIRoute } from "astro";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ngAlmacen, ilExistencias, ngProductos } from "@/db/schema";
import { json, requireUser, isResponse } from "@/lib/api";
import { ajustarExistencia } from "@/lib/existencias";

export const prerender = false;

const schema = z.object({
  idalmacen: z.coerce.number().int(),
  idproductoOrigen: z.coerce.number().int(),
  cantidadOrigen: z.coerce.number().positive(),
  idproductoDestino: z.coerce.number().int(),
  cantidadDestino: z.coerce.number().positive(),
});

// "Desagregar Producto" (antes PorcionarTarta.cs): resta existencia de un
// producto origen (por ejemplo una tarta entera) y suma existencia a un
// producto destino (por ejemplo las porciones), dentro del mismo almacén
// de venta. Las dos cantidades son independientes porque la unidad de
// medida puede ser distinta (1 tarta -> 8 porciones).
export const POST: APIRoute = async ({ request, locals }) => {
  const user = requireUser(locals, "inventario");
  if (isResponse(user)) return user;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const { idalmacen, idproductoOrigen, cantidadOrigen, idproductoDestino, cantidadDestino } = parsed.data;

  if (idproductoOrigen === idproductoDestino) {
    return json({ error: "El producto destino debe ser distinto del producto origen" }, 400);
  }

  const [almacen] = await db
    .select()
    .from(ngAlmacen)
    .where(and(eq(ngAlmacen.idalmacen, idalmacen), eq(ngAlmacen.idempresa, user.idempresa)))
    .limit(1);
  if (!almacen) return json({ error: "Almacén no encontrado" }, 404);

  const [origenExistencia] = await db
    .select()
    .from(ilExistencias)
    .where(and(eq(ilExistencias.idalmacen, idalmacen), eq(ilExistencias.idproducto, idproductoOrigen)))
    .limit(1);
  const saldoOrigen = Number(origenExistencia?.saldo ?? 0);
  if (saldoOrigen < cantidadOrigen) {
    return json({ error: `No hay suficiente existencia del producto origen (saldo actual: ${saldoOrigen})` }, 400);
  }

  await db.transaction(async (tx) => {
    await ajustarExistencia(tx, {
      idempresa: user.idempresa,
      idalmacen,
      idproducto: idproductoOrigen,
      delta: -cantidadOrigen,
    });
    await ajustarExistencia(tx, {
      idempresa: user.idempresa,
      idalmacen,
      idproducto: idproductoDestino,
      delta: cantidadDestino,
    });
  });

  return json({ ok: true });
};
