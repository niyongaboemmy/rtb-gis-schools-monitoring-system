import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import {
  decryptString,
  deriveKey,
  encryptString,
} from '../../../common/security/crypto';
import { REFRESH_COOKIE_PATH } from '../auth.constants';
import { readCookie, secureCookies } from '../refresh-cookie';
import type { PendingTdmpSignIn } from '../auth.service';

/**
 * A TDMP sign-in that still needs our second factor. The TDMP callback sets
 * this httpOnly cookie and sends the browser to /login?sso_mfa=1; the 2FA
 * routes (same cookie path as the refresh cookie) read it to finish the
 * sign-in with the user's TDMP refresh token. Encrypted, 10 minutes, one use.
 */
const PENDING_COOKIE = 'rtb_tdmp_pending';
const PENDING_TTL_MS = 10 * 60 * 1000;
const KEY_ID = 'pend1';

function key(config: ConfigService): Buffer {
  return deriveKey(
    config.get<string>('JWT_SECRET') ?? '',
    'rtb-gis/tdmp-pending/v1',
  );
}

function options(config: ConfigService) {
  return {
    httpOnly: true,
    secure: secureCookies(config),
    sameSite: 'strict' as const,
    path: REFRESH_COOKIE_PATH,
  };
}

export function setPendingTdmp(
  res: Response,
  config: ConfigService,
  pending: PendingTdmpSignIn,
) {
  const value = encryptString(
    JSON.stringify({ ...pending, exp: Date.now() + PENDING_TTL_MS }),
    key(config),
    KEY_ID,
  );
  res.cookie(PENDING_COOKIE, value, {
    ...options(config),
    maxAge: PENDING_TTL_MS,
  });
}

export function readPendingTdmp(
  req: Request,
  config: ConfigService,
): PendingTdmpSignIn | null {
  const raw = readCookie(req, PENDING_COOKIE);
  if (!raw) return null;
  try {
    const p = JSON.parse(decryptString(raw, key(config))) as PendingTdmpSignIn & {
      exp?: number;
    };
    if (typeof p.userId !== 'string' || !p.exp || p.exp <= Date.now())
      return null;
    return { userId: p.userId, refreshToken: p.refreshToken };
  } catch {
    return null;
  }
}

export function clearPendingTdmp(res: Response, config: ConfigService) {
  res.clearCookie(PENDING_COOKIE, options(config));
}
