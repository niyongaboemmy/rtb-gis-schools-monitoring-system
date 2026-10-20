import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Check, ChevronDown, Copy, Download, ExternalLink, Loader2, Smartphone } from "lucide-react";
import { Button } from "../ui/button";
import { OtpInput } from "../ui/otp-input";
import { AuthAlert } from "../ui/AuthShell";
import { apiErrorMessage } from "../../lib/api";
import { useToast } from "../ui/toast";
import { cn } from "../../lib/utils";

export interface EnrolmentStart {
  otpauthUrl: string;
  qrDataUrl: string;
  secret: string;
}

interface Props {
  /** Generates a new secret (login-time or profile endpoint). */
  start: () => Promise<EnrolmentStart>;
  /** Confirms a code; must resolve with the one-time recovery codes. */
  confirm: (code: string) => Promise<{ recoveryCodes: string[] }>;
  /** After the backup-codes screen. */
  onDone: () => void;
  onCancel?: () => void;
  cancelLabel?: string;
}

type Step = "app" | "scan" | "verify" | "codes";

const STEPS: { id: Exclude<Step, "codes">; label: string }[] = [
  { id: "app", label: "Get the app" },
  { id: "scan", label: "Add your account" },
  { id: "verify", label: "Confirm" },
];

const APPS = [
  {
    name: "Google Authenticator",
    ios: "https://apps.apple.com/app/google-authenticator/id388497605",
    android: "https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2",
  },
  {
    name: "Microsoft Authenticator",
    ios: "https://apps.apple.com/app/microsoft-authenticator/id983156458",
    android: "https://play.google.com/store/apps/details?id=com.azure.authenticator",
  },
];

/**
 * Authenticator-app set-up wizard (WS10.5), one action per screen:
 * get an app → add the account (QR, tap-to-add on a phone, or key) →
 * confirm a code → optionally keep the backup codes.
 */
export function MfaEnrollment({ start, confirm, onDone, onCancel, cancelLabel = "Cancel" }: Props) {
  const toast = useToast();
  const reduce = useReducedMotion();
  const [step, setStep] = useState<Step>("app");
  const [setup, setSetup] = useState<EnrolmentStart | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    start()
      .then((data) => !cancelled && setSetup(data))
      .catch((err) => !cancelled && setError(apiErrorMessage(err, "Could not start set-up.")))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // Starting twice would rotate the secret under the user; run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (value = code) => {
    if (value.length !== 6) return;
    setLoading(true);
    setError("");
    try {
      const result = await confirm(value);
      setCodes(result.recoveryCodes);
      setStep("codes");
    } catch (err) {
      setCode("");
      setError(
        apiErrorMessage(err, "That code didn't match. Type the code currently shown in the app — it changes every 30 seconds."),
      );
    } finally {
      setLoading(false);
    }
  };

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copied`);
      return true;
    } catch {
      toast.error("Copy failed — select and copy it manually.");
      return false;
    }
  };

  const download = () => {
    const body = [
      "TVET 3D GIS — two-factor backup codes",
      `Generated ${new Date().toISOString()}`,
      "Each code signs you in once if you lose your phone. Keep them private.",
      "",
      ...codes,
    ].join("\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "tvet-gis-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
    setSaved(true);
  };

  if (step === "codes") {
    return (
      <div className="space-y-5">
        <AuthAlert tone="success">
          <p className="font-medium">Two-factor authentication is on.</p>
        </AuthAlert>
        <div className="space-y-1.5">
          <h3 className="text-base font-semibold text-foreground dark:text-white">Keep these backup codes (optional)</h3>
          <p className="text-sm text-muted-foreground dark:text-white/70 leading-relaxed">
            If you lose your phone, each code signs you in once. You can also
            always ask for a sign-in code by email, so this is just an extra
            safety net. They won't be shown again.
          </p>
        </div>
        <ul
          aria-label="Backup codes"
          className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-xl border border-gray-300/80 dark:border-white/15 bg-muted/40 dark:bg-white/[0.03] px-4 py-3 font-mono text-sm"
        >
          {codes.map((c, i) => (
            <motion.li
              key={c}
              initial={reduce ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.04 }}
              className="text-center tracking-wider select-all text-foreground dark:text-white"
            >
              {c}
            </motion.li>
          ))}
        </ul>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-gray-300 dark:border-white/20 bg-transparent dark:text-white dark:hover:bg-white/5 h-11 rounded-full"
            onClick={async () => {
              if (await copy(codes.join("\n"), "Backup codes")) setSaved(true);
            }}
          >
            <Copy className="h-4 w-4 mr-2" aria-hidden /> Copy
          </Button>
          <Button type="button" variant="outline" className="border-gray-300 dark:border-white/20 bg-transparent dark:text-white dark:hover:bg-white/5 h-11 rounded-full" onClick={download}>
            <Download className="h-4 w-4 mr-2" aria-hidden /> Download
          </Button>
        </div>
        <Button type="button" className="w-full h-11 rounded-full font-semibold" onClick={onDone}>
          {saved ? "Done — continue" : "Continue"}
        </Button>
      </div>
    );
  }

  if (!setup) {
    return (
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground dark:text-white/70" role="status">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Preparing set-up…
          </div>
        ) : (
          error && <AuthAlert>{error}</AuthAlert>
        )}
        {!loading && onCancel && (
          <Button type="button" variant="ghost" className="w-full h-10 rounded-full" onClick={onCancel}>
            {cancelLabel}
          </Button>
        )}
      </div>
    );
  }

  const index = STEPS.findIndex((s) => s.id === step);
  const back = () => {
    setError("");
    if (index === 0) onCancel?.();
    else setStep(STEPS[index - 1].id);
  };

  return (
    <div className="space-y-5">
      <ol className="flex gap-1.5" aria-label="Set-up progress">
        {STEPS.map((s, i) => (
          <li key={s.id} className="flex-1 space-y-1.5" aria-current={i === index ? "step" : undefined}>
            <span className={cn("block h-1 rounded-full transition-colors", i <= index ? "bg-primary" : "bg-gray-200 dark:bg-white/10")} />
            <span
              className={cn(
                "flex items-center gap-1 text-xs",
                i === index ? "font-medium text-foreground dark:text-white" : "text-muted-foreground dark:text-white/70",
              )}
            >
              {i < index && <Check className="h-3 w-3 text-primary" aria-hidden />}
              <span className="truncate">{s.label}</span>
            </span>
          </li>
        ))}
      </ol>

      <motion.div
        key={step}
        initial={reduce ? false : { opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
      {step === "app" && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <h3 className="text-base font-semibold text-foreground dark:text-white">Install a free authenticator app</h3>
            <p className="text-sm text-muted-foreground dark:text-white/70 leading-relaxed">
              It shows a new 6-digit code every 30 seconds. Any app works —
              these are the most common. Already have one? Just continue.
            </p>
          </div>
          <ul className="space-y-2">
            {APPS.map((app) => (
              <li
                key={app.name}
                className="flex items-center justify-between gap-3 rounded-xl border border-gray-300/80 dark:border-white/15 px-3.5 py-3"
              >
                <span className="flex items-center gap-2.5 min-w-0 text-sm font-medium text-foreground dark:text-white">
                  <Smartphone className="h-4 w-4 shrink-0 text-muted-foreground dark:text-white/70" aria-hidden />
                  <span className="truncate">{app.name}</span>
                </span>
                <span className="flex shrink-0 gap-3 text-xs font-medium">
                  <a href={app.ios} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                    iPhone
                  </a>
                  <a href={app.android} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                    Android
                  </a>
                </span>
              </li>
            ))}
          </ul>
          <Button type="button" className="w-full h-11 rounded-full font-semibold" onClick={() => setStep("scan")}>
            I have the app — continue
          </Button>
        </div>
      )}

      {step === "scan" && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <h3 className="text-base font-semibold text-foreground dark:text-white">Add your account to the app</h3>
            <p className="text-sm text-muted-foreground dark:text-white/70 leading-relaxed">
              In the app, tap <strong className="font-medium text-foreground dark:text-white">+</strong> or{" "}
              <strong className="font-medium text-foreground dark:text-white">Add account</strong>, then point your
              phone's camera at this code.
            </p>
          </div>
          <div className="flex justify-center">
            <img
              src={setup.qrDataUrl}
              alt="QR code to add TVET 3D GIS to your authenticator app"
              className="h-44 w-44 rounded-xl border border-gray-300/80 dark:border-white/15 bg-white p-2"
            />
          </div>
          {/* On a phone the camera can't scan its own screen — open the app directly. */}
          <a
            href={setup.otpauthUrl}
            className="flex items-center justify-center gap-2 rounded-full border border-gray-300/80 dark:border-white/15 h-11 text-sm font-medium text-foreground dark:text-white hover:bg-muted transition-colors sm:hidden"
          >
            <ExternalLink className="h-4 w-4" aria-hidden /> On this phone? Tap to add the account
          </a>
          <div className="rounded-xl border border-gray-300/80 dark:border-white/15">
            <button
              type="button"
              aria-expanded={showKey}
              onClick={() => setShowKey((v) => !v)}
              className="flex w-full items-center justify-between px-3.5 py-2.5 text-sm font-medium text-muted-foreground dark:text-white/70 hover:text-foreground"
            >
              Can't scan? Type a set-up key instead
              <ChevronDown className={cn("h-4 w-4 transition-transform", showKey && "rotate-180")} aria-hidden />
            </button>
            {showKey && (
              <div className="space-y-2 border-t border-gray-300/80 dark:border-white/15 px-3.5 py-3">
                <p className="text-xs text-muted-foreground dark:text-white/70">
                  Choose “Enter a set-up key”, use <strong className="font-medium">TVET 3D GIS</strong> as
                  the account name, and type:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 min-w-0 break-all rounded-lg bg-muted dark:bg-white/5 px-3 py-2 text-sm font-mono tracking-wide select-all">
                    {setup.secret.replace(/(.{4})/g, "$1 ").trim()}
                  </code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full shrink-0"
                    aria-label="Copy set-up key"
                    onClick={() => void copy(setup.secret, "Set-up key")}
                  >
                    <Copy className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <Button type="button" variant="outline" className="border-gray-300 dark:border-white/20 bg-transparent dark:text-white dark:hover:bg-white/5 h-11 rounded-full" onClick={back} aria-label="Back">
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </Button>
            <Button type="button" className="h-11 rounded-full font-semibold" onClick={() => setStep("verify")}>
              I've added it — continue
            </Button>
          </div>
        </div>
      )}

      {step === "verify" && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="space-y-1.5">
            <h3 className="text-base font-semibold text-foreground dark:text-white">Enter the code from the app</h3>
            <p className="text-sm text-muted-foreground dark:text-white/70 leading-relaxed">
              Type the 6-digit code shown under <strong className="font-medium text-foreground dark:text-white">TVET 3D GIS</strong>.
            </p>
          </div>
          <OtpInput
            value={code}
            onChange={setCode}
            busy={loading}
            invalid={!!error}
            label="Code from your authenticator app"
            onComplete={(v) => void submit(v)}
          />
          {error && <AuthAlert>{error}</AuthAlert>}
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <Button type="button" variant="outline" className="border-gray-300 dark:border-white/20 bg-transparent dark:text-white dark:hover:bg-white/5 h-11 rounded-full" onClick={back} disabled={loading} aria-label="Back">
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </Button>
            <Button type="submit" className="h-11 rounded-full font-semibold" isLoading={loading} disabled={code.length !== 6}>
              Turn on two-factor
            </Button>
          </div>
        </form>
      )}

      </motion.div>

      {step === "app" && onCancel && (
        <Button type="button" variant="ghost" className="w-full h-10 rounded-full text-muted-foreground dark:text-white/70" onClick={onCancel}>
          {cancelLabel}
        </Button>
      )}
    </div>
  );
}
