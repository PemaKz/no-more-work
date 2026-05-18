import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import timeAgo from "../../../utils/timeAgo";
import useTasks from "../../../hooks/useTasks";
import useContextEntries from "../../../hooks/useContextEntries";

const ZONE_TYPES = [
  { id: "research", label: "Research", color: "#8b5cf6" },
  { id: "build", label: "Build", color: "#06b6d4" },
  { id: "trade", label: "Trade", color: "#10b981" },
  { id: "monitor", label: "Monitor", color: "#f59e0b" },
  { id: "security", label: "Security", color: "#f43f5e" },
  { id: "comms", label: "Comms", color: "#0ea5e9" },
];

const PRESET_IDS = new Set(ZONE_TYPES.map((t) => t.id));
const DEFAULT_CUSTOM_COLOR = "#ec4899";

const COLOR_PALETTE = [
  "#8b5cf6", "#a855f7", "#ec4899", "#f43f5e",
  "#ef4444", "#f59e0b", "#84cc16", "#10b981",
  "#14b8a6", "#06b6d4", "#0ea5e9", "#6366f1",
];

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function slugifyType(value) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

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

const PlusIcon = (p) => (
  <svg viewBox="0 0 24 24" width="14" height="14" {...stroke} {...p}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
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

const PencilIcon = (p) => (
  <svg viewBox="0 0 24 24" width="14" height="14" {...stroke} {...p}>
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </svg>
);

const PlayIcon = (p) => (
  <svg viewBox="0 0 24 24" width="12" height="12" {...stroke} fill="currentColor" {...p}>
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const PinIcon = (p) => (
  <svg viewBox="0 0 24 24" width="14" height="14" {...stroke} {...p}>
    <path d="M12 17v5" />
    <path d="M9 10.76a2 2 0 0 1-1.11 1.79L7 13l-2 4h14l-2-4-.89-.45a2 2 0 0 1-1.11-1.79V5h.5a.5.5 0 0 0 0-1h-7a.5.5 0 0 0 0 1H10z" />
  </svg>
);

const TASK_STATUS_DOT = {
  pending: "idle",
  running: "working",
  done: "success",
  cancelled: "idle",
  error: "error",
};

const ENTRY_KIND_LABEL = {
  insight: "Insight",
  decision: "Decisión",
  observation: "Observación",
  memo: "Memo",
};

function Section({ title, subtitle, count, children, onAdd, addLabel = "Añadir" }) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{title}</h3>
            <span className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)]">
              {count}
            </span>
          </div>
          {subtitle && (
            <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5">{subtitle}</p>
          )}
        </div>
        <button type="button" onClick={onAdd} className="btn btn-secondary btn-sm">
          <PlusIcon />
          {addLabel}
        </button>
      </div>
      {children}
    </section>
  );
}

function ItemCard({ children, onRemove }) {
  return (
    <div className="border border-[color:var(--color-border)] rounded-[var(--radius)] bg-[color:var(--color-surface-2)] p-3 space-y-2 relative">
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-2 right-2 btn btn-ghost btn-sm btn-icon !h-7 !w-7 text-[color:var(--color-text-dim)] hover:text-[color:var(--color-status-error)]"
        aria-label="Eliminar"
        title="Eliminar"
      >
        <TrashIcon />
      </button>
      {children}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Operaciones: Tasks + Context entries (engine runtime data)
// ────────────────────────────────────────────────────────────────────────

function TasksPanel({ zone }) {
  const { tasks, createTask, deleteTask, runTask } = useTasks({
    zoneId: zone.id,
  });
  const isController = zone.kind === "controller";
  const [newTitle, setNewTitle] = useState("");
  // Default según contexto: deliberación en el orquestador, custom en el resto
  const [newType, setNewType] = useState(
    isController ? "deliberation" : "custom"
  );
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // No usamos <form> aquí porque este panel se renderiza dentro del form
  // principal del ZoneDialog y los forms anidados son HTML inválido.
  const handleCreate = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setCreating(true);
    setError("");
    try {
      await createTask({ zoneId: zone.id, title, type: newType });
      setNewTitle("");
      setNewType(isController ? "deliberation" : "custom");
    } catch (err) {
      setError(err.message || "No se pudo crear la task");
    } finally {
      setCreating(false);
    }
  };

  const handleRun = async (id) => {
    try {
      await runTask(id);
    } catch (err) {
      setError(err.message || "No se pudo ejecutar la task");
    }
  };

  return (
    <Section
      title="Tasks"
      subtitle={
        isController
          ? "Deliberaciones (consenso entre orquestadores que reparten tareas) y tasks propias del orquestador."
          : "Unidades de trabajo asignadas a esta zona. Pulsa play para ejecutar — los agentes con provider procesan la task vía LLM."
      }
      count={tasks.length}
      onAdd={() => {}}
      addLabel=""
    >
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          className="input !h-9 flex-1"
          placeholder={
            isController && newType === "deliberation"
              ? "¿Qué hay que decidir? (los orquestadores deliberarán)"
              : "Título de la task…"
          }
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleCreate();
            }
          }}
        />
        <select
          className="input !h-9 !w-32"
          value={newType}
          onChange={(e) => setNewType(e.target.value)}
          title="Tipo"
        >
          {isController && <option value="deliberation">Deliberación</option>}
          <option value="custom">Custom</option>
          <option value="objective">Objective</option>
          <option value="incident">Incident</option>
        </select>
        <button
          type="button"
          onClick={handleCreate}
          className="btn btn-primary btn-sm"
          disabled={creating || !newTitle.trim()}
        >
          {creating ? "Creando…" : "Crear"}
        </button>
      </div>

      {error && (
        <p className="text-xs text-[color:var(--color-status-error)]">
          {error}
        </p>
      )}

      {tasks.length === 0 ? (
        <p className="text-xs text-[color:var(--color-text-dim)] italic">
          Sin tasks.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {tasks.slice(0, 20).map((t) => (
            <li
              key={t.id}
              className="flex items-center gap-2 pl-3 pr-1 h-11 rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]"
            >
              <span
                className="status-dot"
                data-status={TASK_STATUS_DOT[t.status] || "idle"}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{t.title}</p>
                <p className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)]">
                  {t.status}
                  {t.finishedAt ? ` · ${timeAgo(t.finishedAt)}` : ""}
                  {!t.finishedAt && t.startedAt
                    ? ` · iniciada ${timeAgo(t.startedAt)}`
                    : ""}
                  {!t.startedAt ? ` · ${timeAgo(t.createdAt)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {(t.status === "pending" || t.status === "error") && (
                  <button
                    type="button"
                    onClick={() => handleRun(t.id)}
                    className="btn btn-ghost btn-sm btn-icon !h-8 !w-8 text-[color:var(--color-text-dim)] hover:text-[color:var(--color-accent)]"
                    aria-label="Ejecutar"
                    title="Ejecutar"
                  >
                    <PlayIcon />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => deleteTask(t.id)}
                  className="btn btn-ghost btn-sm btn-icon !h-8 !w-8 text-[color:var(--color-text-dim)] hover:text-[color:var(--color-status-error)]"
                  aria-label="Eliminar"
                  title="Eliminar"
                >
                  <TrashIcon />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function ContextEntriesPanel({ zone }) {
  const { entries, createEntry, updateEntry, deleteEntry } = useContextEntries({
    scope: "zone",
    scopeId: zone.id,
  });
  const [newContent, setNewContent] = useState("");
  const [newKind, setNewKind] = useState("memo");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const handleAdd = async () => {
    const content = newContent.trim();
    if (!content) return;
    setAdding(true);
    setError("");
    try {
      await createEntry({
        scope: "zone",
        scopeId: zone.id,
        kind: newKind,
        content,
      });
      setNewContent("");
    } catch (err) {
      setError(err.message || "No se pudo añadir");
    } finally {
      setAdding(false);
    }
  };

  return (
    <Section
      title="Log de contexto"
      subtitle="Retroalimentación auditable de los agentes (y entradas manuales). Pin = mantener, eliminar = cancelar la retroalimentación."
      count={entries.length}
      onAdd={() => {}}
      addLabel=""
    >
      <div className="flex gap-2 mb-2">
        <select
          className="input !h-9 !w-36"
          value={newKind}
          onChange={(e) => setNewKind(e.target.value)}
        >
          <option value="memo">Memo</option>
          <option value="observation">Observación</option>
          <option value="insight">Insight</option>
          <option value="decision">Decisión</option>
        </select>
        <input
          type="text"
          className="input !h-9 flex-1"
          placeholder="Añadir entrada manual…"
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <button
          type="button"
          onClick={handleAdd}
          className="btn btn-primary btn-sm"
          disabled={adding || !newContent.trim()}
        >
          {adding ? "…" : "Añadir"}
        </button>
      </div>

      {error && (
        <p className="text-xs text-[color:var(--color-status-error)]">
          {error}
        </p>
      )}

      {entries.length === 0 ? (
        <p className="text-xs text-[color:var(--color-text-dim)] italic">
          Sin entradas en el log.
        </p>
      ) : (
        <ul className="space-y-1.5 max-h-80 overflow-auto">
          {entries.slice(0, 50).map((e) => (
            <li
              key={e.id}
              className={[
                "flex items-start gap-2 px-3 py-2 rounded-[var(--radius)] border bg-[color:var(--color-surface-2)]",
                e.pinned
                  ? "border-[color:var(--color-accent)]"
                  : "border-[color:var(--color-border)]",
              ].join(" ")}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="badge">{ENTRY_KIND_LABEL[e.kind] || e.kind}</span>
                  <span className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)]">
                    {e.sourceType === "user"
                      ? "manual"
                      : e.sourceType === "agent"
                        ? "agente"
                        : "sistema"}
                    {" · "}
                    {timeAgo(e.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-[color:var(--color-text)] mt-1 whitespace-pre-wrap break-words">
                  {e.content}
                </p>
              </div>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => updateEntry(e.id, { pinned: !e.pinned })}
                  className={[
                    "btn btn-ghost btn-sm btn-icon !h-8 !w-8",
                    e.pinned
                      ? "text-[color:var(--color-accent)]"
                      : "text-[color:var(--color-text-dim)] hover:text-[color:var(--color-text)]",
                  ].join(" ")}
                  aria-label={e.pinned ? "Despinar" : "Pin"}
                  title={e.pinned ? "Despinar" : "Pin"}
                >
                  <PinIcon />
                </button>
                <button
                  type="button"
                  onClick={() => deleteEntry(e.id)}
                  className="btn btn-ghost btn-sm btn-icon !h-8 !w-8 text-[color:var(--color-text-dim)] hover:text-[color:var(--color-status-error)]"
                  aria-label="Eliminar"
                  title="Eliminar (cancelar retroalimentación)"
                >
                  <TrashIcon />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export default function ZoneDialog({
  open,
  mode = "create",
  zone = null,
  onClose,
  onSubmit,
  onDelete,
}) {
  const isEdit = mode === "edit" && !!zone;
  // La zona controladora no se puede eliminar.
  const isController = isEdit && zone?.kind === "controller";

  const [name, setName] = useState("");
  const [selection, setSelection] = useState("research"); // preset id o "custom"
  const [customType, setCustomType] = useState("");
  const [color, setColor] = useState(ZONE_TYPES[0].color);
  const [description, setDescription] = useState("");
  const [contexts, setContexts] = useState([]);
  const [mcps, setMcps] = useState([]);
  const [skills, setSkills] = useState([]);
  const [secrets, setSecrets] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Confirmación de eliminado en dos pasos
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const confirmTimerRef = useRef(null);

  const nameRef = useRef(null);

  // Init/reset al abrir según el modo
  useEffect(() => {
    if (!open) return;
    if (isEdit) {
      setName(zone.name || "");
      const isPreset = PRESET_IDS.has(zone.type);
      setSelection(isPreset ? zone.type : "custom");
      setCustomType(isPreset ? "" : zone.type || "");
      setColor(
        zone.color ||
          ZONE_TYPES.find((t) => t.id === zone.type)?.color ||
          DEFAULT_CUSTOM_COLOR
      );
      setDescription(zone.description || "");
      setContexts(
        (zone.contexts || []).map((c) => ({
          title: c.title || "",
          content: c.content || "",
        }))
      );
      setMcps(
        (zone.mcps || []).map((m) => ({
          name: m.name || "",
          transport: m.transport || "stdio",
          command: m.command || "",
          url: m.url || "",
          enabled: m.enabled !== false,
        }))
      );
      setSkills(
        (zone.skills || []).map((s) => ({
          name: s.name || "",
          description: s.description || "",
          enabled: s.enabled !== false,
        }))
      );
      setSecrets(
        (zone.secrets || []).map((s) => ({
          id: s.id,
          key: s.key || "",
          description: s.description || "",
          hasValue: !!s.hasValue,
          updatedAt: s.updatedAt,
          // `value` queda undefined: si el usuario no lo edita, no lo
          // mandaremos al servidor y el valor cifrado se preserva.
          _editingValue: false,
          _revealed: false,
        }))
      );
    } else {
      setName("");
      setSelection("research");
      setCustomType("");
      setColor(ZONE_TYPES[0].color);
      setDescription("");
      setContexts([]);
      setMcps([]);
      setSkills([]);
      setSecrets([]);
    }
    setError("");
    setSubmitting(false);
    setConfirmDelete(false);
    setDeleting(false);
    requestAnimationFrame(() => nameRef.current?.focus());
  }, [open, isEdit, zone]);

  // Esc cierra
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Limpia el timer de confirmación al desmontar
  useEffect(
    () => () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    },
    []
  );

  if (!open) return null;

  const isCustom = selection === "custom";
  const selectPreset = (preset) => {
    setSelection(preset.id);
    setColor(preset.color);
  };
  const selectCustom = () => {
    setSelection("custom");
    if (PRESET_IDS.has(selection)) {
      setColor(DEFAULT_CUSTOM_COLOR);
    }
  };

  // Contexts
  const addContext = () => setContexts((c) => [...c, { title: "", content: "" }]);
  const updateContext = (i, key, value) =>
    setContexts((cs) => cs.map((c, idx) => (idx === i ? { ...c, [key]: value } : c)));
  const removeContext = (i) => setContexts((cs) => cs.filter((_, idx) => idx !== i));

  // MCPs
  const addMcp = () =>
    setMcps((ms) => [
      ...ms,
      { name: "", transport: "stdio", command: "", url: "", enabled: true },
    ]);
  const updateMcp = (i, key, value) =>
    setMcps((ms) => ms.map((m, idx) => (idx === i ? { ...m, [key]: value } : m)));
  const removeMcp = (i) => setMcps((ms) => ms.filter((_, idx) => idx !== i));

  // Skills
  const addSkill = () =>
    setSkills((ss) => [...ss, { name: "", description: "", enabled: true }]);
  const updateSkill = (i, key, value) =>
    setSkills((ss) => ss.map((s, idx) => (idx === i ? { ...s, [key]: value } : s)));
  const removeSkill = (i) => setSkills((ss) => ss.filter((_, idx) => idx !== i));

  // Secrets / env vars
  const addSecret = () =>
    setSecrets((ss) => [
      ...ss,
      {
        key: "",
        value: "",
        description: "",
        hasValue: false,
        _editingValue: true,
        _revealed: true,
      },
    ]);
  const updateSecret = (i, key, value) =>
    setSecrets((ss) =>
      ss.map((s, idx) => (idx === i ? { ...s, [key]: value } : s))
    );
  const removeSecret = (i) =>
    setSecrets((ss) => ss.filter((_, idx) => idx !== i));
  const toggleSecretReveal = (i) =>
    setSecrets((ss) =>
      ss.map((s, idx) => (idx === i ? { ...s, _revealed: !s._revealed } : s))
    );
  // Activa el input de valor (solo aplica a secrets ya guardados)
  const startEditSecretValue = (i) =>
    setSecrets((ss) =>
      ss.map((s, idx) =>
        idx === i
          ? { ...s, _editingValue: true, _revealed: true, value: "" }
          : s
      )
    );
  // Cancela la edición: descarta el valor → backend preservará el cifrado
  const cancelEditSecretValue = (i) =>
    setSecrets((ss) =>
      ss.map((s, idx) =>
        idx === i
          ? { ...s, _editingValue: false, _revealed: false, value: undefined }
          : s
      )
    );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    let finalType = selection;
    if (isCustom) {
      finalType = slugifyType(customType) || "custom";
    }
    if (!HEX_RE.test(color)) {
      setError("Color inválido. Debe ser un hex tipo #ff6b00.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await onSubmit({
        name: name.trim(),
        type: finalType,
        color: color.toLowerCase(),
        description: description.trim() || undefined,
        contexts: contexts
          .filter((c) => (c.content || "").trim())
          .map((c) => ({ title: c.title?.trim() || null, content: c.content.trim() })),
        mcps: mcps
          .filter((m) => (m.name || "").trim())
          .map((m) => ({
            name: m.name.trim(),
            transport: m.transport,
            command: m.command?.trim() || null,
            url: m.url?.trim() || null,
            enabled: m.enabled !== false,
          })),
        skills: skills
          .filter((s) => (s.name || "").trim())
          .map((s) => ({
            name: s.name.trim(),
            description: s.description?.trim() || null,
            enabled: s.enabled !== false,
          })),
        secrets: secrets
          .filter((s) => (s.key || "").trim())
          .map((s) => {
            const item = {
              key: s.key.trim().toUpperCase(),
              description: s.description?.trim() || null,
            };
            // Solo enviamos `value` si el usuario lo editó. Sin él, el
            // servidor preserva el valor cifrado existente.
            if (typeof s.value === "string") item.value = s.value;
            return item;
          }),
      });
      onClose();
    } catch (err) {
      setError(err.message || (isEdit ? "No se pudo guardar la zona" : "No se pudo crear la zona"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = async () => {
    if (!isEdit) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = setTimeout(() => setConfirmDelete(false), 3000);
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
      setError(err.message || "No se pudo eliminar la zona");
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
        className="bg-[color:var(--color-surface-1)] border border-[color:var(--color-border)] rounded-[var(--radius-lg)] w-full max-w-[1500px] h-[92vh] flex flex-col overflow-hidden"
        style={{ boxShadow: "var(--shadow-float)" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="px-5 py-4 border-b border-[color:var(--color-border)] flex items-start justify-between gap-3">
          <div>
            <span className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)]">
              {isEdit ? `office · ${zone.name || "zona"}` : "office · nueva zona"}
            </span>
            <h2 className="text-lg font-semibold tracking-tight mt-1">
              {isEdit ? "Editar zona" : "Configurar zona"}
            </h2>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isController && (
              <span
                className="badge"
                data-status="working"
                title="Esta zona es la controladora del office — no se puede eliminar."
              >
                controlador
              </span>
            )}
            {isEdit && !isController && (
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

        {/* Body wrapper: 2 columnas (config | runtime). La izquierda es el
            <form>; la derecha es siblings — así evitamos forms anidados y
            cada panel scrollea independiente. En create la derecha muestra
            un placeholder (Tasks/Log requieren zona creada). */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 lg:grid lg:grid-cols-2">
            <form
              id="zone-form"
              onSubmit={handleSubmit}
              className="overflow-auto p-5 space-y-6 min-h-0 lg:border-r lg:border-[color:var(--color-border)]"
            >
            {/* Básicos */}
            <div className="space-y-4">
              {isController ? (
                // El orquestador es una zona única e identitaria — su nombre
                // y tipo los fija el sistema y no se renombran/recambian.
                <div>
                  <label className="label">Identidad</label>
                  <div className="flex items-center gap-3 px-3 h-11 rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-sm font-medium truncate">{name}</span>
                    <span className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)] ml-auto flex-shrink-0">
                      {selection === "custom" ? customType || "custom" : selection} · orquestador
                    </span>
                  </div>
                  <p className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)] mt-1">
                    el orquestador no puede renombrarse ni cambiar de tipo
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label htmlFor="zone-name" className="label">
                      Nombre
                    </label>
                    <input
                      id="zone-name"
                      ref={nameRef}
                      className="input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      placeholder="research-lab"
                    />
                  </div>

                  <div>
                    <label className="label">Tipo</label>
                    <div className="grid grid-cols-3 gap-2">
                      {ZONE_TYPES.map((zt) => {
                        const active = zt.id === selection;
                        return (
                          <button
                            type="button"
                            key={zt.id}
                            onClick={() => selectPreset(zt)}
                            className={[
                              "flex items-center gap-2 h-9 px-3 rounded-[var(--radius)] border text-xs font-medium uppercase tracking-wider transition-colors",
                              active
                                ? "bg-[color:var(--color-surface-3)]"
                                : "text-[color:var(--color-text-muted)] border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)] hover:text-[color:var(--color-text)]",
                            ].join(" ")}
                            style={
                              active
                                ? { borderColor: zt.color, color: zt.color }
                                : undefined
                            }
                          >
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: zt.color }}
                            />
                            <span className="truncate">{zt.label}</span>
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={selectCustom}
                        className={[
                          "col-span-3 flex items-center gap-2 h-9 px-3 rounded-[var(--radius)] border text-xs font-medium uppercase tracking-wider transition-colors",
                          isCustom
                            ? "bg-[color:var(--color-surface-3)]"
                            : "text-[color:var(--color-text-muted)] border-[color:var(--color-border)] border-dashed hover:border-[color:var(--color-border-strong)] hover:text-[color:var(--color-text)]",
                        ].join(" ")}
                        style={isCustom ? { borderColor: color, color } : undefined}
                      >
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor: isCustom ? color : "transparent",
                            border: isCustom ? "none" : "1px dashed currentColor",
                          }}
                        />
                        <span className="truncate">+ Personalizado</span>
                      </button>
                    </div>

                    {isCustom && (
                      <div className="mt-3 p-3 rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] space-y-3">
                        <div>
                          <label htmlFor="zone-custom-type" className="label">
                            Nombre del tipo
                          </label>
                          <input
                            id="zone-custom-type"
                            className="input !h-9 !font-mono !text-[13px]"
                            value={customType}
                            onChange={(e) => setCustomType(e.target.value)}
                            placeholder="marketing"
                            maxLength={32}
                          />
                          <p className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)] mt-1">
                            slug: {slugifyType(customType) || "custom"}
                          </p>
                        </div>
                        <div>
                          <label className="label">Color</label>
                          <div className="flex items-center gap-2 flex-wrap">
                            {COLOR_PALETTE.map((c) => {
                              const sel = c.toLowerCase() === color.toLowerCase();
                              return (
                                <button
                                  type="button"
                                  key={c}
                                  onClick={() => setColor(c)}
                                  aria-label={`Color ${c}`}
                                  className="w-7 h-7 rounded-full transition-transform"
                                  style={{
                                    backgroundColor: c,
                                    outline: sel
                                      ? `2px solid var(--color-text)`
                                      : "1px solid var(--color-border)",
                                    outlineOffset: sel ? 2 : 0,
                                  }}
                                />
                              );
                            })}
                            <input
                              type="text"
                              value={color}
                              onChange={(e) => setColor(e.target.value)}
                              className="input !h-9 !w-28 !font-mono !text-[12px] uppercase"
                              maxLength={7}
                              placeholder="#ec4899"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              <div>
                <label htmlFor="zone-description" className="label">
                  Descripción <span className="text-[color:var(--color-text-dim)]">(opcional)</span>
                </label>
                <textarea
                  id="zone-description"
                  className="input"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Para qué sirve esta zona…"
                />
              </div>
            </div>

            <hr className="border-[color:var(--color-border)]" />

            {/* Contexts */}
            <Section
              title="Contextos"
              subtitle="Instrucciones e información compartida con los agentes de la zona."
              count={contexts.length}
              onAdd={addContext}
              addLabel="Añadir contexto"
            >
              {contexts.length === 0 ? (
                <p className="text-xs text-[color:var(--color-text-dim)] italic">
                  Sin contextos. Los agentes operarán solo con sus instrucciones por defecto.
                </p>
              ) : (
                <div className="space-y-2">
                  {contexts.map((c, i) => (
                    <ItemCard key={i} onRemove={() => removeContext(i)}>
                      <input
                        className="input !h-9 pr-10"
                        placeholder="Título (opcional)"
                        value={c.title}
                        onChange={(e) => updateContext(i, "title", e.target.value)}
                      />
                      <textarea
                        className="input"
                        rows={3}
                        placeholder="Contenido del contexto…"
                        value={c.content}
                        onChange={(e) => updateContext(i, "content", e.target.value)}
                      />
                    </ItemCard>
                  ))}
                </div>
              )}
            </Section>

            <hr className="border-[color:var(--color-border)]" />

            {/* MCPs */}
            <Section
              title="MCP servers"
              subtitle="Servidores Model Context Protocol disponibles para los agentes."
              count={mcps.length}
              onAdd={addMcp}
              addLabel="Añadir MCP"
            >
              {mcps.length === 0 ? (
                <p className="text-xs text-[color:var(--color-text-dim)] italic">
                  Sin MCPs. Los agentes no tendrán herramientas externas.
                </p>
              ) : (
                <div className="space-y-2">
                  {mcps.map((m, i) => (
                    <ItemCard key={i} onRemove={() => removeMcp(i)}>
                      <div className="grid grid-cols-[1fr_auto] gap-2 pr-10">
                        <input
                          className="input !h-9"
                          placeholder="Nombre (ej. web-search)"
                          value={m.name}
                          onChange={(e) => updateMcp(i, "name", e.target.value)}
                        />
                        <select
                          className="input !h-9 !w-28"
                          value={m.transport}
                          onChange={(e) => updateMcp(i, "transport", e.target.value)}
                        >
                          <option value="stdio">stdio</option>
                          <option value="http">http</option>
                          <option value="sse">sse</option>
                        </select>
                      </div>
                      {m.transport === "stdio" ? (
                        <input
                          className="input !h-9"
                          placeholder="Comando (ej. npx -y @modelcontextprotocol/server-filesystem /path)"
                          value={m.command}
                          onChange={(e) => updateMcp(i, "command", e.target.value)}
                        />
                      ) : (
                        <input
                          className="input !h-9"
                          placeholder="URL del servidor"
                          type="url"
                          value={m.url}
                          onChange={(e) => updateMcp(i, "url", e.target.value)}
                        />
                      )}
                    </ItemCard>
                  ))}
                </div>
              )}
            </Section>

            <hr className="border-[color:var(--color-border)]" />

            {/* Skills */}
            <Section
              title="Skills"
              subtitle="Capacidades específicas que los agentes de esta zona podrán ejecutar."
              count={skills.length}
              onAdd={addSkill}
              addLabel="Añadir skill"
            >
              {skills.length === 0 ? (
                <p className="text-xs text-[color:var(--color-text-dim)] italic">
                  Sin skills. Los agentes operarán solo con capacidades de base.
                </p>
              ) : (
                <div className="space-y-2">
                  {skills.map((s, i) => (
                    <ItemCard key={i} onRemove={() => removeSkill(i)}>
                      <input
                        className="input !h-9 pr-10"
                        placeholder="Nombre (ej. summarize)"
                        value={s.name}
                        onChange={(e) => updateSkill(i, "name", e.target.value)}
                      />
                      <textarea
                        className="input"
                        rows={2}
                        placeholder="Descripción de la skill…"
                        value={s.description}
                        onChange={(e) => updateSkill(i, "description", e.target.value)}
                      />
                    </ItemCard>
                  ))}
                </div>
              )}
            </Section>

            <hr className="border-[color:var(--color-border)]" />

            {/* Secrets */}
            <Section
              title="Secrets / Env vars"
              subtitle="Variables sensibles inyectables en MCPs y agentes. Cifradas en BD con AES-256-GCM — el servidor nunca devuelve el valor, solo cuándo se actualizó por última vez."
              count={secrets.length}
              onAdd={addSecret}
              addLabel="Añadir secret"
            >
              {secrets.length === 0 ? (
                <p className="text-xs text-[color:var(--color-text-dim)] italic">
                  Sin secrets propios. Si la organización tiene globales, los
                  heredarás automáticamente.
                </p>
              ) : (
                <div className="space-y-2">
                  {secrets.map((s, i) => {
                    const isExisting = !!s.id;
                    const isEditing = !isExisting || s._editingValue;

                    // Modo compacto: una sola línea con key · desc · fecha.
                    if (!isEditing) {
                      return (
                        <div
                          key={s.id}
                          className="flex items-center gap-2 pl-3 pr-1 h-11 rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]"
                        >
                          <span className="mono text-[12px] uppercase tracking-wider font-semibold text-[color:var(--color-text)] flex-shrink-0">
                            {s.key}
                          </span>
                          {s.description && (
                            <span className="text-xs text-[color:var(--color-text-muted)] truncate min-w-0">
                              {s.description}
                            </span>
                          )}
                          <span className="flex-1" />
                          {s.updatedAt && (
                            <span className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)] flex-shrink-0">
                              {timeAgo(s.updatedAt)}
                            </span>
                          )}
                          <div className="flex items-center gap-0.5 flex-shrink-0 ml-1">
                            <button
                              type="button"
                              onClick={() => startEditSecretValue(i)}
                              className="btn btn-ghost btn-sm btn-icon !h-8 !w-8 text-[color:var(--color-text-dim)] hover:text-[color:var(--color-text)]"
                              aria-label="Editar"
                              title="Editar"
                            >
                              <PencilIcon />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeSecret(i)}
                              className="btn btn-ghost btn-sm btn-icon !h-8 !w-8 text-[color:var(--color-text-dim)] hover:text-[color:var(--color-status-error)]"
                              aria-label="Eliminar"
                              title="Eliminar"
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        </div>
                      );
                    }

                    // Modo edición: form completo.
                    return (
                      <ItemCard key={s.id ?? `new-${i}`} onRemove={() => removeSecret(i)}>
                        <input
                          className="input !h-9 pr-10 !font-mono !text-[13px] uppercase disabled:opacity-60"
                          placeholder="API_KEY"
                          value={s.key}
                          onChange={(e) =>
                            updateSecret(i, "key", e.target.value)
                          }
                          autoCapitalize="characters"
                          spellCheck={false}
                          disabled={isExisting}
                          title={isExisting ? "Para renombrar: elimina y crea uno nuevo" : undefined}
                        />
                        <div className="relative">
                          <input
                            className="input !h-9 !font-mono !text-[13px] pr-20"
                            type={s._revealed ? "text" : "password"}
                            placeholder={isExisting ? "Nuevo valor" : "Valor"}
                            value={s.value ?? ""}
                            onChange={(e) =>
                              updateSecret(i, "value", e.target.value)
                            }
                            autoComplete="off"
                            spellCheck={false}
                            autoFocus={isExisting}
                          />
                          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                            <button
                              type="button"
                              onClick={() => toggleSecretReveal(i)}
                              className="text-[color:var(--color-text-dim)] hover:text-[color:var(--color-text)] p-1.5"
                              aria-label={s._revealed ? "Ocultar valor" : "Mostrar valor"}
                              title={s._revealed ? "Ocultar" : "Mostrar"}
                            >
                              {s._revealed ? <EyeOffIcon /> : <EyeIcon />}
                            </button>
                            {isExisting && (
                              <button
                                type="button"
                                onClick={() => cancelEditSecretValue(i)}
                                className="text-[color:var(--color-text-dim)] hover:text-[color:var(--color-text)] p-1.5"
                                aria-label="Cancelar cambio de valor"
                                title="Cancelar (mantener valor actual)"
                              >
                                <CloseIcon />
                              </button>
                            )}
                          </div>
                        </div>
                        <input
                          className="input !h-9"
                          placeholder="Descripción (opcional)"
                          value={s.description || ""}
                          onChange={(e) =>
                            updateSecret(i, "description", e.target.value)
                          }
                        />
                      </ItemCard>
                    );
                  })}
                </div>
              )}
            </Section>
            </form>

            {/* RIGHT COLUMN: runtime / ops. En edit muestra tasks + log
                reales. En create solo un placeholder porque los paneles
                requieren un zone.id existente. */}
            {isEdit ? (
              <div className="overflow-auto p-5 space-y-6 min-h-0 border-t border-[color:var(--color-border)] lg:border-t-0">
                <TasksPanel zone={zone} />

                <hr className="border-[color:var(--color-border)]" />

                <ContextEntriesPanel zone={zone} />
              </div>
            ) : (
              <div className="overflow-auto p-5 min-h-0 border-t border-[color:var(--color-border)] lg:border-t-0 flex items-center justify-center">
                <div className="text-center space-y-2 max-w-sm">
                  <p className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)]">
                    runtime · pendiente
                  </p>
                  <p className="text-sm text-[color:var(--color-text-muted)]">
                    Tasks y log de contexto aparecerán aquí en cuanto crees la zona.
                  </p>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="px-5 py-3 border-t border-[color:var(--color-border)] bg-[color:var(--color-status-error)]/10">
              <p className="text-sm text-[color:var(--color-status-error)]">{error}</p>
            </div>
          )}

          <footer className="px-5 py-4 border-t border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] flex items-center justify-between gap-3">
            <span className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)]">
              {contexts.length} contextos · {mcps.length} mcps · {skills.length} skills · {secrets.length} secrets
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary btn-sm"
                disabled={submitting || deleting}
              >
                Cancelar
              </button>
              {/* form="zone-form" enlaza el submit con el form de la
                  izquierda, que vive fuera de este footer (necesario porque
                  en edit el form y el footer son hermanos). */}
              <button
                type="submit"
                form="zone-form"
                className="btn btn-primary btn-sm"
                disabled={submitting || deleting}
              >
                {submitting
                  ? isEdit
                    ? "Guardando…"
                    : "Creando…"
                  : isEdit
                    ? "Guardar cambios"
                    : "Crear zona"}
              </button>
            </div>
          </footer>
        </div>
      </div>
    </div>,
    document.body
  );
}
