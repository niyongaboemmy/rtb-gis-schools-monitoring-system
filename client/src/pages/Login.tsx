import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { homePathFor } from "../hooks/useScope";
import { useAuthStore, type User } from "../store/authStore";
import { api, apiErrorMessage } from "../lib/api";
import { ArrowLeft, ChevronRight, Lock, Mail, Smartphone } from "lucide-react";
import { AuthInput } from "../components/auth/AuthInput";
import { PasswordInput } from "../components/ui/password-input";
import { Button } from "../components/ui/button";
import { AuthAlert, AuthShell } from "../components/ui/AuthShell";
import { GoogleSignInButton, type GoogleCredential } from "../components/ui/GoogleSignInButton";
import {
  authLabelClass,
  authCardClass,
  authLinkClass,
  authMutedClass,
  authPrimaryButtonClass,
  authSubtleLinkClass,
} from "../components/auth/auth-styles";
import { MfaChallenge } from "../components/auth/MfaChallenge";
import { MfaEnrollment, type EnrolmentStart } from "../components/auth/MfaEnrollment";
import { ForcePasswordChange } from "../components/auth/ForcePasswordChange";
import { PrivacyAcceptancePrompt } from "../components/auth/PrivacyNotice";
import { needsPrivacyAcceptance } from "../components/auth/privacy";

/** A completed sign-in. The refresh token arrives as an httpOnly cookie. */
interface SessionPayload {
  accessToken: string;
  user: User;
  recoveryCodes?: string[];
}

/** /auth/login and /auth/google answer with one of these. */
type LoginResponse =
  | SessionPayload
  | { mfaRequired: true; mfaToken: string; methods: string[] }
  | { mfaEnrollmentRequired: true; mfaToken: string };

type Step =
  | "credentials"
  | "mfa"
  | "enroll-choose"
  | "enroll"
  | "enroll-email"
  | "change-password"
  | "privacy";

/**
 * For accounts that must use 2FA but haven't linked an app, the server also
 * accepts an emailed code. Remember the choice on this device so people who
 * picked email go straight to the code next time.
 */
const MFA_METHOD_KEY = "rtb-gis-mfa-method";
function readMfaMethod(): "email" | "app" | null {
  try {
    const v = localStorage.getItem(MFA_METHOD_KEY);
    return v === "email" || v === "app" ? v : null;
  } catch {
    return null;
  }
}
function rememberMfaMethod(method: "email" | "app") {
  try {
    localStorage.setItem(MFA_METHOD_KEY, method);
  } catch {
    /* private mode — just ask again next time */
  }
}

// Demo credentials are a local-development convenience only.
const DEV_EMAIL = import.meta.env.DEV ? "admin@rtb.gov.rw" : "";
const DEV_PASSWORD = import.meta.env.DEV ? "Admin@123" : "";

export default function Login() {
  const [email, setEmail] = useState(DEV_EMAIL);
  const [password, setPassword] = useState(DEV_PASSWORD);
  const [error, setErrorText] = useState("");
  // Bumped per error so the alert shakes again on a repeated failure.
  const [errorCount, setErrorCount] = useState(0);
  const setError = (message: string) => {
    setErrorText(message);
    if (message) setErrorCount((n) => n + 1);
  };
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<Step>("credentials");
  const [mfaToken, setMfaToken] = useState("");
  const { setSession } = useAuthStore();
  const navigate = useNavigate();

  const goHome = (user: User) => navigate(homePathFor(user));

  /** Runs the post-sign-in steps the account still owes, then enters the app. */
  const continueAfterSession = (user: User) => {
    if (user.mustChangePassword) return setStep("change-password");
    if (needsPrivacyAcceptance(user)) return setStep("privacy");
    goHome(user);
  };

  /** Shared by password and Google sign-in — both return the same payload. */
  const handleLoginResponse = (data: LoginResponse) => {
    setPassword("");
    if ("mfaRequired" in data) {
      setMfaToken(data.mfaToken);
      setStep("mfa");
      return;
    }
    if ("mfaEnrollmentRequired" in data) {
      setMfaToken(data.mfaToken);
      setStep(readMfaMethod() === "email" ? "enroll-email" : "enroll-choose");
      return;
    }
    completeSession(data);
  };

  const completeSession = (data: SessionPayload) => {
    setSession(data.accessToken, data.user);
    continueAfterSession(data.user);
  };

  const backToCredentials = () => {
    setMfaToken("");
    setError("");
    setStep("credentials");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await api.post<LoginResponse>("/auth/login", { email, password });
      handleLoginResponse(response.data);
    } catch (err) {
      setError(apiErrorMessage(err, "Sign-in failed. Check your email and password."));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleCredential = async (credential: GoogleCredential) => {
    setIsLoading(true);
    setError("");

    try {
      const response = await api.post<LoginResponse>("/auth/google", credential);
      handleLoginResponse(response.data);
    } catch (err) {
      setError(apiErrorMessage(err, "Google sign-in failed. Please try again."));
    } finally {
      setIsLoading(false);
    }
  };

  // Mandatory-2FA enrolment during sign-in: the confirm call also returns the
  // session, which is held until the user has saved the recovery codes.
  const [pendingSession, setPendingSession] = useState<SessionPayload | null>(null);

  if (step === "change-password") {
    return (
      <ForcePasswordChange
        onDone={() => {
          const user = useAuthStore.getState().user;
          if (user && needsPrivacyAcceptance(user)) setStep("privacy");
          else if (user) goHome(user);
        }}
      />
    );
  }

  if (step === "privacy") {
    return (
      <div className="min-h-dvh bg-background">
        <PrivacyAcceptancePrompt
          onAccepted={() => {
            const user = useAuthStore.getState().user;
            if (user) goHome(user);
          }}
        />
      </div>
    );
  }

  if (step === "mfa" || step === "enroll-email") {
    return (
      <AuthShell
        stepKey={step}
        art={step === "mfa" ? "verify" : "email"}
        title={step === "mfa" ? "Verify it's you" : "Check your email"}
      >
        <MfaChallenge<SessionPayload>
          mfaToken={mfaToken}
          initialMode={step === "enroll-email" ? "email" : "totp"}
          emailOnly={step === "enroll-email"}
          autoSend={step === "enroll-email"}
          extraOption={
            step === "enroll-email"
              ? { label: "Set up an authenticator app instead", onClick: () => setStep("enroll") }
              : undefined
          }
          onSuccess={completeSession}
          onCancel={backToCredentials}
        />
      </AuthShell>
    );
  }

  if (step === "enroll-choose") {
    const choose = (method: "email" | "app") => {
      rememberMfaMethod(method);
      setStep(method === "email" ? "enroll-email" : "enroll");
    };
    return (
      <AuthShell
        stepKey={step}
        art="choose"
        title="Add a second sign-in check"
      >
        <div className="space-y-3">
          <MethodOption
            icon={<Mail />}
            title="Email me a code"
            badge="Easiest"
            text="We send a 6-digit code to your work email each time you sign in. Nothing to install."
            onClick={() => choose("email")}
          />
          <MethodOption
            icon={<Smartphone />}
            title="Use an authenticator app"
            badge="Most secure"
            text="Get codes from a free phone app — works without email or internet. Takes about 2 minutes."
            onClick={() => choose("app")}
          />
        </div>
        <div className="flex justify-center">
          <button type="button" onClick={backToCredentials} className={authSubtleLinkClass}>
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back to sign in
          </button>
        </div>
      </AuthShell>
    );
  }

  if (step === "enroll") {
    return (
      <AuthShell stepKey={step} art="app" title="Set up your authenticator app">
        <MfaEnrollment
          start={async () =>
            (await api.post<EnrolmentStart>("/auth/2fa/enroll/start", { mfaToken })).data
          }
          confirm={async (code) => {
            const { data } = await api.post<SessionPayload & { recoveryCodes: string[] }>(
              "/auth/2fa/enroll/confirm",
              { mfaToken, code },
            );
            setPendingSession(data);
            rememberMfaMethod("app");
            return data;
          }}
          onDone={() => pendingSession && completeSession(pendingSession)}
          onCancel={() => setStep("enroll-choose")}
          cancelLabel="Choose a different method"
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      stepKey={step}
      art="signin"
      busy={isLoading}
      title="Sign in"
    >
      {error && <AuthAlert key={errorCount}>{error}</AuthAlert>}

      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="login-email" className={authLabelClass}>
            Work email
          </label>
          <AuthInput
            id="login-email"
            icon={<Mail />}
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus={!email}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@rtb.gov.rw"
            aria-invalid={!!error || undefined}
            required
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="login-password" className={authLabelClass}>
              Password
            </label>
            <Link to="/forgot-password" className={authLinkClass}>
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="login-password"
            leadingIcon={<Lock />}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            aria-invalid={!!error || undefined}
            required
          />
        </div>

        <Button type="submit" isLoading={isLoading} className={`${authPrimaryButtonClass} mt-2`}>
          {isLoading ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <GoogleSignInButton
        onCredential={(credential) => void handleGoogleCredential(credential)}
        onError={setError}
        disabled={isLoading}
        busy={isLoading}
        divider
      />
    </AuthShell>
  );
}

/** One selectable 2FA method on the enrolment chooser. */
function MethodOption({
  icon,
  title,
  badge,
  text,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  badge: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-start gap-3.5 ${authCardClass} bg-card dark:bg-white/[0.02] p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/60 dark:hover:border-primary/60 hover:shadow-lg hover:shadow-primary/5 hover:bg-primary/4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
    >
      <span className="h-10 w-10 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center transition-transform group-hover:scale-110 [&_svg]:h-5 [&_svg]:w-5">
        {icon}
      </span>
      <span className="flex-1 min-w-0 space-y-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-semibold text-foreground dark:text-white">{title}</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[13px] font-medium text-primary">
            {badge}
          </span>
        </span>
        <span className={`block text-sm leading-relaxed ${authMutedClass}`}>{text}</span>
      </span>
      <ChevronRight
        className="h-4 w-4 mt-2.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
        aria-hidden
      />
    </button>
  );
}
