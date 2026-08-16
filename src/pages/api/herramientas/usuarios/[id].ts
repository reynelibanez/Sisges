import type { APIRoute } from "astro";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/db/client";
import { ngUsuarios, usuariosEmpresas } from "@/db/schema";
import { json, requireAdmin, isResponse } from "@/lib/api";

export const prerender = false;

const permisosSchema = z.object({
  inventario: z.boolean(),
  caja: z.boolean(),
  contabilidad: z.boolean(),
  personal: z.boolean(),
  finanzas: z.boolean(),
  facturas: z.boolean(),
  herramientas: z.boolean(),
  reportes: z.boolean(),
  crearCajero: z.boolean(),
  esAdminEmpresa: z.boolean(),
});

const editarSchema = z.object({
  activo: z.boolean().optional(),
  password: z.string().min(3).optional(),
  permisos: permisosSchema.partial().optional(),
});

export const PUT: APIRoute = async ({ request, params, locals }) => {
  const user = requireAdmin(locals);
  if (isResponse(user)) return user;
  const idusuario = Number(params.id);

  const [pertenece] = await db
    .select()
    .from(usuariosEmpresas)
    .where(and(eq(usuariosEmpresas.idusuario, idusuario), eq(usuariosEmpresas.idempresa, user.idempresa)))
    .limit(1);
  if (!pertenece) return json({ error: "No encontrado" }, 404);

  const parsed = editarSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);

  await db.transaction(async (tx) => {
    const cambiosUsuario: Record<string, unknown> = {};
    if (parsed.data.activo !== undefined) cambiosUsuario.activo = parsed.data.activo;
    if (parsed.data.password) cambiosUsuario.passwordHash = await bcrypt.hash(parsed.data.password, 10);
    if (Object.keys(cambiosUsuario).length > 0) {
      await tx.update(ngUsuarios).set(cambiosUsuario).where(eq(ngUsuarios.idusuario, idusuario));
    }

    if (parsed.data.permisos && Object.keys(parsed.data.permisos).length > 0) {
      await tx
        .update(usuariosEmpresas)
        .set(parsed.data.permisos)
        .where(and(eq(usuariosEmpresas.idusuario, idusuario), eq(usuariosEmpresas.idempresa, user.idempresa)));
    }
  });

  return json({ ok: true });
};
