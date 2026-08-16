# SisGes Web

Versión web del sistema de escritorio (proyecto `Contabilidad`), empezando
por el módulo **Inventario**, que aquí incluye también todo lo que antes
era el tab **Caja** (Ventas), porque en el sistema original ambos ya
trabajaban sobre la misma base de datos (`inventario.dll`).

Stack: **Astro (SSR) + React + Node.js + PostgreSQL**, sin Docker — se
conecta directo a tu Postgres local instalado.

## Qué se migró y qué no (todavía)

Se tomó como referencia el esquema real de `inventario.dll` y `config.dll`
(extraído con `mdb-schema`). Se portaron las tablas de Inventario y del
antiguo Caja: productos, almacenes, áreas, unidades de medida, tipos de
producto, monedas, recepciones, transferencias, bajas, existencias y
ventas (vales de salida + pagos multi-moneda).

Quedan **fuera de este primer alcance** (se pueden agregar después
siguiendo el mismo patrón de `src/db/schema.ts`): `il_combo`,
`il_ventavale`, `il_ajustes`/`il_ajustesdetalles`, `il_extracciones`,
`tipocomprobante`, `il_submayor`. Y por supuesto los demás módulos del
sistema de escritorio (Contabilidad, Personal, Finanzas, Facturación)
todavía no están construidos — el menú superior ya los deja preparados
como pestañas deshabilitadas para ir sumándolos módulo por módulo.

## Multi-empresa

A diferencia del sistema de escritorio, cada tabla lleva `idempresa`. Un
mismo usuario puede pertenecer a varias empresas (tabla `usuarios_empresas`,
con los mismos permisos por módulo que antes vivían en `ng_usuarios`) y
elige con cuál trabajar al iniciar sesión — igual que el "Escoger punto de
venta" del sistema de escritorio, pero un nivel más arriba.

## Requisitos

- Node.js 20+
- PostgreSQL corriendo localmente (ya lo tienes instalado)

## Puesta en marcha

```bash
npm install

# 1. Crea la base de datos en tu Postgres local
createdb sisges

# 2. Copia el archivo de entorno y ajusta la conexión / secreto
cp .env.example .env
# edita DATABASE_URL con tu usuario/clave de Postgres, y cambia JWT_SECRET

# 3. Genera y aplica las migraciones (crea todas las tablas)
npm run db:generate
npm run db:migrate

# 4. Carga datos de prueba (empresa demo + usuario admin/admin123)
npm run db:seed

# 5. Arranca en desarrollo
npm run dev
```

Entra con **usuario: `admin`**, **contraseña: `admin123`**.

## Producción (sin Docker)

```bash
npm run build
node ./dist/server/entry.mjs
```

Por defecto Astro con el adapter `node` en modo `standalone` levanta un
servidor HTTP normal (puerto configurable con la variable `PORT`). Detrás
puedes ponerle nginx, pm2, systemd, lo que ya uses — es una app Node.js
como cualquier otra.

## Estructura

```
src/
  db/
    schema.ts     -> Todo el esquema Postgres (Drizzle)
    client.ts     -> Conexión (pool de Postgres)
    seed.ts        -> Datos de prueba
  lib/
    auth.ts         -> Firma/verifica la cookie de sesión (JWT)
    api.ts           -> Helpers para las rutas /api (requireUser, json)
    existencias.ts  -> Ajusta el saldo de stock (recepciones/ventas/etc.)
  middleware.ts     -> Protege rutas, expone Astro.locals.user
  components/
    DataGrid.tsx     -> Grid genérico con clic derecho (Nuevo/Modificar/Eliminar)
    inventario/       -> Un panel React por cada sub-módulo
  pages/
    login.astro, dashboard.astro
    api/auth/...      -> login, elegir empresa, logout
    api/inventario/... -> CRUD de cada entidad
```

## Cómo agregar un nuevo módulo (por ejemplo Contabilidad)

1. Agrega las tablas correspondientes a `src/db/schema.ts` (con su
   `idempresa`), corre `npm run db:generate` y `npm run db:migrate`.
2. Crea `src/pages/api/contabilidad/...` siguiendo el patrón de
   `src/pages/api/inventario/*.ts` (usa `requireUser(locals, "contabilidad")`).
3. Crea `src/components/contabilidad/ContabilidadModule.tsx` con sus
   sub-tabs, igual que `InventarioModule.tsx`.
4. En `src/components/DashboardApp.tsx`, marca `enabled: true` en el
   módulo correspondiente y renderízalo cuando esté activo.

## Próximos pasos sugeridos

- Migrar los datos reales desde `inventario.dll`/`config.dll` (Access) a
  Postgres — se puede usar `mdbtools` para exportar CSV y cargarlo con
  scripts que respeten el nuevo `idempresa`.
- Endpoint/reporte de cierre de caja diario (equivalente a
  `CierreInventario`/`ReporteFinalVentas` del sistema de escritorio).
- Permitir editar el detalle de una recepción/transferencia/venta ya
  creada (por ahora solo se crea y se puede anular una venta).
