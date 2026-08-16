import { useState } from "react";
import VentasPanel from "../inventario/VentasPanel";
import CierreCajaPanel from "../inventario/CierreCajaPanel";
import type { SessionPayload } from "@/lib/auth";

interface CajaModuleProps {
  permisos: SessionPayload["permisos"];
  administrador: boolean;
}

// Módulo "Caja", separado de Inventario (igual que en el sistema de
// escritorio): vales de salida + cobro en varias monedas, y cierre diario
// de caja (extracciones, cuadre, marcar el día como cerrado).
const SECCIONES = [
  { key: "ventas", label: "Ventas" },
  { key: "cierre", label: "Cierre de Caja" },
] as const;

export default function CajaModule({ permisos, administrador }: CajaModuleProps) {
  const [activa, setActiva] = useState<(typeof SECCIONES)[number]["key"]>("ventas");
  // Los tres atajos de Caja (Recepcionar/Transferir/Porcionar) solo se
  // habilitan si el cajero también tiene Inventario — igual que en
  // Caja_Load (`.Enabled = Program.Inventario`) en el sistema original.
  const puedeInventario = administrador || !!permisos.inventario;

  return (
    <div>
      <div className="sub-tabs">
        {SECCIONES.map((s) => (
          <button key={s.key} className={activa === s.key ? "active" : ""} onClick={() => setActiva(s.key)}>
            {s.label}
          </button>
        ))}
      </div>
      {activa === "ventas" && <VentasPanel puedeInventario={puedeInventario} />}
      {activa === "cierre" && <CierreCajaPanel />}
    </div>
  );
}
