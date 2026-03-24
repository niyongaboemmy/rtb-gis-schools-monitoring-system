export enum Permission {
  MANAGE_USERS = 'MANAGE_USERS',
  VIEW_USERS = 'VIEW_USERS',
  MANAGE_SCHOOLS = 'MANAGE_SCHOOLS',
  UPLOAD_KMZ = 'UPLOAD_KMZ',
  VIEW_ANALYTICS = 'VIEW_ANALYTICS',
  MANAGE_DECISIONS = 'MANAGE_DECISIONS',
  EXPORT_REPORTS = 'EXPORT_REPORTS',
}

export const DefaultRolePermissions: Record<string, Permission[]> = {
  'super_admin': Object.values(Permission),
  'admin': [
    Permission.VIEW_USERS,
    Permission.MANAGE_SCHOOLS,
    Permission.UPLOAD_KMZ,
    Permission.VIEW_ANALYTICS,
    Permission.MANAGE_DECISIONS,
    Permission.EXPORT_REPORTS,
  ],
  'gis_analyst': [
    Permission.MANAGE_SCHOOLS,
    Permission.UPLOAD_KMZ,
    Permission.VIEW_ANALYTICS,
  ],
  'viewer': [
    Permission.VIEW_ANALYTICS,
  ],
};
