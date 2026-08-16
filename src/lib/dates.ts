// Helpers de fechas en formato YYYY-MM-DD (el que esperan los <input
// type="date"> y los endpoints de reportes), usados por DateRangeField y
// por los paneles de reportes para sus rangos "por defecto" y "rápidos".

function formatISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function hoyISO() {
  return formatISO(new Date());
}

export function haceNDiasISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return formatISO(d);
}

export function haceUnMesISO() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return formatISO(d);
}

export function inicioMesISO() {
  const d = new Date();
  return formatISO(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function inicioMesPasadoISO() {
  const d = new Date();
  return formatISO(new Date(d.getFullYear(), d.getMonth() - 1, 1));
}

export function finMesPasadoISO() {
  const d = new Date();
  return formatISO(new Date(d.getFullYear(), d.getMonth(), 0));
}

// Rangos rápidos para DateRangeField: cada uno calcula {desde, hasta} al
// vuelo (no son valores fijos) para que siempre reflejen "hoy" real.
export const RANGOS_RAPIDOS: { label: string; rango: () => { desde: string; hasta: string } }[] = [
  { label: "Hoy", rango: () => ({ desde: hoyISO(), hasta: hoyISO() }) },
  { label: "Ayer", rango: () => ({ desde: haceNDiasISO(1), hasta: haceNDiasISO(1) }) },
  { label: "Últimos 7 días", rango: () => ({ desde: haceNDiasISO(6), hasta: hoyISO() }) },
  { label: "Últimos 30 días", rango: () => ({ desde: haceNDiasISO(29), hasta: hoyISO() }) },
  { label: "Este mes", rango: () => ({ desde: inicioMesISO(), hasta: hoyISO() }) },
  { label: "Mes pasado", rango: () => ({ desde: inicioMesPasadoISO(), hasta: finMesPasadoISO() }) },
];
