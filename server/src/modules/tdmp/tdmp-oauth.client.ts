import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { TdmpConfig } from './tdmp.config';
import { TdmpApiClient } from './tdmp-api.client';
import type { TdmpAccessScope, TdmpTokenSet, TdmpUserInfo } from './tdmp.types';

/** Allowed clock difference when checking ID token times. */
const CLOCK_SKEW_S = 120;

export interface IdTokenClaims {
  iss?: string;
  aud?: string | string[];
  sub?: string;
  exp?: number;
  nonce?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
}

/** S256 PKCE pair (RFC 7636). */
export function createPkce(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
  return { verifier, challenge };
}

/**
 * Reads an ID token's claims and checks issuer, audience, expiry and nonce.
 * The signature is not verified: the token comes straight from TDMP's token
 * endpoint over TLS with our client credentials (OIDC Core §3.1.3.7).
 */
export function checkIdToken(
  idToken: string,
  expected: { issuer: string; clientId: string; nonce: string },
  nowS = Math.floor(Date.now() / 1000),
): IdTokenClaims {
  const part = idToken.split('.')[1];
  if (!part) throw new Error('Malformed ID token');
  let claims: IdTokenClaims;
  try {
    claims = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Malformed ID token');
  }
  const strip = (s: string) => s.replace(/\/+$/, '');
  if (!claims.iss || strip(claims.iss) !== strip(expected.issuer))
    throw new Error('ID token issuer mismatch');
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(expected.clientId))
    throw new Error('ID token audience mismatch');
  if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_S < nowS)
    throw new Error('ID token expired');
  if (claims.nonce !== expected.nonce)
    throw new Error('ID token nonce mismatch');
  return claims;
}

/** TDMP as an OAuth 2.0 / OpenID Connect provider for user sign-in. */
@Injectable()
export class TdmpOAuthClient {
  constructor(
    private readonly config: TdmpConfig,
    private readonly api: TdmpApiClient,
  ) {}

  /** `prompt: 'none'` = come straight back if TDMP already has a session. */
  authorizeUrl(p: {
    state: string;
    challenge: string;
    nonce: string;
    prompt?: 'none';
  }): string {
    return this.api.url('/oauth/authorize', {
      prompt: p.prompt,
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes,
      state: p.state,
      nonce: p.nonce,
      code_challenge: p.challenge,
      code_challenge_method: 'S256',
    });
  }

  exchangeCode(code: string, verifier: string): Promise<TdmpTokenSet> {
    return this.token({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.redirectUri,
      code_verifier: verifier,
    });
  }

  refresh(refreshToken: string): Promise<TdmpTokenSet> {
    return this.token({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
  }

  /** RFC 7009 revocation. Best effort: TDMP may already have dropped it. */
  async revoke(token: string): Promise<void> {
    await this.api
      .request('/oauth/revoke', this.formInit({ token }))
      .catch(() => undefined);
  }

  userinfo(accessToken: string): Promise<TdmpUserInfo> {
    return this.api.get<TdmpUserInfo>('/oauth/userinfo', {}, accessToken);
  }

  async accessScope(accessToken: string): Promise<TdmpAccessScope> {
    const res = await this.api.get<{ data: TdmpAccessScope }>(
      '/auth/me/access-scope',
      {},
      accessToken,
    );
    return res.data;
  }

  checkIdToken(idToken: string, nonce: string): IdTokenClaims {
    return checkIdToken(idToken, {
      issuer: this.config.issuer,
      clientId: this.config.clientId,
      nonce,
    });
  }

  private async token(form: Record<string, string>): Promise<TdmpTokenSet> {
    const set = await this.api.request<TdmpTokenSet>(
      '/oauth/token',
      this.formInit(form),
    );
    if (!set?.access_token) throw new Error('TDMP issued no access token');
    return set;
  }

  /** `application/x-www-form-urlencoded` POST with HTTP Basic client auth. */
  private formInit(form: Record<string, string>): RequestInit {
    const basic = Buffer.from(
      `${encodeURIComponent(this.config.clientId)}:${encodeURIComponent(this.config.clientSecret)}`,
    ).toString('base64');
    return {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basic}`,
      },
      body: new URLSearchParams(form).toString(),
    };
  }
}
