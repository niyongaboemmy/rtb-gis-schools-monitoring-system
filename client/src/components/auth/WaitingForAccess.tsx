import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, LogOut, RefreshCw } from "lucide-react";
import { api, apiErrorMessage } from "../../lib/api";
import { useAuthStore, type User } from "../../store/authStore";
import { Button } from "../ui/button";
import { AuthAlert, AuthShell } from "../ui/AuthShell";
import { authCardClass, authMutedClass, authPrimaryButtonClass } from "./auth-styles";

/**
 * Shown instead of the app to someone who signed in with TDMP but has no role
 * and area in RTB GIS yet (`user.accessPending`). TDMP sign-in carries no
 * role, so an RTB GIS administrator gives access (Settings ▸ Users). Nothing
 * here calls a data API: the server refuses them for pending accounts.
 */
export function WaitingForAccess() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);

  const name = user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : "";

  const checkAgain = async () => {
    setChecking(true);
    setMessage(null);
    try {
      const { data } = await api.get<User>("/auth/me");
      if (data.accessPending) {
        setMessage({ tone: "info", text: "No access yet. Please check again later." });
      } else {
        // Access granted: the gate lets the app through.
        updateUser({ ...data, accessPending: false });
      }
    } catch (err) {
      setMessage({ tone: "error", text: apiErrorMessage(err, "Could not check right now. Please try again.") });
    } finally {
      setChecking(false);
    }
  };

  const signOut = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <AuthShell stepKey="waiting-for-access" art="verify" busy={checking} title="Your account is waiting for access">
      <p className={`text-sm leading-relaxed ${authMutedClass}`}>
        You signed in with TDMP. An RTB GIS administrator needs to give you a role and area before you can use RTB GIS.
        You&rsquo;ll get access as soon as they do.
      </p>

      {user && (
        <div className={`flex items-center gap-3 ${authCardClass} p-4`} aria-label="Signed in as">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Clock className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0">
            {name && <span className="block truncate text-[15px] font-semibold text-foreground dark:text-white">{name}</span>}
            <span className={`block truncate text-sm ${authMutedClass}`}>{user.email}</span>
          </span>
        </div>
      )}

      {message && (
        <AuthAlert key={message.text} tone={message.tone === "error" ? "error" : "info"}>
          {message.text}
        </AuthAlert>
      )}

      <div className="space-y-2">
        <Button type="button" onClick={() => void checkAgain()} isLoading={checking} className={authPrimaryButtonClass}>
          {!checking && <RefreshCw className="h-4 w-4" aria-hidden />}
          {checking ? "Checking…" : "Check again"}
        </Button>
        <Button type="button" variant="outline" onClick={signOut} disabled={checking} className={authPrimaryButtonClass}>
          <LogOut className="h-4 w-4" aria-hidden /> Sign out
        </Button>
      </div>
    </AuthShell>
  );
}
