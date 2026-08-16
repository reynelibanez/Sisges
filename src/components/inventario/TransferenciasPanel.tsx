import { useState } from "react";
import DataGrid from "@/components/DataGrid";
import Modal from "@/components/Modal";
import LineasProductoEditor, { type LineaProducto } from "@/components/inventario/LineasProductoEditor";
import { api, useList } from "@/lib/useApi";
import { exportCsv } from "@/lib/csv";

interface FormTransferencia {
  id: number | null;
  origen: string;
  destino: string;
  nota: string;
  inventariada: boolean;
  lineas: LineaProducto[];
}

const CONFIRM_INVENTARIADA =
  '¿Está seguro que desea guardar esta Transferencia como "Inventariada"? Ya no podrá modificarla.';

export default function TransferenciasPanel() {
  const { data, loading, error, reload } = useList("/api/inventario/transferencias");
  const { data: almacenes } = useList("/api/inventario/almacenes");
  const { data: productos } = useList("/api/inventario/productos");

  const [form, setForm] = useState<FormTransferencia | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Ver detalle / Imprimir (clic derecho -> "Ver detalle")
  const [detalleTransferencia, setDetalleTransferencia] = useState<any>(null);

  function openNew() {
    setFormError(null);
    setForm({ id: null, origen: "", destino: "", nota: "", inventariada: false, lineas: [] });
  }

  function openEdit(r: any) {
    setFormError(null);
    setForm({
      id: r.idtransferencia,
      origen: String(r.origen),
      destino: String(r.destino),
      nota: r.nota ?? "",
      inventariada: false,
      lineas: (r.detalle ?? []).map((l: any) => ({
        idproducto: String(l.idproducto),
        producto: productoNombre(l.idproducto),
        cantidad: l.cantidad,
        costo: l.preciocosto,
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
    if (form.origen && form.destino && form.origen === form.destino) {
      setFormError("El almacén origen y destino no pueden ser el mismo");
      return;
    }
    if (form.inventariada && !confirm(CONFIRM_INVENTARIADA)) return;

    setSaving(true);
    setFormError(null);
    const payload = {
      origen: Number(form.origen),
      destino: Number(form.destino),
      nota: form.nota,
      inventariada: form.inventariada,
      detalle: form.lineas.map((l) => ({
        idproducto: Number(l.idproducto),
        cantidad: Number(l.cantidad),
        preciocosto: Number(l.costo),
        pventa: Number(l.venta),
      })),
    };
    try {
      if (form.id) {
        await api.put(`/api/inventario/transferencias/${form.id}`, payload);
      } else {
        await api.post("/api/inventario/transferencias", payload);
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
    if (!confirm(`¿Eliminar el borrador de transferencia No. ${row.noconsecutivo}?`)) return;
    try {
      await api.del(`/api/inventario/transferencias/${row.idtransferencia}`);
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo eliminar");
    }
  }

  async function handleAnular(row: any) {
    if (!confirm(`¿Anular la transferencia No. ${row.noconsecutivo}? Esto revierte el movimiento entre almacenes.`)) return;
    try {
      await api.post(`/api/inventario/transferencias/${row.idtransferencia}/anular`, {});
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo anular");
    }
  }

  const almacenNombre = (id: number) => almacenes.find((a: any) => a.idalmacen === id)?.almacen ?? id;
  const productoNombre = (id: number) => productos.find((p: any) => String(p.idproducto) === String(id))?.producto ?? id;
  const totalDe = (r: any) => (r.detalle ?? []).reduce((acc: number, l: any) => acc + Number(l.cantidad) * Number(l.preciocosto), 0);

  return (
    <div className="panel">
      <div className="panel-toolbar">
        <h2>Transferencias</h2>
        <button className="btn btn-secondary" onClick={() => exportCsv("transferencias.csv", data)}>
          Exportar CSV
        </button>
      </div>

      {error && <div className="error-box" style={{ margin: 12 }}>{error}</div>}

      <DataGrid
        rows={data.map((r: any) => ({ ...r, origenNombre: almacenNombre(r.origen), destinoNombre: almacenNombre(r.destino) }))}
        loading={loading}
        rowKey={(r: any) => r.idtransferencia}
        onNew={openNew}
        onRowDoubleClick={(r: any) => setDetalleTransferencia(r)}
        emptyLabel="No hay transferencias registradas"
        contextActions={[
          { label: "Ver detalle", onClick: (r: any) => setDetalleTransferencia(r) },
          { label: "Editar", show: (r: any) => !r.inventariada, onClick: openEdit },
          { label: "Eliminar", danger: true, show: (r: any) => !r.inventariada, onClick: handleEliminar },
          { label: "Anular", danger: true, show: (r: any) => r.inventariada && !r.anulada, onClick: handleAnular },
        ]}
        columns={[
          { key: "noconsecutivo", label: "No.", type: "number", footer: "none" },
          { key: "fecha", label: "Fecha", type: "date", render: (r: any) => new Date(r.fecha).toLocaleString() },
          { key: "origenNombre", label: "Origen" },
          { key: "destinoNombre", label: "Destino" },
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
        <Modal title={form.id ? "Editar transferencia" : "Nueva transferencia"} onClose={() => setForm(null)} wide>
          <form onSubmit={handleSave}>
            {formError && <div className="error-box">{formError}</div>}
            <div className="form-grid">
              <div className="field">
                <label>Almacén origen</label>
                <select required value={form.origen} onChange={(e) => setForm({ ...form, origen: e.target.value })}>
                  <option value="">Selecciona…</option>
                  {almacenes.map((a: any) => (
                    <option key={a.idalmacen} value={a.idalmacen}>
                      {a.almacen}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Almacén destino</label>
                <select required value={form.destino} onChange={(e) => setForm({ ...form, destino: e.target.value })}>
                  <option value="">Selecciona…</option>
                  {almacenes
                    .filter((a: any) => String(a.idalmacen) !== form.origen)
                    .map((a: any) => (
                      <option key={a.idalmacen} value={a.idalmacen}>
                        {a.almacen}
                      </option>
                    ))}
                </select>
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
              Inventariada (fija la transferencia y mueve las existencias — ya no se podrá modificar)
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

      {detalleTransferencia && (
        <Modal title={`Transferencia No. ${detalleTransferencia.noconsecutivo}`} onClose={() => setDetalleTransferencia(null)}>
          <div className="receipt-print">
            <div className="receipt-header">
              <div>Transferencia No. {detalleTransferencia.noconsecutivo}</div>
              <div>{new Date(detalleTransferencia.fecha).toLocaleString()}</div>
              <div>
                {almacenNombre(detalleTransferencia.origen)} → {almacenNombre(detalleTransferencia.destino)}
              </div>
              {detalleTransferencia.anulada ? (
                <div className="badge badge-off">ANULADA</div>
              ) : !detalleTransferencia.inventariada ? (
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
                {(detalleTransferencia.detalle ?? []).map((l: any, i: number) => (
                  <tr key={i}>
                    <td>{productoNombre(l.idproducto)}</td>
                    <td>{Number(l.cantidad).toFixed(2)}</td>
                    <td>{Number(l.preciocosto).toFixed(2)}</td>
                    <td>{Number(l.pventa).toFixed(2)}</td>
                    <td>{(Number(l.cantidad) * Number(l.preciocosto)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="receipt-total">Total (costo): {totalDe(detalleTransferencia).toFixed(2)}</div>
            {detalleTransferencia.nota && <div className="receipt-nota">Nota: {detalleTransferencia.nota}</div>}
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setDetalleTransferencia(null)}>
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
