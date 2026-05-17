import { useEffect, useState } from "react";
import useConfig from "../../../hooks/useConfig";
import useAuth from "../../../hooks/useAuth";
import timeAgo from "../../../utils/timeAgo";

// ─────────────────────────────────────────────────────────────────────────────
// Iconos
// ─────────────────────────────────────────────────────────────────────────────

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

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

const CloseIcon = (p) => (
  <svg viewBox="0 0 24 24" width="14" height="14" {...stroke} {...p}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const PencilIcon = (p) => (
  <svg viewBox="0 0 24 24" width="14" height="14" {...stroke} {...p}>
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// Reusable bits
// ─────────────────────────────────────────────────────────────────────────────

function Section({ title, subtitle, count, children, onAdd, addLabel = "Añadir" }) {
  return (
    <section className="panel !p-5 space-y-4">
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
    <div className="border border-[color:var(--color-border)] rounded-[var(--radius)] bg-[color:var(--color-surface-3)] p-3 space-y-2 relative">
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

// ─────────────────────────────────────────────────────────────────────────────
// Resources tab
// ─────────────────────────────────────────────────────────────────────────────

function ResourcesTab({ config, updateConfig, isLoading }) {
  const [contexts, setContexts] = useState([]);
  const [mcps, setMcps] = useState([]);
  const [skills, setSkills] = useState([]);
  const [secrets, setSecrets] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  // sincroniza estado local desde el servidor
  useEffect(() => {
    if (!config) return;
    setContexts(
      (config.contexts || []).map((c) => ({
        title: c.title || "",
        content: c.content || "",
      }))
    );
    setMcps(
      (config.mcps || []).map((m) => ({
        name: m.name || "",
        transport: m.transport || "stdio",
        command: m.command || "",
        url: m.url || "",
        enabled: m.enabled !== false,
      }))
    );
    setSkills(
      (config.skills || []).map((s) => ({
        name: s.name || "",
        description: s.description || "",
        enabled: s.enabled !== false,
      }))
    );
    setSecrets(
      (config.secrets || []).map((s) => ({
        id: s.id,
        key: s.key || "",
        description: s.description || "",
        hasValue: !!s.hasValue,
        updatedAt: s.updatedAt,
        // value undefined: si no se edita, no se manda → backend preserva
        _editingValue: false,
        _revealed: false,
      }))
    );
    setDirty(false);
  }, [config]);

  const markDirty = () => {
    setDirty(true);
    setSavedFlash(false);
  };

  // Contexts handlers
  const addContext = () => {
    setContexts((cs) => [...cs, { title: "", content: "" }]);
    markDirty();
  };
  const updateContext = (i, key, value) => {
    setContexts((cs) => cs.map((c, idx) => (idx === i ? { ...c, [key]: value } : c)));
    markDirty();
  };
  const removeContext = (i) => {
    setContexts((cs) => cs.filter((_, idx) => idx !== i));
    markDirty();
  };

  // MCPs handlers
  const addMcp = () => {
    setMcps((ms) => [
      ...ms,
      { name: "", transport: "stdio", command: "", url: "", enabled: true },
    ]);
    markDirty();
  };
  const updateMcp = (i, key, value) => {
    setMcps((ms) => ms.map((m, idx) => (idx === i ? { ...m, [key]: value } : m)));
    markDirty();
  };
  const removeMcp = (i) => {
    setMcps((ms) => ms.filter((_, idx) => idx !== i));
    markDirty();
  };

  // Skills handlers
  const addSkill = () => {
    setSkills((ss) => [...ss, { name: "", description: "", enabled: true }]);
    markDirty();
  };
  const updateSkill = (i, key, value) => {
    setSkills((ss) => ss.map((s, idx) => (idx === i ? { ...s, [key]: value } : s)));
    markDirty();
  };
  const removeSkill = (i) => {
    setSkills((ss) => ss.filter((_, idx) => idx !== i));
    markDirty();
  };

  // Secrets handlers
  const addSecret = () => {
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
    markDirty();
  };
  const updateSecret = (i, key, value) => {
    setSecrets((ss) =>
      ss.map((s, idx) => (idx === i ? { ...s, [key]: value } : s))
    );
    markDirty();
  };
  const removeSecret = (i) => {
    setSecrets((ss) => ss.filter((_, idx) => idx !== i));
    markDirty();
  };
  const toggleSecretReveal = (i) => {
    setSecrets((ss) =>
      ss.map((s, idx) => (idx === i ? { ...s, _revealed: !s._revealed } : s))
    );
  };
  const startEditSecretValue = (i) => {
    setSecrets((ss) =>
      ss.map((s, idx) =>
        idx === i
          ? { ...s, _editingValue: true, _revealed: true, value: "" }
          : s
      )
    );
    markDirty();
  };
  const cancelEditSecretValue = (i) => {
    setSecrets((ss) =>
      ss.map((s, idx) =>
        idx === i
          ? { ...s, _editingValue: false, _revealed: false, value: undefined }
          : s
      )
    );
    // ojo: no llamamos a markDirty — el "cambio" se está cancelando
  };

  const handleSave = async () => {
    setSubmitting(true);
    setSaveError("");
    try {
      await updateConfig({
        contexts: contexts
          .filter((c) => (c.content || "").trim())
          .map((c) => ({
            title: c.title?.trim() || null,
            content: c.content.trim(),
          })),
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
            if (typeof s.value === "string") item.value = s.value;
            return item;
          }),
      });
      setDirty(false);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (err) {
      setSaveError(err.message || "No se pudo guardar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* save bar — sticky */}
      <div
        className="sticky top-0 z-10 panel-floating !p-3 flex items-center justify-between"
        style={{ marginInline: -8 }}
      >
        <span className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
          {contexts.length} contextos · {mcps.length} mcps · {skills.length} skills · {secrets.length} secrets
        </span>
        <div className="flex items-center gap-3">
          {dirty && (
            <span className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-status-warning)]">
              cambios sin guardar
            </span>
          )}
          {savedFlash && !dirty && (
            <span className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-status-success)]">
              guardado
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={!dirty || submitting || isLoading}
            className="btn btn-primary btn-sm"
          >
            {submitting ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>

      {saveError && (
        <div className="px-4 py-3 rounded-[var(--radius)] border bg-[rgba(239,68,68,0.08)] border-[rgba(239,68,68,0.35)] text-sm text-[color:var(--color-status-error)]">
          {saveError}
        </div>
      )}

      {/* Contexts */}
      <Section
        title="Contextos"
        subtitle="Instrucciones e información compartida con TODAS las zonas y agentes de la organización."
        count={contexts.length}
        onAdd={addContext}
        addLabel="Añadir contexto"
      >
        {contexts.length === 0 ? (
          <p className="text-xs text-[color:var(--color-text-dim)] italic">
            Sin contextos. Las zonas no heredarán nada — pueden definir los suyos propios.
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

      {/* MCPs */}
      <Section
        title="MCP servers"
        subtitle="Servidores Model Context Protocol disponibles globalmente."
        count={mcps.length}
        onAdd={addMcp}
        addLabel="Añadir MCP"
      >
        {mcps.length === 0 ? (
          <p className="text-xs text-[color:var(--color-text-dim)] italic">
            Sin MCPs globales.
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

      {/* Skills */}
      <Section
        title="Skills"
        subtitle="Capacidades disponibles para todos los agentes de la organización."
        count={skills.length}
        onAdd={addSkill}
        addLabel="Añadir skill"
      >
        {skills.length === 0 ? (
          <p className="text-xs text-[color:var(--color-text-dim)] italic">
            Sin skills globales.
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

      {/* Secrets */}
      <Section
        title="Secrets / Env vars"
        subtitle="Variables sensibles (API keys, tokens) inyectables en MCPs y agentes. Cifradas at-rest con AES-256-GCM — el servidor nunca devuelve el valor, solo cuándo se actualizó."
        count={secrets.length}
        onAdd={addSecret}
        addLabel="Añadir secret"
      >
        {secrets.length === 0 ? (
          <p className="text-xs text-[color:var(--color-text-dim)] italic">
            Sin secrets globales. Las zonas pueden definir los suyos propios.
          </p>
        ) : (
          <div className="space-y-2">
            {secrets.map((s, i) => {
              const isExisting = !!s.id;
              const isEditing = !isExisting || s._editingValue;

              // Modo compacto: una línea con key · desc · fecha + acciones.
              if (!isEditing) {
                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 pl-3 pr-1 h-11 rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-3)]"
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
                    onChange={(e) => updateSecret(i, "key", e.target.value)}
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
                      onChange={(e) => updateSecret(i, "value", e.target.value)}
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
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Organization tab
// ─────────────────────────────────────────────────────────────────────────────

function OrgRow({ label, value, mono = false }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-[color:var(--color-border)] last:border-0">
      <dt className="text-sm text-[color:var(--color-text-muted)]">{label}</dt>
      <dd className={mono ? "mono text-[12px]" : "text-sm font-medium"}>
        {value || <span className="text-[color:var(--color-text-dim)]">—</span>}
      </dd>
    </div>
  );
}

function OrganizationTab() {
  const { activeOrganization, organizations } = useAuth();

  return (
    <div className="space-y-4">
      <section className="panel !p-5">
        <h3 className="text-sm font-semibold mb-3">Organización activa</h3>
        <dl>
          <OrgRow label="Nombre" value={activeOrganization?.name} />
          <OrgRow label="Slug" value={activeOrganization?.slug} mono />
          <OrgRow label="ID" value={activeOrganization?.id} mono />
          <OrgRow
            label="Creada"
            value={
              activeOrganization?.createdAt
                ? new Date(activeOrganization.createdAt).toLocaleString()
                : null
            }
          />
        </dl>
      </section>

      <section className="panel !p-5">
        <h3 className="text-sm font-semibold mb-3">Todas tus organizaciones</h3>
        {organizations.length === 0 ? (
          <p className="text-xs text-[color:var(--color-text-dim)] italic">
            No perteneces a ninguna organización.
          </p>
        ) : (
          <ul className="divide-y divide-[color:var(--color-border)]">
            {organizations.map((o) => (
              <li key={o.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium">{o.name}</p>
                  <p className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)]">
                    {o.slug}
                  </p>
                </div>
                {o.id === activeOrganization?.id && (
                  <span className="badge" data-status="working">
                    activa
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// View
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "resources", label: "Recursos" },
  { id: "organization", label: "Organización" },
];

export default function PanelSettingsView() {
  const [tab, setTab] = useState("resources");
  const { config, isLoading, error, updateConfig } = useConfig();

  return (
    <div className="h-full overflow-auto bg-[color:var(--color-bg)]">
      <div className="max-w-3xl mx-auto p-6 lg:p-8">
        <header className="mb-6">
          <span className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)]">
            config
          </span>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">
            Configuración
          </h1>
          <p className="text-sm text-[color:var(--color-text-muted)] mt-1">
            Recursos compartidos por toda la organización. Las zonas y agentes
            del office heredan estos contextos, MCPs y skills.
          </p>
        </header>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-[var(--radius)] border bg-[rgba(239,68,68,0.08)] border-[rgba(239,68,68,0.35)] text-sm text-[color:var(--color-status-error)]">
            No se pudo cargar la configuración: {error.message || "error"}
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-[color:var(--color-border)] mb-6 flex items-center gap-1">
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={[
                  "h-10 px-4 text-sm font-medium transition-colors border-b-2 -mb-px",
                  active
                    ? "border-[color:var(--color-accent)] text-[color:var(--color-text)]"
                    : "border-transparent text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]",
                ].join(" ")}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "resources" && (
          <ResourcesTab
            config={config}
            updateConfig={updateConfig}
            isLoading={isLoading}
          />
        )}
        {tab === "organization" && <OrganizationTab />}
      </div>
    </div>
  );
}
