/**
 * Settings for tdmp-sso.e2e-spec.ts. Imported FIRST by that spec: importing
 * AppModule loads `server/.env` into the config, so anything set after the
 * imports would lose to a developer's own TDMP values there.
 */
export const TDMP = 'https://tdmp-sso.e2e.test/api/v1';
export const APP = 'https://app.e2e.test';
export const CLIENT_ID = 'rtb-gis-e2e';
export const CLIENT_SECRET = 'e2e-client-secret';

process.env.SCOPE_ENFORCEMENT = process.env.SCOPE_ENFORCEMENT ?? 'true';
process.env.AUTH_MODE = 'both';
process.env.TDMP_BASE_URL = TDMP;
// Pin the sign-in base too, so a developer's TDMP_OAUTH_BASE_URL (tdmptest)
// in server/.env cannot send these tests elsewhere; the workaround stays off.
process.env.TDMP_OAUTH_BASE_URL = TDMP;
process.env.TDMP_SIGNIN_ORIGIN = '';
process.env.TDMP_ISSUER = TDMP;
process.env.TDMP_OAUTH_CLIENT_ID = CLIENT_ID;
process.env.TDMP_OAUTH_CLIENT_SECRET = CLIENT_SECRET;
// The public path TDMP registers (guide §3); the web app hands it to the API.
process.env.TDMP_OAUTH_REDIRECT_URI = `${APP}/auth/tdmp/callback`;
process.env.TDMP_OAUTH_SILENT = 'false';
process.env.APP_PUBLIC_URL = APP;
process.env.TDMP_ACCESS_SOURCE = 'local';
process.env.TDMP_DEFAULT_ROLE = '';
process.env.TDMP_SESSION_MAX_HOURS = '24';
process.env.TDMP_RECHECK_MINUTES = '15';
process.env.MFA_ENFORCE_PRIVILEGED = 'true';
process.env.COOKIE_SECURE = 'false';
process.env.TDMP_API_KEY = '';
