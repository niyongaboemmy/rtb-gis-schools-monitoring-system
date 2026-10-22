/**
 * Metric help registry (WS3.5). One entry per KPI shown on a dashboard.
 *
 * The same content is published as docs/METRIC_DICTIONARY.md — the ids are
 * stable and shared by both. When a formula changes on the server, update the
 * entry here and regenerate the dictionary section.
 *
 * Wording follows docs/GLOSSARY.md (draft, pending RTB review).
 */

export interface MetricDef {
  /** Display title — the canonical glossary term. */
  title: string;
  /** Plain-language one or two sentence definition. */
  definition: string;
  /** Formula in words / simple maths. */
  formula: string;
  /** Database fields the value is built from. */
  sources: string[];
  /** Which schools are counted. */
  filters: string;
  units: string;
  /** What happens when the inputs are missing. */
  missingData: string;
  /** API endpoint that returns the value. */
  endpoint: string;
  /** Where the number appears. */
  shownOn: string[];
  notes?: string;
}

const ACTIVE_SCOPED =
  "Active schools only, limited to the user's access level (National, Province, District, Sector or School).";
const OVERVIEW = "GET /api/v1/analytics/overview";
const SCHOOL_METRICS = "GET /api/v1/analytics/schools/:id/metrics";
const SCHOOL_ONLY = "The selected school (any status), if it is within the user's access level.";
const NATIONAL = "National dashboard";
const SCHOOL_DASH = "School dashboard";
const DECISIONS = "Decision queue (Analytics ▸ Decisions)";
const NEUTRAL =
  'No data → the neutral value 50 is used and the component is flagged "Estimated — missing data". A 50 is never a measurement in that case.';

const COMPONENT_WEIGHTS =
  "Infrastructure 35% · Building Age Score 25% · Facility Compliance 15% · Accessibility 10% · Population Pressure 10% · Resolution Rate 5%";

export const METRICS = {
  // ── School Condition Score & its components ────────────────────────────────
  "school.conditionScore": {
    title: "School Condition Score",
    definition:
      "A 0–100 score of a school's overall physical and operational condition. Higher is better.",
    formula: `round(0.35 × Infrastructure + 0.25 × Building Age Score + 0.15 × Facility Compliance + 0.10 × Accessibility + 0.10 × Population Pressure + 0.05 × Resolution Rate). Each component is 0–100. Weights: ${COMPONENT_WEIGHTS}.`,
    sources: [
      "decision_assessments.overallScore (copied to schools.overallScore)",
      "the six component scores below",
    ],
    filters: SCHOOL_ONLY,
    units: "Score 0–100 (whole number, no % sign)",
    missingData:
      "Any component without data uses the neutral 50 and is flagged. The composite is still calculated; check the component flags before relying on it.",
    endpoint: SCHOOL_METRICS,
    shownOn: [SCHOOL_DASH, DECISIONS],
    notes:
      "Recalculated automatically whenever the school profile, its buildings, surveys, Issue Reports or population data change, and nightly. Viewing a dashboard never recalculates. The share of the score that comes from measured data (coverage) is shown next to it.",
  },
  "school.priority": {
    title: "Intervention Priority",
    definition: "How urgently the school needs support, from its School Condition Score.",
    formula: "Critical < 35 · High 35–54 · Medium 55–74 · Low ≥ 75.",
    sources: ["decision_assessments.priorityLevel"],
    filters: SCHOOL_ONLY,
    units: "Band: Critical / High / Medium / Low",
    missingData: "Unscored schools have no priority and are shown as “Not assessed”.",
    endpoint: SCHOOL_METRICS,
    shownOn: [SCHOOL_DASH, DECISIONS],
  },
  "school.urgencyMonths": {
    title: "Months to Intervention",
    definition: "Recommended time before action is taken, from the score band.",
    formula: "Score < 35 → 0 (now) · < 45 → 3 · < 55 → 6 · < 65 → 12 · < 75 → 18 · otherwise 36 months.",
    sources: ["decision_assessments.urgencyMonths"],
    filters: SCHOOL_ONLY,
    units: "Months",
    missingData: "Not shown when the school has not been scored.",
    endpoint: SCHOOL_METRICS,
    shownOn: [SCHOOL_DASH, DECISIONS],
  },
  "component.infrastructure": {
    title: "Infrastructure",
    definition: "Average condition of the school's assessed buildings. Weight 35%.",
    formula:
      "Mean over assessed buildings of: Good 100 · Fair 70 · Poor 30 · Critical 10. Rounded.",
    sources: ["school_buildings.condition"],
    filters:
      "Assessed buildings with a recorded condition. A building with no condition (e.g. created by a KMZ/3D upload or saved with a blank condition) is not evidence and is ignored.",
    units: "Score 0–100",
    missingData: NEUTRAL,
    endpoint: SCHOOL_METRICS,
    shownOn: [SCHOOL_DASH, DECISIONS, NATIONAL],
  },
  "component.buildingAge": {
    title: "Building Age Score",
    definition:
      "A 0–100 score from the average age of the buildings. Newer buildings score higher. Weight 25%. (Replaces “Depreciation”.)",
    formula:
      "Average age = mean(current year − year built). ≤ 10 y → 95 · ≤ 20 → 80 · ≤ 30 → 60 · ≤ 40 → 45 · ≤ 50 → 30 · ≤ 60 → 20 · > 60 → 10. No build years → uses the school's established year instead.",
    sources: ["school_buildings.yearBuilt", "schools.establishedYear"],
    filters: "Assessed buildings with a valid year built (1900 – this year; future years are ignored).",
    units: "Score 0–100",
    missingData: `${NEUTRAL} (No building year and no established year.)`,
    endpoint: SCHOOL_METRICS,
    shownOn: [SCHOOL_DASH, DECISIONS, NATIONAL],
    notes: "This is not accounting depreciation. It only reflects age.",
  },
  "component.facilityCompliance": {
    title: "Facility Compliance",
    definition: "How many facility survey items are compliant. Weight 15%.",
    formula:
      "Mean over all survey items of: Compliant 100 · Partially Compliant 50 · Non-Compliant 0. Rounded.",
    sources: ["school_facility_surveys.compliance"],
    filters: "One row per surveyed facility item (the latest result for each item).",
    units: "Score 0–100",
    missingData: `${NEUTRAL} (No facility survey yet.)`,
    endpoint: SCHOOL_METRICS,
    shownOn: [SCHOOL_DASH, DECISIONS, NATIONAL],
  },
  "component.accessibility": {
    title: "Accessibility",
    definition: "The road-access percentage recorded for the school. Weight 10%.",
    formula: "Accessibility = schools.roadStatusPercentage, kept between 0 and 100.",
    sources: ["schools.roadStatusPercentage"],
    filters: SCHOOL_ONLY,
    units: "Score 0–100",
    missingData: `${NEUTRAL} (Road status not recorded. A recorded 0 is a real 0.)`,
    endpoint: SCHOOL_METRICS,
    shownOn: [SCHOOL_DASH, DECISIONS, NATIONAL],
  },
  "component.population": {
    title: "Population Pressure",
    definition:
      "Capacity headroom compared with the school-age population within 2 km. Higher means less pressure. Weight 10%.",
    formula:
      "Demand ratio = school-age population within 2 km ÷ seat capacity (Σ programme capacity; if none, current enrolment; if none, 300). Ratio ≥ 5 → 10 · ≥ 3 → 30 · ≥ 2 → 50 · ≥ 1 → 70 · < 1 → 100.",
    sources: [
      "population_data.schoolAgePopulation2km",
      "schools.educationPrograms[].capacity",
      "schools.totalStudents",
    ],
    filters: "Latest population record for the school.",
    units: "Score 0–100",
    missingData: `${NEUTRAL} (No population record, or a school-age population of 0 / empty — the sync found no data. Run a population sync.)`,
    endpoint: SCHOOL_METRICS,
    shownOn: [SCHOOL_DASH, DECISIONS, NATIONAL],
  },
  "component.resolution": {
    title: "Resolution Rate (component)",
    definition:
      "How reliably the school's Issue Reports get resolved. Weight 5%.",
    formula:
      "round(Resolved ÷ eligible Issue Reports × 100). Eligible = Resolved, or still open more than 30 days after filing. Reports filed in the last 30 days and still open are not counted yet.",
    sources: ["issue_reports.status", "issue_reports.createdAt", "issue_reports.type"],
    filters: "Issue Reports only — data change requests are not counted.",
    units: "Score 0–100",
    missingData: `${NEUTRAL} (Fewer than 3 eligible reports — too few to rate. Filing a new report never lowers the score.)`,
    endpoint: SCHOOL_METRICS,
    shownOn: [SCHOOL_DASH, DECISIONS],
  },
  "school.dataCompleteness": {
    title: "Data Completeness",
    definition: "Share of 10 key profile items that are filled in.",
    formula:
      "Items: assessed buildings (not bare KMZ stubs), enrolment, teachers, province, district, road status, established year, a facility survey, population data with a school-age count, a processed site map. Completeness = filled ÷ 10 × 100.",
    sources: ["schools.*", "school_buildings", "school_facility_surveys", "population_data"],
    filters: SCHOOL_ONLY,
    units: "%",
    missingData: "Each missing item lowers the percentage. Below 60% a warning is shown.",
    endpoint: SCHOOL_METRICS,
    shownOn: [SCHOOL_DASH],
  },
  "school.peerDelta": {
    title: "Difference from district average",
    definition: "This school's score minus the average of the other active schools in its district.",
    formula: "School Condition Score − mean(School Condition Score of other scored active schools in the same district).",
    sources: ["decision_assessments.overallScore", "schools.district"],
    filters: "Other scored active schools in the same district (this school excluded).",
    units: "Score points (+ above, − below)",
    missingData: "Not shown when the district has fewer than 3 other scored schools.",
    endpoint: SCHOOL_METRICS,
    shownOn: [SCHOOL_DASH],
  },

  // ── School profile figures ─────────────────────────────────────────────────
  "school.totalStudents": {
    title: "Total students",
    definition: "Students enrolled at the school.",
    formula: "Σ programme enrolment when recorded, otherwise the school's total students field.",
    sources: ["schools.educationPrograms[].totalStudents", "schools.totalStudents"],
    filters: SCHOOL_ONLY,
    units: "Students",
    missingData: "Shown as 0 when nothing is recorded.",
    endpoint: SCHOOL_METRICS,
    shownOn: [SCHOOL_DASH],
    notes: "The national total uses the same rule, so it equals the sum of the school figures.",
  },
  "school.capacityUtilisation": {
    title: "Capacity Utilisation",
    definition: "How full the school is compared with its seat capacity. Above 100% means over capacity.",
    formula: "Σ programme enrolment ÷ Σ programme capacity × 100, one decimal. Both from the programme list, never mixed with the school-level total.",
    sources: ["schools.educationPrograms[].totalStudents", "schools.educationPrograms[].capacity"],
    filters: SCHOOL_ONLY,
    units: "%",
    missingData: "“No capacity data yet” unless the programmes record both capacity and enrolment.",
    endpoint: SCHOOL_METRICS,
    shownOn: [SCHOOL_DASH],
  },
  "school.totalStaff": {
    title: "Total staff",
    definition: "Teaching, administrative and support staff.",
    formula: "Teachers + admin staff (male + female) + support staff (male + female).",
    sources: [
      "schools.maleTeachers / femaleTeachers / totalTeachers",
      "schools.maleAdminStaff / femaleAdminStaff",
      "schools.maleSupportStaff / femaleSupportStaff",
    ],
    filters: SCHOOL_ONLY,
    units: "People",
    missingData: "Missing fields count as 0.",
    endpoint: SCHOOL_METRICS,
    shownOn: [SCHOOL_DASH],
  },
  "school.studentTeacherRatio": {
    title: "Student:Teacher Ratio",
    definition: "Students per teacher (teaching staff only).",
    formula:
      "Total students ÷ teachers. Teachers = male + female teachers when recorded, otherwise the total teachers field (same rule as the national total).",
    sources: ["schools.maleTeachers", "schools.femaleTeachers", "schools.totalTeachers"],
    filters: SCHOOL_ONLY,
    units: "Ratio, e.g. 32:1",
    missingData: "“No teacher data” when there are no teachers on record.",
    endpoint: SCHOOL_METRICS,
    shownOn: [SCHOOL_DASH],
  },
  "school.buildingCount": {
    title: "Buildings",
    definition: "Number of building records for the school, how many are assessed, and their average age.",
    formula: "Count of building rows. Assessed = buildings with a recorded condition or inventory data (only these feed the score). Average age = mean(current year − year built) over assessed buildings with a valid year.",
    sources: ["school_buildings"],
    filters: SCHOOL_ONLY,
    units: "Buildings; years",
    missingData: "Average age shows “Year unknown” when no building has a year built.",
    endpoint: SCHOOL_METRICS,
    shownOn: [SCHOOL_DASH],
  },
  "school.landArea": {
    title: "Land area",
    definition: "Land used and unused by the school, in hectares.",
    formula: "Total = used + unused. Used share = used ÷ total × 100.",
    sources: ["schools.usedLandArea", "schools.unusedLandArea"],
    filters: SCHOOL_ONLY,
    units: "ha (hectares)",
    missingData: "“No land data” when neither value is recorded.",
    endpoint: SCHOOL_METRICS,
    shownOn: [SCHOOL_DASH],
  },
  "school.programmes": {
    title: "TVET programmes",
    definition: "Number of trades / programmes the school offers.",
    formula: "Count of entries in the school's programme list.",
    sources: ["schools.educationPrograms"],
    filters: SCHOOL_ONLY,
    units: "Programmes",
    missingData: "0 when none are recorded.",
    endpoint: SCHOOL_METRICS,
    shownOn: [SCHOOL_DASH],
  },
  "school.roadAccess": {
    title: "Road access",
    definition: "The recorded road-access percentage (the Accessibility component).",
    formula: "schools.roadStatusPercentage. Good > 80%, Moderate > 50%, otherwise Limited.",
    sources: ["schools.roadStatusPercentage"],
    filters: SCHOOL_ONLY,
    units: "%",
    missingData: "“Not recorded” when empty.",
    endpoint: SCHOOL_METRICS,
    shownOn: [SCHOOL_DASH],
  },

  // ── Issue Reports (school) ─────────────────────────────────────────────────
  "reports.resolutionRate": {
    title: "Resolution Rate",
    definition: "Share of this school's Issue Reports that are Resolved.",
    formula: "round(Resolved ÷ all Issue Reports × 100).",
    sources: ["issue_reports.status"],
    filters: "All Issue Reports for the school (data change requests excluded).",
    units: "%",
    missingData: "“No reports yet” when the school has no Issue Reports.",
    endpoint: `${SCHOOL_METRICS} (reportSummary.resolutionRate)`,
    shownOn: [SCHOOL_DASH],
    notes:
      "The Resolution Rate score component is different: it only counts reports old enough to have been resolved (see Resolution Rate (component)). The overview card and the Issue Reports tab show the same figure.",
  },
  "reports.openIssues": {
    title: "Open issues",
    definition: "Issue Reports not yet Resolved.",
    formula: "Pending + Needs Intervention + Failed.",
    sources: ["issue_reports.status"],
    filters: "All Issue Reports for the school.",
    units: "Reports",
    missingData: "0 when there are none.",
    endpoint: `${SCHOOL_METRICS} (reportSummary.active)`,
    shownOn: [SCHOOL_DASH],
  },
  "reports.resolved": {
    title: "Resolved",
    definition: "Issue Reports that have been fixed.",
    formula: "Count of reports with status Resolved.",
    sources: ["issue_reports.status"],
    filters: "All Issue Reports for the school.",
    units: "Reports",
    missingData: "0 when there are none.",
    endpoint: `${SCHOOL_METRICS} (reportSummary.resolved)`,
    shownOn: [SCHOOL_DASH],
  },
  "reports.needsIntervention": {
    title: "Needs Intervention",
    definition: "Issue Reports triaged as needing action from RTB or the district.",
    formula: "Count of reports with status Needs Intervention.",
    sources: ["issue_reports.status"],
    filters: "All Issue Reports for the school.",
    units: "Reports",
    missingData: "0 when there are none.",
    endpoint: `${SCHOOL_METRICS} (reportSummary.critical)`,
    shownOn: [SCHOOL_DASH],
  },
  "reports.monthComparison": {
    title: "This month vs last month",
    definition:
      "Issue Reports filed this month vs last month, and Issue Reports resolved this month vs last month.",
    formula:
      "Filed: by creation date. Resolved: by resolution date. Change = (this month − last month) ÷ last month × 100. Calendar months in Kigali time, computed on the server.",
    sources: ["issue_reports.createdAt", "issue_reports.resolvedAt", "issue_reports.status"],
    filters: "Issue Reports for the school (data change requests excluded).",
    units: "% change",
    missingData: "“—” when last month had none (no baseline to compare with).",
    endpoint: "GET /api/v1/schools/dashboard/reporting?schoolId=…",
    shownOn: [SCHOOL_DASH],
  },
  "reports.buildingsAttention": {
    title: "Buildings needing attention",
    definition:
      "Buildings ranked by open Issue Reports linked to them, then by poor/critical condition.",
    formula:
      "Per building: open Issue Reports (Needs Intervention ×100, Failed ×40, Pending ×10) plus assessed condition. Assessed Poor/Critical buildings are added even without reports. Top 3. Resolved reports never put a building on the list.",
    sources: ["issue_reports.buildingId", "issue_reports.status", "school_buildings.condition"],
    filters: "This school's buildings and its Issue Reports (data change requests excluded).",
    units: "List",
    missingData: "“No buildings need attention” when none qualify.",
    endpoint: "GET /api/v1/schools/dashboard/reporting?schoolId=… (buildingsAttention)",
    shownOn: [SCHOOL_DASH],
    notes: "A list ordering, not a score. Ranked on the server.",
  },

  // ── Indicative risk (school) ───────────────────────────────────────────────
  "risk.overall": {
    title: "Indicative risk",
    definition:
      "A rule-of-thumb risk estimate. It is not part of the School Condition Score and is not a measurement.",
    formula:
      "Mean of the factor risk scores (impact × probability ÷ 100) over the factors that apply. Observed issues (open Needs Intervention / Failed reports, slow resolution) use probability 100; building condition and population use the base probability. Factors with nothing observed or no data are left out. Critical > 70, High > 50, Medium > 30, otherwise Low.",
    sources: ["School Condition Score and components", "Issue Reports", "buildings", "facility surveys"],
    filters: SCHOOL_ONLY,
    units: "Score 0–100",
    missingData: "A factor whose data is missing shows “Unknown — no data” and is not counted.",
    endpoint: "GET /api/v1/analytics/schools/:id/risk (also in …/metrics as riskAssessment)",
    shownOn: [SCHOOL_DASH],
    notes: "Rules live in server/src/modules/analytics/risk-assessment.ts.",
  },
  "risk.impact": {
    title: "Impact (indicative)",
    definition: "How bad the consequences would be if the risk happened.",
    formula:
      "50% × (100 − School Condition Score) + 30% × share of poor/critical buildings × 100 + 20% × urgency (100 if action is due now, else max(0, 100 − 2 × months)). Capped at 100.",
    sources: ["decision_assessments.overallScore", "school_buildings.condition", "decision_assessments.urgencyMonths"],
    filters: SCHOOL_ONLY,
    units: "0–100",
    missingData: "Urgency defaults to 36 months when not set.",
    endpoint: "GET /api/v1/analytics/schools/:id/risk",
    shownOn: [SCHOOL_DASH],
  },
  "risk.probability": {
    title: "Probability (indicative)",
    definition: "How likely a structural or operational failure is.",
    formula:
      "50% × min(100, 1.5 × average building age) + 25% × (60 if population data is missing, else 20) + 25% × survey staleness (80 if never surveyed or > 365 days, 50 if > 180 days, else 20). Capped at 100.",
    sources: ["school_buildings.yearBuilt", "population_data", "school_facility_surveys.inspectedAt"],
    filters: SCHOOL_ONLY,
    units: "0–100",
    missingData: "Unknown building age is treated as 50 years (pessimistic).",
    endpoint: "GET /api/v1/analytics/schools/:id/risk",
    shownOn: [SCHOOL_DASH],
  },
  "risk.mitigation": {
    title: "Mitigation effectiveness (indicative)",
    definition: "A rough guide to how much each response could help. Each strategy shows its own rule.",
    formula:
      "Emergency response: 90 − 8 × open Needs Intervention reports (20–85). Repair follow-up: 85 − 3 × failed reports (20–80). Workflow: 85, or 75 if average resolution > 5 days. Preventive maintenance: 85 if Infrastructure < 50, else 70.",
    sources: ["issue_reports", "decision_assessments.infrastructureScore"],
    filters: SCHOOL_ONLY,
    units: "%",
    missingData: "Counts default to 0.",
    endpoint: "GET /api/v1/analytics/schools/:id/risk",
    shownOn: [SCHOOL_DASH],
  },

  // ── National ───────────────────────────────────────────────────────────────
  "national.totalSchools": {
    title: "Schools",
    definition: "Number of active schools you can see.",
    formula: "Count of schools with status Active.",
    sources: ["schools.status"],
    filters: ACTIVE_SCOPED,
    units: "Schools",
    missingData: "0 when there are none.",
    endpoint: `${OVERVIEW} (totalSchools)`,
    shownOn: [NATIONAL],
  },
  "national.priorityCount": {
    title: "Schools by Intervention Priority",
    definition: "How many active schools fall in each Intervention Priority band.",
    formula: "Count of schools per priority band (Critical < 35, High 35–54, Medium 55–74, Low ≥ 75).",
    sources: ["decision_assessments.priorityLevel"],
    filters: ACTIVE_SCOPED,
    units: "Schools",
    missingData:
      "Schools never scored are counted as “Not assessed” (its own slice). A school scored mostly from missing data sits near the neutral 50, inside the High band — check the data coverage before acting.",
    endpoint: `${OVERVIEW} (byPriority)`,
    shownOn: [NATIONAL, DECISIONS],
  },
  "national.avgConditionScore": {
    title: "Average School Condition Score",
    definition: "The mean School Condition Score of the active schools you can see.",
    formula: "Mean of School Condition Score over scored active schools, one decimal.",
    sources: ["decision_assessments.overallScore"],
    filters: `${ACTIVE_SCOPED} Only schools that have been scored.`,
    units: "Score 0–100",
    missingData:
      "Schools with missing component data are included with the neutral 50 for that component; the number of such schools is shown beside the score.",
    endpoint: `${OVERVIEW} (nationalAvgScore)`,
    shownOn: [NATIONAL, DECISIONS],
  },
  "national.avgInfrastructure": {
    title: "Average Infrastructure",
    definition: "Mean Infrastructure component over scored active schools.",
    formula: "Mean of decision_assessments.infrastructureScore, one decimal.",
    sources: ["decision_assessments.infrastructureScore"],
    filters: ACTIVE_SCOPED,
    units: "Score 0–100",
    missingData:
      "Schools without assessed buildings contribute the neutral 50; their count is shown as “Estimated for N schools”.",
    endpoint: `${OVERVIEW} (nationalAvgInfraScore, dataGaps.infrastructure)`,
    shownOn: [NATIONAL],
  },
  "national.avgBuildingAgeScore": {
    title: "Average Building Age Score",
    definition: "Mean Building Age Score over scored active schools. Higher means newer buildings.",
    formula: "Mean of decision_assessments.buildingAgeScore, one decimal.",
    sources: ["decision_assessments.buildingAgeScore"],
    filters: ACTIVE_SCOPED,
    units: "Score 0–100",
    missingData: "Schools with no age data contribute the neutral 50.",
    endpoint: `${OVERVIEW} (nationalAvgAgeScore)`,
    shownOn: [NATIONAL],
    notes: "Replaces the old “Buildings Depreciation” (which was 100 − this value).",
  },
  "national.avgFacilityCompliance": {
    title: "Average Facility Compliance",
    definition: "Mean Facility Compliance over scored active schools.",
    formula: "Mean of decision_assessments.facilityComplianceScore, one decimal.",
    sources: ["decision_assessments.facilityComplianceScore"],
    filters: ACTIVE_SCOPED,
    units: "Score 0–100",
    missingData: "Schools with no survey contribute the neutral 50. See Survey Coverage.",
    endpoint: `${OVERVIEW} (nationalAvgComplianceScore)`,
    shownOn: [NATIONAL],
  },
  "national.avgAccessibility": {
    title: "Average Accessibility",
    definition: "Mean Accessibility component over scored active schools.",
    formula: "Mean of decision_assessments.accessibilityScore, one decimal.",
    sources: ["decision_assessments.accessibilityScore"],
    filters: ACTIVE_SCOPED,
    units: "Score 0–100",
    missingData: "Schools without a road status contribute the neutral 50.",
    endpoint: `${OVERVIEW} (nationalAvgAccessScore)`,
    shownOn: [NATIONAL],
  },
  "national.avgPopulation": {
    title: "Average Population Pressure",
    definition: "Mean Population Pressure component over scored active schools. Higher means more headroom.",
    formula: "Mean of decision_assessments.populationPressureScore, one decimal.",
    sources: ["decision_assessments.populationPressureScore"],
    filters: ACTIVE_SCOPED,
    units: "Score 0–100",
    missingData: "Schools without population data contribute the neutral 50; their count is shown.",
    endpoint: `${OVERVIEW} (nationalAvgPopScore, dataGaps.population)`,
    shownOn: [NATIONAL],
  },
  "national.capacityUtilisation": {
    title: "Capacity Utilisation",
    definition: "Students enrolled compared with seat capacity, across schools that have capacity on record.",
    formula:
      "Σ programme enrolment ÷ Σ programme capacity × 100, whole number, over schools whose programmes record both. The school-level total is never mixed in.",
    sources: ["schools.educationPrograms[].capacity", "schools.educationPrograms[].totalStudents"],
    filters: `${ACTIVE_SCOPED} Schools with programme capacity and enrolment only.`,
    units: "%",
    missingData: "“No capacity data yet” when no school has programme capacity recorded.",
    endpoint: `${OVERVIEW} (nationalCapacityUtilisation)`,
    shownOn: [NATIONAL],
  },
  "national.totalStudents": {
    title: "Total students",
    definition: "Students enrolled across the active schools you can see.",
    formula: "Σ over schools of (Σ programme enrolment when recorded, otherwise the school's total students field).",
    sources: ["schools.educationPrograms[].totalStudents", "schools.totalStudents"],
    filters: ACTIVE_SCOPED,
    units: "Students",
    missingData: "Schools with no figure add 0.",
    endpoint: `${OVERVIEW} (totalStudents)`,
    shownOn: [NATIONAL],
    notes: "Same rule as a school's own dashboard and the map, so the national total equals the sum of the school figures.",
  },
  "national.totalTeachers": {
    title: "Total teachers",
    definition: "Teaching staff across the active schools you can see.",
    formula: "Σ (male + female teachers when recorded, otherwise the total teachers field).",
    sources: ["schools.maleTeachers", "schools.femaleTeachers", "schools.totalTeachers"],
    filters: ACTIVE_SCOPED,
    units: "Teachers",
    missingData: "Schools with no figure add 0.",
    endpoint: `${OVERVIEW} (totalTeachers)`,
    shownOn: [NATIONAL],
  },
  "national.surveyCoverage": {
    title: "Survey Coverage",
    definition: "Share of active schools with at least one facility survey.",
    formula: "Schools with ≥ 1 survey row ÷ active schools × 100, whole number.",
    sources: ["school_facility_surveys.schoolId"],
    filters: ACTIVE_SCOPED,
    units: "%",
    missingData: "0% when there are no surveys.",
    endpoint: `${OVERVIEW} (surveyCompletionRate)`,
    shownOn: [NATIONAL],
  },
  "national.mapCoverage": {
    title: "Map Coverage",
    definition: "Share of active schools with a processed site map (KMZ).",
    formula: "Schools whose map status is Completed ÷ active schools × 100, whole number.",
    sources: ["schools.kmzStatus"],
    filters: ACTIVE_SCOPED,
    units: "%",
    missingData: "0% when none are processed.",
    endpoint: `${OVERVIEW} (kmzCoverageRate)`,
    shownOn: [NATIONAL],
  },
  "national.estimatedBudget": {
    title: "Estimated rehabilitation budget",
    definition: "Planning-grade cost estimate for the recommended works. Not a bill of quantities.",
    formula:
      "Per school: RWF 45M per poor/critical building + 12M per building when the Building Age Score < 40 + 18M per extra classroom needed (over capacity by > 10%, 40 students per classroom) + 20M if Accessibility < 45 + 8M if Facility Compliance < 50 + 3.5M survey if no buildings. Summed over schools.",
    sources: ["decision_assessments.estimatedBudgetRwf"],
    filters: ACTIVE_SCOPED,
    units: "RWF",
    missingData: "Schools with no recommended works add 0.",
    endpoint: `${OVERVIEW} (totalEstimatedBudgetRwf)`,
    shownOn: [DECISIONS],
  },
  "national.scoredSchools": {
    title: "Assessed schools",
    definition: "Active schools that have a School Condition Score.",
    formula: "Count of active schools with an assessment row.",
    sources: ["decision_assessments"],
    filters: ACTIVE_SCOPED,
    units: "Schools",
    missingData: "New and changed schools are scored automatically; anything missed is caught by the nightly recalculation.",
    endpoint: `${OVERVIEW} (scoredSchoolCount)`,
    shownOn: [DECISIONS],
  },
  "national.provinceDistribution": {
    title: "Schools by province",
    definition: "Active schools per province (or district when drilled down), with Critical and High counts and the average score.",
    formula: "Group active schools by province / district: count, Critical count, High count, mean School Condition Score.",
    sources: ["schools.province", "schools.district", "decision_assessments.priorityLevel", "decision_assessments.overallScore"],
    filters: ACTIVE_SCOPED,
    units: "Schools; score 0–100",
    missingData: "Areas without schools are not listed. An area with no scored school has no average (shown as —), never 0.",
    endpoint: `${OVERVIEW} (provinceStats) · GET /api/v1/analytics/hierarchy`,
    shownOn: [NATIONAL],
  },
  "national.rankings": {
    title: "Highest and lowest scores",
    definition: "The five active schools with the highest and the lowest School Condition Score.",
    formula: "Sort active schools by School Condition Score.",
    sources: ["schools.overallScore"],
    filters: ACTIVE_SCOPED,
    units: "Score 0–100",
    missingData: "Schools that have not been scored yet are left out.",
    endpoint: "GET /api/v1/schools",
    shownOn: [NATIONAL],
  },
  "national.recommendations": {
    title: "National recommendations",
    definition: "Rule-based suggestions from the national figures.",
    formula:
      "One line per finding: Critical schools → urgent line; lowest-scoring scored province → strategic line; weakest measured national factor (< 55) → focus line; missing building / population data, low average data coverage and unscored schools → data lines. Otherwise a routine-monitoring line.",
    sources: ["byPriority", "provinceStats", "dataGaps", "avgDataCoverage"],
    filters: ACTIVE_SCOPED,
    units: "Text",
    missingData: "A routine-monitoring line when nothing is flagged.",
    endpoint: `${OVERVIEW} (nationalRecommendations)`,
    shownOn: [NATIONAL],
  },

  // ── Population Analytics ───────────────────────────────────────────────────
  "population.schoolsWithData": {
    title: "Schools with population data",
    definition: "Active schools that have a population record.",
    formula: "Count of active schools whose population record has a 2 km population or a density.",
    sources: ["population_data.population2km", "population_data.populationDensityPerKm2"],
    filters: ACTIVE_SCOPED,
    units: "Schools (of total active schools)",
    missingData: "Run “Sync Population Data” to fill gaps.",
    endpoint: "GET /api/v1/population/summary",
    shownOn: ["Population Analytics"],
  },
  "population.totalPopulation2km": {
    title: "Population within 2 km",
    definition: "Sum of the people living within 2 km of each school.",
    formula: "Σ population within 2 km over schools with data.",
    sources: ["population_data.population2km"],
    filters: ACTIVE_SCOPED,
    units: "People",
    missingData: "Schools without data add 0.",
    endpoint: "GET /api/v1/population/summary",
    shownOn: ["Population Analytics"],
    notes: "Catchments of nearby schools overlap, so shared areas are counted more than once.",
  },
  "population.avgDensity": {
    title: "Average population density",
    definition: "Average people per km² within 2 km of a school.",
    formula: "Mean of (population within 2 km ÷ 12.57 km²) over schools with data.",
    sources: ["population_data.populationDensityPerKm2"],
    filters: ACTIVE_SCOPED,
    units: "people/km²",
    missingData: "“—” when no school has data.",
    endpoint: "GET /api/v1/population/summary",
    shownOn: ["Population Analytics"],
  },
  "population.studentsPerResident": {
    title: "Students per resident (2 km)",
    definition: "How many enrolled students a school has for each person living within 2 km.",
    formula: "Mean over schools of (total students ÷ population within 2 km). Stored to 2 decimals at sync time.",
    sources: ["population_data.studentToSchoolRatio"],
    filters: ACTIVE_SCOPED,
    units: "Ratio",
    missingData: "“—” when no school has data.",
    endpoint: "GET /api/v1/population/summary",
    shownOn: ["Population Analytics"],
  },
  "population.buffers": {
    title: "Population by distance",
    definition: "People within 500 m, 1 km and 2 km of each school.",
    formula: "2 km from ArcGIS. 1 km and 500 m are estimated as 50% and 15% of the 2 km value, not measured.",
    sources: ["population_data.population500m / population1km / population2km"],
    filters: ACTIVE_SCOPED,
    units: "People",
    missingData: "Schools without data are not charted.",
    endpoint: "GET /api/v1/population",
    shownOn: ["Population Analytics"],
  },
} as const satisfies Record<string, MetricDef>;

export type MetricId = keyof typeof METRICS;

export function getMetric(id: MetricId): MetricDef {
  return METRICS[id];
}

/** Component key (as returned by the API) → metric id. */
export const COMPONENT_METRIC: Record<string, MetricId> = {
  infrastructure: "component.infrastructure",
  buildingAge: "component.buildingAge",
  facilityCompliance: "component.facilityCompliance",
  accessibility: "component.accessibility",
  population: "component.population",
  resolution: "component.resolution",
};
