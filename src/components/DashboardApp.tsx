import { useEffect, useState } from "react";
import InventarioModule from "./inventario/InventarioModule";
import CajaModule from "./caja/CajaModule";
import HerramientasModule from "./herramientas/HerramientasModule";
import Icon from "./Icon";
import type { SessionPayload } from "@/lib/auth";

interface DashboardAppProps {
  nombreCompleto: string;
  empresaNombre: string;
  administrador: boolean;
  permisos: SessionPayload["permisos"];
}

// Mismo espíritu que el menú superior por tabs del sistema de escritorio:
// cada tab de arriba es un módulo completo. "Caja" va al lado de
// "Inventario", igual que en el sistema de escritorio (antes eran tabs
// separados del ribbon principal).
const MODULOS = [
  { key: "inventario", label: "Inventario", permiso: "inventario" as const, implementado: true, icon: "inventario" },
  { key: "caja", label: "Caja", permiso: "caja" as const, implementado: true, icon: "caja" },
  { key: "contabilidad", label: "Contabilidad", permiso: "contabilidad" as const, implementado: false, icon: "contabilidad" },
  { key: "personal", label: "Personal", permiso: "personal" as const, implementado: false, icon: "personal" },
  { key: "finanzas", label: "Finanzas", permiso: "finanzas" as const, implementado: false, icon: "finanzas" },
  { key: "facturas", label: "Facturación", permiso: "facturas" as const, implementado: false, icon: "facturas" },
  { key: "herramientas", label: "Herramientas", permiso: "herramientas" as const, implementado: true, icon: "herramientas" },
] as const;

export default function DashboardApp({ nombreCompleto, empresaNombre, administrador, permisos }: DashboardAppProps) {
  const tieneAcceso = (permiso: (typeof MODULOS)[number]["permiso"]) => administrador || permisos[permiso];
  const esAdmin = administrador || permisos.esAdminEmpresa;

  const primerModulo = MODULOS.find((m) => m.implementado && tieneAcceso(m.permiso))?.key ?? "inventario";
  const [moduloActivo, setModuloActivo] = useState<string>(primerModulo);

  // El tema ya se fija antes de pintar (ver el script inline en
  // BaseLayout.astro), acá solo leemos qué quedó puesto para que el ícono
  // del botón arranque correcto, y lo alternamos guardando la preferencia.
  const [tema, setTema] = useState<"light" | "dark">("light");
  useEffect(() => {
    setTema((document.documentElement.getAttribute("data-theme") as "light" | "dark") || "light");
  }, []);

  function alternarTema() {
    const nuevo = tema === "dark" ? "light" : "dark";
    setTema(nuevo);
    document.documentElement.setAttribute("data-theme", nuevo);
    try {
      localStorage.setItem("sisges-theme", nuevo);
    } catch {
      // si el navegador bloquea localStorage, el tema no persiste pero
      // igual funciona durante la sesión
    }
  }

  async function cerrarSesion() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    window.location.href = "/login";
  }

  const iniciales = nombreCompleto
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <div className="app-shell">
      <div className="top-bar">
        <div className="brand">
          <span className="brand-mark">SG</span> SisGes
        </div>
        <div className="top-tabs">
          {MODULOS.map((m) => {
            const habilitado = m.implementado && tieneAcceso(m.permiso);
            return (
              <button
                key={m.key}
                className={[moduloActivo === m.key ? "active" : "", habilitado ? "" : "disabled"].join(" ")}
                disabled={!habilitado}
                title={!m.implementado ? "Próximamente" : !habilitado ? "No tienes permiso para este módulo" : undefined}
                onClick={() => setModuloActivo(m.key)}
              >
                <Icon name={m.icon} size={15} />
                {m.label}
              </button>
            );
          })}
        </div>
        <div className="user-menu">
          <button
            className="theme-toggle"
            onClick={alternarTema}
            title={tema === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
          >
            <Icon name={tema === "dark" ? "sun" : "moon"} size={16} />
          </button>
          <span>
            {iniciales ? <strong style={{ marginRight: 4 }}>{iniciales}</strong> : null}
            {nombreCompleto} — {empresaNombre}
          </span>
          <button onClick={cerrarSesion}>Cerrar sesión</button>
        </div>
      </div>

      <div className="module-body">
        {moduloActivo === "inventario" && tieneAcceso("inventario") && (
          <InventarioModule permisos={permisos} administrador={administrador} />
        )}
        {moduloActivo === "caja" && tieneAcceso("caja") && (
          <CajaModule permisos={permisos} administrador={administrador} />
        )}
        {moduloActivo === "herramientas" && tieneAcceso("herramientas") && <HerramientasModule esAdmin={esAdmin} />}
        {!MODULOS.some((m) => m.implementado && tieneAcceso(m.permiso)) && (
          <div className="panel" style={{ padding: 24 }}>
            Tu usuario no tiene acceso a ningún módulo disponible todavía. Contacta a un administrador si crees que
            esto es un error.
          </div>
        )}
      </div>
    </div>
  );
}
