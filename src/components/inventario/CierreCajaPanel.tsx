import { useEffect, useState } from "react";
import Modal from "@/components/Modal";
import { api, useList } from "@/lib/useApi";

function hoyISO() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

interface Reporte {
  idalmacen: number;
  fecha: string;
  cantidadVentas: number;
  totalVentas: number;
  totalExtracciones: number;
  efectivoEnCaja: number;
  cerrado: boolean;
  cerradoEn: string | null;
  ventasPorProducto: Array<{ idproducto: number; producto: string; cantidad: string; importe: string }>;
  pagosPorMoneda: Array<{ idmoneda: number; moneda: string; importe: string }>;
  extracciones: Array<{ idextraccion: number; importe: string; nota: string | null; creadoEn: string; creadoPor: string | null }>;
  stockAlCierre: Array<{ idproducto: number; producto: string; cantidad: string }>;
}

/**
 * Cierre de Caja del día — reúne lo que en el sistema de escritorio eran
 * tres pantallas separadas (ExtraccionEfectivo, CierreInventario y el
 * reporte final de ventas) en un solo panel por punto de venta + fecha.
 */
export default function CierreCajaPanel() {
  const { data: almacenes } = useList("/api/inventario/almacenes");
  const puntosVenta = almacenes.filter((a: any) => a.pventa);

  const [idalmacen, setIdalmacen] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showExtraccion, setShowExtraccion] = useState(false);
  const [importeExtraccion, setImporteExtraccion] = useState("");
  const [notaExtraccion, setNotaExtraccion] = useState("");
  const [savingExtraccion, setSavingExtraccion] = useState(false);
  const [extraccionError, setExtraccionError] = useState<string | null>(null);
  const [cerrando, setCerrando] = useState(false);

  useEffect(() => {
    if (puntosVenta.length && !idalmacen) {
      setIdalmacen(String(puntosVenta[0].idalmacen));
    }
  }, [puntosVenta, idalmacen]);

  async function cargar() {
    if (!idalmacen || !fecha) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/api/inventario/caja/reporte-final?idalmacen=${idalmacen}&fecha=${fecha}`);
      setReporte(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el reporte");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idalmacen, fecha]);

  function abrirExtraccion() {
    setImporteExtraccion("");
    setNotaExtraccion("");
    setExtraccionError(null);
    setShowExtraccion(true);
  }

  async function handleExtraccion(e: React.FormEvent) {
    e.preventDefault();
    setSavingExtraccion(true);
    setExtraccionError(null);
    try {
      await api.post("/api/inventario/caja/extracciones", {
        idalmacen: Number(idalmacen),
        fecha,
        importe: Number(importeExtraccion),
        nota: notaExtraccion || null,
      });
      setShowExtraccion(false);
      await cargar();
    } catch (e) {
      setExtraccionError(e instanceof Error ? e.message : "No se pudo registrar la extracción");
    } finally {
      setSavingExtraccion(false);
    }
  }

  async function handleCierre() {
    if (!reporte) return;
    if (!confirm(`¿Cerrar la caja del ${fecha}? Esta acción no se puede deshacer.`)) return;
    setCerrando(true);
    try {
      await api.post("/api/inventario/caja/cierre", { idalmacen: Number(idalmacen), fecha });
      await cargar();
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo cerrar la caja");
    } finally {
      setCerrando(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-toolbar">
        <h2>Cierre de Caja</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={idalmacen} onChange={(e) => setIdalmacen(e.target.value)}>
            {puntosVenta.length === 0 && <option value="">Sin puntos de venta</option>}
            {puntosVenta.map((a: any) => (
              <option key={a.idalmacen} value={a.idalmacen}>
                {a.almacen}
              </option>
            ))}
          </select>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {error && <div className="error-box">{error}</div>}
        {loading && <div className="empty-state">Cargando…</div>}

        {!loading && reporte && (
          <>
            <div className="stat-cards">
              <div className="stat-card">
                <div className="stat-label">Ventas del día</div>
                <div className="stat-value">{reporte.totalVentas.toFixed(2)}</div>
                <div className="stat-sub">{reporte.cantidadVentas} venta(s)</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Extraído</div>
                <div className="stat-value">{reporte.totalExtracciones.toFixed(2)}</div>
                <div className="stat-sub">{reporte.extracciones.length} extracción(es)</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Efectivo en caja</div>
                <div className="stat-value">{reporte.efectivoEnCaja.toFixed(2)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Estado</div>
                <div className="stat-value">
                  {reporte.cerrado ? (
                    <span className="badge badge-off">Cerrado</span>
                  ) : (
                    <span className="badge badge-ok">Abierto</span>
                  )}
                </div>
                {reporte.cerradoEn && <div className="stat-sub">{new Date(reporte.cerradoEn).toLocaleString()}</div>}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
              <button className="btn btn-secondary" onClick={abrirExtraccion} disabled={reporte.cerrado}>
                Extraer efectivo
              </button>
              <button className="btn btn-primary" style={{ width: "auto" }} onClick={handleCierre} disabled={reporte.cerrado || cerrando}>
                {cerrando ? "Cerrando…" : reporte.cerrado ? "Día cerrado" : "Cerrar caja del día"}
              </button>
            </div>

            <h4>Extracciones</h4>
            {reporte.extracciones.length === 0 ? (
              <div className="empty-state">No hay extracciones registradas</div>
            ) : (
              <table className="data-grid">
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Importe</th>
                    <th>Nota</th>
                    <th>Por</th>
                  </tr>
                </thead>
                <tbody>
                  {reporte.extracciones.map((ex) => (
                    <tr key={ex.idextraccion}>
                      <td>{new Date(ex.creadoEn).toLocaleTimeString()}</td>
                      <td>{Number(ex.importe).toFixed(2)}</td>
                      <td>{ex.nota ?? "—"}</td>
                      <td>{ex.creadoPor ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <h4>Reporte final de ventas — por producto</h4>
            {reporte.ventasPorProducto.length === 0 ? (
              <div className="empty-state">No hay ventas en esta fecha</div>
            ) : (
              <table className="data-grid">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {reporte.ventasPorProducto.map((v) => (
                    <tr key={v.idproducto}>
                      <td>{v.producto}</td>
                      <td>{Number(v.cantidad).toFixed(2)}</td>
                      <td>{Number(v.importe).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <h4>Pagos por moneda</h4>
            {reporte.pagosPorMoneda.length === 0 ? (
              <div className="empty-state">Sin pagos registrados</div>
            ) : (
              <table className="data-grid">
                <thead>
                  <tr>
                    <th>Moneda</th>
                    <th>Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {reporte.pagosPorMoneda.map((p) => (
                    <tr key={p.idmoneda}>
                      <td>{p.moneda}</td>
                      <td>{Number(p.importe).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {reporte.cerrado && (
              <>
                <h4>Existencias al cierre</h4>
                {reporte.stockAlCierre.length === 0 ? (
                  <div className="empty-state">Sin existencias registradas</div>
                ) : (
                  <table className="data-grid">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Cantidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reporte.stockAlCierre.map((s) => (
                        <tr key={s.idproducto}>
                          <td>{s.producto}</td>
                          <td>{Number(s.cantidad).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </>
        )}
      </div>

      {showExtraccion && (
        <Modal title="Extraer efectivo de caja" onClose={() => setShowExtraccion(false)}>
          <form onSubmit={handleExtraccion}>
            {extraccionError && <div className="error-box">{extraccionError}</div>}
            <div className="field">
              <label>Importe</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={importeExtraccion}
                onChange={(e) => setImporteExtraccion(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Nota (opcional)</label>
              <input value={notaExtraccion} onChange={(e) => setNotaExtraccion(e.target.value)} />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowExtraccion(false)}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={savingExtraccion} style={{ width: "auto" }}>
                {savingExtraccion ? "Guardando…" : "Extraer"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
