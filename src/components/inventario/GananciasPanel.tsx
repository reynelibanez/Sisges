import { useState } from "react";
import DateRangeField from "@/components/DateRangeField";
import SelectField from "@/components/SelectField";
import { api, useList } from "@/lib/useApi";
import { exportCsv } from "@/lib/csv";
import { haceUnMesISO, hoyISO } from "@/lib/dates";

/**
 * "Ganancias" (nuevo): cuánto se ganó realmente en las ventas ya fijadas de
 * un rango de fechas — Ingresos, Costo y Ganancia, en total y por producto.
 * Usa el Costo/Venta que quedó grabado en cada línea del vale, no el precio
 * actual del catálogo.
 */
export default function GananciasPanel() {
  const { data: almacenes } = useList("/api/inventario/almacenes");

  const [desde, setDesde] = useState(haceUnMesISO());
  const [hasta, setHasta] = useState(hoyISO());
  const [idalmacen, setIdalmacen] = useState("");
  const [resultado, setResultado] = useState<{ resumen: any; productos: any[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const opcionesAlmacen = [{ value: "", label: "Todos los almacenes" }, ...almacenes.map((a: any) => ({ value: String(a.idalmacen), label: a.almacen }))];

  async function consultar(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ desde, hasta });
      if (idalmacen) qs.set("idalmacen", idalmacen);
      const r = await api.get(`/api/inventario/reportes/ganancias?${qs}`);
      setResultado(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo consultar el reporte");
      setResultado(null);
    } finally {
      setLoading(false);
    }
  }

  const max = resultado ? Math.max(0, ...resultado.productos.map((p: any) => p.ganancia)) : 0;

  return (
    <div className="panel">
      <div className="panel-toolbar">
        <h2>Ganancias</h2>
        {resultado && (
          <button className="btn btn-secondary" onClick={() => exportCsv("ganancias.csv", resultado.productos)}>
            Exportar CSV
          </button>
        )}
      </div>

      <div style={{ padding: 16 }}>
        <form onSubmit={consultar} style={{ marginBottom: 20, display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
          <DateRangeField desde={desde} hasta={hasta} onChange={(d, h) => { setDesde(d); setHasta(h); }} />
          <div className="field" style={{ minWidth: 220, marginBottom: 0 }}>
            <label>Almacén</label>
            <SelectField value={idalmacen} onChange={setIdalmacen} options={opcionesAlmacen} placeholder="Todos los almacenes" />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: "auto" }}>
            {loading ? "Consultando…" : "Consultar"}
          </button>
        </form>

        {error && <div className="error-box">{error}</div>}

        {resultado && (
          <>
            <div className="kpi-row">
              <div className="kpi-card">
                <div className="kpi-label">Ingresos</div>
                <div className="kpi-value">{resultado.resumen.ingresos.toFixed(2)}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Costo</div>
                <div className="kpi-value">{resultado.resumen.costo.toFixed(2)}</div>
              </div>
              <div className={`kpi-card ${resultado.resumen.ganancia >= 0 ? "kpi-positive" : "kpi-negative"}`}>
                <div className="kpi-label">Ganancia</div>
                <div className="kpi-value">{resultado.resumen.ganancia.toFixed(2)}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Margen</div>
                <div className="kpi-value">{resultado.resumen.margenPct.toFixed(1)}%</div>
              </div>
            </div>

            <div className="grid-wrap">
              <table className="data-grid">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Ingresos</th>
                    <th>Costo</th>
                    <th>Ganancia</th>
                    <th>Margen</th>
                    <th style={{ width: "25%" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.productos.map((p: any) => (
                    <tr key={p.idproducto}>
                      <td>{p.producto}</td>
                      <td>{p.cantidad.toFixed(2)}</td>
                      <td>{p.ingresos.toFixed(2)}</td>
                      <td>{p.costo.toFixed(2)}</td>
                      <td style={{ color: p.ganancia < 0 ? "var(--danger)" : "var(--success)", fontWeight: 600 }}>
                        {p.ganancia.toFixed(2)}
                      </td>
                      <td>{p.margenPct.toFixed(1)}%</td>
                      <td>
                        <div
                          style={{
                            background: p.ganancia < 0 ? "var(--danger)" : "var(--success)",
                            height: 14,
                            borderRadius: 4,
                            width: max > 0 ? `${(Math.max(0, p.ganancia) / max) * 100}%` : "0%",
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {resultado.productos.length === 0 && <div className="empty-state">Sin ventas en el rango elegido</div>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
