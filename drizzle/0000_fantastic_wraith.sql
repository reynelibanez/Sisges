CREATE TABLE IF NOT EXISTS "bajaspor" (
	"idbajaspor" serial PRIMARY KEY NOT NULL,
	"idbajas" integer NOT NULL,
	"idalmacen" integer NOT NULL,
	"fecha" timestamp DEFAULT now() NOT NULL,
	"idproducto" integer NOT NULL,
	"cantidad" numeric(12, 2) NOT NULL,
	"pcosto" numeric(12, 2) NOT NULL,
	"pventa" numeric(12, 2) NOT NULL,
	"creado_por" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "empresas" (
	"idempresa" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(255) NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"creada_en" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "il_existencias" (
	"idexistencia" serial PRIMARY KEY NOT NULL,
	"idempresa" integer NOT NULL,
	"idalmacen" integer NOT NULL,
	"idproducto" integer NOT NULL,
	"saldo" numeric(14, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "il_recepciones" (
	"idrecepcion" serial PRIMARY KEY NOT NULL,
	"idempresa" integer NOT NULL,
	"noconsecutivo" integer NOT NULL,
	"idalmacen" integer NOT NULL,
	"fecha" timestamp DEFAULT now() NOT NULL,
	"entregadapor" varchar(255),
	"inventariada" boolean DEFAULT false NOT NULL,
	"nota" text,
	"creado_por" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "il_recepciones_detalle" (
	"id" serial PRIMARY KEY NOT NULL,
	"idrecepcion" integer NOT NULL,
	"idproducto" integer NOT NULL,
	"pcosto" numeric(12, 2) NOT NULL,
	"pventa" numeric(12, 2) NOT NULL,
	"cantidad" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "il_transferencias" (
	"idtransferencia" serial PRIMARY KEY NOT NULL,
	"idempresa" integer NOT NULL,
	"noconsecutivo" integer NOT NULL,
	"fecha" timestamp DEFAULT now() NOT NULL,
	"origen" integer NOT NULL,
	"destino" integer NOT NULL,
	"inventariada" boolean DEFAULT false NOT NULL,
	"nota" text,
	"creado_por" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "il_transferencias_detalle" (
	"id" serial PRIMARY KEY NOT NULL,
	"idtransferencia" integer NOT NULL,
	"idproducto" integer NOT NULL,
	"preciocosto" numeric(12, 2) NOT NULL,
	"pventa" numeric(12, 2) NOT NULL,
	"cantidad" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "il_valesmonedas" (
	"id" serial PRIMARY KEY NOT NULL,
	"idvalesalida" integer NOT NULL,
	"idmoneda" integer NOT NULL,
	"tc" numeric(12, 4) DEFAULT '1' NOT NULL,
	"importe" numeric(14, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "il_valessalida" (
	"idvalesalida" serial PRIMARY KEY NOT NULL,
	"idempresa" integer NOT NULL,
	"noconsecutivo" integer NOT NULL,
	"fecha" timestamp DEFAULT now() NOT NULL,
	"idalmacen" integer NOT NULL,
	"inventariada" boolean DEFAULT false NOT NULL,
	"anulada" boolean DEFAULT false NOT NULL,
	"nota" text,
	"creado_por" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "il_valessalida_detalle" (
	"id" serial PRIMARY KEY NOT NULL,
	"idvalesalida" integer NOT NULL,
	"idproducto" integer NOT NULL,
	"idarea" integer,
	"preciocosto" numeric(12, 2) NOT NULL,
	"pventa" numeric(12, 2) NOT NULL,
	"cantidad" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ng_almacen" (
	"idalmacen" serial PRIMARY KEY NOT NULL,
	"idempresa" integer NOT NULL,
	"almacen" varchar(255) NOT NULL,
	"codigo" varchar(255),
	"abierto" boolean DEFAULT true NOT NULL,
	"pventa" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ng_areas" (
	"idarea" serial PRIMARY KEY NOT NULL,
	"idempresa" integer NOT NULL,
	"area" varchar(255) NOT NULL,
	"principal" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ng_bajas" (
	"idbajas" serial PRIMARY KEY NOT NULL,
	"idempresa" integer NOT NULL,
	"bajas" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ng_monedas" (
	"idmoneda" serial PRIMARY KEY NOT NULL,
	"idempresa" integer NOT NULL,
	"moneda" varchar(255) NOT NULL,
	"tc" numeric(12, 4) DEFAULT '1' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ng_productos" (
	"idproducto" serial PRIMARY KEY NOT NULL,
	"idempresa" integer NOT NULL,
	"producto" varchar(255) NOT NULL,
	"referencia" varchar(255),
	"pcosto" numeric(12, 2) DEFAULT '0' NOT NULL,
	"pventa" numeric(12, 2) DEFAULT '0' NOT NULL,
	"um" integer,
	"idtipo" integer,
	"rutaimagen" varchar(500),
	"elaborado" boolean DEFAULT false NOT NULL,
	"activo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ng_productosasociados" (
	"idproductosasociados" serial PRIMARY KEY NOT NULL,
	"idproducto" integer NOT NULL,
	"idproductoasociado" integer NOT NULL,
	"cantidad" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ng_productostipos" (
	"idtipo" serial PRIMARY KEY NOT NULL,
	"idempresa" integer NOT NULL,
	"tipo" varchar(50) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ng_usuarios" (
	"idusuario" serial PRIMARY KEY NOT NULL,
	"usuario" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"nombrecompleto" varchar(255) NOT NULL,
	"administrador" boolean DEFAULT false NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "unidadmedida" (
	"id" serial PRIMARY KEY NOT NULL,
	"idempresa" integer NOT NULL,
	"um" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "usuarios_empresas" (
	"idusuario" integer NOT NULL,
	"idempresa" integer NOT NULL,
	"inventario" boolean DEFAULT false NOT NULL,
	"caja" boolean DEFAULT false NOT NULL,
	"contabilidad" boolean DEFAULT false NOT NULL,
	"personal" boolean DEFAULT false NOT NULL,
	"finanzas" boolean DEFAULT false NOT NULL,
	"facturas" boolean DEFAULT false NOT NULL,
	"herramientas" boolean DEFAULT false NOT NULL,
	"reportes" boolean DEFAULT false NOT NULL,
	"es_admin_empresa" boolean DEFAULT false NOT NULL,
	CONSTRAINT "usuarios_empresas_idusuario_idempresa_pk" PRIMARY KEY("idusuario","idempresa")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bajaspor" ADD CONSTRAINT "bajaspor_idbajas_ng_bajas_idbajas_fk" FOREIGN KEY ("idbajas") REFERENCES "public"."ng_bajas"("idbajas") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bajaspor" ADD CONSTRAINT "bajaspor_idalmacen_ng_almacen_idalmacen_fk" FOREIGN KEY ("idalmacen") REFERENCES "public"."ng_almacen"("idalmacen") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bajaspor" ADD CONSTRAINT "bajaspor_idproducto_ng_productos_idproducto_fk" FOREIGN KEY ("idproducto") REFERENCES "public"."ng_productos"("idproducto") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bajaspor" ADD CONSTRAINT "bajaspor_creado_por_ng_usuarios_idusuario_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."ng_usuarios"("idusuario") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "il_existencias" ADD CONSTRAINT "il_existencias_idempresa_empresas_idempresa_fk" FOREIGN KEY ("idempresa") REFERENCES "public"."empresas"("idempresa") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "il_existencias" ADD CONSTRAINT "il_existencias_idalmacen_ng_almacen_idalmacen_fk" FOREIGN KEY ("idalmacen") REFERENCES "public"."ng_almacen"("idalmacen") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "il_existencias" ADD CONSTRAINT "il_existencias_idproducto_ng_productos_idproducto_fk" FOREIGN KEY ("idproducto") REFERENCES "public"."ng_productos"("idproducto") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "il_recepciones" ADD CONSTRAINT "il_recepciones_idempresa_empresas_idempresa_fk" FOREIGN KEY ("idempresa") REFERENCES "public"."empresas"("idempresa") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "il_recepciones" ADD CONSTRAINT "il_recepciones_idalmacen_ng_almacen_idalmacen_fk" FOREIGN KEY ("idalmacen") REFERENCES "public"."ng_almacen"("idalmacen") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "il_recepciones" ADD CONSTRAINT "il_recepciones_creado_por_ng_usuarios_idusuario_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."ng_usuarios"("idusuario") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "il_recepciones_detalle" ADD CONSTRAINT "il_recepciones_detalle_idrecepcion_il_recepciones_idrecepcion_fk" FOREIGN KEY ("idrecepcion") REFERENCES "public"."il_recepciones"("idrecepcion") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "il_recepciones_detalle" ADD CONSTRAINT "il_recepciones_detalle_idproducto_ng_productos_idproducto_fk" FOREIGN KEY ("idproducto") REFERENCES "public"."ng_productos"("idproducto") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "il_transferencias" ADD CONSTRAINT "il_transferencias_idempresa_empresas_idempresa_fk" FOREIGN KEY ("idempresa") REFERENCES "public"."empresas"("idempresa") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "il_transferencias" ADD CONSTRAINT "il_transferencias_origen_ng_almacen_idalmacen_fk" FOREIGN KEY ("origen") REFERENCES "public"."ng_almacen"("idalmacen") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "il_transferencias" ADD CONSTRAINT "il_transferencias_destino_ng_almacen_idalmacen_fk" FOREIGN KEY ("destino") REFERENCES "public"."ng_almacen"("idalmacen") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "il_transferencias" ADD CONSTRAINT "il_transferencias_creado_por_ng_usuarios_idusuario_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."ng_usuarios"("idusuario") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "il_transferencias_detalle" ADD CONSTRAINT "il_transferencias_detalle_idtransferencia_il_transferencias_idtransferencia_fk" FOREIGN KEY ("idtransferencia") REFERENCES "public"."il_transferencias"("idtransferencia") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "il_transferencias_detalle" ADD CONSTRAINT "il_transferencias_detalle_idproducto_ng_productos_idproducto_fk" FOREIGN KEY ("idproducto") REFERENCES "public"."ng_productos"("idproducto") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "il_valesmonedas" ADD CONSTRAINT "il_valesmonedas_idvalesalida_il_valessalida_idvalesalida_fk" FOREIGN KEY ("idvalesalida") REFERENCES "public"."il_valessalida"("idvalesalida") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "il_valesmonedas" ADD CONSTRAINT "il_valesmonedas_idmoneda_ng_monedas_idmoneda_fk" FOREIGN KEY ("idmoneda") REFERENCES "public"."ng_monedas"("idmoneda") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "il_valessalida" ADD CONSTRAINT "il_valessalida_idempresa_empresas_idempresa_fk" FOREIGN KEY ("idempresa") REFERENCES "public"."empresas"("idempresa") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "il_valessalida" ADD CONSTRAINT "il_valessalida_idalmacen_ng_almacen_idalmacen_fk" FOREIGN KEY ("idalmacen") REFERENCES "public"."ng_almacen"("idalmacen") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "il_valessalida" ADD CONSTRAINT "il_valessalida_creado_por_ng_usuarios_idusuario_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."ng_usuarios"("idusuario") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "il_valessalida_detalle" ADD CONSTRAINT "il_valessalida_detalle_idvalesalida_il_valessalida_idvalesalida_fk" FOREIGN KEY ("idvalesalida") REFERENCES "public"."il_valessalida"("idvalesalida") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "il_valessalida_detalle" ADD CONSTRAINT "il_valessalida_detalle_idproducto_ng_productos_idproducto_fk" FOREIGN KEY ("idproducto") REFERENCES "public"."ng_productos"("idproducto") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "il_valessalida_detalle" ADD CONSTRAINT "il_valessalida_detalle_idarea_ng_areas_idarea_fk" FOREIGN KEY ("idarea") REFERENCES "public"."ng_areas"("idarea") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ng_almacen" ADD CONSTRAINT "ng_almacen_idempresa_empresas_idempresa_fk" FOREIGN KEY ("idempresa") REFERENCES "public"."empresas"("idempresa") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ng_areas" ADD CONSTRAINT "ng_areas_idempresa_empresas_idempresa_fk" FOREIGN KEY ("idempresa") REFERENCES "public"."empresas"("idempresa") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ng_bajas" ADD CONSTRAINT "ng_bajas_idempresa_empresas_idempresa_fk" FOREIGN KEY ("idempresa") REFERENCES "public"."empresas"("idempresa") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ng_monedas" ADD CONSTRAINT "ng_monedas_idempresa_empresas_idempresa_fk" FOREIGN KEY ("idempresa") REFERENCES "public"."empresas"("idempresa") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ng_productos" ADD CONSTRAINT "ng_productos_idempresa_empresas_idempresa_fk" FOREIGN KEY ("idempresa") REFERENCES "public"."empresas"("idempresa") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ng_productos" ADD CONSTRAINT "ng_productos_um_unidadmedida_id_fk" FOREIGN KEY ("um") REFERENCES "public"."unidadmedida"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ng_productos" ADD CONSTRAINT "ng_productos_idtipo_ng_productostipos_idtipo_fk" FOREIGN KEY ("idtipo") REFERENCES "public"."ng_productostipos"("idtipo") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ng_productosasociados" ADD CONSTRAINT "ng_productosasociados_idproducto_ng_productos_idproducto_fk" FOREIGN KEY ("idproducto") REFERENCES "public"."ng_productos"("idproducto") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ng_productosasociados" ADD CONSTRAINT "ng_productosasociados_idproductoasociado_ng_productos_idproducto_fk" FOREIGN KEY ("idproductoasociado") REFERENCES "public"."ng_productos"("idproducto") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ng_productostipos" ADD CONSTRAINT "ng_productostipos_idempresa_empresas_idempresa_fk" FOREIGN KEY ("idempresa") REFERENCES "public"."empresas"("idempresa") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unidadmedida" ADD CONSTRAINT "unidadmedida_idempresa_empresas_idempresa_fk" FOREIGN KEY ("idempresa") REFERENCES "public"."empresas"("idempresa") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "usuarios_empresas" ADD CONSTRAINT "usuarios_empresas_idusuario_ng_usuarios_idusuario_fk" FOREIGN KEY ("idusuario") REFERENCES "public"."ng_usuarios"("idusuario") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "usuarios_empresas" ADD CONSTRAINT "usuarios_empresas_idempresa_empresas_idempresa_fk" FOREIGN KEY ("idempresa") REFERENCES "public"."empresas"("idempresa") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "il_existencias_almacen_producto_idx" ON "il_existencias" USING btree ("idalmacen","idproducto");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ng_usuarios_usuario_idx" ON "ng_usuarios" USING btree ("usuario");