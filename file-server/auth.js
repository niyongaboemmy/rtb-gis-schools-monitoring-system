/**
 * Upload authentication for the file-server.
 *
 * Writes require the caller's API access token (an HS256 JWT signed with the
 * API's JWT_SECRET). The server verifies it locally: no network call, no extra
 * dependency. Reads stay public; the files are served as static assets.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

/** Permissions that allow an upload into each folder. Any one suffices. */
const FOLDER_PERMISSIONS = {
  reports: ['CREATE_REPORT', 'MANAGE_REPORTS'],
  buildings: ['EDIT_SCHOOL_BUILDINGS', 'MANAGE_SCHOOLS'],
  kmz: ['UPLOAD_KMZ'],
  'places-overlay': ['EDIT_SITE_ANNOTATIONS', 'UPLOAD_KMZ'],
};

/** Reads KEY=value from a dotenv-style file without exporting anything else. */
function readEnvValue(file, key) {
  try {
    const line = fs
      .readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .find((l) => l.trim().startsWith(`${key}=`));
    if (!line) return '';
    return line
      .slice(line.indexOf('=') + 1)
      .trim()
      .replace(/^(['"])(.*)\1$/, '$2');
  } catch {
    return '';
  }
}

/**
 * The API's JWT secret, from (in order): JWT_SECRET in this process's env, the
 * API env file named by FILE_SERVER_API_ENV_FILE, the production API env file,
 * or the sibling server/.env used in local development.
 */
function resolveJwtSecret(env = process.env) {
  if (env.JWT_SECRET && env.JWT_SECRET.trim()) return env.JWT_SECRET.trim();
  const candidates = [
    env.FILE_SERVER_API_ENV_FILE,
    '/var/lib/rtb/env/server.env',
    path.join(__dirname, '..', 'server', '.env'),
  ].filter(Boolean);
  for (const file of candidates) {
    const value = readEnvValue(file, 'JWT_SECRET');
    if (value) return value;
  }
  return '';
}

const b64url = (buf) =>
  Buffer.from(buf)
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

/** Verifies an HS256 JWT. Returns the payload, or null if invalid or expired. */
function verifyJwt(token, secret, nowSec = Math.floor(Date.now() / 1000)) {
  if (!token || !secret) return null;
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  const [h, p, sig] = parts;
  try {
    const header = JSON.parse(Buffer.from(h, 'base64url').toString('utf8'));
    if (header.alg !== 'HS256') return null;
    const expected = b64url(
      crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest(),
    );
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
    if (typeof payload.exp === 'number' && payload.exp <= nowSec) return null;
    if (typeof payload.nbf === 'number' && payload.nbf > nowSec) return null;
    return payload;
  } catch {
    return null;
  }
}

/** True if the token's role grants any of `required` (super_admin: all). */
function roleAllows(payload, required) {
  const role = payload && payload.role;
  if (!role || typeof role !== 'object') return false;
  const name = String(role.name || '').toLowerCase().replace(/\s+/g, '_');
  if (name === 'super_admin') return true;
  const perms = Array.isArray(role.permissions) ? role.permissions : [];
  return required.some((p) => perms.includes(p));
}

/**
 * Express middleware factory for write routes.
 *  - With a JWT secret: requires `Authorization: Bearer <access token>` whose
 *    role may write to the requested folder. A legacy shared `uploadToken`
 *    (x-file-server-token) is still accepted for server-to-server calls.
 *  - Without one: refuses writes (503) unless `allowAnonymous` is set, which
 *    is meant for local development only.
 */
function createRequireUploader({
  jwtSecret,
  uploadToken = '',
  allowAnonymous = false,
  resolveFolder,
}) {
  return (req, res, next) => {
    if (uploadToken && req.headers['x-file-server-token'] === uploadToken)
      return next();

    if (!jwtSecret) {
      if (allowAnonymous) return next();
      return res.status(503).json({
        success: false,
        message: 'Uploads are disabled: the file-server has no JWT secret configured.',
      });
    }

    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const payload = verifyJwt(token, jwtSecret);
    if (!payload)
      return res.status(401).json({ success: false, message: 'Sign in again to upload files.' });

    const folder = resolveFolder(req.query.folder);
    if (!roleAllows(payload, FOLDER_PERMISSIONS[folder] || []))
      return res.status(403).json({ success: false, message: 'You do not have permission to upload here.' });

    req.uploader = { id: payload.sub, email: payload.email };
    return next();
  };
}

module.exports = {
  isUuid,
  verifyJwt,
  roleAllows,
  resolveJwtSecret,
  createRequireUploader,
  FOLDER_PERMISSIONS,
};
