/**
 * Esquema Postgres para SisgesWEB.
 *
 * Basado en el esquema real de las bases Access del sistema de escritorio
 * (inventario.dll -> tablas ng_/il_, config.dll -> ng_usuarios). Se mantienen
 * los mismos nombres de tabla/columna en español para facilitar, más adelante,
 * migrar los datos reales desde Access sin tener que mapear nombres.
 *
 * Cambios respecto al original:
 *  - Se agrega soporte multi-empresa: casi toda tabla lleva "idempresa" y
 *    hay una tabla nueva "empresas" + un pivote "usuarios_empresas" (un
 *    usuario puede pertenecer a varias empresas y elige con cuál trabajar
 *    al iniciar sesión, igual que el "Escoger punto de venta" del sistema
 *    de escritorio).
 *  - Los permisos por módulo (contabilidad, inventario, caja, etc.) que en
 *    Access vivían en ng_usuarios, ahora viven en usuarios_empresas porque
 *    un mismo usuario puede tener permisos distintos en cada empresa.
 *  - La contraseña se guarda con hash (bcrypt), no en texto plano.
 *  - La columna "foto" (imagen binaria) del producto se reemplaza por
 *    "rutaimagen" (URL/ruta del archivo) — más natural para una app web.
 *  - Se dejan fuera de este primer alcance (Inventario + Caja) tablas del
 *    Access original que no hacían falta para este módulo: il_combo,
 *    il_ventavale, il_ajustes/il_ajustesdetalles, tipocomprobante,
 *    il_submayor, config. Se pueden agregar después siguiendo el mismo
 *    patrón.
 *  - Sí se agregaron il_extracciones, ng_fechacierre e il_ventadia, que
 *    en el original sostenían el cierre de caja diario (extracción de
 *    efectivo, marcar el día como cerrado, y la foto del stock a esa
 *    fecha).
 */

import {
  pgTable,
  serial,
  varchar,
  integer,
  boolean,
  numeric,
  timestamp,
  date,
  text,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/* ------------------------------------------------------------------ */
/* Empresas y usuarios (multi-empresa)                                 */
/* ------------------------------------------------------------------ */

export const empresas = pgTable("empresas", {
  idempresa: serial("idempresa").primaryKey(),
  nombre: varchar("nombre", { length: 255 }).notNull(),
  activa: boolean("activa").notNull().default(true),
  creadaEn: timestamp("creada_en").notNull().defaultNow(),
});

export const ngUsuarios = pgTable(
  "ng_usuarios",
  {
    idusuario: serial("idusuario").primaryKey(),
    usuario: varchar("usuario", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    nombreCompleto: varchar("nombrecompleto", { length: 255 }).notNull(),
    administrador: boolean("administrador").notNull().default(false),
    activo: boolean("activo").notNull().default(true),
    creadoEn: timestamp("creado_en").notNull().defaultNow(),
  },
  (t) => ({
    usuarioUnico: uniqueIndex("ng_usuarios_usuario_idx").on(t.usuario),
  })
);

// Pivote usuario <-> empresa con permisos por módulo, igual a los booleanos
// que tenía ng_usuarios en Access (contabilidad, inventario, caja, etc.)
// pero ahora uno por cada empresa a la que pertenece el usuario.
export const usuariosEmpresas = pgTable(
  "usuarios_empresas",
  {
    idusuario: integer("idusuario")
      .notNull()
      .references(() => ngUsuarios.idusuario, { onDelete: "cascade" }),
    idempresa: integer("idempresa")
      .notNull()
      .references(() => empresas.idempresa, { onDelete: "cascade" }),
    inventario: boolean("inventario").notNull().default(false),
    caja: boolean("caja").notNull().default(false),
    contabilidad: boolean("contabilidad").notNull().default(false),
    personal: boolean("personal").notNull().default(false),
    finanzas: boolean("finanzas").notNull().default(false),
    facturas: boolean("facturas").notNull().default(false),
    herramientas: boolean("herramientas").notNull().default(false),
    reportes: boolean("reportes").notNull().default(false),
    // Permiso para usar la pantalla "Crear Cajeros" (antes NG_usuarios.CrearCajero
    // en config.dll): quién puede dar de alta usuarios cajeros.
    crearCajero: boolean("crear_cajero").notNull().default(false),
    esAdminEmpresa: boolean("es_admin_empresa").notNull().default(false),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.idusuario, t.idempresa] }),
  })
);

/* ------------------------------------------------------------------ */
/* Catálogos de Inventario                                             */
/* ------------------------------------------------------------------ */

export const ngAlmacen = pgTable("ng_almacen", {
  idalmacen: serial("idalmacen").primaryKey(),
  idempresa: integer("idempresa")
    .notNull()
    .references(() => empresas.idempresa),
  almacen: varchar("almacen", { length: 255 }).notNull(),
  codigo: varchar("codigo", { length: 255 }),
  abierto: boolean("abierto").notNull().default(true),
  // Marca si este almacén funciona como punto de venta (lo que en el
  // sistema de escritorio se elegía en "Escoger punto de venta" para Caja).
  pventa: boolean("pventa").notNull().default(false),
});

export const ngAreas = pgTable("ng_areas", {
  idarea: serial("idarea").primaryKey(),
  idempresa: integer("idempresa")
    .notNull()
    .references(() => empresas.idempresa),
  area: varchar("area", { length: 255 }).notNull(),
  principal: boolean("principal").notNull().default(false),
});

export const unidadMedida = pgTable("unidadmedida", {
  id: serial("id").primaryKey(),
  idempresa: integer("idempresa")
    .notNull()
    .references(() => empresas.idempresa),
  um: varchar("um", { length: 255 }).notNull(),
});

export const ngProductosTipos = pgTable("ng_productostipos", {
  idtipo: serial("idtipo").primaryKey(),
  idempresa: integer("idempresa")
    .notNull()
    .references(() => empresas.idempresa),
  tipo: varchar("tipo", { length: 50 }).notNull(),
});

export const ngMonedas = pgTable("ng_monedas", {
  idmoneda: serial("idmoneda").primaryKey(),
  idempresa: integer("idempresa")
    .notNull()
    .references(() => empresas.idempresa),
  moneda: varchar("moneda", { length: 255 }).notNull(),
  tc: numeric("tc", { precision: 12, scale: 4 }).notNull().default("1"),
});

export const ngProductos = pgTable("ng_productos", {
  idproducto: serial("idproducto").primaryKey(),
  idempresa: integer("idempresa")
    .notNull()
    .references(() => empresas.idempresa),
  producto: varchar("producto", { length: 255 }).notNull(),
  referencia: varchar("referencia", { length: 255 }),
  pcosto: numeric("pcosto", { precision: 12, scale: 2 }).notNull().default("0"),
  pventa: numeric("pventa", { precision: 12, scale: 2 }).notNull().default("0"),
  um: integer("um").references(() => unidadMedida.id),
  idtipo: integer("idtipo").references(() => ngProductosTipos.idtipo),
  rutaimagen: varchar("rutaimagen", { length: 500 }),
  elaborado: boolean("elaborado").notNull().default(false),
  activo: boolean("activo").notNull().default(true),
});

export const ngProductosAsociados = pgTable("ng_productosasociados", {
  idproductosasociados: serial("idproductosasociados").primaryKey(),
  idproducto: integer("idproducto")
    .notNull()
    .references(() => ngProductos.idproducto, { onDelete: "cascade" }),
  idproductoasociado: integer("idproductoasociado")
    .notNull()
    .references(() => ngProductos.idproducto),
  cantidad: numeric("cantidad", { precision: 12, scale: 2 }).notNull(),
});

export const ngBajas = pgTable("ng_bajas", {
  idbajas: serial("idbajas").primaryKey(),
  idempresa: integer("idempresa")
    .notNull()
    .references(() => empresas.idempresa),
  bajas: varchar("bajas", { length: 255 }).notNull(), // motivo de baja
});

/* ------------------------------------------------------------------ */
/* Existencias (stock)                                                 */
/* ------------------------------------------------------------------ */

export const ilExistencias = pgTable(
  "il_existencias",
  {
    idexistencia: serial("idexistencia").primaryKey(),
    idempresa: integer("idempresa")
      .notNull()
      .references(() => empresas.idempresa),
    idalmacen: integer("idalmacen")
      .notNull()
      .references(() => ngAlmacen.idalmacen),
    idproducto: integer("idproducto")
      .notNull()
      .references(() => ngProductos.idproducto),
    saldo: numeric("saldo", { precision: 14, scale: 2 }).notNull().default("0"),
  },
  (t) => ({
    almacenProductoUnico: uniqueIndex("il_existencias_almacen_producto_idx").on(
      t.idalmacen,
      t.idproducto
    ),
  })
);

/* ------------------------------------------------------------------ */
/* Recepciones (entradas a almacén)                                    */
/* ------------------------------------------------------------------ */

export const ilRecepciones = pgTable("il_recepciones", {
  idrecepcion: serial("idrecepcion").primaryKey(),
  idempresa: integer("idempresa")
    .notNull()
    .references(() => empresas.idempresa),
  noconsecutivo: integer("noconsecutivo").notNull(),
  idalmacen: integer("idalmacen")
    .notNull()
    .references(() => ngAlmacen.idalmacen),
  fecha: timestamp("fecha").notNull().defaultNow(),
  entregadapor: varchar("entregadapor", { length: 255 }),
  inventariada: boolean("inventariada").notNull().default(false),
  anulada: boolean("anulada").notNull().default(false),
  nota: text("nota"),
  creadoPor: integer("creado_por").references(() => ngUsuarios.idusuario),
});

export const ilRecepcionesDetalle = pgTable(
  "il_recepciones_detalle",
  {
    id: serial("id").primaryKey(),
    idrecepcion: integer("idrecepcion")
      .notNull()
      .references(() => ilRecepciones.idrecepcion, { onDelete: "cascade" }),
    idproducto: integer("idproducto")
      .notNull()
      .references(() => ngProductos.idproducto),
    pcosto: numeric("pcosto", { precision: 12, scale: 2 }).notNull(),
    pventa: numeric("pventa", { precision: 12, scale: 2 }).notNull(),
    cantidad: numeric("cantidad", { precision: 12, scale: 2 }).notNull(),
  },
  (t) => ({
    idrecepcionIdx: index("il_recepciones_detalle_idrecepcion_idx").on(t.idrecepcion),
  })
);

/* ------------------------------------------------------------------ */
/* Transferencias entre almacenes                                      */
/* ------------------------------------------------------------------ */

export const ilTransferencias = pgTable("il_transferencias", {
  idtransferencia: serial("idtransferencia").primaryKey(),
  idempresa: integer("idempresa")
    .notNull()
    .references(() => empresas.idempresa),
  noconsecutivo: integer("noconsecutivo").notNull(),
  fecha: timestamp("fecha").notNull().defaultNow(),
  origen: integer("origen")
    .notNull()
    .references(() => ngAlmacen.idalmacen),
  destino: integer("destino")
    .notNull()
    .references(() => ngAlmacen.idalmacen),
  inventariada: boolean("inventariada").notNull().default(false),
  anulada: boolean("anulada").notNull().default(false),
  nota: text("nota"),
  creadoPor: integer("creado_por").references(() => ngUsuarios.idusuario),
});

export const ilTransferenciasDetalle = pgTable(
  "il_transferencias_detalle",
  {
    id: serial("id").primaryKey(),
    idtransferencia: integer("idtransferencia")
      .notNull()
      .references(() => ilTransferencias.idtransferencia, { onDelete: "cascade" }),
    idproducto: integer("idproducto")
      .notNull()
      .references(() => ngProductos.idproducto),
    preciocosto: numeric("preciocosto", { precision: 12, scale: 2 }).notNull(),
    pventa: numeric("pventa", { precision: 12, scale: 2 }).notNull(),
    cantidad: numeric("cantidad", { precision: 12, scale: 2 }).notNull(),
  },
  (t) => ({
    idtransferenciaIdx: index("il_transferencias_detalle_idtransferencia_idx").on(t.idtransferencia),
  })
);

/* ------------------------------------------------------------------ */
/* Bajas (mermas / roturas / vencimientos)                             */
/* ------------------------------------------------------------------ */

export const bajasPor = pgTable(
  "bajaspor",
  {
    idbajaspor: serial("idbajaspor").primaryKey(),
    idbajas: integer("idbajas")
      .notNull()
      .references(() => ngBajas.idbajas),
    idalmacen: integer("idalmacen")
      .notNull()
      .references(() => ngAlmacen.idalmacen),
    fecha: timestamp("fecha").notNull().defaultNow(),
    idproducto: integer("idproducto")
      .notNull()
      .references(() => ngProductos.idproducto),
    cantidad: numeric("cantidad", { precision: 12, scale: 2 }).notNull(),
    pcosto: numeric("pcosto", { precision: 12, scale: 2 }).notNull(),
    pventa: numeric("pventa", { precision: 12, scale: 2 }).notNull(),
    creadoPor: integer("creado_por").references(() => ngUsuarios.idusuario),
  },
  (t) => ({
    idalmacenIdx: index("bajaspor_idalmacen_idx").on(t.idalmacen),
    idproductoIdx: index("bajaspor_idproducto_idx").on(t.idproducto),
    fechaIdx: index("bajaspor_fecha_idx").on(t.fecha),
  })
);

/* ------------------------------------------------------------------ */
/* Ventas / Caja (antes "Vales de Salida" + módulo Caja, unificados)   */
/* ------------------------------------------------------------------ */

export const ilValesSalida = pgTable(
  "il_valessalida",
  {
    idvalesalida: serial("idvalesalida").primaryKey(),
    idempresa: integer("idempresa")
      .notNull()
      .references(() => empresas.idempresa),
    noconsecutivo: integer("noconsecutivo").notNull(),
    fecha: timestamp("fecha").notNull().defaultNow(),
    // Almacén/punto de venta desde el que se vende (antes "destino").
    idalmacen: integer("idalmacen")
      .notNull()
      .references(() => ngAlmacen.idalmacen),
    inventariada: boolean("inventariada").notNull().default(false),
    anulada: boolean("anulada").notNull().default(false),
    nota: text("nota"),
    // Campos de la lógica original de Caja.cs (CobrarVale): "Cuenta Casa"
    // vende a Pventa=0 en todas las líneas (consumo interno/invitación),
    // "Promoción" aplica un % de descuento proporcional sobre el importe,
    // "Más el 10%" es el recargo de servicio que se cobra encima del total
    // pero que NO se refleja en el Pventa de cada línea. "Vuelto" queda
    // grabado para el recibo/auditoría igual que en el original.
    cuentaCasa: boolean("cuenta_casa").notNull().default(false),
    promocion: boolean("promocion").notNull().default(false),
    promocionPorcentaje: numeric("promocion_porcentaje", { precision: 5, scale: 2 }),
    masDiezPorciento: boolean("mas_diez_porciento").notNull().default(false),
    vuelto: numeric("vuelto", { precision: 14, scale: 2 }).notNull().default("0"),
    creadoPor: integer("creado_por").references(() => ngUsuarios.idusuario),
  },
  (t) => ({
    // El listado y los reportes de Caja siempre filtran por empresa +
    // ordenan/filtran por fecha, y el cierre de caja filtra por almacén.
    idempresaFechaIdx: index("il_valessalida_idempresa_fecha_idx").on(t.idempresa, t.fecha),
    idalmacenIdx: index("il_valessalida_idalmacen_idx").on(t.idalmacen),
  })
);

export const ilValesSalidaDetalle = pgTable(
  "il_valessalida_detalle",
  {
    id: serial("id").primaryKey(),
    idvalesalida: integer("idvalesalida")
      .notNull()
      .references(() => ilValesSalida.idvalesalida, { onDelete: "cascade" }),
    idproducto: integer("idproducto")
      .notNull()
      .references(() => ngProductos.idproducto),
    // Área de consumo/venta dentro del punto de venta (salón, mesa, etc.)
    idarea: integer("idarea").references(() => ngAreas.idarea),
    preciocosto: numeric("preciocosto", { precision: 12, scale: 2 }).notNull(),
    pventa: numeric("pventa", { precision: 12, scale: 2 }).notNull(),
    cantidad: numeric("cantidad", { precision: 12, scale: 2 }).notNull(),
  },
  (t) => ({
    // Sin este índice, cargar el listado de ventas (que trae el detalle de
    // cada vale) hace un seq scan completo de esta tabla por cada venta:
    // con miles de ventas migradas eso tardaba varios segundos.
    idvalesalidaIdx: index("il_valessalida_detalle_idvalesalida_idx").on(t.idvalesalida),
    idproductoIdx: index("il_valessalida_detalle_idproducto_idx").on(t.idproducto),
  })
);

// Pagos de una venta, puede haber varias monedas en un mismo vale (efectivo
// mixto CUP/USD/etc.), igual que il_valesmonedas en el Access original.
export const ilValesMonedas = pgTable(
  "il_valesmonedas",
  {
    id: serial("id").primaryKey(),
    idvalesalida: integer("idvalesalida")
      .notNull()
      .references(() => ilValesSalida.idvalesalida, { onDelete: "cascade" }),
    idmoneda: integer("idmoneda")
      .notNull()
      .references(() => ngMonedas.idmoneda),
    tc: numeric("tc", { precision: 12, scale: 4 }).notNull().default("1"),
    importe: numeric("importe", { precision: 14, scale: 2 }).notNull(),
    // Distingue "Efectivo" de "Pago por Transferencia" (txttransferencia en
    // el original) — antes se registraba en una tabla aparte (Transfer.dll).
    esTransferencia: boolean("es_transferencia").notNull().default(false),
  },
  (t) => ({
    idvalesalidaIdx: index("il_valesmonedas_idvalesalida_idx").on(t.idvalesalida),
  })
);

/* ------------------------------------------------------------------ */
/* Cierre de caja: extracciones de efectivo, día cerrado, foto de stock */
/* ------------------------------------------------------------------ */

// Retiro de efectivo de la caja durante el día (antes ExtraccionEfectivo.cs).
export const ilExtracciones = pgTable("il_extracciones", {
  idextraccion: serial("idextraccion").primaryKey(),
  idempresa: integer("idempresa")
    .notNull()
    .references(() => empresas.idempresa),
  idalmacen: integer("idalmacen")
    .notNull()
    .references(() => ngAlmacen.idalmacen),
  fecha: date("fecha").notNull(),
  importe: numeric("importe", { precision: 14, scale: 2 }).notNull(),
  nota: text("nota"),
  creadoPor: integer("creado_por").references(() => ngUsuarios.idusuario),
  creadoEn: timestamp("creado_en").notNull().defaultNow(),
});

// Marca un día como cerrado para un punto de venta (antes CierreInventario.cs
// + tabla NG_FechaCierre). No se puede cerrar dos veces el mismo día/almacén.
export const ngFechaCierre = pgTable(
  "ng_fechacierre",
  {
    idfechacierre: serial("idfechacierre").primaryKey(),
    idempresa: integer("idempresa")
      .notNull()
      .references(() => empresas.idempresa),
    idalmacen: integer("idalmacen")
      .notNull()
      .references(() => ngAlmacen.idalmacen),
    fecha: date("fecha").notNull(),
    cerrado: boolean("cerrado").notNull().default(true),
    cerradoPor: integer("cerrado_por").references(() => ngUsuarios.idusuario),
    cerradoEn: timestamp("cerrado_en").notNull().defaultNow(),
  },
  (t) => ({
    almacenFechaUnico: uniqueIndex("ng_fechacierre_almacen_fecha_idx").on(t.idalmacen, t.fecha),
  })
);

// Foto del stock del punto de venta al momento del cierre (antes IL_VentaDia).
export const ilVentaDia = pgTable("il_ventadia", {
  idventadia: serial("idventadia").primaryKey(),
  idempresa: integer("idempresa")
    .notNull()
    .references(() => empresas.idempresa),
  idalmacen: integer("idalmacen")
    .notNull()
    .references(() => ngAlmacen.idalmacen),
  idproducto: integer("idproducto")
    .notNull()
    .references(() => ngProductos.idproducto),
  cantidad: numeric("cantidad", { precision: 14, scale: 2 }).notNull(),
  fecha: date("fecha").notNull(),
});

/* ------------------------------------------------------------------ */
/* Relations (para poder hacer db.query.tabla.findMany({ with: {...} }))*/
/* ------------------------------------------------------------------ */

export const empresasRelations = relations(empresas, ({ many }) => ({
  usuarios: many(usuariosEmpresas),
  almacenes: many(ngAlmacen),
  productos: many(ngProductos),
}));

export const ngUsuariosRelations = relations(ngUsuarios, ({ many }) => ({
  empresas: many(usuariosEmpresas),
}));

export const usuariosEmpresasRelations = relations(usuariosEmpresas, ({ one }) => ({
  usuario: one(ngUsuarios, {
    fields: [usuariosEmpresas.idusuario],
    references: [ngUsuarios.idusuario],
  }),
  empresa: one(empresas, {
    fields: [usuariosEmpresas.idempresa],
    references: [empresas.idempresa],
  }),
}));

export const ngProductosRelations = relations(ngProductos, ({ one }) => ({
  unidad: one(unidadMedida, {
    fields: [ngProductos.um],
    references: [unidadMedida.id],
  }),
  tipo: one(ngProductosTipos, {
    fields: [ngProductos.idtipo],
    references: [ngProductosTipos.idtipo],
  }),
}));

export const ilValesSalidaRelations = relations(ilValesSalida, ({ many, one }) => ({
  detalle: many(ilValesSalidaDetalle),
  pagos: many(ilValesMonedas),
  almacen: one(ngAlmacen, {
    fields: [ilValesSalida.idalmacen],
    references: [ngAlmacen.idalmacen],
  }),
}));

export const ilValesSalidaDetalleRelations = relations(ilValesSalidaDetalle, ({ one }) => ({
  vale: one(ilValesSalida, {
    fields: [ilValesSalidaDetalle.idvalesalida],
    references: [ilValesSalida.idvalesalida],
  }),
  producto: one(ngProductos, {
    fields: [ilValesSalidaDetalle.idproducto],
    references: [ngProductos.idproducto],
  }),
  area: one(ngAreas, {
    fields: [ilValesSalidaDetalle.idarea],
    references: [ngAreas.idarea],
  }),
}));

export const ilValesMonedasRelations = relations(ilValesMonedas, ({ one }) => ({
  vale: one(ilValesSalida, {
    fields: [ilValesMonedas.idvalesalida],
    references: [ilValesSalida.idvalesalida],
  }),
  moneda: one(ngMonedas, {
    fields: [ilValesMonedas.idmoneda],
    references: [ngMonedas.idmoneda],
  }),
}));

export const ilRecepcionesRelations = relations(ilRecepciones, ({ many }) => ({
  detalle: many(ilRecepcionesDetalle),
}));

export const ilRecepcionesDetalleRelations = relations(ilRecepcionesDetalle, ({ one }) => ({
  recepcion: one(ilRecepciones, {
    fields: [ilRecepcionesDetalle.idrecepcion],
    references: [ilRecepciones.idrecepcion],
  }),
  producto: one(ngProductos, {
    fields: [ilRecepcionesDetalle.idproducto],
    references: [ngProductos.idproducto],
  }),
}));

export const ilTransferenciasRelations = relations(ilTransferencias, ({ many }) => ({
  detalle: many(ilTransferenciasDetalle),
}));

export const ilTransferenciasDetalleRelations = relations(ilTransferenciasDetalle, ({ one }) => ({
  transferencia: one(ilTransferencias, {
    fields: [ilTransferenciasDetalle.idtransferencia],
    references: [ilTransferencias.idtransferencia],
  }),
  producto: one(ngProductos, {
    fields: [ilTransferenciasDetalle.idproducto],
    references: [ngProductos.idproducto],
  }),
}));
