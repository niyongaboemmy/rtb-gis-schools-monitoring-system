import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PATH_METADATA } from '@nestjs/common/constants';
import {
  AUDIT_META_KEY,
  AUDIT_SKIP_KEY,
  type AuditSpec,
} from './audit.decorator';
import {
  getAuditContextFromRequest,
  type AuditHandlerInfo,
} from './request-context';

function joinPath(...parts: unknown[]): string {
  const segs = parts
    .flatMap((p) => (Array.isArray(p) ? [p[0]] : [p]))
    .filter((p): p is string => typeof p === 'string')
    .map((p) => p.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean);
  return `/${segs.join('/')}`;
}

/** Resolves the handler identity and `@Audit()` metadata for a request. */
export function describeHandler(
  context: ExecutionContext,
  reflector: Reflector,
): AuditHandlerInfo {
  const cls = context.getClass();
  const handler = context.getHandler();
  const decorated =
    reflector.get<AuditSpec | undefined>(AUDIT_META_KEY, handler) ?? null;
  const skipped =
    reflector.getAllAndOverride<boolean>(AUDIT_SKIP_KEY, [handler, cls]) ??
    false;
  return {
    key: `${cls.name}.${handler.name}`,
    routePath: joinPath(
      Reflect.getMetadata(PATH_METADATA, cls),
      Reflect.getMetadata(PATH_METADATA, handler),
    ),
    decorated,
    skipped,
  };
}

/**
 * Global guard that never blocks: it runs before controller guards so the
 * audit context knows which handler a request targeted even when JwtAuthGuard
 * or PermissionsGuard then rejects it (outcome = denied).
 */
@Injectable()
export class AuditContextGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest();
    const ctx = getAuditContextFromRequest(req);
    if (ctx && !ctx.handler)
      ctx.handler = describeHandler(context, this.reflector);
    return true;
  }
}
