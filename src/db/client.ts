import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const connectionString = import.meta.env.DATABASE_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "Falta DATABASE_URL. Copia .env.example a .env y ajusta la conexión a tu Postgres local."
  );
}

// Pool simple de node-postgres. Sin Docker: apunta directo a tu instancia
// local de Postgres (localhost:5432 por defecto).
export const pool = new pg.Pool({ connectionString });

export const db = drizzle(pool, { schema });
