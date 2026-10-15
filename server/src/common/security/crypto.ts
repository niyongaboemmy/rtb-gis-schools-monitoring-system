import * as crypto from 'crypto';

/**
 * Small crypto helpers shared by the auth module: AES-256-GCM for secrets at
 * rest (TOTP seeds), HKDF key derivation, SHA-256 digests and constant-time
 * comparison.
 */

const GCM_IV_BYTES = 12;

/** Parses a 32-byte key given as 64 hex chars or base64. Throws otherwise. */
export function parseKey(raw: string, name = 'key'): Buffer {
  const value = raw.trim();
  let key: Buffer | null = null;
  if (/^[0-9a-fA-F]{64}$/.test(value)) key = Buffer.from(value, 'hex');
  else if (/^[A-Za-z0-9+/_-]{42,44}={0,2}$/.test(value))
    key = Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  if (!key || key.length !== 32)
    throw new Error(
      `${name} must be 32 bytes, as 64 hex characters or base64 (openssl rand -hex 32)`,
    );
  return key;
}

/** HKDF-SHA256 → 32-byte key. Used to derive purpose-specific keys. */
export function deriveKey(secret: string, info: string): Buffer {
  return Buffer.from(
    crypto.hkdfSync(
      'sha256',
      Buffer.from(secret, 'utf8'),
      Buffer.alloc(0),
      info,
      32,
    ),
  );
}

/**
 * Encrypts `plain` → `<keyId>:<iv>:<tag>:<ciphertext>` (base64 parts). The
 * key id is stored so a later key change can still read rows written with an
 * earlier (e.g. derived development) key.
 */
export function encryptString(
  plain: string,
  key: Buffer,
  keyId: string,
): string {
  const iv = crypto.randomBytes(GCM_IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    keyId,
    iv.toString('base64'),
    tag.toString('base64'),
    ct.toString('base64'),
  ].join(':');
}

/** Returns the key id an encrypted value was written with. */
export function encryptedKeyId(payload: string): string {
  return payload.split(':')[0] ?? '';
}

/** Inverse of `encryptString`. Throws if the payload was tampered with. */
export function decryptString(payload: string, key: Buffer): string {
  const parts = payload.split(':');
  if (parts.length !== 4) throw new Error('Malformed encrypted value');
  const [, ivB64, tagB64, ctB64] = parts;
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivB64, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

export function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/** Constant-time comparison of two hex digests. */
export function hexDigestsEqual(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return false;
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return (
    left.length === right.length &&
    left.length > 0 &&
    crypto.timingSafeEqual(left, right)
  );
}

/** URL-safe random token. */
export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}
