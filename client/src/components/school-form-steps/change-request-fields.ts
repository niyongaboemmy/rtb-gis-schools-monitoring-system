/**
 * Locked school fields a user may ask to change (WS7.7). Mirrors
 * server/src/modules/schools/school-field-permissions.ts: each field lists the
 * permissions that allow editing it directly (any one is enough; MANAGE_SCHOOLS
 * unlocks all). Keep the two in sync.
 */
export interface ChangeField {
  field: string;
  label: string;
  group: string;
  permissions: string[];
  numeric?: boolean;
  hint?: string;
}

const LOC = ["EDIT_SCHOOL_LOCATION"];
const BASIC = ["EDIT_SCHOOL_BASIC"];

export const CHANGE_FIELDS: ChangeField[] = [
  { field: "latitude", label: "Latitude", group: "Location", permissions: LOC, numeric: true, hint: "e.g. -1.9441" },
  { field: "longitude", label: "Longitude", group: "Location", permissions: LOC, numeric: true, hint: "e.g. 30.0619" },
  { field: "province", label: "Province", group: "Location", permissions: LOC },
  { field: "district", label: "District", group: "Location", permissions: LOC },
  { field: "sector", label: "Sector", group: "Location", permissions: LOC },
  { field: "cell", label: "Cell", group: "Location", permissions: LOC },
  { field: "village", label: "Village", group: "Location", permissions: LOC },
  { field: "address", label: "Address", group: "Location", permissions: LOC },
  { field: "elevation", label: "Elevation (m)", group: "Location", permissions: LOC, numeric: true },
  { field: "name", label: "School name", group: "Identity", permissions: BASIC },
  { field: "code", label: "School code", group: "Identity", permissions: BASIC },
  { field: "type", label: "School type", group: "Identity", permissions: BASIC, hint: "TSS, VTC or Integrated" },
  { field: "status", label: "Operating status", group: "Identity", permissions: BASIC, hint: "Active, Inactive, Under renovation" },
  { field: "establishedYear", label: "Year established", group: "Identity", permissions: BASIC, numeric: true },
  {
    field: "buildings",
    label: "Buildings (describe the correction)",
    group: "Buildings",
    permissions: ["EDIT_SCHOOL_BUILDINGS"],
    hint: "e.g. Block C was demolished in 2025",
  },
  { field: "usedLandArea", label: "Used land area (m²)", group: "Land", permissions: ["EDIT_SCHOOL_LAND"], numeric: true },
  { field: "unusedLandArea", label: "Unused land area (m²)", group: "Land", permissions: ["EDIT_SCHOOL_LAND"], numeric: true },
  { field: "phone", label: "Phone", group: "Contact", permissions: ["EDIT_SCHOOL_CONTACT"] },
  { field: "email", label: "Email", group: "Contact", permissions: ["EDIT_SCHOOL_CONTACT"] },
  { field: "headTeacher", label: "Head teacher", group: "Contact", permissions: ["EDIT_SCHOOL_CONTACT"] },
];

/** Form step id → fields locked behind it (SchoolForm step numbering). */
export const STEP_FIELDS: Record<number, string[]> = {
  1: ["name", "code", "type", "status", "establishedYear"],
  2: ["latitude", "longitude", "province", "district", "sector"],
  3: ["phone", "email", "headTeacher"],
  6: ["usedLandArea", "unusedLandArea"],
  7: ["buildings"],
};
