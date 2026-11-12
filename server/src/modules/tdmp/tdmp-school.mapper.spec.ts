import fixtures from './__fixtures__';
import {
  changedFields,
  hashBundle,
  initialLocation,
  lockedTdmpChanges,
  mapSchoolType,
  mapStatus,
  mapTdmpSchool,
  TDMP_OWNED_SCHOOL_FIELDS,
  touchesScoring,
  yearOf,
} from './tdmp-school.mapper';
import { normaliseTdmpSchool } from './tdmp-school.normalise';
import {
  SchoolStatus,
  SchoolType,
  type School,
} from '../schools/entities/school.entity';
import type { TdmpSchool } from './tdmp.types';

/** A live TDMP row, normalised like the sync does. */
function live(k: keyof typeof fixtures.list, over: Partial<TdmpSchool> = {}) {
  const r = normaliseTdmpSchool({
    ...(fixtures.list[k]),
    ...over,
  });
  if (!r.ok) throw new Error(r.reason);
  return r.school;
}

describe('mapSchoolType', () => {
  it('takes the type from the categoryBand sweep', () => {
    expect(mapSchoolType('TSS')).toEqual({ type: SchoolType.TSS, unverified: false });
    expect(mapSchoolType('VTC', SchoolType.TSS)).toEqual({ type: SchoolType.VTC, unverified: false });
  });

  it('keeps our type when TDMP has no band, flagged unverified', () => {
    expect(mapSchoolType(null, SchoolType.INTEGRATED)).toEqual({
      type: SchoolType.INTEGRATED,
      unverified: true,
    });
    expect(mapSchoolType(undefined)).toEqual({ type: SchoolType.TSS, unverified: true });
  });
});

describe('mapStatus', () => {
  it('INACTIVE always wins', () => {
    expect(mapStatus('INACTIVE', SchoolStatus.UNDER_RENOVATION)).toBe(SchoolStatus.INACTIVE);
  });

  it('ACTIVE keeps our under_renovation', () => {
    expect(mapStatus('ACTIVE', SchoolStatus.UNDER_RENOVATION)).toBe(SchoolStatus.UNDER_RENOVATION);
    expect(mapStatus('ACTIVE', SchoolStatus.INACTIVE)).toBe(SchoolStatus.ACTIVE);
  });

  it('unknown keeps ours', () => {
    expect(mapStatus(null, SchoolStatus.INACTIVE)).toBe(SchoolStatus.INACTIVE);
    expect(mapStatus(undefined)).toBe(SchoolStatus.ACTIVE);
  });
});

describe('yearOf', () => {
  it('reads plausible years only', () => {
    expect(yearOf('1984-09-01')).toBe(1984);
    expect(yearOf('3000-01-01')).toBeNull();
    expect(yearOf(null)).toBeNull();
  });
});

describe('mapTdmpSchool (live TDMP rows)', () => {
  it('maps profile, location ids, ownership and totals', () => {
    const { fields, tdmpData } = mapTdmpSchool({ school: live('tvetActive'), band: 'TSS' });
    expect(fields).toMatchObject({
      code: '270501',
      name: 'ACEJ KARAMA',
      type: SchoolType.TSS,
      status: SchoolStatus.ACTIVE,
      province: 'Southern Province',
      district: 'Muhanga',
      sector: 'Muhanga',
      cell: 'Nganzo',
      village: 'Kamazu',
      provinceId: 2,
      districtId: 14,
      sectorId: 192,
      cellId: 950,
      villageId: 6877,
      ownership: 'Gov Aided',
      totalStudents: 1136,
      totalTeachers: 33,
    });
    expect(tdmpData).toMatchObject({
      band: 'TSS',
      typeUnverified: false,
      tmisSchoolCode: '27050205-03',
      trades: ['CSA', 'MAT', 'NIT'],
      missingFromTdmp: false,
      missingRuns: 0,
    });
    expect(tdmpData.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('takes the year established from the detail record', () => {
    const detail = normaliseTdmpSchool(fixtures.detail270501);
    if (!detail.ok) throw new Error('fixture');
    const { fields, tdmpData } = mapTdmpSchool({ school: detail.school, band: 'TSS' });
    expect(fields.establishedYear).toBe(1984);
    expect(tdmpData.establishmentDate).toBe('1984-09-01');
  });

  it('never imports infrastructure or staff', () => {
    const { tdmpData } = mapTdmpSchool({ school: live('tvetActive') });
    expect(tdmpData).not.toHaveProperty('infrastructure');
    expect(tdmpData).not.toHaveProperty('staff');
  });

  it('keeps our values where TDMP says nothing ("unfetched")', () => {
    const current: Partial<School> = {
      status: SchoolStatus.UNDER_RENOVATION,
      establishedYear: 1990,
      ownership: 'Public',
      type: SchoolType.VTC,
    };
    const { fields } = mapTdmpSchool({ school: live('unfetched'), band: null }, current);
    expect(fields.status).toBe(SchoolStatus.UNDER_RENOVATION);
    expect(fields.establishedYear).toBe(1990);
    expect(fields.type).toBe(SchoolType.VTC);
    expect(fields.ownership).toBe('Others');
  });

  it('marks an INACTIVE school inactive', () => {
    const { fields } = mapTdmpSchool({ school: live('inactive') }, { status: SchoolStatus.ACTIVE });
    expect(fields.status).toBe(SchoolStatus.INACTIVE);
  });
});

describe('hashBundle', () => {
  it('is stable for the same record and changes with it', () => {
    const a = hashBundle({ school: live('tvetActive'), band: 'TSS' });
    expect(hashBundle({ school: live('tvetActive'), band: 'TSS' })).toBe(a);
    expect(hashBundle({ school: live('tvetActive'), band: 'VTC' })).not.toBe(a);
    expect(
      hashBundle({ school: live('tvetActive', { counts: { students: 1137 } }), band: 'TSS' }),
    ).not.toBe(a);
  });
});

describe('touchesScoring', () => {
  it('only scoring inputs trigger a rescore', () => {
    expect(touchesScoring(['name', 'village', 'ownership'])).toBe(false);
    expect(touchesScoring(['name', 'totalStudents'])).toBe(true);
    expect(touchesScoring(['status'])).toBe(true);
  });
});

describe('ownership of fields', () => {
  it('does not lock fields TDMP does not send yet', () => {
    for (const f of ['maleStudents', 'femaleStudents', 'maleTeachers', 'femaleTeachers', 'headTeacher', 'latitude', 'longitude'])
      expect(TDMP_OWNED_SCHOOL_FIELDS as readonly string[]).not.toContain(f);
  });

  it('rejects changes to owned fields on linked schools only', () => {
    const linked = { tdmpSchoolCode: '270501', name: 'ACEJ KARAMA', totalStudents: 10 };
    expect(lockedTdmpChanges({ name: 'X', totalStudents: 10, phone: '1' }, linked)).toEqual(['name']);
    expect(lockedTdmpChanges({ name: 'X' }, { name: 'Y' })).toEqual([]);
  });

  it('changedFields compares loosely (numbers vs strings, empty vs null)', () => {
    expect(changedFields({ totalStudents: 5, cell: '' }, { totalStudents: '5' as never, cell: null as never })).toEqual([]);
  });
});

describe('initialLocation', () => {
  it('uses TDMP GPS only inside Rwanda', () => {
    expect(initialLocation({ gpsLat: -2.071518, gpsLong: 29.726629 })).toEqual({ latitude: -2.071518, longitude: 29.726629 });
    expect(initialLocation({ gpsLat: 29.7, gpsLong: -2.07 })).toBeNull();
    expect(initialLocation({ gpsLat: null, gpsLong: null })).toBeNull();
  });
});
