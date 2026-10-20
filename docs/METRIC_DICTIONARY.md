# Metric Dictionary

> WS1.1. Every number on the dashboards, how it is calculated, and where it
> comes from. Terms follow [GLOSSARY.md](GLOSSARY.md) (draft for RTB review).
>
> **Single source:** the entries below are generated from the in-app metric
> help registry `client/src/components/metric-help/metrics.ts`. The `id` of each
> entry is the id used by the `<MetricInfo id="…"/>` button in the UI. Change
> the registry first, then regenerate this file.

## Ground rules

- **Active schools only.** Every national aggregate counts schools with status
  `active` only (`server/src/common/school/active-school.ts`). Inactive and
  Under Renovation schools are excluded.
- **Access level.** National figures are limited to the schools the user may
  see (`server/src/common/scope/access-scope.ts`): National ▸ Province ▸
  District ▸ Sector ▸ School.
- **One scoring model.** `server/src/modules/analytics/scoring.constants.ts`.
  School Condition Score = 35% Infrastructure + 25% Building Age Score + 15%
  Facility Compliance + 10% Accessibility + 10% Population Pressure + 5%
  Resolution Rate. Intervention Priority: Critical < 35, High < 55, Medium <
  75, Low ≥ 75.
- **Missing data → neutral 50, always flagged.** The server returns
  `dataGaps` (per school: `infrastructure`, `buildingAge`, `accessibility`,
  `population`, `facilityCompliance`, `resolution`; national: counts of
  infrastructure and population gaps). The UI marks those values
  "Estimated — missing data".
- **Computed on the server.** Dashboards render server values. The only
  browser-side derivations left are list orderings (the "Buildings needing
  attention" ranking) and the issue-report month comparison on the school
  summary card.
- **Units** come from `client/src/lib/format.ts` (ha for land, RWF, Kigali dates).

## Verification

- Golden dataset: `server/src/modules/analytics/golden/golden-dataset.ts`
  (6 schools, hand-calculated) with `golden-dataset.spec.ts`.
- Indicative risk rules: `server/src/modules/analytics/risk-assessment.spec.ts`.
- SQL cross-check of national KPIs (read-only), from `/server`:
  `npx ts-node --transpile-only scripts/verify-dashboards.ts`
  (exit 0 = zero diffs).

## School Condition Score and school profile

### School Condition Score

- **id:** `school.conditionScore`
- **Definition:** A 0–100 score of a school's overall physical and operational condition. Higher is better.
- **Formula:** round(0.35 × Infrastructure + 0.25 × Building Age Score + 0.15 × Facility Compliance + 0.10 × Accessibility + 0.10 × Population Pressure + 0.05 × Resolution Rate). Each component is 0–100. Weights: Infrastructure 35% · Building Age Score 25% · Facility Compliance 15% · Accessibility 10% · Population Pressure 10% · Resolution Rate 5%.
- **Source fields:** `decision_assessments.overallScore (copied to schools.overallScore)`, `the six component scores below`
- **Filters:** The selected school (any status), if it is within the user's access level.
- **Units:** Score 0–100 (whole number, no % sign)
- **Missing data:** Any component without data uses the neutral 50 and is flagged. The composite is still calculated; check the component flags before relying on it.
- **Endpoint:** `GET /api/v1/analytics/schools/:id/metrics`
- **Shown on:** School dashboard; Decision queue (Analytics ▸ Decisions)
- **Notes:** Recalculated whenever the school, its buildings, surveys or reports change, or from Recalculate.

### Intervention Priority

- **id:** `school.priority`
- **Definition:** How urgently the school needs support, from its School Condition Score.
- **Formula:** Critical < 35 · High 35–54 · Medium 55–74 · Low ≥ 75.
- **Source fields:** `decision_assessments.priorityLevel`
- **Filters:** The selected school (any status), if it is within the user's access level.
- **Units:** Band: Critical / High / Medium / Low
- **Missing data:** Unscored schools have no priority and are shown as “Not assessed”.
- **Endpoint:** `GET /api/v1/analytics/schools/:id/metrics`
- **Shown on:** School dashboard; Decision queue (Analytics ▸ Decisions)

### Months to Intervention

- **id:** `school.urgencyMonths`
- **Definition:** Recommended time before action is taken, from the score band.
- **Formula:** Score < 35 → 0 (now) · < 45 → 3 · < 55 → 6 · < 65 → 12 · < 75 → 18 · otherwise 36 months.
- **Source fields:** `decision_assessments.urgencyMonths`
- **Filters:** The selected school (any status), if it is within the user's access level.
- **Units:** Months
- **Missing data:** Not shown when the school has not been scored.
- **Endpoint:** `GET /api/v1/analytics/schools/:id/metrics`
- **Shown on:** School dashboard; Decision queue (Analytics ▸ Decisions)

### Data Completeness

- **id:** `school.dataCompleteness`
- **Definition:** Share of 10 key profile items that are filled in.
- **Formula:** Items: assessed buildings, enrolment, teachers, province, district, road status, established year, a facility survey, population data, a processed site map. Completeness = filled ÷ 10 × 100.
- **Source fields:** `schools.*`, `school_buildings`, `school_facility_surveys`, `population_data`
- **Filters:** The selected school (any status), if it is within the user's access level.
- **Units:** %
- **Missing data:** Each missing item lowers the percentage. Below 60% a warning is shown.
- **Endpoint:** `GET /api/v1/analytics/schools/:id/metrics`
- **Shown on:** School dashboard

### Difference from district average

- **id:** `school.peerDelta`
- **Definition:** This school's score minus the average of the other active schools in its district.
- **Formula:** School Condition Score − mean(School Condition Score of other active schools in the same district).
- **Source fields:** `schools.overallScore`, `schools.district`
- **Filters:** Other active schools in the same district (this school excluded).
- **Units:** Score points (+ above, − below)
- **Missing data:** Not shown when the district has no other scored schools.
- **Endpoint:** `GET /api/v1/analytics/schools/:id/metrics`
- **Shown on:** School dashboard

### Total students

- **id:** `school.totalStudents`
- **Definition:** Students enrolled at the school.
- **Formula:** Σ programme enrolment when recorded, otherwise the school's total students field.
- **Source fields:** `schools.educationPrograms[].totalStudents`, `schools.totalStudents`
- **Filters:** The selected school (any status), if it is within the user's access level.
- **Units:** Students
- **Missing data:** Shown as 0 when nothing is recorded.
- **Endpoint:** `GET /api/v1/analytics/schools/:id/metrics`
- **Shown on:** School dashboard

### Capacity Utilisation

- **id:** `school.capacityUtilisation`
- **Definition:** How full the school is compared with its seat capacity. Above 100% means over capacity.
- **Formula:** Total students ÷ Σ programme capacity × 100, one decimal.
- **Source fields:** `schools.educationPrograms[].totalStudents`, `schools.educationPrograms[].capacity`
- **Filters:** The selected school (any status), if it is within the user's access level.
- **Units:** %
- **Missing data:** “No capacity data yet” when no programme capacity is recorded.
- **Endpoint:** `GET /api/v1/analytics/schools/:id/metrics`
- **Shown on:** School dashboard

### Total staff

- **id:** `school.totalStaff`
- **Definition:** Teaching, administrative and support staff.
- **Formula:** Teachers + admin staff (male + female) + support staff (male + female).
- **Source fields:** `schools.maleTeachers / femaleTeachers / totalTeachers`, `schools.maleAdminStaff / femaleAdminStaff`, `schools.maleSupportStaff / femaleSupportStaff`
- **Filters:** The selected school (any status), if it is within the user's access level.
- **Units:** People
- **Missing data:** Missing fields count as 0.
- **Endpoint:** `GET /api/v1/analytics/schools/:id/metrics`
- **Shown on:** School dashboard

### Student:Teacher Ratio

- **id:** `school.studentTeacherRatio`
- **Definition:** Students per teacher (teaching staff only).
- **Formula:** Total students ÷ teachers. Teachers = male + female teachers when recorded, otherwise the total teachers field (same rule as the national total).
- **Source fields:** `schools.maleTeachers`, `schools.femaleTeachers`, `schools.totalTeachers`
- **Filters:** The selected school (any status), if it is within the user's access level.
- **Units:** Ratio, e.g. 32:1
- **Missing data:** “No teacher data” when there are no teachers on record.
- **Endpoint:** `GET /api/v1/analytics/schools/:id/metrics`
- **Shown on:** School dashboard

### Buildings

- **id:** `school.buildingCount`
- **Definition:** Number of building records for the school, and their average age.
- **Formula:** Count of building rows. Average age = mean(current year − year built) over buildings with a year.
- **Source fields:** `school_buildings`
- **Filters:** The selected school (any status), if it is within the user's access level.
- **Units:** Buildings; years
- **Missing data:** Average age shows “Year unknown” when no building has a year built.
- **Endpoint:** `GET /api/v1/analytics/schools/:id/metrics`
- **Shown on:** School dashboard

### Land area

- **id:** `school.landArea`
- **Definition:** Land used and unused by the school, in hectares.
- **Formula:** Total = used + unused. Used share = used ÷ total × 100.
- **Source fields:** `schools.usedLandArea`, `schools.unusedLandArea`
- **Filters:** The selected school (any status), if it is within the user's access level.
- **Units:** ha (hectares)
- **Missing data:** “No land data” when neither value is recorded.
- **Endpoint:** `GET /api/v1/analytics/schools/:id/metrics`
- **Shown on:** School dashboard

### TVET programmes

- **id:** `school.programmes`
- **Definition:** Number of trades / programmes the school offers.
- **Formula:** Count of entries in the school's programme list.
- **Source fields:** `schools.educationPrograms`
- **Filters:** The selected school (any status), if it is within the user's access level.
- **Units:** Programmes
- **Missing data:** 0 when none are recorded.
- **Endpoint:** `GET /api/v1/analytics/schools/:id/metrics`
- **Shown on:** School dashboard

### Road access

- **id:** `school.roadAccess`
- **Definition:** The recorded road-access percentage (the Accessibility component).
- **Formula:** schools.roadStatusPercentage. Good > 80%, Moderate > 50%, otherwise Limited.
- **Source fields:** `schools.roadStatusPercentage`
- **Filters:** The selected school (any status), if it is within the user's access level.
- **Units:** %
- **Missing data:** “Not recorded” when empty.
- **Endpoint:** `GET /api/v1/analytics/schools/:id/metrics`
- **Shown on:** School dashboard


## Score components (school and national)

### Infrastructure

- **id:** `component.infrastructure`
- **Definition:** Average condition of the school's assessed buildings. Weight 35%.
- **Formula:** Mean over assessed buildings of: Good 100 · Fair 70 · Poor 30 · Critical 10. Rounded.
- **Source fields:** `school_buildings.condition`
- **Filters:** Assessed buildings only: a building row with only a name and the default condition (e.g. created by a 3D model upload) is not evidence and is ignored.
- **Units:** Score 0–100
- **Missing data:** No data → the neutral value 50 is used and the component is flagged "Estimated — missing data". A 50 is never a measurement in that case.
- **Endpoint:** `GET /api/v1/analytics/schools/:id/metrics`
- **Shown on:** School dashboard; Decision queue (Analytics ▸ Decisions); National dashboard

### Building Age Score

- **id:** `component.buildingAge`
- **Definition:** A 0–100 score from the average age of the buildings. Newer buildings score higher. Weight 25%. (Replaces “Depreciation”.)
- **Formula:** Average age = mean(current year − year built). ≤ 10 y → 95 · ≤ 20 → 80 · ≤ 30 → 60 · ≤ 40 → 45 · ≤ 50 → 30 · ≤ 60 → 20 · > 60 → 10. No build years → uses the school's established year instead.
- **Source fields:** `school_buildings.yearBuilt`, `schools.establishedYear`
- **Filters:** Buildings with a year built.
- **Units:** Score 0–100
- **Missing data:** No data → the neutral value 50 is used and the component is flagged "Estimated — missing data". A 50 is never a measurement in that case. (No building year and no established year.)
- **Endpoint:** `GET /api/v1/analytics/schools/:id/metrics`
- **Shown on:** School dashboard; Decision queue (Analytics ▸ Decisions); National dashboard
- **Notes:** This is not accounting depreciation. It only reflects age.

### Facility Compliance

- **id:** `component.facilityCompliance`
- **Definition:** How many facility survey items are compliant. Weight 15%.
- **Formula:** Mean over all survey items of: Compliant 100 · Partially Compliant 50 · Non-Compliant 0. Rounded.
- **Source fields:** `school_facility_surveys.compliance`
- **Filters:** All survey rows recorded for the school.
- **Units:** Score 0–100
- **Missing data:** No data → the neutral value 50 is used and the component is flagged "Estimated — missing data". A 50 is never a measurement in that case. (No facility survey yet.)
- **Endpoint:** `GET /api/v1/analytics/schools/:id/metrics`
- **Shown on:** School dashboard; Decision queue (Analytics ▸ Decisions); National dashboard

### Accessibility

- **id:** `component.accessibility`
- **Definition:** The road-access percentage recorded for the school. Weight 10%.
- **Formula:** Accessibility = schools.roadStatusPercentage, kept between 0 and 100.
- **Source fields:** `schools.roadStatusPercentage`
- **Filters:** The selected school (any status), if it is within the user's access level.
- **Units:** Score 0–100
- **Missing data:** No data → the neutral value 50 is used and the component is flagged "Estimated — missing data". A 50 is never a measurement in that case. (Road status not recorded. A recorded 0 is a real 0.)
- **Endpoint:** `GET /api/v1/analytics/schools/:id/metrics`
- **Shown on:** School dashboard; Decision queue (Analytics ▸ Decisions); National dashboard

### Population Pressure

- **id:** `component.population`
- **Definition:** Capacity headroom compared with the school-age population within 2 km. Higher means less pressure. Weight 10%.
- **Formula:** Demand ratio = school-age population within 2 km ÷ seat capacity (Σ programme capacity; if none, current enrolment; if none, 300). Ratio ≥ 5 → 10 · ≥ 3 → 30 · ≥ 2 → 50 · ≥ 1 → 70 · < 1 → 100.
- **Source fields:** `population_data.schoolAgePopulation2km`, `schools.educationPrograms[].capacity`, `schools.totalStudents`
- **Filters:** Latest population record for the school.
- **Units:** Score 0–100
- **Missing data:** No data → the neutral value 50 is used and the component is flagged "Estimated — missing data". A 50 is never a measurement in that case. (No population record — run a population sync.)
- **Endpoint:** `GET /api/v1/analytics/schools/:id/metrics`
- **Shown on:** School dashboard; Decision queue (Analytics ▸ Decisions); National dashboard

### Resolution Rate (component)

- **id:** `component.resolution`
- **Definition:** Share of the school's Issue Reports that are Resolved. Weight 5%.
- **Formula:** round(Resolved ÷ all Issue Reports × 100).
- **Source fields:** `issue_reports.status`
- **Filters:** All Issue Reports for the school.
- **Units:** Score 0–100
- **Missing data:** No data → the neutral value 50 is used and the component is flagged "Estimated — missing data". A 50 is never a measurement in that case. (No Issue Reports — the school is not penalised for a clean record.)
- **Endpoint:** `GET /api/v1/analytics/schools/:id/metrics`
- **Shown on:** School dashboard; Decision queue (Analytics ▸ Decisions)


## Issue Reports (school)

### Resolution Rate

- **id:** `reports.resolutionRate`
- **Definition:** Share of this school's Issue Reports that are Resolved.
- **Formula:** round(Resolved ÷ all Issue Reports × 100).
- **Source fields:** `issue_reports.status`
- **Filters:** All Issue Reports for the school.
- **Units:** %
- **Missing data:** “No reports yet” when the school has no Issue Reports.
- **Endpoint:** `GET /api/v1/analytics/schools/:id/metrics (reportSummary.resolutionRate)`
- **Shown on:** School dashboard
- **Notes:** The Resolution Rate component of the score uses the same ratio.

### Open issues

- **id:** `reports.openIssues`
- **Definition:** Issue Reports not yet Resolved.
- **Formula:** Pending + Needs Intervention + Failed.
- **Source fields:** `issue_reports.status`
- **Filters:** All Issue Reports for the school.
- **Units:** Reports
- **Missing data:** 0 when there are none.
- **Endpoint:** `GET /api/v1/analytics/schools/:id/metrics (reportSummary.active)`
- **Shown on:** School dashboard

### Resolved

- **id:** `reports.resolved`
- **Definition:** Issue Reports that have been fixed.
- **Formula:** Count of reports with status Resolved.
- **Source fields:** `issue_reports.status`
- **Filters:** All Issue Reports for the school.
- **Units:** Reports
- **Missing data:** 0 when there are none.
- **Endpoint:** `GET /api/v1/analytics/schools/:id/metrics (reportSummary.resolved)`
- **Shown on:** School dashboard

### Needs Intervention

- **id:** `reports.needsIntervention`
- **Definition:** Issue Reports triaged as needing action from RTB or the district.
- **Formula:** Count of reports with status Needs Intervention.
- **Source fields:** `issue_reports.status`
- **Filters:** All Issue Reports for the school.
- **Units:** Reports
- **Missing data:** 0 when there are none.
- **Endpoint:** `GET /api/v1/analytics/schools/:id/metrics (reportSummary.critical)`
- **Shown on:** School dashboard

### This month vs last month

- **id:** `reports.monthComparison`
- **Definition:** Change in reports created this month compared with last month.
- **Formula:** (this month − last month) ÷ last month × 100, by creation date (Kigali time).
- **Source fields:** `issue_reports.createdAt`, `issue_reports.status`
- **Filters:** Issue Reports for the school created this month or last month.
- **Units:** % change
- **Missing data:** “—” when both months are zero.
- **Endpoint:** `GET /api/v1/schools/dashboard/reporting?schoolId=…`
- **Shown on:** School dashboard

### Buildings needing attention

- **id:** `reports.buildingsAttention`
- **Definition:** Buildings ranked by open Issue Reports linked to them, then by poor/critical condition.
- **Formula:** Per building: Pending and Needs Intervention counts; buildings in Poor/Critical condition are included even without reports. Top 3.
- **Source fields:** `issue_reports.buildingId`, `issue_reports.status`, `school_buildings.condition`
- **Filters:** This school's buildings and reports.
- **Units:** List
- **Missing data:** “No buildings need attention” when none qualify.
- **Endpoint:** `GET /api/v1/reports?schoolId=… (ranked in the browser)`
- **Shown on:** School dashboard
- **Notes:** A list ordering, not a score. Ranking is done in the browser.


## Indicative risk (school)

### Indicative risk

- **id:** `risk.overall`
- **Definition:** A rule-of-thumb risk estimate. It is not part of the School Condition Score and is not a measurement.
- **Formula:** Mean of the factor risk scores, where each factor risk = impact × probability ÷ 100. Critical > 70, High > 50, Medium > 30, otherwise Low.
- **Source fields:** `School Condition Score and components`, `Issue Reports`, `buildings`, `facility surveys`
- **Filters:** The selected school (any status), if it is within the user's access level.
- **Units:** Score 0–100
- **Missing data:** Uses the same neutral values as the score; flagged factors say so in their rule.
- **Endpoint:** `GET /api/v1/analytics/schools/:id/risk (also in …/metrics as riskAssessment)`
- **Shown on:** School dashboard
- **Notes:** Rules live in server/src/modules/analytics/risk-assessment.ts.

### Impact (indicative)

- **id:** `risk.impact`
- **Definition:** How bad the consequences would be if the risk happened.
- **Formula:** 50% × (100 − School Condition Score) + 30% × share of poor/critical buildings × 100 + 20% × urgency (100 if action is due now, else max(0, 100 − 2 × months)). Capped at 100.
- **Source fields:** `decision_assessments.overallScore`, `school_buildings.condition`, `decision_assessments.urgencyMonths`
- **Filters:** The selected school (any status), if it is within the user's access level.
- **Units:** 0–100
- **Missing data:** Urgency defaults to 36 months when not set.
- **Endpoint:** `GET /api/v1/analytics/schools/:id/risk`
- **Shown on:** School dashboard

### Probability (indicative)

- **id:** `risk.probability`
- **Definition:** How likely a structural or operational failure is.
- **Formula:** 50% × min(100, 1.5 × average building age) + 25% × (60 if population data is missing, else 20) + 25% × survey staleness (80 if never surveyed or > 365 days, 50 if > 180 days, else 20). Capped at 100.
- **Source fields:** `school_buildings.yearBuilt`, `population_data`, `school_facility_surveys.createdAt`
- **Filters:** The selected school (any status), if it is within the user's access level.
- **Units:** 0–100
- **Missing data:** Unknown building age is treated as 50 years (pessimistic).
- **Endpoint:** `GET /api/v1/analytics/schools/:id/risk`
- **Shown on:** School dashboard

### Mitigation effectiveness (indicative)

- **id:** `risk.mitigation`
- **Definition:** A rough guide to how much each response could help. Each strategy shows its own rule.
- **Formula:** Emergency response: 90 − 8 × open Needs Intervention reports (20–85). Repair follow-up: 85 − 3 × failed reports (20–80). Workflow: 85, or 75 if average resolution > 5 days. Preventive maintenance: 85 if Infrastructure < 50, else 70.
- **Source fields:** `issue_reports`, `decision_assessments.infrastructureScore`
- **Filters:** The selected school (any status), if it is within the user's access level.
- **Units:** %
- **Missing data:** Counts default to 0.
- **Endpoint:** `GET /api/v1/analytics/schools/:id/risk`
- **Shown on:** School dashboard


## National and decision-queue KPIs

### Schools

- **id:** `national.totalSchools`
- **Definition:** Number of active schools you can see.
- **Formula:** Count of schools with status Active.
- **Source fields:** `schools.status`
- **Filters:** Active schools only, limited to the user's access level (National, Province, District, Sector or School).
- **Units:** Schools
- **Missing data:** 0 when there are none.
- **Endpoint:** `GET /api/v1/analytics/overview (totalSchools)`
- **Shown on:** National dashboard

### Schools by Intervention Priority

- **id:** `national.priorityCount`
- **Definition:** How many active schools fall in each Intervention Priority band.
- **Formula:** Count of schools per priority band (Critical < 35, High 35–54, Medium 55–74, Low ≥ 75).
- **Source fields:** `schools.priorityLevel`
- **Filters:** Active schools only, limited to the user's access level (National, Province, District, Sector or School).
- **Units:** Schools
- **Missing data:** Schools never scored are counted as “Not assessed”.
- **Endpoint:** `GET /api/v1/analytics/overview (byPriority)`
- **Shown on:** National dashboard; Decision queue (Analytics ▸ Decisions)

### Average School Condition Score

- **id:** `national.avgConditionScore`
- **Definition:** The mean School Condition Score of the active schools you can see.
- **Formula:** Mean of School Condition Score over scored active schools, one decimal.
- **Source fields:** `decision_assessments.overallScore`
- **Filters:** Active schools only, limited to the user's access level (National, Province, District, Sector or School). Only schools that have been scored.
- **Units:** Score 0–100
- **Missing data:** Schools with missing component data are included with the neutral 50 for that component; the number of such schools is shown beside the score.
- **Endpoint:** `GET /api/v1/analytics/overview (nationalAvgScore)`
- **Shown on:** National dashboard; Decision queue (Analytics ▸ Decisions)

### Average Infrastructure

- **id:** `national.avgInfrastructure`
- **Definition:** Mean Infrastructure component over scored active schools.
- **Formula:** Mean of decision_assessments.infrastructureScore, one decimal.
- **Source fields:** `decision_assessments.infrastructureScore`
- **Filters:** Active schools only, limited to the user's access level (National, Province, District, Sector or School).
- **Units:** Score 0–100
- **Missing data:** Schools without assessed buildings contribute the neutral 50; their count is shown as “Estimated for N schools”.
- **Endpoint:** `GET /api/v1/analytics/overview (nationalAvgInfraScore, dataGaps.infrastructure)`
- **Shown on:** National dashboard

### Average Building Age Score

- **id:** `national.avgBuildingAgeScore`
- **Definition:** Mean Building Age Score over scored active schools. Higher means newer buildings.
- **Formula:** Mean of decision_assessments.buildingAgeScore, one decimal.
- **Source fields:** `decision_assessments.buildingAgeScore`
- **Filters:** Active schools only, limited to the user's access level (National, Province, District, Sector or School).
- **Units:** Score 0–100
- **Missing data:** Schools with no age data contribute the neutral 50.
- **Endpoint:** `GET /api/v1/analytics/overview (nationalAvgAgeScore)`
- **Shown on:** National dashboard
- **Notes:** Replaces the old “Buildings Depreciation” (which was 100 − this value).

### Average Facility Compliance

- **id:** `national.avgFacilityCompliance`
- **Definition:** Mean Facility Compliance over scored active schools.
- **Formula:** Mean of decision_assessments.facilityComplianceScore, one decimal.
- **Source fields:** `decision_assessments.facilityComplianceScore`
- **Filters:** Active schools only, limited to the user's access level (National, Province, District, Sector or School).
- **Units:** Score 0–100
- **Missing data:** Schools with no survey contribute the neutral 50. See Survey Coverage.
- **Endpoint:** `GET /api/v1/analytics/overview (nationalAvgComplianceScore)`
- **Shown on:** National dashboard

### Average Accessibility

- **id:** `national.avgAccessibility`
- **Definition:** Mean Accessibility component over scored active schools.
- **Formula:** Mean of decision_assessments.accessibilityScore, one decimal.
- **Source fields:** `decision_assessments.accessibilityScore`
- **Filters:** Active schools only, limited to the user's access level (National, Province, District, Sector or School).
- **Units:** Score 0–100
- **Missing data:** Schools without a road status contribute the neutral 50.
- **Endpoint:** `GET /api/v1/analytics/overview (nationalAvgAccessScore)`
- **Shown on:** National dashboard

### Average Population Pressure

- **id:** `national.avgPopulation`
- **Definition:** Mean Population Pressure component over scored active schools. Higher means more headroom.
- **Formula:** Mean of decision_assessments.populationPressureScore, one decimal.
- **Source fields:** `decision_assessments.populationPressureScore`
- **Filters:** Active schools only, limited to the user's access level (National, Province, District, Sector or School).
- **Units:** Score 0–100
- **Missing data:** Schools without population data contribute the neutral 50; their count is shown.
- **Endpoint:** `GET /api/v1/analytics/overview (nationalAvgPopScore, dataGaps.population)`
- **Shown on:** National dashboard

### Capacity Utilisation

- **id:** `national.capacityUtilisation`
- **Definition:** Students enrolled compared with seat capacity, across schools that have capacity on record.
- **Formula:** Σ students ÷ Σ programme capacity × 100, whole number, over schools whose programme capacity > 0. Students = Σ programme enrolment, else the school total.
- **Source fields:** `schools.educationPrograms[].capacity`, `schools.educationPrograms[].totalStudents`, `schools.totalStudents`
- **Filters:** Active schools only, limited to the user's access level (National, Province, District, Sector or School). Schools with capacity > 0 only.
- **Units:** %
- **Missing data:** “No capacity data yet” when no school has programme capacity recorded.
- **Endpoint:** `GET /api/v1/analytics/overview (nationalCapacityUtilisation)`
- **Shown on:** National dashboard

### Total students

- **id:** `national.totalStudents`
- **Definition:** Students enrolled across the active schools you can see.
- **Formula:** Σ schools.totalStudents.
- **Source fields:** `schools.totalStudents`
- **Filters:** Active schools only, limited to the user's access level (National, Province, District, Sector or School).
- **Units:** Students
- **Missing data:** Schools with no figure add 0.
- **Endpoint:** `GET /api/v1/analytics/overview (totalStudents)`
- **Shown on:** National dashboard
- **Notes:** Uses the school total field. A school's own dashboard prefers the programme roll-up, so the two can differ if programme enrolment is not kept in sync.

### Total teachers

- **id:** `national.totalTeachers`
- **Definition:** Teaching staff across the active schools you can see.
- **Formula:** Σ (male + female teachers when recorded, otherwise the total teachers field).
- **Source fields:** `schools.maleTeachers`, `schools.femaleTeachers`, `schools.totalTeachers`
- **Filters:** Active schools only, limited to the user's access level (National, Province, District, Sector or School).
- **Units:** Teachers
- **Missing data:** Schools with no figure add 0.
- **Endpoint:** `GET /api/v1/analytics/overview (totalTeachers)`
- **Shown on:** National dashboard

### Survey Coverage

- **id:** `national.surveyCoverage`
- **Definition:** Share of active schools with at least one facility survey.
- **Formula:** Schools with ≥ 1 survey row ÷ active schools × 100, whole number.
- **Source fields:** `school_facility_surveys.schoolId`
- **Filters:** Active schools only, limited to the user's access level (National, Province, District, Sector or School).
- **Units:** %
- **Missing data:** 0% when there are no surveys.
- **Endpoint:** `GET /api/v1/analytics/overview (surveyCompletionRate)`
- **Shown on:** National dashboard

### Map Coverage

- **id:** `national.mapCoverage`
- **Definition:** Share of active schools with a processed site map (KMZ).
- **Formula:** Schools whose map status is Completed ÷ active schools × 100, whole number.
- **Source fields:** `schools.kmzStatus`
- **Filters:** Active schools only, limited to the user's access level (National, Province, District, Sector or School).
- **Units:** %
- **Missing data:** 0% when none are processed.
- **Endpoint:** `GET /api/v1/analytics/overview (kmzCoverageRate)`
- **Shown on:** National dashboard

### Estimated rehabilitation budget

- **id:** `national.estimatedBudget`
- **Definition:** Planning-grade cost estimate for the recommended works. Not a bill of quantities.
- **Formula:** Per school: RWF 45M per poor/critical building + 12M per building when the Building Age Score < 40 + 18M per extra classroom needed (over capacity by > 10%, 40 students per classroom) + 20M if Accessibility < 45 + 8M if Facility Compliance < 50 + 3.5M survey if no buildings. Summed over schools.
- **Source fields:** `decision_assessments.estimatedBudgetRwf`
- **Filters:** Active schools only, limited to the user's access level (National, Province, District, Sector or School).
- **Units:** RWF
- **Missing data:** Schools with no recommended works add 0.
- **Endpoint:** `GET /api/v1/analytics/overview (totalEstimatedBudgetRwf)`
- **Shown on:** Decision queue (Analytics ▸ Decisions)

### Assessed schools

- **id:** `national.scoredSchools`
- **Definition:** Active schools that have a School Condition Score.
- **Formula:** Count of active schools with an assessment row.
- **Source fields:** `decision_assessments`
- **Filters:** Active schools only, limited to the user's access level (National, Province, District, Sector or School).
- **Units:** Schools
- **Missing data:** Unscored schools appear after Recalculate.
- **Endpoint:** `GET /api/v1/analytics/overview (scoredSchoolCount)`
- **Shown on:** Decision queue (Analytics ▸ Decisions)

### Schools by province

- **id:** `national.provinceDistribution`
- **Definition:** Active schools per province (or district when drilled down), with Critical and High counts and the average score.
- **Formula:** Group active schools by province / district: count, Critical count, High count, mean School Condition Score.
- **Source fields:** `schools.province`, `schools.district`, `schools.priorityLevel`, `schools.overallScore`
- **Filters:** Active schools only, limited to the user's access level (National, Province, District, Sector or School).
- **Units:** Schools; score 0–100
- **Missing data:** Areas without schools are not listed.
- **Endpoint:** `GET /api/v1/analytics/overview (provinceStats) · GET /api/v1/analytics/hierarchy`
- **Shown on:** National dashboard

### Highest and lowest scores

- **id:** `national.rankings`
- **Definition:** The five active schools with the highest and the lowest School Condition Score.
- **Formula:** Sort active schools by School Condition Score.
- **Source fields:** `schools.overallScore`
- **Filters:** Active schools only, limited to the user's access level (National, Province, District, Sector or School).
- **Units:** Score 0–100
- **Missing data:** Schools that have not been scored yet are left out.
- **Endpoint:** `GET /api/v1/schools`
- **Shown on:** National dashboard

### National recommendations

- **id:** `national.recommendations`
- **Definition:** Rule-based suggestions from the national figures.
- **Formula:** Critical schools > 0 → urgent intervention line; the province with the lowest average score → strategic line; otherwise a routine-monitoring line.
- **Source fields:** `byPriority`, `provinceStats`
- **Filters:** Active schools only, limited to the user's access level (National, Province, District, Sector or School).
- **Units:** Text
- **Missing data:** A routine-monitoring line when nothing is flagged.
- **Endpoint:** `GET /api/v1/analytics/overview (nationalRecommendations)`
- **Shown on:** National dashboard


## Population Analytics

### Schools with population data

- **id:** `population.schoolsWithData`
- **Definition:** Active schools that have a population record.
- **Formula:** Count of active schools whose population record has a 2 km population or a density.
- **Source fields:** `population_data.population2km`, `population_data.populationDensityPerKm2`
- **Filters:** Active schools only, limited to the user's access level (National, Province, District, Sector or School).
- **Units:** Schools (of total active schools)
- **Missing data:** Run “Sync Population Data” to fill gaps.
- **Endpoint:** `GET /api/v1/population/summary`
- **Shown on:** Population Analytics

### Population within 2 km

- **id:** `population.totalPopulation2km`
- **Definition:** Sum of the people living within 2 km of each school.
- **Formula:** Σ population within 2 km over schools with data.
- **Source fields:** `population_data.population2km`
- **Filters:** Active schools only, limited to the user's access level (National, Province, District, Sector or School).
- **Units:** People
- **Missing data:** Schools without data add 0.
- **Endpoint:** `GET /api/v1/population/summary`
- **Shown on:** Population Analytics
- **Notes:** Catchments of nearby schools overlap, so shared areas are counted more than once.

### Average population density

- **id:** `population.avgDensity`
- **Definition:** Average people per km² within 2 km of a school.
- **Formula:** Mean of (population within 2 km ÷ 12.57 km²) over schools with data.
- **Source fields:** `population_data.populationDensityPerKm2`
- **Filters:** Active schools only, limited to the user's access level (National, Province, District, Sector or School).
- **Units:** people/km²
- **Missing data:** “—” when no school has data.
- **Endpoint:** `GET /api/v1/population/summary`
- **Shown on:** Population Analytics

### Students per resident (2 km)

- **id:** `population.studentsPerResident`
- **Definition:** How many enrolled students a school has for each person living within 2 km.
- **Formula:** Mean over schools of (total students ÷ population within 2 km). Stored to 2 decimals at sync time.
- **Source fields:** `population_data.studentToSchoolRatio`
- **Filters:** Active schools only, limited to the user's access level (National, Province, District, Sector or School).
- **Units:** Ratio
- **Missing data:** “—” when no school has data.
- **Endpoint:** `GET /api/v1/population/summary`
- **Shown on:** Population Analytics

### Population by distance

- **id:** `population.buffers`
- **Definition:** People within 500 m, 1 km and 2 km of each school.
- **Formula:** 2 km from ArcGIS. 1 km and 500 m are estimated as 50% and 15% of the 2 km value, not measured.
- **Source fields:** `population_data.population500m / population1km / population2km`
- **Filters:** Active schools only, limited to the user's access level (National, Province, District, Sector or School).
- **Units:** People
- **Missing data:** Schools without data are not charted.
- **Endpoint:** `GET /api/v1/population`
- **Shown on:** Population Analytics
