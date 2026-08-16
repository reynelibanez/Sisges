import type { APIRoute } from "astro";
import { json, requireUser, isResponse } from "@/lib/api";
import { calcularResumenCaja } from "@/lib/caja";

export const prerender = false;

export const GET: APIRoute = async ({ url, locals }) => {
  const user = requireUser(locals, "caja");
  if (isResponse(user)) return user;

  const idalmacen = Number(url.searchParams.get("idalmacen"));
  const fecha = url.searchParams.get("fecha");
  if (!idalmacen || !fecha) {
    return json({ error: "Faltan los parámetros idalmacen y fecha" }, 400);
  }

  const resumen = await calcularResumenCaja(user.idempresa, idalmacen, fecha);
  return json(resumen);
};
