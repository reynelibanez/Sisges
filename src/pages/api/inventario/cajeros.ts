import type { APIRoute } from "astro";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/db/client";
import { ngUsuarios, usuariosEmpresas } from "@/db/schema";
import { json, requireUser, isResponse } from "@/lib/api";

export const prerender = false;

const schema = z.object({
  usuario: z.string().min(1),
  password: z.string().min(3),
});

// "Crear Cajeros" (antes Cajeros.cs + CrearCajero.cs en config.dll): alta
// rápida de usuarios que solo pueden operar la Caja, sin acceso al resto de
// Inventario. Solo la ven los usuarios con el permiso CrearCajero (antes
// NG_Usuarios.CrearCajero).
export const GET: APIRoute = async ({ locals }) => {
  const user = requireUser(locals, "crearCajero");
  if (isResponse(user)) return user;

  const rows = await db
    .select({
      idusuario: ngUsuarios.idusuario,
      usuario: ngUsuarios.usuario,
      activo: ngUsuarios.activo,
      creadoEn: ngUsuarios.creadoEn,
    })
    .from(usuariosEmpresas)
    .innerJoin(ngUsuarios, eq(ngUsuarios.idusuario, usuariosEmpresas.idusuario))
    .where(
      and(
        eq(usuariosEmpresas.idempresa, user.idempresa),
        eq(usuariosEmpresas.caja, true),
        eq(usuariosEmpresas.inventario, false)
      )
    )
    .orderBy(ngUsuarios.usuario);

  return json(rows);
};

export const POST: APIRoute = async ({ request, locals }) => {
  const user = requireUser(locals, "crearCajero");
  if (isResponse(user)) return user;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const nombreUsuario = parsed.data.usuario.trim().toLowerCase();

  const [existente] = await db
    .select()
    .from(ngUsuarios)
    .where(sql`lower(${ngUsuarios.usuario}) = ${nombreUsuario}`)
    .limit(1);
  if (existente) {
    return json({ error: "Ya existe un usuario con ese nombre" }, 409);
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  const row = await db.transaction(async (tx) => {
    const [nuevo] = await tx
      .insert(ngUsuarios)
      .values({
        usuario: nombreUsuario,
        passwordHash,
        nombreCompleto: parsed.data.usuario.trim(),
        administrador: false,
        activo: true,
      })
      .returning();

    // Permisos fijos, igual que CrearCajero.cs: solo Caja + Herramientas.
    await tx.insert(usuariosEmpresas).values({
      idusuario: nuevo.idusuario,
      idempresa: user.idempresa,
      inventario: false,
      caja: true,
      contabilidad: false,
      personal: false,
      finanzas: false,
      facturas: false,
      herramientas: true,
      reportes: false,
      crearCajero: false,
      esAdminEmpresa: false,
    });

    return nuevo;
  });

  return json({ idusuario: row.idusuario, usuario: row.usuario, activo: row.activo }, 201);
};
