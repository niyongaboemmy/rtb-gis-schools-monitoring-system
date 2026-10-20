import { ConfigService } from '@nestjs/config';
import { SeedService } from './seed.service';
import { planRolePermissionSync } from './role-permission-sync';
import {
  DefaultRolePermissions,
  ScopedRolePresets,
} from '../../common/constants/permissions.constant';

describe('planRolePermissionSync', () => {
  it('adds only permissions that are new in code since the snapshot', () => {
    const plan = planRolePermissionSync(
      ['A', 'B'],
      ['A', 'B'],
      ['A', 'B', 'C'],
    );
    expect(plan.added).toEqual(['C']);
    expect(plan.permissions).toEqual(['A', 'B', 'C']);
    expect(plan.seededPermissions).toEqual(['A', 'B', 'C']);
    expect(plan.changed).toBe(true);
  });

  it('keeps permissions an admin granted', () => {
    const plan = planRolePermissionSync(['A', 'X'], ['A'], ['A']);
    expect(plan.permissions).toEqual(['A', 'X']);
    expect(plan.changed).toBe(false);
  });

  it('never re-adds a permission an admin removed', () => {
    const plan = planRolePermissionSync(['A'], ['A', 'B'], ['A', 'B']);
    expect(plan.permissions).toEqual(['A']);
    expect(plan.added).toEqual([]);
    expect(plan.changed).toBe(false);
  });

  it('does not remove permissions dropped from code', () => {
    const plan = planRolePermissionSync(['A', 'B'], ['A', 'B'], ['A']);
    expect(plan.permissions).toEqual(['A', 'B']);
    expect(plan.seededPermissions).toEqual(['A']);
    expect(plan.changed).toBe(true);
  });

  it('with no snapshot, uses the stored list as baseline and adds missing code permissions once', () => {
    const first = planRolePermissionSync(['A', 'X'], null, ['A', 'B']);
    expect(first.permissions).toEqual(['A', 'X', 'B']);
    expect(first.added).toEqual(['B']);
    // Admin now removes B; the next run must not bring it back.
    const second = planRolePermissionSync(['A', 'X'], first.seededPermissions, [
      'A',
      'B',
    ]);
    expect(second.permissions).toEqual(['A', 'X']);
    expect(second.changed).toBe(false);
  });

  it('is idempotent', () => {
    const once = planRolePermissionSync(['A'], ['A'], ['A', 'B']);
    const twice = planRolePermissionSync(
      once.permissions,
      once.seededPermissions,
      ['A', 'B'],
    );
    expect(twice.changed).toBe(false);
    expect(twice.permissions).toEqual(once.permissions);
  });
});

// ── SeedService role seeding against in-memory repos ────────────────────────

type Row = Record<string, any>;

function memoryRepo(rows: Row[]) {
  return {
    rows,
    findOne: jest.fn(({ where }: { where: Row }) =>
      Promise.resolve(
        rows.find((r) => Object.entries(where).every(([k, v]) => r[k] === v)) ??
          null,
      ),
    ),
    create: jest.fn((data: Row) => ({ ...data })),
    save: jest.fn((row: Row) => {
      if (!rows.includes(row)) {
        row.id ??= `id-${rows.length + 1}`;
        rows.push(row);
      }
      return Promise.resolve(row);
    }),
  };
}

function makeService(roles: Row[], levels: Row[]) {
  const roleRepo = memoryRepo(roles);
  const levelRepo = memoryRepo(levels);
  const service = new SeedService(
    memoryRepo([]) as any,
    roleRepo as any,
    memoryRepo([]) as any,
    memoryRepo([]) as any,
    levelRepo as any,
    { get: () => undefined } as unknown as ConfigService,
  );
  return { service, roleRepo, levelRepo };
}

const LEVELS = () => [
  { id: 'lvl-national', name: 'National', slug: 'national', rank: 10 },
  { id: 'lvl-district', name: 'District', slug: 'district', rank: 30 },
  { id: 'lvl-school', name: 'School', slug: 'school', rank: 50 },
];

describe('SeedService role seeding', () => {
  it('creates missing built-in roles with a snapshot and the National level', async () => {
    const { service, roleRepo } = makeService([], LEVELS());
    await service.syncBuiltInRoles();
    const names = roleRepo.rows.map((r) => r.name).sort();
    expect(names).toEqual(Object.keys(DefaultRolePermissions).sort());
    const viewer = roleRepo.rows.find((r) => r.name === 'viewer')!;
    expect(viewer.permissions).toEqual(DefaultRolePermissions.viewer);
    expect(viewer.seededPermissions).toEqual(DefaultRolePermissions.viewer);
    expect(viewer.accessLevel?.slug).toBe('national');
  });

  it('preserves admin edits on built-in roles across re-seeds', async () => {
    const code = DefaultRolePermissions.viewer;
    const removed = code[0];
    const viewer: Row = {
      id: 'r1',
      name: 'viewer',
      permissions: [...code.filter((p) => p !== removed), 'MANAGE_REPORTS'],
      seededPermissions: [...code],
    };
    const { service, roleRepo } = makeService([viewer], LEVELS());
    await service.syncBuiltInRoles();
    await service.syncBuiltInRoles();
    expect(viewer.permissions).not.toContain(removed);
    expect(viewer.permissions).toContain('MANAGE_REPORTS');
    // Unchanged viewer row is not re-saved.
    expect(roleRepo.save).not.toHaveBeenCalledWith(viewer);
  });

  it('creates scoped presets bound to their access level only when missing', async () => {
    const { service, roleRepo } = makeService([], LEVELS());
    await service.seedScopedRolePresets();
    const leader = roleRepo.rows.find((r) => r.name === 'school_leader')!;
    const officer = roleRepo.rows.find((r) => r.name === 'district_officer')!;
    expect(leader.accessLevel.slug).toBe('school');
    expect(officer.accessLevel.slug).toBe('district');
    expect(leader.permissions).toEqual(
      ScopedRolePresets.school_leader.permissions,
    );
  });

  it('never overwrites an existing preset', async () => {
    const existing: Row = {
      id: 'r9',
      name: 'school_leader',
      permissions: ['VIEW_SCHOOLS'],
      accessLevel: { slug: 'sector' },
    };
    const { service, roleRepo } = makeService([existing], LEVELS());
    await service.seedScopedRolePresets();
    await service.seedScopedRolePresets();
    expect(existing.permissions).toEqual(['VIEW_SCHOOLS']);
    expect(existing.accessLevel.slug).toBe('sector');
    expect(
      roleRepo.rows.filter((r) => r.name === 'school_leader'),
    ).toHaveLength(1);
    expect(
      roleRepo.rows.filter((r) => r.name === 'district_officer'),
    ).toHaveLength(1);
  });

  it('skips a preset when its access level does not exist yet', async () => {
    const { service, roleRepo } = makeService([], [LEVELS()[0]]);
    await service.seedScopedRolePresets();
    expect(roleRepo.rows).toHaveLength(0);
  });
});
