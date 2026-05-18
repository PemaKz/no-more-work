import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../../hooks/useAuth";

export default function AuthView() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      navigate("/panel/dashboard");
    } catch (err) {
      setError(err.message || "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <span className="mono text-[11px] uppercase tracking-wider text-[color:var(--color-text-dim)]">
          /auth
        </span>
        <h1 className="text-3xl font-semibold tracking-tight mt-2">Iniciar sesión</h1>
        <p className="text-sm text-[color:var(--color-text-muted)] mt-2">
          Accede para ver el estado de tus agentes y zonas.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 px-4 py-3 rounded-[var(--radius)] border bg-[rgba(239,68,68,0.08)] border-[rgba(239,68,68,0.35)]"
        >
          <span className="status-dot mt-1.5" data-status="error" />
          <p className="text-sm text-[color:var(--color-status-error)] leading-snug">
            {error}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="input"
            placeholder="tu@email.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="label">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="input"
            placeholder="••••••••"
          />
        </div>

        <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full">
          {loading ? "Verificando…" : "Entrar"}
        </button>
      </form>

      <p className="mono text-[11px] uppercase tracking-wider text-[color:var(--color-text-dim)] text-center">
        El registro está deshabilitado. Pide acceso al administrador.
      </p>
    </div>
  );
}
