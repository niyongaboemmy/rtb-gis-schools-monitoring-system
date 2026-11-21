import { TdmpIdentityService, PENDING_LOCATION } from './tdmp-identity.service';
import { TdmpSignInRefused } from './tdmp-identity';

type Row = Record<string, any>;

function setup(
  opts: {
    rows?: Row[];
    accessSource?: 'local' | 'tdmp';
    defaultRoleName?: string;
    roles?: Row[];
  } = {},
) {
  const rows: Row[] = opts.rows ?? [];
  const roles: Row[] = opts.roles ?? [
    { id: 'r-viewer', name: 'viewer', permissions: ['A'], tdmpRoleNames: [] },
  ];
  const match = (row: Row, where: Row) =>
    Object.entries(where).every(([k, v]) =>
      v && typeof v === 'object' && '_type' in v
        ? row[k] !== (v as { _value: unknown })._value // Not(...)
        : row[k] === v,
    );
  const users = {
    findOne: jest.fn(async ({ where }: { where: Row }) =>
      rows.find((r) => match(r, where)) ?? null,
    ),
    create: jest.fn((v: Row) => ({ ...v })),
    save: jest.fn(async (v: Row) => {
      v.id ??= `u${rows.length + 1}`;
      if (!rows.includes(v)) rows.push(v);
      return v;
    }),
    findOneOrFail: jest.fn(async ({ where }: { where: Row }) =>
      rows.find((r) => r.id === where.id),
    ),
  };
  const roleRepo = {
    findOne: jest.fn(
      async ({ where }: { where: Row }) =>
        roles.find((r) => r.name === where.name) ?? null,
    ),
    find: jest.fn(async () => roles),
  };
  const service = new TdmpIdentityService(
    users as never,
    roleRepo as never,
    { findOne: jest.fn(async () => null) } as never,
    {
      accessSource: opts.accessSource ?? 'local',
      defaultRoleName: opts.defaultRoleName ?? '',
    } as never,
  );
  return { service, rows, users };
}

const identity = {
  tdmpUserId: '77',
  email: 'aline@rtb.gov.rw',
  emailVerified: true,
  name: 'Aline Mukamana',
  givenName: 'Aline',
  familyName: 'Mukamana',
};

describe('TdmpIdentityService (role and area set in RTB GIS)', () => {
  it('puts someone nobody pre-registered on the waiting list', async () => {
    const { service } = setup();
    const { user, requested } = await service.signIn(identity);
    expect(requested).toBe(true);
    expect(user).toMatchObject({
      email: 'aline@rtb.gov.rw',
      firstName: 'Aline',
      lastName: 'Mukamana',
      authSource: 'tdmp',
      tdmpUserId: '77',
      accessPending: true,
      role: null,
      location: PENDING_LOCATION,
    });
  });

  it('gives TDMP_DEFAULT_ROLE instead of waiting, when it is set', async () => {
    const { service } = setup({ defaultRoleName: 'viewer' });
    const { user, requested } = await service.signIn(identity);
    expect(requested).toBe(false);
    expect(user.accessPending).toBe(false);
    expect(user.role).toMatchObject({ name: 'viewer' });
  });

  it('applies the pre-registered role and area on first sign-in', async () => {
    const preRegistered = {
      id: 'u-pre',
      email: 'aline@rtb.gov.rw',
      firstName: 'aline',
      lastName: '',
      authSource: 'tdmp',
      tdmpUserId: null,
      accessPending: false,
      isActive: true,
      role: { id: 'r-district', name: 'district_officer' },
      location: { district: 'Gasabo', province: 'Kigali City' },
    };
    const { service } = setup({ rows: [preRegistered] });
    const { user, requested } = await service.signIn(identity);
    expect(requested).toBe(false);
    expect(user).toMatchObject({
      id: 'u-pre',
      tdmpUserId: '77',
      firstName: 'Aline',
      lastName: 'Mukamana',
      accessPending: false,
      role: { name: 'district_officer' },
      location: { district: 'Gasabo' },
    });
  });

  it('keeps role and area of an existing account on later sign-ins', async () => {
    const linked = {
      id: 'u1',
      email: 'old@rtb.gov.rw',
      firstName: 'Old',
      lastName: 'Name',
      authSource: 'tdmp',
      tdmpUserId: '77',
      accessPending: false,
      isActive: true,
      role: { id: 'r-admin', name: 'admin' },
      location: null,
    };
    const { service } = setup({ rows: [linked] });
    const { user } = await service.signIn(identity);
    expect(user).toMatchObject({
      email: 'aline@rtb.gov.rw',
      firstName: 'Aline',
      role: { name: 'admin' },
      location: null,
    });
  });

  it('only takes over an existing account on a verified email', async () => {
    const local = {
      id: 'u1',
      email: 'aline@rtb.gov.rw',
      authSource: 'local',
      tdmpUserId: null,
      isActive: true,
    };
    const { service } = setup({ rows: [local] });
    await expect(
      service.signIn({ ...identity, emailVerified: false }),
    ).rejects.toThrow(TdmpSignInRefused);
  });

  it('refuses a deactivated account and a partner account', async () => {
    const off = setup({
      rows: [{ id: 'u1', tdmpUserId: '77', isActive: false }],
    });
    await expect(off.service.signIn(identity)).rejects.toMatchObject({
      reason: 'inactive',
    });
    const partner = setup({
      rows: [
        {
          id: 'p1',
          email: 'aline@rtb.gov.rw',
          authSource: 'partner',
          tdmpUserId: null,
          isActive: true,
        },
      ],
    });
    await expect(partner.service.signIn(identity)).rejects.toMatchObject({
      reason: 'not_allowed',
    });
  });

  it('keeps the old email when TDMP sends one another account uses', async () => {
    const rows = [
      {
        id: 'u1',
        email: 'old@rtb.gov.rw',
        authSource: 'tdmp',
        tdmpUserId: '77',
        isActive: true,
      },
      { id: 'u2', email: 'aline@rtb.gov.rw', authSource: 'local' },
    ];
    const { service } = setup({ rows });
    const { user } = await service.signIn(identity);
    expect(user.email).toBe('old@rtb.gov.rw');
  });
});

describe('TdmpIdentityService (role and area from TDMP)', () => {
  it('refuses when TDMP sent no access scope', async () => {
    const { service } = setup({ accessSource: 'tdmp' });
    await expect(service.signIn(identity)).rejects.toMatchObject({
      reason: 'not_allowed',
    });
  });

  it('maps the role and area when TDMP sends them', async () => {
    const { service } = setup({
      accessSource: 'tdmp',
      roles: [
        {
          id: 'r-d',
          name: 'district_officer',
          tdmpRoleNames: ['district_admin'],
          accessLevel: { slug: 'district', rank: 30 },
        },
      ],
    });
    const { user } = await service.signIn({
      ...identity,
      scope: {
        userId: 77,
        roleNames: ['District_Admin'],
        accessScope: {
          kind: 'district',
          provinceName: 'Kigali City',
          districtName: 'Gasabo',
        },
      },
    });
    expect(user).toMatchObject({
      accessPending: false,
      role: { name: 'district_officer' },
      location: { tier: 'district', district: 'Gasabo' },
    });
  });
});
