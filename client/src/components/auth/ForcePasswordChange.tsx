import { KeyRound } from "lucide-react";
import { Button } from "../ui/button";
import { useAuthStore } from "../../store/authStore";
import { ChangePasswordForm } from "./ChangePasswordForm";

/**
 * Full-screen step for accounts an administrator created or imported
 * (WS10.3). The server refuses every other API call until this is done.
 */
export function ForcePasswordChange({ onDone }: { onDone?: () => void }) {
  const { user, logout } = useAuthStore();
  return (
    <div className="min-h-dvh w-full flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 sm:p-8 space-y-6">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <KeyRound className="h-5 w-5 text-primary" aria-hidden />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-foreground">Choose your own password</h1>
            <p className="text-sm text-muted-foreground">
              {user?.firstName ? `Welcome, ${user.firstName}. ` : ""}
              Your account was set up by an administrator. Replace the temporary
              password before continuing.
            </p>
          </div>
        </div>
        <ChangePasswordForm
          currentLabel="Temporary password"
          submitLabel="Save and continue"
          onDone={onDone}
        />
        <Button variant="ghost" size="sm" onClick={logout} className="w-full">
          Sign out
        </Button>
      </div>
    </div>
  );
}
