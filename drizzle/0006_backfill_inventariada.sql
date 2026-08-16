-- "Inventariada" ahora controla si un documento (Recepción, Transferencia o
-- Vale de Salida) ya afectó las existencias y quedó fijado (igual que en el
-- sistema original: checkEditInventariada). Todo lo que ya existía en estas
-- tablas ANTES de este cambio ya tenía su efecto en existencias aplicado en
-- el momento en que se creó (no había concepto de borrador todavía), así
-- que se marca como inventariado para no duplicar el ajuste de stock si
-- alguien lo vuelve a "fijar" por error.
UPDATE il_recepciones SET inventariada = true WHERE inventariada = false;
UPDATE il_transferencias SET inventariada = true WHERE inventariada = false;
UPDATE il_valessalida SET inventariada = true WHERE inventariada = false;
