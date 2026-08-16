import { useState } from "react";
import DataGrid from "@/components/DataGrid";
import Modal from "@/components/Modal";
import { api, useList } from "@/lib/useApi";

// "Crear Cajeros" (antes Cajeros.cs + CrearCajero.cs): alta de usuarios que
// solo pueden operar la Caja (no ven el resto de Inventario). Solo
// disponible para quien tenga el permiso "Crear Cajeros".
export default function CrearCajerosPanel() {
  const { data, loading, error, reload, setData } = useList("/api/inventario/cajeros");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ usuario: "", password: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [showPass, setShowPass] = useState<any | null>(null);
  const [newPass, setNewPass] = useState("");
  const [passError, setPassError] = useState<string | null>(null);

  function openNew() {
    setForm({ usuario: "", password: "" });
    setFormError(null);
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await api.post("/api/inventario/cajeros", form);
      setShowForm(false);
      await reload();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "No se pudo crear el cajero");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActivo(row: any) {
    try {
      await api.put(`/api/inventario/cajeros/${row.idusuario}`, { activo: !row.activo });
      setData((prev) => prev.map((r) => (r.idusuario === row.idusuario ? { ...r, activo: !row.activo } : r)));
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo actualizar");
    }
  }

  function openResetPass(row: any) {
    setShowPass(row);
    setNewPass("");
    setPassError(null);
  }

  async function handleResetPass(e: React.FormEvent) {
    e.preventDefault();
    if (!showPass) return;
    setPassError(null);
    try {
      await api.put(`/api/inventario/cajeros/${showPass.idusuario}`, { password: newPass });
      setShowPass(null);
    } catch (e) {
      setPassError(e instanceof Error ? e.message : "No se pudo cambiar la contraseña");
    }
  }

  return (
    <div className="panel">
      <div className="panel-toolbar">
        <h2>Crear Cajeros</h2>
      </div>

      {error && <div className="error-box" style={{ margin: 12 }}>{error}</div>}

      <DataGrid
        rows={data}
        loading={loading}
        rowKey={(r: any) => r.idusuario}
        onNew={openNew}
        emptyLabel="No hay cajeros creados todavía"
        contextActions={[
          { label: "Cambiar contraseña", onClick: openResetPass },
          { label: "Desactivar", onClick: handleToggleActivo, danger: true, show: (r: any) => r.activo },
          { label: "Reactivar", onClick: handleToggleActivo, show: (r: any) => !r.activo },
        ]}
        columns={[
          { key: "usuario", label: "Usuario" },
          {
            key: "activo",
            label: "Estado",
            render: (r: any) =>
              r.activo ? <span className="badge badge-ok">Activo</span> : <span className="badge badge-off">Inactivo</span>,
          },
          { key: "creadoEn", label: "Creado", render: (r: any) => new Date(r.creadoEn).toLocaleDateString() },
        ]}
      />

      {showForm && (
        <Modal title="Nuevo cajero" onClose={() => setShowForm(false)}>
          <form onSubmit={handleSave}>
            {formError && <div className="error-box">{formError}</div>}
            <div className="form-grid">
              <div className="field span-2">
                <label>Usuario</label>
                <input required value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value })} />
              </div>
              <div className="field span-2">
                <label>Contraseña</label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
              El nuevo usuario solo tendrá acceso al módulo Caja, igual que en el sistema anterior.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: "auto" }}>
                {saving ? "Guardando…" : "Crear"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showPass && (
        <Modal title={`Cambiar contraseña — ${showPass.usuario}`} onClose={() => setShowPass(null)}>
          <form onSubmit={handleResetPass}>
            {passError && <div className="error-box">{passError}</div>}
            <div className="form-grid">
              <div className="field span-2">
                <label>Nueva contraseña</label>
                <input type="text" required minLength={3} value={newPass} onChange={(e) => setNewPass(e.target.value)} />
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowPass(null)}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" style={{ width: "auto" }}>
                Guardar
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
