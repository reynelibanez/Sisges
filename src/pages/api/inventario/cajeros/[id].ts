import type { APIRoute } from "astro";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/db/client";
import { ngUsuarios, usuariosEmpresas } from "@/db/schema";
import { json, requireUser, isResponse } from "@/lib/api";

export const prerender = false;

const schema = z.object({
  password: z.string().min(3).optional(),
  activo: z.boolean().optional(),
});

async function esCajeroDeMiEmpresa(idusuario: number, idempresa: number) {
  const [row] = await db
    .select()
    .from(usuariosEmpresas)
    .where(
      and(
        eq(usuariosEmpresas.idusuario, idusuario),
        eq(usuariosEmpresas.idempresa, idempresa),
        eq(usuariosEmpresas.caja, true),
        eq(usuariosEmpresas.inventario, false)
      )
    )
    .limit(1);
  return !!row;
}

export const PUT: APIRoute = async ({ request, params, locals }) => {
  const user = requireUser(locals, "crearCajero");
  if (isResponse(user)) return user;
  const idusuario = Number(params.id);
  if (!(await esCajeroDeMiEmpresa(idusuario, user.idempresa))) {
    return json({ error: "No encontrado" }, 404);
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);

  const cambios: Record<string, unknown> = {};
  if (parsed.data.password) cambios.passwordHash = await bcrypt.hash(parsed.data.password, 10);
  if (parsed.data.activo !== undefined) cambios.activo = parsed.data.activo;

  if (Object.keys(cambios).length === 0) return json({ ok: true });

  const [row] = await db.update(ngUsuarios).set(cambios).where(eq(ngUsuarios.idusuario, idusuario)).returning();
  if (!row) return json({ error: "No encontrado" }, 404);
  return json({ idusuario: row.idusuario, usuario: row.usuario, activo: row.activo });
};

// "Eliminar" un cajero en realidad lo desactiva (no se borra el histórico de
// ventas que haya hecho), igual que el resto de bajas lógicas del sistema.
export const DELETE: APIRoute = async ({ params, locals }) => {
  const user = requireUser(locals, "crearCajero");
  if (isResponse(user)) return user;
  const idusuario = Number(params.id);
  if (!(await esCajeroDeMiEmpresa(idusuario, user.idempresa))) {
    return json({ error: "No encontrado" }, 404);
  }
  await db.update(ngUsuarios).set({ activo: false }).where(eq(ngUsuarios.idusuario, idusuario));
  return json({ ok: true });
};
