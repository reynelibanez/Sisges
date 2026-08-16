import type { APIRoute } from "astro";
import { z } from "zod";
import { and, eq, max } from "drizzle-orm";
import { db } from "@/db/client";
import { ngBajas, bajasPor, ilRecepciones, ilRecepcionesDetalle } from "@/db/schema";
import { json, requireAny, isResponse } from "@/lib/api";
import { ajustarExistencia } from "@/lib/existencias";

export const prerender = false;

// "Porcionar" (antes PorcionarTarta en Caja.cs): consume una cantidad de un
// producto "origen" (p. ej. una tarta entera) y produce una o varias líneas
// de producto "destino" (p. ej. porciones), dentro del mismo almacén. No
// existía una tabla propia para esto en el original que tengamos a mano, así
// que se registra reutilizando el mismo par baja/recepción que ya usa el
// resto de Inventario, para que aparezca en esos listados y quede
// trazable, unidos por una nota compartida.
const lineaDestinoSchema = z.object({
  idproducto: z.coerce.number().int(),
  cantidad: z.coerce.number().positive(),
  pcosto: z.coerce.number().min(0).default(0),
  pventa: z.coerce.number().min(0).default(0),
});

const porcionarSchema = z.object({
  idalmacen: z.coerce.number().int(),
  idproductoOrigen: z.coerce.number().int(),
  cantidadOrigen: z.coerce.number().positive(),
  nota: z.string().optional().nullable(),
  destino: z.array(lineaDestinoSchema).min(1, "Agrega al menos una línea de destino"),
});

const MOTIVO_PORCIONAMIENTO = "Porcionamiento";

export const POST: APIRoute = async ({ request, locals }) => {
  const user = requireAny(locals, ["caja", "inventario"]);
  if (isResponse(user)) return user;

  const parsed = porcionarSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const { idalmacen, idproductoOrigen, cantidadOrigen, nota, destino } = parsed.data;

  const result = await db.transaction(async (tx) => {
    let [motivo] = await tx
      .select()
      .from(ngBajas)
      .where(and(eq(ngBajas.idempresa, user.idempresa), eq(ngBajas.bajas, MOTIVO_PORCIONAMIENTO)))
      .limit(1);
    if (!motivo) {
      [motivo] = await tx
        .insert(ngBajas)
        .values({ idempresa: user.idempresa, bajas: MOTIVO_PORCIONAMIENTO })
        .returning();
    }

    const notaCompartida = nota?.trim() ? nota.trim() : `Porcionado en ${new Date().toLocaleString("es")}`;

    const [baja] = await tx
      .insert(bajasPor)
      .values({
        idbajas: motivo.idbajas,
        idalmacen,
        idproducto: idproductoOrigen,
        cantidad: String(cantidadOrigen),
        pcosto: "0",
        pventa: "0",
        creadoPor: user.idusuario,
      })
      .returning();
    await ajustarExistencia(tx, {
      idempresa: user.idempresa,
      idalmacen,
      idproducto: idproductoOrigen,
      delta: -cantidadOrigen,
    });

    const [{ ultimo }] = await tx
      .select({ ultimo: max(ilRecepciones.noconsecutivo) })
      .from(ilRecepciones)
      .where(eq(ilRecepciones.idempresa, user.idempresa));

    const [recepcion] = await tx
      .insert(ilRecepciones)
      .values({
        idempresa: user.idempresa,
        noconsecutivo: (ultimo ?? 0) + 1,
        idalmacen,
        entregadapor: "Porcionamiento",
        nota: notaCompartida,
        creadoPor: user.idusuario,
      })
      .returning();

    for (const linea of destino) {
      await tx.insert(ilRecepcionesDetalle).values({
        idrecepcion: recepcion.idrecepcion,
        idproducto: linea.idproducto,
        pcosto: String(linea.pcosto),
        pventa: String(linea.pventa),
        cantidad: String(linea.cantidad),
      });
      await ajustarExistencia(tx, {
        idempresa: user.idempresa,
        idalmacen,
        idproducto: linea.idproducto,
        delta: linea.cantidad,
      });
    }

    return { baja, recepcion };
  });

  return json(result, 201);
};
