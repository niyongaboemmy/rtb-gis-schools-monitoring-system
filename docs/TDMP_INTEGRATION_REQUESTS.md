# RTB 3D GIS ↔ TDMP: Integration Requests

**From:** RTB 3D GIS backend team · **To:** TDMP technical team · **First sent:** 2026-11-12 · **Updated:** 2026-11-12 (after go-live)
**Context:** RTB 3D GIS uses TDMP as the source of truth for school profile, enrolment, staffing and (soon) user sign-in. The school sync has been **live in production since 2026-11-12**. This document gives the status and lists what we still need from you.

The integration is **read-only** towards TDMP. We never write to TDMP.

## Status at a glance

| # | Request | Priority | Status |
|---|---|---|---|
| R1 | Read access to aggregate reports (learners, staff, programmes, units) | P2 | ⏳ Waiting: all 5 endpoints return 403 |
| R2 | Seat capacity per programme | P1 | ⏳ Waiting: not in the API |
| R3 | Extra fields on `/schools` list rows | P2 | ⏳ Waiting |
| R4 | Data quality on `/schools` | P2 | ⏳ Waiting: details below, now with one possible duplicate |
| R5 | Change feed (`updatedSince` / webhook) | P3 | Optional: our freshness check covers it |
| R6 | OAuth client for RTB 3D GIS | P1 | ⏳ Waiting: blocks single sign-on |
| R7 | Role catalogue | P1 | ⏳ Waiting: blocks single sign-on |
| R8 | Province / district / school in the access scope | P1 | ⏳ Waiting: blocks single sign-on for area-level users |
| R9 | `amr` claim | P3 | ⏳ Waiting |
| R10 | Staging and test accounts | P2 | ⏳ Waiting |
| R11 | Outcome data | P3 | ⏳ Waiting |
| R12 | Rotate the API key; separate keys per environment | P1 | ⏳ Waiting: production key now installed, please rotate |
| **R13** | **GPS for 16 TVET schools** | **P2** | **New** |

Our admin page re-checks these automatically: when you grant an endpoint, it appears as met on our side without any change from us.

## Data we take from TDMP

| Data area | Information needed | Priority / purpose |
|---|---|---|
| School profile | Official school code and name, school type and status, location and administrative codes, year established | P1: identify schools consistently and support geographic analysis |
| Enrolment and programmes | Learner totals, programmes offered, learners per programme, available seat capacity | P1: understand programme utilisation and capacity |
| Staffing summaries | Teacher counts by gender; broader staff totals where available | P1/P2: support staffing and learner-to-teacher indicators |
| User identity and access | Verified user identity, role, account status and authorised geographic or school scope, for single sign-on | P1: enable secure access through TDMP identity services |
| Future outcome indicators | Assessment pass rates, graduate employment and labour-market demand, where available | P3: possible future dashboards; not part of the current school-condition score |

## What is live (production, 2026-11-12)

| Data area | From | In RTB GIS today |
|---|---|---|
| School profile | `GET /schools`, `GET /schools/{schoolCode}`, `categoryBand=TSS\|VTC` filter | ✅ 375 TVET schools synced: code, name, type, status, location names and ids, ownership, year established |
| Enrolment / staffing totals | `counts.students`, `counts.teachers`, `tradeNames` | ✅ Learner and teacher totals, programme codes |
| Sync | Your daily refresh (we observe ~06:00 Kigali) | ✅ Automatic: a freshness check at an interval we set (15 min–6 h) plus a full run daily at 07:15; unchanged schools are skipped |
| User identity | OIDC discovery, JWKS, code + PKCE, refresh tokens, `/auth/me/access-scope` | ✅ Built on our side; waiting on R6–R8 to switch on |

First sync: 391 schools read, 373 added, 2 matched to existing RTB GIS schools, 16 without GPS (R13), 0 failures, in 32 seconds. The next scheduled run found all schools unchanged and rewrote nothing.

Thank you. This covers the school profile in full.

## Requests

Priority: **P1** blocks a phase we are about to start · **P2** needed for complete data · **P3** future.

### Enrolment, programmes and staffing

#### R1 (P2): Grant our partner key read access to these aggregate reports

Our key's service account (`accessScope: unrestricted, source: service_account`) gets **403 Insufficient permissions** on endpoints the docs list for `external_api_consumer`. We only need **school-level aggregates**:

| Endpoint | Used for | Today |
|---|---|---|
| `GET /reports/trades/students?schoolId=` | Learners per programme, with gender split | 403 |
| `GET /reports/students/summary` with a per-school filter | Male / female learner totals per school | 403 |
| `GET /reports/teachers/summary` with a per-school filter | Teachers by gender; admin and support staff totals | 403 |
| `GET /trades` | Programme names for the codes in `tradeNames` | 403 |
| `GET /locations/provinces … /villages` | Administrative unit names and codes | 403 |

We do **not** need `/students` or `/teachers` (no learner or teacher records). If the teacher report cannot filter by school, a small per-school summary would do instead:
`GET /schools/{code}/staff-summary` → `{ teachers: {male, female}, admin: {male, female}, support: {male, female} }`.

Until R1 is granted, learner and teacher gender splits and programme names stay editable in RTB GIS.

#### R2 (P1): Available seat capacity per programme

We could not find seat capacity anywhere in the API. Does TDMP (or SDMS) hold the **approved seats per programme per school** for the current academic year? If so, please expose it, for example as `capacity` on each row of `/reports/trades/students`, or as `GET /schools/{code}/programmes` → `[{ tradeCode, tradeName, level, learners, capacity, academicYear }]`.

### School profile

#### R3 (P2): Add a few fields to the `/schools` list rows

To avoid one detail call per school:

| Field | Why |
|---|---|
| `categoryBand` (TSS / VTC / …) | Today it is only a filter. **64 of the 375 schools we sync** are in neither TSS nor VTC; please tell us what they are (integrated? short courses?). Until then they keep the type set in RTB GIS |
| `establishmentDate` | Year established, without a detail call |
| `updatedAt` | Change detection |
| `headTeacherName` (optional) | School contact card |

#### R4 (P2): Data quality on `/schools`

Values in the live list that we treat as "unknown":

| Field | Values | Rows |
|---|---|---|
| `schoolCategory` | `"unfetched"` / `null` | 22 / 21 |
| `isActive` | `"unfetched"` / `null` | 22 / 14 |
| `schoolStatus` | mixed case: `PRIVATE` and `Private`, `PUBLIC` and `Public` | 7 |
| `authoritativeSource` | `access_scope_test`, `manual_seed` (test rows?) | 4 |

**Possible duplicate:** "KIGALI EXCELLENT TOURISM AND HOSPITALITY ACADEMY" appears as **130613** (Kicukiro, no GPS) and as **120940** (Gasabo). Is this one school or two?

Can these be cleaned up, or test rows excluded from the partner view? Please also confirm:
1. The SDMS `schoolCode` is **stable and unique** per school and is never re-used.
2. `isActive = INACTIVE` means the school is closed. 14 schools we sync are INACTIVE and are left out of our national statistics.

#### R13 (P2, new): GPS for 16 TVET schools

TDMP has no GPS point inside Rwanda for these schools, so they are not yet on our national map. Our administrators can place them by hand, but correct coordinates at the source would help every system using TDMP:

| Code | School | District |
|---|---|---|
| 570212 | Mwananshuti VTC | Bugesera |
| 571216 | RCS Bugesera VTC | Bugesera |
| 570615 | VTC-Gitagata rehabilitation center | Bugesera |
| 310517 | Mubuga TSS | Karongi |
| 130925 | Belasi saloon | Kicukiro |
| 130613 | Kigali Excellent Tourism and Hospitality Academy (KETHA) | Kicukiro |
| 130236 | New life women vocation Center | Kicukiro |
| 551117 | Bukora TSS | Kirehe |
| 550614 | Giriteka TVET School / Mahama | Kirehe |
| 550110 | St Anastase Gahara TVET School | Kirehe |
| 250324 | RCS Nyamagabe Vocational Training Center | Nyamagabe |
| 250411 | VTC-Nyamagabe rehabilitation center | Nyamagabe |
| 110517 | RCS Mageragere TVET School | Nyarugenge |
| 320119 | Iwawa Rehabilitation and training center | Rutsiro |
| 320613 | YEGO Center Rutsiro | Rutsiro |
| 510201 | APPEGA Gahengeri TVET School | Rwamagana |

Where TDMP does have GPS it is accurate. For example, FR Ramon Kabuga TSS (280705) is within 0.7 km of its drone-surveyed buildings.

#### R5 (P3): Change feed

Optional, since volume is small: an `updatedSince=<ISO>` filter on `/schools`, or a webhook on re-materialisation. Please also confirm the daily materialisation time (we observe about 06:00 Kigali) so our daily run stays right after it.

### User identity and access (single sign-on)

Everything on our side is built and tested. Single sign-on goes live as soon as R6, R7 and R8 are in place.

#### R6 (P1): Register an OAuth client for RTB 3D GIS

Please create a confidential client (`POST /oauth/clients`) and send the `clientId` / `clientSecret` over a secure channel:

```json
{
  "name": "RTB 3D GIS",
  "redirectUris": [
    "https://rtb.aerovyntech.com/api/v1/auth/tdmp/callback",
    "http://localhost:5173/api/v1/auth/tdmp/callback"
  ],
  "grantTypes": ["authorization_code", "refresh_token"]
}
```

We will send any later production domain (e.g. under `rtb.gov.rw`) as an addition. A separate client for localhost/staging is fine.

Please also confirm or enable the following:
1. **First-party / trusted client**: the consent screen (`/oauth/flows/{id}/approve`) is skipped for RTB 3D GIS.
2. **`prompt=none`**: `/oauth/authorize` returns straight away with a code when the user already has a TDMP session, or with `error=login_required` when they don't. Our side supports it and switches it on once you confirm.
3. Token lifetimes, and whether refresh tokens rotate.
4. An **end-session endpoint** and **back-channel logout** (or a webhook) when a user signs out or is disabled. Until then we re-check `/auth/me/access-scope` every 15 minutes.

#### R7 (P1): Role catalogue and mapping

Please send the TDMP role names that should open RTB 3D GIS (e.g. from `GET /iam/roles`). Our draft mapping:

| TDMP role (to confirm) | RTB 3D GIS role | Sees |
|---|---|---|
| RTB HQ administrator | `admin` | National |
| RTB planner / M&E officer | `viewer` or `gis_analyst` | National |
| District education officer | `district_officer` | Own district |
| School manager / head teacher | `school_leader` | Own school |
| Any other role | no access | — |

#### R8 (P1): Complete the `GET /auth/me/access-scope` response

The published schema has `accessScope: { kind }` plus `anchorSchool`. For province- and district-scoped users without an anchor school we cannot tell *which* unit they cover, so we refuse them rather than over-grant access. Please add:

```json
"accessScope": {
  "kind": "district",
  "provinceId": 2, "provinceName": "Southern Province",
  "districtId": 14, "districtName": "Muhanga",
  "schoolCode": null
}
```

Ideally, also send role names and scope as **id_token claims** (`roles`, `access_scope`).

#### R9 (P3): `amr` claim

If TDMP performed multi-factor authentication, include `amr` (e.g. `["pwd","otp"]`) in the id_token so we don't ask for a second factor twice.

#### R10 (P2): Staging and test accounts

A staging TDMP (or test tenant) with one test user per role in R7.

### Future outcome indicators

#### R11 (P3): Outcome data

| Indicator | What we found | Request |
|---|---|---|
| Assessment pass rates per school / trade | `GET /performance/summary`, `/reports/performance/nesa` (403 for our key) | Read access when we start this phase |
| Graduate employment | Not in the API | Is tracer-study data planned? |
| Labour-market demand by trade and district | Not in the API | Is it planned, and from which source? |

### Access key

#### R12 (P1): Key handling

1. Our production key was shared in plain text and is now installed on our server. Please **rotate it** and deliver the new key over a secure channel.
2. Please issue **separate keys** for development/staging and production.
3. Are there **rate limits**? Our load today: one small freshness request at the interval our administrators choose (currently every 6 hours; never more than every 15 minutes), plus about 10 requests per daily full run. Once R1 is granted, a weekly run adds 1–2 requests per school.

## What we do on our side

- Sync on a schedule (freshness check, daily full run) and log every run, with a report, in our audit trail.
- Show TDMP-sourced fields as read-only and send corrections back through a "Request a change" process.
- Keep the partner key on our server only. It never goes to browsers.
- Store only school-level aggregates and the signed-in user's identity claims (Law 058/2021).

## Contact

RTB 3D GIS backend team: deliverystudio@nga.ac.rw
