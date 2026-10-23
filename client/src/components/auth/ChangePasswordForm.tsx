import { useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CheckCircle2, KeyRound, Lock, ShieldCheck } from "lucide-react";
import { PasswordInput } from "../ui/password-input";
import { Button } from "../ui/button";
import { api, apiErrorMessage } from "../../lib/api";
import { cn } from "../../lib/utils";
import { useAuthStore } from "../../store/authStore";
import { PasswordStrengthMeter } from "./PasswordStrengthMeter";
import { isPasswordAcceptable } from "./password-policy";

/**
 * Change-password form (WS10.2) shared by the Profile page and the forced
 * first-login change (WS10.3). The server signs out every other device.
 */
export function ChangePasswordForm({
  onDone,
  onCancel,
  submitLabel = "Update password",
  currentLabel = "Current password",
  submitClassName = "w-full sm:w-auto",
  appearance = "auth",
}: {
  onDone?: () => void;
  /** Shows a Cancel button (in-app use). */
  onCancel?: () => void;
  submitLabel?: string;
  currentLabel?: string;
  submitClassName?: string;
  /** `auth`: sign-in screen styling. `app`: the in-app field surface and layout. */
  appearance?: "auth" | "app";
}) {
  const { user, updateUser } = useAuthStore();
  const ids = { current: useId(), next: useId(), confirm: useId(), rules: useId(), match: useId() };
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const app = appearance === "app";

  const mismatch = confirm.length > 0 && next !== confirm;
  const matches = confirm.length > 0 && next === confirm;
  const valid = !!current && isPasswordAcceptable(next, user?.email) && next === confirm;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    setError("");
    try {
      await api.patch("/users/me/password", { currentPassword: current, newPassword: next });
      updateUser({ mustChangePassword: false, passwordChangedAt: new Date().toISOString() });
      setCurrent("");
      setNext("");
      setConfirm("");
      onDone?.();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not update the password."));
    } finally {
      setSaving(false);
    }
  };

  const labelClass = app
    ? "flex items-center gap-1.5 text-xs font-normal text-foreground/80"
    : "block text-sm font-normal text-foreground dark:text-white";
  const labelIcon = (Icon: typeof Lock) => (app ? <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden /> : null);

  const currentField = (
    <div className="space-y-1.5">
      <label htmlFor={ids.current} className={labelClass}>
        {labelIcon(Lock)}
        {currentLabel}
      </label>
      <PasswordInput
        id={ids.current}
        appearance={appearance}
        leadingIcon={app ? undefined : <Lock />}
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        autoComplete="current-password"
        required
      />
    </div>
  );
  const nextField = (
    <div className="space-y-1.5">
      <label htmlFor={ids.next} className={labelClass}>
        {labelIcon(KeyRound)}
        New password
      </label>
      <PasswordInput
        id={ids.next}
        appearance={appearance}
        leadingIcon={app ? undefined : <Lock />}
        value={next}
        onChange={(e) => setNext(e.target.value)}
        autoComplete="new-password"
        aria-describedby={ids.rules}
        required
      />
    </div>
  );
  const confirmField = (
    <div className="space-y-1.5">
      <label htmlFor={ids.confirm} className={labelClass}>
        {labelIcon(ShieldCheck)}
        Confirm new password
      </label>
      <PasswordInput
        id={ids.confirm}
        appearance={appearance}
        leadingIcon={app ? undefined : <Lock />}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        autoComplete="new-password"
        aria-invalid={mismatch}
        aria-describedby={confirm ? ids.match : undefined}
        required
      />
      <AnimatePresence initial={false} mode="wait">
        {mismatch ? (
          <motion.p key="no" id={ids.match} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-xs font-normal text-destructive">
            Passwords do not match.
          </motion.p>
        ) : matches && app ? (
          <motion.p key="yes" id={ids.match} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-1 text-xs font-normal text-success">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Passwords match
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );

  const errorNode = error && (
    <p role="alert" className={cn("text-sm font-normal text-destructive", app && "rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 font-normal")}>
      {error}
    </p>
  );

  if (!app) {
    return (
      <form onSubmit={submit} className="space-y-4" noValidate>
        {currentField}
        {nextField}
        <PasswordStrengthMeter id={ids.rules} password={next} email={user?.email} />
        {confirmField}
        {errorNode}
        <Button type="submit" isLoading={saving} disabled={!valid} className={submitClassName}>
          {submitLabel}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="@container space-y-5" noValidate>
      <div className="@lg:max-w-[calc(50%-0.5rem)]">{currentField}</div>
      <div className="grid gap-4 @lg:grid-cols-2">
        {nextField}
        {confirmField}
      </div>
      <PasswordStrengthMeter
        id={ids.rules}
        password={next}
        email={user?.email}
        className="rounded-2xl bg-slate-900/[0.02] p-4 ring-1 ring-inset ring-border/40 dark:bg-white/[0.02]"
      />
      {errorNode}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving} className="h-10 rounded-full px-4 text-sm">
            Cancel
          </Button>
        )}
        <Button type="submit" isLoading={saving} disabled={!valid} className={cn("group h-10 gap-1.5 rounded-full pl-5 pr-1.5 text-sm font-medium", submitClassName)}>
          {submitLabel}
          {!saving && (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 transition-transform duration-300 group-hover:translate-x-0.5">
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </span>
          )}
        </Button>
      </div>
    </form>
  );
}
