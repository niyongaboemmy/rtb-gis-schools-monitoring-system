import { useCallback, useEffect, useRef, useState } from "react";

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "wheel", "touchstart", "scroll"] as const;

/** Shared across tabs so activity in one tab keeps the others alive. */
const STORAGE_KEY = "rtb-last-activity";

export interface IdleTimeoutOptions {
  /** Inactivity before sign-out. Default: VITE_IDLE_TIMEOUT_MINUTES or 30. */
  timeoutMs?: number;
  /** How long before sign-out the warning appears. Default 2 minutes. */
  warningMs?: number;
  onTimeout: () => void;
  enabled?: boolean;
}

export function idleTimeoutMsFromEnv(): number {
  const minutes = Number(import.meta.env.VITE_IDLE_TIMEOUT_MINUTES);
  return (Number.isFinite(minutes) && minutes > 0 ? minutes : 30) * 60_000;
}

/**
 * Tracks user inactivity (WS9.16). Returns whether the warning should show,
 * the seconds left, and `stayActive()` to dismiss it.
 */
export function useIdleTimeout({
  timeoutMs = idleTimeoutMsFromEnv(),
  warningMs = 2 * 60_000,
  onTimeout,
  enabled = true,
}: IdleTimeoutOptions) {
  const lastActivity = useRef(Date.now());
  const [warning, setWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.round(warningMs / 1000));
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;
  const warningRef = useRef(false);

  const markActive = useCallback(() => {
    lastActivity.current = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, String(lastActivity.current));
    } catch {
      /* storage unavailable */
    }
  }, []);

  const stayActive = useCallback(() => {
    markActive();
    warningRef.current = false;
    setWarning(false);
  }, [markActive]);

  useEffect(() => {
    if (!enabled) return;
    markActive();

    let throttle = 0;
    const onActivity = () => {
      // Once the warning shows, only the explicit button counts as activity.
      if (warningRef.current) return;
      const now = Date.now();
      if (now - throttle < 1000) return;
      throttle = now;
      markActive();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        lastActivity.current = Math.max(lastActivity.current, Number(e.newValue));
        if (warningRef.current && Date.now() - lastActivity.current < timeoutMs - warningMs) {
          warningRef.current = false;
          setWarning(false);
        }
      }
    };

    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));
    window.addEventListener("storage", onStorage);

    const timer = window.setInterval(() => {
      const idle = Date.now() - lastActivity.current;
      if (idle >= timeoutMs) {
        window.clearInterval(timer);
        warningRef.current = false;
        setWarning(false);
        onTimeoutRef.current();
      } else if (idle >= timeoutMs - warningMs) {
        warningRef.current = true;
        setWarning(true);
        setSecondsLeft(Math.max(0, Math.ceil((timeoutMs - idle) / 1000)));
      }
    }, 1000);

    return () => {
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, onActivity));
      window.removeEventListener("storage", onStorage);
      window.clearInterval(timer);
    };
  }, [enabled, timeoutMs, warningMs, markActive]);

  return { warning, secondsLeft, stayActive };
}
