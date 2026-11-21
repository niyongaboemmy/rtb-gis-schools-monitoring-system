/**
 * Settings for tdmp-sync.e2e-spec.ts. Imported FIRST by that spec: importing
 * AppModule loads `server/.env` into the config, so values set after the
 * imports would lose to a developer's own TDMP settings — and the suite
 * would then call the real TDMP with the real key.
 */
export const TDMP = 'https://tdmp.e2e.test/api/v1';

process.env.SCOPE_ENFORCEMENT = process.env.SCOPE_ENFORCEMENT ?? 'true';
process.env.TDMP_BASE_URL = TDMP;
process.env.TDMP_ISSUER = TDMP;
process.env.TDMP_API_KEY = 'fortress_sk_e2e_fake';
process.env.TDMP_API_KEY_HEADER = 'authorization';
process.env.TDMP_SYNC_ENABLED = 'true';
process.env.TDMP_SCHOOL_FILTER = 'categoryGroup=TVET';
process.env.AUTH_MODE = 'local';
