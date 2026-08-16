import CatalogoPanel from "./CatalogoPanel";

export default function UnidadesPanel() {
  return (
    <CatalogoPanel
      title="Unidades de Medida"
      endpoint="/api/inventario/unidades"
      idKey="id"
      columns={[{ key: "um", label: "Unidad" }]}
      fields={[{ key: "um", label: "Nombre de la unidad", required: true }]}
    />
  );
}
