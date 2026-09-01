import {
  isPlausibleLatLng,
  pickKmlCoordinate,
  ecefToLatLng,
  deriveCoordinateFromGlb,
} from './geo-derive';

/** WGS84 geodetic (deg) -> ECEF metres. Inverse of `ecefToLatLng`, for fixtures. */
function latLngToEcef(lat: number, lng: number, h = 0) {
  const a = 6378137.0;
  const f = 1 / 298.257223563;
  const e2 = f * (2 - f);
  const la = (lat * Math.PI) / 180;
  const lo = (lng * Math.PI) / 180;
  const N = a / Math.sqrt(1 - e2 * Math.sin(la) ** 2);
  return [
    (N + h) * Math.cos(la) * Math.cos(lo),
    (N + h) * Math.cos(la) * Math.sin(lo),
    (N * (1 - e2) + h) * Math.sin(la),
  ];
}

/** Assemble a minimal but valid GLB from a glTF JSON object. */
function makeGlb(gltf: Record<string, unknown>, binBytes = 4): Buffer {
  if (!gltf.asset) gltf.asset = { version: '2.0' };
  let json = Buffer.from(JSON.stringify(gltf), 'utf8');
  if (json.length % 4) {
    json = Buffer.concat([json, Buffer.alloc(4 - (json.length % 4), 0x20)]);
  }
  const bin = Buffer.alloc(Math.ceil(binBytes / 4) * 4, 0);
  const total = 12 + 8 + json.length + 8 + bin.length;
  const head = Buffer.alloc(12);
  head.writeUInt32LE(0x46546c67, 0); // "glTF"
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(total, 8);
  const jsonHead = Buffer.alloc(8);
  jsonHead.writeUInt32LE(json.length, 0);
  jsonHead.writeUInt32LE(0x4e4f534a, 4); // "JSON"
  const binHead = Buffer.alloc(8);
  binHead.writeUInt32LE(bin.length, 0);
  binHead.writeUInt32LE(0x004e4942, 4); // "BIN\0"
  return Buffer.concat([head, jsonHead, json, binHead, bin]);
}

/** GLB whose single POSITION accessor carries the given min/max. */
function glbWithPositionBounds(
  min: number[],
  max: number[],
  extra: Record<string, unknown> = {},
) {
  return makeGlb({
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [{ type: 'VEC3', componentType: 5126, count: 3, min, max }],
    ...extra,
  });
}

describe('isPlausibleLatLng', () => {
  it('accepts a normal Rwanda coordinate', () => {
    expect(isPlausibleLatLng(-1.95, 30.06)).toBe(true);
  });
  it('rejects out-of-range, non-finite and null-island', () => {
    expect(isPlausibleLatLng(95, 30)).toBe(false);
    expect(isPlausibleLatLng(-1.95, 200)).toBe(false);
    expect(isPlausibleLatLng(NaN, 30)).toBe(false);
    expect(isPlausibleLatLng('x', 30)).toBe(false);
    expect(isPlausibleLatLng(0, 0)).toBe(false);
  });
});

describe('pickKmlCoordinate', () => {
  it('prefers the authored view over overlay bounds and points', () => {
    const c = pickKmlCoordinate({
      initialView: { latitude: -1.5, longitude: 29.5 },
      groundOverlays: [{ north: -1, south: -2, east: 30, west: 29 }],
      points: [[31, -3]],
    });
    expect(c).toEqual({ lat: -1.5, lng: 29.5, source: 'kml:view' });
  });
  it('falls back to overlay-bounds centre', () => {
    const c = pickKmlCoordinate({
      groundOverlays: [{ north: -1, south: -3, east: 31, west: 29 }],
    });
    expect(c?.source).toBe('kml:overlay-bounds');
    expect(c?.lat).toBeCloseTo(-2, 6);
    expect(c?.lng).toBeCloseTo(30, 6);
  });
  it('falls back to point centroid', () => {
    const c = pickKmlCoordinate({
      points: [
        [30, -2],
        [32, -4],
      ],
    });
    expect(c?.source).toBe('kml:centroid');
    expect(c?.lat).toBeCloseTo(-3, 6);
    expect(c?.lng).toBeCloseTo(31, 6);
  });
  it('returns null when nothing is usable', () => {
    expect(pickKmlCoordinate({ points: [[0, 0]] })).toBeNull();
    expect(pickKmlCoordinate({})).toBeNull();
  });
});

describe('ecefToLatLng', () => {
  it('round-trips a known coordinate', () => {
    const [x, y, z] = latLngToEcef(-1.9626354, 30.5533304, 1550);
    const g = ecefToLatLng(x, y, z)!;
    expect(g.lat).toBeCloseTo(-1.9626354, 5);
    expect(g.lng).toBeCloseTo(30.5533304, 5);
  });
  it('returns null at the polar axis', () => {
    expect(ecefToLatLng(0, 0, 6356752)).toBeNull();
  });
});

describe('deriveCoordinateFromGlb', () => {
  it('reads a CESIUM_RTC ECEF centre', () => {
    const center = latLngToEcef(-1.95, 30.06, 1500);
    const c = deriveCoordinateFromGlb(
      makeGlb({ extensions: { CESIUM_RTC: { center } } }),
    );
    expect(c?.source).toBe('glb:cesium-rtc');
    expect(c?.lat).toBeCloseTo(-1.95, 4);
    expect(c?.lng).toBeCloseTo(30.06, 4);
  });

  it('reads an ECEF root-node translation', () => {
    const t = latLngToEcef(-2.6, 29.74, 1700);
    const c = deriveCoordinateFromGlb(makeGlb({ nodes: [{ translation: t }] }));
    expect(c?.source).toBe('glb:node-translation');
    expect(c?.lat).toBeCloseTo(-2.6, 4);
    expect(c?.lng).toBeCloseTo(29.74, 4);
  });

  it('derives the centroid from geographic POSITION bounds (Metashape export)', () => {
    const c = deriveCoordinateFromGlb(
      glbWithPositionBounds(
        [30.55230712890625, -1.963919758796692, 1512.37988],
        [30.554353713989258, -1.9613510370254517, 1596.05017],
      ),
    );
    expect(c?.source).toBe('glb:geo-vertices');
    expect(c?.lng).toBeCloseTo(30.5533304, 6);
    expect(c?.lat).toBeCloseTo(-1.9626354, 6);
  });

  it('ignores a metric (local-frame) POSITION accessor', () => {
    expect(
      deriveCoordinateFromGlb(
        glbWithPositionBounds([-113.8, 0, -142], [113.8, 83.1, 142]),
      ),
    ).toBeNull();
  });

  it('ignores geometry sitting at the scene origin (no geo-reference)', () => {
    expect(
      deriveCoordinateFromGlb(
        glbWithPositionBounds([-0.4, -0.3, 0], [0.4, 0.3, 12]),
      ),
    ).toBeNull();
  });

  it('ignores POSITION spans wider than a degree (not a single site)', () => {
    expect(
      deriveCoordinateFromGlb(
        glbWithPositionBounds([28, -3, 1400], [31, -1, 1800]),
      ),
    ).toBeNull();
  });

  it('returns null for a non-GLB buffer', () => {
    expect(deriveCoordinateFromGlb(Buffer.from('not a glb at all'))).toBeNull();
  });

  it('returns null when the POSITION accessor has no min/max', () => {
    expect(
      deriveCoordinateFromGlb(
        makeGlb({
          nodes: [{ mesh: 0 }],
          meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
          accessors: [{ type: 'VEC3', componentType: 5126, count: 3 }],
        }),
      ),
    ).toBeNull();
  });

  it('returns null for a truncated JSON chunk', () => {
    const good = glbWithPositionBounds(
      [30.5523, -1.9639, 1512],
      [30.5543, -1.9613, 1596],
    );
    expect(deriveCoordinateFromGlb(good.subarray(0, 40))).toBeNull();
  });

  it('prefers CESIUM_RTC over geographic POSITION when both are present', () => {
    const center = latLngToEcef(-1.5, 29.9, 1500);
    const c = deriveCoordinateFromGlb(
      glbWithPositionBounds(
        [30.5523, -1.9639, 1512],
        [30.5543, -1.9613, 1596],
        { extensions: { CESIUM_RTC: { center } } },
      ),
    );
    expect(c?.source).toBe('glb:cesium-rtc');
  });
});
