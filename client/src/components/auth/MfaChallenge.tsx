import { useState } from "react";
import { ArrowLeft, KeyRound, Loader2, Mail, Smartphone } from "lucide-react";
import { OtpInput } from "../ui/otp-input";
import { Button } from "../ui/button";
import { api, apiErrorMessage } from "../../lib/api";

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
}

/**
 * Second sign-in step (WS10.6 / 10.8): authenticator code, a recovery code,
 * or a code emailed on request.
 */
export function MfaChallenge<T>({ mfaToken, onSuccess, onCancel, initialMode = "totp", emailOnly }: Props<T>) {
  const [mode, setMode] = useState<MfaMode>(initialMode);
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState("");
  const [emailSent, setEmailSent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const switchMode = (next: MfaMode) => {
    setMode(next);
    setCode("");
    setRecovery("");
    setError("");
  };

  const sendEmail = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post<{ message: string; delivered: boolean }>("/auth/2fa/email", { mfaToken });
      setEmailSent(
        data.delivered
          ? data.message
          : "Email sending is disabled on this server. The code was written to the server log.",
      );
      switchMode("email");
    } catch (err) {
      setError(apiErrorMessage(err, "Could not send the email. Try again in a minute."));
    } finally {
      setLoading(false);
    }
  };

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

  const heading =
    mode === "totp"
      ? "Enter the 6-digit code from your authenticator app."
      : mode === "email"
        ? emailSent || "We can email you a one-time sign-in code."
        : "Enter one of the recovery codes you saved when you set up two-factor.";

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground font-medium" aria-live="polite">
        {heading}
      </p>

      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void verify();
        }}
      >
        {mode === "recovery" ? (
          <div className="space-y-2">
            <label htmlFor="recovery-code" className="text-sm font-bold text-foreground/80 ml-1">
              Recovery code
            </label>
            <div className="relative">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
              <input
                id="recovery-code"
                value={recovery}
                onChange={(e) => setRecovery(e.target.value)}
                autoComplete="one-time-code"
                autoFocus
                placeholder="abcde-23456"
                className="flex h-12 w-full rounded-xl border border-input dark:border-blue-700/20 bg-background/50 pl-12 pr-4 text-sm font-mono tracking-wider focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
            </div>
          </div>
        ) : mode === "email" && !emailSent ? null : (
          <fieldset className="space-y-2">
            <legend className="sr-only">Verification code</legend>
            <OtpInput value={code} onChange={setCode} disabled={loading} onComplete={(v) => void verify(v)} />
          </fieldset>
        )}

        {error && (
          <p role="alert" className="p-3 rounded-xl bg-destructive/10 text-destructive text-sm font-semibold border border-destructive/20">
            {error}
          </p>
        )}

        {mode === "email" && !emailSent ? (
          <Button type="button" className="w-full h-12" onClick={() => void sendEmail()} isLoading={loading}>
            <Mail className="h-4 w-4 mr-2" aria-hidden /> Email me a code
          </Button>
        ) : (
          <Button
            type="submit"
            className="w-full h-12"
            isLoading={loading}
            disabled={mode === "recovery" ? !recovery.trim() : code.length !== 6}
          >
            Verify and sign in
          </Button>
        )}
      </form>

      <div className="flex flex-col items-center gap-2 text-sm">
        {!emailOnly && mode !== "totp" && (
          <button type="button" onClick={() => switchMode("totp")} className="font-bold text-primary hover:underline inline-flex items-center gap-1.5">
            <Smartphone className="h-4 w-4" aria-hidden /> Use my authenticator app
          </button>
        )}
        {!emailOnly && mode !== "recovery" && (
          <button type="button" onClick={() => switchMode("recovery")} className="font-bold text-primary hover:underline inline-flex items-center gap-1.5">
            <KeyRound className="h-4 w-4" aria-hidden /> Use a recovery code
          </button>
        )}
        {(mode !== "email" || emailSent) && (
          <button
            type="button"
            disabled={loading}
            onClick={() => void sendEmail()}
            className="font-bold text-primary hover:underline inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {loading && mode === "email" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Mail className="h-4 w-4" aria-hidden />}
            {emailSent ? "Send a new email code" : "Email me a code instead"}
          </button>
        )}
        <button type="button" onClick={onCancel} className="mt-2 font-bold text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to sign in
        </button>
      </div>
    </div>
  );
}
