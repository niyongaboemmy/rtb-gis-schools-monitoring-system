import { useCallback, useEffect, useState } from "react";
import {
  Laptop,
  Lock,
  LogOut,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  RefreshCw,
  Link2,
  Unlink,
} from "lucide-react";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Modal } from "../ui/modal";
import { PasswordInput } from "../ui/password-input";
import { GoogleSignInButton } from "../ui/GoogleSignInButton";
import { useToast } from "../ui/toast";
import { api, apiErrorMessage } from "../../lib/api";
import { formatDateTime, formatRelative } from "../../lib/format";
import { useAuthStore } from "../../store/authStore";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { MfaEnrollment, type EnrolmentStart } from "./MfaEnrollment";
import { describeUserAgent } from "./user-agent";

function SectionCard({
  icon,
  title,
  subtitle,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="bg-card/60 border border-border/20 backdrop-blur-xl overflow-hidden rounded-3xl shadow-none">
      <section className="p-5 sm:p-8 space-y-5" aria-label={title}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">{icon}</div>
            <div>
              <h4 className="font-bold text-lg">{title}</h4>
              <p className="text-xs text-muted-foreground font-medium">{subtitle}</p>
            </div>
          </div>
          {action}
        </div>
        {children}
      </section>
    </Card>
  );
}

// ── Password ────────────────────────────────────────────────────────────────

function PasswordSection() {
  const toast = useToast();
  const { user } = useAuthStore();
  return (
    <SectionCard
      icon={<Lock className="w-5 h-5" aria-hidden />}
      title="Password"
      subtitle={
        user?.passwordChangedAt
          ? `Last changed ${formatDateTime(user.passwordChangedAt)}`
          : "Changing it signs out your other devices"
      }
    >
      <ChangePasswordForm
        onDone={() =>
          toast.success("Password updated. Your other devices were signed out.")
        }
      />
    </SectionCard>
  );
}

// ── Two-factor ──────────────────────────────────────────────────────────────

interface MfaStatus {
  enabled: boolean;
  enabledAt: string | null;
  recoveryCodesRemaining: number;
  required: boolean;
}

function TwoFactorSection() {
  const toast = useToast();
  const { updateUser } = useAuthStore();
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [mode, setMode] = useState<"none" | "enrol" | "disable" | "regenerate">("none");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [newCodes, setNewCodes] = useState<string[] | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<MfaStatus>("/auth/2fa/status");
      setStatus(data);
      updateUser({ totpEnabled: data.enabled, mfaRequired: data.required });
    } catch {
      setStatus(null);
    }
  }, [updateUser]);

  useEffect(() => {
    void load();
  }, [load]);

  const close = () => {
    setMode("none");
    setPassword("");
    setCode("");
    setError("");
    setNewCodes(null);
  };

  const disable = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.post("/auth/2fa/disable", { password, code });
      toast.success("Two-factor authentication turned off.");
      close();
      void load();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not turn off two-factor."));
    } finally {
      setBusy(false);
    }
  };

  const regenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post<{ recoveryCodes: string[] }>("/auth/2fa/recovery-codes", { code });
      setNewCodes(data.recoveryCodes);
      void load();
    } catch (err) {
      setError(apiErrorMessage(err, "That code is not valid."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard
      icon={<ShieldCheck className="w-5 h-5" aria-hidden />}
      title="Two-factor authentication"
      subtitle="A code from your phone in addition to your password"
      action={
        status &&
        (status.enabled ? (
          <Badge variant="success">On</Badge>
        ) : status.required ? (
          <Badge variant="warning">Required for your role</Badge>
        ) : (
          <Badge variant="outline">Off</Badge>
        ))
      }
    >
      {!status ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : status.enabled ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Turned on {status.enabledAt ? formatDateTime(status.enabledAt) : ""}.{" "}
            {status.recoveryCodesRemaining} unused recovery code
            {status.recoveryCodesRemaining === 1 ? "" : "s"} left.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setMode("regenerate")}>
              <RefreshCw className="h-4 w-4 mr-1.5" aria-hidden /> New recovery codes
            </Button>
            {!status.required && (
              <Button variant="outline" size="sm" onClick={() => setMode("disable")}>
                <ShieldOff className="h-4 w-4 mr-1.5" aria-hidden /> Turn off
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Protect your account with an authenticator app. If you have no smartphone,
            you can still receive sign-in codes by email.
          </p>
          <Button size="sm" onClick={() => setMode("enrol")}>
            <Smartphone className="h-4 w-4 mr-1.5" aria-hidden /> Set up authenticator
          </Button>
        </div>
      )}

      <Modal isOpen={mode === "enrol"} onClose={close} title="Set up two-factor authentication" maxWidth="max-w-xl">
        {mode === "enrol" && (
          <MfaEnrollment
            start={async () => (await api.post<EnrolmentStart>("/auth/2fa/setup")).data}
            confirm={async (c) => (await api.post<{ recoveryCodes: string[] }>("/auth/2fa/enable", { code: c })).data}
            onDone={() => {
              toast.success("Two-factor authentication is on.");
              close();
              void load();
            }}
            onCancel={close}
          />
        )}
      </Modal>

      <Modal isOpen={mode === "disable"} onClose={close} title="Turn off two-factor authentication" maxWidth="max-w-md">
        <form onSubmit={disable} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="mfa-disable-password" className="text-sm font-semibold">
              Password
            </label>
            <PasswordInput
              id="mfa-disable-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="mfa-disable-code" className="text-sm font-semibold">
              Authenticator or recovery code
            </label>
            <input
              id="mfa-disable-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="one-time-code"
              className="flex h-12 w-full rounded-xl border border-input bg-background/50 px-4 text-sm font-mono focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              required
            />
          </div>
          {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
            <Button type="submit" variant="destructive" isLoading={busy} disabled={!password || !code}>
              Turn off
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={mode === "regenerate"} onClose={close} title="New recovery codes" maxWidth="max-w-md">
        {newCodes ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your old codes no longer work. Save these now — they will not be shown again.
            </p>
            <ul className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-muted/40 p-4 font-mono text-sm">
              {newCodes.map((c) => (
                <li key={c} className="text-center select-all">{c}</li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  void navigator.clipboard?.writeText(newCodes.join("\n")).then(
                    () => toast.success("Recovery codes copied"),
                    () => toast.error("Copy failed — select and copy them manually."),
                  );
                }}
              >
                Copy
              </Button>
              <Button onClick={close}>Done</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={regenerate} className="space-y-4">
            <label htmlFor="mfa-regen-code" className="text-sm font-semibold block">
              Code from your authenticator app
            </label>
            <input
              id="mfa-regen-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              className="flex h-12 w-full rounded-xl border border-input bg-background/50 px-4 text-lg tracking-widest font-mono focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              required
            />
            {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
              <Button type="submit" isLoading={busy} disabled={code.length !== 6}>Generate</Button>
            </div>
          </form>
        )}
      </Modal>
    </SectionCard>
  );
}

// ── Sessions ────────────────────────────────────────────────────────────────

interface SessionRow {
  id: string;
  userAgent: string | null;
  ip: string | null;
  method: string | null;
  createdAt: string;
  lastUsedAt: string;
  current: boolean;
}

function SessionsSection() {
  const toast = useToast();
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<SessionRow[]>("/auth/sessions");
      setRows(data);
    } catch {
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const revoke = async (id: string) => {
    setBusy(id);
    try {
      await api.delete(`/auth/sessions/${id}`);
      toast.success("Device signed out.");
      void load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not sign out that device."));
    } finally {
      setBusy(null);
    }
  };

  const revokeOthers = async () => {
    setBusy("others");
    try {
      await api.post("/auth/sessions/revoke-others");
      toast.success("All other devices were signed out.");
      void load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not sign out other devices."));
    } finally {
      setBusy(null);
    }
  };

  const others = rows?.filter((r) => !r.current).length ?? 0;

  return (
    <SectionCard
      icon={<Laptop className="w-5 h-5" aria-hidden />}
      title="Signed-in devices"
      subtitle="Sessions that can currently access your account"
      action={
        others > 0 && (
          <Button variant="outline" size="sm" onClick={() => void revokeOthers()} isLoading={busy === "others"}>
            <LogOut className="h-4 w-4 mr-1.5" aria-hidden /> Sign out all others
          </Button>
        )
      }
    >
      {!rows ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active sessions found.</p>
      ) : (
        <ul className="divide-y divide-border/40">
          {rows.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-semibold text-sm flex items-center gap-2">
                  {describeUserAgent(s.userAgent)}
                  {s.current && <Badge variant="success">This device</Badge>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {s.ip ?? "Unknown IP"} · last active{" "}
                  <time dateTime={s.lastUsedAt} title={formatDateTime(s.lastUsedAt)}>
                    {formatRelative(s.lastUsedAt)}
                  </time>{" "}
                  · signed in {formatDateTime(s.createdAt)}
                </p>
              </div>
              {!s.current && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void revoke(s.id)}
                  isLoading={busy === s.id}
                  aria-label={`Sign out ${describeUserAgent(s.userAgent)}`}
                >
                  Sign out
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

// ── Google ──────────────────────────────────────────────────────────────────

function GoogleSection() {
  const toast = useToast();
  const { user, updateUser } = useAuthStore();
  const [busy, setBusy] = useState(false);
  if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) return null;

  const link = async (idToken: string) => {
    setBusy(true);
    try {
      await api.post("/auth/google/link", { idToken });
      updateUser({ googleLinked: true });
      toast.success("Google account linked.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not link Google."));
    } finally {
      setBusy(false);
    }
  };

  const unlink = async () => {
    setBusy(true);
    try {
      await api.delete("/auth/google/link");
      updateUser({ googleLinked: false });
      toast.success("Google account unlinked. Sign in with your password from now on.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not unlink Google."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard
      icon={<Link2 className="w-5 h-5" aria-hidden />}
      title="Google sign-in"
      subtitle={user?.email ?? ""}
      action={user?.googleLinked ? <Badge variant="success">Linked</Badge> : <Badge variant="outline">Not linked</Badge>}
    >
      {user?.googleLinked ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            You can sign in with the Google account for {user.email}. Your password keeps working.
          </p>
          <Button variant="outline" size="sm" onClick={() => void unlink()} isLoading={busy}>
            <Unlink className="h-4 w-4 mr-1.5" aria-hidden /> Unlink Google
          </Button>
        </div>
      ) : (
        <div className="space-y-2 max-w-sm">
          <p className="text-sm text-muted-foreground">
            Link the Google account with the same email address to sign in with Google.
          </p>
          <GoogleSignInButton
            onCredential={(t) => void link(t)}
            onError={(m) => toast.error(m)}
            disabled={busy}
          />
        </div>
      )}
    </SectionCard>
  );
}

/** Profile "Security & Privacy" tab (WS9.11, WS10.2, WS10.5, WS10.9). */
export function SecuritySettings() {
  return (
    <div className="space-y-6">
      <PasswordSection />
      <TwoFactorSection />
      <SessionsSection />
      <GoogleSection />
    </div>
  );
}
