export const Permission = {
  // ── Navigation & read access ─────────────────────────────────────────────
  VIEW_DASHBOARD: "VIEW_DASHBOARD",
  VIEW_MAP: "VIEW_MAP",
  VIEW_SCHOOLS: "VIEW_SCHOOLS",
  VIEW_ANALYTICS: "VIEW_ANALYTICS",
  VIEW_INTELLIGENCE: "VIEW_INTELLIGENCE",
  SCHOOL_LEVEL_DASHBOARD: "SCHOOL_LEVEL_DASHBOARD",
  VIEW_POPULATION: "VIEW_POPULATION",
  VIEW_REPORTING: "VIEW_REPORTING",
  VIEW_ALL_SCHOOLS_REPORTING_DASHBOARD: "VIEW_ALL_SCHOOLS_REPORTING_DASHBOARD",
  SCHOOL_VIEW_2D3D_MAP: "SCHOOL_VIEW_2D3D_MAP",

  // ── School records ───────────────────────────────────────────────────────
  MANAGE_SCHOOLS: "MANAGE_SCHOOLS",
  CREATE_SCHOOL: "CREATE_SCHOOL",
  DELETE_SCHOOL: "DELETE_SCHOOL",
  EDIT_SCHOOL_PROFILE: "EDIT_SCHOOL_PROFILE",
  EDIT_SCHOOL_BASIC: "EDIT_SCHOOL_BASIC",
  EDIT_SCHOOL_LOCATION: "EDIT_SCHOOL_LOCATION",
  EDIT_SCHOOL_CONTACT: "EDIT_SCHOOL_CONTACT",
  EDIT_SCHOOL_PROGRAMS: "EDIT_SCHOOL_PROGRAMS",
  EDIT_SCHOOL_STAFF: "EDIT_SCHOOL_STAFF",
  EDIT_SCHOOL_LAND: "EDIT_SCHOOL_LAND",
  EDIT_SCHOOL_BUILDINGS: "EDIT_SCHOOL_BUILDINGS",

  // ── GIS / geospatial ─────────────────────────────────────────────────────
  UPLOAD_KMZ: "UPLOAD_KMZ",
  EDIT_SITE_ANNOTATIONS: "EDIT_SITE_ANNOTATIONS",
  SYNC_POPULATION: "SYNC_POPULATION",

  // ── Surveys & assessments ────────────────────────────────────────────────
  RUN_FACILITY_SURVEY: "RUN_FACILITY_SURVEY",
  SCHOOL_SURVERY_EDIT: "SCHOOL_SURVERY_EDIT",

  // ── Decisions & exports ──────────────────────────────────────────────────
  MANAGE_DECISIONS: "MANAGE_DECISIONS",
  EXPORT_REPORTS: "EXPORT_REPORTS",

  // ── Field reporting ──────────────────────────────────────────────────────
  CREATE_REPORT: "CREATE_REPORT",
  MANAGE_REPORTS: "MANAGE_REPORTS",

  // ── Administration ───────────────────────────────────────────────────────
  VIEW_USERS: "VIEW_USERS",
  MANAGE_USERS: "MANAGE_USERS",
  MANAGE_ROLES: "MANAGE_ROLES",
  VIEW_AUDIT_LOGS: "VIEW_AUDIT_LOGS",
} as const;

export type PermissionType = (typeof Permission)[keyof typeof Permission];

/* ── Catalog: label / description / group for the Roles admin screen ──────── */

export const PermissionGroup = {
  NAVIGATION: "Navigation & Views",
  SCHOOL_RECORDS: "School Records",
  GEOSPATIAL: "GIS & Geospatial",
  SURVEYS: "Surveys & Assessments",
  DECISIONS: "Decisions & Exports",
  REPORTING: "Field Reporting",
  ADMINISTRATION: "Administration",
} as const;

export interface PermissionMeta {
  key: PermissionType;
  label: string;
  description: string;
  group: string;
}

export const PERMISSION_CATALOG: Record<PermissionType, PermissionMeta> = {
  VIEW_DASHBOARD: {
    key: "VIEW_DASHBOARD",
    label: "View national dashboard",
    description: "Open the main dashboard and national intelligence summaries.",
    group: PermissionGroup.NAVIGATION,
  },
  VIEW_MAP: {
    key: "VIEW_MAP",
    label: "View national map",
    description: "Open the interactive national GIS map and locator tools.",
    group: PermissionGroup.NAVIGATION,
  },
  VIEW_SCHOOLS: {
    key: "VIEW_SCHOOLS",
    label: "View schools directory",
    description:
      "Browse the school directory and open individual school records.",
    group: PermissionGroup.NAVIGATION,
  },
  VIEW_ANALYTICS: {
    key: "VIEW_ANALYTICS",
    label: "View decision analytics",
    description:
      "Open the decision & analytics dashboards and assessment tables.",
    group: PermissionGroup.NAVIGATION,
  },
  VIEW_INTELLIGENCE: {
    key: "VIEW_INTELLIGENCE",
    label: "View intelligence scores",
    description:
      "See AI-driven priority scores and the per-school decision dashboard.",
    group: PermissionGroup.NAVIGATION,
  },
  SCHOOL_LEVEL_DASHBOARD: {
    key: "SCHOOL_LEVEL_DASHBOARD",
    label: "School dashboard",
    description:
      "Open the detailed single-school dashboard (main + reporting tabs).",
    group: PermissionGroup.NAVIGATION,
  },
  VIEW_POPULATION: {
    key: "VIEW_POPULATION",
    label: "View population analytics",
    description: "Open population-density analytics and catchment data.",
    group: PermissionGroup.NAVIGATION,
  },
  VIEW_REPORTING: {
    key: "VIEW_REPORTING",
    label: "Access school reporting",
    description: "Open the School Reporting workspace and read issue reports.",
    group: PermissionGroup.NAVIGATION,
  },
  VIEW_ALL_SCHOOLS_REPORTING_DASHBOARD: {
    key: "VIEW_ALL_SCHOOLS_REPORTING_DASHBOARD",
    label: "Org-wide reporting oversight",
    description:
      "See the cross-school reporting dashboard for every institution.",
    group: PermissionGroup.NAVIGATION,
  },
  SCHOOL_VIEW_2D3D_MAP: {
    key: "SCHOOL_VIEW_2D3D_MAP",
    label: "Open 2D / 3D viewer",
    description: "Access the multimodal 2D/3D building viewers and GLB explorer.",
    group: PermissionGroup.NAVIGATION,
  },

  MANAGE_SCHOOLS: {
    key: "MANAGE_SCHOOLS",
    label: "Edit school records",
    description: "Update any field on an existing school record.",
    group: PermissionGroup.SCHOOL_RECORDS,
  },
  CREATE_SCHOOL: {
    key: "CREATE_SCHOOL",
    label: "Register new schools",
    description: "Add new TVET institutions to the national database.",
    group: PermissionGroup.SCHOOL_RECORDS,
  },
  DELETE_SCHOOL: {
    key: "DELETE_SCHOOL",
    label: "Delete schools",
    description: "Permanently remove a school record from the database.",
    group: PermissionGroup.SCHOOL_RECORDS,
  },
  EDIT_SCHOOL_PROFILE: {
    key: "EDIT_SCHOOL_PROFILE",
    label: "Edit school profile",
    description: "General ability to modify school profile data.",
    group: PermissionGroup.SCHOOL_RECORDS,
  },
  EDIT_SCHOOL_BASIC: {
    key: "EDIT_SCHOOL_BASIC",
    label: "Edit identity & status",
    description: "Modify name, code, type, establishing year and status.",
    group: PermissionGroup.SCHOOL_RECORDS,
  },
  EDIT_SCHOOL_LOCATION: {
    key: "EDIT_SCHOOL_LOCATION",
    label: "Edit location",
    description: "Update coordinates and administrative location.",
    group: PermissionGroup.SCHOOL_RECORDS,
  },
  EDIT_SCHOOL_CONTACT: {
    key: "EDIT_SCHOOL_CONTACT",
    label: "Edit contact details",
    description: "Modify contact person, email, phone and website.",
    group: PermissionGroup.SCHOOL_RECORDS,
  },
  EDIT_SCHOOL_PROGRAMS: {
    key: "EDIT_SCHOOL_PROGRAMS",
    label: "Edit programs & enrolment",
    description: "Manage trades, levels and student headcounts.",
    group: PermissionGroup.SCHOOL_RECORDS,
  },
  EDIT_SCHOOL_STAFF: {
    key: "EDIT_SCHOOL_STAFF",
    label: "Edit staffing",
    description: "Update teaching, administrative and support staff figures.",
    group: PermissionGroup.SCHOOL_RECORDS,
  },
  EDIT_SCHOOL_LAND: {
    key: "EDIT_SCHOOL_LAND",
    label: "Edit land use",
    description: "Modify used / unused land area figures.",
    group: PermissionGroup.SCHOOL_RECORDS,
  },
  EDIT_SCHOOL_BUILDINGS: {
    key: "EDIT_SCHOOL_BUILDINGS",
    label: "Edit buildings",
    description: "Create, update and remove building records and footprints.",
    group: PermissionGroup.SCHOOL_RECORDS,
  },

  UPLOAD_KMZ: {
    key: "UPLOAD_KMZ",
    label: "Upload KMZ / 3D models",
    description: "Upload KMZ/KML/GLB data and trigger geospatial processing.",
    group: PermissionGroup.GEOSPATIAL,
  },
  EDIT_SITE_ANNOTATIONS: {
    key: "EDIT_SITE_ANNOTATIONS",
    label: "Edit map overlays & annotations",
    description: "Add or remove 2D overlays, places overlays and annotations.",
    group: PermissionGroup.GEOSPATIAL,
  },
  SYNC_POPULATION: {
    key: "SYNC_POPULATION",
    label: "Sync population data",
    description: "Trigger the ArcGIS population-density synchronisation job.",
    group: PermissionGroup.GEOSPATIAL,
  },

  RUN_FACILITY_SURVEY: {
    key: "RUN_FACILITY_SURVEY",
    label: "Run facility surveys",
    description: "Initiate infrastructure-compliance assessments for a school.",
    group: PermissionGroup.SURVEYS,
  },
  SCHOOL_SURVERY_EDIT: {
    key: "SCHOOL_SURVERY_EDIT",
    label: "Edit survey responses",
    description: "Update compliance answers and notes on an in-progress survey.",
    group: PermissionGroup.SURVEYS,
  },

  MANAGE_DECISIONS: {
    key: "MANAGE_DECISIONS",
    label: "Manage decision engine",
    description: "Re-run priority algorithms, edit weights and manage actions.",
    group: PermissionGroup.DECISIONS,
  },
  EXPORT_REPORTS: {
    key: "EXPORT_REPORTS",
    label: "Export data & reports",
    description: "Download schools, analytics and report exports.",
    group: PermissionGroup.DECISIONS,
  },

  CREATE_REPORT: {
    key: "CREATE_REPORT",
    label: "Submit issue reports",
    description: "File new infrastructure / incident reports from a school.",
    group: PermissionGroup.REPORTING,
  },
  MANAGE_REPORTS: {
    key: "MANAGE_REPORTS",
    label: "Triage & resolve reports",
    description: "Change report status, edit and delete any submitted report.",
    group: PermissionGroup.REPORTING,
  },

  VIEW_USERS: {
    key: "VIEW_USERS",
    label: "View users",
    description: "Read-only access to the user directory.",
    group: PermissionGroup.ADMINISTRATION,
  },
  MANAGE_USERS: {
    key: "MANAGE_USERS",
    label: "Manage users",
    description: "Create, edit, deactivate and bulk-import system users.",
    group: PermissionGroup.ADMINISTRATION,
  },
  MANAGE_ROLES: {
    key: "MANAGE_ROLES",
    label: "Manage roles & access levels",
    description: "Create roles, assign permissions and configure access levels.",
    group: PermissionGroup.ADMINISTRATION,
  },
  VIEW_AUDIT_LOGS: {
    key: "VIEW_AUDIT_LOGS",
    label: "View audit trail",
    description: "Read the system audit log of privileged actions.",
    group: PermissionGroup.ADMINISTRATION,
  },
};

export const PERMISSION_GROUP_ORDER: string[] = [
  PermissionGroup.NAVIGATION,
  PermissionGroup.SCHOOL_RECORDS,
  PermissionGroup.GEOSPATIAL,
  PermissionGroup.SURVEYS,
  PermissionGroup.DECISIONS,
  PermissionGroup.REPORTING,
  PermissionGroup.ADMINISTRATION,
];

/** Grouped catalog, ready to render in the Roles admin screen. */
export const PERMISSION_GROUPS: { group: string; items: PermissionMeta[] }[] =
  PERMISSION_GROUP_ORDER.map((group) => ({
    group,
    items: Object.values(PERMISSION_CATALOG).filter((m) => m.group === group),
  }));

interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role:
    | string
    | {
        id: string;
        name: string;
        permissions: string[];
        accessLevel?: { id: string; name: string } | null;
      };
}

/** Checks if a user has a specific permission. */
export function hasPermission(
  user: AuthUser | null,
  permission: PermissionType,
): boolean {
  if (!user || !user.role) return false;

  const roleIdentifier =
    typeof user.role === "string" ? user.role : user.role.name;

  if (
    roleIdentifier &&
    roleIdentifier.toLowerCase().replace(/\s+/g, "_") === "super_admin"
  ) {
    return true;
  }

  const userPermissions =
    typeof user.role === "object" ? user.role.permissions || [] : [];

  return userPermissions.includes(permission);
}

/** True if the user has AT LEAST ONE of the given permissions. */
export function hasAnyPermission(
  user: AuthUser | null,
  permissions: PermissionType[],
): boolean {
  return permissions.some((p) => hasPermission(user, p));
}

/** Higher-level authorization check for components. */
export function checkAuthorized(
  user: AuthUser | null,
  requiredPermission?: PermissionType,
): boolean {
  if (!user) return false;
  if (!requiredPermission) return true;
  return hasPermission(user, requiredPermission);
}
