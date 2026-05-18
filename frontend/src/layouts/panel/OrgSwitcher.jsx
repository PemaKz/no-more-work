import { useEffect, useRef, useState } from "react";
import useAuth from "../../hooks/useAuth";

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const ChevronIcon = (p) => (
  <svg viewBox="0 0 24 24" width="14" height="14" {...stroke} {...p}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const CheckIcon = (p) => (
  <svg viewBox="0 0 24 24" width="14" height="14" {...stroke} {...p}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const PlusIcon = (p) => (
  <svg viewBox="0 0 24 24" width="14" height="14" {...stroke} {...p}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

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

export default function OrgSwitcher() {
  const {
    activeOrganization,
    activeOrganizationPending,
    organizations,
    organizationsPending,
    createOrganization,
    setActiveOrganization,
  } = useAuth();

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("list"); // "list" | "create"
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef(null);

  // setActiveOrganization se recrea en cada render de useAuth (sin
  // useCallback). Para evitar que el efecto se dispare en cascada — el
  // /set-active fuerza un refetch de sesión y de active-org, que vuelven
  // a re-renderizar este componente — leemos la función a través de un ref
  // y deduplicamos la llamada con `autoSetAttemptedRef`.
  const setActiveRef = useRef(setActiveOrganization);
  setActiveRef.current = setActiveOrganization;
  const autoSetAttemptedRef = useRef(false);

  useEffect(() => {
    if (autoSetAttemptedRef.current) return;
    // CRÍTICO: hay que esperar a que ambos contextos terminen de cargar. Si
    // no, en un refresh el active-org viene `null` transitorio mientras
    // better-auth lo carga; auto-elegimos organizations[0] (la más antigua)
    // y pisamos la elección persistida del usuario.
    if (activeOrganizationPending || organizationsPending) return;
    if (activeOrganization) return;
    if (organizations.length === 0) return;
    autoSetAttemptedRef.current = true;
    setActiveRef.current(organizations[0].id).catch(() => {
      autoSetAttemptedRef.current = false; // permitir reintento si falla
    });
  }, [
    activeOrganization,
    activeOrganizationPending,
    organizations,
    organizationsPending,
  ]);

  // Cerrar al click fuera o Esc
  useEffect(() => {
    if (!open) return;
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Reset al cerrar
  useEffect(() => {
    if (!open) {
      setMode("list");
      setName("");
      setSlug("");
      setSlugTouched(false);
      setError("");
    }
  }, [open]);

  const handleNameChange = (e) => {
    const v = e.target.value;
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  };

  const handleSwitch = async (id) => {
    if (id === activeOrganization?.id) {
      setOpen(false);
      return;
    }
    try {
      await setActiveOrganization(id);
      setOpen(false);
    } catch (err) {
      setError(err.message || "No se pudo cambiar de organización");
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Nombre requerido");
    if (!slug.trim()) return setError("Slug requerido");
    setSubmitting(true);
    try {
      await createOrganization({ name: name.trim(), slug: slug.trim() });
      setOpen(false);
    } catch (err) {
      setError(err.message || "No se pudo crear la organización");
    } finally {
      setSubmitting(false);
    }
  };

  const buttonLabel = organizationsPending
    ? "Cargando…"
    : activeOrganization?.name || "Sin organización";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 h-10 rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] hover:bg-[color:var(--color-surface-3)] hover:border-[color:var(--color-border-strong)] transition-colors text-left"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="badge !py-[1px]">org</span>
        <span className="flex-1 text-sm font-medium truncate text-[color:var(--color-text)]">
          {buttonLabel}
        </span>
        <ChevronIcon className="text-[color:var(--color-text-dim)]" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 z-30 panel-floating !p-0">
          {mode === "list" && (
            <>
              <div className="px-3 pt-3 pb-1">
                <span className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)]">
                  Tus organizaciones
                </span>
              </div>
              <ul className="px-1 py-1 max-h-64 overflow-auto">
                {organizations.length === 0 && !organizationsPending && (
                  <li className="px-3 py-2 text-sm text-[color:var(--color-text-muted)]">
                    No perteneces a ninguna organización.
                  </li>
                )}
                {organizations.map((org) => {
                  const active = org.id === activeOrganization?.id;
                  return (
                    <li key={org.id}>
                      <button
                        type="button"
                        onClick={() => handleSwitch(org.id)}
                        className={[
                          "w-full flex items-center gap-2 px-3 py-2 rounded-[var(--radius-sm)] text-left transition-colors",
                          active
                            ? "bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent)]"
                            : "hover:bg-[color:var(--color-surface-3)] text-[color:var(--color-text)]",
                        ].join(" ")}
                      >
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium truncate">
                            {org.name}
                          </span>
                          <span className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)]">
                            {org.slug}
                          </span>
                        </span>
                        {active && <CheckIcon />}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="border-t border-[color:var(--color-border)] p-1">
                <button
                  type="button"
                  onClick={() => setMode("create")}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-[var(--radius-sm)] text-sm text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-3)] transition-colors"
                >
                  <PlusIcon />
                  <span>Crear organización</span>
                </button>
              </div>
              {error && (
                <div className="px-3 py-2 border-t border-[color:var(--color-border)] text-xs text-[color:var(--color-status-error)]">
                  {error}
                </div>
              )}
            </>
          )}

          {mode === "create" && (
            <form onSubmit={handleCreate} className="p-3 space-y-3">
              <div>
                <span className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)]">
                  Nueva organización
                </span>
              </div>
              <div>
                <label htmlFor="org-name" className="label !mb-1">
                  Nombre
                </label>
                <input
                  id="org-name"
                  type="text"
                  value={name}
                  onChange={handleNameChange}
                  autoFocus
                  required
                  className="input !h-9"
                  placeholder="Mi organización"
                />
              </div>
              <div>
                <label htmlFor="org-slug" className="label !mb-1">
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
                  className="input !h-9 !font-mono !text-[13px]"
                  placeholder="mi-organizacion"
                />
              </div>
              {error && (
                <p className="text-xs text-[color:var(--color-status-error)]">{error}</p>
              )}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setMode("list")}
                  className="btn btn-ghost btn-sm flex-1"
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm flex-1"
                  disabled={submitting}
                >
                  {submitting ? "Creando…" : "Crear"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
