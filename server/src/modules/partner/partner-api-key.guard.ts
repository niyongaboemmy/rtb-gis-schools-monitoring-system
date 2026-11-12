import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PartnerKeysService } from './partner-keys.service';
import type {
  PartnerApiKey,
  PartnerScope,
} from './entities/partner-api-key.entity';

const SCOPES_KEY = 'partner:scopes';

/** Scopes the partner key must hold for this route. */
export const PartnerScopes = (...scopes: PartnerScope[]) =>
  SetMetadata(SCOPES_KEY, scopes);

/** The calling partner key (set by PartnerApiKeyGuard). */
export const CurrentPartner = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): PartnerApiKey =>
    ctx.switchToHttp().getRequest<Request & { partner: PartnerApiKey }>()
      .partner,
);

/** `Authorization: ApiKey <key>` (TDMP's own convention) or `X-API-Key: <key>`. */
export function readPartnerKey(req: Pick<Request, 'headers'>): string | null {
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && /^ApiKey\s+/i.test(auth))
    return auth.replace(/^ApiKey\s+/i, '').trim();
  const header = req.headers['x-api-key'];
  return typeof header === 'string' && header.trim() ? header.trim() : null;
}

/** Authenticates partner platforms by API key; no user session involved. */
@Injectable()
export class PartnerApiKeyGuard implements CanActivate {
  constructor(
    private readonly keys: PartnerKeysService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx
      .switchToHttp()
      .getRequest<Request & { partner?: PartnerApiKey }>();
    const key = await this.keys.verify(readPartnerKey(req));
    if (!key)
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'PARTNER_KEY_INVALID',
        message:
          'Missing, unknown or revoked partner API key. Send "Authorization: ApiKey rtbgis_pk_…".',
      });
    const needed =
      this.reflector.getAllAndOverride<PartnerScope[]>(SCOPES_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ]) ?? [];
    const missing = needed.filter((s) => !key.scopes.includes(s));
    if (missing.length)
      throw new ForbiddenException({
        statusCode: 403,
        code: 'PARTNER_SCOPE_MISSING',
        message: `This key lacks the scope(s): ${missing.join(', ')}`,
      });
    req.partner = key;
    return true;
  }
}
