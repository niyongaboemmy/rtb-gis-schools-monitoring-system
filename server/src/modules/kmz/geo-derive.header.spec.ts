import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { deriveGlbGeoInfo, readGlbHeaderBytes } from './geo-derive';

/** A GLB whose POSITION accessor carries geographic bounds, plus a big binary chunk. */
function glbFile(binBytes: number): string {
  const json = Buffer.from(
    JSON.stringify({
      asset: { version: '2.0' },
      meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
      accessors: [
        {
          componentType: 5126,
          type: 'VEC3',
          count: 3,
          min: [29.7, -1.95, 1500],
          max: [29.702, -1.948, 1530],
        },
      ],
    }).padEnd(260, ' '),
  );
  const head = Buffer.alloc(20);
  head.writeUInt32LE(0x46546c67, 0);
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(20 + json.length + 8 + binBytes, 8);
  head.writeUInt32LE(json.length, 12);
  head.writeUInt32LE(0x4e4f534a, 16);
  const binHead = Buffer.alloc(8);
  binHead.writeUInt32LE(binBytes, 0);
  binHead.writeUInt32LE(0x004e4942, 4);
  const file = path.join(os.tmpdir(), `hdr-${Date.now()}-${binBytes}.glb`);
  fs.writeFileSync(
    file,
    Buffer.concat([head, json, binHead, Buffer.alloc(binBytes)]),
  );
  return file;
}

describe('readGlbHeaderBytes', () => {
  it('reads only the header, and the georeference readers work on it', () => {
    const file = glbFile(4 * 1024 * 1024);
    try {
      const header = readGlbHeaderBytes(file)!;
      expect(header.length).toBe(20 + 260);
      expect(deriveGlbGeoInfo(header)).toEqual(
        deriveGlbGeoInfo(fs.readFileSync(file)),
      );
      expect(deriveGlbGeoInfo(header)?.geographic).toBe(true);
    } finally {
      fs.rmSync(file, { force: true });
    }
  });

  it('returns null for a file that is not a GLB', () => {
    const file = path.join(os.tmpdir(), `nothdr-${Date.now()}.txt`);
    fs.writeFileSync(file, 'definitely not a glTF binary file');
    try {
      expect(readGlbHeaderBytes(file)).toBeNull();
    } finally {
      fs.rmSync(file, { force: true });
    }
  });
});
