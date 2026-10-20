import type { User } from "../../store/authStore";

/**
 * Fallback privacy-notice version; the server reports the authoritative one
 * as `user.privacyNoticeVersion` (server: auth.constants.ts).
 */
export const PRIVACY_NOTICE_VERSION = "2026-10-draft";

/** True when the user has not accepted the current notice. */
export function needsPrivacyAcceptance(user: User | null | undefined): boolean {
  if (!user) return false;
  const current = user.privacyNoticeVersion ?? PRIVACY_NOTICE_VERSION;
  return !user.privacyAcceptedAt || user.privacyVersion !== current;
}
