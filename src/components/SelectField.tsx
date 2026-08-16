import { useEffect, useMemo, useRef, useState } from "react";

export interface SelectFieldOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: SelectFieldOption[];
  placeholder?: string;
  disabled?: boolean;
  /** Muestra el asterisco de "obligatorio" (la validación real la hace quien use el componente). */
  required?: boolean;
}

/**
 * Combobox con búsqueda — reemplaza el <select> nativo, que con listas
 * largas (cientos de productos) se vuelve una lista plana del sistema
 * operativo sin forma de filtrar. Este sí permite escribir para filtrar,
 * se navega con teclado y se ve consistente con el resto de la app en
 * ambos temas.
 */
export default function SelectField({ value, onChange, options, placeholder = "Selecciona…", disabled, required }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const seleccionado = options.find((o) => o.value === value) ?? null;

  const filtradas = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlighted(Math.max(0, options.findIndex((o) => o.value === value)));
      // Deja que el popover monte antes de enfocar.
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function elegir(o: SelectFieldOption) {
    onChange(o.value);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((i) => Math.min(filtradas.length - 1, i + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtradas[highlighted];
      if (opt) elegir(opt);
    }
  }

  return (
    <div className={`select-field${open ? " select-field-open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="select-field-trigger"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
      >
        <span className={seleccionado ? "" : "select-field-placeholder"}>
          {seleccionado ? seleccionado.label : placeholder}
          {required && !seleccionado && " *"}
        </span>
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" className="select-field-chevron">
          <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="select-field-popover">
          <input
            ref={searchRef}
            className="select-field-search"
            placeholder="Buscar…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlighted(0);
            }}
            onKeyDown={onKeyDown}
          />
          <div className="select-field-list">
            {filtradas.length === 0 && <div className="select-field-empty">Sin resultados</div>}
            {filtradas.map((o, i) => (
              <div
                key={o.value}
                className={`select-field-option${o.value === value ? " select-field-option-selected" : ""}${
                  i === highlighted ? " select-field-option-highlighted" : ""
                }`}
                onMouseEnter={() => setHighlighted(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  elegir(o);
                }}
              >
                {o.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
