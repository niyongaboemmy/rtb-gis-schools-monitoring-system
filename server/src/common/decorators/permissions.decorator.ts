import { SetMetadata } from '@nestjs/common';
import { Permission } from '../constants/permissions.constant';

export const PERMISSIONS_KEY = 'permissions';
export const PERMISSIONS_ANY_KEY = 'permissions_any';

/** Route requires ALL of the listed permissions. */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/** Route requires AT LEAST ONE of the listed permissions. */
export const RequireAnyPermission = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_ANY_KEY, permissions);
