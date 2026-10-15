import { useEffect, useState } from "react";
import { Copy, Download, KeyRound, Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "../ui/button";
import { OtpInput } from "../ui/otp-input";
import { apiErrorMessage } from "../../lib/api";
import { useToast } from "../ui/toast";

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
  /** After the user has saved their recovery codes. */
  onDone: () => void;
  onCancel?: () => void;
  cancelLabel?: string;
}

type Step = "scan" | "codes";

/**
 * Authenticator-app enrolment wizard (WS10.5): scan the QR (or copy the key),
 * confirm a code, then save the recovery codes shown once.
 */
export function MfaEnrollment({ start, confirm, onDone, onCancel, cancelLabel = "Cancel" }: Props) {
  const toast = useToast();
  const [step, setStep] = useState<Step>("scan");
  const [setup, setSetup] = useState<EnrolmentStart | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
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
      setError(apiErrorMessage(err, "That code is not valid. Check your device clock and try again."));
    } finally {
      setLoading(false);
    }
  };

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copied`);
    } catch {
      toast.error("Copy failed — select and copy it manually.");
    }
  };

  const download = () => {
    const body = [
      "RTB GIS — two-factor recovery codes",
      `Generated ${new Date().toISOString()}`,
      "Each code works once. Keep them somewhere safe and private.",
      "",
      ...codes,
    ].join("\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "rtb-gis-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
    setSaved(true);
  };

  if (step === "codes") {
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
          </div>
          <div>
            <h3 className="font-bold text-foreground">Two-factor authentication is on</h3>
            <p className="text-sm text-muted-foreground">
              Save these recovery codes now. Each one signs you in once if you lose
              your phone. They will not be shown again.
            </p>
          </div>
        </div>
        <ul
          aria-label="Recovery codes"
          className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-muted/40 p-4 font-mono text-sm"
        >
          {codes.map((c) => (
            <li key={c} className="text-center tracking-wider select-all">
              {c}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void copy(codes.join("\n"), "Recovery codes");
              setSaved(true);
            }}
          >
            <Copy className="h-4 w-4 mr-1.5" aria-hidden /> Copy
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={download}>
            <Download className="h-4 w-4 mr-1.5" aria-hidden /> Download
          </Button>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={saved}
            onChange={(e) => setSaved(e.target.checked)}
            className="h-4 w-4 rounded border-input accent-primary"
          />
          I have saved my recovery codes somewhere safe
        </label>
        <Button type="button" className="w-full" disabled={!saved} onClick={onDone}>
          Continue
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {loading && !setup ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground" role="status">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          <span className="sr-only">Preparing set-up…</span>
        </div>
      ) : setup ? (
        <>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal pl-5">
            <li>
              Install an authenticator app (Google Authenticator, Microsoft
              Authenticator, Authy…) on your phone.
            </li>
            <li>Scan this QR code, or enter the key manually.</li>
            <li>Type the 6-digit code the app shows.</li>
          </ol>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <img
              src={setup.qrDataUrl}
              alt="QR code for your authenticator app"
              className="h-44 w-44 rounded-xl border border-border bg-white p-2"
            />
            <div className="w-full min-w-0 space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <KeyRound className="h-3.5 w-3.5" aria-hidden /> Manual key
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 min-w-0 break-all rounded-lg bg-muted px-3 py-2 text-xs font-mono select-all">
                  {setup.secret.replace(/(.{4})/g, "$1 ").trim()}
                </code>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Copy key"
                  onClick={() => void copy(setup.secret, "Key")}
                >
                  <Copy className="h-4 w-4" aria-hidden />
                </Button>
              </div>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Smartphone className="h-3.5 w-3.5" aria-hidden /> Account: RTB GIS
              </p>
            </div>
          </div>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <fieldset className="space-y-2">
              <legend className="text-sm font-bold text-foreground/80">Code from the app</legend>
              <OtpInput value={code} onChange={setCode} disabled={loading} onComplete={(v) => void submit(v)} />
            </fieldset>
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              {onCancel && (
                <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
                  {cancelLabel}
                </Button>
              )}
              <Button type="submit" isLoading={loading} disabled={code.length !== 6}>
                Turn on two-factor
              </Button>
            </div>
          </form>
        </>
      ) : null}
      {error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {error}
        </p>
      )}
      {!setup && !loading && onCancel && (
        <Button type="button" variant="ghost" onClick={onCancel}>
          {cancelLabel}
        </Button>
      )}
    </div>
  );
}
