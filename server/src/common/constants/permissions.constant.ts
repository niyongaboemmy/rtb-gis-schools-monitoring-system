export enum Permission {
  // ── Navigation & read access ─────────────────────────────────────────────
  VIEW_DASHBOARD = 'VIEW_DASHBOARD',
  VIEW_MAP = 'VIEW_MAP',
  VIEW_SCHOOLS = 'VIEW_SCHOOLS',
  VIEW_ANALYTICS = 'VIEW_ANALYTICS',
  VIEW_INTELLIGENCE = 'VIEW_INTELLIGENCE',
  SCHOOL_LEVEL_DASHBOARD = 'SCHOOL_LEVEL_DASHBOARD',
  VIEW_POPULATION = 'VIEW_POPULATION',
  VIEW_REPORTING = 'VIEW_REPORTING',
  VIEW_ALL_SCHOOLS_REPORTING_DASHBOARD = 'VIEW_ALL_SCHOOLS_REPORTING_DASHBOARD',
  SCHOOL_VIEW_2D3D_MAP = 'SCHOOL_VIEW_2D3D_MAP',

  // ── School records ───────────────────────────────────────────────────────
  MANAGE_SCHOOLS = 'MANAGE_SCHOOLS',
  CREATE_SCHOOL = 'CREATE_SCHOOL',
  DELETE_SCHOOL = 'DELETE_SCHOOL',
  EDIT_SCHOOL_PROFILE = 'EDIT_SCHOOL_PROFILE',
  EDIT_SCHOOL_BASIC = 'EDIT_SCHOOL_BASIC',
  EDIT_SCHOOL_LOCATION = 'EDIT_SCHOOL_LOCATION',
  EDIT_SCHOOL_CONTACT = 'EDIT_SCHOOL_CONTACT',
  EDIT_SCHOOL_PROGRAMS = 'EDIT_SCHOOL_PROGRAMS',
  EDIT_SCHOOL_STAFF = 'EDIT_SCHOOL_STAFF',
  EDIT_SCHOOL_LAND = 'EDIT_SCHOOL_LAND',
  EDIT_SCHOOL_BUILDINGS = 'EDIT_SCHOOL_BUILDINGS',

  // ── GIS / geospatial ─────────────────────────────────────────────────────
  UPLOAD_KMZ = 'UPLOAD_KMZ',
  EDIT_SITE_ANNOTATIONS = 'EDIT_SITE_ANNOTATIONS',
  SYNC_POPULATION = 'SYNC_POPULATION',

  // ── Surveys & assessments ────────────────────────────────────────────────
  RUN_FACILITY_SURVEY = 'RUN_FACILITY_SURVEY',
  SCHOOL_SURVERY_EDIT = 'SCHOOL_SURVERY_EDIT',

  // ── Decisions & exports ──────────────────────────────────────────────────
  MANAGE_DECISIONS = 'MANAGE_DECISIONS',
  EXPORT_REPORTS = 'EXPORT_REPORTS',

  // ── Field reporting ──────────────────────────────────────────────────────
  CREATE_REPORT = 'CREATE_REPORT',
  MANAGE_REPORTS = 'MANAGE_REPORTS',

  // ── Administration ───────────────────────────────────────────────────────
  VIEW_USERS = 'VIEW_USERS',
  MANAGE_USERS = 'MANAGE_USERS',
  MANAGE_ROLES = 'MANAGE_ROLES',
  VIEW_AUDIT_LOGS = 'VIEW_AUDIT_LOGS',
}

export enum PermissionGroup {
  NAVIGATION = 'Navigation & Views',
  SCHOOL_RECORDS = 'School Records',
  GEOSPATIAL = 'GIS & Geospatial',
  SURVEYS = 'Surveys & Assessments',
  DECISIONS = 'Decisions & Exports',
  REPORTING = 'Field Reporting',
  ADMINISTRATION = 'Administration',
}

export interface PermissionMeta {
  label: string;
  description: string;
  group: PermissionGroup;
}

/**
 * Single source of truth describing every permission — what it unlocks and
 * where it lives. Mirrored on the client (`src/lib/permissions.ts`) so the
 * Roles admin screen can render grouped, self-documenting toggles.
 */
export const PERMISSION_CATALOG: Record<Permission, PermissionMeta> = {
  [Permission.VIEW_DASHBOARD]: {
    label: 'View national dashboard',
    description: 'Open the main dashboard and national intelligence summaries.',
    group: PermissionGroup.NAVIGATION,
  },
  [Permission.VIEW_MAP]: {
    label: 'View national map',
    description: 'Open the interactive national GIS map and locator tools.',
    group: PermissionGroup.NAVIGATION,
  },
  [Permission.VIEW_SCHOOLS]: {
    label: 'View schools directory',
    description: 'Browse the school directory and open individual school records.',
    group: PermissionGroup.NAVIGATION,
  },
  [Permission.VIEW_ANALYTICS]: {
    label: 'View decision analytics',
    description: 'Open the decision & analytics dashboards and assessment tables.',
    group: PermissionGroup.NAVIGATION,
  },
  [Permission.VIEW_INTELLIGENCE]: {
    label: 'View intelligence scores',
    description: 'See AI-driven priority scores, infrastructure deltas and the per-school decision dashboard.',
    group: PermissionGroup.NAVIGATION,
  },
  [Permission.SCHOOL_LEVEL_DASHBOARD]: {
    label: 'School dashboard',
    description: 'Open the detailed single-school dashboard (main + reporting tabs).',
    group: PermissionGroup.NAVIGATION,
  },
  [Permission.VIEW_POPULATION]: {
    label: 'View population analytics',
    description: 'Open population-density analytics and per-school catchment data.',
    group: PermissionGroup.NAVIGATION,
  },
  [Permission.VIEW_REPORTING]: {
    label: 'Access school reporting',
    description: 'Open the School Reporting workspace and read issue reports.',
    group: PermissionGroup.NAVIGATION,
  },
  [Permission.VIEW_ALL_SCHOOLS_REPORTING_DASHBOARD]: {
    label: 'Org-wide reporting oversight',
    description: 'See the cross-school reporting dashboard covering every institution, not only assigned ones.',
    group: PermissionGroup.NAVIGATION,
  },
  [Permission.SCHOOL_VIEW_2D3D_MAP]: {
    label: 'Open 2D / 3D viewer',
    description: 'Access the multimodal 2D/3D building viewers and GLB explorer.',
    group: PermissionGroup.NAVIGATION,
  },

  [Permission.MANAGE_SCHOOLS]: {
    label: 'Edit school records',
    description: 'Update any field on an existing school record.',
    group: PermissionGroup.SCHOOL_RECORDS,
  },
  [Permission.CREATE_SCHOOL]: {
    label: 'Register new schools',
    description: 'Add new TVET institutions to the national database.',
    group: PermissionGroup.SCHOOL_RECORDS,
  },
  [Permission.DELETE_SCHOOL]: {
    label: 'Delete schools',
    description: 'Permanently remove a school record from the database.',
    group: PermissionGroup.SCHOOL_RECORDS,
  },
  [Permission.EDIT_SCHOOL_PROFILE]: {
    label: 'Edit school profile',
    description: 'General ability to modify school profile data from the school view.',
    group: PermissionGroup.SCHOOL_RECORDS,
  },
  [Permission.EDIT_SCHOOL_BASIC]: {
    label: 'Edit identity & status',
    description: 'Modify name, code, type, establishing year and operating status.',
    group: PermissionGroup.SCHOOL_RECORDS,
  },
  [Permission.EDIT_SCHOOL_LOCATION]: {
    label: 'Edit location',
    description: 'Update coordinates and administrative location (province/district/sector).',
    group: PermissionGroup.SCHOOL_RECORDS,
  },
  [Permission.EDIT_SCHOOL_CONTACT]: {
    label: 'Edit contact details',
    description: 'Modify contact person, email, phone and website.',
    group: PermissionGroup.SCHOOL_RECORDS,
  },
  [Permission.EDIT_SCHOOL_PROGRAMS]: {
    label: 'Edit programs & enrolment',
    description: 'Manage trades, levels and student headcounts.',
    group: PermissionGroup.SCHOOL_RECORDS,
  },
  [Permission.EDIT_SCHOOL_STAFF]: {
    label: 'Edit staffing',
    description: 'Update teaching, administrative and support staff figures.',
    group: PermissionGroup.SCHOOL_RECORDS,
  },
  [Permission.EDIT_SCHOOL_LAND]: {
    label: 'Edit land use',
    description: 'Modify used / unused land area figures.',
    group: PermissionGroup.SCHOOL_RECORDS,
  },
  [Permission.EDIT_SCHOOL_BUILDINGS]: {
    label: 'Edit buildings',
    description: 'Create, update and remove building records, conditions and footprints.',
    group: PermissionGroup.SCHOOL_RECORDS,
  },

  [Permission.UPLOAD_KMZ]: {
    label: 'Upload KMZ / 3D models',
    description: 'Upload KMZ/KML/GLB data and trigger geospatial processing.',
    group: PermissionGroup.GEOSPATIAL,
  },
  [Permission.EDIT_SITE_ANNOTATIONS]: {
    label: 'Edit map overlays & annotations',
    description: 'Add or remove 2D overlays, places overlays and site annotations.',
    group: PermissionGroup.GEOSPATIAL,
  },
  [Permission.SYNC_POPULATION]: {
    label: 'Sync population data',
    description: 'Trigger the ArcGIS population-density synchronisation job.',
    group: PermissionGroup.GEOSPATIAL,
  },

  [Permission.RUN_FACILITY_SURVEY]: {
    label: 'Run facility surveys',
    description: 'Initiate infrastructure-compliance assessments for a school.',
    group: PermissionGroup.SURVEYS,
  },
  [Permission.SCHOOL_SURVERY_EDIT]: {
    label: 'Edit survey responses',
    description: 'Update compliance answers and notes on an in-progress survey.',
    group: PermissionGroup.SURVEYS,
  },

  [Permission.MANAGE_DECISIONS]: {
    label: 'Manage decision engine',
    description: 'Re-run priority algorithms, edit weights and manage intervention actions.',
    group: PermissionGroup.DECISIONS,
  },
  [Permission.EXPORT_REPORTS]: {
    label: 'Export data & reports',
    description: 'Download schools, analytics and report exports (Excel / CSV).',
    group: PermissionGroup.DECISIONS,
  },

  [Permission.CREATE_REPORT]: {
    label: 'Submit issue reports',
    description: 'File new infrastructure / incident reports from a school.',
    group: PermissionGroup.REPORTING,
  },
  [Permission.MANAGE_REPORTS]: {
    label: 'Triage & resolve reports',
    description: 'Change report status, edit and delete any submitted report.',
    group: PermissionGroup.REPORTING,
  },

  [Permission.VIEW_USERS]: {
    label: 'View users',
    description: 'Read-only access to the user directory.',
    group: PermissionGroup.ADMINISTRATION,
  },
  [Permission.MANAGE_USERS]: {
    label: 'Manage users',
    description: 'Create, edit, deactivate and bulk-import system users.',
    group: PermissionGroup.ADMINISTRATION,
  },
  [Permission.MANAGE_ROLES]: {
    label: 'Manage roles & access levels',
    description: 'Create roles, assign permissions and configure access levels.',
    group: PermissionGroup.ADMINISTRATION,
  },
  [Permission.VIEW_AUDIT_LOGS]: {
    label: 'View audit trail',
    description: 'Read the system audit log of privileged actions.',
    group: PermissionGroup.ADMINISTRATION,
  },
};

export const ALL_PERMISSIONS: Permission[] = Object.values(Permission);

export const DefaultRolePermissions: Record<string, Permission[]> = {
  super_admin: ALL_PERMISSIONS,

  admin: [
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_MAP,
    Permission.VIEW_SCHOOLS,
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_INTELLIGENCE,
    Permission.SCHOOL_LEVEL_DASHBOARD,
    Permission.VIEW_POPULATION,
    Permission.VIEW_REPORTING,
    Permission.VIEW_ALL_SCHOOLS_REPORTING_DASHBOARD,
    Permission.SCHOOL_VIEW_2D3D_MAP,
    Permission.VIEW_USERS,
    Permission.MANAGE_SCHOOLS,
    Permission.CREATE_SCHOOL,
    Permission.DELETE_SCHOOL,
    Permission.EDIT_SCHOOL_PROFILE,
    Permission.EDIT_SCHOOL_BASIC,
    Permission.EDIT_SCHOOL_LOCATION,
    Permission.EDIT_SCHOOL_CONTACT,
    Permission.EDIT_SCHOOL_PROGRAMS,
    Permission.EDIT_SCHOOL_STAFF,
    Permission.EDIT_SCHOOL_LAND,
    Permission.EDIT_SCHOOL_BUILDINGS,
    Permission.UPLOAD_KMZ,
    Permission.EDIT_SITE_ANNOTATIONS,
    Permission.SYNC_POPULATION,
    Permission.RUN_FACILITY_SURVEY,
    Permission.SCHOOL_SURVERY_EDIT,
    Permission.MANAGE_DECISIONS,
    Permission.EXPORT_REPORTS,
    Permission.CREATE_REPORT,
    Permission.MANAGE_REPORTS,
    Permission.MANAGE_ROLES,
    Permission.VIEW_AUDIT_LOGS,
  ],

  gis_analyst: [
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_MAP,
    Permission.VIEW_SCHOOLS,
    Permission.VIEW_INTELLIGENCE,
    Permission.SCHOOL_LEVEL_DASHBOARD,
    Permission.VIEW_POPULATION,
    Permission.VIEW_REPORTING,
    Permission.SCHOOL_VIEW_2D3D_MAP,
    Permission.MANAGE_SCHOOLS,
    Permission.EDIT_SCHOOL_LOCATION,
    Permission.EDIT_SCHOOL_BUILDINGS,
    Permission.UPLOAD_KMZ,
    Permission.EDIT_SITE_ANNOTATIONS,
    Permission.SYNC_POPULATION,
    Permission.CREATE_REPORT,
  ],

  viewer: [
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_MAP,
    Permission.VIEW_SCHOOLS,
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_INTELLIGENCE,
    Permission.SCHOOL_LEVEL_DASHBOARD,
    Permission.VIEW_POPULATION,
    Permission.VIEW_REPORTING,
    Permission.SCHOOL_VIEW_2D3D_MAP,
    Permission.CREATE_REPORT,
  ],
};
