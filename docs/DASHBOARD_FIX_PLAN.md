# Dashboard Fix — Implementation Plan

Companion to [DASHBOARD_CALCULATION_AUDIT.md](DASHBOARD_CALCULATION_AUDIT.md). Finding ids (C-1, S-1, SC-2, …) refer to that report.

**Goal:** both dashboards show one correct, current, server-computed value per metric, clearly marked when estimated. No dashboard read mutates data, and nobody sees out-of-scope data.

**Shape:** 7 phases, each one PR to `main` (which deploys to prod on merge). Phases 1–2 are blocking; 3–6 can be parallelised after 2; 7 is clean-up. Every schema change is a migration in `server/src/migrations/` (prod runs with `synchronize: false`).

| Phase | Theme | Findings | Size | Depends on |
|---|---|---|---|---|
| 1 | Security & request validation | S-1, L-1 (UUID / months / actions body) | S | — |
| 2 | Read-only reads, single assessment row, clean history | C-4, SC-3, SC-4 | M | 1 |
| 3 | Correct component inputs | C-1, H-1, H-2, H-3, H-4, M-1, SC-2 | L | 2 |
| 4 | Recalculation completeness & staleness | C-3 | M | 2, 3 |
| 5 | One definition per metric (server) | N-1, N-2, N-3, N-4, N-5, N-6, N-7, N-8, S-2, S-3, S-4, S-6 | L | 3 |
| 6 | Client: render, don't recompute | SC-1, SC-5…SC-8, N-4 (client), N-9 | M | 5 |
| 7 | Data validation, time zones, missing-data band, tests | §7 table, S-5, C-2, M-2, §8 | M | 3; C-2 needs RTB decision |

Decisions needed before Phase 7 (ask RTB / product owner) are listed in §9.

---

## Phase 1 — Security & request validation (hotfix)

**Why first:** S-1 lets a scoped user read another school's dashboard; it's a one-day fix.

### Tasks
1. **Required, validated school ids**
   - `dashboard/dashboard.controller.ts`: `@Query('schoolId', new ParseUUIDPipe()) schoolId: string` on `main` and `reporting` (missing → 400, malformed → 400).
   - `analytics/analytics.controller.ts`: `ParseUUIDPipe` on every `:schoolId` param and on `actions/:id`.
2. **ScopeGuard fails closed** (`common/scope/scope.guard.ts:61`): on a `@ScopedResource` route, for a scoped (non-national) user, a missing id → `ForbiddenException` instead of `return true`. Unresolvable building/survey id stays a 404 from the handler.
3. **Defence in depth in services:** `DashboardService.mainPayload`, `AnalyticsService.getSchoolMetrics`, `recalculateSchoolScore` throw `BadRequestException` if `!schoolId` before calling `findOne` (TypeORM drops `undefined` conditions).
4. **`PATCH /analytics/actions/:id`:** add `UpdateActionDto` (`@IsEnum(ActionStatus)`, `@IsOptional() @IsUUID() assignedTo`, `@IsOptional() @IsDateString() dueDate`) and a scope check — load the action, then `schoolMatchesScope` on its school (new `@ScopedResource('id','params', via:'action')` resolver, mirroring `via:'building'`). Same DTO idea for `createAction` body (`@IsString() @MaxLength(500)`).
5. **`GET …/history?months=`:** `ParseIntPipe` + clamp `1..60` (default 12).

### Tests
- e2e (`test/`): `GET /schools/dashboard/main` with no `schoolId` → 400; scoped `school_leader` with another school's id → 403; malformed id → 400; `history?months=abc` → 400.
- `permission-matrix.e2e-spec.ts` keeps passing (add the action-scope case).

### Acceptance
- The read-only TypeORM probe (`findOne({id: undefined})`) is unreachable from any dashboard route.

---

## Phase 2 — Reads are read-only; one assessment per school

### 2.1 Split "calculate" from "read" (C-4)
- New `AnalyticsService.getSchoolMetrics(schoolId)` **reads** the persisted `decision_assessments` row; it never calls `calculateSchoolScore`.
  - If no row exists (school never scored) → compute **in memory** via a new pure `computeAssessment(school, inputs)` and return it with `assessment: 'provisional'`, **without persisting**. (Phase 4 guarantees rows exist; this is only a fallback.)
- Refactor `calculateSchoolScore` into:
  - `loadScoringInputs(schoolId)` — one place that loads school, buildings, latest population row, surveys, report counts.
  - `computeAssessment(inputs)` — pure, unit-testable, returns all components + gaps + recommendations + budget.
  - `persistAssessment(schoolId, result)` — upsert + school columns + history + socket event.
- `DashboardService.reportingPayload` stops calling `getSchoolMetrics`; it reads the assessment row (or is deleted in Phase 5 — see 5.4).

### 2.2 Unique assessment row (C-4)
Migration `…-UniqueAssessmentPerSchool.ts`:
1. De-duplicate: keep the newest row per `schoolId` (`DELETE … USING` on `updatedAt`).
2. `CREATE UNIQUE INDEX "UQ_decision_assessments_schoolId" ON decision_assessments("schoolId")`.
3. `persistAssessment` uses `repository.upsert(fields, ['schoolId'])` (or `INSERT … ON CONFLICT ("schoolId") DO UPDATE`), then re-reads for the audit/event payload.
4. Replace `schoolRepository.update(...)` with `save()` (audit subscriber, CLAUDE.md rule).

### 2.3 History only on change (C-4)
- `persistAssessment` writes `score_history` only when `overallScore` or any component differs from the previous row (or ≥ 24 h since the last snapshot, for a daily heartbeat — optional).
- Migration `…-PruneScoreHistory.ts`: collapse consecutive identical snapshots per school (keep the first of each run). Note in PR: it's destructive to the noise only; back up `score_history` first (see `docs/BACKUP_AND_DR.md`).
- `lastCalculatedAt` in the overview: `MAX(da.updatedAt)` now really means "last change".

### 2.4 Socket events only on real change (SC-3, SC-4)
- `persistAssessment` emits `scores:updated` only when the score changed, and the payload carries the **full** component set (`facilityComplianceScore`, `resolutionRateScore`, `dataGaps`, `priorityLevel`, `calculatedAt`).
- Client `SchoolDecisionDashboard.tsx:260-277`: on the event, **refetch `/metrics`** (debounced 500 ms) instead of patching five fields; toast only if the change wasn't initiated by this tab (track a `pendingSave` ref).
- `handleUpdateSchool` (`:231-240`): drop the explicit POST `/recalculate` (the write itself triggers recalculation after Phase 4); single toast.

### 2.5 Remove the duplicate embedded instance (SC-3)
- `School2DViewer.tsx:263,1267` mounts a second `SchoolDecisionDashboard` on its default "dashboard" tab while the standalone page already renders one. Options (pick in PR review): pass the already-loaded `metrics`/`school` down as props (`standalone={false}` → no fetching), or default the viewer to its map tab when embedded. Recommendation: props — the embedded view becomes presentational.
- `ReportingTab`: keep mounted (CSS-hide inactive tab) or cache its fetch in the parent so tab switches don't refetch.

### Tests
- Unit: `computeAssessment` takes the golden dataset cases currently run through `calculateSchoolScore`.
- e2e: `GET /analytics/schools/:id/metrics` twice → `score_history` row count unchanged; `decision_assessments` row count unchanged.
- e2e: two concurrent first-time recalculations → exactly one assessment row.

### Acceptance
- Opening a school dashboard produces zero writes (check `audit_logs` + `score_history` counts before/after).

---

## Phase 3 — Correct component inputs

All changes in `computeAssessment` / `scoring.constants.ts` / helpers; every change gets a golden-dataset case and a `METRIC_DICTIONARY.md` update.

### 3.1 Population gap rule (C-1)
- `calculatePopulationScore`: data gap when no row, **or** `schoolAgePopulation2km` is null / NaN / ≤ 0, **or** `dataSource` is the mock source. ArcGIS sync (`population.service.ts:164-195`) writes `0` when the query returns no features — make it write `null` instead and set `dataSource`.
- `demandRatioToScore`: non-finite ratio → caller treats as gap (never 100).
- Migration/backfill: `UPDATE population_data SET "schoolAgePopulation2km" = NULL WHERE "schoolAgePopulation2km" = 0`.

### 3.2 Resolution component (H-1)
- Count only `type = 'issue'` reports (exclude `data_change_request`).
- Eligible denominator = issue reports older than `RESOLUTION_SLA_DAYS` (new constant, default 30) **or** already SOLVED. Score = solved ÷ eligible × 100.
- `< RESOLUTION_MIN_REPORTS` (default 3) eligible reports → neutral 50 + `resolution` gap.
- `reports.service.ts:245-248` `updateStatus`: clear `resolvedAt` when status leaves SOLVED; set it when entering SOLVED (always, not only if empty — a re-solve gets a new date).
- Same filter in `reportSummary` (Phase 5 moves it to SQL).

### 3.3 One "assessed buildings" set (H-2, SC-2)
- Move `assessedBuildings()` to `school-metrics.helpers.ts` (exported, pure). Use it in: infra score, age score, `avgBuildingAge`, `dataGaps.buildingAge`, risk inputs (`buildingCount`, `poorOrCriticalBuildingCount`, `avgBuildingAge`), completeness, recommendations, budget (survey cost when `assessed.length === 0`; ageing cost × `assessed.length`), `FacilityBreakdown` payload.
- **Make `condition` nullable** — migration `…-BuildingConditionNullable.ts`: `ALTER COLUMN condition DROP DEFAULT, DROP NOT NULL` (same for `roofCondition`). New rule: assessed ⇔ `condition IS NOT NULL` or any of the other inventory signals. `CONDITION_SCORE_MAP[null]` is not used (unassessed buildings are excluded).
  - Backfill: set `condition = NULL` where the row matches the placeholder signature (condition `fair`, roof `good`, every inventory field null). Rows with `good` and nothing else (the `SchoolForm` default — Kigali TSS) are ambiguous: list them in the PR for the GIS team to confirm rather than nulling blindly (see §9 D-3).
- Client `SchoolForm.tsx:645-646`: send `null` when blank (no `|| "good"`). `BuildingFormDrawer.tsx:241-265`: remove the client `structuralScore` auto-fill (different map from the server); `structuralScore` is entered or left empty.

### 3.4 Facility compliance = latest per item (H-3)
- Score the latest row per `(schoolId, facility item)` (check `school-facility-survey.entity.ts` for the item key; use `DISTINCT ON`).
- Add `surveyedAt timestamptz` (migration, backfill from `updatedAt`); `updateSurveys` sets it on every change. Staleness, `lastSurveyDate`, survey coverage use `MAX(surveyedAt)`.

### 3.5 Building-age robustness (H-4, M-1)
- `ageToScore`: non-finite → caller treats as gap; ages < 0 are rejected upstream (validation, Phase 7) and filtered here (`age >= 0`).
- `computeOverallScore`: every component uses the same fallback — non-finite → `NEUTRAL_SCORE` (and the caller sets the gap flag). Remove the 0-fallback for infra/age/access/pop.
- `dashboard.service.ts calculateAgeScore` is deleted in Phase 5 (duplicate).

### Tests
- Golden cases: mock population (0) → pop 50 + gap; one pending report → resolution 50 + gap (not 0); change requests ignored; placeholder-only buildings → infra gap, survey budget; future `yearBuilt` filtered; NaN infra → 50 not 0; re-survey resets staleness.
- Update `dashboard.service.spec.ts` / `analytics.service.spec.ts` assertions that encoded the old behaviour.

---

## Phase 4 — Recalculation completeness

### 4.1 Event coverage (C-3)
Emit `school.updated` (or a new `school.scoring-input-changed`) from every write that feeds the score:

| Source | File | Today |
|---|---|---|
| School edit (students, programmes, road %, established year, status) | `schools.service.ts update()` (~:209) | **no event** |
| Building create/update/delete | `schools.service.ts:529` (+ create/delete paths) | update only |
| Survey update | `schools.service.ts:649` | yes |
| Issue report create / status change / delete | `reports.service.ts` | **no event** |
| Population sync | `population.service.ts` cron | **no event** — recalc in bulk after sync |
| KMZ/GLB upload creating buildings | `kmz.service.ts` | check, add |

- The `@OnEvent` handler debounces per school (e.g. 2 s) so bulk writes recalc once.
- School status → non-active: keep the assessment but it's already excluded by `whereActiveSchool`; status → active: recalc.

### 4.2 Scheduled + versioned scoring
- Add `SCORING_VERSION` constant in `scoring.constants.ts`; column `decision_assessments.scoringVersion int` (migration).
- Nightly `@Cron('15 3 * * *')` `recalculateAllScores` (age component is time-dependent; also catches missed events).
- On boot: if any active assessment has `scoringVersion < SCORING_VERSION`, enqueue a full recalculation (BullMQ queue exists — use it rather than blocking boot).
- Bump `SCORING_VERSION` in this PR so Phases 3's rules apply to every school on deploy.

### 4.3 Verifier upgrade (§8)
`scripts/verify-dashboards.ts` adds semantic checks (non-zero exit on failure, run in the deploy health gate after migrations):
- recompute each active school in memory with `computeAssessment` and diff against the stored row (stale detection);
- duplicate assessments per school; `schools.overallScore ≠ decision_assessments.overallScore`;
- population rows with `≤ 0` counted as data; `score_history` rows per school per day > N;
- assessments with `scoringVersion < current`.

### Acceptance
- After deploy + recalc, verifier passes; Kicukiro VTC (dev) reads 51/High (or whatever Phase 3 rules yield) and `byPriority` matches a manual recount.

---

## Phase 5 — One definition per metric (server)

### 5.1 One score source (N-1)
- `decision_assessments` is the source of truth. Overview queries for priority counts, province/district stats and hierarchy join `decision_assessments` (as the averages already do) instead of `schools.priorityLevel/overallScore`. Keep the `schools` columns as a denormalised cache written only by `persistAssessment` (map/list sorting), and have the verifier check them.

### 5.2 One students/capacity definition (N-2, S-3)
- `programmeTotals()` is the only definition. National `totalStudents` = Σ `programmeTotals(s).students` (compute in JS over the same rows already loaded for capacity, query 13). Map GeoJSON (`schools.service.ts:392-401`) uses `programmeTotals`. `nationalCapacityUtilisation` only counts schools where students come from programmes too (no column/programme mix), or document the mix — pick the former.
- Update `METRIC_DICTIONARY.md` `national.totalStudents`.

### 5.3 Overview corrections (N-3 … N-8)
- Critical spotlight: `ORDER BY overallScore ASC` (N-3).
- Add `nationalAvgResolutionScore` and return `weights` + `bands` from `scoring.constants.ts` in the overview payload (N-4).
- Averages: `null` when no scored rows, never `|| 0` (N-5) — in `getOverview`, `getHierarchy`, province stats; `generateNationalRecommendations` skips provinces with null avg.
- `byPriority` always returns `{critical, high, medium, low, unassessed}` (N-6).
- National recommendations: drop the duplicate "[CRITICAL] … WASH" line; derive lines from actual component weaknesses (e.g. lowest national component, compliance gaps count) (N-7).
- CSV export: add Population + Resolution scores and gap flags; neutral not 0; students via `programmeTotals` (N-8).

### 5.4 Retire `/schools/dashboard/*` duplication (S-2, S-3, S-4)
- `/schools/dashboard/main` is unused by the client → **delete** endpoint, DTO and spec (removes fake `powerReliability: 90`, `waterAvailability: true`, ratio-vs-% capacity, `healthIndex`, `maintenanceDue`, `areaKm2`).
- `/schools/dashboard/reporting` → reduce to report analytics only, computed with SQL aggregates (no 1000-row cap, no swallowed errors):
  - status counts, category counts (documented as "tag counts" — a report can have several), monthly series (12 Kigali months) with labels, month-over-month comparison of **created** and of **resolved** (by `resolvedAt` month), avg resolution days (null when none), resolution rate (Phase 3.2 rule).
  - Remove `analytics.trends` placeholder, `trendScore`, `perFeatureScores`, `decisionAssessment` (the client has `/metrics`).
  - Rename `severityFromStatus` / `critical/high/medium/low` → status counts (S-4); the UI labels by status. If RTB wants real severity, that's a new `issue_reports.severity` column (§9 D-4).
- `reportSummary` in `/metrics` uses the same SQL helper (one function, `reports-metrics.helpers.ts`), so Overview card, Reporting tab and score component agree.

### 5.5 Peer benchmark & completeness (S-6)
- District/province averages over active, **non-provisional** assessments, and return `peerCount`; delta is null when `peerCount < 3`.
- Completeness checklist derives from `dataGaps` + identity fields (assessed buildings, real population), matching the dictionary.

---

## Phase 6 — Client renders, never recomputes

| Task | Files | Finding |
|---|---|---|
| Trend chart reads `reports.trends.monthly` (+ server labels) | `ReportingTab.tsx:102,143-145` | SC-1 |
| Resolution rate, status totals, avg resolution from server fields; delete local `Math.round(resolved/total)` | `ReportingTab.tsx:104,150-152` | SC-6, SC-7 |
| "This month vs last month" from server `monthComparison`; delete browser bucketing + `/reports?limit=1000` fetch | `SchoolDecisionDashboard.tsx:135-143`, `lib/issueReportMetrics.ts:125-167` | SC-5 |
| "Buildings needing attention" from server (exclude SOLVED) or filter SOLVED locally as a stop-gap | `issueReportMetrics.ts:241-266` | SC-8 |
| No school assigned → explicit empty state, not a skeleton | `SchoolDecisionDashboard.tsx:95,220-225` | SC-7 |
| `null` → "—" everywhere a metric is missing (report counts, building count, avg resolution) | `SchoolDecisionDashboard.tsx:513,538,558`, `SchoolStatsCards.tsx:92,113` | SC-7 |
| Weights/bands from API payload (`weights`, `bands`, `priorityLevel`); delete local copies | `Dashboard.tsx:365-411`, `IntelligenceScore.tsx:42-57`, `DecisionIntelligenceScore.tsx:49-104,338-364`, `schoolMap.ts:111`, `FacilityBreakdownSection.tsx:29-34`, `SchoolDecisionDashboard.tsx:460` | N-4, SC-8 |
| National panel shows 6 components incl. resolution | `Dashboard.tsx` | N-4 |
| Hero score: band from server `priorityLevel`/unrounded value, display via `formatScore` consistently | `IntelligenceScore.tsx:68,96` | N-9 |
| Donut: "Unassessed" slice; percentages via largest-remainder so they sum to 100 | `PriorityDonut.tsx:37,105` | N-6 |
| Rankings refresh after recalculation (`invalidateAllSchools()` on `scores:updated` / recalc) | `schoolsStore.ts:196-208`, `Dashboard.tsx` | N-1 |
| Province count from data, not literal "5 provinces"; map count = schools with coordinates | `Dashboard.tsx:286` | N-9 |
| Unassessed buildings shown as "Not assessed", not "Fair 70%" | `FacilityBreakdownSection.tsx` | SC-8 |
| Enum fallbacks via `label()`; `formatDaysAgo` uses Kigali calendar days (`lib/format.ts`) | `RiskAssessment.tsx:175,211`, `issueReportMetrics.ts:340-346` | SC-8, S-5 |

Tests: Vitest for `ReportingTab` (non-zero trend renders), donut sum = 100, missing-metrics renders "—", no-school empty state. Update `dashboard-components.test.tsx`.

---

## Phase 7 — Validation, time zones, missing-data policy, risk

### 7.1 Input validation (§7 of audit)
- `establishedYear`, building `yearBuilt`: `@IsInt() @Min(1900) @Max(new Date().getFullYear())` (custom `@MaxCurrentYear()` decorator so it doesn't freeze at build time).
- Staff fields (`totalTeachers`, `male/femaleTeachers`, `adminStaff`, `supportStaff`): `@IsInt() @Min(0)`; programme `totalStudents`/`capacity`, students: `@IsInt()`.
- Building `floors` `@IsInt() @Min(0)`, `area` `@Min(0)`.
- Cross-field: a class-level validator `@ConsistentTotals()` — if both breakdown and total are sent and disagree → 400 with a clear message; if only breakdown is sent, server derives the total. Decide per pair (§9 D-5).
- Client: `BuildingFormDrawer` / `SchoolForm` run the same rules before save (button `onClick` currently bypasses `min/max`).
- Data clean-up query listed in PR for existing out-of-range rows (report, don't auto-fix).

### 7.2 Time zones (S-5)
- Migration: convert `timestamp without time zone` columns used in metrics (`issue_reports.createdAt/resolvedAt`, `score_history.recordedAt`, `decision_assessments.*At`, surveys) to `timestamptz` using `AT TIME ZONE 'Africa/Kigali'` (dev evidence: DB TZ = Kigali). **Before writing it, confirm prod Node `TZ` and DB `TimeZone`** — if they differ, `resolvedAt` values already carry the offset error and need a corrected conversion (§9 D-6).
- Set `TZ=UTC` for the Node process and pin the pg session `timezone=UTC`; all month/day bucketing in SQL with `AT TIME ZONE 'Africa/Kigali'` (`date_trunc('month', "createdAt" AT TIME ZONE 'Africa/Kigali')`).
- `pctChange` from 0: return `null` ("new") instead of +100%.

### 7.3 Missing-data policy (C-2) — needs RTB decision D-1
Implement whichever RTB picks; recommended default:
- **Coverage** = Σ weights of components that are measured (not gap). Return `coverage` (0–1) with every score.
- If `coverage < 0.5` → priority `insufficient_data` (new enum value, migration), excluded from band counts and the decision queue's urgency order, shown as its own donut slice and filter; budget = survey cost only.
- Otherwise score as today (neutral 50 for the remaining gaps), with the coverage shown next to the score.
- Alternative (if RTB prefers): re-normalise the weighted score over measured components only.

### 7.4 Risk heuristics (M-2)
- Factors with count 0 (`needsIntervention`, `failedRepairs`) → impact 0, excluded from the overall mean.
- Per-factor probability: infra/age factor uses age + staleness; resolution factor uses share of overdue open reports; population factor `level: 'unknown'` when gap.
- `resolutionTime` uses open-report age too (oldest open / median open age), `avgResolutionDays` null → "unknown", not 0.
- Update `RISK_RULES` text + dictionary `risk.*`.

### 7.5 Remaining clean-up (L-1)
- `maleTeacherRatio` → remove (keep `maleTeacherShare`, null when unknown).
- `latrineCount` / `studentToLatrineRatio`: return null with `notCollected: true`; client hides the tile.

---

## 8. Rollout

1. Each phase: PR → CI (`server: lint, test, test:e2e on throwaway DB`; `client: build, test`) → merge → auto-deploy.
2. Phases with migrations (2, 3, 4, 7): take a DB backup first (`BACKUP_AND_DR.md`); migrations must be idempotent and run before the app restarts (existing deploy pipeline pre-flight).
3. After Phases 3 and 4 deploy: run `POST /analytics/recalculate` (or the boot-time version check does it), then `verify-dashboards.ts`; attach before/after national KPIs to the PR — **expect visible changes** (population average drops from 100, some schools move bands). Brief RTB before Phase 3/4 go live so the shift isn't read as a regression.
4. Update `docs/METRIC_DICTIONARY.md`, `docs/GLOSSARY.md` and the in-app `<MetricInfo>` text in the same PR as each formula change.

## 9. Decisions needed

| Id | Question | Recommendation | Blocks |
|---|---|---|---|
| D-1 | How to treat schools with mostly missing data? | `insufficient_data` band below 50% weight coverage | Phase 7.3 |
| D-2 | Resolution: SLA window and minimum report count | 30 days, ≥ 3 eligible reports | Phase 3.2 |
| D-3 | Existing buildings with only `condition = good` (form default): treat as assessed or reset to unassessed? | Reset, after GIS team review of the list | Phase 3.3 backfill |
| D-4 | Do reports need a real severity field? | Yes, as a later feature; Phase 5 relabels to status | Phase 5.4 |
| D-5 | Totals vs breakdowns (students, teachers, staff): which is authoritative? | Breakdown → server-derived total | Phase 7.1 |
| D-6 | Prod Node `TZ` and DB `TimeZone` | Check on the EC2 box before 7.2 | Phase 7.2 |

## 10. Definition of done
- Audit findings each mapped to a merged PR or explicitly deferred with reason.
- `verify-dashboards.ts` (semantic version) passes in prod.
- No dashboard GET writes to the DB (e2e enforced).
- Every displayed metric has exactly one server formula, documented in `METRIC_DICTIONARY.md`, and the client contains no weights, bands, or metric arithmetic.

---

## 11. Implementation status (2026-10-21, branch `fix/dashboard-calculations`)

### Plan corrections found while implementing
- **H-3 was half wrong.** `school_facility_surveys` is already unique per (school, facility, item), so compliance already uses one result per item. Only the staleness part was real. It is fixed with the existing `inspectedAt` column (stamped on every survey update), so no new column was needed.
- **The ScopeGuard cannot fail closed on every missing id.** `AnalyticsController` puts a class-level `@ScopedResource('schoolId','params')` on list routes that have no such param. The guard now fails closed only for **query** ids, and it rejects non-uuid ids before they reach Postgres.
- **Score history now really records only changes.** The verifier found that Postgres `jsonb` reorders object keys, so a naive `JSON.stringify` comparison saw a change on every rescore. `dataGaps` is now compared key by key.
- **More recalculation gaps than the audit listed.** School create and update, building add and remove, survey initialisation and item updates, every report write, population sync and KMZ building replacement all failed to emit `school.updated`. All of them now do, and bursts for the same school coalesce into one rescore.
- **More fabricated building defaults on the client than the audit listed.** Besides `SchoolForm`, the 2D draw tool (condition good, structural score 100, year = this year), the 3D "add building" draft (fair, score 0, this year), `BuildingsStep` and `useSpatialDataSync` all invented values. The viewers' save mapping also sent `|| 0` for blank years and scores. `lib/buildingPayload.ts` now sends blanks as null. On the server, empty strings no longer count as an assessment signal.

### Done
| Phase | Delivered |
|---|---|
| 1 | Required `ParseUUIDPipe` ids. ScopeGuard fails closed for query ids, does a uuid shape check and resolves `action` ids. DTO validation for recommendation actions. `months` must be 1–60. |
| 2 | Pure `scoring-engine.ts`. Read-only `getSchoolMetrics` (serves the stored assessment; computes a provisional score only when none is stored). Unique `schoolId` index, plus a retry on unique violation. History and socket events only on change. The client refetches on `scores:updated` (debounced, one toast). The standalone page shell no longer loads analytics, so the embedded dashboard is the only loader. The Issue Reports tab stays mounted. |
| 3 | Population: values ≤ 0, null or NaN count as a gap, and the sync stores null when ArcGIS has no data. Resolution: Issue Reports only, a 30-day SLA, at least 3 eligible reports, and `resolvedAt` cleared when a report is reopened. One `assessedBuildings()` rule used everywhere, and `condition` / `roofCondition` are nullable with no default. Building age ignores future and invalid years. One NaN fallback (neutral) for every component. Recommendations and budget are driven by measured weaknesses, never by neutral components. |
| 4 | Complete event coverage. Nightly rescore at 03:15 Kigali. Rescore on boot of missing or pre-`SCORING_VERSION` rows. The verifier adds semantic checks: stale, outdated and duplicate assessments, cache drift, zero-population rows, reopened reports that still have a date, and repeated snapshots. |
| 5 | Overview, hierarchy and province stats read `decision_assessments`. `byPriority` always has every band plus `unassessed`. The critical spotlight sorts ASC. Averages are null rather than 0. National students use the `programmeTotals` rule (the same as the school dashboard and map). Capacity utilisation uses programme data only. Added the resolution average, average data coverage, per-component gap counts and `scoringModel`. Data-driven national recommendations replace the old duplicated WASH line. The CSV export gains the population, resolution, coverage and gap columns. `/schools/dashboard/main` is removed. `/reporting` is rebuilt on `report-stats.ts`: uncapped, Issue Reports only, Kigali months with labels, filed and resolved comparison, buildings needing attention, and errors propagated. Peer averages need ≥ 3 peers. |
| 6 | The client renders server figures only: trends, resolution, the month comparison and the attention list. `lib/scoring.ts` is the single client copy of bands and weights (from `scoringModel`). The national panel shows all six factors and coverage. The aggregate is shown to 1 dp. The donut has a "Not assessed" slice and largest-remainder percentages. Rankings refetch on every visit. Unknown values show "—". A user with no assigned school sees an empty state instead of an infinite skeleton. Days are counted in Kigali time. Metric help is updated and `METRIC_DICTIONARY.md` regenerated from it. |
| 7 (partial) | `@IsPlausibleYear` on build and establishment years, integer ≥ 0 headcounts, ranges for floors, area and structural score (also enforced in the building drawer). Risk: factors that don't apply score 0 and are excluded from the mean, missing data reads "unknown", observed issues use probability 100, and the age of open reports counts. Postgres session time zone is pinned to the Node process zone. `maleTeacherRatio`, the latrine fields and `depreciation` are removed. |

### Migration `1788470000000-DashboardScoringV2` (idempotent)
Dedupes assessments and adds the unique index. Adds `dataGaps`, `dataCoverage` and `scoringVersion` (0, so every school is rescored on boot). Makes building `condition` and `roofCondition` nullable and nulls the pure placeholder rows. Sets zero population to null. Clears `resolvedAt` on reports that are not SOLVED. Collapses repeated history snapshots. In dev this pruned 367 → 31 history rows, 2 placeholder buildings and 8 zero-population rows.

### Verification
- Server: 539 unit tests and 49 e2e tests pass (3 suites, including the generated permission matrix and the new `dashboard.e2e-spec.ts`) on a fresh `rtb_gis_test`. `tsc` and lint are clean on the touched files.
- Client: 127 tests pass, `tsc` and `vite build` pass, and the touched files add no new lint errors.
- `verify-dashboards.ts` on the dev DB and on the seeded test DB: **zero KPI diffs, integrity OK**.
- Dev before → after: national average 58.4 → **53.1**, population average 100 → **50** (7/7 are now gaps), priority `{high 2, medium 5}` → **`{high 6, medium 1}`**, average data coverage **0.32**. Six of seven schools have 25 % coverage.

### Deferred (needs a decision)
- **D-1:** the "Insufficient data" band. Coverage is now computed, stored and shown everywhere, but the band itself is RTB's call.
- **D-3:** existing buildings whose only data is `condition = good` (the old form default; Kigali TSS in dev) are left as assessed until the GIS team reviews them.
- **D-5:** cross-field total/breakdown validation. Only per-field rules are in place.
- **D-6:** the `timestamptz` migration. The session time zone is now pinned, but check the prod Node `TZ` and DB `TimeZone` before converting stored values.
- **Real issue severity (D-4):** reports are still labelled by status.

### Found while testing, outside this plan
- `POST /schools/:id/buildings` without `name` returns 500 (DB NOT NULL) instead of 400, and does not check that the school exists.
- A KMZ re-upload deletes and replaces **all** building rows for the school, including assessed ones (`kmz.service.ts` `buildingRepository.delete({ schoolId })`).
- `initializeSurvey` creates every item as NON_COMPLIANT before anyone inspects it, so facility compliance drops to 0 the moment a survey is started.
