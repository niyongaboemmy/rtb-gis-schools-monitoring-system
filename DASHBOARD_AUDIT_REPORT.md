# Dashboard Audit Report
## RTB GIS Schools Monitoring & Intelligence System

**Prepared by:** Senior Business Analyst & Statistician Review  
**Date:** 2026-06-05  
**Scope:** National System Overview Dashboard (`Dashboard.tsx`) and School Decision Dashboard (`SchoolDecisionDashboard.tsx` + supporting components)  
**Methodology:** Static code analysis of all dashboard components, analytics service logic, and scoring formulas

---

## Executive Summary

Both dashboards present significant calculation gaps, hardcoded values masquerading as live data, and missing key performance indicators critical for TVET infrastructure governance. The National Dashboard displays four metrics that are entirely static (never fetched from the database), and the School Dashboard contains at least three display metrics whose source values are never populated. The scoring model also excludes `facilityComplianceScore` from the overall composite despite displaying it prominently as a driver. These issues undermine the credibility and decision-support value of the platform.

---

## Part I — National System Overview Dashboard

### 1.1 Calculation Gaps & Errors

#### 1.1.1 Aggregate Score Formula Is Statistically Unsound

**Location:** `client/src/pages/Dashboard.tsx`, lines 98–101

```js
const aggregateScore = Math.min(
  100,
  Math.round((low * 90 + high * 40 + critical * 10) / total),
);
```

**Problems:**
- The formula assigns arbitrary fixed point values (90 / 40 / 10) to priority buckets and divides by total school count. This has no statistical grounding — it is not a weighted average of actual scores, it is a synthetic proxy that can be easily gamed by changing thresholds.
- **Medium-priority schools are silently excluded** from the numerator entirely (no `medium` bucket in the sum), yet they are counted in `total`. This causes systematic underestimation of the aggregate score as the unaccounted medium schools lower the denominator without contributing numerator points.
- The correct approach is to compute a true weighted mean of `overallScore` across all schools from the database, which is already available.
- **Recommended fix:** `aggregateScore = AVERAGE(overallScore) across all schools` — computed server-side and returned by `/analytics/overview`.

#### 1.1.2 Four of Five National Intelligence Metrics Are Hardcoded

**Location:** `client/src/pages/Dashboard.tsx`, lines 160–170

```js
metrics={[
  { label: "Buildings Health",       score: aggregateScore + 5, icon: Building2 },
  { label: "Buildings Depreciation", score: 68,                  icon: MapPin },
  { label: "Students Population",    score: 72,                  icon: Users },
  { label: "School Accessibility",   score: 84,                  icon: ClipboardCheck },
  { label: "Facility Compliance",    score: 84,                  icon: ClipboardCheck },
]}
```

**Problems:**
- `Buildings Depreciation`, `Students Population`, `School Accessibility`, and `Facility Compliance` are all hardcoded to `68`, `72`, `84`, and `84` respectively. These numbers bear no relationship to the real data.
- `aggregateScore + 5` can exceed 100 (no `Math.min(100, ...)` guard). If `aggregateScore` is 97, `Buildings Health` displays as 102%.
- These metrics create a false impression of analytical depth while displaying made-up numbers.

#### 1.1.3 National Recommendations Contain Hardcoded Facts

**Location:** `client/src/pages/Dashboard.tsx`, lines 175–180

```js
recommendations={[
  `[URGENT] ${stats?.byPriority?.critical || 0} schools require immediate infrastructure intervention.`,
  "[STRATEGIC] Expand GIS mapping to rural sectors in the Northern province.",
  "[CRITICAL] Low student-to-latrine ratios detected in 12 high-priority schools.",
]}
```

**Problems:**
- The second recommendation specifies "Northern province" as the GIS gap. This is hardcoded — it may or may not be accurate at any given time.
- The third recommendation cites "12 high-priority schools" as a hardcoded integer. This never updates.
- Only the first recommendation dynamically incorporates real data (`stats.byPriority.critical`).

#### 1.1.4 "LIVE MONITORING ENABLED" Badge Is False

**Location:** `client/src/pages/Dashboard.tsx`, line 119

The National Dashboard displays an animated green dot with "LIVE MONITORING ENABLED" but contains **no WebSocket or polling mechanism**. Data is fetched once on mount (`fetchedRef.current` prevents re-fetching). The badge creates an expectation of real-time updates that does not exist in this component.

#### 1.1.5 Medium Priority Schools Are Invisible

The KPI row shows: Total | Critical | High | Optimal (Low). **Medium-priority schools are never counted or displayed.** An operator reviewing the national dashboard cannot tell how many schools fall into the medium priority band — the largest category for many TVET systems.

---

### 1.2 Missing Information — National Dashboard

| # | Missing Metric | Business Importance | Data Availability |
|---|---|---|---|
| 1 | **Total national enrollment** (sum of all students) | Core TVET planning metric | Available via analytics service |
| 2 | **Total national teaching staff** | Workforce planning | Available via school entity |
| 3 | **National average overall score** (arithmetic mean) | Replaces flawed aggregate formula | Computed from existing `overallScore` |
| 4 | **Medium-priority school count** | Missing priority band | Available via `byPriority.medium` |
| 5 | **KMZ coverage rate** (% schools with GIS data) | Platform adoption indicator | Derivable from `kmzStatus` field |
| 6 | **% schools with complete survey data** | Data quality governance | Derivable from `SchoolFacilitySurvey` table |
| 7 | **Total estimated rehabilitation budget (RWF)** | Financial planning | Available via `estimatedBudgetRwf` on assessments |
| 8 | **Score trend** (month-over-month change in average score) | Progress monitoring | Requires timestamp-based history |
| 9 | **Schools with no building data** | Data completeness alarm | Derivable from `buildings` relation |
| 10 | **Data freshness** (timestamp of last score recalculation) | Trust in displayed values | Available from `DecisionAssessment.updatedAt` |
| 11 | **Provincial average score** (not just counts) | Benchmarking | Derivable from existing scores |
| 12 | **School type distribution** (TVET A/B/C, satellite, etc.) | Sector-level planning | Available via `type` field |

---

### 1.3 Professional Dashboard Structure Issues — National

| Issue | Description |
|---|---|
| **No drill-down hierarchy** | Cannot navigate from Province → District → School from the national view. Only a flat list of top/bottom 5 schools is shown. |
| **No time-period filter** | Dashboard is always "current state." No week/month/quarter toggle. |
| **No data export** | Despite `EXPORT_REPORTS` permission existing in the system, no export button is present. |
| **No benchmarking reference** | No target line or national standard shown. What does a "good" aggregate score mean? |
| **No map integration** | The national map exists at `/map` but is completely decoupled from the national overview. No embedded minimap or geographic distribution heatmap. |
| **Provincial table lacks context** | Shows count of critical/high schools per province but not their share of provincial total or scores. |
| **Top/Bottom 5 not configurable** | Fixed to 5 schools. No ability to see Top 10, Top 20. No province filter. |
| **No accessibility alternative to color coding** | Critical/High/Low/Optimal status is entirely communicated via color with no icon differentiation for color-blind users. |

---

## Part II — School Decision Dashboard

### 2.1 Calculation Gaps & Errors

#### 2.1.1 `facilityComplianceScore` Excluded from Overall Score

**Location:** `server/src/modules/analytics/analytics.service.ts`, lines 339–341

```js
const overallScore = Math.round(
  infraScore * 0.40 + ageScore * 0.30 + accessScore * 0.15 + popScore * 0.15,
);
```

`facilityComplianceScore` is computed (via `calculateFacilityComplianceScore`) and saved to `SchoolMetricsDto`, and it is displayed as one of six breakdown metrics in `DecisionIntelligenceScore`. However, **it contributes 0% weight to the actual `overallScore`**. The dashboard therefore shows a composite that doesn't match the breakdown it displays. Either the score formula must incorporate it (reducing other weights) or it must be clearly labelled as a supplementary indicator.

Furthermore, the comment at line 309 reads `// Infrastructure score (30%)` but the formula gives it **40%** — the comment is wrong.

| Component | Stated Weight | Actual Weight |
|---|---|---|
| Infrastructure Score | 30% (comment) | **40%** |
| Building Age Score | 30% | 30% |
| Accessibility Score | 15% | 15% |
| Population Pressure Score | 15% | 15% |
| Facility Compliance Score | Displayed | **0%** |

#### 2.1.2 `resolutionRate` Always Shows 0% in Score Breakdown

**Location:** `client/src/components/dashboard/DecisionIntelligenceScore.tsx`, line 218

```js
{ label: "Resolution rate", score: assessment.resolutionRate ?? 50, icon: CheckCircle2 },
```

`assessment` is the `calculatedAssessment` object from the school API response. This object comes from `DecisionAssessment` entity and `SchoolMetricsDto` — **neither of which contains a `resolutionRate` field**. The `resolutionRate` lives in `reportingData` (from the issue reports rollup), which is a separate data structure passed to different components. The fallback `?? 50` means this metric always shows 50% unless the property happens to exist, which it never does from the current data flow.

#### 2.1.3 `urgencyMonths` Is Never Calculated

**Location:** `server/src/modules/analytics/analytics.service.ts`, lines 354–377

`urgencyMonths` appears in the `DecisionAssessment` entity and is displayed as "Decision urgency" in `DecisionIntelligenceScore.tsx`. However, the `calculateSchoolScore()` method never computes or assigns `urgencyMonths`. It is always `null`, causing the UI to display `-- mo`. This metric has been wired up for display but has no computation backing it.

#### 2.1.4 Hardcoded Static Values Presented as Live Data

**Location:** `client/src/pages/SchoolDecisionDashboard.tsx`, lines 493–519

| Field | Hardcoded Value | Problem |
|---|---|---|
| Benchmark | `+12.4%` | Never computed; means nothing |
| Reliability | `88%` / 4 bars | Hardcoded visual decoration |
| Sync latency | `42ms` | Static string; not a real measurement |

These appear in the dashboard header styled as live telemetry data, which misleads operators into believing the system is showing real-time network/performance metrics.

#### 2.1.5 Population Pressure Score Semantics Are Inverted and Unclear

**Location:** `server/src/modules/analytics/analytics.service.ts`, lines 441–455

```js
// Higher = lower demographic pressure (more capacity headroom = healthier)
if (ratio >= 5) return 10;   // 5× demand vs capacity → score 10 (bad)
if (ratio >= 3) return 30;
if (ratio >= 2) return 50;
if (ratio >= 1) return 70;
return 100;                   // demand < capacity → score 100 (good)
```

The score is inverted — **high score = low pressure** — but the UI label is "Demographic load" in `DecisionIntelligenceScore` and "Students Population" in the national dashboard metrics. Users seeing a high "Demographic load" score (e.g., 90%) would logically interpret it as a heavy load, when it actually means the school has significant spare capacity. The label must be changed to "Capacity headroom" or "Demographic resilience," or the score direction must be flipped and the formula clearly documented.

Additionally, when no `PopulationData` record exists, the score defaults to `50` (neutral), meaning schools with **no population data are indistinguishable from schools with moderate population pressure**. A data-absent flag should be separate from a scored value.

#### 2.1.6 Infrastructure Score Defaults to 50 When No Buildings

**Location:** `server/src/modules/analytics/analytics.service.ts`, line 401

```js
if (!buildings || buildings.length === 0) return 50;
```

A school with zero building records should not receive a neutral infrastructure score. Missing building data is itself a data quality problem and likely indicates the school either has unrecorded buildings (risk: unknown actual conditions) or has genuinely no permanent structures (high risk). Both cases warrant a score below 50, or a clear "no data" flag that prevents contribution to the composite.

#### 2.1.7 Building Age Score Has No Granularity for Old Structures

**Location:** `server/src/modules/analytics/analytics.service.ts`, lines 435–438

```js
if (avgAge <= 10) return 95;
if (avgAge <= 20) return 80;
if (avgAge <= 30) return 60;
return 40;   // anything older than 30 years — all scored equally
```

A building with an average age of 31 years receives the same score as a building with an average age of 80 years. For TVET infrastructure assessment, the difference between a 35-year-old building and a 70-year-old building is substantial in terms of structural risk, maintenance cost, and renovation need. The scoring should continue degrading beyond 30 years (e.g., `<=40 → 30`, `<=50 → 20`, `>50 → 10`).

#### 2.1.8 Risk Assessment Impact/Probability Values Are Not Independently Measured

**Location:** `client/src/components/dashboard/RiskAssessment.tsx`, lines 84–86

```js
impact: Math.min(criticalRiskScore * 1.2, 100),
probability: Math.min(criticalRiskScore * 1.5, 100),
```

For every risk factor, both `impact` and `probability` are derived from the same underlying variable (`criticalRiskScore`, `interventionRiskScore`, etc.), simply multiplied by different constants. These are not independently assessed dimensions — they are algebraically linked. A standard risk matrix requires impact and probability to be rated on independent axes. Displaying them as separate progress bars with different percentages creates an illusion of two-dimensional analysis where only one dimension exists.

#### 2.1.9 Mitigation Effectiveness Grows With Problem Severity

**Location:** `client/src/components/dashboard/RiskAssessment.tsx`, lines 158–161

```js
effectiveness: Math.min(90 + criticalCount * 2, 100),
```

The emergency response strategy effectiveness increases as `criticalCount` increases. More critical issues should decrease expected effectiveness (resources stretched thin, coordination overhead), not increase it. This is a logical inversion.

#### 2.1.10 Staff-to-Student Ratio Displayed Backwards

**Location:** `client/src/components/dashboard/SchoolStatsCards.tsx`, line 69

```js
benchmark: totalStaff > 0 ? `${(totalStaff / (totalStudents || 1)).toFixed(2)} ratio` : "Staff data unavailable",
```

The benchmark displays `staff / students` (e.g., `0.03 ratio`), which is the inverse of the education standard. The global standard is the **student-to-teacher ratio** (e.g., `30:1`). A value of `0.03` is meaningless to an inspector without explanation. Additionally, this ratio mixes all staff categories (teachers + admin + support), whereas the educationally relevant metric is students per **teaching** staff.

---

### 2.2 Missing Information — School Dashboard

| # | Missing Metric | Business Importance | Data Availability |
|---|---|---|---|
| 1 | **Student-to-teacher ratio** (students ÷ teachers only) | Core education quality metric | Computable from existing fields |
| 2 | **Student-to-latrine ratio** | WASH compliance standard (mentioned in national recs but not computed) | Requires sanitation facility count field |
| 3 | **Enrollment trend** (YoY student count change) | Capacity planning | Requires historical data |
| 4 | **Electricity availability** | Facility readiness | Field exists on school entity |
| 5 | **Water source type & reliability** | WASH standard | Field exists on school entity |
| 6 | **Internet connectivity status** | Digital readiness | Field exists on school entity |
| 7 | **Year established / school age** | Context for building age interpretation | Field exists on school entity |
| 8 | **Last facility survey date** | Data freshness governance | `SchoolFacilitySurvey.createdAt` |
| 9 | **Comparison to district average** | Peer benchmarking | Computable from existing scores |
| 10 | **Comparison to provincial average** | Peer benchmarking | Computable from existing scores |
| 11 | **Number of classrooms** vs. classroom demand | Capacity detail | Field exists in facility survey |
| 12 | **Estimated budget for recommended works (RWF)** | Budget planning | `estimatedBudgetRwf` on assessment |
| 13 | **KMZ/3D model status** | GIS data completeness | `kmzStatus` field available |
| 14 | **Last inspection date** | Compliance tracking | Not currently tracked |
| 15 | **Female student / male student breakdown** | Gender equity monitoring | Available via program data |

---

### 2.3 Professional Dashboard Structure Issues — School Level

| Issue | Description |
|---|---|
| **No score history** | Overall score is shown as a single current value. No sparkline or trend showing whether the school is improving or deteriorating over time. |
| **Score breakdown weights not shown** | The six metric cards in `DecisionIntelligenceScore` show values but not their weight in the composite. Users cannot determine which dimension to prioritize. |
| **Facility compliance disconnected from score** | Facility compliance is displayed alongside score-contributing dimensions but does not affect the score (see §2.1.1). This is architecturally misleading. |
| **No action tracking** | Recommendations are generated but there is no way to mark them as "actioned," assign them, or set a due date within the dashboard. |
| **Reporting tab not integrated into score** | Issue reports feed `resolutionRate` shown in the breakdown, but the school score computation in the backend ignores reports entirely. The two systems operate in parallel with no integration. |
| **Buildings attention list** shows at most 3 buildings (`buildBuildingsAttention(buildings, ..., 3)`) — no pagination or "show all" link. |
| **Static "Benchmarking sync"** text | Shows hardcoded buckets ("Regional top 10%", "Regional top 25%") derived from the school's own score with no actual peer data comparison. |
| **No accessibility compliance summary** | Disability access, ramps, inclusive facilities are not surfaced anywhere despite being fields in the survey form. |
| **Decision urgency always shows `-- mo`** | `urgencyMonths` is never computed (see §2.1.3). |

---

## Part III — Cross-Cutting Gaps Affecting Both Dashboards

### 3.1 Data Completeness Is Not Surfaced

Neither dashboard shows users how complete the underlying data is. A school scoring `overallScore: 65` built on default fallback values (`50` everywhere due to missing data) looks identical to a school genuinely scored 65 on real measurements. The system needs:
- A **data completeness badge** per school (0–100% of key fields filled)
- A **national data quality indicator** (% of schools with buildings, population data, surveys)

### 3.2 Score Interpretation Is Not Explained

The `overallScore` ranges from 0–100 but there is no legend, tooltip, or contextual help explaining:
- What a score of 50 means in operational terms
- The four priority bands and their thresholds (35 / 55 / 75)
- Which direction each sub-metric is scored (high = better vs. high = worse)

The "Benchmarking sync" label ("Regional average", "Regional top 25%") is computed from the school's own score against hardcoded thresholds — it is not a genuine peer comparison.

### 3.3 Time Dimension Is Absent

Both dashboards are entirely static snapshots with no time-based filtering or trend analysis. For a monitoring system serving infrastructure investment decisions:
- **Quarter-on-quarter score trends** are essential to measure program impact
- **Issue report volume trends** (monthly) are essential to assess reporting culture
- **Building condition trends** (year-over-year surveys) are essential to detect deterioration

### 3.4 No Export or Reporting Action

The permissions model includes `EXPORT_REPORTS` but neither dashboard provides a working export button. Inspectors and district officials need to produce reports from dashboard views for physical filing and budget submissions.

### 3.5 Missing "Medium" Priority Throughout

`PriorityLevel` has four values: `critical`, `high`, `medium`, `low`. Medium schools are:
- Absent from the national KPI row
- Excluded from the aggregate score formula numerator
- Not highlighted in any provincial drill-down

---

## Part IV — Recommended Corrections by Priority

### Priority 1 — Immediate (Calculation Integrity)

| ID | Fix | File |
|---|---|---|
| C-01 | Replace aggregate score formula with server-side mean of `overallScore` | `Dashboard.tsx`, `analytics.service.ts` |
| C-02 | Remove hardcoded metric values (68, 72, 84, 84); compute from DB | `Dashboard.tsx` |
| C-03 | Either include `facilityComplianceScore` in `overallScore` formula or label it clearly as "supplementary" | `analytics.service.ts` |
| C-04 | Fix `resolutionRate` data flow — pass `reportingData.resolutionRate` into `DecisionIntelligenceScore` | `SchoolDecisionDashboard.tsx` |
| C-05 | Add guard `Math.min(100, aggregateScore + 5)` | `Dashboard.tsx` |
| C-06 | Rename "Demographic load" to "Capacity resilience" and invert display (or flip score logic) | `DecisionIntelligenceScore.tsx` |
| C-07 | Replace hardcoded recommendations with data-driven ones | `Dashboard.tsx` |
| C-08 | Fix staff-to-student ratio to show `students / teachers` | `SchoolStatsCards.tsx` |

### Priority 2 — High (Analytical Completeness)

| ID | Fix | File |
|---|---|---|
| A-01 | Add `urgencyMonths` calculation to analytics service | `analytics.service.ts` |
| A-02 | Extend building age scoring below 30 years (add 40/50/60 year bands) | `analytics.service.ts` |
| A-03 | Flag schools with missing population or building data separately from scoring | `analytics.service.ts` |
| A-04 | Add medium-priority KPI card to national dashboard | `Dashboard.tsx` |
| A-05 | Add provincial average scores to provincial distribution chart | `Dashboard.tsx`, `analytics.service.ts` |
| A-06 | Surface `estimatedBudgetRwf` on both dashboards | Multiple |
| A-07 | Add student-to-teacher ratio calculation and display | `SchoolStatsCards.tsx`, `analytics.service.ts` |

### Priority 3 — Important (UX and Governance)

| ID | Fix | File |
|---|---|---|
| U-01 | Remove "LIVE MONITORING ENABLED" badge from national dashboard (no WebSocket) | `Dashboard.tsx` |
| U-02 | Remove hardcoded Benchmark (+12.4%), Reliability (88%), and sync latency (42ms) | `SchoolDecisionDashboard.tsx` |
| U-03 | Add score weight labels to each sub-metric in the breakdown | `DecisionIntelligenceScore.tsx` |
| U-04 | Add data completeness indicator per school and nationally | Multiple |
| U-05 | Add last-calculated timestamp to both dashboards | Both dashboards |
| U-06 | Add export button (CSV/PDF) to national and school dashboards | Both dashboards |
| U-07 | Provide accessible color alternatives (icons per risk level) | Both dashboards |

### Priority 4 — Enhancement (Strategic Value)

| ID | Enhancement |
|---|---|
| E-01 | Time-series score history (sparklines) for each school |
| E-02 | Provincial/district peer benchmarking (actual comparison, not hardcoded thresholds) |
| E-03 | National drill-down: Province → District → School |
| E-04 | Enrollment and building condition trend analysis |
| E-05 | Recommendation action tracking (assign, set deadline, mark done) |
| E-06 | KMZ and survey coverage rate KPIs nationally |
| E-07 | Genuine risk matrix with independently assessed impact and probability axes |
| E-08 | Integrated map view on national dashboard (heatmap of priority levels by geography) |

---

## Appendix A — Scoring Formula Summary (Current vs. Recommended)

### Current Formula
```
overallScore = infraScore × 0.40
             + ageScore   × 0.30
             + accessScore × 0.15
             + popScore   × 0.15
```
**facilityComplianceScore**: computed, stored, displayed — **weight: 0%**

### Recommended Formula (with weights redistributed)
```
overallScore = infraScore             × 0.35
             + ageScore               × 0.25
             + accessibilityScore     × 0.10
             + populationScore        × 0.10
             + facilityCompliance     × 0.15
             + reportResolutionRate   × 0.05
```
*Note: Final weights should be validated with domain experts and RTB policy.*

---

## Appendix B — Building Age Score Banding (Current vs. Recommended)

| Average Building Age | Current Score | Recommended Score |
|---|---|---|
| ≤ 10 years | 95 | 95 |
| 11–20 years | 80 | 80 |
| 21–30 years | 60 | 60 |
| 31–40 years | **40** | 45 |
| 41–50 years | **40** | 30 |
| 51–60 years | **40** | 20 |
| > 60 years | **40** | 10 |

---

## Appendix C — Key Performance Indicators Checklist

### National Dashboard — Recommended KPI Set

| KPI | Current | Recommended |
|---|---|---|
| Total institutions | ✅ | ✅ |
| Critical priority count | ✅ | ✅ |
| High priority count | ✅ | ✅ |
| **Medium priority count** | ❌ | ✅ |
| Optimal (Low) count | ✅ | ✅ |
| **National average overall score** | ❌ | ✅ |
| **Total enrolled students** | ❌ | ✅ |
| **Total teaching staff** | ❌ | ✅ |
| **KMZ coverage rate** | ❌ | ✅ |
| **Data completeness rate** | ❌ | ✅ |
| **Estimated total rehabilitation budget (RWF)** | ❌ | ✅ |
| **Last recalculation timestamp** | ❌ | ✅ |

### School Dashboard — Recommended KPI Set

| KPI | Current | Recommended |
|---|---|---|
| Overall intelligence score | ✅ | ✅ |
| Infrastructure score | ✅ | ✅ |
| Building age score | ✅ | ✅ |
| Accessibility score | ✅ | ✅ |
| Population pressure score | ✅ (mislabelled) | ✅ (relabelled) |
| Facility compliance score | ✅ (excluded from formula) | ✅ (include in formula) |
| Resolution rate | ✅ (broken data flow) | ✅ (fix data flow) |
| Total students | ✅ | ✅ |
| Total staff | ✅ | ✅ |
| **Student-to-teacher ratio** | ❌ | ✅ |
| **Student-to-latrine ratio** | ❌ | ✅ |
| Buildings count & avg age | ✅ | ✅ |
| **District average score comparison** | ❌ | ✅ |
| **Provincial average score comparison** | ❌ | ✅ |
| **Last survey date** | ❌ | ✅ |
| **Estimated intervention budget (RWF)** | ❌ | ✅ |
| **Decision urgency (months)** | ✅ (always null) | ✅ (compute it) |
| **Enrollment trend (YoY)** | ❌ | ✅ |

---

*Report prepared from source code audit of commit branch `emmy` as of 2026-06-05.*
