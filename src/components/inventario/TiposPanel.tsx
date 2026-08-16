import CatalogoPanel from "./CatalogoPanel";

export default function TiposPanel() {
  return (
    <CatalogoPanel
      title="Tipos de Producto"
      endpoint="/api/inventario/tipos"
      idKey="idtipo"
      columns={[{ key: "tipo", label: "Tipo" }]}
      fields={[{ key: "tipo", label: "Nombre del tipo", required: true }]}
    />
  );
}
