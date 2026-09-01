import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import {
  Mail,
  Loader2,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  MailCheck,
} from "lucide-react";
import { motion } from "framer-motion";
import { PasswordInput } from "../components/ui/password-input";
import { OtpInput } from "../components/ui/otp-input";
import { AuthShell } from "../components/ui/AuthShell";

type Step = "email" | "code" | "password" | "done";

/** Kept in step with ResetPasswordDto on the server. */
const RULES = [
  { label: "At least 8 characters", test: (v: string) => v.length >= 8 },
  { label: "One uppercase letter", test: (v: string) => /[A-Z]/.test(v) },
  { label: "One lowercase letter", test: (v: string) => /[a-z]/.test(v) },
  { label: "One number", test: (v: string) => /\d/.test(v) },
];

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

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
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
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      setError(
        errorMessage(err, "Could not reset the password. Request a new code."),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const unmetRule = RULES.find((rule) => !rule.test(password));
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmitPassword = !unmetRule && !mismatch && confirm.length > 0;

  const banner = error ? (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 text-destructive text-sm font-semibold border border-destructive/20"
    >
      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
      <span className="text-left">{error}</span>
    </motion.div>
  ) : notice ? (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-semibold border border-emerald-500/20"
    >
      <MailCheck className="h-4 w-4 shrink-0 mt-0.5" />
      <span className="text-left">{notice}</span>
    </motion.div>
  ) : null;

  const backToSignIn = (
    <Link
      to="/login"
      className="flex items-center justify-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to sign in
    </Link>
  );

  // ── Step 4: done ──────────────────────────────────────────────────────────
  if (step === "done") {
    return (
      <AuthShell>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="h-7 w-7 text-primary" />
          </div>
          <div className="space-y-3">
            <h2 className="text-4xl lg:text-5xl font-black tracking-tight text-foreground leading-[1.1]">
              Password updated
            </h2>
            <p className="text-muted-foreground font-medium text-lg">
              You can now sign in with your new password. Redirecting you to the
              sign-in page...
            </p>
          </div>
          <Link
            to="/login"
            className="w-full h-14 rounded-2xl bg-primary px-6 text-base font-bold text-primary-foreground hover:bg-primary/90 transition-all flex items-center justify-center gap-3"
          >
            Go to sign in
            <ArrowRight className="h-5 w-5" />
          </Link>
        </motion.div>
      </AuthShell>
    );
  }

  // ── Step 3: new password ──────────────────────────────────────────────────
  if (step === "password") {
    return (
      <AuthShell>
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest mb-2 border border-primary/10">
            <ShieldCheck className="w-3 h-3" />
            IDENTITY VERIFIED
          </div>
          <h2 className="text-4xl lg:text-5xl font-black tracking-tight text-foreground leading-[1.1]">
            Set a new password
          </h2>
          <p className="text-muted-foreground font-medium text-lg">
            Choose a new password for{" "}
            <span className="text-foreground font-bold">{email}</span>.
          </p>
        </div>

        {banner}

        <form onSubmit={submitPassword} className="space-y-6">
          <div className="space-y-2.5">
            <label className="text-sm font-bold text-foreground/80 ml-1 block">
              New Password
            </label>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoFocus
              required
            />
          </div>

          <div className="space-y-2.5">
            <label className="text-sm font-bold text-foreground/80 ml-1 block">
              Confirm Password
            </label>
            <PasswordInput
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              required
            />
            {mismatch && (
              <p className="text-xs font-semibold text-destructive ml-1">
                Passwords do not match.
              </p>
            )}
          </div>

          <ul className="space-y-1.5 rounded-xl bg-muted/40 p-4">
            {RULES.map((rule) => {
              const met = rule.test(password);
              return (
                <li
                  key={rule.label}
                  className={`flex items-center gap-2 text-xs font-semibold transition-colors ${
                    met ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <CheckCircle2
                    className={`h-3.5 w-3.5 ${met ? "opacity-100" : "opacity-30"}`}
                  />
                  {rule.label}
                </li>
              );
            })}
          </ul>

          <motion.button
            whileHover={
              canSubmitPassword ? { scale: 1.02, translateY: -2 } : undefined
            }
            whileTap={canSubmitPassword ? { scale: 0.98 } : undefined}
            type="submit"
            disabled={isLoading || !canSubmitPassword}
            className="w-full h-14 rounded-2xl bg-primary px-6 text-base font-bold text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 group"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Updating password...
              </>
            ) : (
              <>
                Update password
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </motion.button>

          {backToSignIn}
        </form>
      </AuthShell>
    );
  }

  // ── Step 2: verification code ─────────────────────────────────────────────
  if (step === "code") {
    return (
      <AuthShell>
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest mb-2 border border-primary/10">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            VERIFICATION CODE
          </div>
          <h2 className="text-4xl lg:text-5xl font-black tracking-tight text-foreground leading-[1.1]">
            Enter the code
          </h2>
          <p className="text-muted-foreground font-medium text-lg">
            We sent a 6-digit code to{" "}
            <span className="text-foreground font-bold">{email}</span>. It
            expires in 10 minutes.
          </p>
        </div>

        {banner}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void verifyCode(otp);
          }}
          className="space-y-6"
        >
          <OtpInput
            value={otp}
            onChange={setOtp}
            disabled={isLoading}
            onComplete={(code) => void verifyCode(code)}
          />

          <motion.button
            whileHover={otp.length === 6 ? { scale: 1.02, translateY: -2 } : undefined}
            whileTap={otp.length === 6 ? { scale: 0.98 } : undefined}
            type="submit"
            disabled={isLoading || otp.length !== 6}
            className="w-full h-14 rounded-2xl bg-primary px-6 text-base font-bold text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 group"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                Verify code
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </motion.button>

          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              disabled={resendIn > 0 || isLoading}
              onClick={() => void sendCode(true)}
              className="text-sm font-bold text-primary hover:text-primary/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setOtp("");
                setError("");
                setNotice("");
              }}
              className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Use a different address
            </button>
          </div>
        </form>
      </AuthShell>
    );
  }

  // ── Step 1: email ─────────────────────────────────────────────────────────
  return (
    <AuthShell>
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest mb-2 border border-primary/10">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          ACCOUNT RECOVERY
        </div>
        <h2 className="text-4xl lg:text-5xl font-black tracking-tight text-foreground leading-[1.1]">
          Forgot password
        </h2>
        <p className="text-muted-foreground font-medium text-lg">
          Enter the email tied to your account and we will send you a
          verification code.
        </p>
      </div>

      {banner}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendCode();
        }}
        className="space-y-6"
      >
        <div className="space-y-2.5">
          <div className="pb-1">
            <label className="text-sm font-bold text-foreground/80 ml-1">
              Email Address
            </label>
          </div>
          <div className="relative group">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex h-12 w-full rounded-xl border border-input dark:border-blue-700/20 bg-background/50 backdrop-blur-sm pl-12 pr-4 py-2 text-sm transition-all focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              placeholder="you@rtb.gov.rw"
              autoFocus
              required
            />
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.02, translateY: -2 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={isLoading}
          className="w-full h-14 rounded-2xl bg-primary px-6 text-base font-bold text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-3 group"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Sending code...
            </>
          ) : (
            <>
              Send verification code
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </motion.button>

        {backToSignIn}
      </form>
    </AuthShell>
  );
}
