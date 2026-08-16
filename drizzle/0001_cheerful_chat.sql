CREATE TABLE IF NOT EXISTS "il_extracciones" (
	"idextraccion" serial PRIMARY KEY NOT NULL,
	"idempresa" integer NOT NULL,
	"idalmacen" integer NOT NULL,
	"fecha" date NOT NULL,
	"importe" numeric(14, 2) NOT NULL,
	"nota" text,
	"creado_por" integer,
	"creado_en" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "il_ventadia" (
	"idventadia" serial PRIMARY KEY NOT NULL,
	"idempresa" integer NOT NULL,
	"idalmacen" integer NOT NULL,
	"idproducto" integer NOT NULL,
	"cantidad" numeric(14, 2) NOT NULL,
	"fecha" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ng_fechacierre" (
	"idfechacierre" serial PRIMARY KEY NOT NULL,
	"idempresa" integer NOT NULL,
	"idalmacen" integer NOT NULL,
	"fecha" date NOT NULL,
	"cerrado" boolean DEFAULT true NOT NULL,
	"cerrado_por" integer,
	"cerrado_en" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "il_extracciones" ADD CONSTRAINT "il_extracciones_idempresa_empresas_idempresa_fk" FOREIGN KEY ("idempresa") REFERENCES "public"."empresas"("idempresa") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "il_extracciones" ADD CONSTRAINT "il_extracciones_idalmacen_ng_almacen_idalmacen_fk" FOREIGN KEY ("idalmacen") REFERENCES "public"."ng_almacen"("idalmacen") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "il_extracciones" ADD CONSTRAINT "il_extracciones_creado_por_ng_usuarios_idusuario_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."ng_usuarios"("idusuario") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "il_ventadia" ADD CONSTRAINT "il_ventadia_idempresa_empresas_idempresa_fk" FOREIGN KEY ("idempresa") REFERENCES "public"."empresas"("idempresa") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "il_ventadia" ADD CONSTRAINT "il_ventadia_idalmacen_ng_almacen_idalmacen_fk" FOREIGN KEY ("idalmacen") REFERENCES "public"."ng_almacen"("idalmacen") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "il_ventadia" ADD CONSTRAINT "il_ventadia_idproducto_ng_productos_idproducto_fk" FOREIGN KEY ("idproducto") REFERENCES "public"."ng_productos"("idproducto") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ng_fechacierre" ADD CONSTRAINT "ng_fechacierre_idempresa_empresas_idempresa_fk" FOREIGN KEY ("idempresa") REFERENCES "public"."empresas"("idempresa") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ng_fechacierre" ADD CONSTRAINT "ng_fechacierre_idalmacen_ng_almacen_idalmacen_fk" FOREIGN KEY ("idalmacen") REFERENCES "public"."ng_almacen"("idalmacen") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ng_fechacierre" ADD CONSTRAINT "ng_fechacierre_cerrado_por_ng_usuarios_idusuario_fk" FOREIGN KEY ("cerrado_por") REFERENCES "public"."ng_usuarios"("idusuario") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ng_fechacierre_almacen_fecha_idx" ON "ng_fechacierre" USING btree ("idalmacen","fecha");