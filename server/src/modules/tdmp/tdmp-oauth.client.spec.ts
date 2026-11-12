import * as crypto from 'crypto';
import { checkIdToken, createPkce, TdmpOAuthClient } from './tdmp-oauth.client';
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
