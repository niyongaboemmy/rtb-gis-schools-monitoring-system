# RTB 3D GIS ↔ TDMP: Integration Requests

**From:** RTB 3D GIS backend team · **To:** TDMP technical team · **First sent:** 2026-11-12 · **Updated:** 2026-11-12 (after go-live)
**Context:** RTB 3D GIS monitors TVET school infrastructure. It uses TDMP as the source of truth for school profile, enrolment, teacher totals and (soon) user sign-in. The school sync has been **live in production since 2026-11-12**. The exchange now goes both ways: RTB 3D GIS also **provides** TDMP with embeddable dashboards and maps (see "What RTB GIS provides to TDMP"). This document gives the status and lists what we still need from you.

Both directions are **read-only**: we never write to TDMP, and TDMP's key cannot change RTB GIS data.

**We only ask for data that plans school infrastructure:** how many learners each site serves, in which programmes, against how many seats, so classrooms, workshops, sanitation and dormitories can be sized. We do not ask for learner or teacher records, staff details, contacts or results.

## Status at a glance

| # | Request | Priority | Status |
|---|---|---|---|
| R1 | Read access to 3 aggregate reports (learners per programme, programme names, administrative units) | P2 | ⏳ Waiting: all 3 return 403 |
| R2 | Seat capacity per programme | P1 | ⏳ Waiting: not in the API |
| R3 | Extra fields on `/schools` list rows | P2 | ⏳ Waiting |
| R4 | Data quality on `/schools` | P2 | ⏳ Waiting: details below, including one possible duplicate |
| R5 | Change feed (`updatedSince` / webhook) | P3 | Optional: our freshness check covers it |
| R6 | Register RTB 3D GIS for "Sign in with TDMP" (production + test) | P1 | ⏳ Waiting: the only thing single sign-on still needs |
| R7 | Role at sign-in | P2 | To agree (guide §12). No longer blocking: roles are set in RTB 3D GIS until then |
| R8 | Area (province / district / school) at sign-in | P2 | To agree (guide §12). No longer blocking: areas are set in RTB 3D GIS until then |
| R9 | `amr` claim | P3 | Not provided (guide §6.4); our 2FA stays on for privileged roles |
| R10 | Test environment and test accounts | P2 | ⏳ Waiting: the guide says a test environment exists; please send test registration details |
| R17 | Tell connected systems when an account is deactivated | P2 | To agree (guide §12). Until then our TDMP sessions last at most 24 h |
| R18 | Open a specific school from the TDMP launcher | P3 | To agree (guide §12) |
| R12 | Rotate the API key; separate keys per environment | P1 | ⏳ Waiting: production key now installed, please rotate |
| **R15** | **Embed RTB GIS dashboards and maps in TDMP** | **P2** | **Ready on our side: partner key issued to TDMP** |
| **R16** | **TDMP sites allowed to show embedded views** | **P2** | **⏳ Waiting: list of TDMP origins** |

Our admin page re-checks these automatically: when you grant an endpoint, it appears as met on our side without any change from us. R15 ticks itself off when TDMP first opens an embedded view.

## What RTB GIS provides to TDMP

Everything below is live and documented, with copy-ready code and a "try it" console, at **https://rtb.aerovyntech.com/developers**.

| What | How | Notes |
|---|---|---|
| **Partner key** | Issued by an RTB GIS administrator (TDMP integration page ▸ Shared with TDMP); shown once | Send as `Authorization: ApiKey rtbgis_pk_…` (or `X-API-Key`). Stored hashed on our side, revocable at any time |
| **School list / one school** | `GET /api/v1/partner/schools`, `GET /api/v1/partner/schools/{schoolCode}` | Condition score, priority, and which views have imagery / a 3D model |
| **Embedded views** | `POST /api/v1/partner/embed-links` → put the returned `url` in an iframe | `school-dashboard`, `school-map-2d`, `school-map-3d`, `national-map`, `national-dashboard` (national views optionally one province / district). **One link opens one view only** |
| **Key check** | `GET /api/v1/partner/ping` | Returns the partner and scopes |

How access is controlled:
- **Scopes per key:** `schools:read`, `embed:create`.
- **Access level per key**, set by RTB GIS: **national**, one **province**, one **district**, or a **list of schools**, plus which embedded views it may open. Every endpoint applies it: lists only contain schools within it, a school outside it answers 404, and embed links can never cover more (a wider area or a view not allowed answers `403 PARTNER_ACCESS_DENIED`). Narrowing a key ends the views opened under the old access. `GET /partner/ping` shows the key's level. TDMP's production key is national with all views.
- **Embedded views are read-only and scoped.** A link covers one school (or one area for the national map). It expires in minutes (60–3600 s), and the view it opens lasts the session length you choose (5–480 min). The token travels in the URL fragment, so it is never sent to servers or in Referer headers.
- **One link, one view:** a dashboard link shows only the dashboard, a 2D link only the 2D map, a 3D link only the model, a national-map link only the national map, a national-dashboard link only the national dashboard. The session cannot reach any other view's data (`403 EMBED_VIEW_DENIED`).
- **Revocation is immediate:** revoking a key ends every embedded view opened with it.
- **Everything is audited.** Each embedded view opened is recorded with partner, view and scope.
- **Framing is restricted** to the sites registered with the key (R16).
- **No personal data:** school figures only.

RTB GIS users with an account can also open the same views directly (`/embed/schools/{id}/dashboard`, `/map-2d`, `/map-3d`, `/embed/map`, `/embed/dashboard`). They see them with their own role and area.

## Data we take from TDMP

| Data area | Information needed | Priority / purpose |
|---|---|---|
| School profile | Official school code and name, school type and status, location and administrative codes | P1: identify each school site and place it on the map |
| Enrolment and programmes | Learner totals, programmes offered, learners per programme (with gender split), approved seat capacity | P1: compare the learners each site serves with its classrooms, workshops, sanitation and dormitories |
| Teachers | Teacher totals | P1: staff rooms and staff housing needs |
| User identity and access | Verified user identity, role, account status and authorised geographic or school scope, for single sign-on | P1: enable secure access through TDMP identity services |

## What is live (production, 2026-11-12)

| Data area | From | In RTB GIS today |
|---|---|---|
| School profile | `GET /schools`, `GET /schools/{schoolCode}`, `categoryBand=TSS\|VTC` filter | ✅ 375 TVET schools synced: code, name, type, status, location names and ids, ownership, year established |
| Enrolment / staffing totals | `counts.students`, `counts.teachers`, `tradeNames` | ✅ Learner and teacher totals, programme codes |
| Sync | Your daily refresh (we observe ~06:00 Kigali) | ✅ Automatic: a freshness check at an interval we set (15 min–6 h) plus a full run daily at 07:15; unchanged schools are skipped |
| User identity | Code + PKCE, JWKS-verified ID token, `/oauth/userinfo`, rotating refresh tokens, revoke at sign-out (per the TDMP SSO guide) | ✅ Built on our side; waiting on R6 (registration) to switch on |

First sync: 391 schools read, 373 added, 2 matched to existing RTB GIS schools, 0 failures, in 32 seconds. The next scheduled run found all schools unchanged and rewrote nothing.

Thank you. This covers the school profile in full.

## Requests

Priority: **P1** blocks a phase we are about to start · **P2** needed for complete data · **P3** future.

### Enrolment and programmes

#### R1 (P2): Grant our partner key read access to three aggregate reports

Our key's service account (`accessScope: unrestricted, source: service_account`) gets **403 Insufficient permissions** on endpoints the docs list for `external_api_consumer`. We only need **school-level aggregates**:

| Endpoint | Used for | Today |
|---|---|---|
| `GET /reports/trades/students?schoolId=` | Learners per programme, with gender split: sizes workshops, sanitation and dormitories | 403 |
| `GET /trades` | Programme names for the codes in `tradeNames` | 403 |
| `GET /locations/provinces … /villages` | Administrative unit names and codes | 403 |

We do **not** need `/students`, `/teachers` or the student and teacher summary reports. Teacher totals from `counts.teachers` are enough.

Until R1 is granted, learners per programme and programme names stay editable in RTB GIS.

#### R2 (P1): Available seat capacity per programme

We could not find seat capacity anywhere in the API. Does TDMP (or SDMS) hold the **approved seats per programme per school** for the current academic year? If so, please expose it, for example as `capacity` on each row of `/reports/trades/students`, or as `GET /schools/{code}/programmes` → `[{ tradeCode, tradeName, level, learners, capacity, academicYear }]`.

### School profile

#### R3 (P2): Add a few fields to the `/schools` list rows


| Field | Why |
|---|---|
| `categoryBand` (TSS / VTC / …) | Today it is only a filter. **64 of the 375 schools we sync** are in neither TSS nor VTC; please tell us what they are (integrated? short courses?). Until then they keep the type set in RTB GIS |
| `updatedAt` | Change detection, so we fetch a school's details only when it changed |

#### R4 (P2): Data quality on `/schools`

Values in the live list that we treat as "unknown":

| Field | Values | Rows |
|---|---|---|
| `schoolCategory` | `"unfetched"` / `null` | 22 / 21 |
| `isActive` | `"unfetched"` / `null` | 22 / 14 |
| `schoolStatus` | mixed case: `PRIVATE` and `Private`, `PUBLIC` and `Public` | 7 |
| `authoritativeSource` | `access_scope_test`, `manual_seed` (test rows?) | 4 |

**Possible duplicate:** "KIGALI EXCELLENT TOURISM AND HOSPITALITY ACADEMY" appears as **130613** (Kicukiro) and as **120940** (Gasabo). Is this one school or two?

Can these be cleaned up, or test rows excluded from the partner view? Please also confirm:
1. The SDMS `schoolCode` is **stable and unique** per school and is never re-used.
2. `isActive = INACTIVE` means the school is closed. 14 schools we sync are INACTIVE and are left out of our national statistics.

#### R15 (P2, new): Embed RTB GIS dashboards and maps in TDMP

On a school page, TDMP can show the school's condition dashboard, site map and 3D model, read-only and limited to that school, with no second login:

1. On the TDMP **server**, for each page view, call `POST /api/v1/partner/embed-links` with the view and the school code.
2. Put the returned `url` in an iframe.

```http
POST /api/v1/partner/embed-links
Authorization: ApiKey rtbgis_pk_…
Content-Type: application/json

{ "view": "school-dashboard", "schoolCode": "280705", "sessionMinutes": 120 }
```

```html
<iframe src="{url from the response}" style="width:100%;height:720px;border:0"
        allow="fullscreen" referrerpolicy="no-referrer"></iframe>
```

Views: `school-dashboard`, `school-map-2d`, `school-map-3d`, `national-map`, `national-dashboard` (add `province` / `district` to limit a national view). Each link opens that one view only. Try a live preview with your key at https://rtb.aerovyntech.com/developers#embed.

#### R16 (P2, new): TDMP sites allowed to show embedded views

Browsers only show RTB GIS inside sites we allow (`Content-Security-Policy: frame-ancestors`), which protects users from clickjacking. Please send every origin that will host the iframes (production and staging), for example `https://tdmp.rtb.gov.rw`, and tell us before adding one.

#### R5 (P3): Change feed

Optional, since volume is small: an `updatedSince=<ISO>` filter on `/schools`, or a webhook on re-materialisation. Please also confirm the daily materialisation time (we observe about 06:00 Kigali) so our daily run stays right after it.

### User identity and access (single sign-on)

Thank you for the **"Sign in with TDMP: integration guide"** (12 Nov 2026). RTB 3D GIS now follows it: authorization code + PKCE (S256), state and nonce, the ID token checked against your JWKS, the profile read from `/oauth/userinfo`, accounts linked by `sub` (email only once, when verified), our own session, the newest refresh token always kept, and the refresh token revoked at sign-out. Because sign-in carries no role or area (§8), RTB 3D GIS sets them itself for now, and our sessions for TDMP users last at most 24 hours (§9).

#### R6 (P1): Register RTB 3D GIS (guide §3)

| Item | Value |
|---|---|
| System name | RTB 3D GIS |
| Server or browser only | Has a server (please issue a client secret) |
| Redirect URI | `https://rtb.aerovyntech.com/auth/tdmp/callback` |
| Launch URL | `https://rtb.aerovyntech.com/sso/tdmp` (starts sign-in at once; for a tile on the TDMP sign-in page) |
| Technical contact | *to fill in: name and email* |

Please also create a **test registration** on your test environment with the redirect URI `http://localhost:5173/auth/tdmp/callback`. We will send the later production domain (under `rtb.gov.rw`) as an addition. Please send the client secrets over a secure channel.

#### R7 / R8 (P2): Role and area at sign-in (guide §12)

Not blocking any more: until TDMP provides them, RTB 3D GIS administrators pre-register expected users with a role and area, and anyone else who signs in waits for access. When TDMP is ready, we can switch to TDMP's values without other changes; any of these would work for us:
- `roles` and `access_scope` claims in the ID token and `/oauth/userinfo`, or
- accepting sign-in tokens at `GET /auth/me/access-scope`, with the unit filled in:

```json
"accessScope": {
  "kind": "district",
  "provinceId": 2, "provinceName": "Southern Province",
  "districtId": 14, "districtName": "Muhanga",
  "schoolCode": null
}
```

Our draft mapping, for when roles arrive:

| TDMP access level / role | RTB 3D GIS role | Sees |
|---|---|---|
| National (RTB HQ administrator) | `admin` | National |
| National (planner / M&E officer) | `viewer` or `gis_analyst` | National |
| District | `district_officer` | Own district |
| School (manager / head teacher) | `school_leader` | Own school |
| None | no access | — |

#### R9 (P3): `amr` claim

The guide lists no `amr` claim, so RTB 3D GIS keeps asking privileged roles for its own second factor after TDMP sign-in. If TDMP adds `amr` (e.g. `["pwd","otp"]`), we can stop asking twice.

#### R10 (P2): Test environment and test accounts

The guide mentions a separate test environment. Please send the test registration (R6) and one test account per access level: national, province, district, school, and none.

#### R17 (P2): Deactivated accounts (guide §9, §12)

A refresh token keeps working for up to 30 days after a TDMP account is deactivated. Until there is a signal (back-channel logout, a webhook, or refresh tokens stopping at deactivation), our TDMP sessions end after 24 hours and users go back through TDMP sign-in.

#### R18 (P3): Open a specific school from TDMP (guide §12)

Our launch page already accepts `https://rtb.aerovyntech.com/sso/tdmp?school={schoolCode}` and opens that school after sign-in. It needs the TDMP launcher to pass the school code.

### Access key

#### R12 (P1): Key handling

1. Our production key was shared in plain text and is now installed on our server. Please **rotate it** and deliver the new key over a secure channel.
2. Please issue **separate keys** for development/staging and production.
3. Are there **rate limits**? Our load today: one small freshness request at the interval our administrators choose (currently every 6 hours; never more than every 15 minutes), plus about 10 requests per daily full run. Once R1 is granted, a weekly run adds 1 request per school.

## What we do on our side

- Sync on a schedule (freshness check, daily full run) and log every run, with a report, in our audit trail.
- Run the partner API and embedded views described above, with keys issued and revoked by our administrators.
- Show TDMP-sourced fields as read-only and send corrections back through a "Request a change" process.
- Keep the partner key on our server only. It never goes to browsers.
- Store only school-level aggregates and the signed-in user's identity claims (Law 058/2021).

## Contact

RTB 3D GIS backend team: deliverystudio@nga.ac.rw
