# TDMP Integration — Implementation Plan

**Status:** Phases 1–1b implemented on `intergration` (2026-11-12); SSO pilot code ready, waiting on TDMP (see §13) · **Owner:** RTB GIS backend · **Builds on:** branch `intergration` (commit `7f97b1df`, "TDMP as source of truth for users and schools")
**Companion document for the TDMP team:** [TDMP_INTEGRATION_REQUESTS.md](TDMP_INTEGRATION_REQUESTS.md)

## 1. Goal and scope

TDMP (`https://tdmp.rtb.gov.rw`) is the parent platform. After this work:

1. **Scheduled sync.** A scheduled job keeps RTB GIS school data in line with TDMP. Fields TDMP owns are read-only here.
2. **Single sign-on.** Anyone signed in to TDMP opens RTB GIS without signing in again. Their role and geographic scope come from TDMP.

The data taken from TDMP covers exactly these five areas:

| # | Data area | Information | Priority |
|---|---|---|---|
| A | School profile | Official code and name, type and status, location and administrative codes, year established | P1 |
| B | Enrolment and programmes | Learner totals, programmes offered, learners per programme, available seat capacity | P1 |
| C | Staffing summaries | Teacher counts by gender; broader staff totals where available | P1/P2 |
| D | User identity and access | Verified identity, role, account status, authorised geographic or school scope | P1 |
| E | Future outcome indicators | Assessment pass rates, graduate employment, labour-market demand | P3 (not part of the school condition score) |

Coordinates and all map data stay owned by RTB GIS. TDMP GPS only gives a starting point for a school new to RTB GIS.

## 2. TDMP API, per data area (verified live, 2026-11-12)

The spec is `GET /api/v1/docs/api.json` (OpenAPI 3.1, 262 operations, rendered at `/api/v1/docs`). Every call below was made with our partner key. Auth works as `Authorization: ApiKey <key>` or `X-API-Key: <key>`.

| Area | Endpoint | Our key | What it gives |
|---|---|---|---|
| A | `GET /schools` | ✅ | 679 schools in total, 391 with `categoryGroup=TVET` (376 active). `limit` ≤ **100**. Code, name, TMIS code, category, ownership, `isActive`, location names + ids, `counts`, `tradeNames`. No `updatedAt` on list rows |
| A | `GET /schools/{schoolCode}` | ✅ | Adds `establishmentDate`, `deactivatedDate`, `gpsLat/gpsLong`, `tmisCodes[]`, `currentAcademicYear`, `updatedAt` |
| A | `GET /schools?categoryBand=TSS\|VTC` | ✅ | 228 TSS + 94 VTC. **69 TVET schools are in neither**. The band is a filter only and isn't returned on the row |
| B | `counts.students`, `tradeNames` (on `/schools`) | ✅ | Learner total and programme codes |
| B | `GET /reports/trades/students?schoolId=` | ❌ 403 | Learners per programme with gender split |
| B | `GET /reports/students/summary` | ❌ 403 | Learners by gender, level, trade |
| B | `GET /trades` | ❌ 403 | Programme names |
| B | Seat capacity | — | **Not exposed anywhere in the API** |
| C | `counts.teachers` (on `/schools`) | ✅ | Teacher total |
| C | `GET /reports/teachers/summary` | ❌ 403 | Teachers by gender / category |
| D | `/oauth/.well-known/openid-configuration` | ✅ public | Issuer `https://tdmp.rtb.gov.rw/api/v1`; code + PKCE (S256), `refresh_token`; RS256 id_token. Claims: `sub email email_verified name preferred_username` (**no role, scope or `amr`**) |
| D | `GET /auth/me/access-scope` (user token) | ✅ | `roleNames`, `anchorSchool`, `accessScope.kind` (unrestricted / province / district / school / deny) |
| E | `GET /performance/summary`, `/reports/performance/nesa` | ❌ 403 | NESA pass rates per school / trade |
| E | Graduate employment, labour-market demand | — | **Not in the API** |
| — | `GET /locations/*`, `GET /integrations` | ❌ 403 | Administrative unit lists; TDMP pipeline health |

**Freshness:** TDMP re-materialises schools daily, at about **06:00 Africa/Kigali** (`lastMaterialisedAt` = `…T06:00:34+02:00`).

**Data quality in the live list.** The sync has to tolerate all of these:
- `schoolCategory` contains `"unfetched"` (22 rows) and `null` (21).
- `isActive` is `"unfetched"` for 22 rows and `null` for 14.
- `schoolStatus` mixes case (`PRIVATE`/`Private`, `PUBLIC`/`Public`). It holds **ownership**, not operating status.
- `authoritativeSource` includes `access_scope_test` and `manual_seed`, which look like test rows.
- Every TVET school has a 6-digit SDMS `schoolCode` and a district.

## 3. Field mapping

Once a school is linked (`tdmpSchoolCode` set), the fields below are overwritten by the sync and locked in the UI. Corrections go to TDMP through "Request a change". Fields TDMP sends empty keep their current value.

### A. School profile

| RTB GIS field | TDMP source | Phase |
|---|---|---|
| `code` (join key) | `schoolCode` (SDMS) | 1 |
| `name` | `schoolName` | 1 |
| `type` TSS / VTC / INTEGRATED | membership in the `categoryBand=TSS` / `VTC` sweeps; in neither → keep ours (decision §12.1) | 1 |
| `status` active / inactive | `isActive`. Our `under_renovation` survives while TDMP says ACTIVE | 1 |
| `establishedYear` | year of `establishmentDate` (detail) | 1 |
| `province` … `village` | `location.*Name` (same naming as ours: "Southern Province", "Kigali City") | 1 |
| *new* `provinceId` … `villageId` | `location.*Id` (stable join for scope and filters) | 1 |
| *new* `ownership` | `ownership` (Public / Gov Aided / Private / Others) | 1 |
| `tdmpData.tmisSchoolCode`, `.academicYear` | `tmisSchoolCode`, `currentAcademicYear` | 1 |

### B. Enrolment and programmes

| RTB GIS field | TDMP source | Phase |
|---|---|---|
| `totalStudents` | `counts.students` | 1 |
| `educationPrograms[].code` | `tradeNames[]` | 1 |
| `educationPrograms[].name` | `GET /trades` | 2 (R1) |
| `maleStudents`, `femaleStudents`, `educationPrograms[].totalStudents` | `/reports/trades/students?schoolId=` | 2 (R1) |
| `educationPrograms[].capacity` | per-programme seat capacity (requested, R2). Until then it stays editable in RTB GIS | 2 (R2) |

### C. Staffing summaries

| RTB GIS field | TDMP source | Phase |
|---|---|---|
| `totalTeachers` | `counts.teachers` | 1 |
| `maleTeachers`, `femaleTeachers` | per-school teacher summary (R1) | 2 |
| `adminStaff`, `supportStaff` (+ gender) | per-school staff summary (R1), where TDMP has it | 2 |
| `headTeacher` | head-teacher name on the school record (R3) | 3 |

### D. User identity and access: see §6.

### E. Outcome indicators (P3)

These are stored in a separate `school_outcomes` table (school, academic year, trade, indicator, value, source). They're shown on dashboards and **never fed into the school condition score**.

| Indicator | TDMP source |
|---|---|
| Assessment pass rate per school / trade | `/performance/summary` (R11) |
| Graduate employment, labour-market demand | not in TDMP today (asked in R11) |

## 4. Review of the existing `intergration` work

The structure is right, so we keep it: TDMP module, sync-run log, locked fields, Settings ▸ TDMP tab, OIDC sign-in with PKCE, encrypted TDMP refresh token, periodic re-check, role mapping via `roles.tdmpRoleNames`, break-glass `LOCAL_LOGIN_ALLOWLIST`, migration `1788520000000-TdmpIntegration`.

It was written against the published spec, not the live API. These fixes are needed:

| # | File (on `intergration`) | Problem | Fix |
|---|---|---|---|
| F1 | `tdmp/tdmp-school.mapper.ts` `mapSchoolType` | Looks for "TSS"/"VTC" in `schoolCategory`, but live data is always `"TVET"`, so every new school becomes TSS | Classify from the `categoryBand` sweeps (§5.1); unknown keeps the current value, and new schools get a `typeUnverified` flag |
| F2 | `tdmp-school.mapper.ts` `mapStatus` | `ACTIVE` overwrites our `under_renovation` | Keep `under_renovation` while TDMP says ACTIVE; INACTIVE always wins |
| F3 | `tdmp-school.source.ts` `bundle()`, `tdmp-school.mapper.ts`, `tdmp.types.ts`, client `TdmpSection.tsx` | Fetches and stores data outside the five areas (`/school-infrastructure` → `tdmpData.infrastructure`) | Remove that fetch, the `infrastructureOf` mapper, its type and its UI card. Only areas A–E are read |
| F4 | `tdmp-school.source.ts` `bundle()` | Five or more calls per school, about 2,000 per run, most of them 403 | List-first sync (§5.1): about 8 calls per run. Detail only for new schools and a rolling weekly refresh |
| F5 | `tdmp/tdmp.config.ts` `pageSize` | Caps at 500; TDMP rejects anything above 100 | Cap at 100 |
| F6 | `tdmp/tdmp-sync.service.ts` `@Cron('0 1 * * *')` | Runs at 01:00, five hours before TDMP refreshes, so data is up to 29 h old | Hourly freshness probe + daily 07:15 run (§5.2) |
| F7 | `tdmp-school.mapper.ts` | No normalisation: `unfetched`, mixed-case enums and test rows flow in | `normaliseTdmpSchool()` (§5.4) |
| F8 | `tdmp-sync.service.ts` `apply()` | Emits `school.updated` (which triggers a rescore) on any change | Emit only when a scoring input changed: `status`, `establishedYear`, `totalStudents`, `educationPrograms` |
| F9 | `tdmp-sync.service.ts` `running` flag | In-memory guard; a CLI run or a second instance can overlap | `pg_try_advisory_lock` around a run |
| F10 | `auth/tdmp/tdmp-identity.ts` `placementFromScope` | Reads `accessScope.provinceName/districtName/schoolCode`, which aren't in the published schema. A district officer without an anchor school gets an empty district and is over-scoped | Refuse sign-in when a province/district/school scope arrives without its unit (fail closed) until TDMP adds the fields (R8) |
| F11 | `tdmp-sync.service.ts` missing-school handling | A linked school absent from the filtered list is **set inactive**. With 22 `"unfetched"` categories live, one upstream glitch drops a TVET school out of `categoryGroup=TVET` and removes it from national figures | For each missing code, call `GET /schools/{code}`. Deactivate only if it says `INACTIVE`, or it 404s on **two consecutive** runs; otherwise just flag `missingFromTdmp`. Keep the existing 20% mass-missing abort |

## 5. School sync design

### 5.1 One run (list-first)

```
probe   GET /schools?categoryGroup=TVET&limit=1                → meta.lastMaterialisedAt, total
sweep   GET /schools?categoryGroup=TVET&limit=100&page=1..4    → 391 rows (areas A, B, C totals)
bands   GET /schools?categoryGroup=TVET&categoryBand=TSS …      → 3 pages, codes only
        GET /schools?categoryGroup=TVET&categoryBand=VTC …      → 1 page
detail  GET /schools/{code}   only for: new codes, rows with no establishedYear,
                              or detail older than 7 days (~55/day)
```

For each normalised row:

1. **Match** on `tdmpSchoolCode`, then on `tdmpSchoolId`, then on an unlinked school whose `code` equals `schoolCode`. Anything else is a new school.
2. **Hash.** Compute a SHA-256 of the normalised record and compare it with `tdmpData.hash`. If they're equal, skip the write (most days, nothing is written).
3. **Map** with `mapTdmpSchool()` (§3). Save through `repository.save()` so the audit subscriber records field diffs under the system actor `tdmp-sync`.
4. **New school.** Place it at TDMP GPS when that's inside Rwanda (`locationSource='tdmp'`). Without GPS, create it with no location and list it under "needs location" in Settings ▸ TDMP.
5. **Missing from TDMP.** Handle as in F11; never delete.
6. **Rescore** only when a scoring input changed (F8).

That's about 8 calls a day, plus about 55 detail calls. Each run is written to `tdmp_sync_runs` with created / updated / unchanged / skipped / failed counts and per-code errors.

### 5.2 Scheduling

| Job | When (`Africa/Kigali`) | What |
|---|---|---|
| Freshness probe | every hour | 1 call; full sync when `lastMaterialisedAt` is newer than the last successful run |
| Safety full sync | daily 07:15 | Runs even if the probe saw nothing |
| Phase 2 aggregates (B, C) | weekly, Sunday 08:00 | 1–2 calls per school (enrolment and staffing change per term) |
| Manual | Settings ▸ TDMP ▸ "Sync now", `POST /api/v1/tdmp/sync` | permission `MANAGE_SCHOOLS` |

Configure with `TDMP_SYNC_PROBE_CRON`, `TDMP_SYNC_DAILY_CRON` and `TDMP_SYNC_WEEKLY_CRON`. A single advisory lock keeps runs from overlapping (F9).

### 5.3 Data minimisation

We read school-level **aggregates only**. We don't request `/students` or `/teachers` row access, so no learner or teacher records and no national IDs are stored (Rwanda Law 058/2021).

### 5.4 Normalisation (`normaliseTdmpSchool`)

- Upper-case and trim enums. `unfetched`, `''` and `null` become `null` ("unknown", so the current value is kept).
- Skip rows whose `authoritativeSource` is in `TDMP_IGNORE_SOURCES` (default `access_scope_test,manual_seed`), logged as `skipped`.
- Skip rows without `schoolCode` or `location.districtId`.
- `schoolStatus` → `ownership` (`GOVERNMENT_AIDED` → Gov Aided). Never used as operating status.

### 5.5 Schema changes (new migration, after `1788520000000`)

```sql
ALTER TABLE schools ADD COLUMN "ownership"  varchar(16);
ALTER TABLE schools ADD COLUMN "provinceId" integer, ADD COLUMN "districtId" integer,
                    ADD COLUMN "sectorId"   integer, ADD COLUMN "cellId"     integer,
                    ADD COLUMN "villageId"  integer;
CREATE INDEX "IDX_schools_districtId" ON schools ("districtId");
-- tdmpData jsonb: + hash, detailFetchedAt, typeUnverified; − infrastructure
-- Phase 3: CREATE TABLE school_outcomes (...)   -- area E
```

`locationSource` gains `'tdmp'`, ranked lowest in `school-location.rules.ts`, so a TDMP sync never moves a school whose location RTB GIS has set.

### 5.6 First link in production (one-off)

1. **Dry run:** `POST /tdmp/sync?dryRun=true` writes nothing and returns a match report: matched by code / TDMP-only / GIS-only / name conflicts.
2. RTB and the GIS team review the GIS-only schools. Production may still hold placeholder codes (`TSS-SOU-001` style). Link each with `POST /tdmp/schools/:id/link` (Settings ▸ TDMP ▸ Unlinked), adding name and district suggestions.
3. Run the real sync. Then run `npx ts-node --transpile-only scripts/verify-dashboards.ts` and compare national learner and teacher KPIs before and after. The changes should be explainable.

## 6. Single sign-on design (area D)

TDMP is an OIDC provider, so RTB GIS is a confidential client using authorization code + PKCE. "No second login" works because TDMP already holds the user's session.

```
TDMP portal "Open 3D GIS" ─▶ https://<gis>/api/v1/sso/tdmp?school=<code>
  ─▶ /api/v1/auth/tdmp/start          (state + nonce + PKCE verifier in a signed, httpOnly, 10-min cookie)
  ─▶ TDMP /oauth/authorize?…&prompt=none   (TDMP session exists → straight back; no form)
  ─▶ /api/v1/auth/tdmp/callback?code&state
       1. check state; POST /oauth/token (form-urlencoded, HTTP Basic client auth, code_verifier)
       2. verify id_token: RS256 via JWKS, iss, aud=client_id, exp, nonce
       3. GET /auth/me/access-scope (user bearer) → roleNames + scope
       4. pickRole(roleNames) → our role; placementFromScope() → user.location (fail closed, F10)
       5. upsert user by tdmpUserId (=sub), link by verified email on first login
       6. issue our 15-min access token + rtb_rt refresh cookie; store TDMP refresh token encrypted
  ─▶ redirect to homePathFor(role) or /schools/<id> for the deep-linked school
```

If there's no TDMP session, `prompt=none` returns `login_required`. We then retry once without `prompt`, and TDMP shows its own login page. RTB GIS never shows a password form to TDMP users.

| Concern | Rule |
|---|---|
| Modes | `AUTH_MODE=local` (today) → `both` (pilot, 2 weeks) → `tdmp`. In `tdmp` mode passwords, Google sign-in and self-reset are off except `LOCAL_LOGIN_ALLOWLIST` (2 break-glass admins) |
| Role | `roles.tdmpRoleNames` mapping, edited in Settings ▸ Roles. Unmapped means refused (`TDMP_DEFAULT_ROLE` empty). Draft mapping in the requests doc, R7 |
| Scope | From `/auth/me/access-scope`, matched to our places by **TDMP location ids** (§5.5), names as fallback |
| Account status | Re-check `access-scope` every 15 min on our refresh (`TDMP_RECHECK_MINUTES`). Disabled user or `deny` ends our session. TDMP unreachable means a 4 h grace period (`TDMP_OFFLINE_GRACE_MINUTES`), then the session ends |
| Logout | Ours: revoke the session + `POST /oauth/revoke` on the TDMP refresh token. TDMP-initiated: back-channel logout (R6) |
| MFA | Our TOTP stays mandatory for privileged roles until TDMP sends `amr` (R9) |
| Audit | `auth.sso.login`, `auth.sso.refused` (with reason), `auth.sso.scope_changed`, registered in `common/audit/action-registry.ts` |
| Profile | Name and email are TDMP-owned (read-only); phone and preferences stay ours |

## 7. Configuration

```bash
# server/.env (production values come from the deploy secrets, never the repo)
TDMP_BASE_URL=https://tdmp.rtb.gov.rw/api/v1
TDMP_API_KEY=                       # partner key, rotated after setup (§9)
TDMP_SYNC_ENABLED=true
TDMP_SCHOOL_FILTER=categoryGroup=TVET
TDMP_SYNC_PROBE_CRON=0 * * * *
TDMP_SYNC_DAILY_CRON=15 7 * * *
TDMP_SYNC_WEEKLY_CRON=0 8 * * 0
TDMP_IGNORE_SOURCES=access_scope_test,manual_seed
TDMP_PAGE_SIZE=100
TDMP_TIMEOUT_MS=15000

AUTH_MODE=both                      # local | both | tdmp
TDMP_OAUTH_CLIENT_ID=
TDMP_OAUTH_CLIENT_SECRET=
TDMP_OAUTH_SCOPES=openid email profile
TDMP_OAUTH_REDIRECT_URI=https://rtb.aerovyntech.com/api/v1/auth/tdmp/callback
TDMP_RECHECK_MINUTES=15
TDMP_OFFLINE_GRACE_MINUTES=240
LOCAL_LOGIN_ALLOWLIST=admin@rtb.gov.rw
TDMP_DEFAULT_ROLE=
```

`env.validation.ts`: in production, boot refuses `AUTH_MODE=tdmp` without the client id and secret, and refuses `TDMP_SYNC_ENABLED=true` without `TDMP_API_KEY`. Add both to the deploy pre-flight list (`.github/workflows/deploy.yml`).

## 8. Delivery plan

| Phase | Work | Areas | Depends on | Estimate |
|---|---|---|---|---|
| **0. Secrets** | Key in the prod `.env` / GitHub secret; delete `docs/TDMP_API_KEY.md`; ask TDMP to rotate (R12) | — | — | 0.5 d |
| **1. Sync** | Rebase `intergration` on `main`. Fixes F1–F9 and F11, list-first run, normalisation, migration §5.5, dry-run report, schedules | A, B/C totals | — | 3 d |
| **1b. First link** | Dry run on prod data, review unmatched with RTB, link, enable schedules, verify dashboards | A | Phase 1 | 1–2 d |
| **2. SSO pilot** | F10, `prompt=none` retry, audit actions, role mapping; `AUTH_MODE=both` on prod | D | TDMP: R6, R7, R8 | 2 d + TDMP turnaround |
| **3. SSO only** | `AUTH_MODE=tdmp` after 2 clean weeks; break-glass accounts tested | D | Phase 2 | 0.5 d |
| **4. Aggregates** | Gender splits, learners per programme, programme names, seat capacity, staff summary; weekly job | B, C | TDMP: R1, R2 | 2 d |
| **5. Outcomes** | `school_outcomes` table, pass rates on dashboards | E | TDMP: R11 | 2 d |

Phases 0–1b need nothing from TDMP; the current key covers them.

## 9. Security

- **The partner key has been exposed.** It was pasted into chat and sits in plain text in the untracked `docs/TDMP_API_KEY.md`. Never commit that file; delete it once the key is in the server `.env` / deploy secrets. Ask TDMP to rotate the key and use separate dev/staging and prod keys.
- The key is server-side only. It's redacted from logs and from `tdmp_sync_runs.errors`.
- The SSO callback validates `state`, `nonce`, `iss`, `aud`, signature and expiry. Redirects are restricted to our own origin (no open redirect via `?school=` or `returnTo`).
- TDMP refresh tokens are encrypted at rest (`external_refresh_token_enc`).
- Scope fails closed: unknown `kind`, `deny`, or a missing unit refuses sign-in.

## 10. Testing

| Level | What |
|---|---|
| Unit | Mapper and normaliser against **real captured `/schools` rows** as fixtures (no personal data): `unfetched`, mixed case, test sources, missing GPS, band membership, `under_renovation` kept. `placementFromScope` for each kind and fail-closed cases |
| Integration | `TdmpSyncService` with a stubbed `TdmpApiClient`: hash skip, missing-school confirmation (F11), mass-missing abort, advisory lock, rescore only on scoring inputs |
| E2E | `test/tdmp-sso.e2e-spec.ts` with a local fake OIDC provider (JWKS + token + access-scope): login, refused role, deny scope, refresh re-check, logout revoke. Permission matrix still green with `AUTH_MODE=both` |
| Live smoke (manual) | `scripts/tdmp-smoke.ts`: probe, one page and one detail with the configured key; prints counts only |
| Prod verification | `verify-dashboards.ts` before and after the first link; Settings ▸ TDMP run log; audit trail shows `tdmp-sync` diffs |

## 11. Monitoring and rollback

- Settings ▸ TDMP shows the last run, its counts and errors, the TDMP `lastMaterialisedAt`, and the unmatched / needs-location lists.
- If the last successful sync is more than 36 h old, admins see a banner and a "From TDMP" stale badge appears on school pages.
- A failed scheduled run creates an audit row with `outcome=failure` and an admin notification.
- **Rollback:** `TDMP_SYNC_ENABLED=false` stops syncing (links and data stay). `AUTH_MODE=local` restores password login. Both are env-only, with no migration rollback.

## 12. Open decisions (RTB)

1. Should the 69 TVET schools that are in neither the TSS nor the VTC band be shown as **INTEGRATED**, or kept as they are until TDMP classifies them?
2. Should TDMP-only schools (no RTB GIS location yet) appear on the national map at TDMP GPS with a distinct style, or stay hidden until located?
3. Which production domain will TDMP register as the redirect URI: `rtb.aerovyntech.com` now, a `*.rtb.gov.rw` name later, or both?

## 13. Implementation status (2026-11-12)

| Item | State | Where |
|---|---|---|
| F1 type from `categoryBand` sweeps | Done | `tdmp-school.mapper.ts` `mapSchoolType`, `tdmp-school.source.ts` `bands()` |
| F2 `under_renovation` kept | Done | `mapStatus` |
| F3 no infrastructure / staff import | Done | mapper, source, types, `TdmpSection.tsx`; migration strips old `tdmpData` keys; `/schools/:id/staff` removed (data minimisation) |
| F4 list-first run | Done | ~8 list calls per run; detail only for new / first-link / stale (`TDMP_DETAIL_BUDGET`, `TDMP_DETAIL_MAX_AGE_DAYS`) |
| F5 page size ≤ 100 | Done | `TdmpConfig.pageSize` |
| F6 schedule | Done, **admin-editable** | `tdmp_settings` row + 5-min tick (probe interval 15 min–6 h, daily time); not env crons |
| F7 normalisation | Done | `tdmp-school.normalise.ts` (`TDMP_IGNORE_SOURCES`) |
| F8 rescore only on scoring inputs | Done | `touchesScoring` |
| F9 advisory lock | Done | `pg_try_advisory_lock` held for the whole run |
| F10 fail-closed scope | Done | `placementFromScope` |
| F11 missing-school confirmation | Done | detail lookup; inactive only on TDMP `INACTIVE` or 2 consecutive 404s |
| §5.5 schema | Done | migration `1788530000000-TdmpSyncV2` (verified up/down/up; entities = migrated schema) |
| §5.6 dry run + report | Done | `POST /tdmp/sync {dryRun:true}`, report on the run row, GIS-only name suggestions |
| Admin page | Done | `/integrations/tdmp`: sync now, dry run, live progress, auto-sync on/off + interval + daily time, connection test, request tracker (R1–R12), unlinked schools with suggestions, run history + reports |
| Schools TDMP has no GPS for | Done | admin adds each with coordinates (`POST /tdmp/schools/import`, location `manual`) |
| Directory | Done | Ownership and Source filters, TDMP badge, TMIS-code search, ownership/TDMP code in exports |
| Guided admin page | Done | setup checklist from live state, interactive "How it works", in-place help hints |
| `prompt=none` | Code ready, **off** | `TDMP_OAUTH_SILENT=false` until TDMP confirms (R6) |
| Phase 2 SSO pilot | Waiting | needs R6 (OAuth client), R7 (roles), R8 (scope fields) |
| Phase 4 aggregates | Waiting | needs R1, R2; the admin page shows when TDMP grants them |
| Phase 5 outcomes | Waiting | needs R11 |

Deviations from the plan:
- `educationPrograms` is not filled from `tradeNames` yet: codes alone have no names, learners or capacity, and empty programme rows would change how enrolment and capacity are computed (`school-metrics.helpers.ts`). Trade codes are kept in `tdmpData.trades` until R1.
- Gender splits and the head teacher are **not locked** on linked schools: TDMP doesn't send them yet, so locking would freeze them.
- New TDMP schools without usable GPS are reported under "Need a location first" instead of being created (latitude / longitude are required columns).
- Boot does not refuse `TDMP_SYNC_ENABLED=true` without a key (the example env enables it by default; production would fail to boot). Without a key the sync is simply off and the admin page says so.

Verified: 666 server unit tests, 61 e2e tests (incl. permission matrix and `test/tdmp-sync.e2e-spec.ts`), 268 client tests, client build + bundle budget, live smoke and a live dry run against TDMP (391 read, 0 failed, nothing written).

## 14. What RTB GIS provides to TDMP (partner API and embedded views)

TDMP also takes data from us. Built 2026-11-12 (`server/src/modules/partner/`); guide for TDMP's developers at `/developers`.

| Piece | Design |
|---|---|
| Partner keys | `partner_api_keys` (migration `1788540000000-PartnerApi`): SHA-256 of `rtbgis_pk_…`, scopes (`coordinates:read`, `schools:read`, `embed:create`), allowed origins, created / last used / revoked. Created on the TDMP page ▸ Shared with TDMP (`MANAGE_SCHOOLS`, national). Key shown once |
| Partner API | `GET /partner/ping`, `/partner/schools/coordinates` (JSON / GeoJSON, `updatedSince`), `/partner/schools`, `/partner/schools/{code}` (with boundary), `POST /partner/embed-links`. `PartnerApiKeyGuard`: `Authorization: ApiKey …` or `X-API-Key`. 120 req/min |
| Coordinates | Read-only by design: RTB GIS owns location. Each point carries `source` and `quality` (surveyed / manual / tdmp / unverified); TDMP updates its GPS from surveyed / manual points (guide §Coordinates) |
| Embed links | Short-lived JWT (derived key `rtb-gis/embed-link/v1`, 60–3600 s) for one view and scope; token in the URL **fragment** |
| Embed sessions | `POST /embed/session` exchanges the link for an access token of the key's own **partner account** (`authSource='partner'`, role `partner_viewer` = viewer's reads, no CREATE_REPORT) with an `emb` claim. `JwtStrategy` and the socket gateway replace the account's location with the link's scope (existing `location.tier` narrowing) and refuse every non-GET. A partner account without `emb` is refused; it can never sign in |
| Revocation | Revoking a key deactivates its partner account: open embed sessions fail on their next request |
| Access level | Per key (`partner-access.ts`, migration `1788550000000-PartnerKeyAccess`): national / province / district / list of schools + allowed views. Data endpoints filter by it (outside → 404); embed links must fit inside it (national map clamped; wider → 403 `PARTNER_ACCESS_DENIED`); a link is re-checked against the key's current access when exchanged. Changing a key's access moves it to a fresh partner account, ending open views |
| Client | `/embed/schools/:id/{dashboard,map-2d,map-3d}`, `/embed/map` (no app chrome) behind `EmbedGate`. Link mode keeps auth in memory only (never the shared localStorage of an RTB GIS tab), never tries the refresh cookie or `/login`, and shows "expired" instead. Opened without a link, the pages use the normal session and role |
| Framing | nginx sets `frame-ancestors` from the ORIGINAL URI (the SPA fallback rewrites to /index.html): `/embed/*` → `'self'` + TDMP origins; everything else → `'self'` + `X-Frame-Options: SAMEORIGIN`. **Apply by hand** on the server (certbot owns the live file) |
| Tracking | Requests R14 (coordinates used), R15 (first embed session, from the audit trail), R16 (origins) on the TDMP page |

Tests: `partner-embed.spec.ts`, `test/partner-api.e2e-spec.ts` (keys, scopes, feed, embed scope / read-only / revoke), client `Embed.test.tsx`, `embed.test.ts`, `Developers.test.tsx`, `partner-ui.test.tsx`.
