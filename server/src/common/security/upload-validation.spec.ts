// eslint-disable-next-line @typescript-eslint/no-require-imports
const JSZip = require('jszip') as typeof import('jszip');
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BadRequestException } from '@nestjs/common';
import {
  ExtractionBudget,
  assertSafeZip,
  assertTrustedFileUrl,
  assertUploadedFile,
  detectFileKind,
  extensionFileFilter,
  isSafeEntryName,
  readZipEntries,
  UPLOAD_EXTENSIONS,
  type ZipLimits,
} from './upload-validation';

const LIMITS: ZipLimits = {
  maxEntries: 100,
  maxTotalUncompressed: 1024 * 1024,
  maxRatio: 1000,
};

async function zipOf(files: Record<string, string | Buffer>): Promise<Buffer> {
  const zip = new JSZip();
  for (const [name, data] of Object.entries(files)) zip.file(name, data);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

describe('detectFileKind', () => {
  it.each([
    [Buffer.from('PK\x03\x04rest', 'binary'), 'zip'],
    [Buffer.from('glTF\x02\x00\x00\x00', 'binary'), 'glb'],
    [Buffer.from('%PDF-1.7'), 'pdf'],
    [Buffer.from('GIF89a'), 'gif'],
    [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]), 'png'],
    [Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'jpeg'],
    [Buffer.from('RIFF\x00\x00\x00\x00WEBPVP8 ', 'binary'), 'webp'],
    [Buffer.from('\x00\x00\x00\x18ftypheic', 'binary'), 'heic'],
    [Buffer.from('\uFEFF  <?xml version="1.0"?><kml>'), 'xml'],
    [Buffer.from('<kml xmlns="http://www.opengis.net/kml/2.2">'), 'xml'],
  ])('identifies %p as %s', (buf, kind) => {
    expect(detectFileKind(buf)).toBe(kind);
  });

  it('returns null for unknown or binary content', () => {
    expect(detectFileKind(Buffer.from('MZ\x90\x00', 'binary'))).toBeNull();
    expect(detectFileKind(Buffer.from('<\x00\x01\x02', 'binary'))).toBeNull();
    expect(detectFileKind(Buffer.from('hello'))).toBeNull();
  });
});

describe('assertUploadedFile', () => {
  it('accepts content matching the extension (buffer and disk)', () => {
    expect(
      assertUploadedFile(
        {
          originalname: 'site.KMZ',
          buffer: Buffer.from('PK\x03\x04', 'binary'),
        },
        UPLOAD_EXTENSIONS.geospatial,
      ),
    ).toBe('zip');
    const tmp = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'upl-')),
      'm.glb',
    );
    fs.writeFileSync(tmp, Buffer.from('glTF\x02\x00\x00\x00', 'binary'));
    expect(
      assertUploadedFile(
        { originalname: 'm.glb', path: tmp },
        UPLOAD_EXTENSIONS.model,
      ),
    ).toBe('glb');
  });

  it('rejects a disallowed extension', () => {
    expect(() =>
      assertUploadedFile(
        { originalname: 'evil.exe', buffer: Buffer.from('MZ') },
        UPLOAD_EXTENSIONS.geospatial,
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects a renamed file whose bytes do not match', () => {
    expect(() =>
      assertUploadedFile(
        {
          originalname: 'model.glb',
          buffer: Buffer.from('PK\x03\x04', 'binary'),
        },
        UPLOAD_EXTENSIONS.model,
      ),
    ).toThrow(/does not match/);
    expect(() =>
      assertUploadedFile(
        { originalname: 'photo.png', buffer: Buffer.from('<script>') },
        UPLOAD_EXTENSIONS.reportAttachment,
      ),
    ).toThrow(/does not match/);
  });

  it('rejects a missing file', () => {
    expect(() =>
      assertUploadedFile(undefined, UPLOAD_EXTENSIONS.model),
    ).toThrow(/No file/);
  });
});

describe('extensionFileFilter', () => {
  const run = (name: string) =>
    new Promise<[Error | null, boolean]>((resolve) =>
      extensionFileFilter(UPLOAD_EXTENSIONS.geospatial)(
        null,
        { originalname: name },
        (e, ok) => resolve([e, ok]),
      ),
    );

  it('accepts allowed extensions and rejects others or path-like names', async () => {
    expect(await run('a.kml')).toEqual([null, true]);
    expect((await run('a.php'))[1]).toBe(false);
    expect((await run('../a.kmz'))[1]).toBe(false);
  });
});

describe('ZIP guards', () => {
  it('lists central-directory entries with sizes', async () => {
    const buf = await zipOf({
      'doc.kml': '<kml/>',
      'files/a.png': Buffer.alloc(500),
    });
    const entries = readZipEntries(buf);
    expect(entries.map((e) => e.name).sort()).toEqual([
      'doc.kml',
      'files/',
      'files/a.png',
    ]);
    expect(entries.find((e) => e.name === 'files/')?.isDirectory).toBe(true);
    expect(
      entries.find((e) => e.name === 'files/a.png')?.uncompressedSize,
    ).toBe(500);
  });

  it.each([
    '../evil.kml',
    'a/../../evil',
    '/etc/passwd',
    'C:\\win.ini',
    'a\\b',
    'x\0y',
  ])('rejects unsafe entry name %p', (name) =>
    expect(isSafeEntryName(name)).toBe(false),
  );

  it('accepts normal nested names', () => {
    expect(isSafeEntryName('files/models/building 1.dae')).toBe(true);
  });

  it('rejects an archive containing a traversal entry', async () => {
    const buf = await zipOf({ 'doc.kml': '<kml/>', '../../escape.txt': 'x' });
    expect(() => assertSafeZip(buf, LIMITS)).toThrow(/unsafe path/);
  });

  it('rejects too many entries', async () => {
    const files: Record<string, string> = {};
    for (let i = 0; i < 101; i++) files[`f${i}.txt`] = 'x';
    const buf = await zipOf(files);
    expect(() => assertSafeZip(buf, LIMITS)).toThrow(/101 entries/);
  });

  it('rejects an archive that expands beyond the total limit', async () => {
    const buf = await zipOf({ 'a.bin': Buffer.alloc(2 * 1024 * 1024) });
    expect(() => assertSafeZip(buf, LIMITS)).toThrow(/expands to/);
  });

  it('rejects a single entry with a bomb-like compression ratio', async () => {
    const buf = await zipOf({ 'zeros.bin': Buffer.alloc(20 * 1024 * 1024) });
    expect(() =>
      assertSafeZip(buf, {
        ...LIMITS,
        maxTotalUncompressed: 1e12,
        maxRatio: 100,
      }),
    ).toThrow(/compression ratio/);
  });

  it('passes a normal KMZ', async () => {
    const buf = await zipOf({
      'doc.kml': '<kml/>',
      'files/tex.jpg': Buffer.from([0xff, 0xd8, 0xff]),
    });
    expect(
      assertSafeZip(buf, LIMITS).filter((e) => !e.isDirectory),
    ).toHaveLength(2);
  });

  it('rejects non-ZIP input', () => {
    expect(() =>
      readZipEntries(Buffer.from('not a zip at all, just text....')),
    ).toThrow(BadRequestException);
  });

  it('ExtractionBudget enforces real decompressed bytes', () => {
    const budget = new ExtractionBudget(LIMITS);
    budget.add('a', 1000);
    expect(() => budget.add('b', 2 * 1024 * 1024)).toThrow(/expands beyond/);
    expect(() => new ExtractionBudget(LIMITS).add('../x', 1)).toThrow(
      /unsafe path/,
    );
  });
});

describe('assertTrustedFileUrl', () => {
  const env = {
    FILE_SERVER_BASE_URL: 'http://localhost:3002',
    APP_CORS_ORIGINS: 'https://rtb.aerovyntech.com',
  } as NodeJS.ProcessEnv;

  it.each([
    '/files/kmz/1-site.kmz',
    'files/kmz/1-site.kmz',
    'https://rtb.aerovyntech.com/files/kmz/1-site.kmz',
    'http://localhost:3002/files/3d/m.glb',
  ])('accepts %p', (url) =>
    expect(() => assertTrustedFileUrl(url, env)).not.toThrow(),
  );

  it.each([
    'http://169.254.169.254/latest/meta-data/',
    'https://evil.example/files/x.kmz',
    'http://localhost:3001/api/v1/users',
    '/files/../server/.env',
    '/files/%2e%2e/secret',
    '//evil.example/files/x',
    'https://user:pw@rtb.aerovyntech.com/files/x.kmz',
  ])('rejects %p', (url) =>
    expect(() => assertTrustedFileUrl(url, env)).toThrow(BadRequestException),
  );
});
