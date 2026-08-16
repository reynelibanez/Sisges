/**
 * Migra los datos reales de inventario.dll (Access) hacia Postgres.
 *
 * BORRA los datos actuales de Inventario/Caja (productos, almacenes,
 * áreas, existencias, recepciones, transferencias, bajas, ventas, pagos,
 * unidades de medida, tipos de producto y monedas) y los reemplaza por los
 * datos reales exportados de inventario.dll con mdbtools (CSVs en
 * ./migration-data). NO borra empresas ni usuarios existentes — solo
 * agrega el usuario real encontrado en NG_usuarios si no existe todavía.
 *
 * Todo corre dentro de una sola transacción: si algo falla a mitad de
 * camino, Postgres revierte todo y la base queda como estaba antes.
 *
 * Uso:
 *   npm run db:migrate-inventario
 *
 * Requiere que las migraciones de esquema ya estén aplicadas
 * (npm run db:migrate) y que exista al menos una empresa (npm run db:seed
 * la crea si hace falta).
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql, count } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import bcrypt from "bcryptjs";
import pg from "pg";
import * as schema from "./schema";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "migration-data");

/* ------------------------------------------------------------------ */
/* Parser CSV mínimo (RFC4180: comillas dobles, "" como escape)        */
/* ------------------------------------------------------------------ */
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
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const header = rows[0];
  return rows
    .slice(1)
    .filter((r) => r.length > 1 || r[0] !== "")
    .map((r) => Object.fromEntries(header.map((h, idx) => [h, r[idx] ?? ""])));
}

function loadCsv(file: string): Record<string, string>[] {
  return parseCsv(readFileSync(path.join(DATA_DIR, file), "utf-8"));
}

/** "MM/DD/YY HH:MM:SS" (Access, año de 2 dígitos) -> Date */
function parseFechaAccess(v: string): Date {
  const [fecha, hora] = v.trim().split(" ");
  const [mm, dd, yy] = fecha.split("/").map(Number);
  const anio = 2000 + yy;
  let hh = 0,
    mi = 0,
    ss = 0;
  if (hora) [hh, mi, ss] = hora.split(":").map(Number);
  return new Date(Date.UTC(anio, mm - 1, dd, hh, mi, ss || 0));
}

const num = (v: string | undefined, def = 0) => {
  if (v === undefined || v === "") return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};
const int = (v: string | undefined, def = 0) => Math.trunc(num(v, def));
const bool = (v: string | undefined) => v === "1" || v?.toLowerCase() === "true";
const str = (v: string | undefined) => (v && v.trim() !== "" ? v : null);

type Tx = NodePgDatabase<typeof schema>;

async function setSerial(tx: Tx, table: string, column: string) {
  await tx.execute(
    sql.raw(
      `SELECT setval(pg_get_serial_sequence('${table}', '${column}'), COALESCE((SELECT MAX(${column}) FROM ${table}), 1))`
    )
  );
}

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
  console.log(`Migrando datos reales de inventario.dll hacia la empresa #${idempresa} (${empresa.nombre})...`);

  // ---- Cargar CSVs ----
  const almacenes = loadCsv("NG_Almacen.csv");
  const areas = loadCsv("NG_Areas.csv");
  const unidades = loadCsv("UnidadMedida.csv");
  const productos = loadCsv("NG_Productos.csv");
  const productosAsociados = loadCsv("NG_ProductosAsociados.csv");
  const motivosBaja = loadCsv("NG_Bajas.csv");
  const existencias = loadCsv("IL_Existencias.csv");
  const recepciones = loadCsv("IL_Recepciones.csv");
  const recepcionesDetalle = loadCsv("IL_Recepciones_Detalle.csv");
  const bajasPorRows = loadCsv("BajasPor.csv");
  const valesSalida = loadCsv("IL_ValesSalida.csv");
  const valesSalidaDetalle = loadCsv("IL_ValesSalida_Detalle.csv");
  const valesMonedas = loadCsv("IL_ValesMonedas.csv");
  const usuariosLegacy = loadCsv("NG_usuarios.csv");

  // Productos "fantasma": referenciados en ventas/recepciones/bajas/existencias
  // pero ya no existen en NG_Productos (fueron borrados en Access en su
  // momento). Se crean como productos inactivos para no perder el histórico.
  const idsProductosValidos = new Set(productos.map((p) => int(p.idproducto)));
  const idsProductosUsados = new Set<number>();
  for (const r of valesSalidaDetalle) if (r.IdProducto) idsProductosUsados.add(int(r.IdProducto));
  for (const r of recepcionesDetalle) if (r.IdProducto) idsProductosUsados.add(int(r.IdProducto));
  for (const r of bajasPorRows) if (r.idproducto) idsProductosUsados.add(int(r.idproducto));
  for (const r of existencias) if (r.IdProducto) idsProductosUsados.add(int(r.IdProducto));
  const idsProductosFantasma = [...idsProductosUsados].filter(
    (id) => id > 0 && !idsProductosValidos.has(id)
  );

  // Usuario real de Access. Se usa como "creado por" de ventas y recepciones
  // migradas.
  const usuarioLegacy = usuariosLegacy[0];
  const nombreLegacy = usuarioLegacy?.NombreCompleto || usuarioLegacy?.Nombre || null;

  await db.transaction(async (tx) => {
    // ---- 1. Borrar datos actuales de Inventario/Caja (hijos primero) ----
    console.log("Borrando datos actuales de Inventario/Caja...");
    await tx.delete(schema.ilValesMonedas);
    await tx.delete(schema.ilVentaDia);
    await tx.delete(schema.ngFechaCierre);
    await tx.delete(schema.ilExtracciones);
    await tx.delete(schema.ilValesSalidaDetalle);
    await tx.delete(schema.ilValesSalida);
    await tx.delete(schema.ilRecepcionesDetalle);
    await tx.delete(schema.ilRecepciones);
    await tx.delete(schema.ilTransferenciasDetalle);
    await tx.delete(schema.ilTransferencias);
    await tx.delete(schema.bajasPor);
    await tx.delete(schema.ilExistencias);
    await tx.delete(schema.ngProductosAsociados);
    await tx.delete(schema.ngProductos);
    await tx.delete(schema.ngAreas);
    await tx.delete(schema.ngAlmacen);
    await tx.delete(schema.unidadMedida);
    await tx.delete(schema.ngProductosTipos);
    await tx.delete(schema.ngBajas);
    await tx.delete(schema.ngMonedas);

    // ---- 2. Usuario real de Access ----
    let idusuarioLegacy: number | null = null;
    if (usuarioLegacy) {
      const nombreUsuario = (usuarioLegacy.Nombre || "usuario_migrado").toLowerCase().trim();
      const existente = await tx
        .select()
        .from(schema.ngUsuarios)
        .where(sql`lower(${schema.ngUsuarios.usuario}) = ${nombreUsuario}`)
        .limit(1);
      if (existente.length > 0) {
        idusuarioLegacy = existente[0].idusuario;
      } else {
        const passwordHash = await bcrypt.hash(usuarioLegacy.password || "123", 10);
        const [nuevo] = await tx
          .insert(schema.ngUsuarios)
          .values({
            usuario: nombreUsuario,
            passwordHash,
            nombreCompleto: usuarioLegacy.NombreCompleto || usuarioLegacy.Nombre || "Usuario migrado",
          })
          .returning();
        idusuarioLegacy = nuevo.idusuario;
        console.log(
          `Usuario real migrado: "${nombreUsuario}" (contraseña original de Access: "${usuarioLegacy.password}")`
        );
      }
      const yaTienePermiso = await tx
        .select()
        .from(schema.usuariosEmpresas)
        .where(
          sql`${schema.usuariosEmpresas.idusuario} = ${idusuarioLegacy} AND ${schema.usuariosEmpresas.idempresa} = ${idempresa}`
        )
        .limit(1);
      if (yaTienePermiso.length === 0) {
        await tx.insert(schema.usuariosEmpresas).values({
          idusuario: idusuarioLegacy,
          idempresa,
          inventario: true,
          caja: true,
        });
      }
    }

    // ---- 3. Unidades de medida ----
    const unidadesValidas = unidades.filter((u) => str(u.UM));
    if (unidadesValidas.length) {
      await tx.insert(schema.unidadMedida).values(unidadesValidas.map((u) => ({ id: int(u.id), idempresa, um: u.UM })));
      await setSerial(tx, "unidadmedida", "id");
    }

    // ---- 4. Monedas (el catálogo original está vacío; se crea CUP por
    // defecto para que Caja pueda seguir cobrando en efectivo). ----
    await tx.insert(schema.ngMonedas).values({ idmoneda: 1, idempresa, moneda: "CUP", tc: "1" });
    await setSerial(tx, "ng_monedas", "idmoneda");

    // ---- 5. Motivos de baja ----
    if (motivosBaja.length) {
      await tx
        .insert(schema.ngBajas)
        .values(motivosBaja.map((b) => ({ idbajas: int(b.idbajas), idempresa, bajas: b.Bajas })));
      await setSerial(tx, "ng_bajas", "idbajas");
    }

    // ---- 6. Almacenes ----
    await tx.insert(schema.ngAlmacen).values(
      almacenes.map((a) => ({
        idalmacen: int(a.idalmacen),
        idempresa,
        almacen: a.almacen,
        codigo: str(a.codigo),
        abierto: bool(a.Abierto),
        pventa: bool(a.PVenta),
      }))
    );
    await setSerial(tx, "ng_almacen", "idalmacen");

    // ---- 7. Áreas ----
    await tx
      .insert(schema.ngAreas)
      .values(areas.map((a) => ({ idarea: int(a.idarea), idempresa, area: a.area, principal: bool(a.Principal) })));
    await setSerial(tx, "ng_areas", "idarea");

    // ---- 8. Productos (reales + fantasma) ----
    const productosValues = productos.map((p) => ({
      idproducto: int(p.idproducto),
      idempresa,
      producto: p.Producto || `Producto #${p.idproducto}`,
      referencia: str(p.Referencia),
      pcosto: String(num(p.Pcosto)),
      pventa: String(num(p.Pventa)),
      um: p.UM ? int(p.UM) : null,
      rutaimagen: null as string | null, // "openFileDialog1" del original no era una ruta real
      elaborado: bool(p.Elaborado),
      activo: true,
    }));
    for (const idFantasma of idsProductosFantasma) {
      productosValues.push({
        idproducto: idFantasma,
        idempresa,
        producto: `[Eliminado] Producto #${idFantasma}`,
        referencia: null,
        pcosto: "0",
        pventa: "0",
        um: null,
        rutaimagen: null,
        elaborado: false,
        activo: false,
      });
    }
    for (let i = 0; i < productosValues.length; i += 500) {
      await tx.insert(schema.ngProductos).values(productosValues.slice(i, i + 500));
    }
    await setSerial(tx, "ng_productos", "idproducto");
    console.log(
      `Productos: ${productos.length} reales + ${idsProductosFantasma.length} "fantasma" (referenciados en histórico pero ya borrados en Access).`
    );

    // ---- 9. Productos asociados ----
    if (productosAsociados.length) {
      await tx.insert(schema.ngProductosAsociados).values(
        productosAsociados.map((p) => ({
          idproducto: int(p.idproducto),
          idproductoasociado: int(p.idproductoasociado),
          cantidad: String(num(p.cantidad, 1)),
        }))
      );
    }

    // ---- 10. Existencias ----
    if (existencias.length) {
      await tx.insert(schema.ilExistencias).values(
        existencias.map((e) => ({
          idempresa,
          idalmacen: int(e.idalmacen),
          idproducto: int(e.IdProducto),
          saldo: String(num(e.Saldo)),
        }))
      );
    }

    // ---- 11. Recepciones + detalle ----
    if (recepciones.length) {
      for (let i = 0; i < recepciones.length; i += 500) {
        await tx.insert(schema.ilRecepciones).values(
          recepciones.slice(i, i + 500).map((r) => ({
            idrecepcion: int(r.IdRecepcion),
            idempresa,
            noconsecutivo: int(r.NoConsecutivo),
            idalmacen: int(r.IdAlmacen),
            fecha: parseFechaAccess(r.Fecha),
            entregadapor: nombreLegacy,
            inventariada: bool(r.Inventariada),
            nota: str(r.Nota),
            creadoPor: idusuarioLegacy,
          }))
        );
      }
      await setSerial(tx, "il_recepciones", "idrecepcion");
    }
    if (recepcionesDetalle.length) {
      for (let i = 0; i < recepcionesDetalle.length; i += 1000) {
        await tx.insert(schema.ilRecepcionesDetalle).values(
          recepcionesDetalle.slice(i, i + 1000).map((d) => ({
            idrecepcion: int(d.IdRecepcion),
            idproducto: int(d.IdProducto),
            pcosto: String(num(d.Pcosto)),
            pventa: String(num(d.Pventa)),
            cantidad: String(num(d.Cantidad)),
          }))
        );
      }
    }

    // ---- 12. Bajas registradas (BajasPor) ----
    if (bajasPorRows.length) {
      for (let i = 0; i < bajasPorRows.length; i += 1000) {
        await tx.insert(schema.bajasPor).values(
          bajasPorRows.slice(i, i + 1000).map((b) => ({
            idbajas: int(b.idbajas),
            idalmacen: int(b.IdAlmacen),
            fecha: parseFechaAccess(b.Fecha),
            idproducto: int(b.idproducto),
            cantidad: String(num(b.Cantidad)),
            pcosto: String(num(b.Pcosto)),
            pventa: String(num(b.Pventa)),
            creadoPor: null,
          }))
        );
      }
    }

    // ---- 13. Ventas (vales de salida) + detalle + pagos ----
    if (valesSalida.length) {
      for (let i = 0; i < valesSalida.length; i += 500) {
        await tx.insert(schema.ilValesSalida).values(
          valesSalida.slice(i, i + 500).map((v) => ({
            idvalesalida: int(v.IdValeSalida),
            idempresa,
            noconsecutivo: int(v.NoConsecutivo),
            fecha: parseFechaAccess(v.Fecha),
            idalmacen: int(v.Destino),
            inventariada: bool(v.Inventariada),
            anulada: false,
            nota: str(v.Nota),
            creadoPor: idusuarioLegacy,
          }))
        );
      }
      await setSerial(tx, "il_valessalida", "idvalesalida");
      console.log(`Ventas migradas: ${valesSalida.length}`);
    }
    if (valesSalidaDetalle.length) {
      for (let i = 0; i < valesSalidaDetalle.length; i += 1000) {
        await tx.insert(schema.ilValesSalidaDetalle).values(
          valesSalidaDetalle.slice(i, i + 1000).map((d) => ({
            idvalesalida: int(d.IdValeSalida),
            idproducto: int(d.IdProducto),
            idarea: d.idvalearea ? int(d.idvalearea) : null,
            preciocosto: String(num(d.PrecioCosto)),
            pventa: String(num(d.Pventa)),
            cantidad: String(num(d.Cantidad, 1) || 1),
          }))
        );
      }
      console.log(`Líneas de venta migradas: ${valesSalidaDetalle.length}`);
    }
    if (valesMonedas.length) {
      await tx.insert(schema.ilValesMonedas).values(
        valesMonedas.map((p) => ({
          idvalesalida: int(p.IdValeSalida),
          idmoneda: int(p.idmonedas) || 1,
          tc: String(num(p.TC, 1) || 1),
          importe: String(num(p.Importe)),
        }))
      );
    }
  });

  console.log("Migración completada y confirmada.");

  // ---- Resumen ----
  async function contar(table: any) {
    const [{ value }] = await db.select({ value: count() }).from(table);
    return value;
  }
  const counts = await Promise.all([
    contar(schema.ngAlmacen),
    contar(schema.ngAreas),
    contar(schema.ngProductos),
    contar(schema.ilExistencias),
    contar(schema.ilRecepciones),
    contar(schema.bajasPor),
    contar(schema.ilValesSalida),
    contar(schema.ilValesSalidaDetalle),
  ]);
  console.log("\nResumen final:");
  console.log(`  Almacenes: ${counts[0]}`);
  console.log(`  Áreas: ${counts[1]}`);
  console.log(`  Productos (incl. fantasma): ${counts[2]}`);
  console.log(`  Filas de existencias: ${counts[3]}`);
  console.log(`  Recepciones: ${counts[4]}`);
  console.log(`  Bajas registradas: ${counts[5]}`);
  console.log(`  Ventas: ${counts[6]}`);
  console.log(`  Líneas de venta: ${counts[7]}`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
