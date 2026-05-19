import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useStoreAuth } from "../../store";
import useAuth from "../../hooks/useAuth";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000";

function AuthGate({ defaultMode = "login", invitedEmail }) {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState(defaultMode);
  const [email, setEmail] = useState(invitedEmail || "");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Si cambia el email de la invitación (carga async), reflejarlo.
  useEffect(() => {
    if (invitedEmail) setEmail(invitedEmail);
  }, [invitedEmail]);

  const handle = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (invitedEmail && normalizedEmail !== invitedEmail.toLowerCase()) {
        throw new Error(`Solo puedes usar ${invitedEmail} para esta invitación`);
      }
      if (mode === "login") {
        await login(normalizedEmail, password);
      } else {
        await signup({
          email: normalizedEmail,
          password,
          name: name.trim() || undefined,
        });
      }
      // La sesión se actualiza vía store; el componente padre re-renderiza.
    } catch (err) {
      setError(err.message || "No se pudo continuar");
    } finally {
      setSubmitting(false);
    }
  };

  // Email bloqueado en ambos modos: la invitación es para un email concreto;
  // permitir cambiarlo confunde la UX y el server lo rechazaría igualmente.
  const emailLocked = !!invitedEmail;

  return (
    <div className="space-y-5">
      <div className="border-b border-[color:var(--color-border)] flex">
        {["login", "signup"].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={[
              "h-10 px-4 text-sm font-medium border-b-2 -mb-px transition-colors",
              mode === m
                ? "border-[color:var(--color-accent)] text-[color:var(--color-text)]"
                : "border-transparent text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]",
            ].join(" ")}
          >
            {m === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </button>
        ))}
      </div>

      <p className="text-sm text-[color:var(--color-text-muted)]">
        {invitedEmail
          ? mode === "signup"
            ? <>La cuenta se creará con <strong>{invitedEmail}</strong>.</>
            : <>Inicia sesión con <strong>{invitedEmail}</strong>.</>
          : "Usa el email al que se envió la invitación."}
      </p>

      <form onSubmit={handle} className="space-y-4">
        {mode === "signup" && (
          <div>
            <label htmlFor="inv-name" className="label">Nombre (opcional)</label>
            <input
              id="inv-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>
        )}
        <div>
          <label htmlFor="inv-email" className="label">Email</label>
          <div className="relative">
            <input
              id="inv-email"
              type="email"
              className={[
                "input",
                emailLocked
                  ? "!bg-[color:var(--color-surface-3)] !text-[color:var(--color-text-muted)] !cursor-not-allowed !pr-9 !border-dashed"
                  : "",
              ].join(" ")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="tu@email.com"
              readOnly={emailLocked}
              disabled={emailLocked}
              aria-describedby={emailLocked ? "inv-email-hint" : undefined}
            />
            {emailLocked && (
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                aria-hidden="true"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--color-text-dim)]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="4" y="11" width="16" height="9" rx="1.5" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
            )}
          </div>
          {emailLocked && (
            <p
              id="inv-email-hint"
              className="mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-dim)] mt-1"
            >
              email fijo según la invitación
            </p>
          )}
        </div>
        <div>
          <label htmlFor="inv-pass" className="label">Contraseña</label>
          <input
            id="inv-pass"
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder="••••••••"
          />
        </div>
        {error && (
          <div
            role="alert"
            className="px-3 py-2 rounded-[var(--radius)] border bg-[rgba(239,68,68,0.08)] border-[rgba(239,68,68,0.35)] text-sm text-[color:var(--color-status-error)]"
          >
            {error}
          </div>
        )}
        <button type="submit" className="btn btn-primary btn-lg w-full" disabled={submitting}>
          {submitting
            ? mode === "login" ? "Entrando…" : "Creando…"
            : mode === "login" ? "Entrar" : "Crear cuenta y continuar"}
        </button>
      </form>
    </div>
  );
}

function InvitationDetails({ invitationId, fallback }) {
  const { client } = useStoreAuth();
  const {
    setActiveOrganization,
    refetchOrganizations,
    refetchActiveOrganization,
    logout,
  } = useAuth();
  const navigate = useNavigate();

  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const { data, error } = await client.organization.getInvitation({
        query: { id: invitationId },
      });
      if (error) throw error;
      setInvitation(data);
    } catch (err) {
      setLoadError(err.message || "No se pudo cargar la invitación");
    } finally {
      setLoading(false);
    }
  }, [client, invitationId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAccept = async () => {
    setActionError("");
    setSubmitting(true);
    try {
      const { error } = await client.organization.acceptInvitation({
        invitationId,
      });
      if (error) throw error;
      const orgId = invitation?.organizationId || fallback?.organizationId;
      if (orgId) {
        try {
          await setActiveOrganization(orgId);
        } catch {
          // no bloqueante
        }
      }
      // accept-invitation no invalida el atom $listOrg en el cliente de
      // Better Auth (sólo lo hacen create/delete/update). Sin esto, al
      // navegar al dashboard organizations sigue vacía y OrgRequiredMiddleware
      // nos manda al onboarding pese a que acabamos de unirnos.
      try {
        await Promise.all([
          refetchOrganizations?.(),
          refetchActiveOrganization?.(),
        ]);
      } catch {
        // si el refetch falla, mejor un hard reload que quedarse colgado
        window.location.href = "/panel/dashboard";
        return;
      }
      navigate("/panel/dashboard");
    } catch (err) {
      setActionError(err.message || "No se pudo aceptar la invitación");
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    setActionError("");
    if (!window.confirm("¿Rechazar esta invitación?")) return;
    setSubmitting(true);
    try {
      const { error } = await client.organization.rejectInvitation({
        invitationId,
      });
      if (error) throw error;
      navigate("/panel/dashboard");
    } catch (err) {
      setActionError(err.message || "No se pudo rechazar la invitación");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <p className="text-sm text-[color:var(--color-text-muted)]">
        Cargando invitación…
      </p>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <div
          role="alert"
          className="px-3 py-2 rounded-[var(--radius)] border bg-[rgba(239,68,68,0.08)] border-[rgba(239,68,68,0.35)] text-sm text-[color:var(--color-status-error)]"
        >
          {loadError}
        </div>
        {fallback?.email && (
          <p className="text-sm text-[color:var(--color-text-muted)]">
            Esta invitación es para <strong>{fallback.email}</strong>. Cierra
            sesión y entra con esa cuenta.
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={logout}
            className="btn btn-secondary btn-sm flex-1"
          >
            Cerrar sesión
          </button>
          <button
            type="button"
            onClick={() => navigate("/panel/dashboard")}
            className="btn btn-primary btn-sm flex-1"
          >
            Ir al panel
          </button>
        </div>
      </div>
    );
  }

  const orgName = invitation.organizationName || fallback?.organizationName;
  const orgSlug = invitation.organizationSlug || fallback?.organizationSlug;
  const role = invitation.role || fallback?.role;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Te han invitado a{" "}
          <span className="text-[color:var(--color-accent)]">{orgName}</span>
        </h1>
        <p className="text-sm text-[color:var(--color-text-muted)] mt-2">
          {invitation.inviterEmail && <>{invitation.inviterEmail} te ha invitado </>}
          como <strong>{role}</strong> a la organización{" "}
          <code className="mono">{orgSlug}</code>.
        </p>
      </div>

      {actionError && (
        <div
          role="alert"
          className="px-3 py-2 rounded-[var(--radius)] border bg-[rgba(239,68,68,0.08)] border-[rgba(239,68,68,0.35)] text-sm text-[color:var(--color-status-error)]"
        >
          {actionError}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleReject}
          disabled={submitting}
          className="btn btn-secondary btn-lg flex-1"
        >
          Rechazar
        </button>
        <button
          type="button"
          onClick={handleAccept}
          disabled={submitting}
          className="btn btn-primary btn-lg flex-1"
        >
          {submitting ? "Procesando…" : "Aceptar invitación"}
        </button>
      </div>
    </div>
  );
}

function usePreview(id) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(
          `${API_BASE}/invitations/${encodeURIComponent(id)}/preview`,
          { credentials: "include" }
        );
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || data.success === false) {
          setError(data.message || `HTTP ${res.status}`);
          return;
        }
        setPreview(data.invitation);
      } catch (err) {
        if (!cancelled) setError(err.message || "No se pudo cargar la invitación");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { preview, loading, error };
}

export default function InvitationView() {
  const { id } = useParams();
  const { user, isPending } = useAuth();
  const { preview, loading: previewLoading, error: previewError } = usePreview(id);

  if (!id) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-[color:var(--color-bg)] text-[color:var(--color-text)]">
        <p className="text-sm text-[color:var(--color-text-muted)]">
          Link de invitación inválido.
        </p>
      </div>
    );
  }

  const shellHeader = (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        {preview
          ? <>Únete a {preview.organizationName}</>
          : "Acepta tu invitación"}
      </h1>
      {preview && (
        <p className="text-sm text-[color:var(--color-text-muted)] mt-2">
          Invitación para <strong>{preview.email}</strong> como{" "}
          <span className="badge">{preview.role}</span>
        </p>
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-[color:var(--color-bg)] text-[color:var(--color-text)]">
      <div className="w-full max-w-md space-y-6">
        {isPending || previewLoading ? (
          <p className="text-sm text-[color:var(--color-text-muted)]">
            Cargando…
          </p>
        ) : previewError ? (
          <div
            role="alert"
            className="px-3 py-2 rounded-[var(--radius)] border bg-[rgba(239,68,68,0.08)] border-[rgba(239,68,68,0.35)] text-sm text-[color:var(--color-status-error)]"
          >
            {previewError}
          </div>
        ) : !user ? (
          <>
            {shellHeader}
            <AuthGate
              invitedEmail={preview?.email}
              defaultMode="signup"
            />
          </>
        ) : (
          <>
            <InvitationDetails invitationId={id} fallback={preview} />
          </>
        )}
      </div>
    </div>
  );
}
