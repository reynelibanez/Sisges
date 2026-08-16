import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  // drizzle-kit no carga .env solo; si lo corres directo, exporta la variable antes
  // o usa `env $(cat .env | xargs) npm run db:generate`.
  console.warn("DATABASE_URL no está definida en el entorno.");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/sisges",
  },
  verbose: true,
  strict: true,
});
