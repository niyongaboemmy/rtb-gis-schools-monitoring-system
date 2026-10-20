import { useEffect, useRef, useState } from "react";
import { ArrowLeft, KeyRound, Mail, Smartphone } from "lucide-react";
import { OtpInput } from "../ui/otp-input";
import { Button } from "../ui/button";
import { AuthAlert } from "../ui/AuthShell";
import { api, apiErrorMessage } from "../../lib/api";
import { AuthInput } from "./AuthInput";
import { authLabelClass, authPrimaryButtonClass, authSubtleLinkClass } from "./auth-styles";

export type MfaMode = "totp" | "recovery" | "email";

interface Props<T> {
  mfaToken: string;
  /** Second-factor endpoints answer with the normal session payload. */
  onSuccess: (session: T) => void;
  onCancel: () => void;
  /** Start in email mode (e.g. no authenticator enrolled yet). */
  initialMode?: MfaMode;
  /** Hide the authenticator / recovery options (enrolment-required users). */
  emailOnly?: boolean;
  /** In email mode, send the code straight away instead of waiting for a click. */
  autoSend?: boolean;
  /** Extra option shown under "Other ways to verify". */
  extraOption?: { label: string; onClick: () => void };
}

// Matches the server's throttle on /auth/2fa/email.
const RESEND_SECONDS = 60;

/**
 * Second sign-in step (WS10.6 / 10.8): authenticator code, a backup code,
 * or a code sent by email.
 */
export function MfaChallenge<T>({
  mfaToken,
  onSuccess,
  onCancel,
  initialMode = "totp",
  emailOnly,
  autoSend,
  extraOption,
}: Props<T>) {
  const [mode, setMode] = useState<MfaMode>(initialMode);
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState("");
  const [emailSent, setEmailSent] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const autoSent = useRef(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const switchMode = (next: MfaMode) => {
    setMode(next);
    setCode("");
    setRecovery("");
    setError("");
  };

  const sendEmail = async () => {
    setSending(true);
    setError("");
    try {
      const { data } = await api.post<{ message: string; delivered: boolean }>("/auth/2fa/email", { mfaToken });
      setEmailSent(
        data.delivered
          ? `${data.message} It expires in 10 minutes — check your spam folder if you don't see it.`
          : "Email sending is disabled on this server. The code was written to the server log.",
      );
      setResendIn(RESEND_SECONDS);
      switchMode("email");
    } catch (err) {
      setError(apiErrorMessage(err, "Could not send the email. Try again in a minute."));
    } finally {
      setSending(false);
    }
  };

  // Ref guard: StrictMode mounts twice and a second email would hit the throttle.
  useEffect(() => {
    if (autoSend && initialMode === "email" && !autoSent.current) {
      autoSent.current = true;
      void sendEmail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verify = async (value?: string) => {
    const body =
      mode === "totp"
        ? { mfaToken, code: value ?? code }
        : mode === "email"
          ? { mfaToken, emailCode: value ?? code }
          : { mfaToken, recoveryCode: recovery.trim() };
    if (mode !== "recovery" && (value ?? code).length !== 6) return;
    if (mode === "recovery" && !recovery.trim()) return;

    setLoading(true);
    setError("");
    try {
      const { data } = await api.post<T>("/auth/2fa/verify", body);
      onSuccess(data);
    } catch (err) {
      setCode("");
      setError(apiErrorMessage(err, "That code is not valid."));
    } finally {
      setLoading(false);
    }
  };

  const waitingForEmail = mode === "email" && !emailSent;

  const hint =
    mode === "totp"
      ? "Open your authenticator app and enter the 6-digit code for TVET 3D GIS."
      : mode === "recovery"
        ? "Enter one of the backup codes you saved when you turned on two-factor."
        : emailSent || (sending ? "Sending a code to your email…" : "We'll email you a 6-digit sign-in code.");

  const options: { key: string; label: string; icon: typeof Mail; onClick: () => void; disabled?: boolean }[] = [];
  if (!emailOnly && mode !== "totp")
    options.push({ key: "totp", label: "Use my authenticator app", icon: Smartphone, onClick: () => switchMode("totp") });
  if (mode !== "email")
    options.push({ key: "email", label: "Email me a code", icon: Mail, onClick: () => void sendEmail(), disabled: sending });
  if (!emailOnly && mode !== "recovery")
    options.push({ key: "recovery", label: "Use a backup code", icon: KeyRound, onClick: () => switchMode("recovery") });
  if (extraOption)
    options.push({ key: "extra", label: extraOption.label, icon: Smartphone, onClick: extraOption.onClick });

  return (
    <div className="space-y-6">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void verify();
        }}
      >
        <p className="text-sm text-muted-foreground dark:text-white/70 leading-relaxed" aria-live="polite">
          {hint}
        </p>

        {mode === "recovery" ? (
          <div className="space-y-1.5">
            <label htmlFor="recovery-code" className={authLabelClass}>
              Backup code
            </label>
            <AuthInput
              id="recovery-code"
              icon={<KeyRound />}
              value={recovery}
              onChange={(e) => setRecovery(e.target.value)}
              autoComplete="one-time-code"
              autoFocus
              placeholder="abcde-23456"
              className="font-mono tracking-wider"
            />
          </div>
        ) : waitingForEmail ? null : (
          <OtpInput
            key={mode}
            value={code}
            onChange={setCode}
            busy={loading}
            invalid={!!error}
            label={mode === "email" ? "Code from your email" : "Code from your authenticator app"}
            onComplete={(v) => void verify(v)}
          />
        )}

        {error && <AuthAlert>{error}</AuthAlert>}

        {waitingForEmail ? (
          <Button type="button" className={authPrimaryButtonClass} onClick={() => void sendEmail()} isLoading={sending}>
            {!sending && <Mail className="h-4 w-4 mr-2" aria-hidden />}
            {sending ? "Sending…" : "Email me a code"}
          </Button>
        ) : (
          <Button
            type="submit"
            className={authPrimaryButtonClass}
            isLoading={loading}
            disabled={mode === "recovery" ? !recovery.trim() : code.length !== 6}
          >
            Verify and sign in
          </Button>
        )}

        {mode === "email" && emailSent && (
          <p className="text-center text-sm text-muted-foreground dark:text-white/70">
            Didn't get it?{" "}
            <button
              type="button"
              disabled={resendIn > 0 || sending}
              onClick={() => void sendEmail()}
              className="font-medium text-primary hover:underline underline-offset-4 disabled:text-muted-foreground disabled:no-underline disabled:cursor-not-allowed"
            >
              {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
            </button>
          </p>
        )}
      </form>

      {options.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground dark:text-white/70">Other ways to verify</p>
          <div className="divide-y divide-gray-300/80 dark:divide-white/15 rounded-xl border border-gray-300/80 dark:border-white/15 overflow-hidden">
            {options.map(({ key, label, icon: Icon, onClick, disabled }) => (
              <button
                key={key}
                type="button"
                onClick={onClick}
                disabled={disabled}
                className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-sm font-medium text-foreground dark:text-white hover:bg-muted/60 dark:hover:bg-white/5 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:bg-muted"
              >
                <Icon className="h-4 w-4 text-muted-foreground dark:text-white/70" aria-hidden />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-center">
        <button type="button" onClick={onCancel} className={authSubtleLinkClass}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to sign in
        </button>
      </div>
    </div>
  );
}
