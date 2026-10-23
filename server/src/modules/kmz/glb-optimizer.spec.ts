import { createStageParser, optimizeProfile } from './glb-optimizer';

describe('optimizeProfile', () => {
  const GB = 1024 ** 3;

  it('a normal upload keeps 30% of triangles and up to 8192 px textures', () => {
    const p = optimizeProfile({
      heapMb: 5734,
      inputBytes: 0.5 * GB,
      totalMem: 8 * GB,
    });
    expect(p).toMatchObject({
      lowMem: false,
      ratio: 0.3,
      textureSize: 8192,
      env: {},
    });
  });

  it('a large upload on the 8 GB box limits geometry but never shrinks textures', () => {
    const p = optimizeProfile({
      heapMb: 5734,
      inputBytes: 1.5 * GB,
      totalMem: 8 * GB,
    });
    expect(p.lowMem).toBe(true);
    expect(p.textureSize).toBe(8192);
    expect(p.env).toEqual({
      GLB_FORCE_SLOPPY: '1',
      GLB_MAX_OUT_TRIS: '1500000',
      // Staircase repair only for files that fit (Nyanza's 40 M vertices skip it).
      GLB_DESTEP_MAX_VERTS: '25000000',
    });
    // No lower texture quality is forced either.
    expect(p.env).not.toHaveProperty('GLB_TEXTURE_QUALITY');
  });

  it('respects explicit options and env overrides', () => {
    const p = optimizeProfile({
      heapMb: 2048,
      inputBytes: 0,
      totalMem: 8 * GB,
      ratio: 0.2,
      textureSize: 4096,
      env: { GLB_MAX_OUT_TRIS: '3000000' },
    });
    expect(p).toMatchObject({ lowMem: true, ratio: 0.2, textureSize: 4096 });
    expect(p.env.GLB_MAX_OUT_TRIS).toBe('3000000');
  });
});

describe('createStageParser', () => {
  it('passes progress markers on and keeps other stderr text', () => {
    const stages: string[] = [];
    const parse = createStageParser((s) => stages.push(s));
    let rest = parse('@@progress reading\nreprojection skipped: x\n@@pro');
    rest += parse('gress simplifying\nexact simplify failed\n');
    expect(stages).toEqual(['reading', 'simplifying']);
    expect(rest).toBe('reprojection skipped: x\nexact simplify failed\n');
  });
});
