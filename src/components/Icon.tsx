// Set mínimo de iconos en línea (sin depender de una librería externa),
// usados en la barra superior y en la navegación lateral de los módulos.
const PATHS: Record<string, string> = {
  inventario: "M21 8 12 3 3 8l9 5 9-5Z M3 8v8l9 5 9-5V8 M12 13v8",
  caja: "M2 7h20v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7Z M2 7l2-3h16l2 3 M12 12a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z",
  contabilidad: "M4 20V10 M10 20V4 M16 20v-7 M22 20H2",
  personal: "M17 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2 M10 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M22 20v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
  finanzas: "M12 2 2 7l10 5 10-5-10-5Z M2 17l10 5 10-5 M2 12l10 5 10-5",
  facturas: "M6 2h9l5 5v15H6V2Z M14 2v5h5 M9 13h6 M9 17h6",
  herramientas: "M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 1 5.4-5.4L21 6l-3-3-3.3 3.3Z",
  tag: "M20.6 12.7 11.3 3.4a2 2 0 0 0-1.4-.6H4a1 1 0 0 0-1 1v5.9c0 .5.2 1 .6 1.4l9.3 9.3a2 2 0 0 0 2.8 0l4.9-4.9a2 2 0 0 0 0-2.8Z M7 7h.01",
  documentos: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z M14 2v6h6 M9 13h6 M9 17h6",
  reportes: "M18 20V10 M12 20V4 M6 20v-6",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z M12 1v2 M12 21v2 M4.22 4.22l1.42 1.42 M18.36 18.36l1.42 1.42 M1 12h2 M21 12h2 M4.22 19.78l1.42-1.42 M18.36 5.64l1.42-1.42",
  moon: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z",
};

export default function Icon({ name, size = 16 }: { name: string; size?: number }) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
