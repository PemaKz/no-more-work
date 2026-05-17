import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const STATUS_LABEL = {
  idle: "Inactivo",
  working: "Trabajando",
  success: "OK",
  warning: "Atención",
  error: "Error",
};

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

export default function AgentDialog({
  open,
  mode = "create",
  agent = null,
  zones = [],
  defaultZoneId = null,
  onClose,
  onSubmit,
  onDelete,
}) {
  const isEdit = mode === "edit" && !!agent;

  const [name, setName] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const confirmTimerRef = useRef(null);
  const nameRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    if (isEdit) {
      setName(agent.name || "");
      setZoneId(agent.zoneId || "");
      setDescription(agent.description || "");
    } else {
      setName("");
      setZoneId(defaultZoneId || zones[0]?.id || "");
      setDescription("");
    }
    setError("");
    setSubmitting(false);
    setConfirmDelete(false);
    setDeleting(false);
    requestAnimationFrame(() => nameRef.current?.focus());
  }, [open, isEdit, agent, defaultZoneId, zones]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    if (!zoneId) {
      setError("Selecciona una zona");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        name: name.trim(),
        zoneId,
        description: description.trim() || undefined,
      };
      await onSubmit(payload);
      onClose();
    } catch (err) {
      setError(err.message || "No se pudo guardar el agente");
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
      setError(err.message || "No se pudo eliminar el agente");
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  const currentZone = zones.find((z) => z.id === zoneId);

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
              {isEdit ? `agente · ${agent.name || ""}` : "office · nuevo agente"}
            </span>
            <h2 className="text-lg font-semibold tracking-tight mt-1">
              {isEdit ? "Editar agente" : "Crear agente"}
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
              <label htmlFor="agent-name" className="label">
                Nombre
              </label>
              <input
                id="agent-name"
                ref={nameRef}
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Atlas-07"
              />
            </div>

            <div>
              <label htmlFor="agent-zone" className="label">
                Zona
              </label>
              <select
                id="agent-zone"
                className="input"
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                required
              >
                <option value="" disabled>
                  Selecciona una zona…
                </option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name} {z.kind === "controller" ? "· orquestador" : ""}
                  </option>
                ))}
              </select>
              {currentZone && (
                <p className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)] mt-1">
                  tipo: {currentZone.type}
                </p>
              )}
            </div>

            {isEdit && (
              <div>
                <label className="label">Estado actual</label>
                <div className="flex items-center gap-2 px-3 h-9 rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
                  <span
                    className="status-dot"
                    data-status={agent.status || "idle"}
                  />
                  <span className="text-sm text-[color:var(--color-text)]">
                    {STATUS_LABEL[agent.status] || agent.status || "—"}
                  </span>
                  <span className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)] ml-auto">
                    asignado por el sistema
                  </span>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="agent-description" className="label">
                Descripción / Instrucciones{" "}
                <span className="text-[color:var(--color-text-dim)]">
                  (opcional)
                </span>
              </label>
              <textarea
                id="agent-description"
                className="input"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Qué hace este agente, su rol dentro de la zona, instrucciones específicas…"
              />
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
                  : "Crear agente"}
            </button>
          </footer>
        </form>
      </div>
    </div>,
    document.body
  );
}
