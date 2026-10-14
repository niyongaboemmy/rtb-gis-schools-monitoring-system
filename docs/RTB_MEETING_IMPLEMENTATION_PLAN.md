# RTB GIS Schools Monitoring System: Implementation Plan

**Source:** RTB project meeting minutes
**Prepared:** 2026-10-08
**Baseline:** `main` @ `7408e2c6` ("Updates on building details")
**Supersedes:** nothing. `IMPLEMENTATION_PLAN.md`, `DASHBOARD_FIX_PLAN.md` and `DASHBOARD_AUDIT_REPORT.md` (June–Aug 2026) cover dashboard maths only. Workstream 1 below re-verifies what they fixed and closes what is left.

---

## 0. How to read this document

Each meeting item maps to a **workstream** (WS1 to WS10). Each workstream gives:

- **Current state:** what the code does today, with file references, so nobody rebuilds something that already exists.
- **Tasks:** numbered (e.g. `WS7.3`) so they can become tickets one-to-one.
- **Acceptance criteria:** how we know it is done.
- **Effort:** in developer-days (d), for one full-stack developer familiar with the codebase.

Section 11 lays the workstreams onto the four primary activities from the minutes: **Testing → Fixing & implementing recommendations → Final test → Final fix.**

---

## 1. Meeting items vs. current state

| # | Meeting item | Status today | Workstream |
|---|---|---|---|
| 1 | Review dashboard calculations | **Mostly fixed.** Six-factor model centralised in `scoring.constants.ts`; national KPIs now server-computed. Some client-side heuristics and local averages remain. | WS1 |
| 2 | Review terminologies | **Inconsistent.** The same score is called "Health", "Intelligence", "Decision" and "Overall". Raw enum values (`NEED_INTERVENTION`) leak into the UI. Land unit shown as "h" instead of "ha". | WS2 |
| 3 | Review system UX | **No structured review done yet.** | WS3 |
| 4 | New features to make it easy to use | **Not started.** No onboarding, contextual metric help, or role-specific home page. | WS3 |
| 5 | Explore tools: user-friendly, easy to understand | **Functional but expert-oriented.** 2D (OpenLayers) and 3D (three.js) toolbars differ in icons, labels and behaviour. | WS4 |
| 6 | 2D tools properly synced to 3D | **Not synced.** 2D annotations are saved to the API; 3D measures/annotations go to browser storage under one *global* key (leaks across schools) plus an unauthenticated file-server write. | WS5 |
| 7 | Measurement precision testing | **Never tested.** 2D uses geodesic maths (good). 3D has two different area formulas in two viewers, and shows millimetre precision the models cannot support. | WS6 |
| 8 | Tools based on permissions (school leader, admin, …) | **Partial.** Fine-grained permissions and a geographic scope (National ▸ Province ▸ District ▸ Sector ▸ School) exist, but no "School Leader" role preset, and viewer tools (measure, annotate, save) are not individually gated. | WS7 |
| 9 | RISA regulations enforcement | **Not assessed.** Production runs on AWS outside Rwanda and on a non-`.gov.rw` domain, which raises a data-residency question under Law 058/2021. | WS8 |
| 10 | Security measures on both ends | **Partial, with critical gaps.** Helmet, throttling, bcrypt and hashed OTPs are in place. Critical gaps: hard-coded JWT fallback secret, unauthenticated WebSocket rooms, open file-server writes, refresh token in `localStorage`, unvalidated request bodies. | WS9 |
| 11 | Change password, reset password, 2FA, Google auth | **3 of 4 exist.** Change password (`PATCH /users/me/password`), emailed-OTP reset, and Google sign-in all work. **2FA is missing.** Change password has no policy validation and does not revoke sessions. | WS10 |
| 12 | Logs for every action (Action, By Who, When, To Who) | **Partial.** An `audit_logs` table and `GET /audit-logs` exist, but only ~9 actions are logged (out of ~60 mutating endpoints). Password logins are not logged, and there is **no UI**. | WS11 |

---

## 2. Critical findings to fix first (before any testing round)

These are defects or exposures serious enough that testing on top of them wastes effort. They are also listed in their own workstreams.

| ID | Finding | Evidence | Fix |
|---|---|---|---|
| C1 | **Hard-coded JWT fallback secret.** If `JWT_SECRET` is unset, tokens are signed with a string visible in the repo, so anyone can forge an admin token. | `server/src/modules/auth/strategies/jwt.strategy.ts:17`, `auth.module.ts:25` | Remove fallbacks; refuse to boot without `JWT_SECRET` / `JWT_REFRESH_SECRET` (≥ 32 random bytes). |
| C2 | **3D measurements/annotations leak across schools.** Stored under fixed keys `glb_viewer_measures_v1` / `glb_viewer_annotations_v1`, not per school. | `client/src/components/School3DView.tsx:143-144, 418-419` | Key by `schoolId` now; move to API in WS5. |
| C3 | **Unauthenticated writes to file-server.** `PUT /files/schools/:id/viewer-state` is open unless `UPLOAD_TOKEN` is set, and the client never sends a token. A shared token in a browser bundle would not be real auth anyway. | `file-server/server.js:27-83, 178`; `School3DView.tsx:444` | Verify the user JWT on the file-server (shared `JWT_SECRET`), or move viewer-state into the Nest API (preferred, WS5). |
| C4 | **Unauthenticated WebSocket.** Any client can connect and `join` any room (e.g. `school:<id>`), bypassing geographic scope. | `server/src/modules/events/events.gateway.ts:34-50` | Verify the JWT in `handleConnection`; on `join`, check the room against the user's scope. |
| C5 | **Production data residency.** Personal data (users, school contacts) is hosted on AWS outside Rwanda. Law 058/2021 requires storage in Rwanda unless the controller holds an NCSA registration certificate. | Deployment notes (EC2, `rtb.aerovyntech.com`) | Decision for RTB, see WS8. Not a code fix. |

---

## WS1: Dashboard calculations review

**Goal:** every number on every dashboard is traceable to a documented formula and verified against the database.

### Current state
- One six-factor model in `server/src/modules/analytics/scoring.constants.ts`: infrastructure 35%, building age 25%, facility compliance 15%, accessibility 10%, population 10%, resolution 5%. Bands: critical < 35, high < 55, medium < 75, low ≥ 75. Neutral score of 50 when data is missing.
- The national dashboard (`client/src/pages/Dashboard.tsx:285-330`) now uses server averages. The earlier hard-coded 68/72/84 values are gone.
- **Remaining issues:**
  - `RiskAssessment.tsx:95-220`: risk impact and "mitigation effectiveness" use client-side magic numbers (e.g. `90 - criticalCount * 8`). These look like data but are heuristics.
  - `SchoolDecisionDashboard.tsx:270-340`: recomputes average building age, student and staff totals in the browser instead of using `GET /analytics/schools/:id/metrics`. Two sources can disagree.
  - `SchoolStatsCards.tsx:53-92`: capacity %, student:teacher ratio and land area computed client-side. Land area shows `"h"`.
  - "Capacity Utilisation" on the national dashboard is `null` until `nationalCapacityUtilisation` is wired.
  - "Buildings Depreciation" is `100 − age score`. That is a proxy, not depreciation in the accounting sense (see WS2).
  - `CLAUDE.md` still documents the old four-factor 40/30/15/15 model.

### Tasks
| ID | Task | Effort |
|---|---|---|
| WS1.1 | Write a **Metric Dictionary** (`docs/METRIC_DICTIONARY.md`): for every KPI on every dashboard, list the label, formula, source fields, filters (active schools only, scope), units, missing-data behaviour and the owning endpoint. | 1.5d |
| WS1.2 | Build a **golden dataset** (5 to 8 schools with hand-calculated expected scores) and Jest tests asserting `calculateSchoolScore`, `getOverview` and `getSchoolMetrics` reproduce them exactly. | 2d |
| WS1.3 | SQL cross-check script (`server/scripts/verify-dashboards.ts`): recompute each national KPI with raw SQL and diff it against the API response. Run it on staging and production data. | 1d |
| WS1.4 | Move the `SchoolDecisionDashboard` and `SchoolStatsCards` derived figures to the server metrics endpoint; delete the client recomputation. | 1.5d |
| WS1.5 | Decide on `RiskAssessment` heuristics: either move them server-side with documented rules, or label the panel "Indicative" and show the rule in a tooltip. **Recommendation:** move them server-side. | 1d |
| WS1.6 | Wire `nationalCapacityUtilisation` (Σ students ÷ Σ capacity, active schools, scoped), or hide the card until the capacity data exists. | 0.5d |
| WS1.7 | Show the data-gap flags (`*DataGap`) in the UI wherever a neutral 50 was substituted, so a 50 is never mistaken for a measured value. | 1d |
| WS1.8 | Update `CLAUDE.md`. Archive the three older dashboard plan files into `docs/archive/` with a note pointing here. | 0.25d |

**Acceptance:** the golden-dataset tests pass; the SQL cross-check shows zero diffs; every dashboard number has a Metric Dictionary entry; no dashboard component computes a score or ratio from raw records.

**Effort:** ~8.75d

---

## WS2: Terminology review

**Goal:** one name per concept, in plain language an RTB officer or school leader understands.

### Current state
- The composite score has several names: "National Health Score", "Intelligence Score", "Decision Score", "Overall Score".
- "AI-driven priority scores" in the permission catalogue overstates a weighted formula.
- Raw enum values appear in the UI (`NEED_INTERVENTION` appears 45 times in client code). "Solved" and "Resolved" are both used for the same status.
- Units are mixed: "h" vs "ha", m² with 1 to 4 decimals, km² for small areas.

### Tasks
| ID | Task | Effort |
|---|---|---|
| WS2.1 | Draft a **Glossary** (`docs/GLOSSARY.md`) with RTB: the canonical term, a one-line definition, terms to avoid, and the Kinyarwanda equivalent if needed. Proposed core terms: **School Condition Score** (0–100, higher = better), **Intervention Priority** (Critical / High / Medium / Low), **Building Age Score** (replaces "Depreciation"), **Facility Compliance**, **Issue Report**, **Needs Intervention**, **Resolved**. | 1d + RTB review |
| WS2.2 | Create `client/src/lib/labels.ts`: a single map of enum value → display label (statuses, conditions, priorities, school types, compliance levels). Replace inline enum rendering. | 1.5d |
| WS2.3 | Create `client/src/lib/format.ts`: shared unit formatters (length, area, ha, percentages, RWF currency, dates in `Africa/Kigali`). Replace ad-hoc `toFixed` calls. | 1.5d |
| WS2.4 | Apply the glossary across pages, tooltips, the permission catalogue (server and client), emails and the Swagger descriptions. | 1.5d |
| WS2.5 | *(Optional, confirm with RTB)* Set up i18n scaffolding (English / Kinyarwanda) via `react-i18next`, starting with navigation and dashboards. | 3d |

**Acceptance:** a grep for the retired terms returns zero hits in UI strings; no raw enum value renders; all units come from `format.ts`.

**Effort:** ~5.5d (+3d optional i18n)

---

## WS3: UX review and ease-of-use features

**Goal:** a first-time user can find a school, understand its score and report an issue without training.

### Tasks: review
| ID | Task | Effort |
|---|---|---|
| WS3.1 | **Heuristic review** (Nielsen's ten heuristics) of the main flows: login, national dashboard, schools list, school detail, school dashboard, 2D viewer, 3D viewer, reporting, settings. Record findings in a tracker with severity 1–4. | 2d |
| WS3.2 | **Task-based usability test** with 3 to 5 real users per role (RTB officer, GIS analyst, school leader). Five scripted tasks each; measure completion, time and errors. | 2d (+ RTB scheduling) |
| WS3.3 | **Accessibility pass** to WCAG 2.1 AA: contrast in both themes, keyboard navigation, focus states, form labels, alt text. Use axe DevTools on each route. | 1.5d |
| WS3.4 | Responsive check at 360 / 768 / 1280 px for all non-viewer pages. | 1d |

### Tasks: ease-of-use features (prioritise after WS3.1–3.2)
| ID | Feature | Why | Effort |
|---|---|---|---|
| WS3.5 | **"What does this mean?" metric help:** an info icon on every KPI opens a drawer with the glossary definition, formula and data sources (from WS1.1). | Makes scores self-explanatory; supports the calculation review. | 2d |
| WS3.6 | **Role-based home page:** a school leader lands on their own school dashboard; national roles land on the national dashboard. | Removes navigation for the largest user group. | 1d |
| WS3.7 | **First-run guided tour** (e.g. `react-joyride`) per role, re-openable from the Help menu. | Onboarding without training. | 2d |
| WS3.8 | **Consistent empty, loading and error states:** skeletons, "no data yet, here is how to add it", retry buttons. | Data gaps currently look like broken pages. | 1.5d |
| WS3.9 | **Breadcrumbs and a persistent school context switcher** on all school-scoped pages. | Orientation across the many school sub-pages. | 1d |
| WS3.10 | **Saved filters and exports** on the schools list and analytics (gated by `EXPORT_REPORTS`). | Common officer workflow. | 1.5d |
| WS3.11 | **In-app notifications** for report status changes and assigned actions (reuses the WebSocket once C4 is fixed). | Leaders learn when an issue is resolved. | 2d |

**Acceptance:** no open severity-3/4 UX findings; every scripted task has ≥ 80% unassisted completion in the final test; axe reports zero critical violations.

**Effort:** ~6.5d review + ~11d features

---

## WS4: Explore tools: user-friendly and easy to understand

**Goal:** the 2D and 3D tools look and behave the same and explain themselves.

### Current state
- 2D: `client/src/components/2dviewercomponents/MapToolbar.tsx` (OpenLayers): distance and area measurement, overlays, layers, location editor.
- 3D: `client/src/components/3dviewercomponents/ViewerRightToolbar.tsx` with `ViewerMeasurePanel.tsx` (three.js): distance, area, perimeter, annotate, pins, render modes, six units.
- A separate `client/src/pages/GlbViewer.tsx` has its own toolbar and its own measurement maths.

### Tasks
| ID | Task | Effort |
|---|---|---|
| WS4.1 | Define one **tool vocabulary** (names, icons, shortcuts, cursor states) shared by 2D and 3D in `client/src/lib/viewer-tools.ts`. | 1d |
| WS4.2 | Labelled toolbar buttons (icon + short label, or tooltip with a shortcut hint). Show an active-tool banner: "Measuring distance: click to add points, double-click to finish, Esc to cancel." | 1.5d |
| WS4.3 | Common interactions in both viewers: **undo last point**, **Esc to cancel**, **clear all (with confirm)**, **edit or delete a single measurement**, and a unit selector that persists per user. | 2d |
| WS4.4 | Measurement list panel in both viewers: name, value, unit, who and when; click to fly to it; export CSV. | 1.5d |
| WS4.5 | Retire `GlbViewer.tsx` or make it reuse the `School3DView` tools, so only one 3D toolset exists. **Recommendation:** retire it once routes are confirmed unused. | 1d |
| WS4.6 | Refresh the help content (`ViewerHelpModal.tsx`, `glb/HelpPanel.tsx`) with short animated GIFs per tool. | 1d |

**Acceptance:** a usability tester can complete a distance measurement and an area measurement in each viewer without help; the tool names and icons are identical across viewers.

**Effort:** ~8d

---

## WS5: 2D ↔ 3D synchronisation

**Goal:** anything drawn, measured or selected in one viewer appears correctly in the other, and both read and write the same server data.

### Current state
| Data | 2D | 3D | Synced? |
|---|---|---|---|
| School location | API (`school.latitude/longitude`), editable | Derived from the KMZ/GLB on upload (`server/src/modules/kmz/geo-derive.ts`) | One-way (upload overwrites) |
| Buildings | API (`school_buildings`) | API (normalised in `School3DView.tsx:147`) plus GLB pins | Same records; pin placement separate |
| Annotations | API `POST/DELETE /schools/:id/kmz/2d/site-annotations` (WGS84) | Browser storage (global key, C2) plus file-server `viewer-state` (model coordinates) | **No** |
| Measurements | API, as site annotations with `lengthMeters` / `areaSquareMeters` | Browser storage plus file-server | **No** |
| Camera / view | None | Per-model home in browser storage | N/A |

### Tasks
| ID | Task | Effort |
|---|---|---|
| WS5.1 | **Hotfix C2:** key 3D browser storage by `schoolId` and migrate existing global keys once. | 0.5d |
| WS5.2 | New entity **`site_features`** (or extend site annotations): `id, schoolId, kind (measure_distance / measure_area / measure_perimeter / note / pin), geometry (GeoJSON, WGS84, with Z), modelCoords (optional), value, unit, label, createdBy, createdAt, updatedBy, source ('2d' / '3d')`. Add a TypeORM migration and a validated DTO. Replace the `@Body() annotation: any` endpoint. | 2d |
| WS5.3 | **Coordinate bridge:** a helper that converts GLB model coordinates ↔ WGS84 using the georeference already derived in `geo-derive.ts` (origin + ENU frame). Unit-test it with round trips to below 1 cm. | 2.5d |
| WS5.4 | 3D viewer reads and writes `site_features` through the Nest API (with JWT) instead of browser storage and file-server `viewer-state`. Keep the camera "home" as a per-user preference. Remove the file-server `PUT viewer-state` (closes C3). | 2d |
| WS5.5 | 2D viewer renders 3D-created features, and 3D renders 2D-created features (draped on the model surface or at ground elevation). | 2d |
| WS5.6 | **Selection sync:** selecting a building in one viewer highlights it in the other. "Open in 3D" / "Open in 2D" buttons carry the school, selected building and approximate camera position. | 1.5d |
| WS5.7 | **Live updates:** emit `site-feature:changed` on the (now authenticated) WebSocket so an open viewer refreshes. | 1d |
| WS5.8 | **Sync verification test:** draw a known footprint in 2D; confirm the same feature in 3D aligns with the model building edge within the WS6 tolerance, and vice versa. | 1d |

**Acceptance:** a feature created in either viewer appears in the other after a reload (and live, with WS5.7); positional offset between viewers is within tolerance; no viewer state remains in browser storage except UI preferences.

**Effort:** ~12.5d

---

## WS6: Measurement precision testing

**Goal:** documented, evidenced accuracy for every measuring tool, and displayed precision that matches real accuracy.

### Current state
- **2D:** `ol/sphere` `getLength` / `getArea` (geodesic, on the WGS84 sphere): `useMapInteractions.ts:135-210`. Accuracy is then limited by the imagery and KML georeferencing.
- **3D, `School3DView.tsx:195-225`:** Euclidean distance; area projected onto the best-fit plane of the clicked points (true 3D surface area for sloped polygons).
- **3D, `GlbViewer.tsx:62-70`:** area from the shoelace formula on X/Z only (horizontal projected area). **The two 3D viewers return different areas for the same sloped polygon.**
- 3D assumes model units are metres. That depends on how the GLB was exported and optimised (`server/glb-tools`).
- 3D shows 3 decimals in the chosen unit (millimetres when metric). That implies precision a photogrammetry model cannot give.

### Test protocol
1. **Reference set** (with RTB or the survey contractor): at 2 or 3 pilot schools, pick 10 reference objects: building edges, a court or pitch, a fence line, and 3 building footprints. Measure them on the ground with tape or total station, or with RTK-GNSS points.
2. **Repetition:** 3 testers × 3 repetitions × each tool (2D distance, 2D area, 3D distance, 3D area, 3D perimeter, 3D height).
3. **Metrics:** mean error, RMSE, maximum error, and relative error (%) per tool; inter-tester spread.
4. **Proposed tolerances** (confirm with RTB; they depend on imagery GSD and model resolution):

   | Tool | Tolerance |
   |---|---|
   | 2D distance | ≤ 0.5 m or ≤ 1%, whichever is larger |
   | 2D area | ≤ 2% |
   | 3D distance / height | ≤ 0.10 m or ≤ 1% |
   | 3D area | ≤ 2% |
   | 2D vs 3D, same object | ≤ 0.5 m positional; ≤ 2% area |

5. **Report:** `docs/MEASUREMENT_PRECISION_REPORT.md`, with raw data in CSV, signed off by RTB.

### Tasks
| ID | Task | Effort |
|---|---|---|
| WS6.1 | Unit tests for 2D maths against known geodesic values (e.g. 1° of latitude at Kigali's latitude; a 100 m × 100 m square ≈ 1 ha). | 0.5d |
| WS6.2 | Unit tests for 3D maths: a unit cube, a sloped rectangle (plan vs surface area), collinear points, self-intersecting polygons (reject or warn). | 0.5d |
| WS6.3 | **Unify the 3D maths** into one module. Offer **both** "plan area" and "surface area" explicitly labelled, defaulting to plan area so it compares with 2D. | 1d |
| WS6.4 | **Verify model scale on upload:** compare the GLB bounding box with the KMZ footprint extent; warn if the ratio differs from 1 by more than 2%. Store the scale factor and apply it in measurements. | 1.5d |
| WS6.5 | **Honest display precision:** 2D to 0.1 m / 0.1 m², 3D to 0.01 m (cm), areas over 10,000 m² also shown in ha. Show "±" accuracy from the precision report in the measurement tooltip. | 0.5d |
| WS6.6 | Run the field protocol and produce the report. | 3d (+ field time) |

**Acceptance:** all tools within tolerance at the pilot schools, or the deviation is explained and accepted by RTB; one 3D maths implementation; the report is signed off.

**Effort:** ~7d plus field time

---

## WS7: Permission-based tools and roles

**Goal:** each role sees exactly the tools it should, enforced on the server and reflected in the UI.

### Current state
- 34 permissions in `server/src/common/constants/permissions.constant.ts`, mirrored in `client/src/lib/permissions.ts`, with grouped toggles in the Roles admin screen.
- Default roles: `super_admin`, `admin`, `gis_analyst`, `viewer`, plus demo `scope_*` roles. **No school-leader role.**
- Geographic scope (`server/src/common/scope/access-scope.ts`) is **enforced by default** (`SCOPE_ENFORCEMENT !== 'false'`).
- 2D location editing is gated (`School2DViewer.tsx:225`). 3D measure, annotate and pin tools are **not** gated by permission.

### Proposed role matrix (to confirm with RTB)

| Capability | Super Admin | Admin (RTB HQ) | GIS Analyst | District / Sector Officer | **School Leader** | Viewer |
|---|---|---|---|---|---|---|
| Scope | National | National | National | Own district / sector | **Own school** | As assigned |
| View dashboards & map | ✓ | ✓ | ✓ | ✓ | Own school | ✓ |
| View 2D/3D, measure (temporary) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Save measurements / annotations | ✓ | ✓ | ✓ | ✓ | ✓ (own school) | ✗ |
| Upload KMZ / GLB | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Edit location / buildings | ✓ | ✓ | ✓ | ✗ | ✗ (request change) | ✗ |
| Edit contacts, programmes, staff | ✓ | ✓ | ✗ | ✗ | ✓ (own school) | ✗ |
| Submit issue reports | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Triage reports | ✓ | ✓ | ✗ | ✓ (scope) | ✗ | ✗ |
| Run facility survey | ✓ | ✓ | ✗ | ✓ | ✓ (self-assessment) | ✗ |
| Decisions / recalculate | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Export | ✓ | ✓ | ✓ | ✓ (scope) | Own school | ✗ |
| Users / roles | ✓ | Users only | ✗ | ✗ | ✗ | ✗ |
| Audit trail | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |

### Tasks
| ID | Task | Effort |
|---|---|---|
| WS7.1 | Workshop with RTB to confirm the matrix above. | 0.5d |
| WS7.2 | Add permissions `USE_MEASURE_TOOLS`, `SAVE_SITE_FEATURES` and `EXPORT_VIEWER_DATA`. Fix the typo `SCHOOL_SURVERY_EDIT` → `SCHOOL_SURVEY_EDIT` with a data migration that rewrites stored role permission arrays. | 1d |
| WS7.3 | Seed `school_leader` (School access level) and `district_officer` (District access level) role presets. Make seeding idempotent and leave admin-edited roles untouched. | 1d |
| WS7.4 | Gate each viewer tool in 2D and 3D with `useAuthorization()`. Hide tools the user cannot use; never just disable them silently. | 1.5d |
| WS7.5 | Server-side enforcement on the new `site_features` endpoints (WS5.2) with `@RequirePermissions` + `@ScopedResource`. | 0.5d |
| WS7.6 | **Permission matrix e2e test:** for each seeded role, call every protected endpoint and assert 200 / 403 and scope filtering. Generate the expected matrix from the role definitions. | 2.5d |
| WS7.7 | "Request change" flow for school leaders on locked fields (creates an issue report routed to the GIS analyst). | 1.5d |

**Acceptance:** the e2e matrix passes for every role; a school leader cannot see or reach another school's data via the UI, API or WebSocket; the UI shows no tool the server would refuse.

**Effort:** ~8.5d

---

## WS8: RISA / national regulatory compliance

**Goal:** the system meets Rwanda's government ICT and data-protection requirements, evidenced in a compliance checklist.

> **Scope note:** RISA (Rwanda Information Society Authority) sets government ICT standards; the **NCSA** (National Cyber Security Authority) is the supervisory authority for **Law No. 058/2021 on the Protection of Personal Data and Privacy**. Obtain the exact applicable RISA standards and NCSA guidance from the RTB ICT unit. The items below are what can be confirmed publicly and what the codebase shows.

### Known legal requirements (Law 058/2021)
- Personal data must be **stored in Rwanda**, unless the controller or processor holds a registration certificate from the supervisory authority (NCSA) permitting storage abroad.
- Data controllers and processors must **register** with NCSA.
- Data subjects have rights of access, correction and erasure.
- Processing activities must be **recorded**.
- **Personal-data breaches must be notified to NCSA within 48 hours.**

### Tasks
| ID | Task | Owner | Effort |
|---|---|---|---|
| WS8.1 | Obtain the applicable RISA standards (hosting, government domain, security baseline, interoperability) and NCSA guidance from RTB ICT. Build `docs/COMPLIANCE_CHECKLIST.md` mapping each requirement to evidence. | RTB + dev | 1d |
| WS8.2 | **Data residency decision (C5):** either migrate production to a Rwanda-hosted environment (e.g. the government data centre or an in-country cloud) or have RTB, as controller, obtain NCSA registration covering storage abroad. Plan the migration if needed (separate estimate). | RTB decision | — |
| WS8.3 | Move to a government domain (`*.rtb.gov.rw` or as RISA directs) with TLS and HSTS. | RTB ICT + dev | 0.5d |
| WS8.4 | **Personal-data inventory:** list each personal field (users: name, email, phone; school contacts; report submitters), its purpose, retention period and access roles. | dev | 1d |
| WS8.5 | Data-subject rights: profile self-service export and correction (partly exists in `Profile.tsx`); an admin process for erasure that anonymises the user while keeping audit integrity. | dev | 2d |
| WS8.6 | **Breach response runbook:** detection sources (audit alerts, WS11), who to notify, a 48-hour NCSA notification template, evidence preservation. | RTB + dev | 1d |
| WS8.7 | Privacy notice and terms on the login page; record user acceptance with a timestamp. | dev | 0.5d |
| WS8.8 | Backup and disaster-recovery policy: daily encrypted DB and object-storage backups, kept in-country, with a quarterly restore test. | dev / ops | 1d |
| WS8.9 | Independent security assessment or penetration test before go-live, if RISA or NCSA requires it. | RTB | — |

**Acceptance:** every checklist item is closed or formally accepted as a risk by RTB; the residency decision is recorded.

**Effort:** ~7d dev (excluding migration and external pentest)

---

## WS9: Security hardening (server and client)

### Already in place (keep)
Helmet; global throttling (200 req/min) with tighter auth limits; bcrypt (cost 12) for passwords; hashed and rotated refresh tokens; hashed 6-digit reset OTPs with an attempt cap; a global `ValidationPipe` with whitelist; RBAC and scope guards on controllers; `.env` and `.pem` files gitignored.

### Server tasks
| ID | Task | Priority | Effort |
|---|---|---|---|
| WS9.1 | **C1:** remove the JWT secret fallbacks; validate required env at boot (a `ConfigModule` validation schema). | Critical | 0.5d |
| WS9.2 | **C4:** authenticate WebSocket connections (JWT in the handshake `auth`) and authorise room joins against scope. | Critical | 1d |
| WS9.3 | **C3:** file-server write endpoints verify the JWT and `UPLOAD_KMZ` permission, or are removed (WS5.4). Make the token mandatory in production. | Critical | 1d |
| WS9.4 | Replace every inline or `any` request body with a class-validator DTO: `refresh`, `me/profile`, `me/password`, `users` create/update, `site-annotations`, `bulk-json`. Inline object types are **not** validated by `ValidationPipe`. | High | 2d |
| WS9.5 | **Account lockout:** after 5 failed logins, lock for 15 minutes (per account, plus the existing per-IP throttle). Log failures (WS11). | High | 1d |
| WS9.6 | Scope the 1024 MB body limit to the KMZ/GLB upload routes only. Use 1 MB elsewhere. | High | 0.5d |
| WS9.7 | **Upload validation:** check extension and magic bytes (KMZ = ZIP, GLB = `glTF` header, images), cap ZIP entries and decompressed size (zip-bomb protection), and reject path-traversal entry names in KMZ extraction. | High | 1.5d |
| WS9.8 | Disable Swagger in production (`SWAGGER_ENABLED=false`) or put it behind admin auth. | Medium | 0.25d |
| WS9.9 | Enable a strict Content-Security-Policy in production, tuned for Cesium, OpenLayers, tiles and the Google sign-in origins. | Medium | 1d |
| WS9.10 | Revisit the deliberate user-enumeration in forgot-password (`auth.service.ts` comment). Recommend generic responses for a government system. RTB decision. | Medium | 0.25d |
| WS9.11 | Multi-session refresh tokens (a `user_sessions` table: device, IP, last used). Show and revoke sessions on the Profile page. Today a login on one device silently invalidates the others. | Medium | 2d |
| WS9.12 | Dependency hygiene: `npm audit` in CI (fail on high), Dependabot / Renovate. Note that `xlsx@0.18.5` has known advisories; move to the SheetJS CDN build or `exceljs`. | Medium | 1d |
| WS9.13 | Security headers check (HSTS, Referrer-Policy, Permissions-Policy) and TLS configuration on the EC2 / nginx host. | Medium | 0.5d |
| WS9.14 | Structured application logging with a request ID and no secrets or PII in logs. | Low | 1d |

### Client tasks
| ID | Task | Priority | Effort |
|---|---|---|---|
| WS9.15 | Move the refresh token out of `localStorage` (`client/src/store/authStore.ts:49`) into an `httpOnly; Secure; SameSite=Strict` cookie set by the server; keep the access token in memory only. Add CSRF protection for the cookie-authenticated refresh endpoint. | High | 2d |
| WS9.16 | **Idle timeout:** auto-logout after 30 minutes of inactivity (configurable), with a warning 2 minutes before. | Medium | 0.5d |
| WS9.17 | XSS review: audit the one `dangerouslySetInnerHTML` usage; ensure annotation and report text renders as text; sanitise any HTML from KMZ descriptions (DOMPurify). | Medium | 0.5d |
| WS9.18 | Confirm no secrets are in `VITE_*` variables or the built bundle. | Medium | 0.25d |

**Acceptance:** C1, C3 and C4 closed; OWASP ASVS Level 2 checklist reviewed; `npm audit` shows no high or critical issues; tokens are not readable by page JavaScript.

**Effort:** ~22d

---

## WS10: Authentication features (change password, reset, 2FA, Google)

### Current state
| Feature | Status | Location |
|---|---|---|
| Change password | Exists; **no policy validation, no session revocation, not audited** | `users.controller.ts:146`, `users.service.ts:90`, `client/src/pages/Profile.tsx` |
| Reset password | Exists (emailed 6-digit OTP, hashed, TTL, attempt cap, audited) | `auth.service.ts:168-255`, `client/src/pages/ForgotPassword.tsx` |
| Google sign-in | Exists; **open self-registration** for any verified Google address with `GOOGLE_DEFAULT_ROLE` | `auth.service.ts:85-130`, `GoogleSignInButton.tsx` |
| 2FA | **Missing** | — |

### Tasks
| ID | Task | Effort |
|---|---|---|
| WS10.1 | **Shared password policy:** one `@IsStrongPassword` rule (≥ 10 chars, upper, lower, digit, symbol; not equal to the email; not among the last 5 passwords) used by create user, change, reset and bulk import. Mirror it in the client strength meter. | 1d |
| WS10.2 | Change password: a validated DTO, revoke all other sessions, email a "your password was changed" notice, audit it. | 0.5d |
| WS10.3 | **Forced change on first login** for admin-created and bulk-imported accounts (`mustChangePassword` flag). | 1d |
| WS10.4 | **Admin "send reset link"** for a user (replaces admins setting passwords directly). | 0.5d |
| WS10.5 | **2FA (TOTP)** using `otplib` + `qrcode`. Enrol from Profile (scan the QR, confirm a code), issue 10 single-use recovery codes (hashed), disable with password + code. Store the TOTP secret encrypted (AES-256-GCM, key from env). | 3d |
| WS10.6 | **Two-step login:** `POST /auth/login` returns `{ mfaRequired: true, mfaToken }` (a short-lived JWT scoped to MFA) when 2FA is on, then `POST /auth/2fa/verify` returns tokens. Throttle and lock out like password login. Add the client OTP step using the existing `otp-input.tsx`. | 2d |
| WS10.7 | **2FA policy:** mandatory for roles with `MANAGE_USERS`, `MANAGE_ROLES`, `MANAGE_DECISIONS` or `VIEW_AUDIT_LOGS`; optional for others. Enforced at login with an enrolment redirect. An admin can reset a user's 2FA (audited). | 1d |
| WS10.8 | Email OTP as a fallback 2FA method for users without a smartphone (reuses the reset-OTP mechanism). | 1d |
| WS10.9 | **Google sign-in hardening:** restrict self-registration to allowed domains (`GOOGLE_ALLOWED_DOMAINS`, e.g. `rtb.gov.rw`) or require a pre-provisioned account. Decide whether Google login satisfies 2FA (recommendation: it does only if the Workspace enforces 2-step verification; otherwise require TOTP for privileged roles). Allow linking and unlinking from Profile. | 1.5d |
| WS10.10 | Audit every auth event (WS11.3). | (in WS11) |
| WS10.11 | Unit and e2e tests: the full login + 2FA matrix, recovery codes, lockout, Google domain restriction. | 2d |

**Acceptance:** privileged users cannot sign in without a second factor; all password paths share one policy; the auth test suite passes.

**Effort:** ~14.5d

---

## WS11: Activity logging (Action, By Who, When, To Who)

**Goal:** every state-changing action and every security event is recorded immutably and is searchable by authorised users.

### Current state
- `audit_logs` table: `actorId, actorEmail, action, targetType, targetId, meta, createdAt` (`server/src/modules/audit/entities/audit-log.entity.ts`).
- `AuditService.log()` is called from ~9 places only: user create and deactivate, role update, school delete, Google login and register, password reset, reset request, and one analytics action.
- **Not logged:** password logins (success or failure), logout, change password, school create and update, building CRUD, KMZ/GLB uploads, survey edits, report status changes, exports, permission changes on users, site annotations.
- `GET /audit-logs` (needs `VIEW_AUDIT_LOGS`) has limit and offset only; no filters and **no client UI**.

### Design
Mapping the meeting's four questions onto the schema:

| Meeting asks | Field(s) |
|---|---|
| **Action** | `action` (dotted verb, e.g. `school.update`), `outcome` (success / failure / denied), `changes` (field-level before → after) |
| **By who** | `actorId`, `actorEmail`, `actorRole`, `ip`, `userAgent`, `sessionId` |
| **When** | `createdAt` (UTC; displayed in `Africa/Kigali`) |
| **To who / what** | `targetType`, `targetId`, `targetLabel` (e.g. school name), `subjectUserId` (the person affected, e.g. the user whose role changed) |

Plus `requestId` (to correlate with application logs) and `prevHash` / `hash` (tamper evidence).

### Tasks
| ID | Task | Effort |
|---|---|---|
| WS11.1 | Migration: add `actor_role, outcome, target_label, subject_user_id, changes (jsonb), ip, user_agent, session_id, request_id, prev_hash, hash`, plus indexes on `created_at` and `subject_user_id`. Production uses migrations (`synchronize:false`). | 1d |
| WS11.2 | **Global `AuditInterceptor`:** for every non-GET request, record the action (from an `@Audit('school.update', { target: 'school', idParam: 'id' })` decorator; fall back to `METHOD route`), the actor from `req.user`, outcome from the response or exception, IP and user agent. Covers all ~60 mutating endpoints without editing each service. | 2d |
| WS11.3 | **Auth events** (logged explicitly, since some are unauthenticated): login success and failure (with reason, no password), lockout, logout, refresh-token reuse, 2FA enrol / verify / fail / reset, password change and reset, Google link and unlink. | 1d |
| WS11.4 | **Field-level diffs** for key entities (school, building, user, role, report status): a TypeORM subscriber, or load-before-save in the services, records `changes: { field: [old, new] }`. Mask sensitive fields. | 2d |
| WS11.5 | **Read-access logging** for sensitive reads only: exports, audit-log views, personal-data views (user directory). | 0.5d |
| WS11.6 | **Tamper evidence:** a hash chain (`hash = sha256(prevHash + row)`); no update or delete API; revoke `UPDATE/DELETE` on `audit_logs` from the app DB user; a nightly integrity check job. | 1.5d |
| WS11.7 | API: `GET /audit-logs` with filters (date range, actor, action, target type and id, subject user, outcome, free text), cursor pagination, and CSV export (itself audited). | 1d |
| WS11.8 | **UI: Settings → Audit Trail tab** (`client/src/components/settings/AuditTrailTab.tsx`): a filterable table with Action / By who / When / To whom columns, a diff viewer drawer, and export. Add an "Activity" tab on the school detail and user detail pages filtered to that target. | 2.5d |
| WS11.9 | **Retention policy** (agree with RTB / NCSA, e.g. 2 years online, then archive). Add a scheduled archival job. | 0.5d |
| WS11.10 | **Security alerts:** email admins on repeated failed logins, 2FA resets, role or permission changes, and bulk deletes. These feed the breach runbook (WS8.6). | 1d |
| WS11.11 | Tests: the interceptor records the expected entries for a sample of endpoints; the hash chain detects modification. | 1d |

**Acceptance:** each mutating endpoint produces exactly one audit row with all four "who / what / when / whom" answers; auth events are logged; tampering is detectable; RTB admins can search and export the trail.

**Effort:** ~14d

---

## 11. Phased schedule (primary activities)

Assumes **2 developers** working in parallel, plus RTB participation for workshops, usability sessions and field measurements. Durations are calendar weeks.

### Phase 0: Critical fixes and setup (week 1, first half)
- C1 / WS9.1, C2 / WS5.1, C3 / WS9.3, C4 / WS9.2.
- Staging environment refreshed with an anonymised production copy.
- Test tracker set up (one ticket per task ID; bug template with severity, steps, role used, expected vs actual).

### Phase 1: Testing (weeks 1–2)
| Activity | Tasks |
|---|---|
| Calculation verification | WS1.1, WS1.2, WS1.3 |
| Terminology inventory | WS2.1 (draft for RTB review) |
| UX review and usability round 1 | WS3.1, WS3.2, WS3.3, WS3.4 |
| Tools walkthrough | WS4 baseline findings |
| 2D/3D sync baseline | WS5.8 run against today's system to record the gaps |
| Precision baseline | WS6.1, WS6.2, field reference data collection begins |
| Permission matrix | WS7.1 workshop; WS7.6 test written and run against the current roles |
| Security baseline | ASVS checklist, `npm audit`, header and TLS scan |
| Compliance | WS8.1, WS8.4 |

**Exit:** a prioritised findings backlog agreed with RTB.

### Phase 2: Fixing and implementing recommendations (weeks 3–7)
| Week | Developer A (backend-leaning) | Developer B (frontend-leaning) |
|---|---|---|
| 3 | WS9.4–9.7 (DTOs, lockout, limits, upload validation); WS11.1–11.3 (audit schema, interceptor, auth events) | WS2.2–2.4 (labels, formatters, glossary rollout); WS1.4, WS1.6, WS1.7 |
| 4 | WS10.1–10.4 (password policy and flows); WS10.5–10.7 (TOTP, two-step login, policy) | WS1.5; WS3.5, WS3.6, WS3.8 (metric help, role home, states) |
| 5 | WS5.2, WS5.3 (site_features entity, coordinate bridge); WS7.2, WS7.3, WS7.5 | WS4.1–4.4 (tool vocabulary, toolbars, interactions, list panel); WS7.4 |
| 6 | WS5.4, WS5.7 (3D on API, live updates); WS11.4–11.7 (diffs, read logging, hash chain, API) | WS5.5, WS5.6 (cross-viewer rendering and selection); WS6.3–6.5 (unified 3D maths, scale check, precision display) |
| 7 | WS9.8–9.14, WS10.8–10.9, WS11.9–11.10; WS8.5–8.8 | WS9.15–9.18 (cookie tokens, idle timeout, XSS); WS11.8 (Audit Trail UI); WS3.7, WS3.9–3.11 as capacity allows; WS4.5, WS4.6 |

### Phase 3: Final test (week 8)
- Full regression: unit, e2e and the permission matrix (WS7.6).
- WS5.8 sync verification and the WS6.6 field precision run, producing the precision report.
- Usability round 2 (same scripts as WS3.2; compare results).
- Security re-test (ASVS checklist, scans; external pentest if required, WS8.9).
- Compliance checklist review with RTB ICT.
- UAT sign-off sessions per role.

### Phase 4: Final fix (week 9)
- Fix all severity-1/2 findings from Phase 3; re-test those cases.
- Update `CLAUDE.md`, the Metric Dictionary, the Glossary and user guides.
- Production deploy via the existing GitHub Actions pipeline, with migrations reviewed.
- Handover: admin guide (roles, 2FA reset, audit trail), breach runbook, backup / restore runbook.

### Effort summary
| Workstream | Effort (dev-days) |
|---|---|
| WS1 Dashboard calculations | 8.75 |
| WS2 Terminology | 5.5 (+3 i18n optional) |
| WS3 UX review + features | 17.5 |
| WS4 Explore tools | 8 |
| WS5 2D ↔ 3D sync | 12.5 |
| WS6 Measurement precision | 7 (+ field time) |
| WS7 Permissions and roles | 8.5 |
| WS8 RISA / NCSA compliance | 7 (excl. migration, pentest) |
| WS9 Security hardening | 22 |
| WS10 Auth features | 14.5 |
| WS11 Activity logging | 14 |
| Testing, final test, final fix overhead | ~15 |
| **Total** | **~140 dev-days ≈ 9 weeks with 2 developers** (≈ 14 weeks with 1) |

If the timeline must shrink, cut in this order: WS2.5 i18n, then WS3.7 / 3.10 / 3.11, then WS9.11 multi-session, then WS4.6. **Do not cut** C1–C4, WS7.6, WS10.5–10.7, WS11.1–11.3 or WS6.

---

## 12. Testing strategy

| Layer | Tooling | Coverage target |
|---|---|---|
| Server unit | Jest (11 spec files exist today) | Scoring, auth, 2FA, audit interceptor, coordinate bridge, measurement maths: ≥ 80% lines on these modules |
| Server e2e | Jest + Supertest (`server/test/`) | Auth flows, permission matrix per role, scope filtering, audit entries |
| Client unit | **Add Vitest + React Testing Library** (no client tests exist today) | `format.ts`, `labels.ts`, measurement maths, permission-gated rendering |
| Client e2e | **Add Playwright** | Login + 2FA, the 5 scripted usability tasks, 2D ↔ 3D feature round-trip, each role's visible navigation |
| Data verification | `verify-dashboards.ts` | National KPIs vs raw SQL, zero diff |
| Field | WS6 protocol | Precision report |
| Security | ASVS L2 checklist, `npm audit`, header / TLS scan, optional external pentest | No high or critical findings open |
| CI | GitHub Actions | Lint, type-check, unit and e2e on every PR; deploy only from green `main` |

---

## 13. Decisions needed from RTB

| # | Decision | Recommendation | Blocks |
|---|---|---|---|
| D1 | Data residency: migrate to Rwanda hosting, or obtain NCSA registration for storage abroad? | Migrate to in-country / government hosting | WS8.2, go-live |
| D2 | Final role matrix, especially school-leader edit rights | As proposed in WS7 | WS7.3–7.4 |
| D3 | Which roles must use 2FA; does Google sign-in count as 2FA? | Mandatory for privileged roles; Google only with enforced Workspace 2-step verification | WS10.7, WS10.9 |
| D4 | Allow Google self-registration, or only pre-provisioned accounts? | Pre-provisioned or `rtb.gov.rw` only | WS10.9 |
| D5 | Glossary terms and whether Kinyarwanda is required | Approve the WS2.1 draft; Kinyarwanda in phase 2 | WS2 |
| D6 | Measurement tolerances | As proposed in WS6 | WS6.6 sign-off |
| D7 | Audit log retention period | 2 years online, then archive | WS11.9 |
| D8 | Forgot-password: generic response (no enumeration) vs explicit feedback | Generic | WS9.10 |
| D9 | Contacts for the RISA standards and the NCSA registration | — | WS8.1 |
| D10 | Pilot schools and survey support for field precision tests | 2–3 schools with recent drone surveys | WS6.6 |

---

## 14. Definition of done (whole engagement)

- All Phase-0 critical items closed and verified.
- Every meeting item has its acceptance criteria met, or an RTB-accepted exception.
- The Metric Dictionary, Glossary, Precision Report, Compliance Checklist and runbooks are in `docs/` and signed off.
- CI is green, with unit, e2e, permission matrix and data verification all passing.
- Production deployed with migrations, 2FA enforced for privileged roles, and the audit trail live and visible to RTB admins.
