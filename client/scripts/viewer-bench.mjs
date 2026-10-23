#!/usr/bin/env node
/**
 * 3D viewer quality & performance harness (Phase 0 of
 * docs/3D_QUALITY_IMPLEMENTATION_PLAN.md).
 *
 * Opens a school's 3D view against a running dev stack, waits for the model,
 * then records: time to ready, bytes downloaded, screenshots from six fixed
 * bookmarks (overview, roof close-up, facade, near detail, courtyard, site
 * edge), frame rate during a scripted orbit, and GPU texture memory.
 *
 *   node scripts/viewer-bench.mjs --school <id> [--out dir] [--mobile]
 *        [--base http://localhost:5173] [--email ..] [--password ..]
 *
 * Needs Playwright (`npx playwright install chromium` once). Uses the
 * `window.__rtbViewer` hook (dev builds; see src/lib/viewer3d/viewer-debug.ts).
 * Headless Chrome may render WebGL on the CPU: compare runs from the same
 * machine and mode, not absolute frame rates across machines.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true']);
    return acc;
  }, []),
);
const school = args.school;
if (!school) {
  console.error('usage: viewer-bench.mjs --school <id> [--out dir] [--mobile]');
  process.exit(2);
}
const base = args.base || 'http://localhost:5173';
const mobile = args.mobile === 'true';
const out = path.resolve(args.out || `viewer-bench-${school.slice(0, 8)}-${mobile ? 'phone' : 'desktop'}`);
fs.mkdirSync(out, { recursive: true });

const require = createRequire(import.meta.url);
let playwright;
for (const p of ['playwright', '/opt/homebrew/lib/node_modules/playwright', '/usr/local/lib/node_modules/playwright']) {
  try {
    playwright = require(p);
    break;
  } catch {
    /* try next */
  }
}
if (!playwright) {
  console.error('Playwright not found: npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}

const browser = await playwright.chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=default'] });
const ctx = await browser.newContext(
  mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } },
);
await ctx.addInitScript(() => {
  try {
    localStorage.setItem('rtb-viewer-debug', '1');
    const g = Storage.prototype.getItem;
    Storage.prototype.getItem = function (k) {
      return String(k).startsWith('rtb-tour-done') ? '1' : g.call(this, k);
    };
  } catch {
    /* ignore */
  }
});
const page = await ctx.newPage();

await page.goto(`${base}/login`);
await page.fill('input[type="email"]', args.email || 'admin@rtb.gov.rw');
await page.fill('input[type="password"]', args.password || 'Admin@123');
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith('/login'));

// Throttle only the 3D page (logging in through the dev server's unbundled
// modules at phone speed would time out and is not what we measure).
if (mobile) {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 60, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (3 * 1024 * 1024) / 8 });
}

let bytes = 0;
page.on('requestfinished', async (r) => {
  if (!/\.(glb|b3dm|ktx2|json)(\?|$)|\/3d\/|\/tiles\//.test(r.url())) return;
  try {
    bytes += (await r.sizes()).responseBodySize;
  } catch {
    /* ignore */
  }
});
const t0 = Date.now();
await page.goto(`${base}/schools/${school}/3d-explorer`);
await page.waitForFunction(() => window.__rtbViewer?.ready, null, { timeout: 180_000 });
const readyMs = Date.now() - t0;
await page.waitForTimeout(1500);

const bounds = await page.evaluate(() => window.__rtbViewer.bounds());
const [minX, minY, minZ] = bounds.min;
const [maxX, maxY, maxZ] = bounds.max;
const c = [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2];
const s = [maxX - minX, maxY - minY, maxZ - minZ];
const add = (a, b) => a.map((v, i) => v + b[i]);
const views = {
  overview: { target: c, position: add(c, [s[0] * 0.55, Math.max(s[0], s[2]) * 0.6, s[2] * 0.75]) },
  'roof-close': { target: [c[0], maxY - s[1] * 0.25, c[2]], position: add([c[0], maxY - s[1] * 0.25, c[2]], [6, 8, 6]) },
  facade: { target: [c[0] + s[0] * 0.2, minY + Math.min(4, s[1] / 3), c[2]], position: add([c[0] + s[0] * 0.2, minY + Math.min(4, s[1] / 3), c[2]], [0, 2, 12]) },
  'near-detail': { target: [c[0] - s[0] * 0.15, minY + 2, c[2] + s[2] * 0.15], position: add([c[0] - s[0] * 0.15, minY + 2, c[2] + s[2] * 0.15], [3, 2, 5]) },
  courtyard: { target: [c[0], minY + 1, c[2]], position: add([c[0], minY + 1, c[2]], [0, 25, 15]) },
  edge: { target: [maxX - s[0] * 0.08, minY + 2, maxZ - s[2] * 0.08], position: add([maxX - s[0] * 0.08, minY + 2, maxZ - s[2] * 0.08], [15, 12, 15]) },
};
for (const [name, v] of Object.entries(views)) {
  await page.evaluate((view) => window.__rtbViewer.setView(view), v);
  await page.waitForTimeout(1500); // let tiles / mipmaps settle
  await page.screenshot({ path: path.join(out, `${name}.png`) });
}

// Frame rate during a 4 s orbit around the overview point.
const fps = await page.evaluate(async ({ c, r, h }) => {
  const v = window.__rtbViewer;
  const f0 = v.frames();
  const start = performance.now();
  await new Promise((done) => {
    const step = (now) => {
      const t = (now - start) / 4000;
      if (t >= 1) return done();
      const a = t * Math.PI * 2;
      v.setView({ target: c, position: [c[0] + Math.cos(a) * r, c[1] + h, c[2] + Math.sin(a) * r] });
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  return (v.frames() - f0) / ((performance.now() - start) / 1000);
}, { c, r: Math.max(s[0], s[2]) * 0.7, h: Math.max(s[0], s[2]) * 0.5 });

const info = await page.evaluate(() => window.__rtbViewer.info());
const result = {
  school,
  mode: mobile ? 'phone (4x CPU, 9 Mbit/s)' : 'desktop',
  readyMs,
  downloadedMB: +(bytes / 1048576).toFixed(1),
  fps: +fps.toFixed(1),
  gpuTextureMB: +(info.textureBytes / 1048576).toFixed(1),
  textures: info.textures,
  geometries: info.geometries,
  sizeMetres: s.map((v) => +v.toFixed(1)),
  screenshots: Object.keys(views).map((n) => `${n}.png`),
  at: new Date().toISOString(),
};
fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
await browser.close();
