import { useState } from "react";
import DateRangeField from "@/components/DateRangeField";
import { api } from "@/lib/useApi";
import { exportCsv } from "@/lib/csv";
import { haceUnMesISO, hoyISO } from "@/lib/dates";

// "Vales con Monedas Extranjeras" (antes VentasConMonedasExtranjeras.cs):
// pagos de ventas hechos en una moneda distinta de la base (tc != 1).
export default function ValesMonedasPanel() {
  const [desde, setDesde] = useState(haceUnMesISO());
  const [hasta, setHasta] = useState(hoyISO());
  const [rows, setRows] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function consultar(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ desde, hasta });
      const r = await api.get(`/api/inventario/reportes/vales-monedas?${qs}`);
      setRows(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo consultar el reporte");
      setRows(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-toolbar">
        <h2>Vales con Monedas Extranjeras</h2>
        {rows && (
          <button className="btn btn-secondary" onClick={() => exportCsv("vales_monedas.csv", rows)}>
            Exportar CSV
          </button>
        )}
      </div>

      <div style={{ padding: 16 }}>
        <form onSubmit={consultar} style={{ marginBottom: 16, display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
          <DateRangeField desde={desde} hasta={hasta} onChange={(d, h) => { setDesde(d); setHasta(h); }} />
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: "auto" }}>
            {loading ? "Consultando…" : "Consultar"}
          </button>
        </form>

        {error && <div className="error-box">{error}</div>}

        {rows && (
          <div className="grid-wrap">
            <table className="data-grid">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Vale</th>
                  <th>Almacén</th>
                  <th>Moneda</th>
                  <th>Tasa de cambio</th>
                  <th>Importe</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{new Date(r.fecha).toLocaleString()}</td>
                    <td>#{r.noconsecutivo}</td>
                    <td>{r.almacen}</td>
                    <td>{r.moneda}</td>
                    <td>{Number(r.tc).toFixed(4)}</td>
                    <td>{Number(r.importe).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <div className="empty-state">No hay vales con monedas extranjeras en el rango elegido</div>}
          </div>
        )}
      </div>
    </div>
  );
}
