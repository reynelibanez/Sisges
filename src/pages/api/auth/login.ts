import type { APIRoute } from "astro";
import bcrypt from "bcryptjs";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { ngUsuarios, usuariosEmpresas, empresas } from "@/db/schema";
import { SESSION_COOKIE_NAME, signSession } from "@/lib/auth";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  const body = await request.json().catch(() => null);
  const usuario = body?.usuario?.toString().trim();
  const password = body?.password?.toString();

  if (!usuario || !password) {
    return json({ error: "Usuario y contraseña son requeridos" }, 400);
  }

  // El login no distingue mayúsculas/minúsculas: en Access los usuarios se
  // veían como "Reynel", "YAEMA", "Danela", etc., pero acá se guardan en
  // minúsculas — así el usuario puede escribir su nombre tal como lo conoce.
  const [user] = await db
    .select()
    .from(ngUsuarios)
    .where(and(sql`lower(${ngUsuarios.usuario}) = lower(${usuario})`, eq(ngUsuarios.activo, true)))
    .limit(1);

  if (!user) {
    return json({ error: "Usuario y/o contraseña no válido" }, 401);
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return json({ error: "Usuario y/o contraseña no válido" }, 401);
  }

  const membresias = await db
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
    .where(and(eq(usuariosEmpresas.idusuario, user.idusuario), eq(empresas.activa, true)));

  if (membresias.length === 0) {
    return json({ error: "Este usuario no tiene ninguna empresa asignada" }, 403);
  }

  if (membresias.length === 1) {
    // Una sola empresa: entramos directo, sin paso intermedio.
    const m = membresias[0];
    const token = await signSession({
      idusuario: user.idusuario,
      usuario: user.usuario,
      nombreCompleto: user.nombreCompleto,
      idempresa: m.idempresa,
      empresaNombre: m.nombre,
      administrador: user.administrador,
      permisos: {
        inventario: m.inventario,
        caja: m.caja,
        contabilidad: m.contabilidad,
        personal: m.personal,
        finanzas: m.finanzas,
        facturas: m.facturas,
        herramientas: m.herramientas,
        reportes: m.reportes,
        crearCajero: m.crearCajero,
        esAdminEmpresa: m.esAdminEmpresa,
      },
    });
    setSessionCookie(cookies, token);
    return json({ step: "listo", redirect: "/dashboard" });
  }

  // Varias empresas: guardamos una sesión parcial y devolvemos la lista
  // para que el usuario elija (como "Escoger punto de venta" en el escritorio).
  const token = await signSession({
    idusuario: user.idusuario,
    usuario: user.usuario,
    nombreCompleto: user.nombreCompleto,
    administrador: user.administrador,
    step: "elegir-empresa",
  });
  setSessionCookie(cookies, token);

  return json({
    step: "elegir-empresa",
    empresas: membresias.map((m) => ({ idempresa: m.idempresa, nombre: m.nombre })),
  });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function setSessionCookie(cookies: import("astro").AstroCookies, token: string) {
  cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: import.meta.env.PROD,
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}
