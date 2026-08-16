import CatalogoPanel from "./CatalogoPanel";

export default function AlmacenesPanel() {
  return (
    <CatalogoPanel
      title="Almacenes"
      endpoint="/api/inventario/almacenes"
      idKey="idalmacen"
      columns={[
        { key: "almacen", label: "Almacén" },
        { key: "codigo", label: "Código" },
        {
          key: "pventa",
          label: "Punto de venta",
          render: (r) => (r.pventa ? <span className="badge badge-ok">Sí</span> : <span>No</span>),
        },
        {
          key: "abierto",
          label: "Estado",
          render: (r) =>
            r.abierto ? <span className="badge badge-ok">Abierto</span> : <span className="badge badge-off">Cerrado</span>,
        },
      ]}
      fields={[
        { key: "almacen", label: "Nombre del almacén", required: true },
        { key: "codigo", label: "Código" },
        { key: "pventa", label: "Es punto de venta (Caja)", type: "checkbox" },
        { key: "abierto", label: "Abierto", type: "checkbox" },
      ]}
    />
  );
}
