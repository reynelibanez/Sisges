import { useState } from "react";
import { api, useList } from "@/lib/useApi";

// "Desagregar Producto" (antes PorcionarTarta.cs): resta existencia de un
// producto origen y suma existencia a un producto destino en el mismo
// almacén de venta (por ejemplo: 1 Tarta entera -> 8 Porciones de tarta).
export default function DesagregarProductoPanel() {
  const { data: almacenes } = useList("/api/inventario/almacenes");
  const { data: productos } = useList("/api/inventario/productos");
  const { data: existencias, reload: reloadExistencias } = useList("/api/inventario/existencias");

  const puntosVenta = almacenes.filter((a: any) => a.pventa);

  const [form, setForm] = useState({
    idalmacen: "",
    idproductoOrigen: "",
    cantidadOrigen: "1",
    idproductoDestino: "",
    cantidadDestino: "1",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const saldoOrigen = existencias.find(
    (e: any) => String(e.idalmacen) === form.idalmacen && String(e.idproducto) === form.idproductoOrigen
  )?.saldo;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      await api.post("/api/inventario/desagregar", {
        idalmacen: Number(form.idalmacen),
        idproductoOrigen: Number(form.idproductoOrigen),
        cantidadOrigen: Number(form.cantidadOrigen),
        idproductoDestino: Number(form.idproductoDestino),
        cantidadDestino: Number(form.cantidadDestino),
      });
      setOk("Desagregación registrada correctamente.");
      await reloadExistencias();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar la desagregación");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-toolbar">
        <h2>Desagregar Producto</h2>
      </div>

      <div style={{ padding: 16, maxWidth: 560 }}>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
          Convierte existencia de un producto (por ejemplo, una unidad entera) en existencia de otro producto (por
          ejemplo, sus porciones), dentro del mismo almacén de venta.
        </p>

        {error && <div className="error-box">{error}</div>}
        {ok && <div className="badge badge-ok" style={{ display: "inline-block", marginBottom: 12 }}>{ok}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="field span-2">
              <label>Almacén de venta</label>
              <select
                required
                value={form.idalmacen}
                onChange={(e) => setForm({ ...form, idalmacen: e.target.value })}
              >
                <option value="">Selecciona…</option>
                {puntosVenta.map((a: any) => (
                  <option key={a.idalmacen} value={a.idalmacen}>
                    {a.almacen}
                  </option>
                ))}
              </select>
            </div>

            <div className="field span-2">
              <label>Producto origen {saldoOrigen != null ? `(existencia actual: ${Number(saldoOrigen).toFixed(2)})` : ""}</label>
              <select
                required
                value={form.idproductoOrigen}
                onChange={(e) => setForm({ ...form, idproductoOrigen: e.target.value })}
              >
                <option value="">Selecciona…</option>
                {productos.map((p: any) => (
                  <option key={p.idproducto} value={p.idproducto}>
                    {p.producto}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Cantidad a restar</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={form.cantidadOrigen}
                onChange={(e) => setForm({ ...form, cantidadOrigen: e.target.value })}
              />
            </div>

            <div className="field span-2">
              <label>Producto destino</label>
              <select
                required
                value={form.idproductoDestino}
                onChange={(e) => setForm({ ...form, idproductoDestino: e.target.value })}
              >
                <option value="">Selecciona…</option>
                {productos.map((p: any) => (
                  <option key={p.idproducto} value={p.idproducto}>
                    {p.producto}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Cantidad a sumar</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={form.cantidadDestino}
                onChange={(e) => setForm({ ...form, cantidadDestino: e.target.value })}
              />
            </div>
          </div>

          <div className="modal-actions" style={{ justifyContent: "flex-start", marginTop: 16 }}>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: "auto" }}>
              {saving ? "Guardando…" : "Desagregar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
