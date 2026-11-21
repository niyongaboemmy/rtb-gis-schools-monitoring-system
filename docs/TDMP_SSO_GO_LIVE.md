# "Sign in with TDMP": go-live runbook

**For:** the RTB GIS team member who switches single sign-on on. **Design:** [TDMP_INTEGRATION_PLAN.md](TDMP_INTEGRATION_PLAN.md) §6. **TDMP's guide:** "Sign in with TDMP: integration guide" (TDMP technical team, 12 Nov 2026).

Everything on the RTB GIS side is built and tested. What's left is TDMP's registration, then the four stages below. Each stage can be undone by changing one setting (see [Rollback](#rollback)).

## Stage 0: Ask TDMP to register RTB 3D GIS

Send the TDMP team the registration (request R6 in [TDMP_INTEGRATION_REQUESTS.md](TDMP_INTEGRATION_REQUESTS.md)):

| Item | Value |
|---|---|
| System name | RTB 3D GIS |
| Server or browser only | Has a server |
| Redirect URI (production) | `https://rtb.aerovyntech.com/api/v1/auth/tdmp/callback` |
| Launch URL | `https://rtb.aerovyntech.com/sso/tdmp` |
| Redirect URI (test registration) | `http://localhost:5173/api/v1/auth/tdmp/callback` |
| Technical contact | name and email |

Also ask for one test account per access level (national, province, district, school, none).

If the app moves to an `rtb.gov.rw` address, register that redirect URI too and set `APP_PUBLIC_URL` / `TDMP_OAUTH_REDIRECT_URI` to match. TDMP compares redirect URIs character by character.

TDMP shows the client secret once. Put it straight into the server settings and the team password vault; never in chat, email or git.

## Stage 1: Test registration, on a developer machine

1. In `server/.env` (never committed), add TDMP's **test** values. `TDMP_BASE_URL` and `TDMP_ISSUER` are TDMP's test-environment addresses if they differ from production:

   ```bash
   AUTH_MODE=both
   TDMP_BASE_URL=<TDMP test environment>/api/v1
   TDMP_OAUTH_CLIENT_ID=<test client id>
   TDMP_OAUTH_CLIENT_SECRET=<test client secret>
   TDMP_OAUTH_REDIRECT_URI=http://localhost:5173/api/v1/auth/tdmp/callback
   TDMP_ACCESS_SOURCE=local
   TDMP_SESSION_MAX_HOURS=24
   ```

2. Restart the server. It refuses to start if `AUTH_MODE=both` has no client ID / secret.
3. **TDMP admin page** (`/integrations/tdmp`) ▸ setup step **"Sign in with TDMP"** ▸ *Check again*. It must say done. It checks that TDMP accepts the client ID and secret, publishes its signing keys and has the expected issuer. If it says TDMP refuses the client, the ID or secret is wrong.
4. As an admin, **Settings ▸ Users ▸ Add expected TDMP user** for the national, district and school test accounts, with the matching role and area. Leave the "none" account out.
5. Go through the checks below with each test account, in a private browser window.

| # | Check | Expected |
|---|---|---|
| 1 | Open `http://localhost:5173/login` ▸ *Sign in with TDMP* | TDMP sign-in page, then back in RTB GIS |
| 2 | Pre-registered national user | Their role, sees every school |
| 3 | Pre-registered district user | Only that district's schools |
| 4 | Pre-registered school user | Only that school |
| 5 | The account nobody pre-registered | "Your account is waiting for access"; listed under Settings ▸ Users ▸ Waiting for access |
| 6 | Admin ▸ *Give access* to that account ▸ user presses *Check again* | They're in, with the role given |
| 7 | Pre-registered admin-type user | TDMP sign-in, then RTB GIS asks to set up 2FA |
| 8 | Sign out, then *Sign in with TDMP* again | Back in without typing a password (TDMP still knows them) |
| 9 | Settings ▸ Audit Trail | `auth.tdmp_login`, `auth.tdmp_access_requested`, `user.access_granted` rows |
| 10 | Cancel on the TDMP sign-in page | Back on our login page: "Sign-in was cancelled in TDMP…" |

## Stage 2: Production pilot (`AUTH_MODE=both`)

Passwords keep working; "Sign in with TDMP" appears next to them.

1. On the production server, edit `/var/lib/rtb/env/server.env` (the deploy script loads it and runs the same settings check as server start before anything changes; a mistake stops the deploy):

   ```bash
   AUTH_MODE=both
   TDMP_OAUTH_CLIENT_ID=<production client id>
   TDMP_OAUTH_CLIENT_SECRET=<production client secret>
   TDMP_OAUTH_REDIRECT_URI=https://rtb.aerovyntech.com/api/v1/auth/tdmp/callback
   TDMP_ACCESS_SOURCE=local
   TDMP_SESSION_MAX_HOURS=24
   TDMP_RECHECK_MINUTES=15
   TDMP_OFFLINE_GRACE_MINUTES=240
   LOCAL_LOGIN_ALLOWLIST=<two break-glass admin emails>
   ```

2. Deploy (or reload the API). The deploy runs migration `1788560000000-TdmpLocalAccess`.
3. TDMP admin page ▸ **"Sign in with TDMP"** step ▸ *Check again* → done.
4. Pre-register the pilot users (Settings ▸ Users ▸ Add expected TDMP user). Anyone else who signs in waits for access.
5. Ask TDMP to add the RTB 3D GIS tile (launch URL) to the TDMP sign-in page, and open it from there once.
6. Run the pilot for about two weeks. Each day: Settings ▸ Users ▸ *Waiting for access*, and Audit Trail filtered on `auth.tdmp_login_failed`.

TDMP's go-live checklist (guide §11.1), and where it stands:

| TDMP checklist item | RTB GIS |
|---|---|
| Registered; redirect URI matches exactly | Stage 0 + admin page check |
| Secret and API key in server settings on every server, and in the vault | `/var/lib/rtb/env/server.env` |
| Website built with the TDMP address, client ID and redirect URI | Server settings only; the web app needs no TDMP values |
| state, nonce and PKCE checks on every sign-in | Built in, covered by `server/test/tdmp-sso.e2e-spec.ts` |
| Refresh tokens replaced after every use | Built in (newest token saved first), same test |
| Sign-in tested end to end after the latest release | Stage 1 checks 1–8 after each release that touches sign-in |
| Launch URL tested from the TDMP sign-in page | Stage 2 step 5 |

## Stage 3: TDMP only (`AUTH_MODE=tdmp`)

After two clean weeks:

1. Test both break-glass accounts: they can still sign in with a password when `AUTH_MODE=tdmp`.
2. In `/var/lib/rtb/env/server.env`, set `AUTH_MODE=tdmp` and redeploy.
3. Password sign-in (except the break-glass list), Google sign-in, forgot-password and "Add user" turn off. Existing accounts are matched to TDMP by verified email at their first TDMP sign-in and keep their role, area, reports and history.
4. Tell users: "Sign in with your TDMP account."

## Later, when TDMP agrees the open points (guide §12)

| When TDMP provides | Change |
|---|---|
| Role and area at sign-in (R7, R8) | Map TDMP roles in Settings ▸ Roles ▸ "TDMP roles"; set `TDMP_ACCESS_SOURCE=tdmp` |
| A deactivation signal (R17) | Can lengthen `TDMP_SESSION_MAX_HOURS` |
| `amr` (R9) | Our 2FA after TDMP sign-in can be dropped for users TDMP already verified |
| School code from the launcher (R18) | Nothing: `/sso/tdmp?school=<code>` already opens that school |

## Rollback

| Problem | Do |
|---|---|
| TDMP sign-in misbehaves | `AUTH_MODE=local`: password sign-in only. TDMP users then need a password reset by an admin, or wait for the fix |
| TDMP is down (users stuck in TDMP mode) | Break-glass admins sign in with their password. Signed-in TDMP users keep working for `TDMP_OFFLINE_GRACE_MINUTES` (4 h) |
| A secret leaked | Ask TDMP for a new registration; replace it in `/var/lib/rtb/env/server.env`; redeploy |

## Problems and causes (TDMP guide §11.2, for our setup)

| What you see | Likely cause | Do |
|---|---|---|
| Admin page: "TDMP refuses the client ID or secret" | Wrong ID / secret on the server | Correct `/var/lib/rtb/env/server.env`, redeploy |
| Admin page: "issuer differs" | TDMP's test environment has another issuer | Set `TDMP_ISSUER` to the issuer in TDMP's settings document |
| TDMP says "Invalid redirect_uri" | Our address differs from the registered one | Make `TDMP_OAUTH_REDIRECT_URI` match exactly, or register the new one with TDMP |
| Login page: "Signing in with TDMP didn't finish" | ID token not accepted (signature, issuer, client ID or nonce), or an unexpected answer | Audit Trail ▸ `auth.tdmp_login_failed` shows the reason; server log line `TDMP sign-in failed: …` |
| Login page: "Your sign-in link expired or was opened in another browser" | The callback reached a different site, or more than 10 minutes passed | Start and finish on the same address (`APP_PUBLIC_URL`) |
| Login page: "TDMP can't be reached right now" | TDMP down, or TDMP sign-in not configured on our server | Admin page connection check |
| Users signed out every ~15 minutes | TDMP refuses our refresh tokens | Check the Audit Trail for `auth.tdmp_session_ended` and its reason |
