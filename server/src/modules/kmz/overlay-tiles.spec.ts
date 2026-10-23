import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import sharp from 'sharp';
import { buildSiteTiles, deepestZoom, zoomResolution } from './overlay-tiles';

const R = 6378137;
const WORLD = 2 * Math.PI * R;
const LAT = -1.9626;
const LNG = 30.5533;
/** Degrees of longitude / latitude for `m` metres east / north at the site. */
const dLng = (m: number) =>
  (m / (R * Math.cos((LAT * Math.PI) / 180))) * (180 / Math.PI);
const dLat = (m: number) => (m / R) * (180 / Math.PI);

const solid = (size: number, rgb: [number, number, number]) =>
  sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: { r: rgb[0], g: rgb[1], b: rgb[2] },
    },
  })
    .png()
    .toBuffer();

/** A photo covering [w, s, e, n] metres from the site origin. */
const photo = async (
  w: number,
  s: number,
  e: number,
  n: number,
  size: number,
  rgb: [number, number, number],
) => {
  const buf = await solid(size, rgb);
  return {
    west: LNG + dLng(w),
    east: LNG + dLng(e),
    south: LAT + dLat(s),
    north: LAT + dLat(n),
    load: async () => buf,
  };
};

/** Pixel of the deepest tile at a lat/lng: [r, g, b, a]. */
async function pixelAt(dir: string, z: number, lat: number, lng: number) {
  const x = (R * lng * Math.PI) / 180;
  const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  const gx = (x + WORLD / 2) / zoomResolution(z);
  const gy = (WORLD / 2 - y) / zoomResolution(z);
  const tx = Math.floor(gx / 256);
  const ty = Math.floor(gy / 256);
  const f = path.join(dir, String(z), String(tx), `${ty}.webp`);
  if (!fs.existsSync(f)) return null;
  const { data } = await sharp(f)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const i = (Math.floor(gy - ty * 256) * 256 + Math.floor(gx - tx * 256)) * 4;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
}

describe('site tiles (overlay-tiles.ts)', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'site-tiles-'));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('picks the deepest zoom from the finest photo', () => {
    // 0.74 cm photos (Nyamirama) → z24 (0.93 cm); 1.9 cm → z23 (1.87 cm).
    // Nyamirama 0.74 cm photos → zoom 25 (0.47 cm), keeping all their detail.
    expect(deepestZoom(0.0074)).toBe(25);
    // Nyanza 1.9 cm, Fr Ramon 2.2 cm → zoom 23 (1.87 cm), as before.
    expect(deepestZoom(0.019)).toBe(23);
    expect(deepestZoom(0.022)).toBe(23);
    // Photos only a sliver finer than a level (0.92 vs 0.93 cm) don't get 4× the tiles.
    expect(deepestZoom(0.0092)).toBe(24);
    expect(deepestZoom(0.5)).toBe(19); // 0.5 m holds ~19% more than zoom 18 (0.6 m)
    expect(deepestZoom(0.0001)).toBe(25); // the map's own limit
  });

  it('places photos where they belong, with no gap where two meet', async () => {
    // Two 10 m photos side by side at ~3.9 cm/px: red west, blue east.
    const overlays = [
      await photo(0, 0, 10, 10, 256, [220, 30, 30]),
      await photo(10, 0, 20, 10, 256, [30, 30, 220]),
    ];
    const r = (await buildSiteTiles(overlays, { outDir: dir, minZoom: 20 }))!;
    expect(r.maxZoom).toBe(22);
    expect(r.photos).toBe(2);
    expect(r.sourceCmPerPx).toBeCloseTo(3.91, 1);
    const red = await pixelAt(dir, 22, LAT + dLat(5), LNG + dLng(3));
    const blue = await pixelAt(dir, 22, LAT + dLat(5), LNG + dLng(17));
    expect(red?.[0]).toBeGreaterThan(180);
    expect(blue?.[2]).toBeGreaterThan(180);
    // Along the shared edge, every pixel is covered (no transparent seam).
    for (const dm of [-0.06, -0.03, 0, 0.03, 0.06]) {
      const p = await pixelAt(dir, 22, LAT + dLat(5), LNG + dLng(10 + dm));
      expect(p?.[3]).toBe(255);
    }
    // Every level from minZoom to maxZoom was written.
    for (let z = 20; z <= 22; z++)
      expect(fs.existsSync(path.join(dir, String(z)))).toBe(true);
  });

  it('covers holes in the fine photos at the level the coarse photo suits, not deeper', async () => {
    const overlays = [
      // Coarse green photo over 40 m (15.6 cm/px), finer red one over the west half only.
      await photo(0, 0, 40, 40, 256, [30, 200, 30]),
      await photo(0, 0, 20, 20, 512, [220, 30, 30]),
    ];
    const r = (await buildSiteTiles(overlays, { outDir: dir, minZoom: 19 }))!;
    expect(r.maxZoom).toBe(22);
    // Deepest level: the fine photo, and no tile that only enlarges the coarse one.
    expect(
      (await pixelAt(dir, 22, LAT + dLat(10), LNG + dLng(10)))?.[0],
    ).toBeGreaterThan(180);
    expect(await pixelAt(dir, 22, LAT + dLat(30), LNG + dLng(30))).toBeNull();
    // Zoom 20 (14.9 cm/px) suits the coarse photo: the hole is filled there,
    // and the fine area still shows the fine photo (halved from below).
    const hole = await pixelAt(dir, 20, LAT + dLat(30), LNG + dLng(30));
    expect(hole?.[1]).toBeGreaterThan(150);
    expect(hole?.[3]).toBe(255);
    expect(
      (await pixelAt(dir, 20, LAT + dLat(10), LNG + dLng(10)))?.[0],
    ).toBeGreaterThan(180);
  });

  it('crops a very coarse fill photo per tile instead of resizing it whole', async () => {
    // A 600 m coarse photo under one 4 m fine photo: resized whole at the
    // deepest zoom it would be ~38,000 px square.
    const overlays = [
      await photo(-300, -300, 300, 300, 256, [30, 200, 30]),
      await photo(0, 0, 4, 4, 512, [220, 30, 30]),
    ];
    const t = Date.now();
    const r = (await buildSiteTiles(overlays, { outDir: dir, minZoom: 24 }))!;
    expect(r.maxZoom).toBe(25); // 0.78 cm photo
    expect(await pixelAt(dir, 25, LAT + dLat(2), LNG + dLng(2))).toEqual(
      expect.arrayContaining([255]),
    );
    expect(Date.now() - t).toBeLessThan(120_000);
  }, 180_000);

  it('reports progress over the deepest level', async () => {
    const seen: Array<[number, number]> = [];
    await buildSiteTiles([await photo(0, 0, 10, 10, 256, [220, 30, 30])], {
      outDir: dir,
      minZoom: 21,
      onProgress: (d, t) => seen.push([d, t]),
    });
    expect(seen.length).toBeGreaterThan(0);
    const [d, t] = seen[seen.length - 1];
    expect(d).toBe(t);
  });
});
