ALTER TABLE "il_valesmonedas" ADD COLUMN "es_transferencia" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "il_valessalida" ADD COLUMN "cuenta_casa" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "il_valessalida" ADD COLUMN "promocion" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "il_valessalida" ADD COLUMN "promocion_porcentaje" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "il_valessalida" ADD COLUMN "mas_diez_porciento" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "il_valessalida" ADD COLUMN "vuelto" numeric(14, 2) DEFAULT '0' NOT NULL;