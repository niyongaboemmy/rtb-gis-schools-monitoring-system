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

  /** Public URL of the web app (where the browser is sent after sign-in). */
  get appPublicUrl(): string {
    const explicit = this.str('APP_PUBLIC_URL');
    const first = this.str('APP_CORS_ORIGINS').split(',')[0]?.trim() ?? '';
    return (explicit || first || 'http://localhost:5173').replace(/\/+$/, '');
  }

  /** Must match a redirect URI registered with the TDMP OAuth client. */
  get redirectUri(): string {
    return (
      this.str('TDMP_OAUTH_REDIRECT_URI') ||
      `${this.appPublicUrl}/api/v1/auth/tdmp/callback`
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
   * Our role for TDMP users whose TDMP roles match no mapping. Empty (the
   * default) refuses them.
   */
  get defaultRoleName(): string {
    return this.str('TDMP_DEFAULT_ROLE');
  }

  /** Re-check a TDMP user's account and scope at most this often. */
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

  get pageSize(): number {
    return Math.min(this.int('TDMP_PAGE_SIZE', 100, 1), 500);
  }
}
