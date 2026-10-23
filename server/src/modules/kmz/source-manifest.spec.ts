import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createHash } from 'crypto';
import { hashFile, sourceManifest } from './kmz.service';

describe('sourceManifest', () => {
  it('records size, hash and the delivered detail', () => {
    const m = sourceManifest('site.glb', 19, 'abc', {
      precompressed: true,
      score: 'low',
    });
    expect(m.fileName).toBe('site.glb');
    expect(m.bytes).toBe(19);
    expect(m.sha256).toBe('abc');
    expect(m.precompressed).toBe(true);
    expect(m.quality).toEqual({ precompressed: true, score: 'low' });
    expect(Number.isNaN(Date.parse(m.keptAt))).toBe(false);
  });

  it('leaves precompressed unknown when not measured', () => {
    expect(sourceManifest('a.glb', 4, 'x', null).precompressed).toBeNull();
  });

  it('hashes a file by streaming it', async () => {
    const file = path.join(os.tmpdir(), `manifest-${Date.now()}.bin`);
    const bytes = Buffer.from('glTF original bytes');
    fs.writeFileSync(file, bytes);
    try {
      expect(await hashFile(file)).toBe(
        createHash('sha256').update(bytes).digest('hex'),
      );
    } finally {
      fs.rmSync(file, { force: true });
    }
  });
});
