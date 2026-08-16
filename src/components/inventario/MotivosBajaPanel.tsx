import CatalogoPanel from "./CatalogoPanel";

export default function MotivosBajaPanel() {
  return (
    <CatalogoPanel
      title="Motivos de Baja"
      endpoint="/api/inventario/bajas-motivos"
      idKey="idbajas"
      columns={[{ key: "bajas", label: "Motivo" }]}
      fields={[{ key: "bajas", label: "Nombre del motivo", required: true }]}
    />
  );
}
