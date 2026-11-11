import {
  pickRole,
  placementFromScope,
  splitName,
  type MappableRole,
} from './tdmp-identity';
import type { TdmpAccessScope } from '../../tdmp/tdmp.types';

const roles: MappableRole[] = [
  {
    id: 'r-admin',
    name: 'admin',
    permissions: ['A', 'B', 'C'],
    tdmpRoleNames: ['rtb_admin'],
    accessLevel: { slug: 'national', rank: 10 },
  },
  {
    id: 'r-district',
    name: 'district_officer',
    permissions: ['A'],
    tdmpRoleNames: ['District_Admin', 'rtb_admin'],
    accessLevel: { slug: 'district', rank: 30 },
  },
  {
    id: 'r-school',
    name: 'school_leader',
    permissions: ['A', 'B'],
    tdmpRoleNames: ['school_admin'],
    accessLevel: { slug: 'school', rank: 50 },
  },
  { id: 'r-viewer', name: 'viewer', permissions: ['A'], tdmpRoleNames: [] },
];

const scope = (
  accessScope: TdmpAccessScope['accessScope'],
  extra: Partial<TdmpAccessScope> = {},
): TdmpAccessScope => ({
  userId: 7,
  roleNames: [],
  accessScope,
  ...extra,
});

describe('pickRole', () => {
  it('matches TDMP role names case-insensitively', () => {
    expect(pickRole(['DISTRICT_ADMIN'], roles)?.name).toBe('district_officer');
  });

  it('picks the broadest role when several match', () => {
    expect(pickRole(['rtb_admin'], roles)?.name).toBe('admin');
  });

  it('falls back to the default role, else refuses', () => {
    expect(pickRole(['teacher'], roles, 'viewer')?.name).toBe('viewer');
    expect(pickRole(['teacher'], roles)).toBeNull();
    expect(pickRole(['teacher'], roles, 'missing_role')).toBeNull();
  });
});

describe('placementFromScope', () => {
  const anchor = {
    id: 1,
    schoolCode: '575775',
    schoolName: 'IPRC Musanze',
    provinceName: 'Northern',
    districtName: 'Musanze',
  };

  it('unrestricted → national', () => {
    expect(placementFromScope(scope({ kind: 'unrestricted' }))).toEqual({
      tier: 'national',
    });
  });

  it('district uses the scope names, falling back to the anchor school', () => {
    expect(
      placementFromScope(
        scope({
          kind: 'district',
          districtName: 'Huye',
          provinceName: 'Southern',
        }),
      ),
    ).toEqual({ tier: 'district', province: 'Southern', district: 'Huye' });
    expect(
      placementFromScope(scope({ kind: 'district' }, { anchorSchool: anchor })),
    ).toEqual({ tier: 'district', province: 'Northern', district: 'Musanze' });
  });

  it('school carries the anchor school code', () => {
    expect(
      placementFromScope(scope({ kind: 'school' }, { anchorSchool: anchor })),
    ).toMatchObject({
      tier: 'school',
      schoolCode: '575775',
      schoolName: 'IPRC Musanze',
    });
  });

  it('deny and unknown kinds give no access', () => {
    expect(placementFromScope(scope({ kind: 'deny' }))).toBeNull();
    expect(placementFromScope(scope({ kind: 'galaxy' }))).toBeNull();
    expect(placementFromScope(scope({ kind: '' }))).toBeNull();
  });
});

describe('splitName', () => {
  it('splits on the first space and falls back when empty', () => {
    expect(splitName('Jean Claude Uwimana', 'x')).toEqual({
      firstName: 'Jean',
      lastName: 'Claude Uwimana',
    });
    expect(splitName('  ', 'jean')).toEqual({
      firstName: 'jean',
      lastName: '',
    });
  });
});
