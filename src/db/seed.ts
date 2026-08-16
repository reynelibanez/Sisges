/**
 * Datos de prueba para desarrollar el dashboard sin tener que migrar
 * todavía los datos reales de Access. Corre con: npm run db:seed
 *
 * Crea:
 *  - 1 empresa demo
 *  - 1 usuario admin (usuario: admin / password: admin123)
 *  - Unidades de medida, tipos de producto, almacenes, áreas
 *  - Un puñado de productos con existencia inicial
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import bcrypt from "bcryptjs";
import * as schema from "./schema";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Falta DATABASE_URL en el entorno (.env)");

  const pool = new pg.Pool({ connectionString });
  const db = drizzle(pool, { schema });

  console.log("Sembrando datos de prueba...");

  const [empresa] = await db
    .insert(schema.empresas)
    .values({ nombre: "Empresa Demo" })
    .returning();

  const passwordHash = await bcrypt.hash("admin123", 10);
  const [admin] = await db
    .insert(schema.ngUsuarios)
    .values({
      usuario: "admin",
      passwordHash,
      nombreCompleto: "Administrador",
      administrador: true,
    })
    .returning();

  await db.insert(schema.usuariosEmpresas).values({
    idusuario: admin.idusuario,
    idempresa: empresa.idempresa,
    inventario: true,
    caja: true,
    contabilidad: true,
    personal: true,
    finanzas: true,
    facturas: true,
    herramientas: true,
    reportes: true,
    esAdminEmpresa: true,
  });

  const [um] = await db
    .insert(schema.unidadMedida)
    .values([
      { idempresa: empresa.idempresa, um: "Unidad" },
      { idempresa: empresa.idempresa, um: "Libra" },
      { idempresa: empresa.idempresa, um: "Litro" },
    ])
    .returning();

  const [tipo] = await db
    .insert(schema.ngProductosTipos)
    .values([
      { idempresa: empresa.idempresa, tipo: "Materia Prima" },
      { idempresa: empresa.idempresa, tipo: "Terminado" },
    ])
    .returning();

  const [almacenPrincipal, puntoVenta] = await db
    .insert(schema.ngAlmacen)
    .values([
      { idempresa: empresa.idempresa, almacen: "Almacén Principal", codigo: "ALM-01", abierto: true, pventa: false },
      { idempresa: empresa.idempresa, almacen: "Caja Salón", codigo: "PV-01", abierto: true, pventa: true },
    ])
    .returning();

  await db
    .insert(schema.ngAreas)
    .values([
      { idempresa: empresa.idempresa, area: "Salón Principal", principal: true },
      { idempresa: empresa.idempresa, area: "Terraza", principal: false },
    ])
    .returning();

  await db.insert(schema.ngMonedas).values([
    { idempresa: empresa.idempresa, moneda: "CUP", tc: "1" },
    { idempresa: empresa.idempresa, moneda: "USD", tc: "120" },
  ]);

  const productos = await db
    .insert(schema.ngProductos)
    .values([
      {
        idempresa: empresa.idempresa,
        producto: "Refresco 355ml",
        referencia: "REF-355",
        pcosto: "0.80",
        pventa: "1.50",
        um: um.id,
        idtipo: tipo.idtipo,
      },
      {
        idempresa: empresa.idempresa,
        producto: "Agua 500ml",
        referencia: "AGU-500",
        pcosto: "0.30",
        pventa: "0.80",
        um: um.id,
        idtipo: tipo.idtipo,
      },
      {
        idempresa: empresa.idempresa,
        producto: "Café",
        referencia: "CAF-01",
        pcosto: "1.00",
        pventa: "2.50",
        um: um.id,
        idtipo: tipo.idtipo,
      },
    ])
    .returning();

  for (const producto of productos) {
    await db.insert(schema.ilExistencias).values([
      {
        idempresa: empresa.idempresa,
        idalmacen: almacenPrincipal.idalmacen,
        idproducto: producto.idproducto,
        saldo: "100",
      },
      {
        idempresa: empresa.idempresa,
        idalmacen: puntoVenta.idalmacen,
        idproducto: producto.idproducto,
        saldo: "20",
      },
    ]);
  }

  await db.insert(schema.ngBajas).values([
    { idempresa: empresa.idempresa, bajas: "Rotura" },
    { idempresa: empresa.idempresa, bajas: "Vencimiento" },
  ]);

  console.log("Listo. Usuario: admin / Password: admin123");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
