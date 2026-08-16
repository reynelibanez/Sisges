import { useState } from "react";
import DateRangeField from "@/components/DateRangeField";
import { api } from "@/lib/useApi";
import { exportCsv } from "@/lib/csv";
import { haceUnMesISO, hoyISO } from "@/lib/dates";

// "Top - Productos Vendidos" (antes GraficosProductos.cs): ranking de
// productos por cantidad vendida en un rango de fechas, con grid + barras.
export default function TopProductosPanel() {
  const [desde, setDesde] = useState(haceUnMesISO());
  const [hasta, setHasta] = useState(hoyISO());
  const [todos, setTodos] = useState(true);
  const [top, setTop] = useState("10");
  const [resultado, setResultado] = useState<{ productos: any[]; max: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function consultar(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ desde, hasta, top: todos ? "0" : top });
      const r = await api.get(`/api/inventario/reportes/top-productos?${qs}`);
      setResultado(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo consultar el reporte");
      setResultado(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-toolbar">
        <h2>Top - Productos Vendidos</h2>
        {resultado && (
          <button className="btn btn-secondary" onClick={() => exportCsv("top_productos.csv", resultado.productos)}>
            Exportar CSV
          </button>
        )}
      </div>

      <div style={{ padding: 16 }}>
        <form onSubmit={consultar} style={{ marginBottom: 16, display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
          <DateRangeField desde={desde} hasta={hasta} onChange={(d, h) => { setDesde(d); setHasta(h); }} />
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="checkbox-field">
              <input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} />
              Ver todos
            </label>
          </div>
          {!todos && (
            <div className="field" style={{ marginBottom: 0, width: 100 }}>
              <label>Top</label>
              <input type="number" min="1" value={top} onChange={(e) => setTop(e.target.value)} />
            </div>
          )}
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: "auto" }}>
            {loading ? "Consultando…" : "Consultar"}
          </button>
        </form>

        {error && <div className="error-box">{error}</div>}

        {resultado && (
          <div className="grid-wrap">
            <table className="data-grid">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cantidad vendida</th>
                  <th>Importe</th>
                  <th style={{ width: "35%" }}></th>
                </tr>
              </thead>
              <tbody>
                {resultado.productos.map((p: any) => (
                  <tr key={p.idproducto}>
                    <td>{p.producto}</td>
                    <td>{p.cantidad.toFixed(2)}</td>
                    <td>{p.importe.toFixed(2)}</td>
                    <td>
                      <div
                        style={{
                          background: "var(--primary)",
                          height: 14,
                          borderRadius: 4,
                          width: resultado.max > 0 ? `${(p.cantidad / resultado.max) * 100}%` : "0%",
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {resultado.productos.length === 0 && <div className="empty-state">Sin ventas en el rango elegido</div>}
          </div>
        )}
      </div>
    </div>
  );
}
