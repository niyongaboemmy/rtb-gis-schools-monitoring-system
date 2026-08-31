import { useAuthStore } from '../store/authStore';
import type { PermissionType } from '../lib/permissions';
import { hasPermission, hasAnyPermission, checkAuthorized } from '../lib/permissions';

/**
 * React hook for checking user authorization and permissions
 */
export function useAuthorization() {
  const { user, isAuthenticated } = useAuthStore();

  const isAuthorized = (permission?: PermissionType) => {
    if (!isAuthenticated || !user) return false;
    return checkAuthorized(user, permission);
  };

  const isAnyAuthorized = (permissions: PermissionType[]) => {
    if (!isAuthenticated || !user) return false;
    return hasAnyPermission(user, permissions);
  };

  return {
    user,
    isAuthenticated,
    isAuthorized,
    isAnyAuthorized,
    hasPermission: (permission: PermissionType) => hasPermission(user, permission),
    hasAnyPermission: (permissions: PermissionType[]) => hasAnyPermission(user, permissions),
  };
}
