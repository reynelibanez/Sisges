import { useMemo, useState } from "react";

export type ColumnType = "text" | "number" | "boolean" | "date";

export interface ColumnDef<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  /** Tipo de dato de la columna: determina qué filtro y qué agregado de
   * footer se ofrecen (igual que en los grids de DevExpress). Si no se
   * indica, se intenta adivinar por el valor de la primera fila. */
  type?: ColumnType;
  /** false para desactivar el filtro de esta columna puntual. */
  filterable?: boolean;
  /** false para que esta columna no aparezca como opción de "Agrupar por". */
  groupable?: boolean;
  /** "sum" | "count" | "none" — qué mostrar en el pie de la columna.
   * Por defecto: "sum" si type es "number", si no "none". */
  footer?: "sum" | "count" | "none";
}

interface ContextAction<T> {
  label: string;
  onClick: (row: T) => void;
  danger?: boolean;
  /** Si devuelve false, la opción no aparece para esa fila. */
  show?: (row: T) => boolean;
}

interface DataGridProps<T> {
  columns: ColumnDef<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  loading?: boolean;
  emptyLabel?: string;
  onNew?: () => void;
  onRowDoubleClick?: (row: T) => void;
  contextActions?: ContextAction<T>[];
  /** Tamaño de página inicial (por defecto 25). */
  pageSizeDefault?: number;
}

type FiltroValor =
  | { tipo: "text"; texto: string }
  | { tipo: "number"; min: string; max: string }
  | { tipo: "boolean"; valor: string }
  | { tipo: "date"; desde: string; hasta: string };

function detectarTipo<T>(rows: T[], key: string): ColumnType {
  for (const r of rows) {
    const v = (r as any)[key];
    if (v == null) continue;
    if (typeof v === "boolean") return "boolean";
    if (typeof v === "number") return "number";
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return "date";
    if (v instanceof Date) return "date";
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v)) && /^-?\d+(\.\d+)?$/.test(v.trim()))
      return "number";
    return "text";
  }
  return "text";
}

function valorFecha(v: unknown): string | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * Grid genérico con clic derecho + filtros por columna + agrupar + footer
 * con sumatorias + paginación, replicando lo que ofrecen los grids de
 * DevExpress en el sistema de escritorio. Todo el filtrado/agrupado/
 * paginado ocurre en el navegador sobre las filas recibidas — para listas
 * muy grandes (miles de filas) conviene paginar del lado del servidor y
 * pasarle a este grid solo la página actual.
 */
export default function DataGrid<T>({
  columns,
  rows,
  rowKey,
  loading,
  emptyLabel = "Sin datos",
  onNew,
  onRowDoubleClick,
  contextActions = [],
  pageSizeDefault = 25,
}: DataGridProps<T>) {
  // row es null cuando se hace clic derecho fuera de una fila (p. ej. grilla
  // vacía) — en ese caso el menú solo puede ofrecer "Nuevo", ya que las demás
  // acciones (Ver detalle, Editar, Anular…) necesitan una fila concreta.
  const [menu, setMenu] = useState<{ x: number; y: number; row: T | null } | null>(null);
  const [filtros, setFiltros] = useState<Record<string, FiltroValor>>({});
  const [groupBy, setGroupBy] = useState<string>("");
  const [colapsados, setColapsados] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(pageSizeDefault);

  const cols = useMemo(
    () =>
      columns.map((c) => ({
        ...c,
        type: c.type ?? detectarTipo(rows, c.key),
        filterable: c.filterable !== false,
        groupable: c.groupable !== false,
      })),
    [columns, rows]
  );

  function handleContextMenu(e: React.MouseEvent, row: T | null) {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, row });
  }
  function closeMenu() {
    setMenu(null);
  }

  function coincide(row: T, col: (typeof cols)[number]): boolean {
    const f = filtros[col.key];
    if (!f) return true;
    const raw = (row as any)[col.key];
    if (f.tipo === "text") {
      if (!f.texto) return true;
      return String(raw ?? "")
        .toLowerCase()
        .includes(f.texto.toLowerCase());
    }
    if (f.tipo === "number") {
      const n = Number(raw);
      if (f.min !== "" && !(n >= Number(f.min))) return false;
      if (f.max !== "" && !(n <= Number(f.max))) return false;
      return true;
    }
    if (f.tipo === "boolean") {
      if (f.valor === "") return true;
      return String(!!raw) === f.valor;
    }
    if (f.tipo === "date") {
      const d = valorFecha(raw);
      if (!d) return false;
      if (f.desde && d < f.desde) return false;
      if (f.hasta && d > f.hasta) return false;
      return true;
    }
    return true;
  }

  const filtradas = useMemo(() => rows.filter((r) => cols.every((c) => coincide(r, c))), [rows, cols, filtros]);

  // Reinicia a la página 1 cuando cambian los filtros/agrupado/datos y la
  // página actual quedaría fuera de rango.
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / pageSize));
  const paginaSegura = Math.min(page, totalPaginas);

  const grupos = useMemo(() => {
    if (!groupBy) return null;
    const mapa = new Map<string, T[]>();
    for (const r of filtradas) {
      const v = (r as any)[groupBy];
      const clave = v == null || v === "" ? "(sin valor)" : String(v);
      if (!mapa.has(clave)) mapa.set(clave, []);
      mapa.get(clave)!.push(r);
    }
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0], "es"));
  }, [groupBy, filtradas]);

  const paginaActual = grupos ? filtradas : filtradas.slice((paginaSegura - 1) * pageSize, paginaSegura * pageSize);

  function footerDe(col: (typeof cols)[number]) {
    const modo = col.footer ?? (col.type === "number" ? "sum" : "none");
    if (modo === "none") return null;
    if (modo === "count") return `${filtradas.length}`;
    if (modo === "sum") {
      const total = filtradas.reduce((acc, r) => acc + (Number((r as any)[col.key]) || 0), 0);
      return total.toFixed(2);
    }
    return null;
  }

  function toggleGrupo(clave: string) {
    setColapsados((prev) => {
      const next = new Set(prev);
      if (next.has(clave)) next.delete(clave);
      else next.add(clave);
      return next;
    });
  }

  function renderFila(row: T) {
    return (
      <tr key={rowKey(row)} onContextMenu={(e) => handleContextMenu(e, row)} onDoubleClick={() => onRowDoubleClick?.(row)}>
        {cols.map((col) => (
          <td key={col.key}>{col.render ? col.render(row) : String((row as any)[col.key] ?? "")}</td>
        ))}
      </tr>
    );
  }

  const columnasFiltrables = cols.filter((c) => c.filterable);
  const hayFiltrosActivos = Object.keys(filtros).length > 0;

  return (
    <div onClick={closeMenu}>
      <div className="grid-toolbar">
        <div className="grid-toolbar-left">
          <label className="grid-groupby">
            Agrupar por:{" "}
            <select
              value={groupBy}
              onChange={(e) => {
                setGroupBy(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Sin agrupar</option>
              {cols
                .filter((c) => c.groupable)
                .map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
            </select>
          </label>
          {hayFiltrosActivos && (
            <button
              type="button"
              className="btn-link"
              onClick={() => {
                setFiltros({});
                setPage(1);
              }}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      <div className="grid-wrap">
        <table className="data-grid">
          <thead>
            <tr>
              {cols.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
            <tr className="grid-filter-row">
              {cols.map((col) => (
                <th key={col.key}>
                  {col.filterable && <FiltroColumna col={col} filtros={filtros} setFiltros={setFiltros} setPage={setPage} />}
                </th>
              ))}
            </tr>
          </thead>
          {!grupos && <tbody>{paginaActual.map((row) => renderFila(row))}</tbody>}
          {grupos &&
              grupos.map(([clave, filasGrupo]) => {
                const colapsado = colapsados.has(clave);
                return (
                  <tbody key={`g-${clave}`}>
                    <tr className="grid-group-row" onClick={() => toggleGrupo(clave)}>
                      <td colSpan={cols.length}>
                        <span className="grid-group-toggle">{colapsado ? "▸" : "▾"}</span>{" "}
                        <strong>{clave}</strong> <span className="grid-group-count">({filasGrupo.length})</span>
                      </td>
                    </tr>
                    {!colapsado && filasGrupo.map((row) => renderFila(row))}
                  </tbody>
                );
              })}
          {cols.some((c) => (c.footer ?? (c.type === "number" ? "sum" : "none")) !== "none") && filtradas.length > 0 && (
            <tfoot>
              <tr className="grid-footer-row">
                {cols.map((col) => (
                  <td key={col.key}>{footerDe(col)}</td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
        {!loading && rows.length === 0 && (
          <div className="empty-state" onContextMenu={(e) => onNew && handleContextMenu(e, null)}>
            {emptyLabel}
            {onNew && <div className="empty-state-hint">Clic derecho aquí para crear uno nuevo.</div>}
          </div>
        )}
        {!loading && rows.length > 0 && filtradas.length === 0 && (
          <div className="empty-state">Ningún resultado con los filtros actuales</div>
        )}
        {loading && <div className="empty-state">Cargando…</div>}
      </div>

      {!grupos && filtradas.length > 0 && (
        <div className="grid-pagination">
          <span>
            Mostrando {(paginaSegura - 1) * pageSize + 1}–{Math.min(paginaSegura * pageSize, filtradas.length)} de{" "}
            {filtradas.length}
          </span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} por página
              </option>
            ))}
          </select>
          <button type="button" disabled={paginaSegura <= 1} onClick={() => setPage(paginaSegura - 1)}>
            ‹ Anterior
          </button>
          <span>
            Página {paginaSegura} de {totalPaginas}
          </span>
          <button type="button" disabled={paginaSegura >= totalPaginas} onClick={() => setPage(paginaSegura + 1)}>
            Siguiente ›
          </button>
        </div>
      )}

      {menu && (
        <div className="context-menu" style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()}>
          {onNew && (
            <button
              onClick={() => {
                onNew();
                closeMenu();
              }}
            >
              Nuevo
            </button>
          )}
          {menu.row &&
            contextActions
              .filter((a) => !a.show || a.show(menu.row as T))
              .map((action) => (
                <button
                  key={action.label}
                  className={action.danger ? "danger" : ""}
                  onClick={() => {
                    action.onClick(menu.row as T);
                    closeMenu();
                  }}
                >
                  {action.label}
                </button>
              ))}
        </div>
      )}
    </div>
  );
}

function FiltroColumna({
  col,
  filtros,
  setFiltros,
  setPage,
}: {
  col: ColumnDef<any> & { type: ColumnType };
  filtros: Record<string, FiltroValor>;
  setFiltros: React.Dispatch<React.SetStateAction<Record<string, FiltroValor>>>;
  setPage: (n: number) => void;
}) {
  function actualizar(v: FiltroValor | null) {
    setFiltros((prev) => {
      const next = { ...prev };
      if (!v) delete next[col.key];
      else next[col.key] = v;
      return next;
    });
    setPage(1);
  }

  if (col.type === "boolean") {
    const f = filtros[col.key] as Extract<FiltroValor, { tipo: "boolean" }> | undefined;
    return (
      <select
        value={f?.valor ?? ""}
        onChange={(e) => (e.target.value === "" ? actualizar(null) : actualizar({ tipo: "boolean", valor: e.target.value }))}
      >
        <option value="">Todos</option>
        <option value="true">Sí</option>
        <option value="false">No</option>
      </select>
    );
  }

  if (col.type === "number") {
    const f = filtros[col.key] as Extract<FiltroValor, { tipo: "number" }> | undefined;
    return (
      <div className="grid-filter-range">
        <input
          type="number"
          placeholder="Mín"
          value={f?.min ?? ""}
          onChange={(e) => {
            const min = e.target.value;
            const max = f?.max ?? "";
            min === "" && max === "" ? actualizar(null) : actualizar({ tipo: "number", min, max });
          }}
        />
        <input
          type="number"
          placeholder="Máx"
          value={f?.max ?? ""}
          onChange={(e) => {
            const max = e.target.value;
            const min = f?.min ?? "";
            min === "" && max === "" ? actualizar(null) : actualizar({ tipo: "number", min, max });
          }}
        />
      </div>
    );
  }

  if (col.type === "date") {
    const f = filtros[col.key] as Extract<FiltroValor, { tipo: "date" }> | undefined;
    return (
      <div className="grid-filter-range">
        <input
          type="date"
          value={f?.desde ?? ""}
          onChange={(e) => {
            const desde = e.target.value;
            const hasta = f?.hasta ?? "";
            desde === "" && hasta === "" ? actualizar(null) : actualizar({ tipo: "date", desde, hasta });
          }}
        />
        <input
          type="date"
          value={f?.hasta ?? ""}
          onChange={(e) => {
            const hasta = e.target.value;
            const desde = f?.desde ?? "";
            desde === "" && hasta === "" ? actualizar(null) : actualizar({ tipo: "date", desde, hasta });
          }}
        />
      </div>
    );
  }

  const f = filtros[col.key] as Extract<FiltroValor, { tipo: "text" }> | undefined;
  return (
    <input
      type="text"
      placeholder="Filtrar…"
      value={f?.texto ?? ""}
      onChange={(e) => (e.target.value === "" ? actualizar(null) : actualizar({ tipo: "text", texto: e.target.value }))}
    />
  );
}
