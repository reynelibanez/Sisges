import { useEffect, useState } from "react";
import { api } from "@/lib/useApi";
import CajaAccionesRapidas from "./CajaAccionesRapidas";

interface LineaCarrito {
  idproducto: number;
  producto: string;
  cantidad: number;
  preciocosto: number;
  pventa: number;
}
interface Pago {
  idmoneda: string;
  tc: string;
  importe: string;
}

const pagoVacio: Pago = { idmoneda: "", tc: "1", importe: "0" };

interface Carrito {
  lineas: LineaCarrito[];
  // Checkboxes de CobrarVale() en el Caja.cs original.
  cuentaCasa: boolean;
  promocion: boolean;
  promocionPorcentaje: string;
  masDiezPorciento: boolean;
  transferenciaHabilitada: boolean;
  // Campo primario Efectivo/Transferencia (moneda local, igual que
  // txtefectivo/txttransfer en el original). Los pagos en otras monedas
  // son un flujo aparte, secundario (equivalente a AgregarMonedasVale()).
  efectivo: string;
  transferMonto: string;
  pagosExtra: Pago[];
  mostrarPagosExtra: boolean;
  nota: string;
  // Campos del "formulario de alta" del producto (equivalente a
  // txtproductosVentas/txtcantidad/txtpventa antes de AgregarProductosVale()).
  entryIdproducto: string;
  entryCantidad: string;
  entryPventa: string;
}

function carritoVacio(): Carrito {
  return {
    lineas: [],
    cuentaCasa: false,
    promocion: false,
    promocionPorcentaje: "10",
    masDiezPorciento: false,
    transferenciaHabilitada: false,
    efectivo: "",
    transferMonto: "0",
    pagosExtra: [],
    mostrarPagosExtra: false,
    nota: "",
    entryIdproducto: "",
    entryCantidad: "1",
    entryPventa: "0",
  };
}

interface Props {
  idalmacen: number;
  areas: any[];
  productos: any[];
  monedas: any[];
  almacenes: any[];
  existencias: any[];
  puedeInventario: boolean;
  proximoNoVale: number | null;
  onVentaCreada: () => void;
}

/**
 * Áreas abiertas en simultáneo — reemplaza la modal única "Nueva venta" por
 * el patrón del sistema de escritorio (AreaCaja.cs + Caja.cs): cada área
 * (mesa/salón) tiene su propia pestaña con un pedido en curso, todas
 * abiertas al mismo tiempo, sin perder lo que se lleva cargado en cada una
 * al cambiar de pestaña. Cerrar una pestaña solo la oculta (como el
 * xtraTabControl1_CloseButtonClick original); se puede reabrir con "+".
 *
 * La lógica de cobro reproduce CobrarVale() del Caja.cs original: Cuenta
 * Casa, Promoción (% de descuento) y Más el 10% (recargo) se calculan en el
 * servidor exactamente igual que allá — ver POST /api/inventario/ventas.
 */
export default function AreaTabsCaja({
  idalmacen,
  areas,
  productos,
  monedas,
  almacenes,
  existencias,
  puedeInventario,
  proximoNoVale,
  onVentaCreada,
}: Props) {
  const [openAreaIds, setOpenAreaIds] = useState<number[]>([]);
  const [activeAreaId, setActiveAreaId] = useState<number | null>(null);
  const [carritos, setCarritos] = useState<Record<number, Carrito>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showReabrir, setShowReabrir] = useState(false);

  // Al cargar las áreas (una sola vez / cuando cambian), abrir todas las
  // pestañas, igual que AreaCaja_Load recorriendo NG_Areas.
  useEffect(() => {
    if (areas.length === 0) return;
    setOpenAreaIds((prev) => (prev.length === 0 ? areas.map((a: any) => a.idarea) : prev));
    setActiveAreaId((prev) => prev ?? areas[0]?.idarea ?? null);
  }, [areas]);

  function carritoDe(idarea: number): Carrito {
    return carritos[idarea] ?? carritoVacio();
  }

  function actualizarCarrito(idarea: number, cambios: Partial<Carrito>) {
    setCarritos((prev) => ({ ...prev, [idarea]: { ...carritoDe(idarea), ...cambios } }));
  }

  function cerrarPestana(idarea: number) {
    setOpenAreaIds((prev) => prev.filter((id) => id !== idarea));
    if (activeAreaId === idarea) {
      const restante = openAreaIds.filter((id) => id !== idarea);
      setActiveAreaId(restante[0] ?? null);
    }
  }

  function reabrirPestana(idarea: number) {
    setOpenAreaIds((prev) => (prev.includes(idarea) ? prev : [...prev, idarea]));
    setActiveAreaId(idarea);
    setShowReabrir(false);
  }

  // Existencia disponible de un producto en el punto de venta actual,
  // descontando lo que ya está en el carrito de esta área — igual que
  // CargarExistenciasVale() en el original (existencia real menos lo que ya
  // se agregó a la cuenta, para no vender más de lo que hay).
  function existenciaFila(idproducto: number) {
    return existencias.find((e: any) => e.idalmacen === idalmacen && e.idproducto === idproducto);
  }
  function existenciaDisponible(carrito: Carrito, idproducto: number) {
    const fila = existenciaFila(idproducto);
    if (!fila) return null; // sin registro de existencia en este almacén: no se bloquea
    const enCarrito = carrito.lineas.filter((l) => l.idproducto === idproducto).reduce((acc, l) => acc + l.cantidad, 0);
    return Number(fila.saldo) - enCarrito;
  }

  // El selector de productos depende del punto de venta elegido y solo
  // ofrece lo que ya tiene existencia ahí — igual que AgregarProducto en el
  // Caja.cs original ("SELECT * FROM ConsultaExistencia WHERE idalmacen=...
  // AND Saldo > 0"): no tiene sentido dejar elegir algo que no hay.
  const productosDisponibles = productos.filter((p: any) => {
    const fila = existenciaFila(p.idproducto);
    return fila && Number(fila.saldo) > 0;
  });

  function elegirProductoEntry(idarea: number, idproductoStr: string) {
    const producto = productos.find((p: any) => String(p.idproducto) === idproductoStr);
    actualizarCarrito(idarea, {
      entryIdproducto: idproductoStr,
      entryPventa: producto ? String(producto.pventa) : "0",
      entryCantidad: "1",
    });
  }

  function agregarProducto(idarea: number) {
    const carrito = carritoDe(idarea);
    const producto = productos.find((p: any) => String(p.idproducto) === carrito.entryIdproducto);
    const cantidad = Number(carrito.entryCantidad);
    const pventa = Number(carrito.entryPventa);
    setFormError(null);
    if (!producto) {
      setFormError("Selecciona un producto");
      return;
    }
    if (!cantidad || cantidad <= 0) {
      setFormError("La cantidad debe ser mayor que cero");
      return;
    }
    const disponible = existenciaDisponible(carrito, producto.idproducto);
    if (disponible !== null && cantidad > disponible) {
      setFormError(`Existencia insuficiente: quedan ${disponible.toFixed(2)} de ${producto.producto}`);
      return;
    }
    const lineas = [
      ...carrito.lineas,
      { idproducto: producto.idproducto, producto: producto.producto, cantidad, preciocosto: Number(producto.pcosto), pventa },
    ];
    actualizarCarrito(idarea, { lineas, entryCantidad: "1" });
  }

  function quitarLinea(idarea: number, i: number) {
    const carrito = carritoDe(idarea);
    actualizarCarrito(idarea, { lineas: carrito.lineas.filter((_, idx) => idx !== i) });
  }

  function actualizarPagoExtra(idarea: number, i: number, campo: keyof Pago, valor: string) {
    const carrito = carritoDe(idarea);
    const pagosExtra = carrito.pagosExtra.map((p, idx) => {
      if (idx !== i) return p;
      // Al elegir la moneda se autocompleta la tasa de cambio configurada
      // en Monedas (ng_monedas.tc), igual que Program.TablaMonedas en el
      // original — el cajero ya no tiene que recordarla/escribirla a mano,
      // aunque puede corregirla si ese día cambia.
      if (campo === "idmoneda") {
        const moneda = monedas.find((m: any) => String(m.idmoneda) === valor);
        return { ...p, idmoneda: valor, tc: moneda ? String(moneda.tc) : p.tc };
      }
      return { ...p, [campo]: valor };
    });
    actualizarCarrito(idarea, { pagosExtra });
  }

  const areasAbiertas = areas.filter((a: any) => openAreaIds.includes(a.idarea));
  const areasCerradas = areas.filter((a: any) => !openAreaIds.includes(a.idarea));
  const activa = areas.find((a: any) => a.idarea === activeAreaId);
  const carrito = activeAreaId ? carritoDe(activeAreaId) : carritoVacio();

  // Mismo cálculo que hace el servidor en POST /api/inventario/ventas —
  // se muestra en pantalla para que el cajero vea el total antes de cobrar.
  const totalBruto = carrito.lineas.reduce((acc, l) => acc + l.cantidad * l.pventa, 0);
  const promocionPct = Number(carrito.promocionPorcentaje) || 0;
  const factor = carrito.cuentaCasa ? 0 : carrito.promocion ? Math.max(0, 1 - promocionPct / 100) : 1;
  const totalNeto = totalBruto * factor;
  const totalACobrar = carrito.cuentaCasa ? 0 : carrito.masDiezPorciento ? totalNeto * 1.1 : totalNeto;
  const pagosExtraTotal = carrito.pagosExtra
    .filter((p) => p.idmoneda)
    .reduce((acc, p) => acc + (Number(p.importe) || 0) * (Number(p.tc) || 1), 0);
  const transferAporte = carrito.transferenciaHabilitada ? Number(carrito.transferMonto) || 0 : 0;
  const totalPagado = (Number(carrito.efectivo) || 0) + transferAporte + pagosExtraTotal;
  // Redondeado a centavos antes de comparar/mostrar — si no, errores de
  // punto flotante hacen que un pago exacto se vea como "-0.00" en rojo.
  const vuelto = Math.round((totalPagado - totalACobrar) * 100) / 100;

  async function handleCobrar(e: React.FormEvent) {
    e.preventDefault();
    if (!activeAreaId) return;
    if (carrito.lineas.length === 0) {
      setFormError("Agrega al menos un producto");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const pagos: { idmoneda: number; tc: number; importe: number; esTransferencia: boolean }[] = [];
      const monedaLocal = monedas[0];
      if (!carrito.cuentaCasa) {
        if (Number(carrito.efectivo) > 0) {
          if (!monedaLocal) throw new Error("Configura al menos una moneda antes de cobrar");
          pagos.push({ idmoneda: monedaLocal.idmoneda, tc: 1, importe: Number(carrito.efectivo), esTransferencia: false });
        }
        if (transferAporte > 0) {
          if (!monedaLocal) throw new Error("Configura al menos una moneda antes de cobrar");
          pagos.push({ idmoneda: monedaLocal.idmoneda, tc: 1, importe: transferAporte, esTransferencia: true });
        }
        for (const p of carrito.pagosExtra) {
          if (!p.idmoneda || !Number(p.importe)) continue;
          pagos.push({ idmoneda: Number(p.idmoneda), tc: Number(p.tc) || 1, importe: Number(p.importe), esTransferencia: false });
        }
        if (pagos.length === 0) {
          setFormError("Agrega al menos una forma de pago");
          setSaving(false);
          return;
        }
      }

      await api.post("/api/inventario/ventas", {
        idalmacen,
        nota: carrito.nota,
        cuentaCasa: carrito.cuentaCasa,
        promocion: carrito.promocion,
        promocionPorcentaje: promocionPct,
        masDiezPorciento: carrito.masDiezPorciento,
        detalle: carrito.lineas.map((l) => ({
          idproducto: l.idproducto,
          idarea: activeAreaId,
          cantidad: l.cantidad,
          preciocosto: l.preciocosto,
          pventa: l.pventa,
        })),
        pagos,
      });
      // Al cobrar se limpia el pedido de esa área, pero la pestaña queda
      // abierta lista para el próximo pedido (igual que en el sistema de
      // escritorio, donde cada área sigue disponible después de cobrar).
      actualizarCarrito(activeAreaId, carritoVacio());
      onVentaCreada();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo cobrar");
    } finally {
      setSaving(false);
    }
  }

  if (areas.length === 0) {
    return (
      <div className="error-box" style={{ margin: 12 }}>
        No hay áreas configuradas. Ve a Áreas y crea al menos una (salón, mesa, barra, etc.).
      </div>
    );
  }

  return (
    <div className="area-caja">
      <div className="area-tabs">
        {areasAbiertas.map((a: any) => (
          <div key={a.idarea} className={`area-tab ${activeAreaId === a.idarea ? "active" : ""}`}>
            <button className="area-tab-label" onClick={() => setActiveAreaId(a.idarea)}>
              {a.area}
              {carritoDe(a.idarea).lineas.length > 0 && <span className="area-tab-dot" />}
            </button>
            <button
              className="area-tab-close"
              title="Cerrar pestaña"
              onClick={(e) => {
                e.stopPropagation();
                cerrarPestana(a.idarea);
              }}
            >
              ✕
            </button>
          </div>
        ))}
        <div style={{ position: "relative" }}>
          <button
            className="area-tab-add"
            title="Reabrir área"
            onClick={() => setShowReabrir((v) => !v)}
            disabled={areasCerradas.length === 0}
          >
            +
          </button>
          {showReabrir && areasCerradas.length > 0 && (
            <div className="context-menu" style={{ position: "absolute", top: "100%", left: 0 }}>
              {areasCerradas.map((a: any) => (
                <button key={a.idarea} onClick={() => reabrirPestana(a.idarea)}>
                  {a.area}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {activa && (
        <form className="area-tab-body caja-pos" onSubmit={handleCobrar}>
          <div className="caja-pos-header">
            <span className="caja-novale">No. Vale: {proximoNoVale ?? "—"}</span>
            <span className="caja-area-actual">Área: {activa.area}</span>
          </div>

          {formError && <div className="error-box">{formError}</div>}

          {/* Alta de producto — equivalente a txtproductosVentas + txtexistencia +
              txtcantidad + txtpventa + "Agregar" (AgregarProductosVale) */}
          <div className="caja-entry">
            <div className="field span-2">
              <label>Producto</label>
              <select
                value={carrito.entryIdproducto}
                onChange={(e) => elegirProductoEntry(activeAreaId!, e.target.value)}
                disabled={productosDisponibles.length === 0}
              >
                <option value="">
                  {productosDisponibles.length === 0 ? "Sin existencia en este punto de venta" : "Selecciona un producto…"}
                </option>
                {productosDisponibles.map((p: any) => (
                  <option key={p.idproducto} value={p.idproducto}>
                    {p.producto}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Existencia</label>
              <input
                readOnly
                value={
                  carrito.entryIdproducto
                    ? (() => {
                        const d = existenciaDisponible(carrito, Number(carrito.entryIdproducto));
                        return d === null ? "—" : d.toFixed(2);
                      })()
                    : "—"
                }
              />
            </div>
            <div className="field">
              <label>Cantidad</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={carrito.entryCantidad}
                onChange={(e) => actualizarCarrito(activeAreaId!, { entryCantidad: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Precio</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={carrito.entryPventa}
                onChange={(e) => actualizarCarrito(activeAreaId!, { entryPventa: e.target.value })}
              />
            </div>
            <div className="field caja-entry-add">
              <label>&nbsp;</label>
              <button type="button" className="btn btn-primary" onClick={() => agregarProducto(activeAreaId!)}>
                + Agregar
              </button>
            </div>
          </div>

          <table className="data-grid caja-cart-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cant.</th>
                <th>Precio</th>
                <th>Importe</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {carrito.lineas.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                    Sin productos agregados
                  </td>
                </tr>
              ) : (
                carrito.lineas.map((l, i) => (
                  <tr key={i}>
                    <td>{l.producto}</td>
                    <td>{l.cantidad.toFixed(2)}</td>
                    <td>{l.pventa.toFixed(2)}</td>
                    <td>{(l.cantidad * l.pventa).toFixed(2)}</td>
                    <td>
                      <button type="button" className="btn btn-secondary" onClick={() => quitarLinea(activeAreaId!, i)}>
                        ✕
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Checkboxes de CobrarVale(): Cuenta Casa / Promoción / Más el 10% */}
          <div className="caja-checks">
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={carrito.cuentaCasa}
                onChange={(e) => actualizarCarrito(activeAreaId!, { cuentaCasa: e.target.checked })}
              />
              Cuenta Casa
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={carrito.promocion}
                disabled={carrito.cuentaCasa}
                onChange={(e) => actualizarCarrito(activeAreaId!, { promocion: e.target.checked })}
              />
              Promoción
            </label>
            {carrito.promocion && !carrito.cuentaCasa && (
              <input
                className="caja-promo-pct"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={carrito.promocionPorcentaje}
                onChange={(e) => actualizarCarrito(activeAreaId!, { promocionPorcentaje: e.target.value })}
              />
            )}
            {carrito.promocion && !carrito.cuentaCasa && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>%</span>}
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={carrito.masDiezPorciento}
                disabled={carrito.cuentaCasa}
                onChange={(e) => actualizarCarrito(activeAreaId!, { masDiezPorciento: e.target.checked })}
              />
              Más el 10%
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={carrito.transferenciaHabilitada}
                disabled={carrito.cuentaCasa}
                onChange={(e) => actualizarCarrito(activeAreaId!, { transferenciaHabilitada: e.target.checked })}
              />
              Pago por Transferencia
            </label>
          </div>

          <div className="caja-resumen">
            {carrito.cuentaCasa ? (
              <div className="total-line">Cuenta Casa — no genera cobro (Total original: {totalBruto.toFixed(2)})</div>
            ) : (
              <>
                {carrito.promocion && (
                  <div className="caja-resumen-linea">
                    Subtotal: {totalBruto.toFixed(2)} — Descuento {promocionPct}%: -{(totalBruto - totalNeto).toFixed(2)}
                  </div>
                )}
                {carrito.masDiezPorciento && <div className="caja-resumen-linea">Más 10%: +{(totalACobrar - totalNeto).toFixed(2)}</div>}
                <div className="total-line">Total a cobrar: {totalACobrar.toFixed(2)}</div>
              </>
            )}
          </div>

          {!carrito.cuentaCasa && (
            <div className="caja-pago">
              <div className="field">
                <label>
                  Efectivo{" "}
                  <button
                    type="button"
                    className="btn-link"
                    style={{ fontSize: 11 }}
                    onClick={() => actualizarCarrito(activeAreaId!, { efectivo: Math.max(0, totalACobrar - transferAporte).toFixed(2) })}
                  >
                    usar total
                  </button>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={carrito.efectivo}
                  placeholder={totalACobrar > 0 ? totalACobrar.toFixed(2) : "0.00"}
                  onChange={(e) => actualizarCarrito(activeAreaId!, { efectivo: e.target.value })}
                />
              </div>
              {carrito.transferenciaHabilitada && (
                <div className="field">
                  <label>Monto por Transferencia</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={carrito.transferMonto}
                    onChange={(e) => actualizarCarrito(activeAreaId!, { transferMonto: e.target.value })}
                  />
                </div>
              )}
              <div className="field">
                <label>Vuelto</label>
                <input
                  readOnly
                  value={(vuelto === 0 ? 0 : vuelto).toFixed(2)}
                  style={{ color: vuelto < 0 ? "var(--danger)" : "var(--success)", fontWeight: 700 }}
                />
              </div>
            </div>
          )}

          {!carrito.cuentaCasa && (
            <>
              <button
                type="button"
                className="btn-link"
                onClick={() => actualizarCarrito(activeAreaId!, { mostrarPagosExtra: !carrito.mostrarPagosExtra })}
              >
                {carrito.mostrarPagosExtra ? "Ocultar pago en otra moneda" : "+ Agregar pago en otra moneda"}
              </button>
              {carrito.mostrarPagosExtra && (
                <div style={{ marginTop: 8 }}>
                  {carrito.pagosExtra.map((p, i) => (
                    <div className="linea-row" key={i} style={{ gridTemplateColumns: "1fr 1fr 1fr auto" }}>
                      <select value={p.idmoneda} onChange={(e) => actualizarPagoExtra(activeAreaId!, i, "idmoneda", e.target.value)}>
                        <option value="">Moneda…</option>
                        {monedas.map((m: any) => (
                          <option key={m.idmoneda} value={m.idmoneda}>
                            {m.moneda}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        placeholder="Tasa cambio"
                        value={p.tc}
                        onChange={(e) => actualizarPagoExtra(activeAreaId!, i, "tc", e.target.value)}
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Importe"
                        value={p.importe}
                        onChange={(e) => actualizarPagoExtra(activeAreaId!, i, "importe", e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() =>
                          actualizarCarrito(activeAreaId!, { pagosExtra: carrito.pagosExtra.filter((_, idx) => idx !== i) })
                        }
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => actualizarCarrito(activeAreaId!, { pagosExtra: [...carrito.pagosExtra, { ...pagoVacio }] })}
                  >
                    + Agregar otra moneda
                  </button>
                </div>
              )}
            </>
          )}

          <div className="field" style={{ marginTop: 12 }}>
            <label>Nota</label>
            <input value={carrito.nota} onChange={(e) => actualizarCarrito(activeAreaId!, { nota: e.target.value })} />
          </div>

          <div className="modal-actions" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="btn btn-secondary"
              disabled
              title="Para devolver una venta ya cobrada, ve a Inventario → Vales de Salida y usa &quot;Anular&quot;."
            >
              Devolución
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => actualizarCarrito(activeAreaId!, carritoVacio())}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: "auto" }}>
              {saving ? "Cobrando…" : `Cobrar — ${activa.area}`}
            </button>
          </div>
        </form>
      )}

      <CajaAccionesRapidas
        idalmacen={idalmacen}
        almacenes={almacenes}
        productos={productos}
        puedeInventario={puedeInventario}
        onCambio={onVentaCreada}
      />
    </div>
  );
}
