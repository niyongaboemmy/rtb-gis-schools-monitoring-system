import { useState } from "react";
import { ShieldCheck, AlertTriangle } from "lucide-react";
import { Modal } from "../ui/modal";
import { Button } from "../ui/button";
import { api, apiErrorMessage } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import { PRIVACY_NOTICE_VERSION } from "./privacy";

/**
 * Privacy notice text (WS8.7). PLACEHOLDER WORDING — to be replaced after
 * review by RTB Legal against Law Nº 058/2021 of 13/10/2021 relating to the
 * protection of personal data and privacy. Bump PRIVACY_NOTICE_VERSION (here
 * and in server/src/modules/auth/auth.constants.ts) when it changes.
 */
export function PrivacyNoticeContent() {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-foreground/90">
      <div
        role="note"
        className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-semibold text-amber-700 dark:text-amber-300"
      >
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
        <span>
          Draft wording pending review by RTB Legal (Law Nº 058/2021 on the
          protection of personal data and privacy). Version {PRIVACY_NOTICE_VERSION}.
        </span>
      </div>
      <p>
        The Rwanda TVET Board (RTB) operates the TVET 3D GIS platform to monitor
        and plan TVET school infrastructure. As the data controller, RTB processes
        the personal data described below only for that purpose.
      </p>
      <h3 className="font-bold text-foreground">What we collect</h3>
      <ul className="list-disc pl-5 space-y-1">
        <li>Account data: name, work email, phone, department, role and assigned location.</li>
        <li>Security data: sign-in times, IP address, device/browser, and an audit trail of actions you take.</li>
        <li>Content you submit: school records, reports, photos, measurements and notes.</li>
      </ul>
      <h3 className="font-bold text-foreground">Why and how long</h3>
      <p>
        To provide the service, secure accounts, and keep an accountable record of
        changes to public infrastructure data. Audit records are retained as
        required by RTB policy; account data is kept while your account is active.
      </p>
      <h3 className="font-bold text-foreground">Your rights</h3>
      <p>
        You may request access to, correction of, or deletion of your personal data,
        and object to processing, subject to legal obligations. Contact the RTB data
        protection officer (contact to be confirmed by RTB).
      </p>
      <h3 className="font-bold text-foreground">Acceptable use</h3>
      <p>
        Access is for authorised personnel only. Do not share your credentials.
        Activity is logged and monitored.
      </p>
    </div>
  );
}

/** Read-only notice opened from the Login page. */
export function PrivacyNoticeModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Privacy notice & terms of use"
      maxWidth="max-w-2xl"
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <PrivacyNoticeContent />
    </Modal>
  );
}

/**
 * Blocking prompt shown once after sign-in when the user has not accepted the
 * current notice. Declining signs the user out.
 */
export function PrivacyAcceptancePrompt({ onAccepted }: { onAccepted?: () => void }) {
  const { user, updateUser, logout } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const version = user?.privacyNoticeVersion ?? PRIVACY_NOTICE_VERSION;

  const accept = async () => {
    setSaving(true);
    setError("");
    try {
      const { data } = await api.post<{ privacyAcceptedAt: string; privacyVersion: string }>(
        "/auth/privacy/accept",
        { version },
      );
      updateUser(data);
      onAccepted?.();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not record your acceptance. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={() => undefined}
      hideCloseButton
      title={
        <span className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
          Privacy notice & terms of use
        </span>
      }
      description="Please read and accept to continue."
      maxWidth="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={logout} disabled={saving}>
            Decline and sign out
          </Button>
          <Button onClick={() => void accept()} isLoading={saving}>
            I accept
          </Button>
        </>
      }
    >
      <PrivacyNoticeContent />
      {error && (
        <p role="alert" className="mt-4 text-sm font-semibold text-destructive">
          {error}
        </p>
      )}
    </Modal>
  );
}
