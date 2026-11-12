import {
  accessOf,
  applyAccess,
  clampMapArea,
  describeAccess,
  schoolInAccess,
  type PartnerAccess,
} from './partner-access';
import { EMBED_VIEWS } from './partner-embed';

const all = [...EMBED_VIEWS];
const nat: PartnerAccess = { tier: 'national', views: all };
const prov: PartnerAccess = {
  tier: 'province',
  province: 'Southern Province',
  views: all,
};
const dist: PartnerAccess = {
  tier: 'district',
  province: 'Southern Province',
  district: 'Muhanga',
  views: all,
};
const list: PartnerAccess = {
  tier: 'schools',
  schoolCodes: ['270501', 'TSS-SOU-001'],
  views: ['school-dashboard'],
};

const acej = {
  code: '270501',
  tdmpSchoolCode: '270501',
  province: 'Southern Province',
  district: 'Muhanga',
};
const huye = {
  code: '240952',
  tdmpSchoolCode: '240952',
  province: 'Southern Province',
  district: 'Huye',
};
const kigali = {
  code: '130906',
  tdmpSchoolCode: '130906',
  province: 'Kigali City',
  district: 'Kicukiro',
};

describe('schoolInAccess', () => {
  it('national reaches every school', () => {
    for (const s of [acej, huye, kigali])
      expect(schoolInAccess(nat, s)).toBe(true);
  });
  it('province / district limit by area (case-insensitive)', () => {
    expect(schoolInAccess(prov, huye)).toBe(true);
    expect(schoolInAccess(prov, kigali)).toBe(false);
    expect(schoolInAccess(dist, acej)).toBe(true);
    expect(schoolInAccess(dist, huye)).toBe(false);
    expect(schoolInAccess({ ...dist, district: 'MUHANGA' }, acej)).toBe(true);
  });
  it('a school list matches the TDMP or the local code', () => {
    expect(schoolInAccess(list, acej)).toBe(true);
    expect(
      schoolInAccess(list, {
        code: 'TSS-SOU-001',
        tdmpSchoolCode: '280705',
        province: 'x',
        district: 'y',
      }),
    ).toBe(true);
    expect(schoolInAccess(list, huye)).toBe(false);
  });
});

describe('clampMapArea', () => {
  it('national: whatever area is asked', () => {
    expect(clampMapArea(nat, {})).toEqual({
      ok: true,
      loc: { tier: 'national' },
    });
    expect(clampMapArea(nat, { district: 'Huye' })).toMatchObject({
      ok: true,
      loc: { tier: 'district', district: 'Huye' },
    });
  });
  it('province: defaults to the province, refuses another, checks a district', () => {
    expect(clampMapArea(prov, {})).toEqual({
      ok: true,
      loc: { tier: 'province', province: 'Southern Province' },
    });
    expect(clampMapArea(prov, { province: 'Kigali City' })).toMatchObject({
      ok: false,
    });
    expect(clampMapArea(prov, { district: 'Huye' })).toEqual({
      ok: 'check',
      district: 'Huye',
      province: 'Southern Province',
    });
  });
  it('district: always the district; another one is refused', () => {
    expect(clampMapArea(dist, {})).toMatchObject({
      ok: true,
      loc: { tier: 'district', district: 'Muhanga' },
    });
    expect(clampMapArea(dist, { district: 'Huye' })).toMatchObject({
      ok: false,
    });
  });
  it('schools: no national map', () => {
    expect(clampMapArea(list, {})).toMatchObject({ ok: false });
  });
});

describe('accessOf', () => {
  it('older keys default to national with every view', () => {
    expect(accessOf({})).toEqual({
      tier: 'national',
      province: null,
      district: null,
      schoolCodes: null,
      views: all,
    });
  });
  it('reads the stored level and drops unknown views', () => {
    expect(
      accessOf({
        accessTier: 'district',
        accessProvince: 'P',
        accessDistrict: 'D',
        allowedViews: ['school-map-2d', 'admin'],
      }),
    ).toMatchObject({
      tier: 'district',
      district: 'D',
      views: ['school-map-2d'],
    });
  });
  it('describes itself', () => {
    expect(describeAccess(dist)).toBe('Muhanga district');
    expect(describeAccess(list)).toBe('2 school(s)');
  });
});

describe('applyAccess', () => {
  const qb = () => {
    const calls: Array<[string, unknown]> = [];
    const q = {
      andWhere: (sql: string, p?: unknown) => (calls.push([sql, p]), q),
    };
    return { q, calls };
  };
  it('adds no filter for national, one per area otherwise', () => {
    const a = qb();
    applyAccess(a.q as never, nat);
    expect(a.calls).toHaveLength(0);
    const b = qb();
    applyAccess(b.q as never, dist);
    expect(b.calls).toHaveLength(2);
    const c = qb();
    applyAccess(c.q as never, list);
    expect(c.calls[0][1]).toEqual({ accCodes: ['270501', 'TSS-SOU-001'] });
    const d = qb();
    applyAccess(d.q as never, { tier: 'schools', schoolCodes: [], views: all });
    expect(d.calls[0][0]).toBe('1 = 0');
  });
});
