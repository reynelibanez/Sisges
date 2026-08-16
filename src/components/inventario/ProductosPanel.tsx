import { useState } from "react";
import DataGrid from "@/components/DataGrid";
import Modal from "@/components/Modal";
import { api, useList } from "@/lib/useApi";
import { exportCsv } from "@/lib/csv";

export default function ProductosPanel() {
  const { data, loading, error, reload, setData } = useList("/api/inventario/productos");
  const { data: unidades } = useList("/api/inventario/unidades");
  const { data: tipos } = useList("/api/inventario/tipos");

  const [editing, setEditing] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function openNew() {
    setEditing({ producto: "", referencia: "", pcosto: "0", pventa: "0", um: "", idtipo: "", elaborado: false });
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(row: any) {
    setEditing({ ...row, um: row.um ?? "", idtipo: row.idtipo ?? "" });
    setFormError(null);
    setShowForm(true);
  }

  async function handleDelete(row: any) {
    if (!confirm(`¿Dar de baja "${row.producto}"?`)) return;
    try {
      await api.del(`/api/inventario/productos/${row.idproducto}`);
      setData((prev) => prev.filter((r) => r.idproducto !== row.idproducto));
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
        ...editing,
        um: editing.um === "" ? null : Number(editing.um),
        idtipo: editing.idtipo === "" ? null : Number(editing.idtipo),
      };
      if (editing.idproducto == null) {
        await api.post("/api/inventario/productos", payload);
      } else {
        await api.put(`/api/inventario/productos/${editing.idproducto}`, payload);
      }
      setShowForm(false);
      await reload();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  const unidadNombre = (id: number | null) => unidades.find((u: any) => u.id === id)?.um ?? "";
  const tipoNombre = (id: number | null) => tipos.find((t: any) => t.idtipo === id)?.tipo ?? "";

  return (
    <div className="panel">
      <div className="panel-toolbar">
        <h2>Productos</h2>
        <button className="btn btn-secondary" onClick={() => exportCsv("productos.csv", data)}>
          Exportar CSV
        </button>
      </div>

      {error && <div className="error-box" style={{ margin: 12 }}>{error}</div>}

      <DataGrid
        rows={data}
        rowKey={(r: any) => r.idproducto}
        loading={loading}
        onNew={openNew}
        onRowDoubleClick={openEdit}
        contextActions={[
          { label: "Modificar", onClick: openEdit },
          { label: "Eliminar", onClick: handleDelete, danger: true },
        ]}
        columns={[
          { key: "producto", label: "Producto" },
          { key: "referencia", label: "Referencia" },
          { key: "um", label: "U/M", render: (r: any) => unidadNombre(r.um) },
          { key: "idtipo", label: "Tipo", render: (r: any) => tipoNombre(r.idtipo) },
          { key: "pcosto", label: "Costo", render: (r: any) => Number(r.pcosto).toFixed(2) },
          { key: "pventa", label: "Precio Venta", render: (r: any) => Number(r.pventa).toFixed(2) },
        ]}
      />

      {showForm && editing && (
        <Modal title={editing.idproducto == null ? "Nuevo producto" : "Modificar producto"} onClose={() => setShowForm(false)}>
          <form onSubmit={handleSave}>
            {formError && <div className="error-box">{formError}</div>}
            <div className="form-grid">
              <div className="field span-2">
                <label>Nombre del producto</label>
                <input
                  required
                  value={editing.producto}
                  onChange={(e) => setEditing({ ...editing, producto: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Referencia</label>
                <input
                  value={editing.referencia ?? ""}
                  onChange={(e) => setEditing({ ...editing, referencia: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Unidad de medida</label>
                <select value={editing.um} onChange={(e) => setEditing({ ...editing, um: e.target.value })}>
                  <option value="">—</option>
                  {unidades.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.um}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Tipo</label>
                <select value={editing.idtipo} onChange={(e) => setEditing({ ...editing, idtipo: e.target.value })}>
                  <option value="">—</option>
                  {tipos.map((t: any) => (
                    <option key={t.idtipo} value={t.idtipo}>
                      {t.tipo}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Precio de costo</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={editing.pcosto}
                  onChange={(e) => setEditing({ ...editing, pcosto: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Precio de venta</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={editing.pventa}
                  onChange={(e) => setEditing({ ...editing, pventa: e.target.value })}
                />
              </div>
              <div className="field">
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={!!editing.elaborado}
                    onChange={(e) => setEditing({ ...editing, elaborado: e.target.checked })}
                  />
                  Es producto elaborado
                </label>
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
