import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditService, AuditActor } from './audit.service';
import { AuditLog } from './entities/audit-log.entity';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ACTOR: AuditActor = { id: 'user-1', email: 'admin@rtb.gov.rw' };

function makeRepo() {
  return {
    create: jest.fn((v: Partial<AuditLog>) => ({ ...v } as AuditLog)),
    save: jest.fn().mockResolvedValue({ id: 'log-1' }),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
  };
}

async function setup() {
  const repo = makeRepo();
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AuditService,
      { provide: getRepositoryToken(AuditLog), useValue: repo },
    ],
  }).compile();
  return { service: module.get<AuditService>(AuditService), repo };
}

// ---------------------------------------------------------------------------
// AuditService.log
// ---------------------------------------------------------------------------

describe('AuditService.log', () => {
  it('creates and saves a log entry with actor, action, targetType, targetId, meta', async () => {
    const { service, repo } = await setup();

    service.log(ACTOR, 'school.delete', 'school', 'school-1', { name: 'Test' });

    // Allow the fire-and-forget promise to settle
    await new Promise((r) => setTimeout(r, 0));

    expect(repo.create).toHaveBeenCalledWith({
      actorId: ACTOR.id,
      actorEmail: ACTOR.email,
      action: 'school.delete',
      targetType: 'school',
      targetId: 'school-1',
      meta: { name: 'Test' },
    });
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('accepts null actor (system-triggered operation)', async () => {
    const { service, repo } = await setup();

    service.log(null, 'analytics.recalculate', 'system', undefined, {
      processed: 5,
    });
    await new Promise((r) => setTimeout(r, 0));

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: undefined,
        actorEmail: undefined,
        action: 'analytics.recalculate',
        targetType: 'system',
      }),
    );
  });

  it('omits optional fields when not provided', async () => {
    const { service, repo } = await setup();

    service.log(ACTOR, 'user.deactivate', 'user');
    await new Promise((r) => setTimeout(r, 0));

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        targetId: undefined,
        meta: undefined,
      }),
    );
  });

  it('does not throw when save rejects (fire-and-forget)', async () => {
    const { service, repo } = await setup();
    repo.save.mockRejectedValueOnce(new Error('DB connection lost'));

    expect(() =>
      service.log(ACTOR, 'role.update', 'role', 'role-1'),
    ).not.toThrow();

    // Let the rejection settle — service should swallow it silently
    await new Promise((r) => setTimeout(r, 10));
  });
});

// ---------------------------------------------------------------------------
// AuditService.findAll
// ---------------------------------------------------------------------------

describe('AuditService.findAll', () => {
  it('returns data and total from repository', async () => {
    const { service, repo } = await setup();
    const fakeLog = { id: 'log-1', action: 'school.delete' } as AuditLog;
    repo.findAndCount.mockResolvedValueOnce([[fakeLog], 1]);

    const result = await service.findAll(50, 0);

    expect(result).toEqual([[fakeLog], 1]);
    expect(repo.findAndCount).toHaveBeenCalledWith({
      order: { createdAt: 'DESC' },
      take: 50,
      skip: 0,
    });
  });

  it('respects limit and offset parameters', async () => {
    const { service, repo } = await setup();
    repo.findAndCount.mockResolvedValueOnce([[], 0]);

    await service.findAll(10, 20);

    expect(repo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, skip: 20 }),
    );
  });

  it('returns empty list when no logs exist', async () => {
    const { service } = await setup();
    const [data, total] = await service.findAll();
    expect(data).toEqual([]);
    expect(total).toBe(0);
  });
});
