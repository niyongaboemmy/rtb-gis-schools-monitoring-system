import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { TdmpConfig } from './tdmp.config';
import { TdmpApiClient, TdmpRequestError } from './tdmp-api.client';
import type {
  TdmpAccessScope,
  TdmpJwk,
  TdmpTokenSet,
  TdmpUserInfo,
} from './tdmp.types';

/** Allowed clock difference when checking ID token times. */
const CLOCK_SKEW_S = 120;

/** TDMP's keys are cached this long, and re-read at most this often. */
const JWKS_TTL_MS = 60 * 60 * 1000;
const JWKS_MIN_REFETCH_MS = 60 * 1000;

export interface IdTokenClaims {
  iss?: string;
  aud?: string | string[];
  sub?: string;
  exp?: number;
  nonce?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
}

/**
 * Checks an RS256 JWT signature against TDMP's keys (SSO guide §7). Only
 * RS256 is accepted, so `none` and HMAC tokens are refused. Returns false for
 * an unknown key id; throws for a malformed token.
 */
export function verifyRs256(token: string, keys: TdmpJwk[]): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed ID token');
  let header: { alg?: string; kid?: string };
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  } catch {
    throw new Error('Malformed ID token');
  }
  if (header.alg !== 'RS256') throw new Error('ID token is not RS256');
  const rsa = keys.filter((k) => k.kty === 'RSA' && k.n && k.e);
  const key = header.kid
    ? rsa.find((k) => k.kid === header.kid)
    : rsa.length === 1
      ? rsa[0]
      : undefined;
  if (!key) return false;
  const publicKey = crypto.createPublicKey({
    key: { kty: 'RSA', n: key.n, e: key.e },
    format: 'jwk',
  });
  return crypto.verify(
    'RSA-SHA256',
    Buffer.from(`${parts[0]}.${parts[1]}`),
    publicKey,
    Buffer.from(parts[2], 'base64url'),
  );
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
 * The signature is checked separately (`TdmpOAuthClient.verifyIdToken`).
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
  private jwks: { keys: TdmpJwk[]; at: number } | null = null;

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

  /**
   * Signature (TDMP's JWKS, RS256) and claims (issuer, audience, expiry,
   * nonce) of an ID token. TDMP rotating its key is handled by re-reading
   * the key set once when the key id is unknown.
   */
  async verifyIdToken(idToken: string, nonce: string): Promise<IdTokenClaims> {
    let ok = verifyRs256(idToken, await this.keys());
    if (!ok && Date.now() - (this.jwks?.at ?? 0) > JWKS_MIN_REFETCH_MS)
      ok = verifyRs256(idToken, await this.keys(true));
    if (!ok) throw new Error('ID token signature is not valid');
    return this.checkIdToken(idToken, nonce);
  }

  /**
   * Whether TDMP accepts our client ID and secret, without any user: a
   * refresh with a made-up token answers `invalid_grant` (400) for a known
   * client and `invalid_client` (401) otherwise (SSO guide §11.2).
   */
  async checkClientCredentials(): Promise<
    'accepted' | 'rejected' | 'unreachable'
  > {
    try {
      await this.api.request(
        '/oauth/token',
        this.formInit({
          grant_type: 'refresh_token',
          refresh_token: 'rtb-gis-credential-check',
        }),
      );
      return 'accepted';
    } catch (err) {
      if (err instanceof TdmpRequestError) {
        const code = (err.body as { error?: string } | null)?.error;
        if (err.status === 401 || code === 'invalid_client') return 'rejected';
        return 'accepted';
      }
      return 'unreachable';
    }
  }

  /** RS256 signing keys TDMP publishes, or null when they can't be read. */
  async signingKeyCount(): Promise<number | null> {
    try {
      const keys = await this.keys(true);
      return keys.filter((k) => k.kty === 'RSA' && k.n && k.e).length;
    } catch {
      return null;
    }
  }

  private async keys(force = false): Promise<TdmpJwk[]> {
    if (!force && this.jwks && Date.now() - this.jwks.at < JWKS_TTL_MS)
      return this.jwks.keys;
    const set = await this.api.request<{ keys?: TdmpJwk[] }>(
      '/oauth/.well-known/jwks.json',
      { method: 'GET', headers: { Accept: 'application/json' } },
    );
    this.jwks = {
      keys: Array.isArray(set?.keys) ? set.keys : [],
      at: Date.now(),
    };
    return this.jwks.keys;
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
