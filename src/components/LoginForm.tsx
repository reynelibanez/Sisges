import { useState } from "react";

type Empresa = { idempresa: number; nombre: string };

export default function LoginForm() {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [empresas, setEmpresas] = useState<Empresa[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo iniciar sesión");

      if (data.step === "elegir-empresa") {
        setEmpresas(data.empresas);
      } else {
        window.location.href = data.redirect ?? "/dashboard";
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  async function elegirEmpresa(idempresa: number) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/empresa", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idempresa }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo continuar");
      window.location.href = data.redirect ?? "/dashboard";
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo continuar");
    } finally {
      setLoading(false);
    }
  }

  if (empresas) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <h1>Elige la empresa</h1>
          <p className="subtitle">Con qué empresa quieres trabajar en esta sesión.</p>
          {error && <div className="error-box">{error}</div>}
          <div className="empresa-list">
            {empresas.map((e) => (
              <button key={e.idempresa} className="empresa-item" disabled={loading} onClick={() => elegirEmpresa(e.idempresa)}>
                {e.nombre}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <h1>SisGes Web</h1>
        <p className="subtitle">Inicia sesión para continuar</p>
        {error && <div className="error-box">{error}</div>}
        <form onSubmit={handleLogin}>
          <div className="field">
            <label>Usuario</label>
            <input required autoFocus value={usuario} onChange={(e) => setUsuario(e.target.value)} />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
