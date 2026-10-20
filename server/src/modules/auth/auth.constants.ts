import { Permission } from '../../common/constants/permissions.constant';

/** httpOnly cookie carrying the refresh token (WS9.15). */
export const REFRESH_COOKIE = 'rtb_rt';
/** The cookie is only ever sent to the auth routes. */
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

/** Header a browser cannot add cross-site without a CORS preflight. */
export const CSRF_HEADER = 'x-requested-with';
export const CSRF_HEADER_VALUE = 'XMLHttpRequest';

/** Lockout (WS9.5): this many failures lock the account for LOCK_MINUTES. */
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

/** Short-lived token bridging password → second factor (WS10.6). */
export const MFA_TOKEN_TTL_SECONDS = 5 * 60;

/** A rotated refresh token is still honoured this long (parallel tabs). */
export const REFRESH_REUSE_GRACE_MS = 30 * 1000;

/** Roles holding any of these must use 2FA when enforcement is on (WS10.7). */
export const MFA_PRIVILEGED_PERMISSIONS: string[] = [
  Permission.MANAGE_USERS,
  Permission.MANAGE_ROLES,
  Permission.MANAGE_DECISIONS,
  Permission.VIEW_AUDIT_LOGS,
];

/**
 * Version of the privacy notice users must accept (WS8.7). Bump when the
 * notice text changes; users are prompted again. Mirrored in the client
 * (`client/src/components/auth/privacy.ts`).
 */
export const PRIVACY_NOTICE_VERSION = '2026-10-draft';

/** Generic sign-in failure: never reveals whether the account exists. */
export const INVALID_CREDENTIALS =
  'Invalid email or password. Repeated failures temporarily lock the account.';
