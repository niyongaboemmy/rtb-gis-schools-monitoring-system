export const Permission = {
  MANAGE_USERS: 'MANAGE_USERS',
  VIEW_USERS: 'VIEW_USERS',
  MANAGE_SCHOOLS: 'MANAGE_SCHOOLS',
  UPLOAD_KMZ: 'UPLOAD_KMZ',
  VIEW_ANALYTICS: 'VIEW_ANALYTICS',
  MANAGE_DECISIONS: 'MANAGE_DECISIONS',
  EXPORT_REPORTS: 'EXPORT_REPORTS',
} as const;

export type PermissionType = typeof Permission[keyof typeof Permission];

/**
 * Checks if a user has a specific permission
 */
export function hasPermission(user: any, permission: PermissionType): boolean {
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
export function checkAuthorized(user: any, requiredPermission?: PermissionType): boolean {
  if (!user) return false;
  if (!requiredPermission) return true; // No permission required
  return hasPermission(user, requiredPermission);
}
