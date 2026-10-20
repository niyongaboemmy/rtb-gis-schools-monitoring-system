import {
  canEditSchoolField,
  filterSchoolUpdate,
} from './school-field-permissions';
import {
  Permission,
  ScopedRolePresets,
} from '../../common/constants/permissions.constant';

const leader = ScopedRolePresets.school_leader.permissions;

describe('school field permissions (WS7.7)', () => {
  it('lets a school leader edit contact, programmes and staff but not location/buildings', () => {
    expect(canEditSchoolField('phone', leader)).toBe(true);
    expect(canEditSchoolField('educationPrograms', leader)).toBe(true);
    expect(canEditSchoolField('maleTeachers', leader)).toBe(true);
    expect(canEditSchoolField('latitude', leader)).toBe(false);
    expect(canEditSchoolField('buildings', leader)).toBe(false);
    expect(canEditSchoolField('name', leader)).toBe(false);
  });

  it('MANAGE_SCHOOLS and super admin unlock everything, unknown fields need MANAGE_SCHOOLS', () => {
    expect(canEditSchoolField('latitude', [Permission.MANAGE_SCHOOLS])).toBe(
      true,
    );
    expect(canEditSchoolField('latitude', [], true)).toBe(true);
    expect(canEditSchoolField('overallScore', leader)).toBe(false);
  });

  it('drops unchanged locked fields and buildings, rejects changed locked fields', () => {
    const current = { latitude: '-1.95', name: 'TSS A', phone: '07' };
    const ok = filterSchoolUpdate(
      { latitude: -1.95, name: 'TSS A', phone: '08', buildings: [] },
      current,
      leader,
    );
    expect(ok.rejected).toEqual([]);
    expect(ok.allowed).toEqual({ phone: '08' });

    const bad = filterSchoolUpdate(
      { latitude: -2.1, phone: '08' },
      current,
      leader,
    );
    expect(bad.rejected).toEqual(['latitude']);
  });

  it('treats null, undefined and empty string as the same empty value', () => {
    const r = filterSchoolUpdate({ address: '' }, { address: null }, leader);
    expect(r.rejected).toEqual([]);
  });
});
