import type { APIRoute } from "astro";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { empresas, usuariosEmpresas } from "@/db/schema";
import { SESSION_COOKIE_NAME, signSession, verifySession, type PreSessionPayload } from "@/lib/auth";

export const prerender = false;

// Segundo paso del login: el usuario ya se autenticó (tiene una sesión
// parcial en la cookie) y ahora elige con qué empresa quiere trabajar.
export const POST: APIRoute = async ({ request, cookies }) => {
  const pre = await verifySession<PreSessionPayload>(cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!pre || pre.step !== "elegir-empresa") {
    return json({ error: "Sesión inválida, vuelve a iniciar sesión" }, 401);
  }

  const body = await request.json().catch(() => null);
  const idempresa = Number(body?.idempresa);
  if (!idempresa) return json({ error: "Falta idempresa" }, 400);

  const [membresia] = await db
    .select({
      idempresa: usuariosEmpresas.idempresa,
      nombre: empresas.nombre,
      inventario: usuariosEmpresas.inventario,
      caja: usuariosEmpresas.caja,
      contabilidad: usuariosEmpresas.contabilidad,
      personal: usuariosEmpresas.personal,
      finanzas: usuariosEmpresas.finanzas,
      facturas: usuariosEmpresas.facturas,
      herramientas: usuariosEmpresas.herramientas,
      reportes: usuariosEmpresas.reportes,
      crearCajero: usuariosEmpresas.crearCajero,
      esAdminEmpresa: usuariosEmpresas.esAdminEmpresa,
    })
    .from(usuariosEmpresas)
    .innerJoin(empresas, eq(empresas.idempresa, usuariosEmpresas.idempresa))
    .where(and(eq(usuariosEmpresas.idusuario, pre.idusuario), eq(usuariosEmpresas.idempresa, idempresa)))
    .limit(1);

  if (!membresia) {
    return json({ error: "No tienes acceso a esa empresa" }, 403);
  }

  const token = await signSession({
    idusuario: pre.idusuario,
    usuario: pre.usuario,
    nombreCompleto: pre.nombreCompleto,
    idempresa: membresia.idempresa,
    empresaNombre: membresia.nombre,
    administrador: pre.administrador,
    permisos: {
      inventario: membresia.inventario,
      caja: membresia.caja,
      contabilidad: membresia.contabilidad,
      personal: membresia.personal,
      finanzas: membresia.finanzas,
      facturas: membresia.facturas,
      herramientas: membresia.herramientas,
      reportes: membresia.reportes,
      crearCajero: membresia.crearCajero,
      esAdminEmpresa: membresia.esAdminEmpresa,
    },
  });

  cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: import.meta.env.PROD,
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return json({ redirect: "/dashboard" });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
