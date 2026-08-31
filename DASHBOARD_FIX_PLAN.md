# Dashboard Fix Implementation Plan
## RTB GIS Schools Monitoring & Intelligence System

**Author:** Senior Backend Developer & Statistician  
**Based on:** `DASHBOARD_AUDIT_REPORT.md` (2026-06-05)  
**Branch:** `emmy`  
**Target:** Resolve all calculation integrity, analytical completeness, and UX governance gaps found in the audit.

---

## Ground Rules — Type Safety & Numeric Parsing

Every numeric field read from the database or a DTO **must** be parsed before arithmetic or comparison. TypeORM can return numeric columns as strings depending on the PostgreSQL driver. Apply this pattern consistently:

```ts
// ALWAYS do this before arithmetic:
const value = parseFloat(String(rawField)) || 0;

// For nullable fields that must stay null when absent:
const value = rawField != null ? parseFloat(String(rawField)) : null;

// For integer counts from raw queries (COUNT(*) returns string):
const count = parseInt(String(rawCount), 10) || 0;

// Safe division guard — never divide without denominator check:
const ratio = denominator > 0 ? numerator / denominator : 0;

// Score clamping — apply everywhere a score is produced:
const score = Math.min(100, Math.max(0, Math.round(raw)));
```

These patterns are already applied in parts of `analytics.service.ts` but are missing in several client-side components and the raw query result handling.

---

## Phase 1 — Calculation Integrity (Priority 1 Fixes)

**Goal:** Fix every metric that produces wrong, misleading, or overflowing numbers.  
**Estimated effort:** 2–3 days  
**Files touched:** `analytics.service.ts`, `analytics.controller.ts`, `Dashboard.tsx`, `SchoolDecisionDashboard.tsx`, `DecisionIntelligenceScore.tsx`, `SchoolStatsCards.tsx`

---

### 1.1 Fix the Overall Score Formula (C-01, C-03)

**File:** `server/src/modules/analytics/analytics.service.ts` — `calculateSchoolScore()` (~line 339)

**Current (broken):**
```ts
const overallScore = Math.round(
  infraScore * 0.40 + ageScore * 0.30 + accessScore * 0.15 + popScore * 0.15,
);
// facilityScore is computed and passed to recommendations but contributes 0%
```

**Fix — incorporate `facilityComplianceScore` with redistributed weights:**
```ts
// Clamp every component before combining — parseFloat may produce NaN
const safeInfra    = Math.min(100, Math.max(0, parseFloat(String(infraScore))    || 0));
const safeAge      = Math.min(100, Math.max(0, parseFloat(String(ageScore))      || 0));
const safeAccess   = Math.min(100, Math.max(0, parseFloat(String(accessScore))   || 0));
const safePop      = Math.min(100, Math.max(0, parseFloat(String(popScore))      || 0));
const safeFacility = Math.min(100, Math.max(0, parseFloat(String(facilityScore)) || 0));
const safeResolution = Math.min(100, Math.max(0, parseFloat(String(resolutionRateScore)) || 50));

// Weighted composite (weights must sum to 1.0)
const overallScore = Math.min(100, Math.round(
  safeInfra      * 0.35 +   // Infrastructure condition (buildings)
  safeAge        * 0.25 +   // Building age / depreciation
  safeAccess     * 0.10 +   // Road accessibility
  safePop        * 0.10 +   // Demographic capacity resilience
  safeFacility   * 0.15 +   // Facility survey compliance
  safeResolution * 0.05,    // Issue report resolution rate
));
```

**Also fix the stale comment at ~line 309:**  
Change `// Infrastructure score (30%)` → `// Infrastructure score (35%)`

**Also persist `facilityComplianceScore` on the `DecisionAssessment` entity** so it is not re-queried on every metrics fetch.

**Entity change** (`decision-assessment.entity.ts`):
```ts
@Column({ type: 'float', nullable: true, default: null })
facilityComplianceScore: number | null;

@Column({ type: 'float', nullable: true, default: null })
resolutionRateScore: number | null;

@Column({ default: false })
hasInfraDataGap: boolean;

@Column({ default: false })
hasPopDataGap: boolean;
```

Update the upsert block to include all four new columns.

---

### 1.2 Fix the National Aggregate Score (C-01) — Server-Side Mean

**File:** `server/src/modules/analytics/analytics.service.ts` — `getOverview()`

Replace client-side synthetic formula with a true arithmetic mean in SQL:

```ts
const [avgScoreResult] = await this.schoolRepository
  .createQueryBuilder('s')
  .select('ROUND(AVG(s.overallScore)::numeric, 1)', 'nationalAvgScore')
  .addSelect('COUNT(*)', 'scoredCount')
  .where('s.overallScore IS NOT NULL')
  .getRawMany();

// Parse — PostgreSQL AVG returns a string in the pg driver
const nationalAvgScore  = parseFloat(String(avgScoreResult?.nationalAvgScore)) || 0;
const scoredSchoolCount = parseInt(String(avgScoreResult?.scoredCount), 10)     || 0;
```

Return `nationalAvgScore` and `scoredSchoolCount` in the `getOverview()` response object.

**File:** `client/src/pages/Dashboard.tsx` (~line 98)

Remove the synthetic formula entirely:
```ts
// BEFORE (wrong): (low * 90 + high * 40 + critical * 10) / total
// AFTER (correct): server-computed arithmetic mean
const aggregateScore = Math.min(100, Math.max(0, Math.round(
  parseFloat(String(stats?.nationalAvgScore)) || 0
)));
```

---

### 1.3 Compute `urgencyMonths` and `resolutionRateScore` (A-01, C-04)

**File:** `server/src/modules/analytics/analytics.service.ts` — `calculateSchoolScore()`

**Urgency months** (add after `overallScore` is determined):
```ts
const urgencyMonths = (() => {
  if (overallScore < 35) return 0;   // Critical — immediate
  if (overallScore < 45) return 3;   // High — 3 months
  if (overallScore < 55) return 6;   // High — 6 months
  if (overallScore < 65) return 12;  // Medium — 12 months
  if (overallScore < 75) return 18;  // Medium — 18 months
  return 36;                         // Optimal — 36 months (routine)
})();
```

**Resolution rate score** (add before composite formula):
```ts
// Count queries return number in TypeORM but parse defensively
const totalReports    = await this.issueReportRepository.count({ where: { schoolId: school.id } });
const resolvedReports = await this.issueReportRepository.count({
  where: { schoolId: school.id, status: ReportStatus.SOLVED },
});
const resolutionRateScore = totalReports > 0
  ? Math.min(100, Math.round((resolvedReports / totalReports) * 100))
  : 50; // No reports = neutral (school not penalised for clean record)
```

**Fix `resolutionRate` data flow** in `SchoolDecisionDashboard.tsx`:
```ts
// Build the resolved rate from reportSummary which is already fetched
const resolutionRate = reportingData?.total > 0
  ? Math.round(((reportingData?.resolved ?? 0) / reportingData.total) * 100)
  : null;

// Merge into assessment object passed to DecisionIntelligenceScore:
const assessmentWithRate = { ...calculatedAssessment, resolutionRate };
```

---

### 1.4 Fix Building Age Score Banding (A-02)

**File:** `server/src/modules/analytics/analytics.service.ts` — `calculateAgeScore()` (~line 415)

```ts
private calculateAgeScore(buildings: SchoolBuilding[], establishedYear?: number): number {
  const currentYear = new Date().getFullYear();
  const buildingAges = buildings
    .filter((b) => b.yearBuilt)
    // Use parseInt for year fields — they represent whole numbers
    .map((b) => currentYear - parseInt(String(b.yearBuilt), 10));

  let avgAge: number;
  if (buildingAges.length > 0) {
    avgAge = buildingAges.reduce((sum, age) => sum + age, 0) / buildingAges.length;
  } else if (establishedYear) {
    avgAge = currentYear - parseInt(String(establishedYear), 10);
  } else {
    return 50; // No age data — neutral; flagged via hasInfraDataGap
  }

  // Extended banding — degradation continues beyond 30 years
  if (avgAge <= 10) return 95;
  if (avgAge <= 20) return 80;
  if (avgAge <= 30) return 60;
  if (avgAge <= 40) return 45;
  if (avgAge <= 50) return 30;
  if (avgAge <= 60) return 20;
  return 10; // > 60 years — critical structural risk
}
```

---

### 1.5 Fix Infrastructure Score Default (A-03)

**File:** `server/src/modules/analytics/analytics.service.ts` — `calculateInfrastructureScore()` (~line 401)

```ts
private calculateInfrastructureScore(buildings: SchoolBuilding[]): number {
  if (!buildings || buildings.length === 0) {
    // Missing building data is a risk, not neutral. Return 0 so the composite
    // reflects the data gap. hasInfraDataGap flag is set separately in the caller.
    return 0;
  }
  const conditionMap: Record<string, number> = {
    [BuildingCondition.GOOD]:     100,
    [BuildingCondition.FAIR]:      70,
    [BuildingCondition.POOR]:      30,   // was 40 — POOR is significantly worse than FAIR
    [BuildingCondition.CRITICAL]:  10,
  };
  const scores = buildings.map((b) => conditionMap[b.condition] ?? 50);
  const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
  return Math.min(100, Math.max(0, Math.round(avg)));
}
```

In `calculateSchoolScore()`, set:
```ts
const hasInfraDataGap = buildings.length === 0;
```

---

### 1.6 Fix Population Score — Semantics and Missing-Data Flag (A-03, C-06)

**File:** `server/src/modules/analytics/analytics.service.ts` — `calculatePopulationScore()` (~line 441)

```ts
private calculatePopulationScore(
  population?: PopulationData,
  currentStudents?: number,
): { score: number; hasPopDataGap: boolean } {
  if (!population) {
    // Return neutral but flag gap — missing data ≠ moderate pressure
    return { score: 50, hasPopDataGap: true };
  }

  // Parse both operands — TypeORM can return numeric fields as strings
  const capacity = Math.max(1, parseFloat(String(currentStudents)) || 300);
  const demand   = parseFloat(String(population.schoolAgePopulation2km)) || 0;
  const ratio    = demand / capacity;

  // Higher score = more capacity headroom = better (label: "Capacity Resilience")
  let score: number;
  if (ratio >= 5) score = 10;
  else if (ratio >= 3) score = 30;
  else if (ratio >= 2) score = 50;
  else if (ratio >= 1) score = 70;
  else score = 100;

  return { score, hasPopDataGap: false };
}
```

Update `calculateSchoolScore()` to destructure:
```ts
const { score: popScore, hasPopDataGap } = this.calculatePopulationScore(population, totalStudents);
```

**Rename UI label in `DecisionIntelligenceScore.tsx`:**  
`"Demographic load"` → `"Capacity Resilience"`  
Add tooltip: "Higher score = more capacity headroom relative to local school-age population."

---

### 1.7 Fix Risk Assessment Logic Inversions (Audit §2.1.8, §2.1.9)

**File:** `client/src/components/dashboard/RiskAssessment.tsx` (~lines 84–86, 158–161)

Derive impact and probability from semantically distinct inputs:
```ts
// Impact = consequence severity if risk materialises (driven by score deficit)
const impact = Math.min(100, Math.max(0, Math.round(100 - overallScore)));

// Probability = likelihood of failure in next 12 months (driven by urgency timeline)
const probability =
  urgencyMonths === 0 ? 95 :
  urgencyMonths <= 6  ? 75 :
  urgencyMonths <= 12 ? 55 :
  urgencyMonths <= 24 ? 35 : 20;
```

**Mitigation effectiveness inversion fix (~line 158):**
```ts
// More critical issues = stretched resources = lower expected effectiveness
// BEFORE (inverted): 90 + criticalCount * 2
// AFTER (correct):
const effectiveness = Math.max(20, Math.min(85, 90 - criticalCount * 8));
```

---

### 1.8 Fix Staff-to-Student Ratio Direction (C-08)

**File:** `client/src/components/dashboard/SchoolStatsCards.tsx` (~line 69)

```ts
// Education standard is students per TEACHING staff (not all staff ÷ students)
const totalTeachers = parseFloat(String(schoolData?.totalTeachers)) || 0;
const totalStudents = parseFloat(String(schoolData?.totalStudents)) || 0;

const studentToTeacherDisplay = totalTeachers > 0
  ? `${Math.round(totalStudents / totalTeachers)}:1`
  : "No teacher data";
// Label: "Student : Teacher ratio"
```

Also compute and expose in `SchoolMetricsDto` via `getSchoolMetrics()`:
```ts
dto.studentToTeacherRatio = totalTeachers > 0
  ? parseFloat((totalStudents / totalTeachers).toFixed(1))
  : null;
```

---

### 1.9 Remove Deceptive UI Elements (U-01, U-02)

**File:** `client/src/pages/Dashboard.tsx` (~line 119)  
Remove the animated "LIVE MONITORING ENABLED" badge. Replace with a static timestamp:
```tsx
<div className="text-[10px] font-black tracking-widest text-muted-foreground">
  SCORES AS OF {stats?.lastCalculatedAt
    ? new Date(stats.lastCalculatedAt).toLocaleDateString('en-RW', { dateStyle: 'medium' })
    : '—'}
</div>
```

**File:** `client/src/pages/SchoolDecisionDashboard.tsx` (~lines 493–519)  
Remove hardcoded `+12.4%` benchmark, `88%` reliability, and `42ms` latency. Replace benchmark with `scoreDeltaFromDistrict` (added in Phase 2). Remove reliability and latency entirely until real values are wired.

---

### 1.10 Fix Hardcoded National Recommendations (C-07)

**File:** `server/src/modules/analytics/analytics.service.ts` — `getOverview()`

Replace hardcoded strings with a data-driven method:
```ts
private async generateNationalRecommendations(
  critical: number,
  provinceStats: Array<{ province: string; avgScore: number }>,
): Promise<string[]> {
  const recs: string[] = [];

  if (critical > 0) {
    recs.push(`[URGENT] ${critical} school(s) require immediate infrastructure intervention.`);
  }

  // Province with the lowest computed average score
  const lowestProvince = [...provinceStats].sort(
    (a, b) => parseFloat(String(a.avgScore)) - parseFloat(String(b.avgScore))
  )[0];
  if (lowestProvince) {
    recs.push(
      `[STRATEGIC] ${lowestProvince.province} has the lowest average score (${
        parseFloat(String(lowestProvince.avgScore)).toFixed(0)
      }) — prioritise GIS mapping and assessment coverage.`
    );
  }

  // Dynamic count of critical-priority schools for WASH note
  const criticalCount = await this.schoolRepository.count({
    where: { priorityLevel: PriorityLevel.CRITICAL as any },
  });
  if (criticalCount > 0) {
    recs.push(`[CRITICAL] ${criticalCount} critical-priority school(s) require urgent WASH and sanitation review.`);
  }

  return recs;
}
```

Return `nationalRecommendations` from `getOverview()` and consume in `Dashboard.tsx` `RecommendationList`.

---

## Phase 2 — Analytical Completeness (Priority 2 Fixes)

**Goal:** Add all missing KPIs identified in the audit.  
**Estimated effort:** 3–4 days  
**Files touched:** `analytics.service.ts`, `analytics.controller.ts`, `school-metrics.dto.ts`, `Dashboard.tsx`, `SchoolDecisionDashboard.tsx`, `SchoolStatsCards.tsx`, `DecisionIntelligenceScore.tsx`

---

### 2.1 Extended `getOverview()` — National KPIs

**File:** `server/src/modules/analytics/analytics.service.ts` — `getOverview()`

Extend the `Promise.all` to include:

```ts
// Sub-dimension national averages (join to assessment table)
this.schoolRepository
  .createQueryBuilder('s')
  .select('ROUND(AVG(s.overallScore)::numeric, 1)',                'nationalAvgScore')
  .addSelect('ROUND(AVG(da.buildingAgeScore)::numeric, 1)',        'nationalAvgAgeScore')
  .addSelect('ROUND(AVG(da.accessibilityScore)::numeric, 1)',      'nationalAvgAccessScore')
  .addSelect('ROUND(AVG(da.facilityComplianceScore)::numeric, 1)', 'nationalAvgComplianceScore')
  .leftJoin('s.decisionAssessment', 'da')
  .getRawOne(),

// Total enrolled students across all schools
this.schoolRepository
  .createQueryBuilder('s')
  .select('COALESCE(SUM(s.totalStudents), 0)', 'totalStudents')
  .getRawOne(),

// Total teaching staff (male + female teachers)
this.schoolRepository
  .createQueryBuilder('s')
  .select(
    'COALESCE(SUM(COALESCE(s.maleTeachers,0) + COALESCE(s.femaleTeachers,0)), 0)',
    'totalTeachers'
  )
  .getRawOne(),

// KMZ coverage: schools with non-empty kmzStatus
this.schoolRepository
  .createQueryBuilder('s')
  .select('COUNT(*)', 'withKmz')
  .where("s.kmzStatus IS NOT NULL AND s.kmzStatus != ''")
  .getRawOne(),

// Survey coverage: schools with at least one facility survey
this.surveyRepository
  .createQueryBuilder('sv')
  .select('COUNT(DISTINCT sv.schoolId)', 'withSurvey')
  .getRawOne(),

// Total estimated rehabilitation budget across all assessments
this.assessmentRepository
  .createQueryBuilder('da')
  .select('COALESCE(SUM(da.estimatedBudgetRwf), 0)', 'totalBudget')
  .where('da.estimatedBudgetRwf IS NOT NULL')
  .getRawOne(),

// Last recalculation timestamp
this.assessmentRepository
  .createQueryBuilder('da')
  .select('MAX(da.updatedAt)', 'lastCalculatedAt')
  .getRawOne(),
```

**All raw query results are strings — parse every field:**
```ts
return {
  totalSchools,
  byPriority,   // already parsed in existing code
  nationalAvgScore:           parseFloat(String(scoreAvg?.nationalAvgScore))           || 0,
  nationalAvgAgeScore:        parseFloat(String(scoreAvg?.nationalAvgAgeScore))        || 0,
  nationalAvgAccessScore:     parseFloat(String(scoreAvg?.nationalAvgAccessScore))     || 0,
  nationalAvgComplianceScore: parseFloat(String(scoreAvg?.nationalAvgComplianceScore)) || 0,
  totalStudents:              parseInt(String(studentsResult?.totalStudents), 10)       || 0,
  totalTeachers:              parseInt(String(teachersResult?.totalTeachers), 10)       || 0,
  kmzCoverageRate: totalSchools > 0
    ? Math.round((parseInt(String(kmzResult?.withKmz), 10) / totalSchools) * 100)
    : 0,
  surveyCompletionRate: totalSchools > 0
    ? Math.round((parseInt(String(surveyResult?.withSurvey), 10) / totalSchools) * 100)
    : 0,
  totalEstimatedBudgetRwf: parseFloat(String(budgetResult?.totalBudget)) || 0,
  lastCalculatedAt:        lastCalcResult?.lastCalculatedAt ?? null,
  nationalRecommendations,
  provinceStats,
  criticalSchools,
  recentAssessments,
};
```

---

### 2.2 Extended Provincial Stats — All Priority Bands + Average Score

**File:** `server/src/modules/analytics/analytics.service.ts` — province query (~line 67)

```ts
const provinceStatsRaw = await this.schoolRepository
  .createQueryBuilder('s')
  .select('s.province', 'province')
  .addSelect('COUNT(*)',                                                              'total')
  .addSelect("SUM(CASE WHEN s.priorityLevel = 'critical' THEN 1 ELSE 0 END)",        'critical')
  .addSelect("SUM(CASE WHEN s.priorityLevel = 'high'     THEN 1 ELSE 0 END)",        'high')
  .addSelect("SUM(CASE WHEN s.priorityLevel = 'medium'   THEN 1 ELSE 0 END)",        'medium')
  .addSelect("SUM(CASE WHEN s.priorityLevel = 'low'      THEN 1 ELSE 0 END)",        'low')
  .addSelect('ROUND(AVG(s.overallScore)::numeric, 1)',                                'avgScore')
  .addSelect('MIN(s.overallScore)',                                                    'minScore')
  .addSelect('MAX(s.overallScore)',                                                    'maxScore')
  .groupBy('s.province')
  .orderBy('total', 'DESC')
  .getRawMany();

// Normalise all numeric fields — raw query returns strings
const provinceStats = provinceStatsRaw.map((p) => ({
  province: p.province,
  total:    parseInt(String(p.total),    10) || 0,
  critical: parseInt(String(p.critical), 10) || 0,
  high:     parseInt(String(p.high),     10) || 0,
  medium:   parseInt(String(p.medium),   10) || 0,
  low:      parseInt(String(p.low),      10) || 0,
  avgScore: parseFloat(String(p.avgScore))   || 0,
  minScore: parseFloat(String(p.minScore))   || 0,
  maxScore: parseFloat(String(p.maxScore))   || 0,
}));
```

---

### 2.3 Extended School-Level KPIs in `getSchoolMetrics()`

**File:** `server/src/modules/analytics/analytics.service.ts` — `getSchoolMetrics()`

#### Student-to-Teacher Ratio
```ts
// Parse both operands — entity fields may return as strings
const safeStudents = parseFloat(String(totalStudents)) || 0;
const safeTeachers = parseFloat(String(totalTeachers)) || 0;
dto.studentToTeacherRatio = safeTeachers > 0
  ? parseFloat((safeStudents / safeTeachers).toFixed(1))
  : null;
```

#### Student-to-Latrine Ratio
```ts
const latestSurvey = await this.surveyRepository.findOne({
  where: { schoolId },
  order: { createdAt: 'DESC' },
});
// latrineCount may live on survey or school entity — parse whichever is set
const latrineCount = parseFloat(
  String(latestSurvey?.latrineCount ?? (school as any).latrineCount ?? 0)
) || 0;
dto.latrineCount          = latrineCount;
dto.studentToLatrineRatio = latrineCount > 0
  ? parseFloat((safeStudents / latrineCount).toFixed(1))
  : null;
```

#### Utility and Connectivity Fields
```ts
dto.hasElectricity  = (school as any).hasElectricity  ?? null;
dto.waterSourceType = (school as any).waterSourceType ?? null;
dto.hasInternet     = (school as any).hasInternet     ?? null;
```

#### School Age
```ts
const establishedYear = school.establishedYear
  ? parseInt(String(school.establishedYear), 10)
  : null;
dto.establishedYear = establishedYear;
dto.schoolAge       = establishedYear
  ? new Date().getFullYear() - establishedYear
  : null;
```

#### Last Survey Date
```ts
dto.lastSurveyDate = latestSurvey?.createdAt?.toISOString() ?? null;
```

#### Peer Benchmarking — District and Provincial Averages
```ts
const [districtAvgRow, provinceAvgRow] = await Promise.all([
  this.schoolRepository
    .createQueryBuilder('s')
    .select('ROUND(AVG(s.overallScore)::numeric, 1)', 'avg')
    .where('s.district = :d AND s.id != :id', { d: school.district, id: school.id })
    .getRawOne(),
  this.schoolRepository
    .createQueryBuilder('s')
    .select('ROUND(AVG(s.overallScore)::numeric, 1)', 'avg')
    .where('s.province = :p AND s.id != :id', { p: school.province, id: school.id })
    .getRawOne(),
]);

// Parse AVG results — the pg driver returns numeric as string
const districtAvg = districtAvgRow?.avg != null ? parseFloat(String(districtAvgRow.avg)) : null;
const provinceAvg = provinceAvgRow?.avg != null ? parseFloat(String(provinceAvgRow.avg)) : null;

dto.districtAvgScore       = districtAvg;
dto.provinceAvgScore       = provinceAvg;
dto.scoreDeltaFromDistrict = districtAvg != null
  ? parseFloat((dto.overallScore - districtAvg).toFixed(1))
  : null;
dto.scoreDeltaFromProvince = provinceAvg != null
  ? parseFloat((dto.overallScore - provinceAvg).toFixed(1))
  : null;
```

#### Data Completeness Score
```ts
// 10-point binary checklist — each check is equally weighted
const completenessChecks = [
  buildings.length > 0,
  safeStudents > 0,
  safeTeachers > 0,
  school.province != null && school.province !== '',
  school.district != null && school.district !== '',
  school.roadStatusPercentage != null,
  establishedYear != null,
  latestSurvey != null,
  (school.populationData?.length ?? 0) > 0,
  school.kmzStatus != null && school.kmzStatus !== '',
];
const filledCount = completenessChecks.filter(Boolean).length;
dto.dataCompletenessScore = Math.round((filledCount / completenessChecks.length) * 100);
```

#### KMZ Status
```ts
dto.kmzStatus = school.kmzStatus ?? null;
```

#### Risk Impact and Probability (for genuine 2-axis risk matrix — see Phase 4.5)
```ts
const criticalBuildingCount = buildings.filter(
  (b) => b.condition === BuildingCondition.CRITICAL || b.condition === BuildingCondition.POOR
).length;
const avgBuildingAge = dto.avgBuildingAge ?? 50;
const daysSinceLastSurvey = latestSurvey
  ? (Date.now() - new Date(latestSurvey.createdAt).getTime()) / 86_400_000
  : Infinity;

dto.riskImpactScore = Math.min(100, Math.round(
  (100 - dto.overallScore)                                            * 0.50 +
  (criticalBuildingCount / Math.max(1, buildings.length)) * 100       * 0.30 +
  (dto.urgencyMonths === 0 ? 100 : Math.max(0, 100 - dto.urgencyMonths! * 2)) * 0.20
));

dto.riskProbabilityScore = Math.min(100, Math.round(
  Math.min(100, avgBuildingAge * 1.5)                                          * 0.50 +
  ((dto.hasPopDataGap ?? false) ? 60 : 20)                                     * 0.25 +
  (daysSinceLastSurvey > 365 ? 80 : daysSinceLastSurvey > 180 ? 50 : 20)      * 0.25
));
```

---

### 2.4 Update `SchoolMetricsDto` for All New Fields

**File:** `server/src/modules/analytics/dto/school-metrics.dto.ts`

Add after existing declarations:
```ts
@ApiPropertyOptional({ nullable: true, description: 'Students per teaching staff (not all staff)' })
studentToTeacherRatio: number | null;

@ApiPropertyOptional({ nullable: true, description: 'Students per latrine unit' })
studentToLatrineRatio: number | null;

@ApiPropertyOptional({ nullable: true })
latrineCount: number | null;

@ApiPropertyOptional({ nullable: true })
hasElectricity: boolean | null;

@ApiPropertyOptional({ nullable: true })
waterSourceType: string | null;

@ApiPropertyOptional({ nullable: true })
hasInternet: boolean | null;

@ApiPropertyOptional({ nullable: true })
schoolAge: number | null;

@ApiPropertyOptional({ nullable: true })
establishedYear: number | null;

@ApiPropertyOptional({ nullable: true, description: 'ISO 8601 date of most recent facility survey' })
lastSurveyDate: string | null;

@ApiPropertyOptional({ nullable: true, description: 'Avg overallScore of other schools in same district' })
districtAvgScore: number | null;

@ApiPropertyOptional({ nullable: true, description: 'Avg overallScore of other schools in same province' })
provinceAvgScore: number | null;

@ApiPropertyOptional({ nullable: true, description: 'This school minus district avg (+ = above)' })
scoreDeltaFromDistrict: number | null;

@ApiPropertyOptional({ nullable: true })
scoreDeltaFromProvince: number | null;

@ApiProperty({ minimum: 0, maximum: 100, description: '% of 10 key data fields that are populated' })
dataCompletenessScore: number;

@ApiPropertyOptional({ nullable: true })
kmzStatus: string | null;

@ApiPropertyOptional({ nullable: true })
resolutionRateScore: number | null;

@ApiPropertyOptional({ nullable: true })
hasInfraDataGap: boolean | null;

@ApiPropertyOptional({ nullable: true })
hasPopDataGap: boolean | null;

@ApiPropertyOptional({ nullable: true, description: 'Impact severity score (0–100) for risk matrix' })
riskImpactScore: number | null;

@ApiPropertyOptional({ nullable: true, description: 'Failure probability score (0–100) for risk matrix' })
riskProbabilityScore: number | null;
```

---

### 2.5 Add Medium Priority KPI Card (A-04)

**File:** `client/src/pages/Dashboard.tsx`

```tsx
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
  <KPICard title="Total Institutions" value={stats?.totalSchools || 0}
    icon={Building2} variant="info" delay={0.1} />
  <KPICard title="Critical Priority" value={stats?.byPriority?.critical || 0}
    icon={AlertTriangle} variant="destructive" delay={0.2} />
  <KPICard title="High Priority" value={stats?.byPriority?.high || 0}
    icon={AlertTriangle} variant="warning" delay={0.3} />
  <KPICard title="Medium Priority" value={stats?.byPriority?.medium || 0}
    icon={AlertTriangle} variant="warning" delay={0.35} />
  <KPICard title="Optimal Status" value={stats?.byPriority?.low || 0}
    icon={CheckCircle2} variant="success" delay={0.4} />
</div>
```

---

### 2.6 Replace Hardcoded National Intelligence Metrics (C-02, C-05)

**File:** `client/src/pages/Dashboard.tsx` (~lines 160–170)

```tsx
metrics={[
  {
    label: "National Health Score",
    // Server-computed mean — clamp to prevent overflow; no arbitrary +5 offset
    score: Math.min(100, Math.max(0, Math.round(
      parseFloat(String(stats?.nationalAvgScore)) || 0
    ))),
    icon: Building2,
  },
  {
    label: "Buildings Depreciation",
    // Depreciation index = 100 − avg building age score (higher age score = newer = less depreciation)
    score: Math.min(100, Math.max(0, Math.round(
      100 - (parseFloat(String(stats?.nationalAvgAgeScore)) || 50)
    ))),
    icon: MapPin,
  },
  {
    label: "Capacity Utilisation",
    // Computed server-side (totalStudents ÷ totalCapacity)
    score: stats?.nationalCapacityUtilisation != null
      ? Math.min(100, Math.max(0, Math.round(
          parseFloat(String(stats.nationalCapacityUtilisation))
        )))
      : null,
    icon: Users,
  },
  {
    label: "School Accessibility",
    score: Math.min(100, Math.max(0, Math.round(
      parseFloat(String(stats?.nationalAvgAccessScore)) || 0
    ))),
    icon: ClipboardCheck,
  },
  {
    label: "Facility Compliance",
    score: Math.min(100, Math.max(0, Math.round(
      parseFloat(String(stats?.nationalAvgComplianceScore)) || 0
    ))),
    icon: ClipboardCheck,
  },
]}
```

Add `nationalCapacityUtilisation` calculation to `getOverview()` service. Because `educationPrograms` is a JSONB column, capacity must be aggregated in application code:

```ts
private async computeNationalCapacityUtilisation(): Promise<number | null> {
  const schools = await this.schoolRepository.find({
    select: ['educationPrograms', 'totalStudents'],
  });
  let sumStudents = 0, sumCapacity = 0;
  for (const s of schools) {
    const progs = (s.educationPrograms as any[]) ?? [];
    const cap = progs.reduce((acc, p) => acc + (parseFloat(String(p.capacity)) || 0), 0);
    const stu = progs.reduce((acc, p) => acc + (parseFloat(String(p.totalStudents)) || 0), 0)
      || (parseFloat(String(s.totalStudents)) || 0);
    sumStudents += stu;
    sumCapacity += cap;
  }
  return sumCapacity > 0
    ? Math.min(100, Math.round((sumStudents / sumCapacity) * 100))
    : null;
}
```

---

### 2.7 Score Weights in `DecisionIntelligenceScore` (U-03)

**File:** `client/src/components/dashboard/DecisionIntelligenceScore.tsx`

Add a `weight` field to each metric object and render it as a small badge next to the label:
```tsx
{ label: "Infrastructure",      score: assessment.infrastructureScore,     weight: "35%", icon: Building2 },
{ label: "Building Age",        score: assessment.buildingAgeScore,        weight: "25%", icon: MapPin },
{ label: "Accessibility",       score: assessment.accessibilityScore,      weight: "10%", icon: ClipboardCheck },
{ label: "Capacity Resilience", score: assessment.populationPressureScore, weight: "10%", icon: Users,
  tooltip: "Higher = more capacity headroom vs. local school-age population" },
{ label: "Facility Compliance", score: assessment.facilityComplianceScore, weight: "15%", icon: ClipboardCheck },
{ label: "Resolution Rate",     score: assessment.resolutionRate,          weight: "5%",  icon: CheckCircle2 },
```

---

## Phase 3 — UX and Governance (Priority 3 Fixes)

**Goal:** Remove deceptive UI elements, add data quality visibility, export, and score interpretation.  
**Estimated effort:** 2 days

---

### 3.1 Data Completeness Indicators (U-04)

**National dashboard** (`Dashboard.tsx`) — add sub-line below KPI row:
```tsx
<div className="col-span-full text-[10px] text-center text-muted-foreground font-black uppercase tracking-widest pt-1">
  Survey coverage: <strong>{stats?.surveyCompletionRate ?? '--'}%</strong> ·
  GIS coverage: <strong>{stats?.kmzCoverageRate ?? '--'}%</strong> ·
  Total students: <strong>{(stats?.totalStudents ?? 0).toLocaleString()}</strong> ·
  Total teachers: <strong>{(stats?.totalTeachers ?? 0).toLocaleString()}</strong>
</div>
```

**School dashboard** (`SchoolDecisionDashboard.tsx`) — data gap warning:
```tsx
{(metrics?.dataCompletenessScore ?? 100) < 60 && (
  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-700 font-medium">
    ⚠ Data completeness: {metrics.dataCompletenessScore}% — displayed scores may not reflect actual conditions.
  </div>
)}
```

---

### 3.2 Last Calculated Timestamp (U-05)

Replace "LIVE MONITORING ENABLED" in `Dashboard.tsx` with:
```tsx
<div className="flex items-center gap-2 text-[10px] font-black tracking-widest text-muted-foreground bg-background/50 backdrop-blur-md px-4 py-2 rounded-xl border border-border/20">
  SCORES AS OF {stats?.lastCalculatedAt
    ? new Date(stats.lastCalculatedAt).toLocaleDateString('en-RW', { dateStyle: 'medium' })
    : '—'}
</div>
```

Show the same timestamp on the school dashboard sourced from `metrics.calculatedAt`.

---

### 3.3 Export CSV Endpoint (U-06)

**Controller** (`analytics.controller.ts`):
```ts
@Get('export')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('EXPORT_REPORTS')
@Header('Content-Type', 'text/csv')
@Header('Content-Disposition', 'attachment; filename="rtb-schools-export.csv"')
async exportCsv() {
  return this.analyticsService.exportNationalCsv();
}
```

**Service** (`analytics.service.ts`):
```ts
async exportNationalCsv(): Promise<string> {
  const assessments = await this.assessmentRepository.find({
    relations: ['school'],
    order: { overallScore: 'ASC' },
  });

  const header = [
    'Name', 'Code', 'Province', 'District',
    'Overall Score', 'Priority Level',
    'Infrastructure Score', 'Building Age Score',
    'Accessibility Score', 'Facility Compliance Score',
    'Total Students', 'Urgency (months)',
    'Estimated Budget (RWF)', 'Last Calculated',
  ].join(',');

  const rows = assessments.map((a) => [
    `"${(a.school?.name ?? '').replace(/"/g, '""')}"`,
    a.school?.code ?? '',
    a.school?.province ?? '',
    a.school?.district ?? '',
    parseFloat(String(a.overallScore)).toFixed(0),
    a.priorityLevel ?? '',
    parseFloat(String(a.infrastructureScore)).toFixed(0),
    parseFloat(String(a.buildingAgeScore)).toFixed(0),
    parseFloat(String(a.accessibilityScore)).toFixed(0),
    parseFloat(String(a.facilityComplianceScore ?? 0)).toFixed(0),
    parseFloat(String(a.school?.totalStudents ?? 0)).toFixed(0),
    a.urgencyMonths ?? '',
    parseFloat(String(a.estimatedBudgetRwf ?? 0)).toFixed(0),
    a.updatedAt?.toISOString() ?? '',
  ].join(','));

  return [header, ...rows].join('\n');
}
```

**Frontend** — Add `<ExportButton>` gated on `hasPermission('EXPORT_REPORTS')` that calls `GET /api/v1/analytics/export` and triggers a file download.

---

### 3.4 Score Interpretation Legend (Audit §3.2)

**File:** `client/src/components/dashboard/DecisionIntelligenceScore.tsx`

Add collapsible score guide below breakdown:
```tsx
<details className="text-[10px] text-muted-foreground mt-2 border-t border-border/10 pt-2">
  <summary className="cursor-pointer font-black uppercase tracking-widest">Score Guide ▾</summary>
  <div className="mt-2 grid grid-cols-4 gap-1">
    {[
      { band: 'Critical', range: '0–34',   color: 'bg-destructive/10 text-destructive' },
      { band: 'High',     range: '35–54',  color: 'bg-orange-500/10 text-orange-600' },
      { band: 'Medium',   range: '55–74',  color: 'bg-amber-500/10 text-amber-600' },
      { band: 'Optimal',  range: '75–100', color: 'bg-emerald-500/10 text-emerald-600' },
    ].map(({ band, range, color }) => (
      <div key={band} className={`rounded p-1 ${color} text-center`}>
        <div className="font-black">{range}</div>
        <div>{band}</div>
      </div>
    ))}
  </div>
</details>
```

---

## Phase 4 — Strategic Enhancements (Priority 4)

**Goal:** Longitudinal analysis, genuine peer benchmarking, drill-down navigation, action tracking.  
**Estimated effort:** 5–7 days

---

### 4.1 Score History Entity and API (E-01)

**New file:** `server/src/modules/analytics/entities/score-history.entity.ts`
```ts
@Entity('score_history')
export class ScoreHistory {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() schoolId: string;

  // All scores stored as float — parse on write, never store raw strings
  @Column({ type: 'float' })               overallScore: number;
  @Column({ type: 'float' })               infrastructureScore: number;
  @Column({ type: 'float' })               buildingAgeScore: number;
  @Column({ type: 'float' })               accessibilityScore: number;
  @Column({ type: 'float' })               populationPressureScore: number;
  @Column({ type: 'float', nullable: true }) facilityComplianceScore: number | null;
  @Column({ type: 'float', nullable: true }) resolutionRateScore: number | null;

  @CreateDateColumn() recordedAt: Date;
}
```

Write a snapshot inside `calculateSchoolScore()` every recalculation. Parse all score values before persisting:
```ts
await this.scoreHistoryRepository.save({
  schoolId:                school.id,
  overallScore:            parseFloat(String(overallScore)),
  infrastructureScore:     parseFloat(String(infraScore)),
  buildingAgeScore:        parseFloat(String(ageScore)),
  accessibilityScore:      parseFloat(String(accessScore)),
  populationPressureScore: parseFloat(String(popScore)),
  facilityComplianceScore: parseFloat(String(facilityScore)),
  resolutionRateScore:     parseFloat(String(resolutionRateScore)),
});
```

**New endpoint:**  
`GET /api/v1/analytics/schools/:id/history?months=12`  
Returns `Array<{ recordedAt, overallScore, ... }>` sorted ascending — consumed by sparkline on school dashboard.

---

### 4.2 Genuine District/Provincial Peer Benchmarking (E-02)

Already covered by `districtAvgScore`, `provinceAvgScore`, and `scoreDeltaFromDistrict/Province` in Phase 2.

Replace hardcoded "Regional top 25%" in `SchoolDecisionDashboard.tsx`:
```ts
const peerLabel = (() => {
  const delta = metrics?.scoreDeltaFromDistrict;
  if (delta == null) return 'Insufficient peer data';
  if (delta >= 10)  return `+${delta.toFixed(1)} vs district avg — Above peers`;
  if (delta >= 0)   return `+${delta.toFixed(1)} vs district avg`;
  if (delta >= -10) return `${delta.toFixed(1)} vs district avg`;
  return `${delta.toFixed(1)} vs district avg — Below average`;
})();
```

---

### 4.3 Province → District → School Drill-down (E-03)

**New endpoint:**  
`GET /api/v1/analytics/hierarchy?province=Kigali%20City&district=Nyarugenge`

- Province only → return district-level aggregates (avg score, counts)
- Province + district → return individual school rows with scores

`DistributionChart` becomes clickable: clicking a province bar sets `selectedProvince` state and re-renders the chart with district breakdown.

---

### 4.4 Recommendation Action Tracking (E-05)

**New entity:** `server/src/modules/analytics/entities/recommendation-action.entity.ts`
```ts
@Entity('recommendation_actions')
export class RecommendationAction {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() schoolId: string;
  @Column('text') recommendation: string;
  @Column({ default: 'open' }) status: 'open' | 'in_progress' | 'done';
  @Column({ nullable: true }) assignedTo: string | null;
  @Column({ type: 'date', nullable: true }) dueDate: string | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
```

New endpoints:
```
GET    /api/v1/analytics/schools/:id/actions
POST   /api/v1/analytics/schools/:id/actions
PATCH  /api/v1/analytics/actions/:id   { status, assignedTo, dueDate }
```

Render in `SchoolDecisionDashboard.tsx` as inline checkboxes next to each recommendation with status badge, "Assign to" field, and "Set due date" input.

---

### 4.5 Genuine Risk Matrix (E-07)

`riskImpactScore` and `riskProbabilityScore` are already computed server-side in Phase 2.3.  
In `RiskAssessment.tsx`, consume them from `metrics` instead of computing locally:

```ts
const impact = metrics?.riskImpactScore ?? Math.min(100, Math.round(100 - overallScore));
const probability = metrics?.riskProbabilityScore ?? (urgencyMonths === 0 ? 95 : 20);
```

Render in a proper 2×2 risk quadrant: x-axis = probability, y-axis = impact, with school plotted as a dot. This is a genuine bivariate representation, not two progress bars.

---

### 4.6 Integrated Map View on National Dashboard (E-08)

Embed a minimap below the provincial distribution chart showing school locations coloured by `priorityLevel`:

```tsx
<SchoolMap
  schools={allSchools}
  height={300}
  interactive={false}
  colorBy="priorityLevel"
/>
```

Link to the full `/map` view for drill-down.

---

## Phase 5 — Validation & Data Migration

**Goal:** Ensure all existing records are re-scored and consistent after all formula changes.

### 5.1 Re-score All Schools

After deploying Phase 1 and 2 server changes, trigger:
```
POST /api/v1/analytics/recalculate-all
```

`recalculateAllScores()` already exists and handles all schools. With the new formula, all `DecisionAssessment` rows and new `ScoreHistory` snapshots will be written.

### 5.2 Back-fill Score History Baseline

One-time migration (add to seed module or a dedicated migration endpoint):
```ts
const assessments = await assessmentRepository.find({ relations: ['school'] });
for (const a of assessments) {
  await scoreHistoryRepository.save({
    schoolId:                a.schoolId,
    overallScore:            parseFloat(String(a.overallScore)),
    infrastructureScore:     parseFloat(String(a.infrastructureScore)),
    buildingAgeScore:        parseFloat(String(a.buildingAgeScore)),
    accessibilityScore:      parseFloat(String(a.accessibilityScore)),
    populationPressureScore: parseFloat(String(a.populationPressureScore)),
    facilityComplianceScore: a.facilityComplianceScore != null
      ? parseFloat(String(a.facilityComplianceScore))
      : null,
    recordedAt: a.updatedAt,
  });
}
```

### 5.3 Validation Checklist

**Database assertions:**
- [ ] `SELECT COUNT(*) FROM decision_assessment WHERE overall_score > 100 OR overall_score < 0` → **0**
- [ ] `SELECT COUNT(*) FROM decision_assessment WHERE urgency_months IS NULL` → **0**
- [ ] `SELECT COUNT(*) FROM decision_assessment WHERE facility_compliance_score IS NULL` → **0** (after recalc)
- [ ] `SELECT ROUND(AVG(overall_score)::numeric,1) FROM decision_assessment` matches `GET /analytics/overview → nationalAvgScore`
- [ ] Province `avgScore` from API matches `SELECT province, ROUND(AVG(overall_score)::numeric,1) FROM schools GROUP BY province`

**API response assertions:**
- [ ] `GET /analytics/overview` includes: `nationalAvgScore`, `nationalAvgAgeScore`, `nationalAvgAccessScore`, `nationalAvgComplianceScore`, `totalStudents`, `totalTeachers`, `kmzCoverageRate`, `surveyCompletionRate`, `totalEstimatedBudgetRwf`, `lastCalculatedAt`, `nationalRecommendations`
- [ ] `GET /analytics/overview → byPriority` includes `medium` key
- [ ] `GET /analytics/overview → provinceStats[]` includes `medium`, `low`, `avgScore`, `minScore`, `maxScore`
- [ ] `GET /analytics/schools/:id/metrics` includes: `studentToTeacherRatio`, `studentToLatrineRatio`, `districtAvgScore`, `provinceAvgScore`, `scoreDeltaFromDistrict`, `dataCompletenessScore`, `urgencyMonths` (non-null), `resolutionRateScore`, `riskImpactScore`, `riskProbabilityScore`

**UI checks:**
- [ ] National dashboard: no score field exceeds 100% (`aggregateScore + 5` overflow is gone)
- [ ] National dashboard: Medium Priority KPI card visible
- [ ] National dashboard: "LIVE MONITORING ENABLED" badge replaced with timestamp
- [ ] National dashboard: recommendations are data-driven (province name and school count are dynamic)
- [ ] School dashboard: "Demographic load" renamed to "Capacity Resilience"
- [ ] School dashboard: "Resolution Rate" shows computed % from `reportSummary` (not 50 default)
- [ ] School dashboard: "Decision urgency" shows computed months (not `-- mo`)
- [ ] School dashboard: hardcoded `+12.4%`, `88%`, `42ms` are removed
- [ ] School dashboard: staff-to-student shows `students ÷ teachers` format (e.g., `28:1`)
- [ ] Risk matrix: `impact` and `probability` are numerically distinct and independently derived

---

## Implementation Order Summary

| Phase | Focus | Duration | Risk |
|---|---|---|---|
| **1** | Calculation integrity — fix wrong/inverted/overflowing numbers | 2–3 days | Low |
| **2** | Analytical completeness — missing KPIs, extended DTOs and queries | 3–4 days | Medium |
| **3** | UX governance — deceptive UI removed, export, score legend | 2 days | Low |
| **4** | Strategic enhancements — history, drill-down, action tracking, risk matrix | 5–7 days | Medium |
| **5** | Re-score all schools + validate | 1 day | Low |

**Total estimated effort:** 13–17 working days

---

## Appendix A — Final Score Weight Reference

| Component | Weight | Direction | Default when no data |
|---|---|---|---|
| Infrastructure (building conditions) | **35%** | Higher = healthier structure | **0** (data gap flagged) |
| Building age | **25%** | Higher = newer average age | **50** (established year used; neutral) |
| Road accessibility | **10%** | Higher = better road | **50** (no road data) |
| Capacity resilience (population) | **10%** | Higher = more headroom | **50** (data gap flagged) |
| Facility compliance (survey) | **15%** | Higher = more compliant | **50** (no survey = neutral) |
| Issue resolution rate | **5%** | Higher = more reports resolved | **50** (no reports = neutral) |
| **Total** | **100%** | — | — |

---

## Appendix B — Building Age Score Banding (Final)

| Average Building Age | Score | Rationale |
|---|---|---|
| ≤ 10 years | **95** | Near-new — minimal depreciation |
| 11–20 years | **80** | Low maintenance burden |
| 21–30 years | **60** | Moderate — planned maintenance needed |
| 31–40 years | **45** | Significant maintenance backlog likely |
| 41–50 years | **30** | Major refurbishment required |
| 51–60 years | **20** | Structural risk — renovation urgent |
| > 60 years | **10** | Critical — replacement / complete rebuild |

---

## Appendix C — Numeric Parsing Reference

| Source | Correct parsing pattern |
|---|---|
| `COUNT(*)` from raw query | `parseInt(String(val), 10) \|\| 0` |
| `AVG(...)` from raw query | `parseFloat(String(val)) \|\| 0` |
| `SUM(...)` from raw query | `parseFloat(String(val)) \|\| 0` |
| TypeORM entity numeric column | `parseFloat(String(entity.field)) \|\| 0` |
| Nullable numeric field | `field != null ? parseFloat(String(field)) : null` |
| Year fields (integer) | `parseInt(String(field), 10) \|\| null` |
| All final score values | `Math.min(100, Math.max(0, Math.round(raw)))` |
| All ratio displays | Guard: `denom > 0 ? num / denom : null` |
| Client-side received values | `parseFloat(String(value)) \|\| 0` before any arithmetic |

---

*Implementation plan prepared from source code audit of branch `emmy`, 2026-06-05.*
