import { useState } from "react";
import DataGrid from "@/components/DataGrid";
import Modal from "@/components/Modal";
import { api, useList } from "@/lib/useApi";
import { exportCsv } from "@/lib/csv";

// "Asociar productos" (antes ListadoProductosAsociados.cs): liga un
// producto principal (combo/elaborado) con las materias primas que
// descuenta al venderse, y en qué cantidad. Alimenta "Consumo de Materia
// Prima".
export default function ProductosAsociadosPanel() {
  const { data, loading, error, reload, setData } = useList("/api/inventario/productos-asociados");
  const { data: productos } = useList("/api/inventario/productos");

  const [editing, setEditing] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function openNew() {
    setEditing({ idproducto: "", idproductoasociado: "", cantidad: "1" });
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(row: any) {
    setEditing(row);
    setFormError(null);
    setShowForm(true);
  }

  async function handleDelete(row: any) {
    if (!confirm(`¿Eliminar la asociación "${row.producto} -> ${row.productoAsociado}"?`)) return;
    try {
      await api.del(`/api/inventario/productos-asociados/${row.idproductosasociados}`);
      setData((prev) => prev.filter((r) => r.idproductosasociados !== row.idproductosasociados));
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo eliminar");
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        idproducto: Number(editing.idproducto),
        idproductoasociado: Number(editing.idproductoasociado),
        cantidad: Number(editing.cantidad),
      };
      if (editing.idproductosasociados == null) {
        await api.post("/api/inventario/productos-asociados", payload);
      } else {
        await api.put(`/api/inventario/productos-asociados/${editing.idproductosasociados}`, payload);
      }
      setShowForm(false);
      await reload();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-toolbar">
        <h2>Asociar productos</h2>
        <button className="btn btn-secondary" onClick={() => exportCsv("productos_asociados.csv", data)}>
          Exportar CSV
        </button>
      </div>

      {error && <div className="error-box" style={{ margin: 12 }}>{error}</div>}

      <DataGrid
        rows={data}
        loading={loading}
        rowKey={(r: any) => r.idproductosasociados}
        onNew={openNew}
        onRowDoubleClick={openEdit}
        emptyLabel="No hay productos asociados registrados"
        contextActions={[
          { label: "Modificar", onClick: openEdit },
          { label: "Eliminar", onClick: handleDelete, danger: true },
        ]}
        columns={[
          { key: "producto", label: "Producto principal" },
          { key: "productoAsociado", label: "Producto asociado (materia prima)" },
          { key: "cantidad", label: "Cantidad por unidad", render: (r: any) => Number(r.cantidad).toFixed(2) },
        ]}
      />

      {showForm && editing && (
        <Modal
          title={editing.idproductosasociados == null ? "Nueva asociación" : "Modificar asociación"}
          onClose={() => setShowForm(false)}
        >
          <form onSubmit={handleSave}>
            {formError && <div className="error-box">{formError}</div>}
            <div className="form-grid">
              <div className="field span-2">
                <label>Producto principal</label>
                <select
                  required
                  value={editing.idproducto}
                  onChange={(e) => setEditing({ ...editing, idproducto: e.target.value })}
                >
                  <option value="">Selecciona…</option>
                  {productos.map((p: any) => (
                    <option key={p.idproducto} value={p.idproducto}>
                      {p.producto}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field span-2">
                <label>Producto asociado (materia prima)</label>
                <select
                  required
                  value={editing.idproductoasociado}
                  onChange={(e) => setEditing({ ...editing, idproductoasociado: e.target.value })}
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
                <label>Cantidad por unidad vendida</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={editing.cantidad}
                  onChange={(e) => setEditing({ ...editing, cantidad: e.target.value })}
                />
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
