import { useState } from "react";
import DateRangeField from "@/components/DateRangeField";
import SelectField from "@/components/SelectField";
import { api, useList } from "@/lib/useApi";
import { hoyISO } from "@/lib/dates";

// "Consumo de Materia Prima" (antes GenerarVSMateriasPrimas.cs): calcula,
// para un rango de fechas, cuánta materia prima se consumió por las ventas
// de productos elaborados/combos (según "Asociar productos"), y permite
// registrar ese consumo como una baja de existencia — sin inflar el total
// de ventas, a diferencia del sistema anterior.
export default function ConsumoMateriaPrimaPanel() {
  const { data: almacenes } = useList("/api/inventario/almacenes");
  const puntosVenta = almacenes.filter((a: any) => a.pventa);

  const [idalmacen, setIdalmacen] = useState("");
  const [desde, setDesde] = useState(hoyISO());
  const [hasta, setHasta] = useState(hoyISO());
  const [items, setItems] = useState<{ idproducto: number; producto: string; cantidad: number }[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function calcular(e?: React.FormEvent) {
    e?.preventDefault();
    if (!idalmacen) return;
    setLoading(true);
    setError(null);
    setOk(null);
    try {
      const qs = new URLSearchParams({ idalmacen, desde, hasta });
      const r = await api.get(`/api/inventario/consumo-materia-prima?${qs}`);
      setItems(r.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo calcular el consumo");
      setItems(null);
    } finally {
      setLoading(false);
    }
  }

  function actualizarCantidad(idproducto: number, cantidad: string) {
    setItems((prev) => prev && prev.map((it) => (it.idproducto === idproducto ? { ...it, cantidad: Number(cantidad) } : it)));
  }

  async function registrar() {
    if (!items || items.length === 0) return;
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      await api.post("/api/inventario/consumo-materia-prima", {
        idalmacen: Number(idalmacen),
        desde,
        hasta,
        items: items.map((it) => ({ idproducto: it.idproducto, cantidad: it.cantidad })),
      });
      setOk("Consumo registrado como baja de existencia.");
      setItems(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar el consumo");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-toolbar">
        <h2>Consumo de Materia Prima</h2>
      </div>

      <div style={{ padding: 16 }}>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
          Calcula cuánta materia prima se consumió según las ventas de productos elaborados/combos (definidos en
          "Asociar productos") y regístralo como baja de existencia.
        </p>

        <form onSubmit={calcular} style={{ marginBottom: 16, display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="field" style={{ minWidth: 220, marginBottom: 0 }}>
            <label>Almacén de venta</label>
            <SelectField
              value={idalmacen}
              onChange={setIdalmacen}
              options={puntosVenta.map((a: any) => ({ value: String(a.idalmacen), label: a.almacen }))}
              placeholder="Selecciona…"
              required
            />
          </div>
          <DateRangeField desde={desde} hasta={hasta} onChange={(d, h) => { setDesde(d); setHasta(h); }} />
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: "auto" }}>
            {loading ? "Calculando…" : "Calcular"}
          </button>
        </form>

        {error && <div className="error-box">{error}</div>}
        {ok && <div className="badge badge-ok" style={{ display: "inline-block", marginBottom: 12 }}>{ok}</div>}

        {items && (
          <>
            <div className="grid-wrap">
              <table className="data-grid">
                <thead>
                  <tr>
                    <th>Materia prima</th>
                    <th>Cantidad calculada</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.idproducto}>
                      <td>{it.producto}</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={it.cantidad}
                          onChange={(e) => actualizarCantidad(it.idproducto, e.target.value)}
                          style={{ width: 120 }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {items.length === 0 && (
                <div className="empty-state">No hay consumo de materia prima calculado para ese rango</div>
              )}
            </div>

            {items.length > 0 && (
              <div className="modal-actions" style={{ justifyContent: "flex-start", marginTop: 16 }}>
                <button className="btn btn-primary" disabled={saving} onClick={registrar} style={{ width: "auto" }}>
                  {saving ? "Registrando…" : "Registrar como baja de existencia"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
