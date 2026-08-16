import { RANGOS_RAPIDOS } from "@/lib/dates";

interface Props {
  desde: string;
  hasta: string;
  onChange: (desde: string, hasta: string) => void;
  /** Oculta los chips de rango rápido (Hoy, Últimos 7 días…) si no aplican. */
  sinAtajos?: boolean;
}

/**
 * Selector de rango de fechas — reemplaza el par suelto de <input
 * type="date"> que se repetía (feo, sin relación visual entre sí) en cada
 * panel de reportes. Junta "Desde"/"Hasta" en una sola tarjeta con chips de
 * atajos (Hoy, Últimos 7 días, Este mes…) para no tener que abrir el
 * calendario cada vez.
 */
export default function DateRangeField({ desde, hasta, onChange, sinAtajos = false }: Props) {
  const activo = RANGOS_RAPIDOS.find((r) => {
    const { desde: d, hasta: h } = r.rango();
    return d === desde && h === hasta;
  })?.label;

  return (
    <div className="date-range-field">
      <div className="date-range-inputs">
        <label>
          <span>Desde</span>
          <input type="date" value={desde} max={hasta || undefined} onChange={(e) => onChange(e.target.value, hasta)} />
        </label>
        <div className="date-range-sep" aria-hidden>
          →
        </div>
        <label>
          <span>Hasta</span>
          <input type="date" value={hasta} min={desde || undefined} onChange={(e) => onChange(desde, e.target.value)} />
        </label>
      </div>
      {!sinAtajos && (
        <div className="date-range-chips">
          {RANGOS_RAPIDOS.map((r) => (
            <button
              key={r.label}
              type="button"
              className={`chip${activo === r.label ? " chip-active" : ""}`}
              onClick={() => {
                const { desde: d, hasta: h } = r.rango();
                onChange(d, h);
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
