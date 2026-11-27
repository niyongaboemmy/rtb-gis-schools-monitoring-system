import * as crypto from 'crypto';
import {
  checkIdToken,
  createPkce,
  TdmpOAuthClient,
  verifyRs256,
} from './tdmp-oauth.client';
import { TdmpApiClient } from './tdmp-api.client';
import { safeNext } from '../auth/tdmp/tdmp-auth.controller';

const ISSUER = 'https://tdmp.rtb.gov.rw/api/v1';
const NOW = 1_800_000_000;

const token = (claims: Record<string, unknown>) =>
  [
    Buffer.from('{"alg":"RS256"}').toString('base64url'),
    Buffer.from(JSON.stringify(claims)).toString('base64url'),
    'signature',
  ].join('.');

const good = {
  iss: ISSUER,
  aud: 'rtb-gis',
  sub: '7',
  exp: NOW + 300,
  nonce: 'n-1',
};
const expected = { issuer: ISSUER, clientId: 'rtb-gis', nonce: 'n-1' };

describe('checkIdToken', () => {
  it('accepts a matching token (trailing slash on the issuer is fine)', () => {
    expect(
      checkIdToken(token({ ...good, iss: `${ISSUER}/` }), expected, NOW),
    ).toMatchObject({ sub: '7' });
    expect(
      checkIdToken(
        token({ ...good, aud: ['other', 'rtb-gis'] }),
        expected,
        NOW,
      ),
    ).toMatchObject({ sub: '7' });
  });

  it.each([
    ['issuer', { iss: 'https://evil.example' }],
    ['audience', { aud: 'someone-else' }],
    ['expired', { exp: NOW - 1000 }],
    ['nonce', { nonce: 'replayed' }],
  ])('rejects a wrong %s', (_label, over) => {
    expect(() =>
      checkIdToken(token({ ...good, ...over }), expected, NOW),
    ).toThrow();
  });

  it('rejects garbage', () => {
    expect(() => checkIdToken('not-a-jwt', expected, NOW)).toThrow();
  });
});

describe('createPkce', () => {
  it('derives an S256 challenge from a fresh verifier', () => {
    const a = createPkce();
    const b = createPkce();
    expect(a.verifier).not.toBe(b.verifier);
    expect(a.verifier.length).toBeGreaterThanOrEqual(43);
    expect(a.challenge).toBe(
      crypto.createHash('sha256').update(a.verifier).digest('base64url'),
    );
  });
});

describe('safeNext', () => {
  it('keeps in-app paths only', () => {
    expect(safeNext('/schools/abc?tab=staff')).toBe('/schools/abc?tab=staff');
    expect(safeNext('//evil.example')).toBe('/');
    expect(safeNext('https://evil.example')).toBe('/');
    expect(safeNext('/\\evil.example')).toBe('/');
    expect(safeNext(undefined)).toBe('/');
  });
});

describe('authorizeUrl', () => {
  const config = {
    baseUrl: ISSUER,
    clientId: 'rtb-gis',
    redirectUri: 'https://gis.example/api/v1/auth/tdmp/callback',
    scopes: 'openid email profile',
  };
  const client = new TdmpOAuthClient(
    config as never,
    new TdmpApiClient(config as never),
  );
  const p = { state: 's', challenge: 'c', nonce: 'n' };

  it('is a code + PKCE request with no prompt by default', () => {
    const url = new URL(client.authorizeUrl(p));
    expect(url.origin + url.pathname).toBe(`${ISSUER}/oauth/authorize`);
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      response_type: 'code',
      client_id: 'rtb-gis',
      code_challenge: 'c',
      code_challenge_method: 'S256',
      state: 's',
      nonce: 'n',
    });
    expect(url.searchParams.has('prompt')).toBe(false);
  });

  it('asks for prompt=none on a silent attempt', () => {
    const url = new URL(client.authorizeUrl({ ...p, prompt: 'none' }));
    expect(url.searchParams.get('prompt')).toBe('none');
  });
});

describe('verifyRs256 (ID token signature)', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = (key: crypto.KeyObject, kid: string) => ({
    ...(key.export({ format: 'jwk' }) as { kty: string; n: string; e: string }),
    kid,
    alg: 'RS256',
  });
  const sign = (
    claims: Record<string, unknown>,
    header: Record<string, unknown> = { alg: 'RS256', kid: 'k1' },
    key = privateKey,
  ) => {
    const input = [header, claims]
      .map((p) => Buffer.from(JSON.stringify(p)).toString('base64url'))
      .join('.');
    const sig = crypto.sign('RSA-SHA256', Buffer.from(input), key);
    return `${input}.${sig.toString('base64url')}`;
  };
  const keys = [jwk(publicKey, 'k1'), jwk(other.publicKey, 'k2')];

  it('accepts a token signed with the key it names', () => {
    expect(verifyRs256(sign(good), keys)).toBe(true);
  });

  it('rejects a token signed with another key or tampered with', () => {
    expect(verifyRs256(sign(good, undefined, other.privateKey), keys)).toBe(
      false,
    );
    const [h, , s] = sign(good).split('.');
    const forged = Buffer.from(
      JSON.stringify({ ...good, sub: 'admin' }),
    ).toString('base64url');
    expect(verifyRs256(`${h}.${forged}.${s}`, keys)).toBe(false);
  });

  it('returns false for an unknown key id (caller re-reads the keys)', () => {
    expect(verifyRs256(sign(good, { alg: 'RS256', kid: 'k9' }), keys)).toBe(
      false,
    );
  });

  it('refuses unsigned and HMAC tokens outright', () => {
    expect(() =>
      verifyRs256(sign(good, { alg: 'none', kid: 'k1' }), keys),
    ).toThrow();
    expect(() =>
      verifyRs256(sign(good, { alg: 'HS256', kid: 'k1' }), keys),
    ).toThrow();
  });
});

describe('TdmpOAuthClient.checkClientCredentials', () => {
  const config = {
    baseUrl: ISSUER,
    clientId: 'rtb-gis',
    clientSecret: 's3cret',
    timeoutMs: 1000,
  };
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });
  const answer = (status: number, body: unknown) => {
    global.fetch = jest.fn(
      async () =>
        new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
    ) as typeof fetch;
  };
  const client = () =>
    new TdmpOAuthClient(config as never, new TdmpApiClient(config as never));

  it('reads invalid_grant as "TDMP knows our client"', async () => {
    answer(400, { error: 'invalid_grant' });
    await expect(client().checkClientCredentials()).resolves.toBe('accepted');
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.headers.Authorization).toBe(
      `Basic ${Buffer.from('rtb-gis:s3cret').toString('base64')}`,
    );
    expect(String(init.body)).toContain('grant_type=refresh_token');
  });

  it('reads invalid_client as a wrong id or secret', async () => {
    answer(401, { error: 'invalid_client' });
    await expect(client().checkClientCredentials()).resolves.toBe('rejected');
  });
});

describe('sign-in on another TDMP environment (TDMP_OAUTH_BASE_URL)', () => {
  const TEST = 'https://tdmptest.rtb.gov.rw/api/v1';
  const base = {
    baseUrl: ISSUER,
    clientId: 'rtb-gis',
    redirectUri: 'https://rtb.aerovyntech.com/auth/tdmp/callback',
    scopes: 'openid email profile',
    apiKey: 'rtbgis-prod-key',
    apiKeyHeader: 'authorization',
    timeoutMs: 1000,
  };
  const p = { state: 's', challenge: 'c', nonce: 'n' };
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const realFetch = global.fetch;
  beforeEach(() => {
    calls.length = 0;
    global.fetch = jest.fn((url: string, init?: RequestInit) => {
      calls.push({
        url: String(url),
        headers: (init?.headers ?? {}) as Record<string, string>,
      });
      return Promise.resolve(
        new Response(JSON.stringify({ keys: [], sub: '7' }), { status: 200 }),
      );
    }) as never;
  });
  afterAll(() => {
    global.fetch = realFetch;
  });

  it('sends sign-in to the test environment, data calls stay on production', async () => {
    const config = { ...base, oauthBaseUrl: TEST };
    const api = new TdmpApiClient(config as never);
    const client = new TdmpOAuthClient(config as never, api);
    expect(client.authorizeUrl(p)).toMatch(
      new RegExp(`^${TEST}/oauth/authorize\\?`),
    );
    await client.userinfo('user-token');
    expect(calls[0].url).toBe(`${TEST}/oauth/userinfo`);
    expect(api.url('/schools')).toBe(`${ISSUER}/schools`);
  });

  it('never sends our partner API key to the sign-in endpoints', async () => {
    const config = { ...base, oauthBaseUrl: TEST };
    const client = new TdmpOAuthClient(
      config as never,
      new TdmpApiClient(config as never),
    );
    await client.userinfo('user-token');
    await (client as unknown as { keys: () => Promise<unknown> }).keys();
    for (const c of calls) {
      expect(JSON.stringify(c.headers)).not.toContain('rtbgis-prod-key');
    }
    expect(calls[0].headers.Authorization).toBe('Bearer user-token');
  });

  it('without it, sign-in uses the data API base as before', () => {
    const client = new TdmpOAuthClient(
      base as never,
      new TdmpApiClient(base as never),
    );
    expect(client.authorizeUrl(p)).toMatch(
      new RegExp(`^${ISSUER}/oauth/authorize\\?`),
    );
  });
});
