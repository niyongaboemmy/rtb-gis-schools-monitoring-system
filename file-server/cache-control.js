/**
 * Cache-Control for files served under /files.
 *
 * Site-map tile pyramids and full-detail tiles live in a folder unique to each
 * build (`_pyramid/<build id>/`, `_tiles/<build id>/`), so they never change:
 * cache them for a year.
 * Other site-map files keep their paths across re-uploads, so they stay
 * short-lived but may be served stale while revalidating (ETag → 304).
 */
function cacheControlFor(filePath) {
  const p = String(filePath).split('\\').join('/');
  if (p.includes('/_pyramid/') || p.includes('/_tiles/')) return 'public, max-age=31536000, immutable';
  if (p.endsWith('.glb')) return 'public, max-age=604800, stale-while-revalidate=86400';
  if (p.includes('/kmz_2d_content/')) return 'public, max-age=3600, stale-while-revalidate=604800';
  return 'public, max-age=3600';
}

module.exports = { cacheControlFor };
