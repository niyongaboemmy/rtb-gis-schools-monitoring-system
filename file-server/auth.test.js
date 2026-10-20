const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { verifyJwt, roleAllows, isUuid, createRequireUploader } = require('./auth');

const SECRET = 'a'.repeat(40);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function sign(payload, secret = SECRET, alg = 'HS256') {
  const h = b64({ alg, typ: 'JWT' });
  const p = b64(payload);
  const s = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${s}`;
}
const future = () => Math.floor(Date.now() / 1000) + 600;

test('verifyJwt accepts a valid token', () => {
  const t = sign({ sub: 'u1', exp: future() });
  assert.equal(verifyJwt(t, SECRET).sub, 'u1');
});

test('verifyJwt rejects a wrong secret, expiry, tampering and alg=none', () => {
  assert.equal(verifyJwt(sign({ sub: 'u1', exp: future() }, 'b'.repeat(40)), SECRET), null);
  assert.equal(verifyJwt(sign({ sub: 'u1', exp: 1 }), SECRET), null);
  const t = sign({ sub: 'u1', exp: future() }).split('.');
  t[1] = b64({ sub: 'admin', exp: future() });
  assert.equal(verifyJwt(t.join('.'), SECRET), null);
  assert.equal(verifyJwt(`${b64({ alg: 'none' })}.${b64({ sub: 'x' })}.`, SECRET), null);
  assert.equal(verifyJwt('garbage', SECRET), null);
  assert.equal(verifyJwt(sign({ sub: 'u1' }), ''), null);
});

test('roleAllows checks permissions and super_admin', () => {
  assert.ok(roleAllows({ role: { name: 'Super Admin', permissions: [] } }, ['X']));
  assert.ok(roleAllows({ role: { name: 'gis', permissions: ['UPLOAD_KMZ'] } }, ['UPLOAD_KMZ']));
  assert.ok(!roleAllows({ role: { name: 'viewer', permissions: ['CREATE_REPORT'] } }, ['UPLOAD_KMZ']));
  assert.ok(!roleAllows({ role: 'viewer' }, ['UPLOAD_KMZ']));
});

test('isUuid rejects traversal', () => {
  assert.ok(isUuid('8fdd1801-1234-4abc-8def-1234567890ab'));
  assert.ok(!isUuid('../..'));
  assert.ok(!isUuid('8fdd1801-1234-4abc-8def-1234567890ab/../x'));
});

function run(mw, req) {
  return new Promise((resolve) => {
    const res = {
      code: 200,
      status(c) { this.code = c; return this; },
      json(b) { resolve({ code: this.code, body: b }); },
    };
    mw({ headers: {}, query: {}, ...req }, res, () => resolve({ code: 'next' }));
  });
}
const resolveFolder = (f) => f || 'reports';

test('uploader middleware: 503 without secret, 401 without token, 403 wrong role, next on success', async () => {
  assert.equal((await run(createRequireUploader({ jwtSecret: '', resolveFolder }), {})).code, 503);
  assert.equal((await run(createRequireUploader({ jwtSecret: '', allowAnonymous: true, resolveFolder }), {})).code, 'next');
  const mw = createRequireUploader({ jwtSecret: SECRET, resolveFolder });
  assert.equal((await run(mw, {})).code, 401);
  const viewer = sign({ sub: 'u', exp: future(), role: { name: 'viewer', permissions: ['CREATE_REPORT'] } });
  assert.equal((await run(mw, { headers: { authorization: `Bearer ${viewer}` }, query: { folder: 'kmz' } })).code, 403);
  assert.equal((await run(mw, { headers: { authorization: `Bearer ${viewer}` }, query: { folder: 'reports' } })).code, 'next');
  const legacy = createRequireUploader({ jwtSecret: SECRET, uploadToken: 'tok', resolveFolder });
  assert.equal((await run(legacy, { headers: { 'x-file-server-token': 'tok' } })).code, 'next');
});
