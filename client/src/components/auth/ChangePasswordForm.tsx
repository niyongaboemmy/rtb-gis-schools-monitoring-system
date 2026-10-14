import { useId, useState } from "react";
import { PasswordInput } from "../ui/password-input";
import { Button } from "../ui/button";
import { api, apiErrorMessage } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import { PasswordStrengthMeter } from "./PasswordStrengthMeter";
import { isPasswordAcceptable } from "./password-policy";

/**
 * Change-password form (WS10.2) shared by the Profile page and the forced
 * first-login change (WS10.3). The server signs out every other device.
 */
export function ChangePasswordForm({
  onDone,
  submitLabel = "Update password",
  currentLabel = "Current password",
}: {
  onDone?: () => void;
  submitLabel?: string;
  currentLabel?: string;
}) {
  const { user, updateUser } = useAuthStore();
  const ids = { current: useId(), next: useId(), confirm: useId(), rules: useId() };
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const mismatch = confirm.length > 0 && next !== confirm;
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

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <label htmlFor={ids.current} className="text-sm font-semibold text-foreground/80">
          {currentLabel}
        </label>
        <PasswordInput
          id={ids.current}
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor={ids.next} className="text-sm font-semibold text-foreground/80">
          New password
        </label>
        <PasswordInput
          id={ids.next}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          aria-describedby={ids.rules}
          required
        />
      </div>
      <PasswordStrengthMeter id={ids.rules} password={next} email={user?.email} />
      <div className="space-y-1.5">
        <label htmlFor={ids.confirm} className="text-sm font-semibold text-foreground/80">
          Confirm new password
        </label>
        <PasswordInput
          id={ids.confirm}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          aria-invalid={mismatch}
          required
        />
        {mismatch && <p className="text-xs font-semibold text-destructive">Passwords do not match.</p>}
      </div>
      {error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" isLoading={saving} disabled={!valid} className="w-full sm:w-auto">
        {submitLabel}
      </Button>
    </form>
  );
}
