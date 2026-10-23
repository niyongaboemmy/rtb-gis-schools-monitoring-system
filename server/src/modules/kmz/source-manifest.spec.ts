import { createHash } from 'crypto';
import { sourceManifest } from './kmz.service';

describe('sourceManifest', () => {
  it('records size, hash and the delivered detail', () => {
    const bytes = Buffer.from('glTF original bytes');
    const m = sourceManifest('site.glb', bytes, {
      precompressed: true,
      score: 'low',
    });
    expect(m.fileName).toBe('site.glb');
    expect(m.bytes).toBe(bytes.byteLength);
    expect(m.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
    expect(m.precompressed).toBe(true);
    expect(m.quality).toEqual({ precompressed: true, score: 'low' });
    expect(Number.isNaN(Date.parse(m.keptAt))).toBe(false);
  });

  it('leaves precompressed unknown when not measured', () => {
    expect(
      sourceManifest('a.glb', Buffer.alloc(4), null).precompressed,
    ).toBeNull();
  });
});
