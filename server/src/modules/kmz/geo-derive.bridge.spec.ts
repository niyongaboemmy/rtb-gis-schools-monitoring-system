import {
  compareModelScale,
  collectGeoJsonPositions,
  deriveGlbGeoInfo,
  enuToWgs84,
  lonLatExtentMeters,
  modelToWgs84,
  wgs84ToEnu,
  wgs84ToModel,
} from './geo-derive';

const ORIGIN = { lat: -1.9626354, lng: 30.5533304, alt: 1450 };

function makeGlb(gltf: Record<string, unknown>): Buffer {
  gltf.asset = { version: '2.0' };
  let json = Buffer.from(JSON.stringify(gltf), 'utf8');
  if (json.length % 4)
    json = Buffer.concat([json, Buffer.alloc(4 - (json.length % 4), 0x20)]);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + json.length, 8);
  header.writeUInt32LE(json.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  return Buffer.concat([header, json]);
}

const glbWithBounds = (
  min: number[],
  max: number[],
  nodes: unknown[] = [{ mesh: 0 }],
) =>
  makeGlb({
    accessors: [{ componentType: 5126, count: 3, type: 'VEC3', min, max }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    nodes,
  });

describe('geo bridge twin (WS5.3)', () => {
  it('round-trips model ↔ WGS84 to < 1 cm at 1 km', () => {
    for (const p of [
      { x: 1000, y: 0, z: 0 },
      { x: 0, y: 30, z: -1000 },
      { x: -707, y: -12, z: 707 },
    ]) {
      const back = wgs84ToModel(modelToWgs84(p, ORIGIN), ORIGIN);
      expect(Math.hypot(back.x - p.x, back.y - p.y, back.z - p.z)).toBeLessThan(
        0.01,
      );
    }
  });

  it('uses East=+X, Up=+Y, North=−Z', () => {
    const n = modelToWgs84({ x: 0, y: 0, z: -50 }, ORIGIN);
    expect(n.lat).toBeGreaterThan(ORIGIN.lat);
    const enu = wgs84ToEnu(enuToWgs84({ e: 10, n: 20, u: 3 }, ORIGIN), ORIGIN);
    expect(enu.e).toBeCloseTo(10, 6);
    expect(enu.n).toBeCloseTo(20, 6);
    expect(enu.u).toBeCloseTo(3, 6);
  });
});

describe('deriveGlbGeoInfo', () => {
  it('reads origin + metric extent from a geographic GLB', () => {
    const info = deriveGlbGeoInfo(
      glbWithBounds([30.552, -1.964, 1440], [30.554, -1.962, 1520]),
    );
    expect(info?.geographic).toBe(true);
    expect(info?.origin?.lat).toBeCloseTo(-1.963, 9);
    expect(info?.origin?.lng).toBeCloseTo(30.553, 9);
    expect(info?.origin?.alt).toBe(1440);
    // 0.002° ≈ 222 m at the equator
    expect(info!.extentEastM).toBeGreaterThan(220);
    expect(info!.extentEastM).toBeLessThan(224);
    expect(info!.extentNorthM).toBeGreaterThan(219);
    expect(info!.extentNorthM).toBeLessThan(223);
  });

  it('reads X×Z extent from a local-metres GLB', () => {
    const info = deriveGlbGeoInfo(
      glbWithBounds([-114, 0, -142], [114, 84, 142]),
    );
    expect(info).toEqual({
      geographic: false,
      origin: null,
      extentEastM: 228,
      extentNorthM: 284,
    });
  });

  it('refuses when a node is scaled (bounds would lie)', () => {
    expect(
      deriveGlbGeoInfo(
        glbWithBounds(
          [-1, 0, -1],
          [1, 1, 1],
          [{ mesh: 0, scale: [100, 100, 100] }],
        ),
      ),
    ).toBeNull();
  });
});

describe('compareModelScale (WS6.4)', () => {
  const fp = { extentEastM: 200, extentNorthM: 300 };

  it('accepts a model within 2 %', () => {
    const r = compareModelScale({ extentEastM: 202, extentNorthM: 297 }, fp)!;
    expect(r.scaleFactor).toBe(1);
    expect(r.warning).toBeNull();
  });

  it('detects a uniform 5 % scale error and returns the correction', () => {
    const r = compareModelScale({ extentEastM: 210, extentNorthM: 315 }, fp)!;
    expect(r.ratioEast).toBeCloseTo(1.05, 6);
    expect(r.scaleFactor).toBeCloseTo(1 / 1.05, 5);
    expect(r.warning).toMatch(/5\.0% larger/);
  });

  it('detects a feet-vs-metres export', () => {
    const r = compareModelScale(
      { extentEastM: 656.17, extentNorthM: 984.25 },
      fp,
    )!;
    expect(r.scaleFactor).toBeCloseTo(0.3048, 3);
  });

  it('warns without correcting when the axes disagree (coverage mismatch)', () => {
    const r = compareModelScale({ extentEastM: 260, extentNorthM: 300 }, fp)!;
    expect(r.scaleFactor).toBeNull();
    expect(r.warning).toMatch(/could not be verified/);
  });

  it('returns null on bad input', () => {
    expect(
      compareModelScale({ extentEastM: 0, extentNorthM: 1 }, fp),
    ).toBeNull();
  });
});

describe('footprint extent helpers', () => {
  it('collects positions from nested GeoJSON and measures the extent', () => {
    const fc = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [30.552, -1.964],
                [30.554, -1.964],
                [30.554, -1.962],
                [30.552, -1.964],
              ],
            ],
          },
        },
      ],
    };
    const pos = collectGeoJsonPositions(fc);
    expect(pos).toHaveLength(4);
    const ext = lonLatExtentMeters(pos as [number, number][])!;
    expect(ext.extentEastM).toBeGreaterThan(220);
    expect(ext.extentEastM).toBeLessThan(224);
  });
});
