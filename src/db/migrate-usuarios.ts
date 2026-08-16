/**
 * Migra los usuarios y roles reales desde config.dll (tabla NG_Usuarios),
 * que es la fuente autoritativa de usuarios/contraseñas/permisos del
 * sistema legacy (NO inventario.dll, cuya NG_usuarios es un stub aparte
 * que usaba el ejecutable de Inventario nada más).
 *
 * Hace upsert por nombre de usuario (case-insensitive):
 *  - Si el usuario ya existe (por ejemplo "reynel" migrado antes desde
 *    inventario.dll con la contraseña equivocada "123"), se actualiza su
 *    contraseña y su flag de administrador con los datos reales.
 *  - Si no existe, se crea.
 *  - En ambos casos se hace upsert del permiso por-empresa en
 *    usuarios_empresas con los booleanos reales de config.dll (Inventario,
 *    Caja, Contabilidad, Personal, Finanzas, Facturas, Herramientas,
 *    Reportes, CrearCajero) y Administrador -> esAdminEmpresa.
 *
 * Uso:
 *   npm run db:migrate-usuarios
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import bcrypt from "bcryptjs";
import pg from "pg";
import * as schema from "./schema";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "migration-data");

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const s = text.replace(/\r\n/g, "\n");
  while (i < s.length) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...data] = rows;
  return data
    .filter((r) => r.length === header.length && r.some((v) => v !== ""))
    .map((r) => Object.fromEntries(header.map((h, idx) => [h, r[idx]])));
}

function loadCsv(file: string): Record<string, string>[] {
  return parseCsv(readFileSync(path.join(DATA_DIR, file), "utf-8"));
}

const bool = (v: string | undefined) => v === "1" || v?.toLowerCase() === "true";

type Tx = NodePgDatabase<typeof schema>;

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Falta DATABASE_URL en el entorno (.env)");

  const pool = new pg.Pool({ connectionString });
  const db = drizzle(pool, { schema });

  const [empresa] = await db.select().from(schema.empresas).orderBy(schema.empresas.idempresa).limit(1);
  if (!empresa) {
    throw new Error("No hay ninguna empresa en la base de datos. Corre 'npm run db:seed' primero.");
  }
  const idempresa = empresa.idempresa;

  const usuarios = loadCsv("config_NG_Usuarios.csv");
  console.log(
    `Migrando ${usuarios.length} usuarios reales de config.dll hacia la empresa #${idempresa} (${empresa.nombre})...`
  );

  await db.transaction(async (tx: Tx) => {
    for (const u of usuarios) {
      const nombreUsuario = (u.Usuario || "").trim();
      if (!nombreUsuario) continue;
      const nombreLower = nombreUsuario.toLowerCase();
      const esAdmin = bool(u.Administrador);
      const activo = bool(u.Activo);
      const passwordPlano = u.Pass || "123";
      const passwordHash = await bcrypt.hash(passwordPlano, 10);

      const existente = await tx
        .select()
        .from(schema.ngUsuarios)
        .where(sql`lower(${schema.ngUsuarios.usuario}) = ${nombreLower}`)
        .limit(1);

      let idusuario: number;
      if (existente.length > 0) {
        idusuario = existente[0].idusuario;
        await tx
          .update(schema.ngUsuarios)
          .set({
            passwordHash,
            administrador: esAdmin,
            activo,
          })
          .where(sql`${schema.ngUsuarios.idusuario} = ${idusuario}`);
        console.log(`  Usuario actualizado: "${nombreUsuario}" (contraseña real: "${passwordPlano}")`);
      } else {
        const [nuevo] = await tx
          .insert(schema.ngUsuarios)
          .values({
            usuario: nombreLower,
            passwordHash,
            nombreCompleto: nombreUsuario,
            administrador: esAdmin,
            activo,
          })
          .returning();
        idusuario = nuevo.idusuario;
        console.log(`  Usuario creado: "${nombreUsuario}" (contraseña real: "${passwordPlano}")`);
      }

      const permisos = {
        inventario: bool(u.Inventario),
        caja: bool(u.Caja),
        contabilidad: bool(u.Contabilidad),
        personal: bool(u.Personal),
        finanzas: bool(u.Finanzas),
        facturas: bool(u.Facturas),
        herramientas: bool(u.Herramientas),
        reportes: bool(u.Reportes),
        crearCajero: bool(u.CrearCajero),
        esAdminEmpresa: esAdmin,
      };

      const yaTienePermiso = await tx
        .select()
        .from(schema.usuariosEmpresas)
        .where(
          sql`${schema.usuariosEmpresas.idusuario} = ${idusuario} AND ${schema.usuariosEmpresas.idempresa} = ${idempresa}`
        )
        .limit(1);

      if (yaTienePermiso.length > 0) {
        await tx
          .update(schema.usuariosEmpresas)
          .set(permisos)
          .where(
            sql`${schema.usuariosEmpresas.idusuario} = ${idusuario} AND ${schema.usuariosEmpresas.idempresa} = ${idempresa}`
          );
      } else {
        await tx.insert(schema.usuariosEmpresas).values({
          idusuario,
          idempresa,
          ...permisos,
        });
      }
    }
  });

  console.log("Listo. Usuarios y roles reales migrados desde config.dll.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
