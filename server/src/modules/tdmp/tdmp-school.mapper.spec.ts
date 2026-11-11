import { SchoolStatus, SchoolType } from '../schools/entities/school.entity';
import {
  initialLocation,
  lockedTdmpChanges,
  mapSchoolType,
  mapStatus,
  mapTdmpSchool,
  summariseTeachers,
  TDMP_OWNED_SCHOOL_FIELDS,
  yearOf,
} from './tdmp-school.mapper';
import type { TdmpSchool } from './tdmp.types';

const tdmpSchool = (over: Partial<TdmpSchool> = {}): TdmpSchool => ({
  id: 42,
  schoolCode: '575775',
  tmisSchoolCode: '575775-04',
  schoolName: 'IPRC Musanze',
  institutionType: 'rtb',
  schoolCategory: 'TSS',
  isActive: 'ACTIVE',
  ownership: 'Public',
  location: {
    provinceName: 'Northern',
    districtName: 'Musanze',
    sectorName: 'Muhoza',
    cellName: 'Cyabagarura',
    villageName: 'Kabeza',
  },
  counts: { teachers: 40, students: 900, trades: 5, levels: 3, modules: 60 },
  tradeNames: ['Masonry', 'Plumbing'],
  establishmentDate: '1998-02-01',
  gpsLat: -1.5,
  gpsLong: 29.63,
  ...over,
});

describe('TDMP school mapping', () => {
  it('maps the TDMP-owned columns and never touches GPS', () => {
    const { fields, tdmpData } = mapTdmpSchool({ school: tdmpSchool() });
    expect(fields).toMatchObject({
      code: '575775',
      name: 'IPRC Musanze',
      type: SchoolType.TSS,
      status: SchoolStatus.ACTIVE,
      establishedYear: 1998,
      province: 'Northern',
      district: 'Musanze',
      sector: 'Muhoza',
      cell: 'Cyabagarura',
      village: 'Kabeza',
      totalStudents: 900,
      totalTeachers: 40,
    });
    expect(fields).not.toHaveProperty('latitude');
    expect(fields).not.toHaveProperty('longitude');
    expect(tdmpData).toMatchObject({
      ownership: 'Public',
      trades: ['Masonry', 'Plumbing'],
      counts: { teachers: 40, students: 900 },
      tmisSchoolCode: '575775-04',
    });
    for (const key of Object.keys(fields))
      expect(TDMP_OWNED_SCHOOL_FIELDS).toContain(key);
  });

  it('keeps our value when TDMP leaves a field empty', () => {
    const { fields } = mapTdmpSchool(
      {
        school: tdmpSchool({
          establishmentDate: null,
          counts: null,
          location: { provinceName: 'Northern' },
        }),
      },
      { establishedYear: 2001, totalStudents: 300, district: 'Musanze' },
    );
    expect(fields.establishedYear).toBe(2001);
    expect(fields.totalStudents).toBe(300);
    expect(fields.district).toBe('Musanze');
  });

  it('adds gender splits and the head teacher when fetched', () => {
    const { fields, tdmpData } = mapTdmpSchool({
      school: tdmpSchool(),
      students: { male: 500, female: 400 },
      teachers: [
        { id: 1, gender: 'Male', names: 'Jean Uwimana', isHeadTeacher: true },
        { id: 2, gender: 'F' },
        { id: 3, gender: 'female' },
        { id: 4, gender: null },
      ],
    });
    expect(fields).toMatchObject({
      maleStudents: 500,
      femaleStudents: 400,
      maleTeachers: 1,
      femaleTeachers: 2,
      headTeacher: 'Jean Uwimana',
    });
    expect(tdmpData.staff).toEqual({
      maleTeachers: 1,
      femaleTeachers: 2,
      headTeacher: 'Jean Uwimana',
    });
  });

  it('keeps only the infrastructure groups', () => {
    const { tdmpData } = mapTdmpSchool({
      school: tdmpSchool(),
      infrastructure: {
        schoolCode: '575775',
        buildings: { classrooms: 12 },
        utilities: { hasGridElectricity: true },
      },
    });
    expect(tdmpData.infrastructure).toEqual({
      buildings: { classrooms: 12 },
      utilities: { hasGridElectricity: true },
    });
  });

  it.each([
    ['VTC', SchoolType.VTC],
    ['Vocational Training Centre', SchoolType.VTC],
    ['TSS', SchoolType.TSS],
    ['Technical Secondary School', SchoolType.TSS],
    ['TSS & VTC', SchoolType.INTEGRATED],
    ['Integrated Polytechnic', SchoolType.INTEGRATED],
  ])('school category %s → %s', (category, type) => {
    expect(mapSchoolType(category)).toBe(type);
  });

  it('keeps our type and status when TDMP gives nothing usable', () => {
    expect(mapSchoolType('Others', SchoolType.VTC)).toBe(SchoolType.VTC);
    expect(mapStatus(null, SchoolStatus.UNDER_RENOVATION)).toBe(
      SchoolStatus.UNDER_RENOVATION,
    );
    expect(mapStatus('INACTIVE', SchoolStatus.ACTIVE)).toBe(
      SchoolStatus.INACTIVE,
    );
  });

  it('only accepts plausible establishment years', () => {
    const now = new Date('2026-11-11');
    expect(yearOf('2019-09-01', now)).toBe(2019);
    expect(yearOf('2099-01-01', now)).toBeNull();
    expect(yearOf('1850-01-01', now)).toBeNull();
    expect(yearOf('', now)).toBeNull();
  });

  it('counts only known genders', () => {
    expect(summariseTeachers([{ id: 1, gender: 'x' }])).toEqual({
      maleTeachers: 0,
      femaleTeachers: 0,
      headTeacher: null,
    });
  });

  it('uses TDMP GPS only when it is inside Rwanda', () => {
    expect(initialLocation({ gpsLat: -1.5, gpsLong: 29.63 })).toEqual({
      latitude: -1.5,
      longitude: 29.63,
    });
    expect(initialLocation({ gpsLat: 29.63, gpsLong: -1.5 })).toBeNull();
    expect(initialLocation({ gpsLat: null, gpsLong: null })).toBeNull();
  });

  describe('lockedTdmpChanges', () => {
    const linked = {
      tdmpSchoolCode: '575775',
      name: 'IPRC Musanze',
      totalStudents: 900,
      latitude: -1.5,
    };

    it('refuses changes to TDMP-owned fields of a linked school', () => {
      expect(
        lockedTdmpChanges({ name: 'Other', totalStudents: 900 }, linked),
      ).toEqual(['name']);
    });

    it('allows GPS and unchanged values (the form sends everything)', () => {
      expect(
        lockedTdmpChanges(
          { name: 'IPRC Musanze', totalStudents: '900', latitude: -1.6 },
          linked,
        ),
      ).toEqual([]);
    });

    it('locks nothing on a school that is not linked', () => {
      expect(
        lockedTdmpChanges(
          { name: 'Other' },
          { ...linked, tdmpSchoolCode: null },
        ),
      ).toEqual([]);
    });
  });
});
