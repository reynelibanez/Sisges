import { useState } from "react";
import DataGrid from "@/components/DataGrid";
import Modal from "@/components/Modal";
import { api, useList } from "@/lib/useApi";
import { exportCsv } from "@/lib/csv";

export default function BajasPanel() {
  const { data, loading, error, reload } = useList("/api/inventario/bajas");
  const { data: motivos } = useList("/api/inventario/bajas-motivos");
  const { data: almacenes } = useList("/api/inventario/almacenes");
  const { data: productos } = useList("/api/inventario/productos");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ idbajas: "", idalmacen: "", idproducto: "", cantidad: "1", pcosto: "0", pventa: "0" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function openNew() {
    setForm({ idbajas: "", idalmacen: "", idproducto: "", cantidad: "1", pcosto: "0", pventa: "0" });
    setFormError(null);
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await api.post("/api/inventario/bajas", {
        idbajas: Number(form.idbajas),
        idalmacen: Number(form.idalmacen),
        idproducto: Number(form.idproducto),
        cantidad: Number(form.cantidad),
        pcosto: Number(form.pcosto),
        pventa: Number(form.pventa),
      });
      setShowForm(false);
      await reload();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  const motivoNombre = (id: number) => motivos.find((m: any) => m.idbajas === id)?.bajas ?? id;
  const almacenNombre = (id: number) => almacenes.find((a: any) => a.idalmacen === id)?.almacen ?? id;
  const productoNombre = (id: number) => productos.find((p: any) => p.idproducto === id)?.producto ?? id;

  return (
    <div className="panel">
      <div className="panel-toolbar">
        <h2>Bajas</h2>
        <button className="btn btn-secondary" onClick={() => exportCsv("bajas.csv", data)}>
          Exportar CSV
        </button>
      </div>

      {error && <div className="error-box" style={{ margin: 12 }}>{error}</div>}

      <DataGrid
        rows={data.map((r: any) => ({
          ...r,
          motivoNombre: motivoNombre(r.idbajas),
          almacenNombre: almacenNombre(r.idalmacen),
          productoNombre: productoNombre(r.idproducto),
        }))}
        loading={loading}
        rowKey={(r: any) => r.idbajaspor}
        onNew={openNew}
        emptyLabel="No hay bajas registradas"
        columns={[
          { key: "fecha", label: "Fecha", type: "date", render: (r: any) => new Date(r.fecha).toLocaleString() },
          { key: "motivoNombre", label: "Motivo" },
          { key: "almacenNombre", label: "Almacén" },
          { key: "productoNombre", label: "Producto" },
          { key: "cantidad", label: "Cantidad", type: "number" },
        ]}
      />

      {showForm && (
        <Modal title="Nueva baja" onClose={() => setShowForm(false)}>
          <form onSubmit={handleSave}>
            {formError && <div className="error-box">{formError}</div>}
            <div className="form-grid">
              <div className="field span-2">
                <label>Motivo</label>
                <select required value={form.idbajas} onChange={(e) => setForm({ ...form, idbajas: e.target.value })}>
                  <option value="">Selecciona…</option>
                  {motivos.map((m: any) => (
                    <option key={m.idbajas} value={m.idbajas}>
                      {m.bajas}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Almacén</label>
                <select required value={form.idalmacen} onChange={(e) => setForm({ ...form, idalmacen: e.target.value })}>
                  <option value="">Selecciona…</option>
                  {almacenes.map((a: any) => (
                    <option key={a.idalmacen} value={a.idalmacen}>
                      {a.almacen}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Producto</label>
                <select required value={form.idproducto} onChange={(e) => setForm({ ...form, idproducto: e.target.value })}>
                  <option value="">Selecciona…</option>
                  {productos.map((p: any) => (
                    <option key={p.idproducto} value={p.idproducto}>
                      {p.producto}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Cantidad</label>
                <input type="number" min="0" step="0.01" required value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} />
              </div>
              <div className="field">
                <label>Precio costo</label>
                <input type="number" min="0" step="0.01" value={form.pcosto} onChange={(e) => setForm({ ...form, pcosto: e.target.value })} />
              </div>
              <div className="field">
                <label>Precio venta</label>
                <input type="number" min="0" step="0.01" value={form.pventa} onChange={(e) => setForm({ ...form, pventa: e.target.value })} />
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: "auto" }}>
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
