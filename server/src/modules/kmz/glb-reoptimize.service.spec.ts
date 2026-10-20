import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GlbReoptimizeService } from './glb-reoptimize.service';

/**
 * The sweep should enqueue exactly the school GLBs that have not been optimized
 * yet — i.e. those without a `3d/_source/<name>.glb` archive marker.
 */
describe('GlbReoptimizeService.enqueueUnoptimized', () => {
  let root: string;
  let queue: { add: jest.Mock };
  let storage: { getLocalRoot: jest.Mock };
  let schoolRepo: { find: jest.Mock };
  let service: GlbReoptimizeService;

  const writeGlb = (schoolId: string, name: string, archived = false) => {
    const dir = path.join(root, 'schools', schoolId, '3d');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name), 'glb');
    if (archived) {
      fs.mkdirSync(path.join(dir, '_source'), { recursive: true });
      fs.writeFileSync(path.join(dir, '_source', name), 'glb');
    }
  };

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'glb-sweep-'));
    queue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };
    storage = { getLocalRoot: jest.fn().mockReturnValue(root) };
    schoolRepo = { find: jest.fn().mockResolvedValue([]) };
    service = new GlbReoptimizeService(
      queue as any,
      storage as any,
      schoolRepo as any,
    );
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('enqueues a raw (un-archived) GLB', async () => {
    writeGlb('school-a', 'model.glb');

    const { enqueued, skipped } = await service.enqueueUnoptimized();

    expect(enqueued).toHaveLength(1);
    expect(skipped).toBe(0);
    expect(queue.add).toHaveBeenCalledWith(
      'process-glb',
      expect.objectContaining({ schoolId: 'school-a', source: 'restore' }),
      expect.any(Object),
    );
  });

  it('skips a GLB that already has a _source/ marker', async () => {
    writeGlb('school-b', 'model.glb', true);

    const { enqueued, skipped } = await service.enqueueUnoptimized();

    expect(enqueued).toHaveLength(0);
    expect(skipped).toBe(1);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('re-enqueues an archived GLB when force is set', async () => {
    writeGlb('school-c', 'model.glb', true);

    const { enqueued } = await service.enqueueUnoptimized({ force: true });

    expect(enqueued).toHaveLength(1);
  });

  it('skips a school the optimizer already failed on (unless forced)', async () => {
    writeGlb('school-d', 'model.glb');
    schoolRepo.find.mockResolvedValue([{ id: 'school-d' }]);

    const { enqueued, skipped } = await service.enqueueUnoptimized();
    expect(enqueued).toHaveLength(0);
    expect(skipped).toBe(1);

    const forced = await service.enqueueUnoptimized({ force: true });
    expect(forced.enqueued).toHaveLength(1);
  });

  it('no-ops for a non-local storage backend', async () => {
    storage.getLocalRoot.mockReturnValue(null);

    const { enqueued } = await service.enqueueUnoptimized();

    expect(enqueued).toHaveLength(0);
    expect(queue.add).not.toHaveBeenCalled();
  });
});
