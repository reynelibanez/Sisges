import { useCallback, useEffect, useState } from "react";

async function request(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = data?.error;
    let message: unknown =
      err?.formErrors?.[0] ??
      (err?.fieldErrors && Object.values(err.fieldErrors).flat()[0]) ??
      err?.message ??
      err;
    if (typeof message !== "string") message = "Error inesperado";
    throw new Error(message as string);
  }
  return data;
}

export const api = {
  get: (url: string) => request(url),
  post: (url: string, body: unknown) => request(url, { method: "POST", body: JSON.stringify(body) }),
  put: (url: string, body: unknown) => request(url, { method: "PUT", body: JSON.stringify(body) }),
  del: (url: string) => request(url, { method: "DELETE" }),
};

/** Carga una lista desde `url` y expone recargar/estado de carga/error. */
export function useList<T = any>(url: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await api.get(url);
      setData(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload, setData };
}
