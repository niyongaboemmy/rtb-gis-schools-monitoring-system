const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { detectFileKind, findRejectedFiles } = require('./file-types');

const b = (...x) => Buffer.from(x);
test('detects common upload types by content', () => {
  assert.equal(detectFileKind(Buffer.concat([b(0x50, 0x4b, 3, 4), Buffer.alloc(8)])), 'zip');
  assert.equal(detectFileKind(Buffer.from('glTF\u0002\0\0\0')), 'glb');
  assert.equal(detectFileKind(b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), 'png');
  assert.equal(detectFileKind(b(0xff, 0xd8, 0xff, 0xe0)), 'jpeg');
  assert.equal(detectFileKind(Buffer.from('\0\0\0\u0018ftypisom')), 'mp4');
  assert.equal(detectFileKind(Buffer.from('\0\0\0\u0018ftypheic')), 'heic');
  assert.equal(detectFileKind(Buffer.from('II*\0')), 'tiff');
  assert.equal(detectFileKind(Buffer.from('<?xml version="1.0"?><kml>')), 'xml');
  assert.equal(detectFileKind(Buffer.from('{"type":"FeatureCollection"}')), 'json');
  assert.equal(detectFileKind(Buffer.from('<script>alert(1)</script>')), null);
  assert.equal(detectFileKind(Buffer.from('MZ\x90\0')), null);
});

test('rejects files whose content does not fit the folder', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ft-'));
  const png = path.join(dir, 'a.png');
  const html = path.join(dir, 'b.png');
  fs.writeFileSync(png, b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0));
  fs.writeFileSync(html, '<html><script>x</script>');
  const files = [
    { path: png, originalname: 'a.png' },
    { path: html, originalname: 'b.png' },
  ];
  assert.deepEqual(findRejectedFiles(files, 'reports'), ['b.png']);
  assert.deepEqual(findRejectedFiles([files[0]], 'kmz'), ['a.png']);
  fs.rmSync(dir, { recursive: true });
});
