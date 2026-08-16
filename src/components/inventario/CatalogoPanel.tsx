import { useState } from "react";
import DataGrid, { type ColumnDef } from "@/components/DataGrid";
import Modal from "@/components/Modal";
import { api, useList } from "@/lib/useApi";
import { exportCsv } from "@/lib/csv";

export interface CatalogoField {
  key: string;
  label: string;
  type?: "text" | "checkbox";
  required?: boolean;
}

interface CatalogoPanelProps {
  title: string;
  endpoint: string; // /api/inventario/almacenes
  idKey: string; // "idalmacen"
  columns: ColumnDef<any>[];
  fields: CatalogoField[];
}

/**
 * Panel genérico para catálogos simples (Almacenes, Áreas, Unidades de
 * Medida, Tipos de Producto, Motivos de Baja): grid + clic derecho con
 * Nuevo / Modificar / Eliminar / Exportar, igual que en el sistema de
 * escritorio.
 */
export default function CatalogoPanel({ title, endpoint, idKey, columns, fields }: CatalogoPanelProps) {
  const { data, loading, error, reload, setData } = useList(endpoint);
  const [editing, setEditing] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function openNew() {
    const empty: Record<string, unknown> = {};
    for (const f of fields) empty[f.key] = f.type === "checkbox" ? false : "";
    setEditing(empty);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(row: any) {
    setEditing(row);
    setFormError(null);
    setShowForm(true);
  }

  async function handleDelete(row: any) {
    if (!confirm(`¿Eliminar "${row[fields[0].key]}"?`)) return;
    try {
      await api.del(`${endpoint}/${row[idKey]}`);
      setData((prev) => prev.filter((r) => r[idKey] !== row[idKey]));
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
      const isNew = editing[idKey] == null;
      if (isNew) {
        await api.post(endpoint, editing);
      } else {
        await api.put(`${endpoint}/${editing[idKey]}`, editing);
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
        <h2>{title}</h2>
        <button className="btn btn-secondary" onClick={() => exportCsv(`${title}.csv`, data)}>
          Exportar CSV
        </button>
      </div>

      {error && <div className="error-box" style={{ margin: 12 }}>{error}</div>}

      <DataGrid
        columns={columns}
        rows={data}
        rowKey={(r) => r[idKey]}
        loading={loading}
        onNew={openNew}
        onRowDoubleClick={openEdit}
        contextActions={[
          { label: "Modificar", onClick: openEdit },
          { label: "Eliminar", onClick: handleDelete, danger: true },
        ]}
      />

      {showForm && editing && (
        <Modal title={editing[idKey] == null ? `Nuevo — ${title}` : `Modificar — ${title}`} onClose={() => setShowForm(false)}>
          <form onSubmit={handleSave}>
            {formError && <div className="error-box">{formError}</div>}
            <div className="form-grid">
              {fields.map((f) => (
                <div className={`field ${f.type === "checkbox" ? "" : "span-2"}`} key={f.key}>
                  {f.type === "checkbox" ? (
                    <label className="checkbox-field">
                      <input
                        type="checkbox"
                        checked={!!editing[f.key]}
                        onChange={(e) => setEditing({ ...editing, [f.key]: e.target.checked })}
                      />
                      {f.label}
                    </label>
                  ) : (
                    <>
                      <label>{f.label}</label>
                      <input
                        type="text"
                        required={f.required}
                        value={editing[f.key] ?? ""}
                        onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })}
                      />
                    </>
                  )}
                </div>
              ))}
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
