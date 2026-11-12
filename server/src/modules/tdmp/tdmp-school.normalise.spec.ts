import fixtures from './__fixtures__';
import {
  clean,
  cleanEnum,
  normaliseTdmpSchool,
  ownershipOf,
} from './tdmp-school.normalise';
import type { TdmpSchool } from './tdmp.types';

const row = (k: keyof typeof fixtures.list) =>
  fixtures.list[k];
const IGNORE = ['access_scope_test', 'manual_seed'];

describe('clean / cleanEnum', () => {
  it('treats TDMP placeholders as unknown', () => {
    for (const v of ['unfetched', 'UNFETCHED', '', '  ', 'missing', null, 3])
      expect(clean(v)).toBeNull();
    expect(clean('  Muhanga ')).toBe('Muhanga');
  });

  it('upper-cases enums so PRIVATE and Private are one value', () => {
    expect(cleanEnum('Private')).toBe('PRIVATE');
    expect(cleanEnum('Gov Aided')).toBe('GOV_AIDED');
    expect(cleanEnum('unfetched')).toBeNull();
  });
});

describe('ownershipOf', () => {
  it('prefers the ownership band, else maps schoolStatus', () => {
    expect(ownershipOf({ ownership: 'Gov Aided', schoolStatus: 'PRIVATE' })).toBe('Gov Aided');
    expect(ownershipOf({ ownership: null, schoolStatus: 'GOVERNMENT_AIDED' })).toBe('Gov Aided');
    expect(ownershipOf({ ownership: null, schoolStatus: 'Public' })).toBe('Public');
    expect(ownershipOf({ ownership: 'unfetched', schoolStatus: 'unfetched' })).toBeNull();
  });
});

describe('normaliseTdmpSchool (live TDMP rows)', () => {
  it('keeps a normal TVET school and cleans it', () => {
    const r = normaliseTdmpSchool(row('tvetActive'), IGNORE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.school).toMatchObject({
      schoolCode: '270501',
      schoolName: 'ACEJ KARAMA',
      schoolCategory: 'TVET',
      schoolStatus: 'GOVERNMENT_AIDED',
      isActive: 'ACTIVE',
      ownership: 'Gov Aided',
      location: { districtId: 14, districtName: 'Muhanga', provinceName: 'Southern Province' },
    });
    expect(r.school.tradeNames).toEqual(['CSA', 'MAT', 'NIT']);
    expect(r.school.counts).toMatchObject({ students: 1136, teachers: 33 });
  });

  it('turns "unfetched" into unknown instead of storing it', () => {
    const r = normaliseTdmpSchool(row('unfetched'), IGNORE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.school.schoolCategory).toBeNull();
    expect(r.school.isActive).toBeNull();
    expect(r.school.schoolStatus).toBeNull();
  });

  it('normalises mixed-case status to the same value as upper case', () => {
    const r = normaliseTdmpSchool(row('mixedCase'), IGNORE);
    expect(r.ok && r.school.schoolStatus).toBe('PRIVATE');
    expect(r.ok && r.school.ownership).toBe('Private');
  });

  it.each(['testSource', 'manualSeed'] as const)('skips TDMP test rows (%s)', (k) => {
    const r = normaliseTdmpSchool(row(k), IGNORE);
    expect(r).toMatchObject({ ok: false });
    expect(!r.ok && r.reason).toMatch(/test row/);
  });

  it('keeps test rows when no source is ignored', () => {
    expect(normaliseTdmpSchool(row('testSource'), []).ok).toBe(true);
  });

  it('skips a row with no district (cannot be scoped)', () => {
    const r = normaliseTdmpSchool(row('nullActive'), IGNORE);
    expect(r).toEqual({ ok: false, code: '121101', reason: 'no district' });
  });

  it('skips a row with no code', () => {
    const r = normaliseTdmpSchool({ ...row('tvetActive'), schoolCode: ' ' }, IGNORE);
    expect(r).toEqual({ ok: false, code: null, reason: 'no school code' });
  });

  it('keeps the detail-only fields of the detail record', () => {
    const r = normaliseTdmpSchool(fixtures.detail270501, IGNORE);
    expect(r.ok && r.school.establishmentDate).toBe('1984-09-01');
    expect(r.ok && r.school.gpsLat).toBeCloseTo(-2.071518);
  });
});
