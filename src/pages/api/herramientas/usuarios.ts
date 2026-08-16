import type { APIRoute } from "astro";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/db/client";
import { ngUsuarios, usuariosEmpresas } from "@/db/schema";
import { json, requireAdmin, isResponse } from "@/lib/api";

export const prerender = false;

const permisosSchema = z.object({
  inventario: z.boolean().default(false),
  caja: z.boolean().default(false),
  contabilidad: z.boolean().default(false),
  personal: z.boolean().default(false),
  finanzas: z.boolean().default(false),
  facturas: z.boolean().default(false),
  herramientas: z.boolean().default(false),
  reportes: z.boolean().default(false),
  crearCajero: z.boolean().default(false),
  esAdminEmpresa: z.boolean().default(false),
});

const crearSchema = z.object({
  usuario: z.string().min(1),
  password: z.string().min(3),
  permisos: permisosSchema,
});

// "Administrar Usuarios" (Herramientas): alta y edición de usuarios y sus
// permisos por módulo. Solo visible/operable para administradores.
export const GET: APIRoute = async ({ locals }) => {
  const user = requireAdmin(locals);
  if (isResponse(user)) return user;

  const rows = await db
    .select({
      idusuario: ngUsuarios.idusuario,
      usuario: ngUsuarios.usuario,
      nombreCompleto: ngUsuarios.nombreCompleto,
      administrador: ngUsuarios.administrador,
      activo: ngUsuarios.activo,
      creadoEn: ngUsuarios.creadoEn,
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
    .innerJoin(ngUsuarios, eq(ngUsuarios.idusuario, usuariosEmpresas.idusuario))
    .where(eq(usuariosEmpresas.idempresa, user.idempresa))
    .orderBy(ngUsuarios.usuario);

  return json(rows);
};

export const POST: APIRoute = async ({ request, locals }) => {
  const user = requireAdmin(locals);
  if (isResponse(user)) return user;
  const parsed = crearSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const nombreUsuario = parsed.data.usuario.trim().toLowerCase();

  const [existente] = await db
    .select()
    .from(ngUsuarios)
    .where(sql`lower(${ngUsuarios.usuario}) = ${nombreUsuario}`)
    .limit(1);
  if (existente) return json({ error: "Ya existe un usuario con ese nombre" }, 409);

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  const row = await db.transaction(async (tx) => {
    const [nuevo] = await tx
      .insert(ngUsuarios)
      .values({
        usuario: nombreUsuario,
        passwordHash,
        nombreCompleto: parsed.data.usuario.trim(),
        activo: true,
      })
      .returning();

    await tx.insert(usuariosEmpresas).values({
      idusuario: nuevo.idusuario,
      idempresa: user.idempresa,
      ...parsed.data.permisos,
    });

    return nuevo;
  });

  return json({ idusuario: row.idusuario, usuario: row.usuario }, 201);
};
