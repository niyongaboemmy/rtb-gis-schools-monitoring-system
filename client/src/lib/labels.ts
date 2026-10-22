/**
 * Shared enum → display-label maps (WS2.2).
 *
 * Every enum value that reaches the UI goes through `label(kind, value)` so a
 * raw value such as `NEED_INTERVENTION` or `non_compliant` is never rendered.
 * Wording follows docs/GLOSSARY.md (draft, pending RTB review — decision D5).
 *
 * Values mirror the server enums:
 *   schoolStatus      server/src/modules/schools/entities/school.entity.ts (SchoolStatus)
 *   priority          server/src/modules/analytics/entities/decision-assessment.entity.ts (PriorityLevel)
 *   buildingCondition server/src/modules/schools/entities/school-building.entity.ts (BuildingCondition)
 *   roofCondition     server/src/modules/schools/entities/school-building.entity.ts (RoofCondition)
 *   reportStatus      server/src/modules/reports/entities/issue-report.entity.ts (ReportStatus)
 *   reportType        server/src/modules/reports/entities/issue-report.entity.ts (report `type`)
 *   compliance        server/src/modules/schools/entities/school-facility-survey.entity.ts (ComplianceLevel)
 *   schoolType        server/src/modules/schools/entities/school.entity.ts (SchoolType)
 *   kmzStatus         server/src/modules/schools/entities/school.entity.ts (KmzProcessingStatus)
 *   boundaryType      server/src/modules/schools/entities/school-boundary.entity.ts (BoundaryType)
 *   accessTier        server/src/common/scope/access-scope.ts (AccessTierSlug)
 *   surveyStatus      derived on the client (no server enum): survey progress
 */

export const LABELS = {
  schoolStatus: {
    active: "Active",
    inactive: "Inactive",
    under_renovation: "Under Renovation",
  },
  priority: {
    critical: "Critical",
    high: "High",
    medium: "Medium",
    low: "Low",
  },
  buildingCondition: {
    good: "Good",
    fair: "Fair",
    poor: "Poor",
    critical: "Critical",
  },
  roofCondition: {
    good: "Good",
    fair: "Fair",
    needs_repair: "Needs Repair",
    poor: "Poor",
    critical: "Critical",
  },
  reportStatus: {
    PENDING: "Pending",
    SOLVED: "Resolved",
    RESOLVED: "Resolved",
    NEED_INTERVENTION: "Needs Intervention",
    FAILED: "Failed",
  },
  reportType: {
    issue: "Issue report",
    data_change_request: "Change request",
  },
  compliance: {
    compliant: "Compliant",
    partial: "Partially Compliant",
    non_compliant: "Non-Compliant",
  },
  schoolType: {
    TSS: "Technical Secondary School (TSS)",
    VTC: "Vocational Training Centre (VTC)",
    INTEGRATED: "Integrated School (TSS + VTC)",
  },
  schoolTypeShort: {
    TSS: "TSS",
    VTC: "VTC",
    INTEGRATED: "Integrated",
  },
  surveyStatus: {
    not_started: "Not Started",
    in_progress: "In Progress",
    completed: "Completed",
  },
  roadState: {
    paved: "Paved",
    gravel: "Gravel",
    earth: "Earth",
    mixed: "Mixed",
  },
  kmzStatus: {
    pending: "Pending",
    processing: "Processing",
    completed: "Completed",
    failed: "Failed",
  },
  boundaryType: {
    campus: "Campus",
    building_footprint: "Building Footprint",
    sports_field: "Sports Field",
    parking: "Parking",
    green_area: "Green Area",
    other: "Other",
  },
  accessTier: {
    national: "National",
    province: "Province",
    district: "District",
    sector: "Sector",
    school: "School",
  },
} as const satisfies Record<string, Record<string, string>>;

export type LabelKind = keyof typeof LABELS;

/** Words kept upper-case when title-casing an unknown value. */
const ACRONYMS = new Set(["TSS", "VTC", "TVET", "RTB", "GIS", "KMZ", "KML", "GLB", "ID"]);

/**
 * Fallback for values the maps do not know yet: `SOME_NEW_VALUE` →
 * "Some New Value", `kebab-case` → "Kebab Case". Never returns SCREAMING_CASE.
 */
export function titleCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => {
      const up = w.toUpperCase();
      if (ACRONYMS.has(up)) return up;
      return up.charAt(0) + w.slice(1).toLowerCase();
    })
    .join(" ");
}

/**
 * Display label for an enum value. Lookup is exact first, then
 * case-insensitive, then a title-cased fallback. `null`/`undefined`/"" → "—".
 */
export function label(kind: LabelKind, value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const map = LABELS[kind] as Record<string, string>;
  const v = String(value);
  if (map[v]) return map[v];
  const lower = v.toLowerCase();
  for (const key of Object.keys(map)) {
    if (key.toLowerCase() === lower) return map[key];
  }
  return titleCase(v);
}

/** `[value, label]` pairs for building selects/filters. */
export function labelOptions(kind: LabelKind): { value: string; label: string }[] {
  const map = LABELS[kind] as Record<string, string>;
  const seen = new Set<string>();
  return Object.entries(map)
    .filter(([, l]) => (seen.has(l) ? false : (seen.add(l), true)))
    .map(([value, l]) => ({ value, label: l }));
}
