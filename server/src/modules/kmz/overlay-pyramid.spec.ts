import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import sharp from 'sharp';
import { buildOverlayPyramid } from './overlay-pyramid';

/** A solid-colour JPEG of the given size. */
const photo = (w: number, h: number, rgb: [number, number, number]) =>
  sharp({
    create: {
      width: w,
      height: h,
      channels: 3,
      background: { r: rgb[0], g: rgb[1], b: rgb[2] },
    },
  })
    .jpeg()
    .toBuffer();

describe('buildOverlayPyramid', () => {
  let out: string;
  beforeEach(() => {
    out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pyr-')), 'p');
  });

  it('builds one pyramid from a 2-level super-overlay, finest level on top, coarse level skipped', async () => {
    const box = { north: -1.93, south: -1.94, east: 30.11, west: 30.1 };
    const red = await photo(256, 256, [255, 0, 0]); // coarse, whole area
    const blue = await photo(512, 512, [0, 0, 255]); // fine quadrants
    const mid = {
      lat: (box.north + box.south) / 2,
      lng: (box.east + box.west) / 2,
    };
    const quads = [
      { north: box.north, south: mid.lat, west: box.west, east: mid.lng },
      { north: box.north, south: mid.lat, west: mid.lng, east: box.east },
      { north: mid.lat, south: box.south, west: box.west, east: mid.lng },
      { north: mid.lat, south: box.south, west: mid.lng, east: box.east },
    ];
    const loads: string[] = [];
    const p = await buildOverlayPyramid(
      [
        { ...box, drawOrder: 0, load: async () => (loads.push('coarse'), red) },
        ...quads.map((q, i) => ({
          ...q,
          drawOrder: 1,
          load: async () => (loads.push(`fine${i}`), blue),
        })),
      ],
      { outDir: out },
    );
    expect(p).not.toBeNull();
    expect(p!.used).toBe(4); // the coarse photo is fully covered by finer ones
    expect(p!.total).toBe(5);
    expect(p!.width).toBe(1024);
    expect(p!.maxZoom).toBe(
      Math.ceil(Math.log2(Math.max(p!.width, p!.height) / 256)),
    );
    expect(fs.existsSync(path.join(out, String(p!.maxZoom)))).toBe(true);
    expect(p!.tiles).toBeGreaterThan(5);
    // z/y/x layout, WebP, finest colour visible
    const tile = path.join(out, String(p!.maxZoom), '1', '1.webp');
    expect(fs.existsSync(tile)).toBe(true);
    const { data } = await sharp(tile)
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(data[2]).toBeGreaterThan(200); // blue
    expect(data[0]).toBeLessThan(40);
  });

  it('keeps a coarse photo where finer ones leave gaps, and caps the size', async () => {
    const box = { north: -1.93, south: -1.94, east: 30.11, west: 30.1 };
    const p = await buildOverlayPyramid(
      [
        { ...box, load: async () => photo(256, 256, [255, 0, 0]) },
        {
          north: -1.93,
          south: -1.935,
          west: 30.1,
          east: 30.105,
          load: async () => photo(2048, 2048, [0, 0, 255]),
        },
      ],
      { outDir: out, maxPx: 1024 },
    );
    expect(p!.used).toBe(2);
    expect(Math.max(p!.width, p!.height)).toBeLessThanOrEqual(1024);
  });

  it('returns null when nothing is usable', async () => {
    expect(
      await buildOverlayPyramid(
        [{ north: 0, south: 0, east: 0, west: 0, load: async () => null }],
        { outDir: out },
      ),
    ).toBeNull();
  });
});

describe('buildOverlayPyramid seams', () => {
  it('leaves no transparent rows or columns between neighbouring photos', async () => {
    const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pyr-')), 'p');
    const n = 8;
    const N = -1.9473,
      S = -1.9527,
      W = 30.0573,
      E = 30.0627;
    const tile = await photo(97, 97, [0, 160, 0]); // odd size → fractional placement
    const overlays = [] as Parameters<typeof buildOverlayPyramid>[0];
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        overlays.push({
          north: N - ((N - S) * i) / n,
          south: N - ((N - S) * (i + 1)) / n,
          west: W + ((E - W) * j) / n,
          east: W + ((E - W) * (j + 1)) / n,
          load: async () => tile,
        });
    // A size cap forces a fractional scale, where seams used to appear.
    const p = await buildOverlayPyramid(overlays, { outDir: out, maxPx: 700 });
    // Re-assemble the deepest level's covered area and look for any see-through pixel.
    const z = String(p!.maxZoom);
    let holes = 0;
    for (const row of fs.readdirSync(path.join(out, z))) {
      for (const f of fs.readdirSync(path.join(out, z, row))) {
        const { data, info } = await sharp(path.join(out, z, row, f))
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        const x0 = Number(f.split('.')[0]) * 256;
        const y0 = Number(row) * 256;
        for (let y = 0; y < info.height; y++)
          for (let x = 0; x < info.width; x++) {
            if (x0 + x >= p!.width - 1 || y0 + y >= p!.height - 1) continue; // outside the canvas
            if (data[(y * info.width + x) * 4 + 3] < 200) holes++;
          }
      }
    }
    expect(holes).toBe(0);
  }, 30_000);
});

describe('buildOverlayPyramid at drone-export scale', () => {
  it('handles a 5-level super-overlay (341 photos) quickly, using only the finest level', async () => {
    const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pyr-')), 'p');
    const N = -1.9473,
      S = -1.9527,
      W = 30.0573,
      E = 30.0627;
    const img = await photo(64, 64, [90, 120, 60]);
    const overlays = [] as Parameters<typeof buildOverlayPyramid>[0];
    let loads = 0;
    for (const n of [1, 2, 4, 8, 16])
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++)
          overlays.push({
            north: N - ((N - S) * i) / n,
            south: N - ((N - S) * (i + 1)) / n,
            west: W + ((E - W) * j) / n,
            east: W + ((E - W) * (j + 1)) / n,
            drawOrder: n,
            load: async () => (loads++, img),
          });
    const started = Date.now();
    const p = await buildOverlayPyramid(overlays, { outDir: out });
    expect(overlays.length).toBe(341);
    expect(p!.used).toBe(256); // only the finest level
    expect(loads).toBe(341 + 256); // measured once, finest read again
    expect(Date.now() - started).toBeLessThan(20_000);
  }, 30_000);
});
