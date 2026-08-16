import { useMemo, useState } from "react";
import DataGrid from "@/components/DataGrid";
import { useList } from "@/lib/useApi";
import { exportCsv } from "@/lib/csv";

export default function ExistenciasPanel() {
  const { data, loading, error } = useList("/api/inventario/existencias");
  // Por defecto solo interesa lo que realmente hay en almacén; "Sin
  // existencia" es la vista para ir a revisar/reponer lo que está en 0 o
  // en negativo.
  const [vista, setVista] = useState<"con" | "sin">("con");

  const filas = useMemo(
    () =>
      data.map((r: any) => {
        const saldo = Number(r.saldo);
        const pcosto = Number(r.pcosto);
        const pventa = Number(r.pventa);
        return { ...r, gananciaPotencial: saldo * (pventa - pcosto) };
      }),
    [data]
  );

  const filtradas = filas.filter((r: any) => (vista === "con" ? Number(r.saldo) > 0 : Number(r.saldo) <= 0));

  return (
    <div className="panel">
      <div className="panel-toolbar">
        <h2>Existencias</h2>
        <button className="btn btn-secondary" onClick={() => exportCsv("existencias.csv", filtradas)}>
          Exportar CSV
        </button>
      </div>

      <div style={{ padding: "12px 16px 0" }}>
        <div className="segmented">
          <button type="button" className={vista === "con" ? "segmented-active" : ""} onClick={() => setVista("con")}>
            Con existencia
          </button>
          <button type="button" className={vista === "sin" ? "segmented-active" : ""} onClick={() => setVista("sin")}>
            Sin existencia (saldo ≤ 0)
          </button>
        </div>
      </div>

      {error && <div className="error-box" style={{ margin: 12 }}>{error}</div>}

      <DataGrid
        rows={filtradas}
        loading={loading}
        rowKey={(r: any) => r.idexistencia}
        emptyLabel={vista === "con" ? "No hay productos con existencia" : "No hay productos con saldo 0 o menos"}
        columns={[
          { key: "almacen", label: "Almacén" },
          { key: "producto", label: "Producto" },
          { key: "referencia", label: "Referencia" },
          { key: "saldo", label: "Saldo", render: (r: any) => Number(r.saldo).toFixed(2) },
          {
            key: "gananciaPotencial",
            label: "Ganancia potencial",
            render: (r: any) => Number(r.gananciaPotencial).toFixed(2),
          },
        ]}
      />
    </div>
  );
}
