import CatalogoPanel from "./CatalogoPanel";

export default function MonedasPanel() {
  return (
    <CatalogoPanel
      title="Monedas"
      endpoint="/api/inventario/monedas"
      idKey="idmoneda"
      columns={[
        { key: "moneda", label: "Moneda" },
        { key: "tc", label: "Tasa de cambio" },
      ]}
      fields={[
        { key: "moneda", label: "Nombre (CUP, USD…)", required: true },
        { key: "tc", label: "Tasa de cambio", required: true },
      ]}
    />
  );
}
