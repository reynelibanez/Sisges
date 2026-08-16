CREATE INDEX IF NOT EXISTS "bajaspor_idalmacen_idx" ON "bajaspor" USING btree ("idalmacen");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bajaspor_idproducto_idx" ON "bajaspor" USING btree ("idproducto");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bajaspor_fecha_idx" ON "bajaspor" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "il_recepciones_detalle_idrecepcion_idx" ON "il_recepciones_detalle" USING btree ("idrecepcion");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "il_transferencias_detalle_idtransferencia_idx" ON "il_transferencias_detalle" USING btree ("idtransferencia");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "il_valesmonedas_idvalesalida_idx" ON "il_valesmonedas" USING btree ("idvalesalida");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "il_valessalida_idempresa_fecha_idx" ON "il_valessalida" USING btree ("idempresa","fecha");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "il_valessalida_idalmacen_idx" ON "il_valessalida" USING btree ("idalmacen");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "il_valessalida_detalle_idvalesalida_idx" ON "il_valessalida_detalle" USING btree ("idvalesalida");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "il_valessalida_detalle_idproducto_idx" ON "il_valessalida_detalle" USING btree ("idproducto");