# Dashboard Calculation & Validation Audit

**Scope:** National dashboard (`/` → `client/src/pages/Dashboard.tsx`, `GET /analytics/overview`, `/analytics/hierarchy`, `/analytics/export`) and School dashboard (`/schools/:id/decision`, `/school-dashboard` → `SchoolDecisionDashboard.tsx`, `GET /analytics/schools/:id/metrics`, `GET /schools/dashboard/main`, `GET /schools/dashboard/reporting`).
**Date:** 2026-10-21 · **Branch:** `fix/deploy-reexec-after-sync` · **Method:** code review of every formula on both paths, read-only SQL probes against the dev DB (`rtb_gis_db`), probes of the pure scoring functions with edge-case inputs, a read-only TypeORM probe, and the existing test suites.

---

## 1. Executive summary

The existing checks pass: `scripts/verify-dashboards.ts` reports **ZERO DIFFS across 20 KPIs**, and the analytics/dashboard Jest suites pass (**122/122**). Neither one tests whether the numbers are *right*. The verifier only checks that the service matches SQL written the same way, and several unit tests lock in the defective behaviour (e.g. `capacityUtilization = 0 when no education programs defined`; `healthIndex` counts placeholder buildings).

On the real data the dashboards are wrong in ways a decision-maker would act on:

| # | Headline problem | Evidence in dev DB |
|---|---|---|
| 1 | **Population score is 100 (best) for every school**, even though no population data exists. All `population_data.schoolAgePopulation2km` = `0.00` (mocked ArcGIS), and a 0 counts as real data. | 7/7 active schools `populationPressureScore = 100`, `dataGaps.population = 0`, national avg = **100** |
| 2 | **Scores are stale and computed under old rules.** Scores are only recalculated when the school/building/survey is edited, or as a side effect of someone *viewing* the school. | Kicukiro (`c8ef…`): stored infra 70, gap = false. The current rule gives infra 50, gap = true, overall **51 (High)**, not the stored **58 (Medium)**. `byPriority` is wrong. |
| 3 | **Viewing a dashboard writes to the DB.** Every school-dashboard load runs `calculateSchoolScore` twice and appends `score_history` rows. | One school has **194** history rows, **119 on a single day** with one distinct score. 363 rows for 8 schools. |
| 4 | **A school with no data scores 50, which is "High" priority.** The neutral 50 sits inside the High band (35–54). | `computeOverallScore(all 50) = 50 → HIGH`. 5/7 dev schools have an infrastructure data gap. |
| 5 | **The same concept has 2–3 different values** across the national KPI, the school dashboard, the map and the reporting tab (students, infrastructure health, capacity, resolution time). | e.g. national students = 5 380, map GeoJSON shows 0 for every school |
| 6 | **Missing `schoolId` returns another school's dashboard.** `GET /schools/dashboard/main` and `/reporting` with no `schoolId` pass the scope guard and `findOne({ id: undefined })` returns an arbitrary school. | Probe returned *"Huye Technical Secondary School"* |
| 7 | **Fake values mask real ones**: the zero-filled `analytics.trends` placeholder hides the real report trend, so the school trend chart is always empty. `powerReliability: 90` / `waterAvailability: true` are hard-coded. | `ReportingTab.tsx:102`, `dashboard.service.ts:133-186` |
| 8 | **A blank building condition is saved as `good`.** It counts as an assessment and scores infrastructure 100 with no gap flag. | `SchoolForm.tsx:645`; Kigali TSS infra = 100 from one building that has no data |

Severity key: **Critical** = wrong decision or data leak likely · **High** = visible wrong/inconsistent number · **Medium** = wrong at edges / misleading · **Low** = hygiene, latent.

---

## 2. Live data snapshot (dev DB, read-only)

```
schools: 7 active, 1 under_renovation
decision_assessments: 8 rows, no duplicates per school
population_data: 8 rows, schoolAgePopulation2km = 0.00 for ALL
school_buildings: 3 rows; all lack yearBuilt; 2 are bare 'fair' placeholders
issue_reports: 2 (both PENDING, never resolved)
school_facility_surveys: 2 rows (1 school)
score_history: 363 rows (8fdd… = 194, 38aa… = 84)
educationPrograms: empty for every school → national capacity utilisation = null
```

| School | Stored score / band | Infra | Age | Access | Pop | Facility | Resolution | Infra gap |
|---|---|---|---|---|---|---|---|---|
| Kigali TSS (38aa) | 73 Medium | 100 | 30 | 50 | **100** | 100 | **0** | f |
| Kicukiro VTC (c8ef) | **58 Medium (stale)** | **70 (stale)** | 45 | 50 | **100** | 50 | 0 | **f (stale)** |
| Byumba TSS (f5ab) | 50 High | 50 | 30 | 50 | **100** | 50 | 50 | t |
| Musanze TSS (8fdd) | 54 High | 50 | 45 | 50 | **100** | 50 | 50 | t |
| others (3) | 58 Medium | 50 | 60 | 50 | **100** | 50 | 50 | t |

Of the 6 inputs, only infrastructure (1 school) and facility compliance (1 school) come from measured data. Everything else is a neutral 50, a proxy (`establishedYear`) or a mock (population).

---

## 3. Findings: scoring engine (shared by both dashboards)

### C-1 · Critical: zero/mock population rows score as "maximum headroom" (100)
- `analytics.service.ts:1427-1442` `calculatePopulationScore`: `demand = parseFloat(schoolAgePopulation2km) || 0` → ratio 0 → `demandRatioToScore(0) = 100`, and `hasPopDataGap: false`. `demandRatioToScore(NaN)` also returns 100.
- `PopulationModule` is mocked (CLAUDE.md), and every row in dev holds `0.00`.
- **Impact:** +5 points (10% × 50) on every school, the national "Population pressure" tile reads 100, "Estimated for N schools" never shows, and the risk "Demographic pressure" factor is always Low.
- **Fix:** treat `schoolAgePopulation2km` ≤ 0 / null / NaN, or a row from the mock source, as a data gap (neutral 50 + flag). Store a `source`/`isMock` column on `population_data`.

### C-2 · Critical: missing data lands a school in the "High" priority band
- `scoring.constants.ts:44` `NEUTRAL_SCORE = 50`. The bands are Critical < 35, **High < 55**. All-neutral → 50 → HIGH, urgency 6 months.
- The resolution component makes this worse (see H-4): one PENDING report gives 48.
- **Impact:** priority counts, the donut, the decision queue and the budget mix up "unknown" with "needs intervention". 5/7 dev schools are mostly neutral.
- **Fix:** show an explicit **"Insufficient data"** priority when ≥ N weighted components are gaps (e.g. ≥ 50% of weight), or re-normalise the score over measured components only. Show coverage % next to every score.

### C-3 · Critical: scores are stale; recalculation is event-incomplete and view-driven
- Recalculation triggers are only `school.updated` (building save `schools.service.ts:529`, survey update `:649`), manual recalculation, **and `getSchoolMetrics` (a GET)**.
- **Not** triggered by: an issue report being created or changing status (resolution component), a population sync, a school status change, a change of year (age score is time-dependent), or changes to the scoring rules (e.g. the `assessedBuildings` placeholder rule).
- Evidence: Kicukiro (`c8ef`) still carries infra 70 / gap = false, from before the placeholder rule. Recomputed now: 0.35·50 + 0.25·45 + 0.1·50 + 0.1·100 + 0.15·50 + 0.05·0 = **51.25 → 51, HIGH** (stored: 58, MEDIUM). The national `byPriority` shows `{high:2, medium:5}`; it should be `{high:3, medium:4}`.
- The national average, province averages and the donut therefore depend on **which schools someone happened to open**.
- **Fix:** emit a recalculation event from report create/status change and from population sync; run a nightly `recalculateAllScores` job and once after every deploy that changes scoring; store `scoringVersion` on `decision_assessments` and flag stale rows in `verify-dashboards.ts`.

### C-4 · Critical: GET endpoints mutate state (and race)
- `getSchoolMetrics` → `calculateSchoolScore` (`analytics.service.ts:857`) on every view: it saves the assessment, runs `schoolRepository.update`, **inserts `score_history`**, and emits a websocket `scores-recalculated`.
- `GET /schools/dashboard/reporting` calls `getSchoolMetrics` again, so one page load can recalculate the same school 2–3 times in parallel.
- `decision_assessments.schoolId` has **no unique constraint** (`decision-assessment.entity.ts:30`). The upsert is `findOne` then `save` (`analytics.service.ts:1305-1330`), so concurrent first-time loads can create duplicate assessment rows. `getOverview` would then double-count them (`AVG(da.overallScore)`, `COUNT(da.id)` = "scored schools").
- `score_history` becomes a page-view log: 194 rows for one school, 119 on one day with a single distinct score. Any trend/history chart is meaningless, and `lastCalculatedAt` (`MAX(da.updatedAt)`) reflects the last view, not the last data change.
- `schoolRepository.update(...)` bypasses the audit subscriber (CLAUDE.md: prefer `save()`).
- **Fix:** make the metrics GET read-only (read the persisted assessment). Add a `UNIQUE("schoolId")` migration plus `ON CONFLICT` upsert. Write history only when the score or a component changes.

### H-1 · High: "Issue resolution" counts data-change requests and penalises reporting
- `calculateSchoolScore` (`analytics.service.ts:1218-1227`) counts **all** `issue_reports`, including `type = data_change_request` ("Request a change" filings), as unresolved issues.
- No reports gives 50, but one fresh PENDING report gives **0**. A school that reports honestly scores lower than one that never reports (48 vs 50 overall in the probe). Kigali TSS sits at resolution 0 because of a single pending report.
- FAILED and freshly-filed reports count the same as long-ignored ones.
- **Fix:** filter `type = 'issue'`; use only reports older than an SLA window (e.g. ≥ 30 days) in the denominator, or base the score on the overdue share. Keep the neutral 50 until there are at least N eligible reports.

### H-2 · High: infrastructure/age inputs differ between the score, the gaps and the dashboards
- The score uses only **assessed** buildings (`assessedBuildings`, `:1376`) for infrastructure **and** age.
- `getSchoolMetrics` computes `avgBuildingAge`, `buildingsWithYear` (→ `dataGaps.buildingAge`), `poorOrCriticalBuildingCount`, `buildingCount` (risk) and data completeness ("GIS building data": `buildings.length > 0`) over **all** buildings, placeholders included (`:885-886`, `:996`, `:1055-1060`).
- `generateRecommendations` and `estimateBudgetRwf` also use all buildings. The budget adds `ageingBlock × buildings.length` (placeholders included) and adds the survey cost only when `buildings.length === 0`. A school whose only building is a placeholder has an infra data gap but is **not** budgeted for a survey.
- `dashboard.service.ts:60-70` `healthIndex` averages **all** buildings. Its comment says it is *"identical model to analytics.service so healthIndex always matches infrastructureScore"*, which is false for placeholders. Musanze (`8fdd`): healthIndex **70**, infrastructureScore **50**.
- `METRIC_DICTIONARY.md:87` says completeness uses "assessed buildings"; the code uses any building.
- **Fix:** run `assessedBuildings()` once, in a shared helper, and feed it to every consumer.

### H-3 · High: facility compliance averages every survey row ever recorded
- `calculateFacilityComplianceScore` (`:1612-1629`) averages all rows for the school with no notion of "latest per facility item", so superseded results keep counting.
- Survey staleness / `lastSurveyDate` use `createdAt` (`:1065`, `:1147`). `updateSurveys` edits existing rows in place (`schools.service.ts:635-646`), so `createdAt` never moves: **a re-survey does not reset staleness**, and the risk probability stays at "never/old survey".
- **Fix:** score the latest row per facility item. Track `surveyedAt` (or use `updatedAt`) for staleness.

### H-4 · High: building-age model accepts impossible inputs
- `yearBuilt` (`building.dto.ts:60-63`) and `establishedYear` (`create-school.dto.ts:122-125`) have no `@Min/@Max/@IsInt`.
- Probe: future `yearBuilt` 2035 → age −9 → **score 95**. `yearBuilt` 1 → age 2025 → score 10. `ageToScore(NaN)` → **10** (all comparisons are false, so it falls through to the worst band).
- `dashboard.service.ts:394-396` uses `Number(b.yearBuilt)` without the `isFinite` filter that `averageBuildingAge` has.
- **Fix:** `@IsInt() @Min(1900) @Max(currentYear)` on both fields. Guard `ageToScore` against non-finite values (return neutral + gap).

### M-1 · Medium: inconsistent fallbacks inside `computeOverallScore`
- `scoring.constants.ts:143-148`: infrastructure/age/access/population fall back to **0** on NaN, facility/resolution to **50**. Probe: NaN infra → **33 (Critical)**, NaN facility → 50.
- **Fix:** one rule. Non-finite → neutral 50 plus a gap flag.

### M-2 · Medium: risk heuristics double-count and use one probability for everything
- `risk-assessment.ts:139-153`: the "Issues needing intervention" and "Failed repairs" factors carry the full **base impact** even when the count is 0. The overall mean is therefore inflated by factors that do not apply (healthy-school probe: both still score 2).
- One `probability` (driven 50% by building age) is applied to every factor, so building age decides the likelihood of "slow resolution times".
- `resolutionTime` uses resolved reports only. Open reports that have aged for months contribute nothing (survivorship bias). `avgResolutionDays ?? 0` treats "unknown" as "fast".
- The population factor reads "High" (score 50) when data is missing, instead of "Unknown".
- `avgBuildingAge` fed in is over all buildings (see H-2).

### L-1 · Low: misc
- `maleTeacherRatio = maleTeacherShare ?? 0` (`:877`): unknown is reported as 0% male.
- `latrineCount` reads a non-existent column (`:912`), so the student/latrine ratio is always null. Hide it or label it "not collected".
- `getScoreHistory` `months` is `parseInt` with no validation: `?months=abc` → `setMonth(NaN)` → Invalid Date in the query (500).
- No `ParseUUIDPipe` on `:schoolId` / `schoolId`: a malformed id becomes a Postgres cast error (500) instead of 400/404.
- `PATCH /analytics/actions/:id` has no scope check (the id is an action id) and an unvalidated body (`status` any string, `dueDate` any string).

---

## 4. Findings: national dashboard

### N-1 · High: three sources for "the score" on one page
- National average and component averages come from **`decision_assessments`** (`analytics.service.ts:194-222`).
- Priority counts, province avg/min/max and the hierarchy drill-down come from **`schools.overallScore / priorityLevel`** (`:152-161`, `:286-314`, `:520-613`).
- Rankings (top/bottom 5) come from **`/schools?limit=1000`** cached in Zustand for the whole session (`schoolsStore.ts:196-208`, `allSchoolsLoaded` never resets on navigation). After a recalculation the overview refreshes but the rankings do not.
- The two DB copies are synced by `calculateSchoolScore`, but any write path that bypasses it (seed, manual SQL, failed `update`) diverges silently. **Fix:** pick one (the assessment) and join it everywhere. Invalidate the store after a recalculation.

### N-2 · High: "Students" means three different things
| Where | Formula |
|---|---|
| National KPI `totalStudents` (`:225-230`, documented `METRIC_DICTIONARY.md:524`) | Σ `schools.totalStudents` |
| National capacity utilisation numerator / school dashboard (`programmeTotals`) | Σ programme students if > 0, else `schools.totalStudents` |
| Map GeoJSON `totalStudents` (`schools.service.ts:392-396`) | Σ programme students only, **0** when no programmes |
| School `mainPayload.capacityUtilization` (`dashboard.service.ts:97-106`) | Σ programme students only (no fallback) |
- With programmes filled in, the national total ≠ the sum of the school dashboards. Today, the map popups show **0 students** for all 7 schools while the KPI shows 5 380.
- `nationalCapacityUtilisation` can mix a programme-capacity denominator with a `schools.totalStudents` numerator (probe: students 500 from the column, capacity 400 from programmes → 125%).
- Nothing reconciles `maleStudents + femaleStudents` with `totalStudents`, `maleTeachers + femaleTeachers` with `totalTeachers`, or `adminStaff` with `maleAdminStaff + femaleAdminStaff`.
- **Fix:** one `programmeTotals` everywhere, the national total = Σ `programmeTotals(s).students`, plus DTO cross-field validation.

### N-3 · High: "Critical schools" spotlight shows the *least* critical ones
- `analytics.service.ts:170` `.orderBy('s.overallScore', 'DESC').take(5)`. Among Critical schools this picks the 5 **highest** scores. The worst schools are dropped once there are more than 5. **Fix:** `ASC`.

### N-4 · High: the composite shown omits a component; weights are hard-coded
- `Dashboard.tsx:365-411` lists 5 weighted factors (0.35/0.25/0.15/0.10/0.10 = **0.95**). Resolution (5%) is missing, and the overview API does not return `nationalAvgResolutionScore` at all (`:194-222`), so the shown factors cannot reproduce the shown score.
- Weights are literals in the client, contrary to `scoring.constants.ts` ("never hard-code a weight"). Band thresholds are duplicated in `IntelligenceScore.tsx:43`, `schoolMap.ts:111`, `risk-assessment.ts:125` and the server.
- **Fix:** return `weights` and `bands` from the API (or a shared constants package) and add the resolution average.

### N-5 · Medium: null averages become 0
- `parseFloat(...) || 0` for every average (`:352-365`, `:394`, `:537`). A province or district with no scored schools gets `avgScore 0`. That colours it Critical on the map and drill-down, and `generateNationalRecommendations` (`:663`) then names it "lowest average score (0)".
- `minScore/maxScore` correctly return null, so the same row shows avg 0 / min null.
- **Fix:** return `null` and render "n/a".

### N-6 · Medium: priority counts and percentages
- `byPriority` maps a null `priorityLevel` to `unassessed`, but the donut (`Dashboard.tsx:274-279`) shows only the 4 bands. Its centre total ≠ `totalSchools` when unscored schools exist, with no "Unassessed" slice.
- Donut percentages are rounded independently (`PriorityDonut.tsx:105`) and can sum to 99/101.
- `kmzCoverageRate` / `surveyCompletionRate` are rounded integers. Surveys count any row, including a single partial item.

### N-7 · Medium: national recommendations are canned
- `generateNationalRecommendations` (`:650-684`) emits two near-identical lines for the same `criticalCount` ("[URGENT] … infrastructure" and "[CRITICAL] … WASH and sanitation"). The WASH claim is not derived from any data. The "lowest province" line can fire for a province with 0 scored schools (N-5).

### N-8 · Medium: CSV export disagrees with the dashboard
- `exportNationalCsv` (`:446-502`): omits the Population and Resolution scores, writes `facilityComplianceScore ?? 0` (dashboard uses neutral 50), takes `Total Students` from the column (N-2), and would emit duplicate rows if C-4 duplicates exist. National-only, so no scope leak.

### N-9 · Low: hard-coded / client-side context
- "Rwanda · 5 provinces" is a literal (`Dashboard.tsx:286`). `mapSchools.length` counts active schools including ones with no coordinates. The client treats a missing `status` as active (`?? "active"`).
- The hero score is drawn with `Math.round` (`IntelligenceScore.tsx:68`) while the band uses the unrounded value: a national average of 74.6 shows **"75"** coloured **Medium**.

---

## 5. Findings: school dashboard

### S-1 · Critical: missing `schoolId` serves another school's data
- `dashboard.controller.ts:18-33` takes `@Query('schoolId')` with no validation. `ScopeGuard` returns `true` when the id is absent (`scope.guard.ts:61`). `findOne({ where: { id: undefined } })` **drops the condition** in TypeORM 0.3.28. Verified: it returned *"Huye Technical Secondary School"*.
- `/reporting` without an id also recalculates and returns that arbitrary school's full metrics.
- A school leader or district officer can see out-of-scope school data, and a client bug that drops the id silently shows the wrong school.
- **Fix:** `@Query('schoolId', new ParseUUIDPipe())` (required), and make `ScopeGuard` reject missing ids on `@ScopedResource` routes for scoped users.

### S-2 · High: fabricated values in `/schools/dashboard/main`
- `dashboard.service.ts:133-136` `utilities: { waterAvailability: true, powerReliability: 90 }` is constant for every school.
- `dashboard.service.ts:173-186` `trendScore: 0` and `trends.monthly/weekly` are all zeros. `perFeatureScores` lists 5 of 6 components (no resolution).
- **Fix:** return `null`/"not collected" until real columns exist, and remove the dead trend fields.

### S-3 · High: duplicate, divergent definitions between `/main`, `/reporting` and `/metrics`
| Concept | `/schools/dashboard/*` | `/analytics/schools/:id/metrics` |
|---|---|---|
| Infrastructure | `healthIndex`, all buildings | `infrastructureScore`, assessed only (H-2) |
| Age score | `ageScore`, all buildings, no NaN guard | `buildingAgeScore`, assessed only |
| Capacity | `capacityUtilization` **ratio 0–1**, programme students only, **0** when unknown | `capacityUtilisation` **percent**, with fallback, **null** when unknown |
| Avg resolution | `avgResolutionTime`, unrounded, ≤ 1000 reports, any report with `resolvedAt` | `avgResolutionDays`, 1 dp, ≤ 2000 reports |
| Report total | `resp.total` (all), but trends/status from the first 1000 | `allReports.length` (≤ 2000) |
| Facilities | buildings whose `function` contains "class"/"lab"/"dorm" (counts **buildings**, not rooms) | — |
| Land | `areaKm2 = usedLandArea × 0.01` (used land only) | `totalLandArea` = used + unused (ha) |
- `maintenanceDue` ignores buildings that were **never inspected** (`lastInspect = 0 → outdated = false`). A school with no inspections is "not due".
- `avgAge` (`dashboard.service.ts:73-79`) is computed and never used.
- **Fix:** delete the overlapping fields from `/main` and `/reporting` and render from `/metrics` only (CLAUDE.md: derived figures server-side, one definition).

### S-4 · High: report statistics semantics
- `severityFromStatus` (`dashboard.service.ts:274-286`) maps *status* to *severity*: SOLVED → "low", FAILED → "high", PENDING → "medium". Solved issues show up as "low-severity issues", and a long-pending safety hazard is "medium". There is no severity field. Either add one or rename these to status counts.
- `reportSummary.critical` = NEED_INTERVENTION count, the same mislabel.
- `resolutionRate` = SOLVED ÷ all (includes change requests and fresh reports, H-1).
- `avgResolution*` includes reports that were reopened: `updateStatus` sets `resolvedAt` on SOLVED but **never clears it** when the status moves back (`reports.service.ts:245-248`).
- `categories` counts category tags, not reports. A report tagged with two categories counts twice, so the category sum ≠ the report count. Unknown categories are dropped silently.
- All errors from `reportsService.findAll` are swallowed (`catch {}` at `:333`). A DB failure renders as "0 reports" rather than an error.

### S-5 · Medium: time and time-zone handling
- Month/week buckets use the Node process local time (`getMonth()`, `Date.now()`), not Africa/Kigali. On a UTC host, reports filed 00:00–02:00 Kigali on the 1st go into the previous month. "Weekly" buckets are rolling 24 h windows, not calendar days.
- All timestamps are `timestamp without time zone`. `createdAt` comes from the DB default (DB TZ = Africa/Kigali), while `resolvedAt = new Date()` is written in the **Node** TZ. If the prod Node TZ ≠ DB TZ, every resolution time is off by the offset, and same-day fixes can go negative. (Evidence of a mixed clock in dev: `score_history.recordedAt` max = 13:45 local while UTC was 11:45.) **Verify the prod `TZ`**, and migrate to `timestamptz`.
- `pctChange` returns **100%** for any increase from 0 (0 → 7 shows "+100%").

### S-6 · Medium: peer benchmark and completeness
- District/province averages use `schools.overallScore` (stale, C-3) and exclude the school itself, but include schools that are mostly neutral (C-2). The "delta vs district" compares measured with estimated scores.
- Data completeness (`:995-1010`) counts `buildings.length > 0` (placeholders count, see H-2) and `populationRow != null` (the mock 0 row counts, see C-1). It should agree with `dataGaps`.

---

## 6. Findings: school dashboard client (`SchoolDecisionDashboard.tsx` + `components/dashboard/*`)

### SC-1 · High: Issue-report trend chart is always empty
- `ReportingTab.tsx:102` reads `payload?.analytics?.trends?.monthly ?? reports.trends?.monthly`. The server always sends `analytics.trends.monthly = new Array(12).fill(0)` (`dashboard.service.ts:169,182`), which is not nullish, so the real `reports.trends.monthly` is never used.
- **Result:** a school with 40 reports this year sees "No reports filed in the last 12 months", and the busiest-month and 12-month tiles never render.

### SC-2 · High: Blank building condition is saved as `good`, which produces a 100 infrastructure score
- `SchoolForm.tsx:645-646` sets `condition: b.buildingCondition || "good"` and `roofCondition: … || "good"`. `assessedBuildings()` treats any condition other than `fair` as a real assessment. So a building saved with only a name scores **infrastructure 100** and carries **no data-gap flag**.
- This is the likely cause of Kigali TSS's infra = 100: its single building has `condition = good` and no other data.
- `BuildingFormDrawer.tsx:241-265` auto-fills `structuralScore` from its own condition map (100/75/50/25). The server uses 100/70/30/10. A filled `structuralScore` also makes the building count as assessed.
- The year input's `min=1900 max=2030` (`BuildingFormDrawer.tsx:474`) is never enforced, because saving is a button `onClick`, not a form submit. A year of 2099 gives "−73 years average age" and an age score of 95 (see H-4).

### SC-3 · High: One page view causes several recalculations and toasts
- `/school-dashboard` and `/schools/:id/decision` mount the page with `standalone`. That page renders SchoolMap → School2DViewer, whose default "dashboard" tab embeds a **second** dashboard instance (`School2DViewer.tsx:263,1267`).
- Both instances fetch `/metrics`, which recalculates the score (C-4), and `ReportingTab` remounts on every tab switch and calls `/reporting`, which recalculates it again.
- Each recalculation emits `scores:updated`, and the client toasts on every one (`SchoolDecisionDashboard.tsx:260-277`). Viewers get toasts on page open and on tab switches, and so does every other user who has the same school open.
- Saving an edit chains POST `/recalculate`, then GET `/metrics`, then an explicit toast, so the user sees 3 or more toasts.

### SC-4 · Medium: The embedded dashboard goes stale after an edit
- Only the outer instance refetches. The visible inner instance gets just the socket patch (overall, infra, age, access, pop).
- Facility, resolution, `dataGaps`, recommendations, risk, `reportSummary` and "scores as of" stay old, so the six "score × weight = points" tiles no longer add up to the overall score.

### SC-5 · Medium: "This month vs last month" is recomputed in the browser
- `SchoolDecisionDashboard.tsx:135-143` fetches raw `/reports?limit=1000`. `lib/issueReportMetrics.ts:125-167` then buckets those reports by the **browser's** local month.
- This breaks the server-only rule and contradicts the metric help text, which says Kigali time.
- "Resolved vs last month" compares reports *created* in each month that are now solved, not reports *resolved* in each month. A 0 → N change shows +100%.

### SC-6 · Medium: Resolution rate has three versions
| Where | Formula |
|---|---|
| ReportingTab (`ReportingTab.tsx:150-152`) | `statusCounts.solved` (≤ 1 000 rows) ÷ `generatedReportCount` (uncapped total) |
| Overview card | `reportSummary.resolutionRate` (≤ 2 000 rows) |
| Score component | uncapped `count()` |

With more than 1 000 reports, these three disagree and the status cards no longer sum to the total.

### SC-7 · Medium: Fake zeros
- `avgResolutionTime` starts at 0 and stays 0 when no report has `resolvedAt`. The client guard is `solved > 0`, so it renders **"0.0 days"**.
- When `/metrics` fails (caught to `null`), these show **0** instead of "—": open, resolved and needs-intervention reports (`SchoolDecisionDashboard.tsx:513,538,558`), and the building count (`SchoolStatsCards.tsx:92,113`).
- Missing `:id`: when `user.location.schoolId` is missing on `/school-dashboard`, `loading` is never cleared, so the page shows an **infinite skeleton** (`SchoolDecisionDashboard.tsx:95,220-225`).

### SC-8 · Low: Other client issues
- **Duplicated weights and bands:** `DecisionIntelligenceScore.tsx:49-50,74-81,98-104,338-364`, `SchoolDecisionDashboard.tsx:460` ("5% of the score"), `IntelligenceScore.tsx:42-57`, `FacilityBreakdownSection.tsx:29-34` (copy of `CONDITION_SCORE_MAP`). The school view *does* show all six components, and its weights sum to 100%.
- **Placeholder buildings shown as rated:** FacilityBreakdown shows placeholder `fair` buildings as "Fair 70%" while the score flags an infrastructure data gap.
- **"Buildings needing attention"** (`issueReportMetrics.ts:241-266`) includes buildings whose only reports are SOLVED.
- **Day counting:** `formatDaysAgo` counts 24 h blocks, not Kigali calendar days.
- **Raw enum labels:** `RiskAssessment.tsx:175,211` falls back to raw enum values instead of `label()`.
- **Unused endpoint:** `/schools/dashboard/main` is not called by the client today, so S-2 and S-3 (`/main` part) are latent. Delete the endpoint rather than fix it.

---

## 7. Input validation gaps (feed the scores)

| Field | Current | Problem | Required |
|---|---|---|---|
| `establishedYear` | `@IsNumber` only | future, negative and fractional years accepted | `@IsInt @Min(1900) @Max(currentYear)` |
| building `yearBuilt` | `@IsNumber` only | future year → age score 95 | same as above |
| building `floors`, `area` | `@IsNumber` only | negative values | `@Min(0)`, floors `@IsInt` |
| `totalTeachers`, `maleTeachers`, `femaleTeachers`, `adminStaff`, `supportStaff` | no `@Min(0)` | negative staff → teacherCount −3, STR null (probe) | `@IsInt @Min(0)` |
| students / programme `totalStudents`, `capacity` | `@Min(0)` but not `@IsInt` | fractional students | `@IsInt` |
| cross-field | none | `male+female ≠ total`, programme Σ ≠ `totalStudents`, `adminStaff ≠ male+female` | validator or server-derived totals |
| `population_data.schoolAgePopulation2km` | none | 0/mock treated as real | gap when ≤ 0 or mock |
| `schoolId` query/param | plain string | missing → wrong school (S-1); malformed → 500 | `ParseUUIDPipe` |
| `months` (history) | `parseInt` | NaN → 500 | `ParseIntPipe` + `@Min(1) @Max(60)` |
| recommendation action body | untyped | any `status` / `dueDate` | DTO with `@IsEnum`, `@IsDateString` |

---

## 8. Test-coverage gaps

- `verify-dashboards.ts` compares the service with the same SQL. Add **semantic** checks: stale assessments (recompute in memory and diff against stored), duplicate assessments per school, mock/zero population rows, `score_history` rows per school per day, and `schools.overallScore` vs `decision_assessments.overallScore`.
- `dashboard.service.spec.ts` asserts the defects (`capacityUtilization = 0`, healthIndex over unassessed buildings). Update the tests together with the fixes.
- Missing tests: all-neutral school → band; `ageToScore(NaN)` / future year; zero population; resolution with change requests; critical spotlight order; missing `schoolId` on the dashboard routes (should be 400); concurrent first-time `getSchoolMetrics` (should leave a single assessment row); GETs must not write `score_history`.
- The golden dataset (`analytics/golden/`) should include one school with only placeholder buildings and one with only mock population.

---

## 9. Recommended fix order

1. **S-1** (scope/data leak): required `ParseUUIDPipe`, and the guard rejects missing ids.
2. **C-4**: read-only GETs, unique `schoolId` + upsert, history only on change.
3. **C-1, H-1, SC-2**: population gap rule; resolution excludes change requests and uses an SLA window; a blank building condition stays null.
3b. **SC-1, SC-3**: read the real report trend; stop the duplicate embedded instance and the toasts on every view.
4. **C-3**: event-complete recalculation, nightly job, `scoringVersion`. Then **recalculate all** and re-run the verifier.
5. **C-2**: "Insufficient data" band / coverage-weighted score (needs an RTB decision).
6. **H-2, S-3, N-1, N-2**: one building set, one student/capacity definition, one score source. Delete the duplicate `/schools/dashboard/*` fields.
7. **N-3, N-4, N-5, S-2, S-4**: spotlight order, the missing component and API-driven weights, nulls not 0, remove fake values, fix the status/severity labelling.
8. Validation table (§7), then time zones (S-5).
