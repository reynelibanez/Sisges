import type { APIRoute } from "astro";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/db/client";
import {
  ilRecepciones,
  ilRecepcionesDetalle,
  ilTransferencias,
  ilTransferenciasDetalle,
  bajasPor,
  ilValesSalida,
  ilValesSalidaDetalle,
  ngProductos,
  ngAlmacen,
} from "@/db/schema";
import { json, requireUser, isResponse } from "@/lib/api";

export const prerender = false;

interface Movimiento {
  fecha: string;
  tipo: "IR" | "TE" | "TS" | "BJ" | "VE";
  documento: string;
  cantidad: number; // con signo: + entra, - sale
}

// "Submayor" (antes tabla IL_Submayor, ahora calculado): ficha de kárdex de
// un producto en un almacén — cada movimiento (recepción, transferencia,
// baja, venta) con saldo corriente. En Access era una tabla que se iba
// llenando con cada operación; acá se reconstruye al vuelo a partir de los
// documentos reales, así nunca queda desincronizada.
export const GET: APIRoute = async ({ url, locals }) => {
  const user = requireUser(locals, "inventario");
  if (isResponse(user)) return user;

  const idalmacen = Number(url.searchParams.get("idalmacen"));
  const idproducto = Number(url.searchParams.get("idproducto"));
  const desde = url.searchParams.get("desde"); // YYYY-MM-DD, opcional
  const hasta = url.searchParams.get("hasta");
  if (!idalmacen || !idproducto) {
    return json({ error: "Faltan idalmacen e idproducto" }, 400);
  }

  const [almacen] = await db
    .select()
    .from(ngAlmacen)
    .where(and(eq(ngAlmacen.idalmacen, idalmacen), eq(ngAlmacen.idempresa, user.idempresa)))
    .limit(1);
  const [producto] = await db
    .select()
    .from(ngProductos)
    .where(and(eq(ngProductos.idproducto, idproducto), eq(ngProductos.idempresa, user.idempresa)))
    .limit(1);
  if (!almacen || !producto) return json({ error: "Almacén o producto no encontrado" }, 404);

  const movimientos: Movimiento[] = [];

  const recepciones = await db
    .select({ fecha: ilRecepciones.fecha, doc: ilRecepciones.noconsecutivo, cantidad: ilRecepcionesDetalle.cantidad })
    .from(ilRecepcionesDetalle)
    .innerJoin(ilRecepciones, eq(ilRecepciones.idrecepcion, ilRecepcionesDetalle.idrecepcion))
    .where(
      and(
        eq(ilRecepciones.idalmacen, idalmacen),
        eq(ilRecepcionesDetalle.idproducto, idproducto),
        eq(ilRecepciones.inventariada, true),
        eq(ilRecepciones.anulada, false)
      )
    );
  for (const r of recepciones) {
    movimientos.push({ fecha: r.fecha.toISOString(), tipo: "IR", documento: `Recepción #${r.doc}`, cantidad: Number(r.cantidad) });
  }

  const transferencias = await db
    .select({
      fecha: ilTransferencias.fecha,
      doc: ilTransferencias.noconsecutivo,
      origen: ilTransferencias.origen,
      destino: ilTransferencias.destino,
      cantidad: ilTransferenciasDetalle.cantidad,
    })
    .from(ilTransferenciasDetalle)
    .innerJoin(ilTransferencias, eq(ilTransferencias.idtransferencia, ilTransferenciasDetalle.idtransferencia))
    .where(
      and(
        eq(ilTransferenciasDetalle.idproducto, idproducto),
        or(eq(ilTransferencias.origen, idalmacen), eq(ilTransferencias.destino, idalmacen)),
        eq(ilTransferencias.inventariada, true),
        eq(ilTransferencias.anulada, false)
      )
    );
  for (const t of transferencias) {
    if (t.origen === idalmacen) {
      movimientos.push({ fecha: t.fecha.toISOString(), tipo: "TS", documento: `Transferencia #${t.doc} (salida)`, cantidad: -Number(t.cantidad) });
    }
    if (t.destino === idalmacen) {
      movimientos.push({ fecha: t.fecha.toISOString(), tipo: "TE", documento: `Transferencia #${t.doc} (entrada)`, cantidad: Number(t.cantidad) });
    }
  }

  const bajas = await db
    .select({ fecha: bajasPor.fecha, doc: bajasPor.idbajaspor, cantidad: bajasPor.cantidad })
    .from(bajasPor)
    .where(and(eq(bajasPor.idalmacen, idalmacen), eq(bajasPor.idproducto, idproducto)));
  for (const b of bajas) {
    movimientos.push({ fecha: b.fecha.toISOString(), tipo: "BJ", documento: `Baja #${b.doc}`, cantidad: -Number(b.cantidad) });
  }

  const ventas = await db
    .select({ fecha: ilValesSalida.fecha, doc: ilValesSalida.noconsecutivo, cantidad: ilValesSalidaDetalle.cantidad })
    .from(ilValesSalidaDetalle)
    .innerJoin(ilValesSalida, eq(ilValesSalida.idvalesalida, ilValesSalidaDetalle.idvalesalida))
    .where(
      and(
        eq(ilValesSalida.idalmacen, idalmacen),
        eq(ilValesSalidaDetalle.idproducto, idproducto),
        eq(ilValesSalida.inventariada, true),
        eq(ilValesSalida.anulada, false)
      )
    );
  for (const v of ventas) {
    movimientos.push({ fecha: v.fecha.toISOString(), tipo: "VE", documento: `Venta #${v.doc}`, cantidad: -Number(v.cantidad) });
  }

  movimientos.sort((a, b) => a.fecha.localeCompare(b.fecha));

  let saldo = 0;
  let saldoInicial = 0;
  const filas: (Movimiento & { saldo: number })[] = [];
  for (const m of movimientos) {
    const dentroDeRango = (!desde || m.fecha.slice(0, 10) >= desde) && (!hasta || m.fecha.slice(0, 10) <= hasta);
    if (!dentroDeRango && desde && m.fecha.slice(0, 10) < desde) {
      saldo += m.cantidad;
      saldoInicial = saldo;
      continue;
    }
    saldo += m.cantidad;
    filas.push({ ...m, saldo });
  }

  return json({
    almacen: almacen.almacen,
    producto: producto.producto,
    saldoInicial,
    movimientos: filas,
  });
};
