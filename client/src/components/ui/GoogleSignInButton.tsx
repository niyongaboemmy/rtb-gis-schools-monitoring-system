import { useEffect, useRef, useState } from "react";

const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string;
    callback: (response: { credential?: string }) => void;
  }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } };
  }
}

/** Loads the Google Identity Services script once per page. */
function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GOOGLE_SCRIPT_SRC}"]`,
    );
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

interface Props {
  /** Receives the Google ID token to exchange with our API. */
  onCredential: (idToken: string) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}

/**
 * Renders Google's own sign-in button. Google requires its rendered widget
 * rather than a custom element, so this mounts into a container div.
 */
export function GoogleSignInButton({ onCredential, onError, disabled }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  // Keep the latest callbacks without re-running Google's one-time init.
  const handlers = useRef({ onCredential, onError });
  useEffect(() => {
    handlers.current = { onCredential, onError };
  });

  useEffect(() => {
    if (!clientId || !containerRef.current) return;
    let cancelled = false;

    loadGoogleScript()
      .then(() => {
        const id = window.google?.accounts?.id;
        if (cancelled || !id || !containerRef.current) return;

        id.initialize({
          client_id: clientId,
          callback: ({ credential }) => {
            if (credential) handlers.current.onCredential(credential);
            else handlers.current.onError("Google did not return a credential.");
          },
        });
        id.renderButton(containerRef.current, {
          theme: "outline",
          size: "large",
          shape: "pill",
          text: "continue_with",
          logo_alignment: "center",
          width: 380,
        });
        setReady(true);
      })
      .catch(() => {
        if (!cancelled)
          handlers.current.onError(
            "Could not load Google sign-in. Check your connection.",
          );
      });

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  // Unconfigured is a deployment state, not a user error — stay silent.
  if (!clientId) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-border/60 dark:bg-blue-700/20" />
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          or
        </span>
        <div className="h-px flex-1 bg-border/60 dark:bg-blue-700/20" />
      </div>

      <div
        className={`flex justify-center transition-opacity ${
          disabled ? "pointer-events-none opacity-50" : ""
        }`}
      >
        <div ref={containerRef} />
        {!ready && (
          <div className="h-10 w-full max-w-[380px] animate-pulse rounded-full bg-muted/50" />
        )}
      </div>
    </div>
  );
}
