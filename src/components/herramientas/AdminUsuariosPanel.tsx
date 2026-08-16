import { useState } from "react";
import DataGrid from "@/components/DataGrid";
import Modal from "@/components/Modal";
import { api, useList } from "@/lib/useApi";

const MODULOS: { key: keyof PermisosForm; label: string }[] = [
  { key: "inventario", label: "Inventario" },
  { key: "caja", label: "Caja" },
  { key: "contabilidad", label: "Contabilidad" },
  { key: "personal", label: "Personal" },
  { key: "finanzas", label: "Finanzas" },
  { key: "facturas", label: "Facturación" },
  { key: "herramientas", label: "Herramientas" },
  { key: "reportes", label: "Reportes" },
  { key: "crearCajero", label: "Crear Cajeros" },
  { key: "esAdminEmpresa", label: "Administrador de la empresa" },
];

interface PermisosForm {
  inventario: boolean;
  caja: boolean;
  contabilidad: boolean;
  personal: boolean;
  finanzas: boolean;
  facturas: boolean;
  herramientas: boolean;
  reportes: boolean;
  crearCajero: boolean;
  esAdminEmpresa: boolean;
}

const PERMISOS_VACIOS: PermisosForm = {
  inventario: false,
  caja: false,
  contabilidad: false,
  personal: false,
  finanzas: false,
  facturas: false,
  herramientas: false,
  reportes: false,
  crearCajero: false,
  esAdminEmpresa: false,
};

// "Administrar Usuarios" (Herramientas → solo Administradores): alta de
// usuarios y edición de sus permisos por módulo — equivalente web a lo que
// en config.dll era editar directamente NG_Usuarios.
export default function AdminUsuariosPanel() {
  const { data, loading, error, reload } = useList("/api/herramientas/usuarios");

  const [showNuevo, setShowNuevo] = useState(false);
  const [nuevo, setNuevo] = useState({ usuario: "", password: "" });
  const [nuevoPermisos, setNuevoPermisos] = useState<PermisosForm>(PERMISOS_VACIOS);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [editando, setEditando] = useState<any | null>(null);
  const [editPermisos, setEditPermisos] = useState<PermisosForm>(PERMISOS_VACIOS);
  const [editError, setEditError] = useState<string | null>(null);

  const [showPass, setShowPass] = useState<any | null>(null);
  const [newPass, setNewPass] = useState("");
  const [passError, setPassError] = useState<string | null>(null);

  function abrirNuevo() {
    setNuevo({ usuario: "", password: "" });
    setNuevoPermisos(PERMISOS_VACIOS);
    setFormError(null);
    setShowNuevo(true);
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await api.post("/api/herramientas/usuarios", { ...nuevo, permisos: nuevoPermisos });
      setShowNuevo(false);
      await reload();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "No se pudo crear el usuario");
    } finally {
      setSaving(false);
    }
  }

  function abrirEditar(row: any) {
    setEditando(row);
    setEditPermisos({
      inventario: row.inventario,
      caja: row.caja,
      contabilidad: row.contabilidad,
      personal: row.personal,
      finanzas: row.finanzas,
      facturas: row.facturas,
      herramientas: row.herramientas,
      reportes: row.reportes,
      crearCajero: row.crearCajero,
      esAdminEmpresa: row.esAdminEmpresa,
    });
    setEditError(null);
  }

  async function guardarPermisos(e: React.FormEvent) {
    e.preventDefault();
    if (!editando) return;
    setEditError(null);
    try {
      await api.put(`/api/herramientas/usuarios/${editando.idusuario}`, { permisos: editPermisos });
      setEditando(null);
      await reload();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "No se pudo guardar");
    }
  }

  async function toggleActivo(row: any) {
    try {
      await api.put(`/api/herramientas/usuarios/${row.idusuario}`, { activo: !row.activo });
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo actualizar");
    }
  }

  function abrirResetPass(row: any) {
    setShowPass(row);
    setNewPass("");
    setPassError(null);
  }

  async function resetPass(e: React.FormEvent) {
    e.preventDefault();
    if (!showPass) return;
    setPassError(null);
    try {
      await api.put(`/api/herramientas/usuarios/${showPass.idusuario}`, { password: newPass });
      setShowPass(null);
    } catch (e) {
      setPassError(e instanceof Error ? e.message : "No se pudo cambiar la contraseña");
    }
  }

  const modulosActivos = (row: any) => MODULOS.filter((m) => row[m.key]).map((m) => m.label).join(", ") || "—";

  return (
    <div className="panel">
      <div className="panel-toolbar">
        <h2>Administrar Usuarios</h2>
      </div>

      {error && <div className="error-box" style={{ margin: 12 }}>{error}</div>}

      <DataGrid
        rows={data}
        loading={loading}
        rowKey={(r: any) => r.idusuario}
        onNew={abrirNuevo}
        onRowDoubleClick={abrirEditar}
        emptyLabel="No hay usuarios registrados"
        contextActions={[
          { label: "Editar permisos", onClick: abrirEditar },
          { label: "Cambiar contraseña", onClick: abrirResetPass },
          { label: "Desactivar", onClick: toggleActivo, danger: true, show: (r: any) => r.activo },
          { label: "Reactivar", onClick: toggleActivo, show: (r: any) => !r.activo },
        ]}
        columns={[
          { key: "usuario", label: "Usuario" },
          {
            key: "activo",
            label: "Estado",
            type: "boolean",
            footer: "none",
            render: (r: any) =>
              r.activo ? <span className="badge badge-ok">Activo</span> : <span className="badge badge-off">Inactivo</span>,
          },
          { key: "modulos", label: "Módulos con acceso", filterable: false, footer: "none", render: modulosActivos },
          {
            key: "esAdminEmpresa",
            label: "Admin.",
            type: "boolean",
            footer: "none",
            render: (r: any) => (r.esAdminEmpresa ? <span className="badge badge-ok">Sí</span> : "No"),
          },
        ]}
      />

      {showNuevo && (
        <Modal title="Nuevo usuario" onClose={() => setShowNuevo(false)} wide>
          <form onSubmit={crear}>
            {formError && <div className="error-box">{formError}</div>}
            <div className="form-grid">
              <div className="field">
                <label>Usuario</label>
                <input required value={nuevo.usuario} onChange={(e) => setNuevo({ ...nuevo, usuario: e.target.value })} />
              </div>
              <div className="field">
                <label>Contraseña</label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={nuevo.password}
                  onChange={(e) => setNuevo({ ...nuevo, password: e.target.value })}
                />
              </div>
            </div>
            <PermisosGrid permisos={nuevoPermisos} onChange={setNuevoPermisos} />
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowNuevo(false)}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: "auto" }}>
                {saving ? "Guardando…" : "Crear"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editando && (
        <Modal title={`Permisos — ${editando.usuario}`} onClose={() => setEditando(null)} wide>
          <form onSubmit={guardarPermisos}>
            {editError && <div className="error-box">{editError}</div>}
            <PermisosGrid permisos={editPermisos} onChange={setEditPermisos} />
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setEditando(null)}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" style={{ width: "auto" }}>
                Guardar
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showPass && (
        <Modal title={`Cambiar contraseña — ${showPass.usuario}`} onClose={() => setShowPass(null)}>
          <form onSubmit={resetPass}>
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

function PermisosGrid({ permisos, onChange }: { permisos: PermisosForm; onChange: (p: PermisosForm) => void }) {
  return (
    <div style={{ marginTop: 12 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 8 }}>
        Permisos por módulo
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {MODULOS.map((m) => (
          <label key={m.key} className="checkbox-field">
            <input
              type="checkbox"
              checked={permisos[m.key]}
              onChange={(e) => onChange({ ...permisos, [m.key]: e.target.checked })}
            />
            {m.label}
          </label>
        ))}
      </div>
    </div>
  );
}
