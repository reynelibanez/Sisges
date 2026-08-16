/**
 * Aplica las migraciones generadas por drizzle-kit (carpeta ./drizzle).
 * Uso:
 *   npm run db:generate   -> genera el SQL de migración a partir del schema
 *   npm run db:migrate    -> lo aplica contra DATABASE_URL
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Falta DATABASE_URL en el entorno (.env)");

  const pool = new pg.Pool({ connectionString });
  const db = drizzle(pool);

  console.log("Aplicando migraciones...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Listo.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
