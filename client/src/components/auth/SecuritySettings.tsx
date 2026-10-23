import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Copy,
  KeyRound,
  Laptop,
  Link2,
  LogOut,
  Mail,
  QrCode,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  Unlink,
  type LucideIcon,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Modal } from "../ui/modal";
import { PasswordInput } from "../ui/password-input";
import { Skeleton, SkeletonGroup } from "../ui/skeleton";
import { GoogleSignInButton, type GoogleCredential } from "../ui/GoogleSignInButton";
import { useToast } from "../ui/toast";
import { api, apiErrorMessage } from "../../lib/api";
import { formatDate, formatDateTime, formatRelative } from "../../lib/format";
import { cn } from "../../lib/utils";
import { useAuthStore } from "../../store/authStore";
import { GLASS, TONE_TILE, type Tone } from "../ui/surfaces";
import { StatusPill } from "../ui/status-pill";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { MfaEnrollment, type EnrolmentStart } from "./MfaEnrollment";
import { describeUserAgent } from "./user-agent";
import { Pagination } from "../report-review/Pagination";

const EASE = [0.22, 1, 0.36, 1] as const;

const TILE = TONE_TILE;

const pillButton = "h-9 gap-1.5 rounded-full px-4 text-xs font-medium";

function SecurityCard({
  icon: Icon,
  tone = "primary",
  title,
  subtitle,
  status,
  action,
  index = 0,
  className,
  children,
}: {
  icon: LucideIcon;
  tone?: Tone;
  title: string;
  subtitle: ReactNode;
  status?: ReactNode;
  action?: ReactNode;
  index?: number;
  className?: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      aria-label={title}
      initial={reduce ? false : { opacity: 0, y: 16, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
      transition={{ duration: 0.6, delay: 0.05 + index * 0.08, ease: EASE }}
      className={cn("@container rounded-[1.75rem] p-4 min-[400px]:p-5 sm:p-6", GLASS, className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset", TILE[tone])}>
            <Icon className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
            <p className="mt-0.5 truncate text-xs text-muted-foreground/70">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status}
          {action}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </motion.section>
  );
}

/** Height-animated reveal used for the inline password form. */
function Reveal({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="reveal"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Password ────────────────────────────────────────────────────────────────

function PasswordSection({ index, className }: { index: number; className?: string }) {
  const toast = useToast();
  const { user } = useAuthStore();
  const mustChange = !!user?.mustChangePassword;
  const [open, setOpen] = useState(mustChange);
  const changedAt = user?.passwordChangedAt;

  return (
    <SecurityCard
      index={index}
      className={className}
      icon={KeyRound}
      tone={mustChange ? "warn" : "primary"}
      title="Password"
      subtitle={changedAt ? `Last changed ${formatRelative(changedAt)}` : "Never changed"}
      status={mustChange ? <StatusPill tone="warn" pulse>Change required</StatusPill> : null}
    >
      <Reveal open={!open}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-md text-sm text-muted-foreground">
            Use a long, unique password. Changing it signs out all your other devices.
            {changedAt && (
              <>
                {" "}
                <span className="text-foreground/80">
                  Set on <time dateTime={changedAt}>{formatDate(changedAt)}</time>.
                </span>
              </>
            )}
          </p>
          <Button variant="outline" onClick={() => setOpen(true)} className={pillButton}>
            <KeyRound className="h-3.5 w-3.5" aria-hidden /> Change password
          </Button>
        </div>
      </Reveal>
      <Reveal open={open}>
        <ChangePasswordForm
          appearance="app"
          submitClassName=""
          onCancel={mustChange ? undefined : () => setOpen(false)}
          onDone={() => {
            setOpen(false);
            toast.success("Password updated. Your other devices were signed out.");
          }}
        />
      </Reveal>
    </SecurityCard>
  );
}

// ── Two-factor ──────────────────────────────────────────────────────────────

interface MfaStatus {
  enabled: boolean;
  enabledAt: string | null;
  recoveryCodesRemaining: number;
  required: boolean;
}

const MFA_STEPS: { icon: LucideIcon; label: string }[] = [
  { icon: Smartphone, label: "Install an authenticator app" },
  { icon: QrCode, label: "Scan the QR code" },
  { icon: ShieldCheck, label: "Enter the 6-digit code" },
];

function TwoFactorSection({ index, className }: { index: number; className?: string }) {
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

  const tone: Tone = !status ? "primary" : status.enabled ? "good" : status.required ? "warn" : "primary";
  const lowCodes = !!status?.enabled && status.recoveryCodesRemaining <= 2;

  return (
    <SecurityCard
      index={index}
      className={className}
      icon={status?.enabled ? ShieldCheck : ShieldAlert}
      tone={tone}
      title="Two-factor authentication"
      subtitle="An extra code at sign-in"
      status={
        status &&
        (status.enabled ? (
          <StatusPill tone="good">On</StatusPill>
        ) : status.required ? (
          <StatusPill tone="warn" pulse>Required for your role</StatusPill>
        ) : (
          <StatusPill tone="neutral">Off</StatusPill>
        ))
      }
    >
      {!status ? (
        <SkeletonGroup className="space-y-2.5">
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="mt-4 h-9 w-44 rounded-full" />
        </SkeletonGroup>
      ) : status.enabled ? (
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl bg-slate-900/[0.02] p-3 ring-1 ring-inset ring-border/40 dark:bg-white/[0.02]">
              <dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Turned on</dt>
              <dd className="mt-0.5 text-sm font-normal text-foreground">
                {status.enabledAt ? formatDate(status.enabledAt) : "—"}
              </dd>
            </div>
            <div
              className={cn(
                "rounded-2xl p-3 ring-1 ring-inset",
                lowCodes ? "bg-warning/10 ring-warning/25" : "bg-slate-900/[0.02] ring-border/40 dark:bg-white/[0.02]",
              )}
            >
              <dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Recovery codes</dt>
              <dd className={cn("mt-0.5 text-sm font-normal tabular-nums", lowCodes ? "text-warning" : "text-foreground")}>
                {status.recoveryCodesRemaining} left
              </dd>
            </div>
          </dl>
          {lowCodes && (
            <p className="text-xs text-warning">Running low: generate new recovery codes so you can't get locked out.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setMode("regenerate")} className={pillButton}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden /> New recovery codes
            </Button>
            {!status.required && (
              <Button
                variant="ghost"
                onClick={() => setMode("disable")}
                className={cn(pillButton, "text-muted-foreground hover:bg-destructive/10 hover:text-destructive")}
              >
                <ShieldOff className="h-3.5 w-3.5" aria-hidden /> Turn off
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <ol className="grid gap-2 @lg:grid-cols-3">
            {MFA_STEPS.map((step, i) => (
              <li
                key={step.label}
                className="flex items-center gap-2.5 rounded-2xl bg-slate-900/[0.02] p-2.5 ring-1 ring-inset ring-border/40 dark:bg-white/[0.02]"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-medium text-primary">
                  {i + 1}
                </span>
                <span className="text-xs font-normal leading-tight text-foreground/90">{step.label}</span>
              </li>
            ))}
          </ol>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            No smartphone? You can still receive sign-in codes by email.
          </p>
          <Button onClick={() => setMode("enrol")} className="group h-10 gap-1.5 rounded-full pl-5 pr-1.5 text-sm font-medium">
            Set up authenticator
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 transition-transform duration-300 group-hover:translate-x-0.5">
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </span>
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
            <label htmlFor="mfa-disable-password" className="text-xs font-normal text-foreground/80">
              Password
            </label>
            <PasswordInput
              id="mfa-disable-password"
              appearance="app"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="mfa-disable-code" className="text-xs font-normal text-foreground/80">
              Authenticator or recovery code
            </label>
            <Input
              id="mfa-disable-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="one-time-code"
              className="font-mono"
              required
            />
          </div>
          {error && <p role="alert" className="text-sm font-normal text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={close} className="rounded-full">Cancel</Button>
            <Button type="submit" variant="destructive" isLoading={busy} disabled={!password || !code} className="rounded-full">
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
            <ul className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-900/[0.03] p-4 font-mono text-sm ring-1 ring-inset ring-border/50 dark:bg-white/[0.03]">
              {newCodes.map((c) => (
                <li key={c} className="select-all text-center">{c}</li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                className="gap-1.5 rounded-full"
                onClick={() => {
                  void navigator.clipboard?.writeText(newCodes.join("\n")).then(
                    () => toast.success("Recovery codes copied"),
                    () => toast.error("Copy failed — select and copy them manually."),
                  );
                }}
              >
                <Copy className="h-3.5 w-3.5" aria-hidden /> Copy
              </Button>
              <Button onClick={close} className="rounded-full">Done</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={regenerate} className="space-y-4">
            <label htmlFor="mfa-regen-code" className="block text-xs font-normal text-foreground/80">
              Code from your authenticator app
            </label>
            <Input
              id="mfa-regen-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              className="h-12 text-center font-mono text-lg tracking-[0.4em]"
              required
            />
            {error && <p role="alert" className="text-sm font-normal text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={close} className="rounded-full">Cancel</Button>
              <Button type="submit" isLoading={busy} disabled={code.length !== 6} className="rounded-full">Generate</Button>
            </div>
          </form>
        )}
      </Modal>
    </SecurityCard>
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

const SESSIONS_PAGE_SIZE = 5;

const isMobileAgent = (ua: string | null) => !!ua && /iPhone|iPad|Android|Mobile/i.test(ua);

function SessionsSection({ index, className }: { index: number; className?: string }) {
  const toast = useToast();
  const reduce = useReducedMotion();
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [page, setPage] = useState(1);

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
  // This device first, then most recently active.
  const sorted = rows
    ? [...rows].sort((a, b) => Number(b.current) - Number(a.current) || Date.parse(b.lastUsedAt) - Date.parse(a.lastUsedAt))
    : [];
  const pageCount = Math.max(1, Math.ceil(sorted.length / SESSIONS_PAGE_SIZE));
  // Signing devices out can empty the last page: fall back to the new last one.
  const current = Math.min(page, pageCount);
  const visible = sorted.slice((current - 1) * SESSIONS_PAGE_SIZE, current * SESSIONS_PAGE_SIZE);

  return (
    <SecurityCard
      index={index}
      className={className}
      icon={Laptop}
      title="Signed-in devices"
      subtitle={
        rows
          ? `${rows.length} active session${rows.length === 1 ? "" : "s"}`
          : "Where you're signed in"
      }
      action={
        others > 0 && (
          <Button
            variant="outline"
            onClick={() => void revokeOthers()}
            isLoading={busy === "others"}
            className={cn(pillButton, "hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive")}
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden /> Sign out all others
          </Button>
        )
      }
    >
      {!rows ? (
        <SkeletonGroup className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-2xl" />
          ))}
        </SkeletonGroup>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active sessions found.</p>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="wait" initial={false}>
            <motion.ul
              key={current}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="space-y-1.5"
            >
              {visible.map((s) => {
                const name = describeUserAgent(s.userAgent);
                const DeviceIcon = isMobileAgent(s.userAgent) ? Smartphone : Laptop;
                return (
                  <li
                    key={s.id}
                    className={cn(
                      "group flex flex-wrap items-center gap-3 rounded-2xl p-3 ring-1 ring-inset transition-colors",
                      s.current
                        ? "bg-primary/[0.06] ring-primary/20"
                        : "ring-transparent hover:bg-slate-900/[0.03] hover:ring-border/40 dark:hover:bg-white/[0.03]",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105",
                        s.current ? "bg-primary/15 text-primary" : "bg-slate-900/[0.05] text-muted-foreground dark:bg-white/[0.05]",
                      )}
                      aria-hidden
                    >
                      <DeviceIcon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-normal text-foreground">
                        {name}
                        {s.current && <StatusPill tone="good" pulse>This device</StatusPill>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <span>
                          {s.ip ?? "Unknown IP"} · active{" "}
                          <time dateTime={s.lastUsedAt} title={formatDateTime(s.lastUsedAt)}>
                            {formatRelative(s.lastUsedAt)}
                          </time>
                        </span>
                        <span className="hidden @lg:inline"> · </span>
                        <span className="block @lg:inline">signed in {formatDateTime(s.createdAt)}</span>
                      </p>
                    </div>
                    {!s.current && (
                      <Button
                        variant="ghost"
                        onClick={() => void revoke(s.id)}
                        isLoading={busy === s.id}
                        aria-label={`Sign out ${name}`}
                        className="ml-auto h-9 gap-1.5 rounded-full px-3 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <LogOut className="h-3.5 w-3.5" aria-hidden /> Sign out
                      </Button>
                    )}
                  </li>
                );
              })}
            </motion.ul>
          </AnimatePresence>
          <Pagination
            page={current}
            pageSize={SESSIONS_PAGE_SIZE}
            total={sorted.length}
            onChange={setPage}
            label="Signed-in devices pages"
            noun={["device", "devices"]}
          />
        </div>
      )}
    </SecurityCard>
  );
}

// ── Google ──────────────────────────────────────────────────────────────────

function GoogleSection({ index, className }: { index: number; className?: string }) {
  const toast = useToast();
  const { user, updateUser } = useAuthStore();
  const [busy, setBusy] = useState(false);
  if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) return null;

  const link = async (credential: GoogleCredential) => {
    setBusy(true);
    try {
      await api.post("/auth/google/link", credential);
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
    <SecurityCard
      index={index}
      className={className}
      icon={Link2}
      tone={user?.googleLinked ? "good" : "primary"}
      title="Google sign-in"
      subtitle={user?.email ?? ""}
      status={user?.googleLinked ? <StatusPill tone="good">Linked</StatusPill> : <StatusPill tone="neutral">Not linked</StatusPill>}
    >
      {user?.googleLinked ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-md text-sm text-muted-foreground">
            You can sign in with the Google account for {user.email}. Your password keeps working.
          </p>
          <Button
            variant="ghost"
            onClick={() => void unlink()}
            isLoading={busy}
            className={cn(pillButton, "text-muted-foreground hover:bg-destructive/10 hover:text-destructive")}
          >
            <Unlink className="h-3.5 w-3.5" aria-hidden /> Unlink Google
          </Button>
        </div>
      ) : (
        <div className="max-w-sm space-y-3">
          <p className="text-sm text-muted-foreground">
            Link the Google account with the same email address to sign in with Google.
          </p>
          <GoogleSignInButton
            onCredential={(c) => void link(c)}
            onError={(m) => toast.error(m)}
            disabled={busy}
            busy={busy}
            label="Link Google account"
          />
        </div>
      )}
    </SecurityCard>
  );
}

/** Profile "Security & Privacy" tab (WS9.11, WS10.2, WS10.5, WS10.9). */
export function SecuritySettings() {
  // Two independent columns (not grid rows), so a short card never leaves a
  // hole beside a tall one. Below xl the wrappers dissolve (`contents`) and
  // `order` keeps the reading order: password, 2FA, Google, devices.
  return (
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <div className="contents xl:flex xl:flex-col xl:gap-6">
        <PasswordSection index={0} className="order-1 xl:order-none" />
        <SessionsSection index={3} className="order-4 xl:order-none" />
      </div>
      <div className="contents xl:flex xl:flex-col xl:gap-6">
        <TwoFactorSection index={1} className="order-2 xl:order-none" />
        <GoogleSection index={2} className="order-3 xl:order-none" />
      </div>
    </div>
  );
}
