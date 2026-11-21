import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Settings for the TDMP integration (TVET Data Management Platform,
 * https://tdmp.rtb.gov.rw). TDMP is the source of truth for users and school
 * information; RTB GIS keeps GPS and everything GIS.
 *
 * Two independent switches:
 *  - login: users sign in with their TDMP account (OAuth 2.0 / OIDC,
 *    authorization code + PKCE). Needs TDMP_OAUTH_CLIENT_ID/SECRET and an
 *    AUTH_MODE of `both` or `tdmp`.
 *  - sync:  school data is copied from the TDMP API. Needs TDMP_API_KEY.
 */
export type AuthMode = 'local' | 'both' | 'tdmp';

export const AUTH_MODES: readonly AuthMode[] = ['local', 'both', 'tdmp'];

export const DEFAULT_TDMP_BASE_URL = 'https://tdmp.rtb.gov.rw/api/v1';

@Injectable()
export class TdmpConfig {
  constructor(private readonly config: ConfigService) {}

  private str(key: string): string {
    return (this.config.get<string>(key) ?? '').trim();
  }

  private int(key: string, fallback: number, min = 0): number {
    const n = Number.parseInt(this.str(key), 10);
    return Number.isFinite(n) && n >= min ? n : fallback;
  }

  /** e.g. https://tdmp.rtb.gov.rw/api/v1 (no trailing slash). */
  get baseUrl(): string {
    return (this.str('TDMP_BASE_URL') || DEFAULT_TDMP_BASE_URL).replace(
      /\/+$/,
      '',
    );
  }

  /** OIDC issuer; TDMP's discovery document uses the API base URL. */
  get issuer(): string {
    return this.str('TDMP_ISSUER') || this.baseUrl;
  }

  // ── Login ─────────────────────────────────────────────────────────────────

  get authMode(): AuthMode {
    const raw = this.str('AUTH_MODE').toLowerCase();
    return (AUTH_MODES as readonly string[]).includes(raw)
      ? (raw as AuthMode)
      : 'local';
  }

  get clientId(): string {
    return this.str('TDMP_OAUTH_CLIENT_ID');
  }

  get clientSecret(): string {
    return this.str('TDMP_OAUTH_CLIENT_SECRET');
  }

  get scopes(): string {
    return this.str('TDMP_OAUTH_SCOPES') || 'openid email profile';
  }

  /**
   * Try `prompt=none` first so a user already signed in to TDMP comes straight
   * back. Off until TDMP confirms support (request R6): an authorize request
   * TDMP does not understand would leave the user on a TDMP error page.
   */
  get silentSignIn(): boolean {
    return this.str('TDMP_OAUTH_SILENT').toLowerCase() === 'true';
  }

  /** Public URL of the web app (where the browser is sent after sign-in). */
  get appPublicUrl(): string {
    const explicit = this.str('APP_PUBLIC_URL');
    const first = this.str('APP_CORS_ORIGINS').split(',')[0]?.trim() ?? '';
    return (explicit || first || 'http://localhost:5173').replace(/\/+$/, '');
  }

  /**
   * Must match a redirect URI registered with TDMP exactly. The default is
   * the public path from TDMP's SSO guide; the web app hands it to the API
   * route `/api/v1/auth/tdmp/callback` (client/src/lib/tdmp-relay.ts), and
   * that API route also works as a redirect URI by itself.
   */
  get redirectUri(): string {
    return (
      this.str('TDMP_OAUTH_REDIRECT_URI') ||
      `${this.appPublicUrl}/auth/tdmp/callback`
    );
  }

  get loginEnabled(): boolean {
    return this.authMode !== 'local' && !!this.clientId && !!this.clientSecret;
  }

  /** Password sign-in for everyone (local / both modes). */
  get passwordLoginOpen(): boolean {
    return this.authMode !== 'tdmp';
  }

  /**
   * Emergency ("break-glass") accounts that may still use a password when
   * AUTH_MODE=tdmp, e.g. while TDMP is down. Empty = nobody.
   */
  get localLoginAllowlist(): string[] {
    return this.str('LOCAL_LOGIN_ALLOWLIST')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  }

  mayUsePassword(email: string): boolean {
    if (this.passwordLoginOpen) return true;
    return this.localLoginAllowlist.includes(email.trim().toLowerCase());
  }

  /**
   * Where a TDMP user's role and area come from.
   *  - `local` (default): set in RTB GIS. Admins pre-register expected users
   *    (Settings ▸ Users); anyone else who signs in waits for access. TDMP's
   *    sign-in gives identity only (SSO guide §8).
   *  - `tdmp`: read from `/auth/me/access-scope` and `roles.tdmpRoleNames` at
   *    every sign-in. Only once TDMP accepts sign-in tokens there (§12).
   */
  get accessSource(): 'local' | 'tdmp' {
    return this.str('TDMP_ACCESS_SOURCE').toLowerCase() === 'tdmp'
      ? 'tdmp'
      : 'local';
  }

  /**
   * Role for TDMP users nobody pre-registered. Empty (the default): they
   * wait for an administrator (`local`) or are refused (`tdmp`).
   */
  get defaultRoleName(): string {
    return this.str('TDMP_DEFAULT_ROLE');
  }

  /**
   * A TDMP session lasts at most this long, then the user goes back through
   * TDMP sign-in. TDMP refresh tokens outlive a deactivated account by up to
   * 30 days, so this is how deactivations reach us (SSO guide §9).
   */
  get sessionMaxMs(): number {
    return this.int('TDMP_SESSION_MAX_HOURS', 24, 1) * 3_600_000;
  }

  /** Re-check a TDMP user's account (and profile) at most this often. */
  get recheckMs(): number {
    return this.int('TDMP_RECHECK_MINUTES', 15, 1) * 60_000;
  }

  /**
   * When TDMP cannot be reached, sessions keep working this long after the
   * last successful check, then end.
   */
  get offlineGraceMs(): number {
    return this.int('TDMP_OFFLINE_GRACE_MINUTES', 240, 0) * 60_000;
  }

  // ── Data API ──────────────────────────────────────────────────────────────

  get apiKey(): string {
    return this.str('TDMP_API_KEY');
  }

  /** `authorization` → `Authorization: ApiKey <key>`; `x-api-key` → `X-API-Key: <key>`. */
  get apiKeyHeader(): 'authorization' | 'x-api-key' {
    return this.str('TDMP_API_KEY_HEADER').toLowerCase() === 'x-api-key'
      ? 'x-api-key'
      : 'authorization';
  }

  get syncEnabled(): boolean {
    return (
      !!this.apiKey && this.str('TDMP_SYNC_ENABLED').toLowerCase() !== 'false'
    );
  }

  /** Extra filters for the school list, as a query string. */
  get schoolFilter(): Record<string, string> {
    const raw = this.config.get<string>('TDMP_SCHOOL_FILTER');
    const qs = raw === undefined ? 'categoryGroup=TVET' : raw.trim();
    return Object.fromEntries(new URLSearchParams(qs));
  }

  get timeoutMs(): number {
    return this.int('TDMP_TIMEOUT_MS', 15_000, 1000);
  }

  get syncConcurrency(): number {
    return Math.min(this.int('TDMP_SYNC_CONCURRENCY', 4, 1), 16);
  }

  /** TDMP rejects `limit` above 100 (422). */
  get pageSize(): number {
    return Math.min(this.int('TDMP_PAGE_SIZE', 100, 1), 100);
  }

  /**
   * `authoritativeSource` values that mark TDMP test rows; those schools are
   * skipped. Empty string = keep everything.
   */
  get ignoreSources(): string[] {
    const raw = this.config.get<string>('TDMP_IGNORE_SOURCES');
    return (raw === undefined ? 'access_scope_test,manual_seed' : raw)
      .split(',')
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
  }

  /** School detail calls (year established, GPS) allowed per run. */
  get detailBudget(): number {
    return this.int('TDMP_DETAIL_BUDGET', 60, 0);
  }

  /** A school's detail is re-read once it is older than this. */
  get detailMaxAgeMs(): number {
    return this.int('TDMP_DETAIL_MAX_AGE_DAYS', 7, 1) * 86_400_000;
  }
}
