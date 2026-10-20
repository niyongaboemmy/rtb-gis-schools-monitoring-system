import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";

const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client?hl=en";

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
    const container = containerRef.current;
    if (!clientId || !container) return;
    let cancelled = false;
    let renderedWidth = 0;

    // Google renders a fixed-width iframe (200–400px), so size it to the
    // column and re-render when the column changes (rotation, resize).
    const render = () => {
      const id = window.google?.accounts?.id;
      const width = Math.round(Math.min(400, Math.max(200, container.parentElement?.clientWidth ?? 400)));
      if (!id || Math.abs(width - renderedWidth) < 8) return;
      renderedWidth = width;
      container.innerHTML = "";
      id.renderButton(container, {
        // Google's clean white pill in both themes: it reads as the
        // recognisable Google button on light and dark alike, and can't get
        // stuck in the wrong style when the theme changes.
        theme: "outline",
        size: "large",
        shape: "pill",
        text: "continue_with",
        logo_alignment: "center",
        locale: "en",
        width,
      });
    };
    const observer = new ResizeObserver(() => render());

    loadGoogleScript()
      .then(() => {
        const id = window.google?.accounts?.id;
        if (cancelled || !id) return;

        id.initialize({
          client_id: clientId,
          callback: ({ credential }) => {
            if (credential) handlers.current.onCredential(credential);
            else handlers.current.onError("Google did not return a credential.");
          },
        });
        render();
        if (container.parentElement) observer.observe(container.parentElement);
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
      observer.disconnect();
    };
  }, [clientId]);

  // Unconfigured is a deployment state, not a user error — stay silent.
  if (!clientId) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
        <span className="text-xs text-muted-foreground dark:text-white/60">or</span>
        <div className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
      </div>

      {/* Fixed-height slot so the form doesn't jump when Google's iframe
          arrives; :hover still reaches this wrapper over the iframe. */}
      <div
        className={cn(
          "relative flex h-10 justify-center rounded-full transition-all duration-200",
          "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/40",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <div ref={containerRef} className={cn("transition-opacity duration-300", ready ? "opacity-100" : "opacity-0")} />
        {!ready && (
          <div className="absolute inset-0 animate-pulse rounded-full bg-gray-200/70 dark:bg-white/10" />
        )}
      </div>
    </div>
  );
}
