import { Permission } from '../../common/constants/permissions.constant';

/**
 * Field-level edit rules for PATCH /schools/:id (WS7.7).
 *
 * The route is reachable with MANAGE_SCHOOLS or EDIT_SCHOOL_PROFILE, but a
 * profile editor (e.g. a school leader) may only change the field groups they
 * hold a permission for. Location and buildings stay locked unless granted;
 * such users file a change request instead (POST /schools/:id/change-requests).
 *
 * Each field maps to the permissions that unlock it (any one is enough).
 * MANAGE_SCHOOLS unlocks every field. Fields not listed need MANAGE_SCHOOLS.
 */
export const SCHOOL_FIELD_PERMISSIONS: Record<string, Permission[]> = {
  // Identity & status
  code: [Permission.EDIT_SCHOOL_BASIC],
  name: [Permission.EDIT_SCHOOL_BASIC],
  type: [Permission.EDIT_SCHOOL_BASIC],
  status: [Permission.EDIT_SCHOOL_BASIC],
  establishedYear: [Permission.EDIT_SCHOOL_BASIC],
  description: [Permission.EDIT_SCHOOL_BASIC],
  // Location (incl. the GIS source files collected on the Location step)
  province: [Permission.EDIT_SCHOOL_LOCATION],
  district: [Permission.EDIT_SCHOOL_LOCATION],
  sector: [Permission.EDIT_SCHOOL_LOCATION],
  cell: [Permission.EDIT_SCHOOL_LOCATION],
  village: [Permission.EDIT_SCHOOL_LOCATION],
  latitude: [Permission.EDIT_SCHOOL_LOCATION],
  longitude: [Permission.EDIT_SCHOOL_LOCATION],
  elevation: [Permission.EDIT_SCHOOL_LOCATION],
  address: [Permission.EDIT_SCHOOL_LOCATION],
  kmz2dFilePath: [Permission.EDIT_SCHOOL_LOCATION, Permission.UPLOAD_KMZ],
  tifFilePath: [Permission.EDIT_SCHOOL_LOCATION, Permission.UPLOAD_KMZ],
  // Contact
  phone: [Permission.EDIT_SCHOOL_CONTACT],
  email: [Permission.EDIT_SCHOOL_CONTACT],
  website: [Permission.EDIT_SCHOOL_CONTACT],
  headTeacher: [Permission.EDIT_SCHOOL_CONTACT],
  // Programmes & enrolment
  educationPrograms: [Permission.EDIT_SCHOOL_PROGRAMS],
  totalStudents: [
    Permission.EDIT_SCHOOL_PROGRAMS,
    Permission.EDIT_SCHOOL_STAFF,
  ],
  maleStudents: [Permission.EDIT_SCHOOL_PROGRAMS, Permission.EDIT_SCHOOL_STAFF],
  femaleStudents: [
    Permission.EDIT_SCHOOL_PROGRAMS,
    Permission.EDIT_SCHOOL_STAFF,
  ],
  // Staff
  totalTeachers: [Permission.EDIT_SCHOOL_STAFF],
  maleTeachers: [Permission.EDIT_SCHOOL_STAFF],
  femaleTeachers: [Permission.EDIT_SCHOOL_STAFF],
  adminStaff: [Permission.EDIT_SCHOOL_STAFF],
  maleAdminStaff: [Permission.EDIT_SCHOOL_STAFF],
  femaleAdminStaff: [Permission.EDIT_SCHOOL_STAFF],
  supportStaff: [Permission.EDIT_SCHOOL_STAFF],
  maleSupportStaff: [Permission.EDIT_SCHOOL_STAFF],
  femaleSupportStaff: [Permission.EDIT_SCHOOL_STAFF],
  // Land & access
  usedLandArea: [Permission.EDIT_SCHOOL_LAND],
  unusedLandArea: [Permission.EDIT_SCHOOL_LAND],
  numberOfAccessRoads: [Permission.EDIT_SCHOOL_LAND],
  roadState: [Permission.EDIT_SCHOOL_LAND],
  roadStatusPercentage: [Permission.EDIT_SCHOOL_LAND],
  // Buildings
  buildings: [Permission.EDIT_SCHOOL_BUILDINGS],
  // 3D viewer state
  glb3dHomePosition: [Permission.EDIT_SITE_ANNOTATIONS, Permission.UPLOAD_KMZ],
  glb3dAnnotations: [Permission.EDIT_SITE_ANNOTATIONS, Permission.UPLOAD_KMZ],
};

/** Fields a school leader may ask to change through a change request. */
export const CHANGE_REQUESTABLE_FIELDS = Object.keys(SCHOOL_FIELD_PERMISSIONS);

export function canEditSchoolField(
  field: string,
  permissions: readonly string[],
  isSuperAdmin = false,
): boolean {
  if (isSuperAdmin || permissions.includes(Permission.MANAGE_SCHOOLS))
    return true;
  const needed = SCHOOL_FIELD_PERMISSIONS[field];
  if (!needed) return false;
  return needed.some((p) => permissions.includes(p));
}

function sameValue(a: unknown, b: unknown): boolean {
  const norm = (v: unknown) => (v === undefined || v === '' ? null : v);
  const x = norm(a);
  const y = norm(b);
  if (x === y) return true;
  if (x === null || y === null) return false;
  // numeric columns come back from Postgres as strings (decimal) or numbers
  if (
    (typeof x === 'number' || typeof y === 'number') &&
    Number(x) === Number(y)
  )
    return true;
  if (typeof x === 'object' || typeof y === 'object')
    return JSON.stringify(x) === JSON.stringify(y);
  return (
    String(x as string | number | boolean) ===
    String(y as string | number | boolean)
  );
}

export interface FieldFilterResult {
  /** The DTO with unchanged locked fields (and `buildings`) removed. */
  allowed: Record<string, unknown>;
  /** Locked fields whose value the caller tried to change. */
  rejected: string[];
}

/**
 * Splits an update payload into what the caller may apply and the locked
 * fields they tried to change. Locked fields carrying the stored value are
 * dropped silently (the form sends the whole record). `buildings` cannot be
 * compared cheaply and is dropped whenever the caller lacks permission for it,
 * because applying it would delete and recreate every building.
 */
export function filterSchoolUpdate(
  dto: Record<string, unknown>,
  current: Record<string, unknown>,
  permissions: readonly string[],
  isSuperAdmin = false,
): FieldFilterResult {
  const allowed: Record<string, unknown> = {};
  const rejected: string[] = [];
  for (const [field, value] of Object.entries(dto)) {
    if (value === undefined) continue;
    if (canEditSchoolField(field, permissions, isSuperAdmin)) {
      allowed[field] = value;
      continue;
    }
    if (field === 'buildings') continue;
    if (!sameValue(value, current[field])) rejected.push(field);
  }
  return { allowed, rejected };
}
