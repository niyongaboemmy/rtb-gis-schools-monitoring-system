import { LogOut } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { AuthShell } from "../ui/AuthShell";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { authPrimaryButtonClass, authSubtleLinkClass } from "./auth-styles";

/**
 * Full-screen step for accounts an administrator created or imported
 * (WS10.3). The server refuses every other API call until this is done.
 */
export function ForcePasswordChange({ onDone }: { onDone?: () => void }) {
  const { user, logout } = useAuthStore();
  return (
    <AuthShell
      art="password"
      title="Choose your own password"
      description={
        <>
          {user?.firstName ? `Welcome, ${user.firstName}. ` : ""}
          Your account was set up by an administrator. Replace the temporary
          password you were given before continuing.
        </>
      }
    >
      <ChangePasswordForm
        currentLabel="Temporary password"
        submitLabel="Save and continue"
        submitClassName={authPrimaryButtonClass}
        onDone={onDone}
      />
      <div className="flex justify-center">
        <button type="button" onClick={logout} className={authSubtleLinkClass}>
          <LogOut className="h-4 w-4" aria-hidden /> Sign out
        </button>
      </div>
    </AuthShell>
  );
}
