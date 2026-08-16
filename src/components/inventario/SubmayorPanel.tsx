import { useState } from "react";
import DateRangeField from "@/components/DateRangeField";
import SelectField from "@/components/SelectField";
import { api, useList } from "@/lib/useApi";
import { exportCsv } from "@/lib/csv";
import { haceUnMesISO, hoyISO } from "@/lib/dates";

const TIPOS: Record<string, string> = {
  IR: "Recepción",
  TE: "Transf. entrada",
  TS: "Transf. salida",
  BJ: "Baja",
  VE: "Venta",
};

// "Submayor" (antes tabla IL_Submayor): kárdex de movimientos de un
// producto en un almacén, con saldo corriente. Se calcula al vuelo a
// partir de recepciones, transferencias, bajas y ventas reales.
export default function SubmayorPanel() {
  const { data: almacenes } = useList("/api/inventario/almacenes");
  const { data: productos } = useList("/api/inventario/productos");

  const [idalmacen, setIdalmacen] = useState("");
  const [idproducto, setIdproducto] = useState("");
  const [desde, setDesde] = useState(haceUnMesISO());
  const [hasta, setHasta] = useState(hoyISO());
  const [resultado, setResultado] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const opcionesAlmacen = almacenes.map((a: any) => ({ value: String(a.idalmacen), label: a.almacen }));
  const opcionesProducto = productos.map((p: any) => ({ value: String(p.idproducto), label: p.producto }));

  async function consultar(e?: React.FormEvent) {
    e?.preventDefault();
    if (!idalmacen || !idproducto) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ idalmacen, idproducto, desde, hasta });
      const r = await api.get(`/api/inventario/reportes/submayor?${qs}`);
      setResultado(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo consultar el submayor");
      setResultado(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-toolbar">
        <h2>Submayor</h2>
        {resultado && (
          <button className="btn btn-secondary" onClick={() => exportCsv("submayor.csv", resultado.movimientos)}>
            Exportar CSV
          </button>
        )}
      </div>

      <div style={{ padding: 16 }}>
        <form onSubmit={consultar} style={{ marginBottom: 16, display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="field" style={{ minWidth: 200, marginBottom: 0 }}>
            <label>Almacén</label>
            <SelectField value={idalmacen} onChange={setIdalmacen} options={opcionesAlmacen} placeholder="Selecciona…" required />
          </div>
          <div className="field" style={{ minWidth: 260, marginBottom: 0 }}>
            <label>Producto</label>
            <SelectField value={idproducto} onChange={setIdproducto} options={opcionesProducto} placeholder="Selecciona…" required />
          </div>
          <DateRangeField desde={desde} hasta={hasta} onChange={(d, h) => { setDesde(d); setHasta(h); }} />
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: "auto" }}>
            {loading ? "Consultando…" : "Consultar"}
          </button>
        </form>

        {error && <div className="error-box">{error}</div>}

        {resultado && (
          <>
            <p>
              <strong>{resultado.producto}</strong> en <strong>{resultado.almacen}</strong> — Saldo inicial al{" "}
              {desde}: <strong>{Number(resultado.saldoInicial).toFixed(2)}</strong>
            </p>
            <div className="grid-wrap">
              <table className="data-grid">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Documento</th>
                    <th>Movimiento</th>
                    <th>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.movimientos.map((m: any, i: number) => (
                    <tr key={i}>
                      <td>{new Date(m.fecha).toLocaleString()}</td>
                      <td>{TIPOS[m.tipo] ?? m.tipo}</td>
                      <td>{m.documento}</td>
                      <td style={{ color: m.cantidad < 0 ? "var(--danger, #dc2626)" : "var(--ok, #16a34a)" }}>
                        {m.cantidad > 0 ? "+" : ""}
                        {Number(m.cantidad).toFixed(2)}
                      </td>
                      <td>{Number(m.saldo).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {resultado.movimientos.length === 0 && <div className="empty-state">Sin movimientos en el rango elegido</div>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
