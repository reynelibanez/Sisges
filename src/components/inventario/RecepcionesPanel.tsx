import { useState } from "react";
import DataGrid from "@/components/DataGrid";
import Modal from "@/components/Modal";
import LineasProductoEditor, { type LineaProducto } from "@/components/inventario/LineasProductoEditor";
import { api, useList } from "@/lib/useApi";
import { exportCsv } from "@/lib/csv";

interface FormRecepcion {
  id: number | null;
  idalmacen: string;
  entregadapor: string;
  nota: string;
  inventariada: boolean;
  lineas: LineaProducto[];
}

const CONFIRM_INVENTARIADA =
  '¿Está seguro que desea guardar esta Recepción como "Inventariada"? Ya no podrá modificarla.';

export default function RecepcionesPanel() {
  const { data, loading, error, reload } = useList("/api/inventario/recepciones");
  const { data: almacenes } = useList("/api/inventario/almacenes");
  const { data: productos } = useList("/api/inventario/productos");

  const [form, setForm] = useState<FormRecepcion | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Ver detalle / Imprimir (clic derecho -> "Ver detalle")
  const [detalleRecepcion, setDetalleRecepcion] = useState<any>(null);

  function openNew() {
    setFormError(null);
    setForm({ id: null, idalmacen: "", entregadapor: "", nota: "", inventariada: false, lineas: [] });
  }

  function openEdit(r: any) {
    setFormError(null);
    setForm({
      id: r.idrecepcion,
      idalmacen: String(r.idalmacen),
      entregadapor: r.entregadapor ?? "",
      nota: r.nota ?? "",
      inventariada: false,
      lineas: (r.detalle ?? []).map((l: any) => ({
        idproducto: String(l.idproducto),
        producto: productoNombre(l.idproducto),
        cantidad: l.cantidad,
        costo: l.pcosto,
        venta: l.pventa,
      })),
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    if (form.lineas.length === 0) {
      setFormError("Agrega al menos un producto");
      return;
    }
    if (form.inventariada && !confirm(CONFIRM_INVENTARIADA)) return;

    setSaving(true);
    setFormError(null);
    const payload = {
      idalmacen: Number(form.idalmacen),
      entregadapor: form.entregadapor,
      nota: form.nota,
      inventariada: form.inventariada,
      detalle: form.lineas.map((l) => ({
        idproducto: Number(l.idproducto),
        cantidad: Number(l.cantidad),
        pcosto: Number(l.costo),
        pventa: Number(l.venta),
      })),
    };
    try {
      if (form.id) {
        await api.put(`/api/inventario/recepciones/${form.id}`, payload);
      } else {
        await api.post("/api/inventario/recepciones", payload);
      }
      setForm(null);
      await reload();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleEliminar(row: any) {
    if (!confirm(`¿Eliminar el borrador de recepción No. ${row.noconsecutivo}?`)) return;
    try {
      await api.del(`/api/inventario/recepciones/${row.idrecepcion}`);
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo eliminar");
    }
  }

  async function handleAnular(row: any) {
    if (!confirm(`¿Anular la recepción No. ${row.noconsecutivo}? Esto resta del almacén lo que había entrado.`)) return;
    try {
      await api.post(`/api/inventario/recepciones/${row.idrecepcion}/anular`, {});
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo anular");
    }
  }

  const almacenNombre = (id: number) => almacenes.find((a: any) => a.idalmacen === id)?.almacen ?? id;
  const productoNombre = (id: number) => productos.find((p: any) => String(p.idproducto) === String(id))?.producto ?? id;
  const totalDe = (r: any) => (r.detalle ?? []).reduce((acc: number, l: any) => acc + Number(l.cantidad) * Number(l.pcosto), 0);

  return (
    <div className="panel">
      <div className="panel-toolbar">
        <h2>Recepciones</h2>
        <button className="btn btn-secondary" onClick={() => exportCsv("recepciones.csv", data)}>
          Exportar CSV
        </button>
      </div>

      {error && <div className="error-box" style={{ margin: 12 }}>{error}</div>}

      <DataGrid
        rows={data.map((r: any) => ({ ...r, almacenNombre: almacenNombre(r.idalmacen) }))}
        loading={loading}
        rowKey={(r: any) => r.idrecepcion}
        onNew={openNew}
        onRowDoubleClick={(r: any) => setDetalleRecepcion(r)}
        emptyLabel="No hay recepciones registradas"
        contextActions={[
          { label: "Ver detalle", onClick: (r: any) => setDetalleRecepcion(r) },
          { label: "Editar", show: (r: any) => !r.inventariada, onClick: openEdit },
          { label: "Eliminar", danger: true, show: (r: any) => !r.inventariada, onClick: handleEliminar },
          { label: "Anular", danger: true, show: (r: any) => r.inventariada && !r.anulada, onClick: handleAnular },
        ]}
        columns={[
          { key: "noconsecutivo", label: "No.", type: "number", footer: "none" },
          { key: "fecha", label: "Fecha", type: "date", render: (r: any) => new Date(r.fecha).toLocaleString() },
          { key: "almacenNombre", label: "Almacén" },
          { key: "entregadapor", label: "Entregada por" },
          { key: "detalle", label: "Líneas", type: "number", filterable: false, render: (r: any) => r.detalle?.length ?? 0 },
          {
            key: "anulada",
            label: "Estado",
            type: "boolean",
            footer: "none",
            render: (r: any) =>
              r.anulada ? (
                <span className="badge badge-off">Anulada</span>
              ) : !r.inventariada ? (
                <span className="badge badge-warn">Borrador</span>
              ) : (
                <span className="badge badge-ok">Activa</span>
              ),
          },
        ]}
      />

      {form && (
        <Modal title={form.id ? "Editar recepción" : "Nueva recepción"} onClose={() => setForm(null)} wide>
          <form onSubmit={handleSave}>
            {formError && <div className="error-box">{formError}</div>}
            <div className="form-grid">
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
                <label>Entregada por</label>
                <input value={form.entregadapor} onChange={(e) => setForm({ ...form, entregadapor: e.target.value })} />
              </div>
              <div className="field span-2">
                <label>Nota</label>
                <input value={form.nota} onChange={(e) => setForm({ ...form, nota: e.target.value })} />
              </div>
            </div>

            <h4 style={{ margin: "16px 0 8px" }}>Productos</h4>
            <LineasProductoEditor
              productos={productos}
              lineas={form.lineas}
              onChange={(lineas) => setForm({ ...form, lineas })}
              costoLabel="Costo"
              ventaLabel="Venta"
            />

            <label className="checkbox-field" style={{ marginTop: 16 }}>
              <input
                type="checkbox"
                checked={form.inventariada}
                onChange={(e) => setForm({ ...form, inventariada: e.target.checked })}
              />
              Inventariada (fija la recepción y suma las existencias — ya no se podrá modificar)
            </label>

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setForm(null)}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: "auto" }}>
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {detalleRecepcion && (
        <Modal title={`Recepción No. ${detalleRecepcion.noconsecutivo}`} onClose={() => setDetalleRecepcion(null)}>
          <div className="receipt-print">
            <div className="receipt-header">
              <div>Recepción No. {detalleRecepcion.noconsecutivo}</div>
              <div>{new Date(detalleRecepcion.fecha).toLocaleString()}</div>
              <div>{almacenNombre(detalleRecepcion.idalmacen)}</div>
              {detalleRecepcion.entregadapor && <div>Entregada por: {detalleRecepcion.entregadapor}</div>}
              {detalleRecepcion.anulada ? (
                <div className="badge badge-off">ANULADA</div>
              ) : !detalleRecepcion.inventariada ? (
                <div className="badge badge-warn">BORRADOR</div>
              ) : null}
            </div>
            <table className="receipt-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cant.</th>
                  <th>Costo</th>
                  <th>Venta</th>
                  <th>Importe</th>
                </tr>
              </thead>
              <tbody>
                {(detalleRecepcion.detalle ?? []).map((l: any, i: number) => (
                  <tr key={i}>
                    <td>{productoNombre(l.idproducto)}</td>
                    <td>{Number(l.cantidad).toFixed(2)}</td>
                    <td>{Number(l.pcosto).toFixed(2)}</td>
                    <td>{Number(l.pventa).toFixed(2)}</td>
                    <td>{(Number(l.cantidad) * Number(l.pcosto)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="receipt-total">Total (costo): {totalDe(detalleRecepcion).toFixed(2)}</div>
            {detalleRecepcion.nota && <div className="receipt-nota">Nota: {detalleRecepcion.nota}</div>}
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setDetalleRecepcion(null)}>
              Cerrar
            </button>
            <button type="button" className="btn btn-primary" style={{ width: "auto" }} onClick={() => window.print()}>
              Imprimir
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
