import CatalogoPanel from "./CatalogoPanel";

export default function AreasPanel() {
  return (
    <CatalogoPanel
      title="Áreas"
      endpoint="/api/inventario/areas"
      idKey="idarea"
      columns={[
        { key: "area", label: "Área" },
        {
          key: "principal",
          label: "Principal",
          render: (r) => (r.principal ? <span className="badge badge-ok">Sí</span> : <span>No</span>),
        },
      ]}
      fields={[
        { key: "area", label: "Nombre del área", required: true },
        { key: "principal", label: "Área principal", type: "checkbox" },
      ]}
    />
  );
}
