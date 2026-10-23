const test = require('node:test');
const assert = require('node:assert');
const { cacheControlFor } = require('./cache-control');

test('pyramid tiles are immutable for a year', () => {
  assert.match(cacheControlFor('/srv/storage/schools/s1/kmz_2d_content/_pyramid/b1/3/1/2.webp'), /max-age=31536000, immutable/);
  assert.match(cacheControlFor('/srv/storage/schools/s1/kmz_2d_content/_tiles/b1/24/9871/3301.webp'), /max-age=31536000, immutable/);
});

test('other site-map files revalidate, GLB keeps a week, the rest an hour', () => {
  assert.match(cacheControlFor('/srv/storage/schools/s1/kmz_2d_content/doc.kml'), /stale-while-revalidate=604800/);
  assert.match(cacheControlFor('/srv/storage/schools/s1/3d/model.glb'), /max-age=604800/);
  assert.strictEqual(cacheControlFor('/srv/storage/schools/s1/reports/a.jpg'), 'public, max-age=3600');
  assert.match(cacheControlFor('C:\\storage\\schools\\s1\\kmz_2d_content\\_pyramid\\b\\0\\0\\0.webp'), /immutable/);
});
