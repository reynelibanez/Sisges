import { useState } from "react";

export interface LineaProducto {
  idproducto: string;
  producto: string;
  cantidad: string;
  costo: string;
  venta: string;
}

interface Props {
  productos: any[];
  lineas: LineaProducto[];
  onChange: (lineas: LineaProducto[]) => void;
  costoLabel?: string;
  ventaLabel?: string;
  /** Cuando el documento ya quedó fijo (inventariado), no se puede seguir editando. */
  disabled?: boolean;
  /**
   * Texto de la opción vacía del selector — quien use el componente ya
   * filtra `productos` según corresponda (p. ej. solo con existencia en el
   * almacén elegido), así que puede aprovechar este texto para explicar
   * por qué la lista está corta o vacía ("Selecciona un almacén primero",
   * "Sin existencia en este almacén"…).
   */
  placeholder?: string;
}

/**
 * Selector de producto + cantidad/precio + botón "Agregar" que arma una
 * tabla debajo — el mismo patrón "entrada + tabla" que ya usa Caja, para
 * que Recepciones/Transferencias/Vales de Salida se vean y se sientan
 * igual (antes cada modal tenía una fila editable por línea, sin
 * encabezados claros ni autocompletado de precio al elegir el producto).
 */
export default function LineasProductoEditor({
  productos,
  lineas,
  onChange,
  costoLabel = "Costo",
  ventaLabel = "Venta",
  disabled = false,
  placeholder = "Selecciona un producto…",
}: Props) {
  const [entryIdproducto, setEntryIdproducto] = useState("");
  const [entryCantidad, setEntryCantidad] = useState("1");
  const [entryCosto, setEntryCosto] = useState("0");
  const [entryVenta, setEntryVenta] = useState("0");

  function elegirProducto(id: string) {
    setEntryIdproducto(id);
    const p = productos.find((x: any) => String(x.idproducto) === id);
    if (p) {
      setEntryCosto(String(p.pcosto));
      setEntryVenta(String(p.pventa));
    }
  }

  function agregar() {
    const producto = productos.find((p: any) => String(p.idproducto) === entryIdproducto);
    if (!producto || !Number(entryCantidad)) return;
    onChange([
      ...lineas,
      {
        idproducto: entryIdproducto,
        producto: producto.producto,
        cantidad: entryCantidad,
        costo: entryCosto,
        venta: entryVenta,
      },
    ]);
    setEntryCantidad("1");
  }

  const total = lineas.reduce((acc, l) => acc + (Number(l.cantidad) || 0) * (Number(l.venta) || 0), 0);

  return (
    <div>
      {!disabled && (
        <div className="caja-entry" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr auto" }}>
          <div className="field span-2">
            <label>Producto</label>
            <select value={entryIdproducto} onChange={(e) => elegirProducto(e.target.value)} disabled={productos.length === 0}>
              <option value="">{placeholder}</option>
              {productos.map((p: any) => (
                <option key={p.idproducto} value={p.idproducto}>
                  {p.producto}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Cantidad</label>
            <input type="number" min="0" step="0.01" value={entryCantidad} onChange={(e) => setEntryCantidad(e.target.value)} />
          </div>
          <div className="field">
            <label>{costoLabel}</label>
            <input type="number" min="0" step="0.01" value={entryCosto} onChange={(e) => setEntryCosto(e.target.value)} />
          </div>
          <div className="field">
            <label>{ventaLabel}</label>
            <input type="number" min="0" step="0.01" value={entryVenta} onChange={(e) => setEntryVenta(e.target.value)} />
          </div>
          <div className="field caja-entry-add">
            <label>&nbsp;</label>
            <button type="button" className="btn btn-primary" onClick={agregar}>
              + Agregar
            </button>
          </div>
        </div>
      )}

      <table className="data-grid caja-cart-table">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Cant.</th>
            <th>{costoLabel}</th>
            <th>{ventaLabel}</th>
            <th>Importe</th>
            {!disabled && <th></th>}
          </tr>
        </thead>
        <tbody>
          {lineas.length === 0 ? (
            <tr>
              <td colSpan={disabled ? 5 : 6} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                Sin productos agregados
              </td>
            </tr>
          ) : (
            lineas.map((l, i) => (
              <tr key={i}>
                <td>{l.producto}</td>
                <td>{Number(l.cantidad).toFixed(2)}</td>
                <td>{Number(l.costo).toFixed(2)}</td>
                <td>{Number(l.venta).toFixed(2)}</td>
                <td>{(Number(l.cantidad) * Number(l.venta)).toFixed(2)}</td>
                {!disabled && (
                  <td>
                    <button type="button" className="btn btn-secondary" onClick={() => onChange(lineas.filter((_, idx) => idx !== i))}>
                      ✕
                    </button>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div className="total-line">Total: {total.toFixed(2)}</div>
    </div>
  );
}
