import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission } from '../constants/permissions.constant';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (!requiredPermissions) {
      return true; // No permissions required
    }
    
    const { user } = context.switchToHttp().getRequest();
    
    if (!user) {
      return false;
    }
    
    if (!user.role) {
      return false;
    }

    const userPermissions = user.role.permissions || [];
    return requiredPermissions.every((permission) => userPermissions.includes(permission));
  }
}
