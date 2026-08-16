import { useState } from "react";
import Icon from "./Icon";

export interface SidebarItem {
  key: string;
  label: string;
  Comp: React.ComponentType;
}

export interface SidebarGrupo {
  titulo: string;
  icon?: string;
  items: SidebarItem[];
}

interface SidebarModuleProps {
  grupos: SidebarGrupo[];
}

/**
 * Navegación lateral usada por los módulos con varias secciones
 * (Inventario: Nomenclador / Documentos / Reportes; Herramientas, etc.).
 * Mantiene cada grupo claramente separado en vez de amontonar todo en una
 * sola fila de pestañas.
 */
export default function SidebarModule({ grupos }: SidebarModuleProps) {
  const primero = grupos[0]?.items[0];
  const [activa, setActiva] = useState<string>(primero?.key ?? "");

  let Seccion: React.ComponentType | undefined = primero?.Comp;
  for (const g of grupos) {
    const encontrado = g.items.find((it) => it.key === activa);
    if (encontrado) Seccion = encontrado.Comp;
  }

  if (grupos.length === 0 || !Seccion) {
    return (
      <div className="panel" style={{ padding: 24 }}>
        No hay opciones disponibles para tu usuario en este módulo todavía.
      </div>
    );
  }

  return (
    <div className="module-shell">
      <div className="module-sidebar">
        {grupos.map((g) => (
          <div className="module-sidebar-section" key={g.titulo}>
            <div className="module-sidebar-section-title">
              {g.icon && <Icon name={g.icon} size={12} />} {g.titulo}
            </div>
            {g.items.map((it) => (
              <button
                key={it.key}
                className={`module-sidebar-button ${activa === it.key ? "active" : ""}`}
                onClick={() => setActiva(it.key)}
              >
                {it.label}
              </button>
            ))}
          </div>
        ))}
      </div>
      <div className="module-content">
        <Seccion />
      </div>
    </div>
  );
}
