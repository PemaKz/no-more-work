import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import useAuth from "../../../hooks/useAuth";

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function PanelOnboardingView() {
  const {
    organizations,
    organizationsPending,
    createOrganization,
    logout,
  } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Si el usuario ya pertenece a una org, no tiene sentido seguir aquí.
  if (!organizationsPending && organizations.length > 0) {
    return <Navigate to="/panel/dashboard" replace />;
  }

  const handleNameChange = (e) => {
    const v = e.target.value;
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Nombre requerido");
    if (!slug.trim()) return setError("Slug requerido");
    setSubmitting(true);
    try {
      await createOrganization({ name: name.trim(), slug: slug.trim() });
      navigate("/panel/dashboard");
    } catch (err) {
      setError(err.message || "No se pudo crear la organización");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-[color:var(--color-bg)] text-[color:var(--color-text)]">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Crea tu primera organización
          </h1>
          <p className="text-sm text-[color:var(--color-text-muted)] mt-2">
            Necesitas una organización para acceder al panel. Podrás crear más
            o invitar miembros después.
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
            <label htmlFor="org-name" className="label">
              Nombre
            </label>
            <input
              id="org-name"
              type="text"
              value={name}
              onChange={handleNameChange}
              autoFocus
              required
              className="input"
              placeholder="Mi organización"
            />
          </div>

          <div>
            <label htmlFor="org-slug" className="label">
              Slug
            </label>
            <input
              id="org-slug"
              type="text"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
              required
              className="input !font-mono !text-[13px]"
              placeholder="mi-organizacion"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary btn-lg w-full"
          >
            {submitting ? "Creando…" : "Crear organización"}
          </button>
        </form>

        <p className="mono text-[11px] uppercase tracking-wider text-[color:var(--color-text-dim)] text-center">
          ¿No es lo que buscabas?{" "}
          <button
            type="button"
            onClick={logout}
            className="underline hover:text-[color:var(--color-text)]"
          >
            Cerrar sesión
          </button>
        </p>
      </div>
    </div>
  );
}
