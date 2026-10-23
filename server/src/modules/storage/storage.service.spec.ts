import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';

/** Simulates a disk that fills up half-way through the next write. */
const mockDisk = { failNext: false };
jest.mock('fs/promises', () => {
  const actual =
    jest.requireActual<typeof import('fs/promises')>('fs/promises');
  return {
    ...actual,
    writeFile: async (file: string, data: Buffer, ...rest: unknown[]) => {
      if (mockDisk.failNext) {
        mockDisk.failNext = false;
        await actual.writeFile(file, Buffer.from(data).subarray(0, 3));
        throw Object.assign(new Error('ENOSPC: no space left on device'), {
          code: 'ENOSPC',
        });
      }
      return (actual.writeFile as (...a: unknown[]) => Promise<void>)(
        file,
        data,
        ...rest,
      );
    },
  };
});

describe('StorageService (local) writes', () => {
  let dir: string;
  let storage: StorageService;
  const file = 'schools/a/3d/_source/m.glb';
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-'));
    storage = new StorageService({
      get: (k: string, d?: string) =>
        k === 'FILE_SERVER_STORAGE_PATH'
          ? dir
          : k === 'STORAGE_BACKEND'
            ? 'local'
            : d,
    } as unknown as ConfigService);
  });
  afterEach(() => {
    mockDisk.failNext = false;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('writes and replaces a file', async () => {
    await storage.uploadFile(file, Buffer.from('one'), 'model/gltf-binary');
    await storage.uploadFile(file, Buffer.from('two'), 'model/gltf-binary');
    expect(fs.readFileSync(path.join(dir, file), 'utf8')).toBe('two');
    expect(fs.readdirSync(path.dirname(path.join(dir, file)))).toEqual([
      'm.glb',
    ]);
  });

  it('a write that fails half-way (disk full) leaves the old file intact and no partial file', async () => {
    await storage.uploadFile(file, Buffer.from('the original'), 'x');
    mockDisk.failNext = true;
    const url = await storage.uploadFile(
      file,
      Buffer.from('a new, longer copy'),
      'x',
    );
    expect(url).toBeNull();
    expect(fs.readFileSync(path.join(dir, file), 'utf8')).toBe('the original');
    expect(fs.readdirSync(path.dirname(path.join(dir, file)))).toEqual([
      'm.glb',
    ]);
  });
});
