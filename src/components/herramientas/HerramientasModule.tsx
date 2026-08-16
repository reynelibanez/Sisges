import AdminUsuariosPanel from "./AdminUsuariosPanel";
import SidebarModule, { type SidebarGrupo } from "@/components/SidebarModule";

interface HerramientasModuleProps {
  esAdmin: boolean;
}

// Módulo "Herramientas": por ahora solo trae "Administrar Usuarios", y esa
// única opción es exclusiva de administradores — el resto de usuarios con
// permiso de Herramientas (la mayoría, según config.dll) ven el tab pero
// sin opciones todavía, listo para ir agregando más herramientas después.
export default function HerramientasModule({ esAdmin }: HerramientasModuleProps) {
  const grupos: SidebarGrupo[] = esAdmin
    ? [
        {
          titulo: "Administración",
          icon: "herramientas",
          items: [{ key: "usuarios", label: "Administrar Usuarios", Comp: AdminUsuariosPanel }],
        },
      ]
    : [];

  if (grupos.length === 0) {
    return (
      <div className="panel" style={{ padding: 24 }}>
        No tienes opciones disponibles en Herramientas todavía. "Administrar Usuarios" es exclusivo de administradores.
      </div>
    );
  }

  return <SidebarModule grupos={grupos} />;
}
