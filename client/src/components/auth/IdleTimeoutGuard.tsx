import { Clock } from "lucide-react";
import { Modal } from "../ui/modal";
import { Button } from "../ui/button";
import { useAuthStore } from "../../store/authStore";
import { useIdleTimeout } from "../../hooks/useIdleTimeout";
import { useToast } from "../ui/toast";

/**
 * Signs the user out after inactivity (WS9.16) with a 2-minute warning.
 * Mount once inside the authenticated layout.
 */
export function IdleTimeoutGuard() {
  const { isAuthenticated, logout } = useAuthStore();
  const toast = useToast();
  const { warning, secondsLeft, stayActive } = useIdleTimeout({
    enabled: isAuthenticated,
    onTimeout: () => {
      logout();
      toast.info("You were signed out after a period of inactivity.", { title: "Session ended" });
    },
  });

  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <Modal
      isOpen={isAuthenticated && warning}
      onClose={stayActive}
      title={
        <span className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-amber-500" aria-hidden />
          Are you still there?
        </span>
      }
      maxWidth="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={logout}>
            Sign out now
          </Button>
          <Button onClick={stayActive} autoFocus>
            Stay signed in
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground" aria-live="polite">
        For your security you will be signed out in{" "}
        <strong className="text-foreground tabular-nums">
          {mm}:{ss}
        </strong>{" "}
        because of inactivity.
      </p>
    </Modal>
  );
}
