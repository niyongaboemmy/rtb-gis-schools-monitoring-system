import { useAuthStore } from '../store/authStore';
import type { PermissionType } from '../lib/permissions';
import { hasPermission, checkAuthorized } from '../lib/permissions';

/**
 * React hook for checking user authorization and permissions
 */
export function useAuthorization() {
  const { user, isAuthenticated } = useAuthStore();

  const isAuthorized = (permission?: PermissionType) => {
    if (!isAuthenticated || !user) return false;
    return checkAuthorized(user, permission);
  };

  return {
    user,
    isAuthenticated,
    isAuthorized,
    hasPermission: (permission: PermissionType) => hasPermission(user, permission),
  };
}
