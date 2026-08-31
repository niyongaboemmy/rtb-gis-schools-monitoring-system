import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission } from '../constants/permissions.constant';
import {
  PERMISSIONS_KEY,
  PERMISSIONS_ANY_KEY,
} from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requireAll = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    const requireAny = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_ANY_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Route did not opt into permission checks
    if (
      (!requireAll || requireAll.length === 0) &&
      (!requireAny || requireAny.length === 0)
    ) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.role) return false;

    // Super Admin bypass — always has all permissions
    const roleName = (user.role.name || '')
      .toLowerCase()
      .replace(/\s+/g, '_');
    if (roleName === 'super_admin') return true;

    const userPermissions: string[] = user.role.permissions || [];

    if (
      requireAll &&
      requireAll.length > 0 &&
      !requireAll.every((p) => userPermissions.includes(p))
    ) {
      return false;
    }

    if (
      requireAny &&
      requireAny.length > 0 &&
      !requireAny.some((p) => userPermissions.includes(p))
    ) {
      return false;
    }

    return true;
  }
}
