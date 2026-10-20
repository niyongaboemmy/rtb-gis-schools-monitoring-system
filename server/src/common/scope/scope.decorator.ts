import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { resolveAccessScope, AccessScope } from './access-scope';

/**
 * Injects the resolved `AccessScope` for the current request user.
 * Usage: `findAll(@CurrentScope() scope: AccessScope) { ... }`
 */
export const CurrentScope = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AccessScope => {
    const req = ctx.switchToHttp().getRequest();
    return resolveAccessScope(req.user);
  },
);

export const SCOPED_RESOURCE_KEY = 'scoped_resource';

export interface ScopedResourceConfig {
  /** request key holding the id */
  param: string;
  /** where to read it from */
  from: 'params' | 'query';
  /**
   * When set, the param is the id of a related record, not a school — the
   * guard resolves it to a schoolId first.
   */
  via?: 'building' | 'survey';
}

/**
 * Marks a route as operating on a single school, so `ScopeGuard` verifies the
 * target school falls inside the caller's geographic scope before the handler
 * runs. No-op unless `SCOPE_ENFORCEMENT` is on.
 */
export const ScopedResource = (
  param = 'id',
  from: 'params' | 'query' = 'params',
  via?: 'building' | 'survey',
) =>
  SetMetadata(SCOPED_RESOURCE_KEY, {
    param,
    from,
    via,
  } as ScopedResourceConfig);

export const NATIONAL_ONLY_KEY = 'national_only';

/**
 * Marks a route as national-only: callers bound to a sub-national tier are
 * rejected (403) even if they hold the permission. For genuinely global
 * actions — recalculate-all, cross-scope exports, population sync.
 */
export const RequireNationalScope = () => SetMetadata(NATIONAL_ONLY_KEY, true);
