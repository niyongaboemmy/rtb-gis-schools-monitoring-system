import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { ArrowLeft, CheckCircle2, KeyRound, Lock, MailCheck } from "lucide-react";
import { PasswordInput } from "../components/ui/password-input";
import { OtpInput } from "../components/ui/otp-input";
import { Button } from "../components/ui/button";
import { AuthAlert, AuthShell } from "../components/ui/AuthShell";
import {
  authInputClass,
  authLabelClass,
  authPrimaryButtonClass,
  authSubtleLinkClass,
} from "../components/auth/auth-styles";
import { PasswordStrengthMeter } from "../components/auth/PasswordStrengthMeter";
import { isPasswordAcceptable } from "../components/auth/password-policy";

type Step = "email" | "code" | "password" | "done";

/** Pulls the server's message out of an axios error, whatever its shape. */
function errorMessage(err: unknown, fallback: string) {
  const axiosError = err as {
    response?: { status?: number; data?: { message?: string | string[] } };
  };
  if (axiosError.response?.status === 429)
    return "Too many requests. Please wait a minute before trying again.";
  const message = axiosError.response?.data?.message;
  return (Array.isArray(message) ? message[0] : message) || fallback;
}

export default function ForgotPassword() {
  const navigate = useNavigate();
  // Emailed reset links (incl. admin "send reset code") carry ?email=… so
  // the user lands straight on the code step.
  const [searchParams] = useSearchParams();
  const linkedEmail = searchParams.get("email")?.trim() ?? "";

  const [step, setStep] = useState<Step>(linkedEmail ? "code" : "email");
  const [email, setEmail] = useState(linkedEmail);
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  // Cooldown mirrors the server's 3-per-minute throttle on this endpoint.
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn(resendIn - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const sendCode = async (isResend = false) => {
    setIsLoading(true);
    setError("");
    setNotice("");

    try {
      const { data } = await api.post<{
        message: string;
        email: string;
        delivered: boolean;
      }>("/auth/forgot-password", { email });

      setStep("code");
      setResendIn(60);
      if (isResend) setOtp("");
      setNotice(
        data.delivered
          ? `${isResend ? "New code" : "Code"} sent to ${data.email}. Check your inbox and spam folder.`
          : // Local dev with no SMTP configured — say so rather than imply an email is coming.
            "Email sending is disabled on this server. The code was written to the server log.",
      );
    } catch (err) {
      // Stays on the email step: unknown address, deactivated account and mail
      // failures are all actionable here.
      setError(errorMessage(err, "Could not send the code. Please try again."));
    } finally {
      setIsLoading(false);
    }
  };

  const verifyCode = async (code: string) => {
    setIsLoading(true);
    setError("");
    setNotice("");

    try {
      await api.post("/auth/verify-otp", { email, otp: code });
      setStep("password");
    } catch (err) {
      setOtp("");
      setError(errorMessage(err, "That code is not valid. Please try again."));
    } finally {
      setIsLoading(false);
    }
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await api.post("/auth/reset-password", { email, otp, password });
      setStep("done");
      setTimeout(() => navigate("/login"), 3000);
    } catch (err) {
      setError(
        errorMessage(err, "Could not reset the password. Request a new code."),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmitPassword =
    isPasswordAcceptable(password, email) && !mismatch && confirm.length > 0;

  const banner = error ? (
    <AuthAlert>{error}</AuthAlert>
  ) : notice ? (
    <AuthAlert tone="success">{notice}</AuthAlert>
  ) : null;

  const backToSignIn = (
    <div className="flex justify-center">
      <Link to="/login" className={authSubtleLinkClass}>
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to sign in
      </Link>
    </div>
  );

  // ── Step 4: done ──────────────────────────────────────────────────────────
  if (step === "done") {
    return (
      <AuthShell
        stepKey={step}
        icon={<CheckCircle2 />}
        title="Password updated"
        description="You can now sign in with your new password. Taking you to the sign-in page…"
      >
        <Button asChild className={authPrimaryButtonClass}>
          <Link to="/login">Go to sign in</Link>
        </Button>
      </AuthShell>
    );
  }

  // ── Step 3: new password ──────────────────────────────────────────────────
  if (step === "password") {
    return (
      <AuthShell
        stepKey={step}
        icon={<Lock />}
        progress={{ current: 3, total: 3, label: "New password" }}
        title="Set a new password"
        description={
          <>
            Choose a new password for{" "}
            <span className="font-medium text-foreground">{email}</span>.
          </>
        }
      >
        {banner}

        <form onSubmit={submitPassword} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="reset-new" className={authLabelClass}>
              New password
            </label>
            <PasswordInput
              id="reset-new"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              aria-describedby="reset-password-rules"
              autoFocus
              required
            />
          </div>

          <PasswordStrengthMeter
            id="reset-password-rules"
            password={password}
            email={email}
            className="rounded-lg bg-muted/40 p-3.5"
          />

          <div className="space-y-1.5">
            <label htmlFor="reset-confirm" className={authLabelClass}>
              Confirm new password
            </label>
            <PasswordInput
              id="reset-confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              aria-invalid={mismatch || undefined}
              required
            />
            {mismatch && (
              <p className="text-xs font-medium text-destructive">
                Passwords do not match.
              </p>
            )}
          </div>

          <Button
            type="submit"
            isLoading={isLoading}
            disabled={!canSubmitPassword}
            className={`${authPrimaryButtonClass} mt-2`}
          >
            {isLoading ? "Updating password…" : "Update password"}
          </Button>
        </form>

        {backToSignIn}
      </AuthShell>
    );
  }

  // ── Step 2: verification code ─────────────────────────────────────────────
  if (step === "code") {
    return (
      <AuthShell
        stepKey={step}
        icon={<MailCheck />}
        progress={{ current: 2, total: 3, label: "Verify" }}
        title="Check your email"
        description={
          <>
            Enter the 6-digit code we sent to{" "}
            <span className="font-medium text-foreground">{email}</span>. It
            expires in 10 minutes.
          </>
        }
      >
        {banner}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void verifyCode(otp);
          }}
          className="space-y-4"
        >
          <OtpInput
            value={otp}
            onChange={setOtp}
            disabled={isLoading}
            label="Code from your email"
            onComplete={(code) => void verifyCode(code)}
          />

          <Button
            type="submit"
            isLoading={isLoading}
            disabled={otp.length !== 6}
            className={authPrimaryButtonClass}
          >
            {isLoading ? "Verifying…" : "Verify code"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Didn't get it? Check spam, or{" "}
            <button
              type="button"
              disabled={resendIn > 0 || isLoading}
              onClick={() => void sendCode(true)}
              className="font-medium text-primary hover:underline underline-offset-4 disabled:text-muted-foreground disabled:no-underline disabled:cursor-not-allowed"
            >
              {resendIn > 0 ? `resend in ${resendIn}s` : "resend the code"}
            </button>
          </p>
        </form>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setOtp("");
              setError("");
              setNotice("");
            }}
            className={authSubtleLinkClass}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Use a different email
          </button>
        </div>
      </AuthShell>
    );
  }

  // ── Step 1: email ─────────────────────────────────────────────────────────
  return (
    <AuthShell
      stepKey={step}
      icon={<KeyRound />}
      progress={{ current: 1, total: 3, label: "Your email" }}
      title="Reset your password"
      description="Enter the email you use to sign in. We'll send you a 6-digit code to confirm it's you."
    >
      {banner}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendCode();
        }}
        className="space-y-4"
      >
        <div className="space-y-1.5">
          <label htmlFor="reset-email" className={authLabelClass}>
            Work email
          </label>
          <input
            id="reset-email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={authInputClass}
            placeholder="name@rtb.gov.rw"
            autoFocus
            required
          />
        </div>

        <Button type="submit" isLoading={isLoading} className={`${authPrimaryButtonClass} mt-2`}>
          {isLoading ? "Sending code…" : "Send code"}
        </Button>
      </form>

      {backToSignIn}
    </AuthShell>
  );
}
