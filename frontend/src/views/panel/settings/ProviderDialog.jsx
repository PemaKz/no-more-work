import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const KINDS = [
  {
    id: "anthropic",
    label: "Anthropic",
    placeholder: "claude-sonnet-4-5",
    needsBaseURL: false,
  },
  {
    id: "openai",
    label: "OpenAI",
    placeholder: "gpt-4o",
    needsBaseURL: false,
  },
  {
    id: "openai_compatible",
    label: "OpenAI-compatible",
    placeholder: "llama3.1:8b",
    needsBaseURL: true,
  },
];

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const CloseIcon = (p) => (
  <svg viewBox="0 0 24 24" width="16" height="16" {...stroke} {...p}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const TrashIcon = (p) => (
  <svg viewBox="0 0 24 24" width="14" height="14" {...stroke} {...p}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const EyeIcon = (p) => (
  <svg viewBox="0 0 24 24" width="14" height="14" {...stroke} {...p}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = (p) => (
  <svg viewBox="0 0 24 24" width="14" height="14" {...stroke} {...p}>
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <line x1="2" y1="2" x2="22" y2="22" />
  </svg>
);

export default function ProviderDialog({
  open,
  mode = "create",
  provider = null,
  onClose,
  onSubmit,
  onDelete,
}) {
  const isEdit = mode === "edit" && !!provider;

  const [name, setName] = useState("");
  const [kind, setKind] = useState("anthropic");
  const [baseURL, setBaseURL] = useState("");
  const [defaultModel, setDefaultModel] = useState("");
  // apiKey: undefined = no tocar; string = nuevo valor; null = borrar
  const [apiKey, setApiKey] = useState("");
  const [apiKeyRevealed, setApiKeyRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const confirmTimerRef = useRef(null);
  const nameRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    if (isEdit) {
      setName(provider.name || "");
      setKind(provider.kind || "anthropic");
      setBaseURL(provider.baseURL || "");
      setDefaultModel(provider.defaultModel || "");
    } else {
      setName("");
      setKind("anthropic");
      setBaseURL("");
      setDefaultModel("");
    }
    setApiKey("");
    setApiKeyRevealed(false);
    setError("");
    setSubmitting(false);
    setConfirmDelete(false);
    setDeleting(false);
    requestAnimationFrame(() => nameRef.current?.focus());
  }, [open, isEdit, provider]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(
    () => () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    },
    []
  );

  if (!open) return null;

  const kindDef = KINDS.find((k) => k.id === kind) || KINDS[0];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setError("El nombre es obligatorio");
    if (!defaultModel.trim()) return setError("El modelo es obligatorio");
    if (kindDef.needsBaseURL && !baseURL.trim()) {
      return setError("baseURL es obligatorio para openai_compatible");
    }
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        name: name.trim(),
        kind,
        baseURL: kindDef.needsBaseURL ? baseURL.trim() : null,
        defaultModel: defaultModel.trim(),
      };
      // Solo enviamos apiKey si el usuario escribió algo. Si está vacío,
      // el backend preserva la key existente (consistente con el patrón
      // de secrets).
      if (apiKey.trim()) {
        payload.apiKey = apiKey;
      }
      await onSubmit(payload);
      onClose();
    } catch (err) {
      setError(err.message || "No se pudo guardar el provider");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = async () => {
    if (!isEdit) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = setTimeout(
        () => setConfirmDelete(false),
        3000
      );
      return;
    }
    if (confirmTimerRef.current) {
      clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = null;
    }
    setDeleting(true);
    setError("");
    try {
      await onDelete?.();
      onClose();
    } catch (err) {
      setError(err.message || "No se pudo eliminar el provider");
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-[color:var(--color-surface-1)] border border-[color:var(--color-border)] rounded-[var(--radius-lg)] w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden"
        style={{ boxShadow: "var(--shadow-float)" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="px-5 py-4 border-b border-[color:var(--color-border)] flex items-start justify-between gap-3">
          <div>
            <span className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)]">
              {isEdit ? `provider · ${provider.name}` : "config · nuevo provider"}
            </span>
            <h2 className="text-lg font-semibold tracking-tight mt-1">
              {isEdit ? "Editar provider" : "Crear provider"}
            </h2>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isEdit && (
              <button
                type="button"
                onClick={handleDeleteClick}
                disabled={deleting}
                className={[
                  "btn btn-sm flex items-center gap-1.5",
                  confirmDelete ? "btn-danger" : "btn-ghost",
                  !confirmDelete && "text-[color:var(--color-status-error)]",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <TrashIcon />
                <span>
                  {deleting
                    ? "Eliminando…"
                    : confirmDelete
                      ? "Confirmar eliminación"
                      : "Eliminar"}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost btn-sm btn-icon"
              aria-label="Cerrar"
            >
              <CloseIcon />
            </button>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-auto p-5 space-y-4">
            <div>
              <label htmlFor="prov-name" className="label">
                Nombre
              </label>
              <input
                id="prov-name"
                ref={nameRef}
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="claude-prod / ollama-local / …"
              />
            </div>

            <div>
              <label className="label">Tipo</label>
              <div className="grid grid-cols-3 gap-2">
                {KINDS.map((k) => {
                  const active = k.id === kind;
                  return (
                    <button
                      type="button"
                      key={k.id}
                      onClick={() => setKind(k.id)}
                      className={[
                        "flex items-center justify-center h-9 px-2 rounded-[var(--radius)] border text-[11px] font-medium uppercase tracking-wider transition-colors",
                        active
                          ? "bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent)] border-[color:var(--color-accent)]"
                          : "text-[color:var(--color-text-muted)] border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)] hover:text-[color:var(--color-text)]",
                      ].join(" ")}
                    >
                      {k.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {kindDef.needsBaseURL && (
              <div>
                <label htmlFor="prov-baseurl" className="label">
                  Base URL
                </label>
                <input
                  id="prov-baseurl"
                  type="url"
                  className="input !font-mono !text-[13px]"
                  value={baseURL}
                  onChange={(e) => setBaseURL(e.target.value)}
                  required
                  placeholder="http://localhost:11434/v1"
                />
                <p className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)] mt-1">
                  ollama por defecto · http://localhost:11434/v1
                </p>
              </div>
            )}

            <div>
              <label htmlFor="prov-model" className="label">
                Modelo por defecto
              </label>
              <input
                id="prov-model"
                className="input !font-mono !text-[13px]"
                value={defaultModel}
                onChange={(e) => setDefaultModel(e.target.value)}
                required
                placeholder={kindDef.placeholder}
              />
            </div>

            <div>
              <label htmlFor="prov-apikey" className="label">
                API key{" "}
                <span className="text-[color:var(--color-text-dim)]">
                  {isEdit
                    ? provider.hasApiKey
                      ? "(configurada · escribe para reemplazar)"
                      : "(no configurada)"
                    : "(opcional para self-hosted)"}
                </span>
              </label>
              <div className="relative">
                <input
                  id="prov-apikey"
                  type={apiKeyRevealed ? "text" : "password"}
                  className="input !font-mono !text-[13px] pr-10"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={
                    isEdit && provider.hasApiKey
                      ? "•••••••••• (oculta)"
                      : "sk-…"
                  }
                />
                <button
                  type="button"
                  onClick={() => setApiKeyRevealed((r) => !r)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[color:var(--color-text-dim)] hover:text-[color:var(--color-text)] p-1"
                  aria-label={apiKeyRevealed ? "Ocultar" : "Mostrar"}
                  title={apiKeyRevealed ? "Ocultar" : "Mostrar"}
                  tabIndex={-1}
                >
                  {apiKeyRevealed ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              <p className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)] mt-1">
                cifrada at-rest con aes-256-gcm · nunca vuelve a salir del
                servidor
              </p>
            </div>
          </div>

          {error && (
            <div className="px-5 py-3 border-t border-[color:var(--color-border)] bg-[color:var(--color-status-error)]/10">
              <p className="text-sm text-[color:var(--color-status-error)]">
                {error}
              </p>
            </div>
          )}

          <footer className="px-5 py-4 border-t border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary btn-sm"
              disabled={submitting || deleting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={submitting || deleting}
            >
              {submitting
                ? isEdit
                  ? "Guardando…"
                  : "Creando…"
                : isEdit
                  ? "Guardar cambios"
                  : "Crear provider"}
            </button>
          </footer>
        </form>
      </div>
    </div>,
    document.body
  );
}
