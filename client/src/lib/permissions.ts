export const Permission = {
  VIEW_DASHBOARD: 'VIEW_DASHBOARD',
  VIEW_MAP: 'VIEW_MAP',
  VIEW_SCHOOLS: 'VIEW_SCHOOLS',
  MANAGE_USERS: 'MANAGE_USERS',
  VIEW_USERS: 'VIEW_USERS',
  MANAGE_SCHOOLS: 'MANAGE_SCHOOLS',
  CREATE_SCHOOL: 'CREATE_SCHOOL',
  DELETE_SCHOOL: 'DELETE_SCHOOL',
  EDIT_SCHOOL_BASIC: 'EDIT_SCHOOL_BASIC',
  EDIT_SCHOOL_LOCATION: 'EDIT_SCHOOL_LOCATION',
  EDIT_SCHOOL_CONTACT: 'EDIT_SCHOOL_CONTACT',
  EDIT_SCHOOL_PROGRAMS: 'EDIT_SCHOOL_PROGRAMS',
  EDIT_SCHOOL_STAFF: 'EDIT_SCHOOL_STAFF',
  EDIT_SCHOOL_LAND: 'EDIT_SCHOOL_LAND',
  EDIT_SCHOOL_BUILDINGS: 'EDIT_SCHOOL_BUILDINGS',
  UPLOAD_KMZ: 'UPLOAD_KMZ',
  VIEW_ANALYTICS: 'VIEW_ANALYTICS',
  VIEW_INTELLIGENCE: 'VIEW_INTELLIGENCE',
  MANAGE_DECISIONS: 'MANAGE_DECISIONS',
  RUN_FACILITY_SURVEY: 'RUN_FACILITY_SURVEY',
  EXPORT_REPORTS: 'EXPORT_REPORTS',
  SCHOOL_LEVEL_DASHBOARD: 'SCHOOL_LEVEL_DASHBOARD',
  CREATE_REPORT: 'CREATE_REPORT',
  EDIT_SCHOOL_PROFILE: 'EDIT_SCHOOL_PROFILE',
  SCHOOL_SURVERY_EDIT: 'SCHOOL_SURVERY_EDIT',
  SCHOOL_VIEW_2D3D_MAP: 'SCHOOL_VIEW_2D3D_MAP',
} as const;

export type PermissionType = typeof Permission[keyof typeof Permission];

interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string | {
    id: string;
    name: string;
    permissions: string[];
    accessLevel?: { id: string; name: string } | null;
  };
}

/**
 * Checks if a user has a specific permission
 */
export function hasPermission(user: AuthUser | null, permission: PermissionType): boolean {
  if (!user || !user.role) return false;
  
  // Handle case where role might be just a string (legacy) or an object
  const userPermissions = typeof user.role === 'object' 
    ? (user.role.permissions || []) 
    : [];
    
  return userPermissions.includes(permission);
}

/**
 * Higher-level authorization check for components
 */
export function checkAuthorized(user: AuthUser | null, requiredPermission?: PermissionType): boolean {
  if (!user) return false;
  if (!requiredPermission) return true; // No permission required
  return hasPermission(user, requiredPermission);
}
