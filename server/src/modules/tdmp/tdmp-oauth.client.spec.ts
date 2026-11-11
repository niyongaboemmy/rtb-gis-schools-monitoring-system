import * as crypto from 'crypto';
import { checkIdToken, createPkce } from './tdmp-oauth.client';
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
