import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useProviders from "../../../hooks/useProviders";
import useAgentEvents from "../../../hooks/useAgentEvents";
import timeAgo from "../../../utils/timeAgo";

const STATUS_LABEL = {
  idle: "Inactivo",
  working: "Trabajando",
  success: "OK",
  warning: "Atención",
  error: "Error",
};

// Mapeo kind → etiqueta y color de dot del status (reusa el sistema existente).
const EVENT_META = {
  tick_start: { label: "tick", dot: "working" },
  tick_end: { label: "tick", dot: "success" },
  tick_error: { label: "tick", dot: "error" },
  task_start: { label: "task", dot: "working" },
  task_end: { label: "task", dot: "success" },
  task_error: { label: "task", dot: "error" },
  deliberation_turn: { label: "delib", dot: "success" },
  deliberation_error: { label: "delib", dot: "error" },
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

/**
 * Timeline cronológico (más reciente arriba) de eventos del agente.
 * Cada item: dot de status + etiqueta corta + tiempo relativo + summary.
 * Expandible: click sobre uno para ver el detalle (text generado + toolCalls).
 *
 * Tick en vivo cada 30s para refrescar el "hace Xs" sin esperar a un
 * nuevo evento (solo afecta a `timeAgo`, no re-fetcha).
 */
function ActivityTimeline({ agentId }) {
  const { events, isLoading, error } = useAgentEvents(agentId, { limit: 60 });
  const [expandedId, setExpandedId] = useState(null);
  const [, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // Resumen numérico arriba del timeline para vista rápida.
  const counts = useMemo(() => {
    const c = { ticks: 0, tasks: 0, errors: 0 };
    for (const e of events) {
      if (e.kind === "tick_end") c.ticks++;
      else if (e.kind === "task_end") c.tasks++;
      else if (e.kind.endsWith("_error")) c.errors++;
    }
    return c;
  }, [events]);

  return (
    <div className="space-y-3 h-full flex flex-col min-h-0">
      <div>
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold">Actividad</h3>
          <span className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)]">
            live · últimas {events.length}
          </span>
        </div>
        <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5">
          Cada tick, task o turno de deliberación queda registrado. Click para
          ver el detalle.
        </p>
        <div className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)] mt-2 flex gap-3">
          <span>{counts.ticks} ticks</span>
          <span>{counts.tasks} tasks</span>
          {counts.errors > 0 && (
            <span className="text-[color:var(--color-status-error)]">
              {counts.errors} errores
            </span>
          )}
        </div>
      </div>

      {error && (
        <p className="text-xs text-[color:var(--color-status-error)]">
          {error.message || "Error cargando eventos"}
        </p>
      )}

      {!isLoading && events.length === 0 && (
        <div className="text-center py-8">
          <p className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)]">
            sin actividad
          </p>
          <p className="text-xs text-[color:var(--color-text-muted)] mt-2">
            Cuando el agente haga un tick o procese una task aparecerá aquí.
          </p>
        </div>
      )}

      {events.length > 0 && (
        <ul className="space-y-1.5 flex-1 overflow-auto pr-1">
          {events.map((e) => {
            const meta = EVENT_META[e.kind] || { label: e.kind, dot: "idle" };
            const isExpanded = expandedId === e.id;
            const hasDetail =
              e.detail &&
              (e.detail.text || (e.detail.toolCalls || []).length > 0 || e.detail.error);
            return (
              <li
                key={e.id}
                className="border border-[color:var(--color-border)] rounded-[var(--radius)] bg-[color:var(--color-surface-2)] overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedId(isExpanded ? null : e.id)
                  }
                  className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-[color:var(--color-surface-3)] transition-colors"
                  disabled={!hasDetail}
                >
                  <span
                    className="status-dot mt-1 flex-shrink-0"
                    data-status={meta.dot}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)]">
                        {meta.label}
                      </span>
                      <span className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)] ml-auto flex-shrink-0">
                        {timeAgo(e.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-[color:var(--color-text)] mt-0.5 whitespace-pre-wrap break-words">
                      {e.summary}
                    </p>
                  </div>
                </button>
                {isExpanded && hasDetail && (
                  <div className="px-3 pb-3 pt-1 border-t border-[color:var(--color-border)] space-y-2">
                    {e.detail.error && (
                      <div>
                        <p className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-status-error)] mb-1">
                          error
                        </p>
                        <p className="mono text-[11px] text-[color:var(--color-status-error)] whitespace-pre-wrap break-words">
                          {e.detail.error}
                        </p>
                      </div>
                    )}
                    {(e.detail.toolCalls || []).length > 0 && (
                      <div>
                        <p className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)] mb-1">
                          tool calls ({e.detail.toolCalls.length})
                        </p>
                        <ul className="mono text-[11px] space-y-0.5">
                          {e.detail.toolCalls.map((tc, i) => (
                            <li
                              key={i}
                              className="text-[color:var(--color-text-muted)]"
                            >
                              → {tc}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {e.detail.text && (
                      <div>
                        <p className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)] mb-1">
                          texto generado
                        </p>
                        <p className="text-[12px] text-[color:var(--color-text-muted)] whitespace-pre-wrap break-words bg-[color:var(--color-surface-1)] p-2 rounded-[var(--radius-sm)] border border-[color:var(--color-border)]">
                          {e.detail.text}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

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
  const [role, setRole] = useState("");
  const [providerId, setProviderId] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [loopIntervalSec, setLoopIntervalSec] = useState(300);
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
      setRole(agent.role || "");
      setProviderId(agent.providerId || "");
      setSystemPrompt(agent.systemPrompt || "");
      setLoopEnabled(agent.loopEnabled === true);
      setLoopIntervalSec(agent.loopIntervalSec || 300);
    } else {
      setName("");
      setZoneId(defaultZoneId || zones[0]?.id || "");
      setDescription("");
      setRole("");
      setProviderId("");
      setSystemPrompt("");
      setLoopEnabled(false);
      setLoopIntervalSec(300);
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

  // Todos los hooks deben llamarse en el mismo orden cada render — incluido
  // useProviders. NO mover bajo el early return de `open`.
  const { providers } = useProviders();

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
        role: role.trim() || null,
        providerId: providerId || null,
        systemPrompt: systemPrompt.trim() || null,
        loopEnabled,
        loopIntervalSec: Math.max(30, parseInt(loopIntervalSec, 10) || 300),
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
  const isController = currentZone?.kind === "controller";

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className={[
          "bg-[color:var(--color-surface-1)] border border-[color:var(--color-border)] rounded-[var(--radius-lg)] w-full flex flex-col overflow-hidden",
          // En edit añadimos la 3ª columna (Actividad) y ensanchamos el modal.
          isEdit ? "max-w-[1400px] h-[88vh]" : "max-w-4xl max-h-[88vh]",
        ].join(" ")}
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
          {/* Layout: en create, 2 cols (Identidad | Motor). En edit, 3 cols
              añadiendo la 3ª Actividad — timeline en vivo de lo que hace
              el agente (ticks, tasks, errores). */}
          <div
            className={[
              "flex-1 min-h-0 grid grid-cols-1",
              isEdit ? "lg:grid-cols-3" : "lg:grid-cols-2",
            ].join(" ")}
          >
            {/* ── LEFT: Identity ─────────────────────────────────────── */}
            <div className="overflow-auto p-5 space-y-4 min-h-0 lg:border-r lg:border-[color:var(--color-border)]">
              <div>
                <div className="flex items-baseline justify-between">
                  <h3 className="text-sm font-semibold">Identidad</h3>
                  <span className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)]">
                    quién es
                  </span>
                </div>
                <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5">
                  Nombre, zona donde vive y qué hace en una línea.
                </p>
              </div>

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
                  {/* Zonas estándar primero; el orquestador al final para que
                      no sea la elección por defecto en flujos no dedicados. */}
                  {zones
                    .filter((z) => z.kind !== "controller")
                    .map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name}
                      </option>
                    ))}
                  {zones
                    .filter((z) => z.kind === "controller")
                    .map((z) => (
                      <option key={z.id} value={z.id}>
                        ★ {z.name} · orquestador
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
                  Descripción{" "}
                  <span className="text-[color:var(--color-text-dim)]">
                    (opcional)
                  </span>
                </label>
                <textarea
                  id="agent-description"
                  className="input"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Qué hace este agente en una línea…"
                />
              </div>
            </div>

            {/* ── RIGHT: Engine ──────────────────────────────────────── */}
            <div className="overflow-auto p-5 space-y-4 min-h-0 border-t border-[color:var(--color-border)] lg:border-t-0">
              <div>
                <div className="flex items-baseline justify-between">
                  <h3 className="text-sm font-semibold">Motor</h3>
                  <span className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)]">
                    engine
                  </span>
                </div>
                <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5">
                  Provider LLM, prompt y comportamiento de loop. Sin provider, el
                  agente no ejecuta nada.
                </p>
              </div>

              {isController && (
                <div>
                  <label htmlFor="agent-role" className="label">
                    Rol{" "}
                    <span className="text-[color:var(--color-text-dim)]">
                      (orquestador)
                    </span>
                  </label>
                  <input
                    id="agent-role"
                    className="input !font-mono !text-[13px]"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="planner / executor / critic / facilitator…"
                  />
                  <p className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)] mt-1">
                    rol semántico para el consenso entre orquestadores
                  </p>
                </div>
              )}

              <div>
                <label htmlFor="agent-provider" className="label">
                  Provider
                </label>
                <select
                  id="agent-provider"
                  className="input"
                  value={providerId}
                  onChange={(e) => setProviderId(e.target.value)}
                >
                  <option value="">— Sin provider (no ejecuta) —</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.defaultModel}
                    </option>
                  ))}
                </select>
                {providers.length === 0 && (
                  <p className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-status-warning)] mt-1">
                    no hay providers · config → providers
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="agent-prompt" className="label">
                  System prompt{" "}
                  <span className="text-[color:var(--color-text-dim)]">
                    (opcional)
                  </span>
                </label>
                <textarea
                  id="agent-prompt"
                  className="input !font-mono !text-[12px]"
                  rows={6}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Eres un agente que… (se concatena con contexto de zona/org en runtime)"
                />
              </div>

              <div>
                <label className="label">Loop autónomo</label>
                <div className="flex items-center gap-3 px-3 h-10 rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={loopEnabled}
                      onChange={(e) => setLoopEnabled(e.target.checked)}
                      className="accent-[color:var(--color-accent)]"
                    />
                    <span className="text-sm">
                      Activar tick periódico
                    </span>
                  </label>
                  {loopEnabled && (
                    <div className="ml-auto flex items-center gap-2">
                      <span className="mono text-[11px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
                        cada
                      </span>
                      <input
                        type="number"
                        min={30}
                        step={30}
                        value={loopIntervalSec}
                        onChange={(e) => setLoopIntervalSec(e.target.value)}
                        className="input !h-7 !w-20 !text-[12px] !font-mono"
                      />
                      <span className="mono text-[11px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
                        segundos
                      </span>
                    </div>
                  )}
                </div>
                <p className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)] mt-1">
                  trabaja sobre su contexto sin necesitar task explícita
                </p>
              </div>
            </div>

            {/* ── COL 3: Actividad (solo en edit, agente ya creado) ──── */}
            {isEdit && (
              <div className="overflow-auto p-5 min-h-0 border-t border-[color:var(--color-border)] lg:border-t-0 lg:border-l">
                <ActivityTimeline agentId={agent.id} />
              </div>
            )}
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
