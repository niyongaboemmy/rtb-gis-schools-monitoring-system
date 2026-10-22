import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ScopeGuard } from './scope.guard';
import { SCOPED_RESOURCE_KEY, ScopedResourceConfig } from './scope.decorator';

const SCHOOL_A = '11111111-1111-4111-8111-111111111111';
const ACTION_1 = '22222222-2222-4222-8222-222222222222';

const districtOfficer = {
  role: {
    name: 'district_officer',
    accessLevel: { slug: 'district', rank: 30 },
  },
  location: { province: 'P', district: 'Mine' },
};

function makeGuard(cfg: ScopedResourceConfig, rows: Record<string, unknown>) {
  const reflector = {
    getAllAndOverride: jest.fn((key: string) =>
      key === SCOPED_RESOURCE_KEY ? cfg : undefined,
    ),
  } as unknown as Reflector;
  const findOne = jest.fn(({ where }: { where: { id: string } }) =>
    Promise.resolve(rows[where.id] ?? null),
  );
  const dataSource = { getRepository: () => ({ findOne }) };
  return { guard: new ScopeGuard(dataSource as never, reflector), findOne };
}

const ctx = (req: Record<string, unknown>) =>
  ({
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => req }),
  }) as unknown as ExecutionContext;

describe('ScopeGuard', () => {
  const prev = process.env.SCOPE_ENFORCEMENT;
  beforeAll(() => (process.env.SCOPE_ENFORCEMENT = 'true'));
  afterAll(() => (process.env.SCOPE_ENFORCEMENT = prev));

  it('rejects a scoped user who omits a query-string school id (was: any school)', async () => {
    const { guard } = makeGuard({ param: 'schoolId', from: 'query' }, {});
    await expect(
      guard.canActivate(ctx({ user: districtOfficer, query: {} })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('a class-level params decorator on a list route (no such param) passes', async () => {
    const { guard } = makeGuard({ param: 'schoolId', from: 'params' }, {});
    await expect(
      guard.canActivate(ctx({ user: districtOfficer, params: {} })),
    ).resolves.toBe(true);
  });

  it('a malformed id never reaches Postgres (the route pipe returns 400)', async () => {
    const { guard, findOne } = makeGuard(
      { param: 'schoolId', from: 'query' },
      {},
    );
    await expect(
      guard.canActivate(
        ctx({ user: districtOfficer, query: { schoolId: 'abc' } }),
      ),
    ).resolves.toBe(true);
    expect(findOne).not.toHaveBeenCalled();
  });

  it('resolves a recommendation action to its school and enforces scope', async () => {
    const { guard } = makeGuard(
      { param: 'id', from: 'params', via: 'action' },
      {
        [ACTION_1]: { id: ACTION_1, schoolId: SCHOOL_A },
        [SCHOOL_A]: { id: SCHOOL_A, province: 'P', district: 'Other' },
      },
    );
    await expect(
      guard.canActivate(
        ctx({ user: districtOfficer, params: { id: ACTION_1 } }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('national users are never restricted', async () => {
    const { guard } = makeGuard({ param: 'schoolId', from: 'query' }, {});
    await expect(
      guard.canActivate(
        ctx({ user: { role: { name: 'super_admin' } }, query: {} }),
      ),
    ).resolves.toBe(true);
  });
});
