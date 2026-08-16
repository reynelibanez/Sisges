import { useState } from "react";
import Modal from "@/components/Modal";
import { api } from "@/lib/useApi";

interface Props {
  idalmacen: number;
  almacenes: any[];
  productos: any[];
  puedeInventario: boolean;
  onCambio: () => void;
}

/**
 * Los tres botones de acceso rápido del formulario original de Caja
 * (simpleButton21/22/23: "Recepcionar mercancía", "Transferir Mercancía",
 * "Porcionar"), que en Caja.cs solo se habilitan si el cajero también tiene
 * el permiso de Inventario (Caja_Load: `.Enabled = Program.Inventario`).
 * Aquí son versiones rápidas de una sola línea — para recepciones o
 * transferencias con varias líneas, se sigue usando la pantalla completa
 * dentro de Inventario → Documentos.
 */
export default function CajaAccionesRapidas({ idalmacen, almacenes, productos, puedeInventario, onCambio }: Props) {
  const [modal, setModal] = useState<"recepcion" | "transferencia" | "porcionar" | null>(null);

  return (
    <div className="caja-shortcuts">
      <button
        type="button"
        className="btn btn-secondary"
        disabled={!puedeInventario}
        title={puedeInventario ? undefined : "Necesitas el permiso de Inventario para esta acción"}
        onClick={() => setModal("recepcion")}
      >
        Recepcionar mercancía
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={!puedeInventario}
        title={puedeInventario ? undefined : "Necesitas el permiso de Inventario para esta acción"}
        onClick={() => setModal("transferencia")}
      >
        Transferir mercancía
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={!puedeInventario}
        title={puedeInventario ? undefined : "Necesitas el permiso de Inventario para esta acción"}
        onClick={() => setModal("porcionar")}
      >
        Porcionar
      </button>

      {modal === "recepcion" && (
        <RecepcionRapida
          idalmacen={idalmacen}
          productos={productos}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            onCambio();
          }}
        />
      )}
      {modal === "transferencia" && (
        <TransferenciaRapida
          idalmacenOrigenDefault={idalmacen}
          almacenes={almacenes}
          productos={productos}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            onCambio();
          }}
        />
      )}
      {modal === "porcionar" && (
        <PorcionarModal
          idalmacen={idalmacen}
          productos={productos}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            onCambio();
          }}
        />
      )}
    </div>
  );
}

function RecepcionRapida({
  idalmacen,
  productos,
  onClose,
  onSaved,
}: {
  idalmacen: number;
  productos: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [idproducto, setIdproducto] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [pcosto, setPcosto] = useState("0");
  const [pventa, setPventa] = useState("0");
  const [entregadapor, setEntregadapor] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function elegirProducto(id: string) {
    setIdproducto(id);
    const p = productos.find((x: any) => String(x.idproducto) === id);
    if (p) {
      setPcosto(String(p.pcosto));
      setPventa(String(p.pventa));
    }
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!idproducto) return;
    setSaving(true);
    setError(null);
    try {
      await api.post("/api/inventario/recepciones", {
        idalmacen,
        entregadapor,
        nota: "Recepción rápida desde Caja",
        detalle: [{ idproducto: Number(idproducto), cantidad: Number(cantidad), pcosto: Number(pcosto), pventa: Number(pventa) }],
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo recepcionar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Recepcionar mercancía" onClose={onClose}>
      <form onSubmit={guardar}>
        {error && <div className="error-box">{error}</div>}
        <div className="form-grid">
          <div className="field span-2">
            <label>Producto</label>
            <select required value={idproducto} onChange={(e) => elegirProducto(e.target.value)}>
              <option value="">Selecciona…</option>
              {productos.map((p: any) => (
                <option key={p.idproducto} value={p.idproducto}>
                  {p.producto}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Cantidad</label>
            <input type="number" min="0" step="0.01" required value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
          </div>
          <div className="field">
            <label>Entregada por</label>
            <input value={entregadapor} onChange={(e) => setEntregadapor(e.target.value)} />
          </div>
          <div className="field">
            <label>Precio costo</label>
            <input type="number" min="0" step="0.01" value={pcosto} onChange={(e) => setPcosto(e.target.value)} />
          </div>
          <div className="field">
            <label>Precio venta</label>
            <input type="number" min="0" step="0.01" value={pventa} onChange={(e) => setPventa(e.target.value)} />
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: "auto" }}>
            {saving ? "Guardando…" : "Recepcionar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function TransferenciaRapida({
  idalmacenOrigenDefault,
  almacenes,
  productos,
  onClose,
  onSaved,
}: {
  idalmacenOrigenDefault: number;
  almacenes: any[];
  productos: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [origen, setOrigen] = useState(String(idalmacenOrigenDefault));
  const [destino, setDestino] = useState("");
  const [idproducto, setIdproducto] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!idproducto || !destino) return;
    setSaving(true);
    setError(null);
    try {
      const p = productos.find((x: any) => String(x.idproducto) === idproducto);
      await api.post("/api/inventario/transferencias", {
        origen: Number(origen),
        destino: Number(destino),
        nota: "Transferencia rápida desde Caja",
        detalle: [
          {
            idproducto: Number(idproducto),
            cantidad: Number(cantidad),
            preciocosto: Number(p?.pcosto ?? 0),
            pventa: Number(p?.pventa ?? 0),
          },
        ],
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo transferir");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Transferir mercancía" onClose={onClose}>
      <form onSubmit={guardar}>
        {error && <div className="error-box">{error}</div>}
        <div className="form-grid">
          <div className="field">
            <label>Almacén origen</label>
            <select required value={origen} onChange={(e) => setOrigen(e.target.value)}>
              {almacenes.map((a: any) => (
                <option key={a.idalmacen} value={a.idalmacen}>
                  {a.almacen}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Almacén destino</label>
            <select required value={destino} onChange={(e) => setDestino(e.target.value)}>
              <option value="">Selecciona…</option>
              {almacenes
                .filter((a: any) => String(a.idalmacen) !== origen)
                .map((a: any) => (
                  <option key={a.idalmacen} value={a.idalmacen}>
                    {a.almacen}
                  </option>
                ))}
            </select>
          </div>
          <div className="field span-2">
            <label>Producto</label>
            <select required value={idproducto} onChange={(e) => setIdproducto(e.target.value)}>
              <option value="">Selecciona…</option>
              {productos.map((p: any) => (
                <option key={p.idproducto} value={p.idproducto}>
                  {p.producto}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Cantidad</label>
            <input type="number" min="0" step="0.01" required value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: "auto" }}>
            {saving ? "Guardando…" : "Transferir"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface LineaPorcion {
  idproducto: string;
  cantidad: string;
}

function PorcionarModal({
  idalmacen,
  productos,
  onClose,
  onSaved,
}: {
  idalmacen: number;
  productos: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [idproductoOrigen, setIdproductoOrigen] = useState("");
  const [cantidadOrigen, setCantidadOrigen] = useState("1");
  const [destino, setDestino] = useState<LineaPorcion[]>([{ idproducto: "", cantidad: "1" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function actualizarDestino(i: number, campo: keyof LineaPorcion, valor: string) {
    setDestino((prev) => prev.map((l, idx) => (idx === i ? { ...l, [campo]: valor } : l)));
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!idproductoOrigen) return;
    setSaving(true);
    setError(null);
    try {
      await api.post("/api/inventario/porcionar", {
        idalmacen,
        idproductoOrigen: Number(idproductoOrigen),
        cantidadOrigen: Number(cantidadOrigen),
        destino: destino
          .filter((l) => l.idproducto)
          .map((l) => ({ idproducto: Number(l.idproducto), cantidad: Number(l.cantidad) })),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo porcionar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Porcionar" onClose={onClose} wide>
      <form onSubmit={guardar}>
        {error && <div className="error-box">{error}</div>}
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 0 }}>
          Consume una cantidad de un producto (por ejemplo, una tarta entera) y genera una o varias líneas de producto
          producido (las porciones), dentro del mismo almacén.
        </p>
        <h4 style={{ margin: "8px 0" }}>Producto que se consume</h4>
        <div className="form-grid">
          <div className="field span-2">
            <label>Producto origen</label>
            <select required value={idproductoOrigen} onChange={(e) => setIdproductoOrigen(e.target.value)}>
              <option value="">Selecciona…</option>
              {productos.map((p: any) => (
                <option key={p.idproducto} value={p.idproducto}>
                  {p.producto}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Cantidad consumida</label>
            <input type="number" min="0" step="0.01" required value={cantidadOrigen} onChange={(e) => setCantidadOrigen(e.target.value)} />
          </div>
        </div>

        <h4 style={{ margin: "16px 0 8px" }}>Porciones producidas</h4>
        {destino.map((l, i) => (
          <div className="linea-row" key={i}>
            <select value={l.idproducto} onChange={(e) => actualizarDestino(i, "idproducto", e.target.value)}>
              <option value="">Producto…</option>
              {productos.map((p: any) => (
                <option key={p.idproducto} value={p.idproducto}>
                  {p.producto}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Cant."
              value={l.cantidad}
              onChange={(e) => actualizarDestino(i, "cantidad", e.target.value)}
            />
            <button type="button" className="btn btn-secondary" onClick={() => setDestino((prev) => prev.filter((_, idx) => idx !== i))}>
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-secondary" onClick={() => setDestino((prev) => [...prev, { idproducto: "", cantidad: "1" }])}>
          + Agregar porción
        </button>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: "auto" }}>
            {saving ? "Guardando…" : "Porcionar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
