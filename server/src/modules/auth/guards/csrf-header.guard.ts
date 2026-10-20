import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { CSRF_HEADER, CSRF_HEADER_VALUE } from '../auth.constants';

/**
 * CSRF defence for the cookie-authenticated routes (refresh, logout). The
 * cookie is already SameSite=Strict; additionally requiring a custom header
 * means a cross-site form or image cannot trigger them, because a browser
 * only sends a custom header cross-origin after a CORS preflight that our
 * origin allow-list refuses.
 */
@Injectable()
export class CsrfHeaderGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined> }>();
    if (req.headers?.[CSRF_HEADER] !== CSRF_HEADER_VALUE)
      throw new ForbiddenException('Missing anti-CSRF header.');
    return true;
  }
}
