import ProductosPanel from "./ProductosPanel";
import ProductosAsociadosPanel from "./ProductosAsociadosPanel";
import AlmacenesPanel from "./AlmacenesPanel";
import AreasPanel from "./AreasPanel";
import UnidadesPanel from "./UnidadesPanel";
import MonedasPanel from "./MonedasPanel";
import CrearCajerosPanel from "./CrearCajerosPanel";
import RecepcionesPanel from "./RecepcionesPanel";
import TransferenciasPanel from "./TransferenciasPanel";
import DesagregarProductoPanel from "./DesagregarProductoPanel";
import ValesSalidaPanel from "./ValesSalidaPanel";
import BajasPanel from "./BajasPanel";
import MotivosBajaPanel from "./MotivosBajaPanel";
import ExistenciasPanel from "./ExistenciasPanel";
import SubmayorPanel from "./SubmayorPanel";
import TopProductosPanel from "./TopProductosPanel";
import ValesMonedasPanel from "./ValesMonedasPanel";
import GananciasPanel from "./GananciasPanel";
import SidebarModule, { type SidebarGrupo } from "@/components/SidebarModule";
import type { SessionPayload } from "@/lib/auth";

interface InventarioModuleProps {
  permisos: SessionPayload["permisos"];
  administrador: boolean;
}

// Sub-módulos del tab "Inventario", organizados en los mismos 3 grupos que
// la cinta de opciones del sistema de escritorio (Nomenclador / Documentos
// / Reportes), ahora como navegación lateral para que cada grupo se vea
// claramente separado. "Ventas (Caja)" y "Cierre de Caja" se movieron a su
// propio módulo "Caja"; "Vales de Salida" queda acá como consulta/gestión
// de documentos (distinta de la pantalla de cobro de Caja).
const GRUPOS_BASE = [
  {
    titulo: "Nomenclador",
    icon: "tag",
    items: [
      { key: "almacenes", label: "Almacenes", Comp: AlmacenesPanel },
      { key: "productos", label: "Productos", Comp: ProductosPanel },
      { key: "productosasociados", label: "Asociar productos", Comp: ProductosAsociadosPanel },
      { key: "motivos", label: "Conceptos de bajas", Comp: MotivosBajaPanel },
      { key: "cajeros", label: "Crear Cajeros", Comp: CrearCajerosPanel, requiere: "crearCajero" as const },
      { key: "areas", label: "Áreas de Ventas", Comp: AreasPanel },
      { key: "monedas", label: "Monedas", Comp: MonedasPanel },
      { key: "unidades", label: "U. de Medida", Comp: UnidadesPanel },
    ],
  },
  {
    titulo: "Documentos",
    icon: "documentos",
    items: [
      { key: "recepciones", label: "Recepciones", Comp: RecepcionesPanel },
      { key: "valessalida", label: "Vales de Salida", Comp: ValesSalidaPanel },
      { key: "transferencias", label: "Transferencias", Comp: TransferenciasPanel },
      { key: "bajas", label: "Bajas", Comp: BajasPanel },
      { key: "desagregar", label: "Desagregar Producto", Comp: DesagregarProductoPanel },
    ],
  },
  {
    titulo: "Reportes",
    icon: "reportes",
    items: [
      { key: "existencias", label: "Existencias", Comp: ExistenciasPanel },
      { key: "ganancias", label: "Ganancias", Comp: GananciasPanel },
      { key: "submayor", label: "Submayor", Comp: SubmayorPanel },
      { key: "topproductos", label: "Top - Productos Vendidos", Comp: TopProductosPanel },
      { key: "valesmonedas", label: "Vales con Monedas Extranjeras", Comp: ValesMonedasPanel },
    ],
  },
] as const;

export default function InventarioModule({ permisos, administrador }: InventarioModuleProps) {
  const grupos: SidebarGrupo[] = GRUPOS_BASE.map((g) => ({
    titulo: g.titulo,
    icon: g.icon,
    items: g.items.filter((it: any) => !it.requiere || permisos[it.requiere as keyof typeof permisos] || administrador),
  })).filter((g) => g.items.length > 0);

  return <SidebarModule grupos={grupos} />;
}
