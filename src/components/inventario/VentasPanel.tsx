import { useEffect, useState } from "react";
import DataGrid from "@/components/DataGrid";
import Modal from "@/components/Modal";
import AreaTabsCaja from "./AreaTabsCaja";
import { api, useList } from "@/lib/useApi";
import { exportCsv } from "@/lib/csv";

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Ventas — este panel reemplaza al antiguo tab "Caja" del sistema de
 * escritorio (Escoger punto de venta + vales de salida + pagos en varias
 * monedas), unificado aquí dentro de Inventario porque comparten la misma
 * base de datos (almacenes, productos, existencias).
 *
 * El pedido en curso ya no es una modal única: cada área/mesa tiene su
 * propia pestaña abierta en simultáneo (ver AreaTabsCaja), igual que
 * AreaCaja.cs + Caja.cs en el sistema de escritorio.
 */
const PAGE_SIZE = 50;

interface VentasPanelProps {
  puedeInventario: boolean;
}

export default function VentasPanel({ puedeInventario }: VentasPanelProps) {
  const { data: almacenes } = useList("/api/inventario/almacenes");
  const { data: areas } = useList("/api/inventario/areas");
  const { data: productos } = useList("/api/inventario/productos");
  const { data: monedas } = useList("/api/inventario/monedas");
  const { data: existencias, reload: recargarExistencias } = useList("/api/inventario/existencias");

  // Próximo No. de Vale (preview, como txtnovale en el original) — el
  // número real se asigna en el servidor al cobrar, esto es solo un
  // estimado para mostrar antes de confirmar.
  const [proximoNoVale, setProximoNoVale] = useState<number | null>(null);
  async function cargarProximoNoVale() {
    try {
      const r = await api.get("/api/inventario/ventas?pageSize=1");
      setProximoNoVale((r.total ?? 0) + 1);
    } catch {
      // no bloquea la pantalla de cobro si esto falla
    }
  }
  useEffect(() => {
    cargarProximoNoVale();
  }, []);

  const puntosVenta = almacenes.filter((a: any) => a.pventa);
  const [idalmacenCaja, setIdalmacenCaja] = useState("");

  useEffect(() => {
    if (puntosVenta.length && !idalmacenCaja) {
      setIdalmacenCaja(String(puntosVenta[0].idalmacen));
    }
  }, [puntosVenta, idalmacenCaja]);

  // Historial de ventas: paginado del lado del servidor (8900+ ventas
  // reales migradas — cargarlas todas de una vez hacía la grilla lenta).
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");
  const [filtroAlmacen, setFiltroAlmacen] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");

  async function cargar() {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (filtroDesde) qs.set("desde", filtroDesde);
      if (filtroHasta) qs.set("hasta", filtroHasta);
      if (filtroAlmacen) qs.set("idalmacen", filtroAlmacen);
      if (filtroEstado) qs.set("anulada", filtroEstado);
      const r = await api.get(`/api/inventario/ventas?${qs}`);
      setData(r.rows);
      setTotal(r.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar las ventas");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filtroDesde, filtroHasta, filtroAlmacen, filtroEstado]);

  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Reimprimir Vale (antes reImprimirValeToolStripMenuItem / ReImprimirVale())
  const [reciboVenta, setReciboVenta] = useState<any>(null);

  // Cuadre X Productos (antes cuadreXProductosToolStripMenuItem_Click)
  const [showCuadre, setShowCuadre] = useState(false);
  const [cuadreFecha, setCuadreFecha] = useState(hoyISO());
  const [cuadreAlmacen, setCuadreAlmacen] = useState("");
  const [cuadreData, setCuadreData] = useState<any>(null);
  const [cuadreLoading, setCuadreLoading] = useState(false);
  const [cuadreError, setCuadreError] = useState<string | null>(null);

  // Exportar Ventas por rango de fecha (antes exportarVentasToolStripMenuItem_Click)
  const [showExportar, setShowExportar] = useState(false);
  const [exportDesde, setExportDesde] = useState(hoyISO());
  const [exportHasta, setExportHasta] = useState(hoyISO());
  const [exportAlmacen, setExportAlmacen] = useState("");
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleAnular(row: any) {
    if (!confirm(`¿Anular la venta No. ${row.noconsecutivo}? Esto devuelve el stock al almacén.`)) return;
    try {
      const actualizado = await api.post(`/api/inventario/ventas/${row.idvalesalida}/anular`, {});
      setData((prev) => prev.map((r) => (r.idvalesalida === row.idvalesalida ? { ...r, anulada: actualizado.anulada } : r)));
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo anular");
    }
  }

  const almacenNombre = (id: number) => almacenes.find((a: any) => a.idalmacen === id)?.almacen ?? id;
  const productoNombre = (id: number) => productos.find((p: any) => p.idproducto === id)?.producto ?? id;
  const monedaNombre = (id: number) => monedas.find((m: any) => m.idmoneda === id)?.moneda ?? id;
  const totalDe = (r: any) => (r.detalle ?? []).reduce((acc: number, l: any) => acc + Number(l.cantidad) * Number(l.pventa), 0);

  async function cargarCuadre() {
    setCuadreLoading(true);
    setCuadreError(null);
    try {
      const qs = new URLSearchParams({ fecha: cuadreFecha });
      if (cuadreAlmacen) qs.set("idalmacen", cuadreAlmacen);
      const data = await api.get(`/api/inventario/caja/cuadre-productos?${qs}`);
      setCuadreData(data);
    } catch (e) {
      setCuadreError(e instanceof Error ? e.message : "No se pudo cargar el cuadre");
    } finally {
      setCuadreLoading(false);
    }
  }

  function abrirCuadre() {
    setCuadreData(null);
    setCuadreError(null);
    setShowCuadre(true);
  }

  async function handleExportarRango() {
    setExportLoading(true);
    setExportError(null);
    try {
      const qs = new URLSearchParams({ desde: exportDesde, hasta: exportHasta, pageSize: "2000" });
      if (exportAlmacen) qs.set("idalmacen", exportAlmacen);
      const resp = await api.get(`/api/inventario/ventas?${qs}`);
      const rows: any[] = resp.rows;
      const planas = rows.map((r) => ({
        No: r.noconsecutivo,
        Fecha: new Date(r.fecha).toLocaleString(),
        "Punto de venta": almacenNombre(r.idalmacen),
        Total: totalDe(r).toFixed(2),
        Estado: r.anulada ? "Anulada" : "Activa",
        Nota: r.nota ?? "",
      }));
      if (planas.length === 0) {
        setExportError("No hay ventas en ese rango de fechas");
        return;
      }
      exportCsv(`ventas_${exportDesde}_a_${exportHasta}.csv`, planas);
      setShowExportar(false);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "No se pudo exportar");
    } finally {
      setExportLoading(false);
    }
  }

  return (
    <div>
      {/* Áreas abiertas en simultáneo para el punto de venta elegido */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-toolbar">
          <h2>Caja</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ fontSize: 13, color: "var(--text-muted)" }}>Punto de venta</label>
            <select value={idalmacenCaja} onChange={(e) => setIdalmacenCaja(e.target.value)}>
              {puntosVenta.length === 0 && <option value="">Sin puntos de venta</option>}
              {puntosVenta.map((a: any) => (
                <option key={a.idalmacen} value={a.idalmacen}>
                  {a.almacen}
                </option>
              ))}
            </select>
          </div>
        </div>

        {puntosVenta.length === 0 ? (
          <div className="error-box" style={{ margin: 12 }}>
            No hay ningún almacén marcado como "Punto de venta". Ve a Almacenes y marca uno.
          </div>
        ) : (
          idalmacenCaja && (
            <div style={{ padding: 16 }}>
              <AreaTabsCaja
                idalmacen={Number(idalmacenCaja)}
                areas={areas}
                productos={productos}
                monedas={monedas}
                almacenes={almacenes}
                existencias={existencias}
                puedeInventario={puedeInventario}
                proximoNoVale={proximoNoVale}
                onVentaCreada={() => {
                  cargar();
                  cargarProximoNoVale();
                  recargarExistencias();
                }}
              />
            </div>
          )
        )}
      </div>

      {/* Historial de ventas + reportes */}
      <div className="panel">
        <div className="panel-toolbar">
          <h2>Ventas registradas</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary" onClick={abrirCuadre}>
              Cuadre X Productos
            </button>
            <button className="btn btn-secondary" onClick={() => setShowExportar(true)}>
              Exportar por fecha
            </button>
            <button className="btn btn-secondary" onClick={() => exportCsv("ventas.csv", data)}>
              Exportar CSV
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Desde</label>
          <input
            type="date"
            value={filtroDesde}
            onChange={(e) => {
              setPage(1);
              setFiltroDesde(e.target.value);
            }}
          />
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Hasta</label>
          <input
            type="date"
            value={filtroHasta}
            onChange={(e) => {
              setPage(1);
              setFiltroHasta(e.target.value);
            }}
          />
          <select
            value={filtroAlmacen}
            onChange={(e) => {
              setPage(1);
              setFiltroAlmacen(e.target.value);
            }}
          >
            <option value="">Todos los puntos de venta</option>
            {puntosVenta.map((a: any) => (
              <option key={a.idalmacen} value={a.idalmacen}>
                {a.almacen}
              </option>
            ))}
          </select>
          <select
            value={filtroEstado}
            onChange={(e) => {
              setPage(1);
              setFiltroEstado(e.target.value);
            }}
          >
            <option value="">Activas y anuladas</option>
            <option value="false">Solo activas</option>
            <option value="true">Solo anuladas</option>
          </select>
          <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted)" }}>
            Página {page} de {totalPaginas} — {total} ventas
          </span>
          <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={{ width: "auto" }}>
            ‹
          </button>
          <button className="btn btn-secondary" disabled={page >= totalPaginas} onClick={() => setPage((p) => p + 1)} style={{ width: "auto" }}>
            ›
          </button>
        </div>

        {error && <div className="error-box" style={{ margin: 12 }}>{error}</div>}

        <DataGrid
          rows={data.map((r: any) => ({ ...r, total: totalDe(r), almacenNombre: almacenNombre(r.idalmacen) }))}
          loading={loading}
          pageSizeDefault={PAGE_SIZE}
          rowKey={(r: any) => r.idvalesalida}
          emptyLabel="No hay ventas registradas"
          contextActions={[
            {
              label: "Re-Imprimir Vale",
              onClick: (r: any) => setReciboVenta(r),
            },
            {
              label: "Anular",
              danger: true,
              show: (r: any) => !r.anulada,
              onClick: handleAnular,
            },
          ]}
          columns={[
            { key: "noconsecutivo", label: "No.", type: "number", footer: "none" },
            { key: "fecha", label: "Fecha", type: "date", render: (r: any) => new Date(r.fecha).toLocaleString() },
            { key: "almacenNombre", label: "Punto de venta" },
            { key: "total", label: "Total", type: "number", render: (r: any) => Number(r.total).toFixed(2) },
            {
              key: "anulada",
              label: "Estado",
              type: "boolean",
              footer: "none",
              render: (r: any) =>
                r.anulada ? <span className="badge badge-off">Anulada</span> : <span className="badge badge-ok">Activa</span>,
            },
          ]}
        />
      </div>

      {reciboVenta && (
        <Modal title={`Vale No. ${reciboVenta.noconsecutivo}`} onClose={() => setReciboVenta(null)}>
          <div className="receipt-print">
            <div className="receipt-header">
              <div>Vale No. {reciboVenta.noconsecutivo}</div>
              <div>{new Date(reciboVenta.fecha).toLocaleString()}</div>
              <div>{almacenNombre(reciboVenta.idalmacen)}</div>
              {reciboVenta.anulada && <div className="badge badge-off">ANULADA</div>}
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
                {(reciboVenta.detalle ?? []).map((l: any, i: number) => (
                  <tr key={i}>
                    <td>{productoNombre(l.idproducto)}</td>
                    <td>{Number(l.cantidad).toFixed(2)}</td>
                    <td>{Number(l.pventa).toFixed(2)}</td>
                    <td>{(Number(l.cantidad) * Number(l.pventa)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {reciboVenta.cuentaCasa && <div className="badge badge-off" style={{ marginBottom: 8 }}>CUENTA CASA</div>}
            {reciboVenta.promocion && (
              <div className="receipt-nota">Promoción aplicada: {Number(reciboVenta.promocionPorcentaje ?? 0).toFixed(2)}%</div>
            )}
            {reciboVenta.masDiezPorciento && <div className="receipt-nota">Incluye recargo del 10%</div>}
            <div className="receipt-total">Total: {totalDe(reciboVenta).toFixed(2)}</div>
            <div className="receipt-pagos">
              {(reciboVenta.pagos ?? []).map((p: any, i: number) => (
                <div key={i}>
                  {p.esTransferencia ? "Transferencia" : "Efectivo"} — {monedaNombre(p.idmoneda)}: {Number(p.importe).toFixed(2)} (tc{" "}
                  {Number(p.tc).toFixed(4)})
                </div>
              ))}
              {reciboVenta.vuelto != null && Number(reciboVenta.vuelto) !== 0 && (
                <div style={{ fontWeight: 700 }}>Vuelto: {Number(reciboVenta.vuelto).toFixed(2)}</div>
              )}
            </div>
            {reciboVenta.nota && <div className="receipt-nota">Nota: {reciboVenta.nota}</div>}
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setReciboVenta(null)}>
              Cerrar
            </button>
            <button type="button" className="btn btn-primary" style={{ width: "auto" }} onClick={() => window.print()}>
              Imprimir
            </button>
          </div>
        </Modal>
      )}

      {showCuadre && (
        <Modal title="Cuadre X Productos" onClose={() => setShowCuadre(false)} wide>
          <div className="form-grid">
            <div className="field">
              <label>Fecha</label>
              <input type="date" value={cuadreFecha} onChange={(e) => setCuadreFecha(e.target.value)} />
            </div>
            <div className="field">
              <label>Punto de venta (opcional)</label>
              <select value={cuadreAlmacen} onChange={(e) => setCuadreAlmacen(e.target.value)}>
                <option value="">Todos</option>
                {puntosVenta.map((a: any) => (
                  <option key={a.idalmacen} value={a.idalmacen}>
                    {a.almacen}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button className="btn btn-primary" style={{ width: "auto" }} onClick={cargarCuadre} disabled={cuadreLoading}>
            {cuadreLoading ? "Calculando…" : "Calcular"}
          </button>

          {cuadreError && <div className="error-box" style={{ marginTop: 12 }}>{cuadreError}</div>}

          {cuadreData && (
            <>
              <table className="data-grid" style={{ marginTop: 16 }}>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {cuadreData.productos.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                        No hay ventas en esta fecha
                      </td>
                    </tr>
                  ) : (
                    cuadreData.productos.map((p: any) => (
                      <tr key={p.idproducto}>
                        <td>{p.producto}</td>
                        <td>{Number(p.cantidad).toFixed(2)}</td>
                        <td>{Number(p.importe).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className="total-line">Total: {Number(cuadreData.totalImporte).toFixed(2)}</div>
              {cuadreData.productos.length > 0 && (
                <button
                  className="btn btn-secondary"
                  style={{ marginTop: 8 }}
                  onClick={() =>
                    exportCsv(
                      `cuadre_productos_${cuadreFecha}.csv`,
                      cuadreData.productos.map((p: any) => ({
                        Producto: p.producto,
                        Referencia: p.referencia ?? "",
                        Cantidad: p.cantidad,
                        Importe: p.importe,
                      }))
                    )
                  }
                >
                  Exportar CSV
                </button>
              )}
            </>
          )}
        </Modal>
      )}

      {showExportar && (
        <Modal title="Exportar Ventas por rango de fecha" onClose={() => setShowExportar(false)}>
          {exportError && <div className="error-box">{exportError}</div>}
          <div className="form-grid">
            <div className="field">
              <label>Desde</label>
              <input type="date" value={exportDesde} onChange={(e) => setExportDesde(e.target.value)} />
            </div>
            <div className="field">
              <label>Hasta</label>
              <input type="date" value={exportHasta} onChange={(e) => setExportHasta(e.target.value)} />
            </div>
            <div className="field span-2">
              <label>Punto de venta (opcional)</label>
              <select value={exportAlmacen} onChange={(e) => setExportAlmacen(e.target.value)}>
                <option value="">Todos</option>
                {puntosVenta.map((a: any) => (
                  <option key={a.idalmacen} value={a.idalmacen}>
                    {a.almacen}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setShowExportar(false)}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" style={{ width: "auto" }} onClick={handleExportarRango} disabled={exportLoading}>
              {exportLoading ? "Exportando…" : "Exportar"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
