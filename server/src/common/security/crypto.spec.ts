import * as crypto from 'crypto';
import {
  decryptString,
  deriveKey,
  encryptString,
  encryptedKeyId,
  hexDigestsEqual,
  parseKey,
  sha256Hex,
} from './crypto';

describe('security/crypto', () => {
  const key = crypto.randomBytes(32);

  it('round-trips AES-256-GCM with a key id and random IV', () => {
    const a = encryptString('JBSWY3DPEHPK3PXP', key, 'k1');
    const b = encryptString('JBSWY3DPEHPK3PXP', key, 'k1');
    expect(a).not.toBe(b);
    expect(encryptedKeyId(a)).toBe('k1');
    expect(a).not.toContain('JBSWY3DPEHPK3PXP');
    expect(decryptString(a, key)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('detects tampering and the wrong key', () => {
    const enc = encryptString('secret', key, 'k1');
    const parts = enc.split(':');
    const ct = Buffer.from(parts[3], 'base64');
    ct[0] ^= 0xff;
    parts[3] = ct.toString('base64');
    expect(() => decryptString(parts.join(':'), key)).toThrow();
    expect(() => decryptString(enc, crypto.randomBytes(32))).toThrow();
  });

  it('parses hex and base64 keys and rejects anything else', () => {
    expect(parseKey(key.toString('hex'))).toEqual(key);
    expect(parseKey(key.toString('base64'))).toEqual(key);
    expect(() => parseKey('too-short')).toThrow(/32 bytes/);
    expect(() => parseKey(crypto.randomBytes(16).toString('hex'))).toThrow();
  });

  it('derives stable, purpose-separated keys', () => {
    expect(deriveKey('s', 'a')).toEqual(deriveKey('s', 'a'));
    expect(deriveKey('s', 'a')).not.toEqual(deriveKey('s', 'b'));
    expect(deriveKey('s', 'a')).toHaveLength(32);
  });

  it('compares digests in constant time and handles empties', () => {
    expect(hexDigestsEqual(sha256Hex('x'), sha256Hex('x'))).toBe(true);
    expect(hexDigestsEqual(sha256Hex('x'), sha256Hex('y'))).toBe(false);
    expect(hexDigestsEqual(null, sha256Hex('y'))).toBe(false);
    expect(hexDigestsEqual('', '')).toBe(false);
  });
});
