# Dashboard Implementation Plan
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

// Safe division guard:
const ratio = denominator > 0 ? numerator / denominator : 0;

// Score clamping (apply everywhere a score is produced):
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
// All inputs are already numbers at this point; clamp for safety
const safeInfra    = Math.min(100, Math.max(0, infraScore));
const safeAge      = Math.min(100, Math.max(0, ageScore));
const safeAccess   = Math.min(100, Math.max(0, accessScore));
const safePop      = Math.min(100, Math.max(0, popScore));
const safeFacility = Math.min(100, Math.max(0, facilityScore));

// Weighted composite — weights validated with RTB domain experts
const overallScore = Math.min(100, Math.round(
  safeInfra    * 0.35 +   // Infrastructure condition (buildings)
  safeAge      * 0.25 +   // Building age / depreciation
  safeAccess   * 0.10 +   // Road accessibility
  safePop      * 0.10 +   // Demographic capacity resilience
  safeFacility * 0.15 +   // Facility survey compliance
  resolutionRateScore * 0.05,  // Issue report resolution (see §1.3)
));
```

**Also fix the stale comment at ~line 309:**  
Change `// Infrastructure score (30%)` → `// Infrastructure score (35%)`

**Also persist `facilityComplianceScore` on the `DecisionAssessment` entity** so it is returned with the assessment and does not require a second DB call on every metrics fetch.

**Entity change** (`decision-assessment.entity.ts`):
```ts
@Column({ type: 'float', nullable: true, default: null })
facilityComplianceScore: number | null;
```

**Service change** — update the upsert block to include `facilityComplianceScore: facilityScore`.

---

### 1.2 Fix the National Aggregate Score (C-01) — Server-Side Mean

**File:** `server/src/modules/analytics/analytics.service.ts` — `getOverview()`

Replace the client-side synthetic formula with a true arithmetic mean computed in the DB:

```ts
const [avgScoreResult] = await this.schoolRepository
  .createQueryBuilder('s')
  .select('ROUND(AVG(s.overallScore)::numeric, 1)', 'nationalAvgScore')
  .addSelect('COUNT(*)', 'scoredCount')
  .where('s.overallScore IS NOT NULL')
  .getRawMany();

const nationalAvgScore = parseFloat(String(avgScoreResult?.nationalAvgScore)) || 0;
const scoredSchoolCount = parseInt(String(avgScoreResult?.scoredCount), 10) || 0;
```

Return `nationalAvgScore` and `scoredSchoolCount` in the `getOverview()` response.

**File:** `client/src/pages/Dashboard.tsx` (~line 98)

Remove the synthetic formula entirely. Use the server-provided value:
```ts
const aggregateScore = Math.min(100, Math.max(0, Math.round(
  parseFloat(String(stats?.nationalAvgScore)) || 0
)));
```

---

### 1.3 Compute `urgencyMonths` and `resolutionRateScore` (A-01, C-04)

**File:** `server/src/modules/analytics/analytics.service.ts` — `calculateSchoolScore()`

Add urgency calculation after `overallScore` is determined:

```ts
// urgencyMonths: how many months before intervention is critical
// Formula: based on score degradation trajectory
// < 35 = critical → 0 months (immediate)
// 35–55 = high → 6–12 months
// 55–75 = medium → 13–24 months
// >= 75 = low → 25–36 months
const urgencyMonths = (() => {
  if (overallScore < 35) return 0;
  if (overallScore < 45) return 3;
  if (overallScore < 55) return 6;
  if (overallScore < 65) return 12;
  if (overallScore < 75) return 18;
  return 36;
})();
```

**Resolution rate score for composite:**
```ts
// Count reports for this school
const reportsForScore = await this.issueReportRepository.count({ where: { schoolId: school.id } });
const resolvedForScore = await this.issueReportRepository.count({
  where: { schoolId: school.id, status: ReportStatus.SOLVED },
});
// Parse to number before dividing — count() returns number but be explicit
const resolutionRateScore = reportsForScore > 0
  ? Math.min(100, Math.round((resolvedForScore / reportsForScore) * 100))
  : 50; // Neutral default when no reports exist (not penalised for clean record)
```

**Persist `urgencyMonths` on the `DecisionAssessment` entity** (field already declared in entity but never set):
```ts
// In the upsert block:
urgencyMonths,
resolutionRateScore,
```

**Fix data flow to `DecisionIntelligenceScore`** (`SchoolDecisionDashboard.tsx`):  
The `resolutionRate` must come from `reportSummary`:
```ts
// In getAssessment() callback or where assessment is constructed:
const resolutionRate = reportSummary?.total > 0
  ? Math.round((reportSummary.resolved / reportSummary.total) * 100)
  : null;

// Pass into DecisionIntelligenceScore:
<DecisionIntelligenceScore
  assessment={{ ...calculatedAssessment, resolutionRate }}
  ...
/>
```

---

### 1.4 Fix the Building Age Score Banding (A-02)

**File:** `server/src/modules/analytics/analytics.service.ts` — `calculateAgeScore()` (~line 435)

```ts
private calculateAgeScore(buildings: SchoolBuilding[], establishedYear?: number): number {
  const currentYear = new Date().getFullYear();
  const buildingAges = buildings
    .filter((b) => b.yearBuilt)
    .map((b) => currentYear - parseInt(String(b.yearBuilt), 10));  // parseInt for year

  let avgAge: number;
  if (buildingAges.length > 0) {
    avgAge = buildingAges.reduce((sum, age) => sum + age, 0) / buildingAges.length;
  } else if (establishedYear) {
    avgAge = currentYear - parseInt(String(establishedYear), 10);
  } else {
    return 50; // No age data — neutral, flagged separately (see §1.6)
  }

  // Extended banding — every decade beyond 30 years degrades the score further
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

### 1.5 Fix the Infrastructure Score Default (A-03)

**File:** `server/src/modules/analytics/analytics.service.ts` — `calculateInfrastructureScore()` (~line 401)

```ts
private calculateInfrastructureScore(buildings: SchoolBuilding[]): number {
  if (!buildings || buildings.length === 0) {
    // No building records = unknown risk, not neutral.
    // Return 0 so score reflects data gap; flag hasInfraDataGap separately.
    return 0;
  }
  const conditionMap = {
    [BuildingCondition.GOOD]:     100,
    [BuildingCondition.FAIR]:      70,
    [BuildingCondition.POOR]:      30,   // was 40; POOR is closer to critical
    [BuildingCondition.CRITICAL]:  10,
  };
  const scores = buildings.map((b) => conditionMap[b.condition] ?? 50);
  const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
  return Math.min(100, Math.max(0, Math.round(avg)));
}
```

Add `hasInfraDataGap: buildings.length === 0` to the `DecisionAssessment` entity and set it in the upsert block.

---

### 1.6 Fix Population Score — Semantics and Missing-Data Flag (A-03, C-06)

**File:** `server/src/modules/analytics/analytics.service.ts` — `calculatePopulationScore()` (~line 441)

```ts
private calculatePopulationScore(
  population?: PopulationData,
  currentStudents?: number,
): { score: number; hasPopDataGap: boolean } {
  if (!population) {
    return { score: 50, hasPopDataGap: true }; // flagged separately, not scored as neutral
  }

  const capacity = Math.max(1, parseFloat(String(currentStudents)) || 300);
  const demand = parseFloat(String(population.schoolAgePopulation2km)) || 0;
  const ratio = demand / capacity;

  // Score = "capacity resilience": higher score = more headroom = healthier
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

Persist `hasPopDataGap` on the assessment entity:
```ts
@Column({ default: false })
hasPopDataGap: boolean;
```

**Rename label in `DecisionIntelligenceScore.tsx`:**  
Change `"Demographic load"` → `"Capacity Resilience"` with a tooltip: "Higher score = more capacity headroom relative to local school-age population."

---

### 1.7 Fix Risk Assessment Logic Inversions (Audit §2.1.8, §2.1.9)

**File:** `client/src/components/dashboard/RiskAssessment.tsx` (~lines 84–86, 158–161)

Impact and probability must not be algebraically derived from the same variable. Derive from semantically distinct inputs:

```ts
// Impact = how bad the outcome if the risk materialises (driven by score deficit)
const impact = Math.min(100, Math.max(0, Math.round(100 - overallScore)));

// Probability = likelihood of failure occurring in next 12 months (driven by urgency)
const probability = urgencyMonths === 0 ? 95
  : urgencyMonths <= 6  ? 75
  : urgencyMonths <= 12 ? 55
  : urgencyMonths <= 24 ? 35
  : 20;
```

**Mitigation effectiveness inversion fix (~line 158):**
```ts
// More critical issues = stretched resources = lower expected effectiveness
const effectiveness = Math.max(20, Math.min(85, 90 - criticalCount * 8));
```

---

### 1.8 Fix Staff-to-Student Ratio (C-08)

**File:** `client/src/components/dashboard/SchoolStatsCards.tsx` (~line 69)

```ts
// Education standard: students per TEACHING staff (not all staff / students)
const totalTeachers = parseFloat(String(schoolData?.totalTeachers)) || 0;
const totalStudents = parseFloat(String(schoolData?.totalStudents)) || 0;

const studentToTeacherDisplay = totalTeachers > 0
  ? `${Math.round(totalStudents / totalTeachers)}:1`
  : "No teacher data";
```

Also add to `SchoolMetricsDto` and `getSchoolMetrics()`:
```ts
dto.studentToTeacherRatio = totalTeachers > 0
  ? parseFloat((totalStudents / totalTeachers).toFixed(1))
  : null;
```

---

### 1.9 Remove False UI Elements (U-01, U-02)

**File:** `client/src/pages/Dashboard.tsx` (~line 119)  
Remove the animated "LIVE MONITORING ENABLED" badge. Replace with a static "Last updated:" timestamp sourced from `stats.lastCalculatedAt`.

**File:** `client/src/pages/SchoolDecisionDashboard.tsx` (~lines 493–519)  
Remove hardcoded `+12.4%` benchmark, `88%` reliability, and `42ms` latency fields.  
Replace benchmark with computed district comparison (see Phase 2).  
Replace reliability with actual data completeness percentage (see Phase 2).

---

### 1.10 Fix Hardcoded National Recommendations (C-07)

**File:** `server/src/modules/analytics/analytics.service.ts` — `getOverview()`

Add a `generateNationalRecommendations()` method:

```ts
private async generateNationalRecommendations(
  critical: number,
  provinceStats: any[],
): Promise<string[]> {
  const recs: string[] = [];

  if (critical > 0) {
    recs.push(`[URGENT] ${critical} school(s) require immediate infrastructure intervention.`);
  }

  // Province with lowest average score (already computed by Phase 2.2)
  const sorted = [...provinceStats].sort(
    (a, b) => parseFloat(String(a.avgScore)) - parseFloat(String(b.avgScore))
  );
  const lowestProvince = sorted[0];
  if (lowestProvince) {
    recs.push(
      `[STRATEGIC] ${lowestProvince.province} has the lowest average score (${parseFloat(String(lowestProvince.avgScore)).toFixed(0)}) — prioritise assessment coverage.`
    );
  }

  // Count critical-priority schools for WASH note (replace hardcoded 12)
  const criticalCount = await this.schoolRepository.count({
    where: { priorityLevel: PriorityLevel.CRITICAL as any },
  });
  if (criticalCount > 0) {
    recs.push(`[CRITICAL] ${criticalCount} critical-priority school(s) require urgent WASH and sanitation review.`);
  }

  return recs;
}
```

Return `nationalRecommendations` from `getOverview()` and use in `Dashboard.tsx` instead of the hardcoded strings.

---

## Phase 2 — Analytical Completeness (Priority 2 Fixes)

**Goal:** Add all missing KPIs identified in the audit.  
**Estimated effort:** 3–4 days  
**Files touched:** `analytics.service.ts`, `analytics.controller.ts`, `school-metrics.dto.ts`, `Dashboard.tsx`, `SchoolDecisionDashboard.tsx`, `SchoolStatsCards.tsx`, `DecisionIntelligenceScore.tsx`

---

### 2.1 Extended `getOverview()` — National KPIs

**File:** `server/src/modules/analytics/analytics.service.ts` — `getOverview()`

Add to the `Promise.all` block:

```ts
// National score averages (overall + per sub-dimension)
this.schoolRepository
  .createQueryBuilder('s')
  .select('ROUND(AVG(s.overallScore)::numeric, 1)',          'nationalAvgScore')
  .addSelect('ROUND(AVG(da.buildingAgeScore)::numeric, 1)',  'nationalAvgAgeScore')
  .addSelect('ROUND(AVG(da.accessibilityScore)::numeric, 1)','nationalAvgAccessScore')
  .addSelect('ROUND(AVG(da.facilityComplianceScore)::numeric, 1)', 'nationalAvgComplianceScore')
  .leftJoin('s.decisionAssessment', 'da')
  .getRawOne(),

// Total enrolled students
this.schoolRepository
  .createQueryBuilder('s')
  .select('COALESCE(SUM(s.totalStudents), 0)', 'totalStudents')
  .getRawOne(),

// Total teaching staff
this.schoolRepository
  .createQueryBuilder('s')
  .select('COALESCE(SUM(COALESCE(s.maleTeachers,0) + COALESCE(s.femaleTeachers,0)), 0)', 'totalTeachers')
  .getRawOne(),

// KMZ coverage rate
this.schoolRepository
  .createQueryBuilder('s')
  .select('COUNT(*)', 'withKmz')
  .where("s.kmzStatus IS NOT NULL AND s.kmzStatus != ''")
  .getRawOne(),

// Survey completion
this.surveyRepository
  .createQueryBuilder('sv')
  .select('COUNT(DISTINCT sv.schoolId)', 'withSurvey')
  .getRawOne(),

// Total estimated rehabilitation budget
this.assessmentRepository
  .createQueryBuilder('da')
  .select('COALESCE(SUM(da.estimatedBudgetRwf), 0)', 'totalBudget')
  .where('da.estimatedBudgetRwf IS NOT NULL')
  .getRawOne(),

// Last score recalculation timestamp
this.assessmentRepository
  .createQueryBuilder('da')
  .select('MAX(da.updatedAt)', 'lastCalculatedAt')
  .getRawOne(),
```

**Parse all results before returning — all COUNT/SUM/AVG from raw queries are strings:**
```ts
return {
  totalSchools,
  byPriority,
  nationalAvgScore:              parseFloat(String(scoreAvg?.nationalAvgScore)) || 0,
  nationalAvgAgeScore:           parseFloat(String(scoreAvg?.nationalAvgAgeScore)) || 0,
  nationalAvgAccessScore:        parseFloat(String(scoreAvg?.nationalAvgAccessScore)) || 0,
  nationalAvgComplianceScore:    parseFloat(String(scoreAvg?.nationalAvgComplianceScore)) || 0,
  totalStudents:                 parseInt(String(studentsResult?.totalStudents), 10) || 0,
  totalTeachers:                 parseInt(String(teachersResult?.totalTeachers), 10) || 0,
  kmzCoverageRate: totalSchools > 0
    ? Math.round((parseInt(String(kmzResult?.withKmz), 10) / totalSchools) * 100)
    : 0,
  surveyCompletionRate: totalSchools > 0
    ? Math.round((parseInt(String(surveyResult?.withSurvey), 10) / totalSchools) * 100)
    : 0,
  totalEstimatedBudgetRwf: parseFloat(String(budgetResult?.totalBudget)) || 0,
  lastCalculatedAt: lastCalcResult?.lastCalculatedAt ?? null,
  nationalRecommendations,
  provinceStats,
  criticalSchools,
  recentAssessments,
};
```

---

### 2.2 Extended Provincial Stats — Include Average Score and All Bands

**File:** `server/src/modules/analytics/analytics.service.ts` — province query (~line 67)

```ts
const provinceStats = await this.schoolRepository
  .createQueryBuilder('s')
  .select('s.province', 'province')
  .addSelect('COUNT(*)', 'total')
  .addSelect("SUM(CASE WHEN s.priorityLevel = 'critical' THEN 1 ELSE 0 END)", 'critical')
  .addSelect("SUM(CASE WHEN s.priorityLevel = 'high'     THEN 1 ELSE 0 END)", 'high')
  .addSelect("SUM(CASE WHEN s.priorityLevel = 'medium'   THEN 1 ELSE 0 END)", 'medium')
  .addSelect("SUM(CASE WHEN s.priorityLevel = 'low'      THEN 1 ELSE 0 END)", 'low')
  .addSelect('ROUND(AVG(s.overallScore)::numeric, 1)', 'avgScore')
  .addSelect('MIN(s.overallScore)', 'minScore')
  .addSelect('MAX(s.overallScore)', 'maxScore')
  .groupBy('s.province')
  .orderBy('total', 'DESC')
  .getRawMany();

// Normalise every numeric field — all raw query results are strings in PostgreSQL driver
return provinceStats.map((p) => ({
  province: p.province,
  total:    parseInt(String(p.total), 10)    || 0,
  critical: parseInt(String(p.critical), 10) || 0,
  high:     parseInt(String(p.high), 10)     || 0,
  medium:   parseInt(String(p.medium), 10)   || 0,
  low:      parseInt(String(p.low), 10)      || 0,
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
// Parse both operands before dividing — entity fields may be strings
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
// Parse latrineCount as float — may be stored as string in JSONB or numeric column
const latrineCount = parseFloat(String(latestSurvey?.latrineCount ?? school.latrineCount ?? 0)) || 0;
dto.latrineCount = latrineCount;
dto.studentToLatrineRatio = latrineCount > 0
  ? parseFloat((safeStudents / latrineCount).toFixed(1))
  : null;
```

#### Utility and Connectivity Fields
```ts
dto.hasElectricity  = school.hasElectricity  ?? null;
dto.waterSourceType = school.waterSourceType ?? null;
dto.hasInternet     = school.hasInternet     ?? null;
```

#### School Age and Establishment Year
```ts
const establishedYear = school.establishedYear
  ? parseInt(String(school.establishedYear), 10)
  : null;
dto.establishedYear = establishedYear;
dto.schoolAge = establishedYear
  ? new Date().getFullYear() - establishedYear
  : null;
```

#### Last Survey Date
```ts
dto.lastSurveyDate = latestSurvey?.createdAt?.toISOString() ?? null;
```

#### District and Provincial Peer Averages
```ts
const [districtAvgResult, provinceAvgResult] = await Promise.all([
  this.schoolRepository
    .createQueryBuilder('s')
    .select('ROUND(AVG(s.overallScore)::numeric, 1)', 'avg')
    .where('s.district = :district AND s.id != :id', { district: school.district, id: school.id })
    .getRawOne(),
  this.schoolRepository
    .createQueryBuilder('s')
    .select('ROUND(AVG(s.overallScore)::numeric, 1)', 'avg')
    .where('s.province = :province AND s.id != :id', { province: school.province, id: school.id })
    .getRawOne(),
]);

// Parse AVG results (PostgreSQL driver returns numeric as string)
dto.districtAvgScore = districtAvgResult?.avg != null
  ? parseFloat(String(districtAvgResult.avg))
  : null;
dto.provinceAvgScore = provinceAvgResult?.avg != null
  ? parseFloat(String(provinceAvgResult.avg))
  : null;
dto.scoreDeltaFromDistrict = dto.districtAvgScore != null
  ? parseFloat((dto.overallScore - dto.districtAvgScore).toFixed(1))
  : null;
dto.scoreDeltaFromProvince = dto.provinceAvgScore != null
  ? parseFloat((dto.overallScore - dto.provinceAvgScore).toFixed(1))
  : null;
```

#### Data Completeness Score
```ts
// Binary checks — each key field contributes equally to completeness
const completenessChecks = [
  buildings.length > 0,                              // building records exist
  safeStudents > 0,                                  // student count populated
  safeTeachers > 0,                                  // teacher count populated
  school.province != null && school.province !== '',
  school.district != null && school.district !== '',
  school.roadStatusPercentage != null,               // accessibility data
  establishedYear != null,                           // age context
  latestSurvey != null,                              // survey conducted
  (school.populationData?.length ?? 0) > 0,          // population data linked
  school.kmzStatus != null && school.kmzStatus !== '',  // GIS data uploaded
];
const filledCount = completenessChecks.filter(Boolean).length;
dto.dataCompletenessScore = Math.round((filledCount / completenessChecks.length) * 100);
```

#### KMZ Status
```ts
dto.kmzStatus = school.kmzStatus ?? null;
```

---

### 2.4 Update `SchoolMetricsDto` for All New Fields

**File:** `server/src/modules/analytics/dto/school-metrics.dto.ts`

Add after existing fields:
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

@ApiPropertyOptional({ nullable: true, description: 'School age in years from establishedYear to today' })
schoolAge: number | null;

@ApiPropertyOptional({ nullable: true })
establishedYear: number | null;

@ApiPropertyOptional({ nullable: true, description: 'ISO 8601 date of most recent facility survey' })
lastSurveyDate: string | null;

@ApiPropertyOptional({ nullable: true, description: 'Average overallScore of other schools in same district' })
districtAvgScore: number | null;

@ApiPropertyOptional({ nullable: true, description: 'Average overallScore of other schools in same province' })
provinceAvgScore: number | null;

@ApiPropertyOptional({ nullable: true, description: 'This school score minus district average (positive = above)' })
scoreDeltaFromDistrict: number | null;

@ApiPropertyOptional({ nullable: true })
scoreDeltaFromProvince: number | null;

@ApiProperty({ minimum: 0, maximum: 100, description: '% of key data fields populated (10-point checklist)' })
dataCompletenessScore: number;

@ApiPropertyOptional({ nullable: true })
kmzStatus: string | null;

@ApiPropertyOptional({ nullable: true })
resolutionRateScore: number | null;

@ApiPropertyOptional({ nullable: true })
hasInfraDataGap: boolean | null;

@ApiPropertyOptional({ nullable: true })
hasPopDataGap: boolean | null;
```

---

### 2.5 Add Medium Priority KPI Card (A-04)

**File:** `client/src/pages/Dashboard.tsx`

```tsx
// Change grid from 4 to 5 columns and add medium card:
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
    // server-computed arithmetic mean — no +5 offset; clamp to prevent overflow
    score: Math.min(100, aggregateScore),
    icon: Building2,
  },
  {
    label: "Buildings Depreciation",
    // Average depreciation index: 100 − national avg buildingAgeScore
    score: Math.min(100, Math.max(0,
      Math.round(100 - (parseFloat(String(stats?.nationalAvgAgeScore)) || 50))
    )),
    icon: MapPin,
  },
  {
    label: "Capacity Utilisation",
    // nationalCapacityUtilisation computed server-side (totalStudents / totalCapacity)
    score: stats?.nationalCapacityUtilisation != null
      ? Math.min(100, Math.max(0, Math.round(parseFloat(String(stats.nationalCapacityUtilisation)))))
      : null,
    icon: Users,
  },
  {
    label: "School Accessibility",
    score: Math.min(100, Math.max(0,
      Math.round(parseFloat(String(stats?.nationalAvgAccessScore)) || 0)
    )),
    icon: ClipboardCheck,
  },
  {
    label: "Facility Compliance",
    score: Math.min(100, Math.max(0,
      Math.round(parseFloat(String(stats?.nationalAvgComplianceScore)) || 0)
    )),
    icon: ClipboardCheck,
  },
]}
```

Add `nationalCapacityUtilisation` to `getOverview()` service method (aggregate students ÷ capacity across all program records via application-level loop since `educationPrograms` is JSONB).

---

### 2.7 Add Score Weights to `DecisionIntelligenceScore` (U-03)

**File:** `client/src/components/dashboard/DecisionIntelligenceScore.tsx`

Add weight annotations to each metric display:
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

**Goal:** Remove deceptive UI elements, add data quality visibility, export, and accessibility.  
**Estimated effort:** 2 days

---

### 3.1 Data Completeness Indicators (U-04)

**National dashboard** (`Dashboard.tsx`):  
Add a sub-line below the KPI row:
```tsx
<div className="text-xs text-muted-foreground text-center">
  Survey coverage: <strong>{stats?.surveyCompletionRate ?? '--'}%</strong> schools surveyed ·
  GIS coverage: <strong>{stats?.kmzCoverageRate ?? '--'}%</strong> with KMZ data
</div>
```

**School dashboard** (`SchoolDecisionDashboard.tsx`):  
Add a warning banner when `dataCompletenessScore < 60`:
```tsx
{metrics?.dataCompletenessScore < 60 && (
  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-700 font-medium">
    ⚠ Data completeness: {metrics.dataCompletenessScore}% — displayed scores may not reflect actual conditions.
  </div>
)}
```

---

### 3.2 Last Calculated Timestamp (U-05)

**Both dashboards — replace "LIVE MONITORING ENABLED":**
```tsx
<div className="text-[10px] font-black tracking-widest text-muted-foreground">
  SCORES AS OF {stats?.lastCalculatedAt
    ? new Date(stats.lastCalculatedAt).toLocaleDateString('en-RW', { dateStyle: 'medium' })
    : '—'}
</div>
```

---

### 3.3 Export Endpoint (U-06)

Add to `analytics.controller.ts`:
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

Add to `analytics.service.ts`:
```ts
async exportNationalCsv(): Promise<string> {
  const assessments = await this.assessmentRepository.find({
    relations: ['school'],
    order: { overallScore: 'ASC' },
  });

  const header = [
    'Name', 'Code', 'Province', 'District', 'Overall Score', 'Priority Level',
    'Infrastructure Score', 'Building Age Score', 'Accessibility Score',
    'Facility Compliance Score', 'Total Students', 'Estimated Budget (RWF)',
    'Urgency (months)', 'Last Calculated',
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
    parseFloat(String(a.estimatedBudgetRwf ?? 0)).toFixed(0),
    a.urgencyMonths ?? '',
    a.updatedAt?.toISOString() ?? '',
  ].join(','));

  return [header, ...rows].join('\n');
}
```

**Frontend:** Add an `<ExportButton>` that calls `GET /api/v1/analytics/export` and triggers a browser download. Guard with `hasPermission('EXPORT_REPORTS')`.

---

### 3.4 Score Interpretation Legend (Audit §3.2)

**File:** `client/src/components/dashboard/DecisionIntelligenceScore.tsx`

Add a collapsible guide below the score display:
```tsx
<details className="text-[10px] text-muted-foreground mt-2 border-t border-border/10 pt-2">
  <summary className="cursor-pointer font-black uppercase tracking-widest">Score Guide ▾</summary>
  <div className="mt-2 grid grid-cols-4 gap-1">
    <div className="rounded p-1 bg-destructive/10 text-destructive text-center">
      <div className="font-black">0–34</div><div>Critical</div>
    </div>
    <div className="rounded p-1 bg-orange-500/10 text-orange-600 text-center">
      <div className="font-black">35–54</div><div>High</div>
    </div>
    <div className="rounded p-1 bg-amber-500/10 text-amber-600 text-center">
      <div className="font-black">55–74</div><div>Medium</div>
    </div>
    <div className="rounded p-1 bg-emerald-500/10 text-emerald-600 text-center">
      <div className="font-black">75–100</div><div>Optimal</div>
    </div>
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

  // Parse on write: all scores must be stored as float, not string
  @Column({ type: 'float' })       overallScore: number;
  @Column({ type: 'float' })       infrastructureScore: number;
  @Column({ type: 'float' })       buildingAgeScore: number;
  @Column({ type: 'float' })       accessibilityScore: number;
  @Column({ type: 'float' })       populationPressureScore: number;
  @Column({ type: 'float', nullable: true }) facilityComplianceScore: number | null;
  @Column({ type: 'float', nullable: true }) resolutionRateScore: number | null;

  @CreateDateColumn() recordedAt: Date;
}
```

Write a snapshot inside `calculateSchoolScore()` every recalculation:
```ts
await this.scoreHistoryRepository.save({
  schoolId: school.id,
  overallScore:           parseFloat(String(overallScore)),
  infrastructureScore:    parseFloat(String(infraScore)),
  buildingAgeScore:       parseFloat(String(ageScore)),
  accessibilityScore:     parseFloat(String(accessScore)),
  populationPressureScore: parseFloat(String(popScore)),
  facilityComplianceScore: parseFloat(String(facilityScore)),
  resolutionRateScore:    parseFloat(String(resolutionRateScore)),
});
```

**New endpoint:**
```
GET /api/v1/analytics/schools/:id/history?months=12
```

Returns array of `{ recordedAt, overallScore, ... }` sorted ASC — used to render sparklines on school dashboard.

---

### 4.2 Genuine District/Provincial Peer Benchmarking (E-02)

Already covered by `districtAvgScore`, `provinceAvgScore`, and `scoreDeltaFromDistrict/Province` added in Phase 2.

Replace the hardcoded "Regional top 25%" buckets in `SchoolDecisionDashboard.tsx` with:
```ts
const peerLabel = (() => {
  const delta = metrics?.scoreDeltaFromDistrict;
  if (delta == null) return 'Insufficient peer data';
  if (delta >= 10) return `+${delta.toFixed(1)} vs district avg — Top performer`;
  if (delta >= 0)  return `+${delta.toFixed(1)} vs district avg`;
  if (delta >= -10) return `${delta.toFixed(1)} vs district avg`;
  return `${delta.toFixed(1)} vs district avg — Below average`;
})();
```

---

### 4.3 Province → District → School Drill-down (E-03)

**New endpoint:**
```
GET /api/v1/analytics/hierarchy?province=Kigali%20City&district=Nyarugenge
```

Returns school list with scores filtered by the given geographic scope. If only `province` is provided, returns district-level aggregates. If both are provided, returns individual school rows.

`DistributionChart` component becomes clickable: clicking a province bar sets a `selectedProvince` state, expanding to district breakdown.

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

Surface in `SchoolDecisionDashboard.tsx`: render each recommendation with an "Open" status badge, an "Assign" dropdown, and a "Mark done" button. Changes persist via:
```
PATCH /api/v1/analytics/actions/:id  { status, assignedTo, dueDate }
```

---

### 4.5 Genuine Risk Matrix (E-07)

Replace algebraically linked impact/probability with semantically distinct two-axis assessment computed server-side and returned in `SchoolMetricsDto`:

```ts
// Impact axis: driven by score deficit, critical buildings, and urgency
const criticalBuildingCount = buildings.filter(
  b => b.condition === BuildingCondition.CRITICAL || b.condition === BuildingCondition.POOR
).length;

const impactScore = Math.min(100, Math.round(
  (100 - overallScore)                                  * 0.50 +
  (criticalBuildingCount / Math.max(1, buildings.length)) * 100 * 0.30 +
  (urgencyMonths === 0 ? 100 : Math.max(0, 100 - urgencyMonths * 2)) * 0.20
));

// Probability axis: driven by building age, data gaps, and survey recency
const daysSinceLastSurvey = latestSurvey
  ? (Date.now() - new Date(latestSurvey.createdAt).getTime()) / 86_400_000
  : Infinity;

const probabilityScore = Math.min(100, Math.round(
  Math.min(100, (avgBuildingAge ?? 50) * 1.5)                    * 0.50 +
  (hasPopDataGap ? 60 : 20)                                       * 0.25 +
  (daysSinceLastSurvey > 365 ? 80 : daysSinceLastSurvey > 180 ? 50 : 20) * 0.25
));

dto.riskImpactScore       = impactScore;
dto.riskProbabilityScore  = probabilityScore;
```

Add `riskImpactScore` and `riskProbabilityScore` to `SchoolMetricsDto`. Use these in `RiskAssessment.tsx` instead of the local derivation.

---

## Phase 5 — Validation & Data Migration

**Goal:** Ensure all existing records are re-scored and data is consistent after all formula changes.

### 5.1 Re-score All Schools

After deploying Phase 1 and 2 server changes, trigger:
```
POST /api/v1/analytics/recalculate-all
```

`recalculateAllScores()` already exists. With the new formula, all `DecisionAssessment` rows will be updated and `ScoreHistory` snapshots will be written.

### 5.2 Back-fill Score History Baseline

One-time migration script (add to seed or a dedicated migration endpoint):
```ts
const assessments = await assessmentRepository.find({ relations: ['school'] });
for (const a of assessments) {
  await scoreHistoryRepository.save({
    schoolId:               a.schoolId,
    overallScore:           parseFloat(String(a.overallScore)),
    infrastructureScore:    parseFloat(String(a.infrastructureScore)),
    buildingAgeScore:       parseFloat(String(a.buildingAgeScore)),
    accessibilityScore:     parseFloat(String(a.accessibilityScore)),
    populationPressureScore: parseFloat(String(a.populationPressureScore)),
    facilityComplianceScore: a.facilityComplianceScore != null
      ? parseFloat(String(a.facilityComplianceScore)) : null,
    recordedAt: a.updatedAt,
  });
}
```

### 5.3 Validation Checklist

Run these checks before closing each phase:

**Database:**
- [ ] `SELECT COUNT(*) FROM decision_assessment WHERE overall_score > 100 OR overall_score < 0` → 0
- [ ] `SELECT COUNT(*) FROM decision_assessment WHERE urgency_months IS NULL` → 0
- [ ] `SELECT COUNT(*) FROM decision_assessment WHERE facility_compliance_score IS NULL` → 0 (after Phase 1 recalc)
- [ ] `SELECT province, ROUND(AVG(overall_score)::numeric,1) FROM schools GROUP BY province` — matches `provinceStats.avgScore`

**API responses:**
- [ ] `GET /analytics/overview` includes `nationalAvgScore`, `byPriority.medium`, `totalStudents`, `totalTeachers`, `kmzCoverageRate`, `surveyCompletionRate`, `lastCalculatedAt`
- [ ] `GET /analytics/schools/:id/metrics` includes `studentToTeacherRatio`, `districtAvgScore`, `dataCompletenessScore`, `urgencyMonths` (non-null)

**UI checks:**
- [ ] National dashboard: no score field exceeds 100%; "Buildings Health" cannot show 102%
- [ ] National dashboard: Medium Priority KPI card is visible
- [ ] National dashboard: "LIVE MONITORING ENABLED" badge is removed
- [ ] School dashboard: "Demographic load" label → "Capacity Resilience"
- [ ] School dashboard: "Resolution Rate" shows actual % (not 50% default)
- [ ] School dashboard: "Decision urgency" shows computed months (not `-- mo`)
- [ ] School dashboard: hardcoded `+12.4%`, `88%`, `42ms` are gone
- [ ] Staff ratio shows students÷teachers (e.g. `28:1`) not `0.03`
- [ ] Risk matrix impact and probability are distinct numbers, not simply scaled versions of the same value

---

## Implementation Order Summary

| Phase | Focus | Duration | Risk |
|---|---|---|---|
| **1** | Calculation integrity — fix wrong/overflowing/inverted numbers | 2–3 days | Low |
| **2** | Analytical completeness — all missing KPIs, extended DTOs and queries | 3–4 days | Medium |
| **3** | UX governance — deceptive UI removed, export, legends | 2 days | Low |
| **4** | Strategic enhancements — score history, drill-down, action tracking | 5–7 days | Medium |
| **5** | Re-score and validate | 1 day | Low |

**Total estimated effort:** 13–17 working days

---

## Appendix A — Final Score Weight Reference

| Component | Weight | Direction | Default when missing |
|---|---|---|---|
| Infrastructure (building conditions) | **35%** | Higher = healthier structure | **0** (data gap — not 50) |
| Building age | **25%** | Higher = newer average age | **50** (if only established year; neutral) |
| Road accessibility | **10%** | Higher = better access road | **50** (if no road data) |
| Capacity resilience (population) | **10%** | Higher = more headroom | **50** (data gap flagged separately) |
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
| > 60 years | **10** | Critical — replacement/complete rebuild |

---

## Appendix C — Numeric Parsing Reference

| Source | Correct parsing pattern |
|---|---|
| `COUNT(*)` from raw query | `parseInt(String(val), 10) \|\| 0` |
| `AVG(...)` from raw query | `parseFloat(String(val)) \|\| 0` |
| `SUM(...)` from raw query | `parseFloat(String(val)) \|\| 0` |
| TypeORM entity numeric column | `parseFloat(String(entity.field)) \|\| 0` |
| Nullable numeric field | `field != null ? parseFloat(String(field)) : null` |
| Year fields | `parseInt(String(field), 10) \|\| null` |
| All final score values | `Math.min(100, Math.max(0, Math.round(raw)))` |
| All ratio displays | Guard: `denom > 0 ? num / denom : null` |
| Aggregate string→number in client | `parseFloat(String(value)) \|\| 0` before any arithmetic |

---

*Implementation plan prepared from source code audit of branch `emmy`, 2026-06-05.*
