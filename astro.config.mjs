import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import node from "@astrojs/node";

// Salida en modo servidor (SSR) porque tenemos login, sesiones y API
// que hablan con Postgres. Sin Docker: se corre con "node ./dist/server/entry.mjs"
// detrás de lo que ya uses para servir (pm2, nginx, etc.), igual que cualquier
// app Node.js normal.
export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [react()],
});
