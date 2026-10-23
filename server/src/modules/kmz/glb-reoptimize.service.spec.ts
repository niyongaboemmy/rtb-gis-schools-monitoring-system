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

describe('GlbReoptimizeService per-school jobs', () => {
  const fakeJob = (
    id: string,
    schoolId: string,
    state: string,
    ts: number,
  ) => ({
    id,
    name: 'process-glb',
    data: { schoolId, originalName: 'site.glb', source: 'restore' },
    progress: {
      stage: 'simplifying',
      percent: 18,
      at: new Date(ts).toISOString(),
    },
    attemptsMade: 0,
    opts: { attempts: 3 },
    timestamp: ts,
    processedOn: ts,
    finishedOn: state === 'completed' ? ts + 1000 : null,
    failedReason: null,
    returnvalue: null,
    getState: jest.fn().mockResolvedValue(state),
  });

  const make = (jobs: unknown[]) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'glb-jobs-'));
    const dir = path.join(root, 'schools', 'school-a', '3d', '_source');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '..', 'site.glb'), 'glb');
    fs.writeFileSync(path.join(dir, 'site.glb'), 'glb');
    const queue = {
      getJobs: jest.fn().mockResolvedValue(jobs),
      add: jest.fn().mockResolvedValue({ id: 'new' }),
    };
    const service = new GlbReoptimizeService(
      queue as any,
      { getLocalRoot: () => root } as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
    );
    return {
      service,
      queue,
      cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
    };
  };

  it('reports the newest job of that school only', async () => {
    const { service, cleanup } = make([
      fakeJob('1', 'school-a', 'completed', 1000),
      fakeJob('2', 'school-a', 'active', 2000),
      fakeJob('3', 'school-b', 'active', 3000),
    ]);
    const job = await service.latestJob('school-a');
    expect(job).toMatchObject({
      jobId: '2',
      state: 'running',
      stage: 'simplifying',
    });
    expect(await service.latestJob('school-c')).toBeNull();
    cleanup();
  });

  it('does not start a second job while one runs', async () => {
    const { service, queue, cleanup } = make([
      fakeJob('2', 'school-a', 'active', 2000),
    ]);
    const r = await service.startForSchool('school-a');
    expect(r).toMatchObject({ started: false, reason: 'already-running' });
    expect(queue.add).not.toHaveBeenCalled();
    cleanup();
  });

  it('starts from the stored original when idle', async () => {
    const { service, queue, cleanup } = make([
      fakeJob('1', 'school-a', 'completed', 1000),
    ]);
    const r = await service.startForSchool('school-a');
    expect(r.started).toBe(true);
    expect(queue.add).toHaveBeenCalledWith(
      'process-glb',
      expect.objectContaining({
        schoolId: 'school-a',
        source: 'restore',
        tempFilePath: expect.stringContaining(path.join('_source', 'site.glb')),
      }),
      expect.any(Object),
    );
    cleanup();
  });

  it('says so when the school has no model', async () => {
    const { service, cleanup } = make([]);
    expect(await service.startForSchool('school-z')).toMatchObject({
      started: false,
      reason: 'no-model',
    });
    cleanup();
  });
});
