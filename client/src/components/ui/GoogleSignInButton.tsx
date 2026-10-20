import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client?hl=en";

interface TokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}
interface TokenClient {
  requestAccessToken: (overrides?: { prompt?: string }) => void;
}
interface TokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: TokenResponse) => void;
  error_callback?: (error: { type: string; message?: string }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: { initTokenClient: (config: TokenClientConfig) => TokenClient };
      };
    };
  }
}

/** Loads Google Identity Services once per page. */
function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("load failed")));
      return;
    }
    const script = document.createElement("script");
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("load failed"));
    document.head.appendChild(script);
  });
}

/** What the server's /auth/google and /auth/google/link endpoints accept. */
export interface GoogleCredential {
  accessToken: string;
}

interface Props {
  /** Receives the Google credential to send to our API. */
  onCredential: (credential: GoogleCredential) => void;
  onError: (message: string) => void;
  disabled?: boolean;
  /** Our own request is running after Google returned (shows a spinner). */
  busy?: boolean;
  label?: string;
  /** Show the "or" divider above the button (sign-in screen). */
  divider?: boolean;
}

/**
 * "Continue with Google", drawn by us with the official multi-colour "G" and
 * wording, on a soft frosted (light) / glass (dark) surface that matches the
 * app's other fields and buttons.
 *
 * Uses the OAuth token client (scope "openid email profile"): clicking opens
 * Google's account chooser and returns an access token, which the server
 * verifies was issued to our client before trusting it.
 */
export function GoogleSignInButton({
  onCredential,
  onError,
  disabled,
  busy,
  label = "Continue with Google",
  divider,
}: Props) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  const clientRef = useRef<TokenClient | null>(null);
  const [opening, setOpening] = useState(false);

  // Keep the latest callbacks without re-creating Google's token client.
  const handlers = useRef({ onCredential, onError });
  useEffect(() => {
    handlers.current = { onCredential, onError };
  });

  // Preload so the popup opens instantly on click (popup blockers need the
  // window to open within the click, not after an await).
  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        const oauth2 = window.google?.accounts?.oauth2;
        if (cancelled || !oauth2) return;
        clientRef.current = oauth2.initTokenClient({
          client_id: clientId,
          scope: "openid email profile",
          callback: (response) => {
            setOpening(false);
            if (response.access_token) handlers.current.onCredential({ accessToken: response.access_token });
            else if (response.error !== "access_denied")
              handlers.current.onError(response.error_description || "Google sign-in was not completed.");
          },
          error_callback: (error) => {
            setOpening(false);
            // Closing the chooser is a choice, not an error.
            if (error.type === "popup_closed") return;
            handlers.current.onError(
              error.type === "popup_failed_to_open"
                ? "Your browser blocked the Google window. Allow pop-ups for this site and try again."
                : "Google sign-in is unavailable right now. Please try again.",
            );
          },
        });
      })
      .catch(() => {
        if (!cancelled) handlers.current.onError("Could not load Google sign-in. Check your connection.");
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  // Unconfigured is a deployment state, not a user error — stay silent.
  if (!clientId) return null;

  const start = () => {
    if (!clientRef.current) {
      onError("Google sign-in is still loading. Try again in a moment.");
      return;
    }
    setOpening(true);
    clientRef.current.requestAccessToken({ prompt: "select_account" });
  };

  const working = busy || opening;

  return (
    <div className="space-y-5">
      {divider && (
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
          <span className="text-xs text-muted-foreground dark:text-white/60">or</span>
          <div className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
        </div>
      )}

      <button
        type="button"
        onClick={start}
        disabled={disabled || working}
        aria-busy={working || undefined}
        className={cn(
          "group relative flex h-11 w-full items-center justify-center gap-3 overflow-hidden rounded-full border px-5 text-sm font-medium",
          "transition-[background-color,box-shadow,transform,border-color] duration-200 ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100",
          // Light: frosted white card, hairline border, soft blue glow on hover
          "border-gray-200 bg-white/80 text-[#1F1F1F] shadow-sm shadow-slate-900/5 backdrop-blur-sm",
          "hover:border-primary/30 hover:bg-white hover:shadow-md hover:shadow-primary/10",
          // Dark: translucent glass on the navy background
          "dark:border-white/10 dark:bg-white/[0.04] dark:text-white/90 dark:shadow-none",
          "dark:hover:border-blue-400/30 dark:hover:bg-white/[0.08] dark:hover:shadow-lg dark:hover:shadow-blue-500/10",
          "hover:-translate-y-px disabled:hover:translate-y-0 disabled:hover:shadow-none",
        )}
      >
        <span className="relative flex h-4.5 w-4.5 items-center justify-center">
          {working ? (
            <Loader2 className="h-4.5 w-4.5 animate-spin text-primary/70 dark:text-blue-400/70" aria-hidden />
          ) : (
            <GoogleG className="h-4.5 w-4.5 transition-transform duration-300 group-hover:scale-110" />
          )}
        </span>
        <span>{working ? "Connecting to Google…" : label}</span>
      </button>
    </div>
  );
}

/** Google's official multi-colour "G" mark. */
function GoogleG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
