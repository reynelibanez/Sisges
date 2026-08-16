import type { SessionPayload } from "./auth";

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** El middleware ya bloquea rutas /api/* sin sesión, esto es solo para
 * tener el tipo no-nulo a mano y chequear el permiso de módulo puntual. */
export function requireUser(
  locals: App.Locals,
  modulo?: keyof SessionPayload["permisos"]
): SessionPayload | Response {
  const user = locals.user;
  if (!user) return json({ error: "No autorizado" }, 401);
  if (modulo && !user.permisos[modulo] && !user.administrador) {
    return json({ error: `No tienes permiso de ${modulo}` }, 403);
  }
  return user;
}

export function isResponse(x: unknown): x is Response {
  return x instanceof Response;
}

/** Como requireUser, pero acepta que el usuario tenga CUALQUIERA de varios
 * permisos — por ejemplo, listados de apoyo (almacenes, áreas, productos,
 * monedas, existencias) que tanto Caja como Inventario necesitan leer para
 * poder vender/gestionar, aunque el usuario solo tenga uno de los dos. */
export function requireAny(
  locals: App.Locals,
  modulos: (keyof SessionPayload["permisos"])[]
): SessionPayload | Response {
  const user = locals.user;
  if (!user) return json({ error: "No autorizado" }, 401);
  if (!user.administrador && !modulos.some((m) => user.permisos[m])) {
    return json({ error: `No tienes permiso de ${modulos.join(" o ")}` }, 403);
  }
  return user;
}

/** Como requireUser, pero además exige que sea administrador (global o de
 * la empresa) — para pantallas sensibles como "Administrar Usuarios". */
export function requireAdmin(locals: App.Locals): SessionPayload | Response {
  const user = requireUser(locals);
  if (isResponse(user)) return user;
  if (!user.administrador && !user.permisos.esAdminEmpresa) {
    return json({ error: "Solo un administrador puede hacer esto" }, 403);
  }
  return user;
}
