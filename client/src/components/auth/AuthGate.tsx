import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { ForcePasswordChange } from "./ForcePasswordChange";
import { PrivacyAcceptancePrompt } from "./PrivacyNotice";
import { needsPrivacyAcceptance } from "./privacy";

/** Brief splash while the access token is restored from the cookie. */
export function SessionSplash() {
  return (
    <div className="min-h-dvh w-full flex flex-col items-center justify-center gap-4 bg-background" role="status">
      <img src="/logortb.png" alt="" className="h-16 w-16 object-contain opacity-90" />
      <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
      <span className="sr-only">Restoring your session…</span>
    </div>
  );
}

/**
 * App-wide auth gate for signed-in pages:
 *  - splash while the session is restored on page load (no login flash),
 *  - the forced password change (WS10.3),
 *  - the privacy-notice acceptance prompt (WS8.7).
 * Wrap the protected part of the router with it.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { status, isAuthenticated, user } = useAuthStore();

  if (status === "restoring") return <SessionSplash />;
  if (isAuthenticated && user?.mustChangePassword) return <ForcePasswordChange />;

  return (
    <>
      {children}
      {isAuthenticated && needsPrivacyAcceptance(user) && <PrivacyAcceptancePrompt />}
    </>
  );
}
