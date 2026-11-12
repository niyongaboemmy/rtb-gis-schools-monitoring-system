import type { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import { REFRESH_COOKIE, REFRESH_COOKIE_PATH } from './auth.constants';

/** COOKIE_SECURE overrides; otherwise Secure in production only. */
export function secureCookies(config: ConfigService): boolean {
  const raw = config.get<string>('COOKIE_SECURE')?.trim().toLowerCase();
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return config.get<string>('NODE_ENV') === 'production';
}

function refreshCookieOptions(config: ConfigService): CookieOptions {
  return {
    httpOnly: true,
    secure: secureCookies(config),
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
  };
}

/** Puts a session's refresh token in the httpOnly `rtb_rt` cookie. */
export function setRefreshCookie(
  res: Response,
  config: ConfigService,
  token: string,
  maxAgeMs: number,
) {
  res.cookie(REFRESH_COOKIE, token, {
    ...refreshCookieOptions(config),
    maxAge: maxAgeMs,
  });
}

export function clearRefreshCookie(res: Response, config: ConfigService) {
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions(config));
}

export function readCookie(req: Request, name: string): string | undefined {
  const value = (req.cookies as Record<string, string> | undefined)?.[name];
  return typeof value === 'string' && value ? value : undefined;
}
