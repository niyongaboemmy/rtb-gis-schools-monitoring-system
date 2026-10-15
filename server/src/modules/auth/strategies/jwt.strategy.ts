import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { AuthService } from '../auth.service';
import { requireSecret } from '../../../config/env.validation';

interface AccessPayload {
  sub: string;
  email: string;
  role: unknown;
  sid?: string;
  /** Set on MFA / other single-purpose tokens — never valid here. */
  purpose?: string;
  typ?: string;
}

/**
 * While `mustChangePassword` is set the account can only reach the auth
 * routes and its own `users/me/*` routes (WS10.3).
 */
const PASSWORD_CHANGE_ALLOWED = [
  /^\/api\/v1\/auth(\/|$)/,
  /^\/api\/v1\/users\/me(\/|$)/,
];

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: requireSecret(
        (k) => configService.get<string>(k),
        'JWT_SECRET',
      ),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: AccessPayload) {
    // Defence in depth: purpose-scoped tokens are signed with other keys,
    // but refuse them here too.
    if (payload.purpose || (payload.typ && payload.typ !== 'access'))
      throw new UnauthorizedException();

    const user = await this.authService.validateUser(payload.sub);
    if (!user) throw new UnauthorizedException();

    if (user.mustChangePassword) {
      const path = (req.originalUrl ?? req.url ?? '').split('?')[0];
      if (!PASSWORD_CHANGE_ALLOWED.some((re) => re.test(path)))
        throw new ForbiddenException({
          statusCode: 403,
          code: 'PASSWORD_CHANGE_REQUIRED',
          message: 'You must change your password before continuing.',
        });
    }

    // The session this access token belongs to ("this device", revoke others).
    return Object.assign(user, { sessionId: payload.sid });
  }
}
