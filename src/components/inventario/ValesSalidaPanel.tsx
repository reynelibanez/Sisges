import { useEffect, useState } from "react";
import DataGrid from "@/components/DataGrid";
import Modal from "@/components/Modal";
import LineasProductoEditor, { type LineaProducto } from "@/components/inventario/LineasProductoEditor";
import { api, useList } from "@/lib/useApi";
import { exportCsv } from "@/lib/csv";

const PAGE_SIZE = 50;

interface FormVale {
  id: number | null;
  idalmacen: string;
  nota: string;
  inventariada: boolean;
  lineas: LineaProducto[];
}

const CONFIRM_INVENTARIADA =
  '¿Está seguro que desea guardar este Vale de Salida como "Inventariado"? Ya no podrá modificarlo.';

/**
 * "Vales de Salida" (Documentos): consulta/gestión de los vales de venta ya
 * generados — además de lo que sale de Caja (siempre queda inventariado de
 * una), acá también se puede crear un vale "a mano" (p. ej. consumo interno,
 * merma, uso sin cobro) que puede quedar como borrador antes de fijarse,
 * igual que Recepciones/Transferencias.
 */
export default function ValesSalidaPanel() {
  const { data: almacenes } = useList("/api/inventario/almacenes");
  const { data: productos } = useList("/api/inventario/productos");
  const { data: monedas } = useList("/api/inventario/monedas");
  const { data: existencias } = useList("/api/inventario/existencias");

  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [idalmacen, setIdalmacen] = useState("");
  const [estado, setEstado] = useState("");
  const [detalleVenta, setDetalleVenta] = useState<any | null>(null);

  const [form, setForm] = useState<FormVale | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function cargar() {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (desde) qs.set("desde", desde);
      if (hasta) qs.set("hasta", hasta);
      if (idalmacen) qs.set("idalmacen", idalmacen);
      if (estado) qs.set("anulada", estado);
      const r = await api.get(`/api/inventario/ventas?${qs}`);
      setData(r.rows);
      setTotal(r.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los vales de salida");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, desde, hasta, idalmacen, estado]);

  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function openNew() {
    setFormError(null);
    setForm({ id: null, idalmacen: "", nota: "", inventariada: false, lineas: [] });
  }

  function openEdit(r: any) {
    setFormError(null);
    setForm({
      id: r.idvalesalida,
      idalmacen: String(r.idalmacen),
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
    if (form.inventariada && !confirm(CONFIRM_INVENTARIADA)) return;

    setSaving(true);
    setFormError(null);
    const payload = {
      idalmacen: Number(form.idalmacen),
      nota: form.nota,
      inventariada: form.inventariada,
      detalle: form.lineas.map((l) => ({
        idproducto: Number(l.idproducto),
        cantidad: Number(l.cantidad),
        preciocosto: Number(l.costo),
        pventa: Number(l.venta),
      })),
      pagos: [],
    };
    try {
      if (form.id) {
        await api.put(`/api/inventario/ventas/${form.id}`, payload);
      } else {
        await api.post("/api/inventario/ventas", payload);
      }
      setForm(null);
      await cargar();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleEliminar(row: any) {
    if (!confirm(`¿Eliminar el borrador de vale No. ${row.noconsecutivo}?`)) return;
    try {
      await api.del(`/api/inventario/ventas/${row.idvalesalida}`);
      await cargar();
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo eliminar");
    }
  }

  async function handleAnular(row: any) {
    if (!confirm(`¿Anular el vale No. ${row.noconsecutivo}? Esto devuelve el stock al almacén.`)) return;
    try {
      await api.post(`/api/inventario/ventas/${row.idvalesalida}/anular`, {});
      await cargar();
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo anular");
    }
  }

  const almacenNombre = (id: number) => almacenes.find((a: any) => a.idalmacen === id)?.almacen ?? id;
  const productoNombre = (id: number) => productos.find((p: any) => String(p.idproducto) === String(id))?.producto ?? id;
  const monedaNombre = (id: number) => monedas.find((m: any) => m.idmoneda === id)?.moneda ?? id;
  const totalDe = (r: any) => (r.detalle ?? []).reduce((acc: number, l: any) => acc + Number(l.cantidad) * Number(l.pventa), 0);

  // El listado de productos al armar el vale depende del almacén elegido, y
  // solo se pueden sacar productos que ya tienen existencia ahí (igual que
  // AgregarProducto(idalmacen) del Caja.cs original: "SELECT * FROM
  // ConsultaExistencia WHERE idalmacen=... AND Saldo > 0").
  const productosDisponibles = form?.idalmacen
    ? existencias
        .filter((e: any) => String(e.idalmacen) === form.idalmacen && Number(e.saldo) > 0)
        .map((e: any) => ({ idproducto: e.idproducto, producto: e.producto, pcosto: e.pcosto, pventa: e.pventa }))
    : [];
  const productosPlaceholder = !form?.idalmacen
    ? "Selecciona un almacén primero…"
    : productosDisponibles.length === 0
      ? "Sin existencia en este almacén"
      : "Selecciona un producto…";

  return (
    <div className="panel">
      <div className="panel-toolbar">
        <h2>Vales de Salida</h2>
        <button
          className="btn btn-secondary"
          onClick={() => exportCsv("vales_salida.csv", data.map((r: any) => ({ ...r, total: totalDe(r) })))}
        >
          Exportar CSV (página actual)
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
          padding: "10px 16px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Desde</label>
        <input
          type="date"
          value={desde}
          onChange={(e) => {
            setPage(1);
            setDesde(e.target.value);
          }}
        />
        <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Hasta</label>
        <input
          type="date"
          value={hasta}
          onChange={(e) => {
            setPage(1);
            setHasta(e.target.value);
          }}
        />
        <select
          value={idalmacen}
          onChange={(e) => {
            setPage(1);
            setIdalmacen(e.target.value);
          }}
        >
          <option value="">Todos los almacenes</option>
          {almacenes.map((a: any) => (
            <option key={a.idalmacen} value={a.idalmacen}>
              {a.almacen}
            </option>
          ))}
        </select>
        <select
          value={estado}
          onChange={(e) => {
            setPage(1);
            setEstado(e.target.value);
          }}
        >
          <option value="">Activos y anulados</option>
          <option value="false">Solo activos</option>
          <option value="true">Solo anulados</option>
        </select>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted)" }}>
          Página {page} de {totalPaginas} — {total} vales
        </span>
        <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={{ width: "auto" }}>
          ‹
        </button>
        <button
          className="btn btn-secondary"
          disabled={page >= totalPaginas}
          onClick={() => setPage((p) => p + 1)}
          style={{ width: "auto" }}
        >
          ›
        </button>
      </div>

      {error && <div className="error-box" style={{ margin: 12 }}>{error}</div>}

      <DataGrid
        rows={data.map((r: any) => ({ ...r, total: totalDe(r), almacenNombre: almacenNombre(r.idalmacen) }))}
        loading={loading}
        pageSizeDefault={PAGE_SIZE}
        rowKey={(r: any) => r.idvalesalida}
        emptyLabel="No hay vales de salida en el rango elegido"
        onNew={openNew}
        onRowDoubleClick={(r: any) => setDetalleVenta(r)}
        contextActions={[
          { label: "Ver detalle", onClick: (r: any) => setDetalleVenta(r) },
          { label: "Editar", show: (r: any) => !r.inventariada, onClick: openEdit },
          { label: "Eliminar", danger: true, show: (r: any) => !r.inventariada, onClick: handleEliminar },
          { label: "Anular", danger: true, show: (r: any) => r.inventariada && !r.anulada, onClick: handleAnular },
        ]}
        columns={[
          { key: "noconsecutivo", label: "No.", type: "number", footer: "none" },
          { key: "fecha", label: "Fecha", type: "date", render: (r: any) => new Date(r.fecha).toLocaleString() },
          { key: "almacenNombre", label: "Almacén" },
          { key: "total", label: "Total", type: "number", render: (r: any) => Number(r.total).toFixed(2) },
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
        <Modal title={form.id ? "Editar vale de salida" : "Nuevo vale de salida"} onClose={() => setForm(null)} wide>
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
              <div className="field span-2">
                <label>Nota</label>
                <input value={form.nota} onChange={(e) => setForm({ ...form, nota: e.target.value })} />
              </div>
            </div>

            <h4 style={{ margin: "16px 0 8px" }}>Productos</h4>
            <LineasProductoEditor
              productos={productosDisponibles}
              lineas={form.lineas}
              onChange={(lineas) => setForm({ ...form, lineas })}
              costoLabel="Costo"
              ventaLabel="Precio"
              placeholder={productosPlaceholder}
            />

            <label className="checkbox-field" style={{ marginTop: 16 }}>
              <input
                type="checkbox"
                checked={form.inventariada}
                onChange={(e) => setForm({ ...form, inventariada: e.target.checked })}
              />
              Inventariado (fija el vale y resta las existencias — ya no se podrá modificar)
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

      {detalleVenta && (
        <Modal title={`Vale No. ${detalleVenta.noconsecutivo}`} onClose={() => setDetalleVenta(null)} wide>
          <div className="receipt-print">
            <div className="receipt-header">
              <div>{new Date(detalleVenta.fecha).toLocaleString()}</div>
              <div>{almacenNombre(detalleVenta.idalmacen)}</div>
              {detalleVenta.anulada ? (
                <div className="badge badge-off">ANULADA</div>
              ) : !detalleVenta.inventariada ? (
                <div className="badge badge-warn">BORRADOR</div>
              ) : null}
            </div>
            <table className="receipt-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cant.</th>
                  <th>Precio</th>
                  <th>Importe</th>
                </tr>
              </thead>
              <tbody>
                {(detalleVenta.detalle ?? []).map((l: any, i: number) => (
                  <tr key={i}>
                    <td>{productoNombre(l.idproducto)}</td>
                    <td>{Number(l.cantidad).toFixed(2)}</td>
                    <td>{Number(l.pventa).toFixed(2)}</td>
                    <td>{(Number(l.cantidad) * Number(l.pventa)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="receipt-total">Total: {totalDe(detalleVenta).toFixed(2)}</div>
            <div className="receipt-pagos">
              {(detalleVenta.pagos ?? []).map((p: any, i: number) => (
                <div key={i}>
                  {monedaNombre(p.idmoneda)}: {Number(p.importe).toFixed(2)} (tc {Number(p.tc).toFixed(4)})
                </div>
              ))}
            </div>
            {detalleVenta.nota && <div className="receipt-nota">Nota: {detalleVenta.nota}</div>}
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setDetalleVenta(null)}>
              Cerrar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
