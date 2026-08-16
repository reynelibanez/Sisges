import { defineMiddleware } from "astro:middleware";
import { SESSION_COOKIE_NAME, verifySession, type SessionPayload } from "./lib/auth";

const RUTAS_PUBLICAS = new Set(["/login", "/api/auth/login", "/api/auth/empresa"]);

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  const token = context.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySession<SessionPayload>(token);

  // Sesión completa (ya con empresa elegida) disponible en cualquier página/API.
  context.locals.user = session && "idempresa" in session ? session : null;

  const esPublica = RUTAS_PUBLICAS.has(pathname) || pathname.startsWith("/_astro");
  if (!esPublica && !context.locals.user) {
    if (pathname.startsWith("/api/")) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    return context.redirect("/login");
  }

  return next();
});
