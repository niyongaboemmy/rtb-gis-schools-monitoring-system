import { ConflictException } from '@nestjs/common';
import { TdmpSyncService } from './tdmp-sync.service';
import type { TdmpSchool } from './tdmp.types';
import type { School } from '../schools/entities/school.entity';

const tdmpSchool = (over: Partial<TdmpSchool> = {}): TdmpSchool => ({
  id: 42,
  schoolCode: '575775',
  schoolName: 'IPRC Musanze',
  schoolCategory: 'TSS',
  isActive: 'ACTIVE',
  location: {
    provinceName: 'Northern',
    districtName: 'Musanze',
    sectorName: 'Muhoza',
  },
  counts: { students: 900, teachers: 40 },
  gpsLat: -1.5,
  gpsLong: 29.63,
  ...over,
});

function setup() {
  const schools = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((v: Partial<School>) => ({ ...v })),
    save: jest.fn(async (v: Partial<School>) => ({
      id: v.id ?? 'new-id',
      ...v,
    })),
    update: jest.fn(),
  };
  const events = { emit: jest.fn() };
  const service = new TdmpSyncService(
    schools as never,
    {} as never,
    {} as never,
    { syncEnabled: true } as never,
    events as never,
    {} as never,
    { record: jest.fn() } as never,
  );
  return { service, schools, events };
}

describe('TdmpSyncService.apply', () => {
  it('skips a new school TDMP has no GPS for', async () => {
    const { service, schools } = setup();
    const outcome = await service.apply({
      school: tdmpSchool({ gpsLat: null, gpsLong: null }),
    });
    expect(outcome).toBe('skippedNoGps');
    expect(schools.save).not.toHaveBeenCalled();
  });

  it('creates a new school at TDMP GPS, marked as such', async () => {
    const { service, schools, events } = setup();
    const outcome = await service.apply({ school: tdmpSchool() });
    expect(outcome).toBe('created');
    expect(schools.save).toHaveBeenCalledWith(
      expect.objectContaining({
        code: '575775',
        name: 'IPRC Musanze',
        latitude: -1.5,
        longitude: 29.63,
        locationSource: 'tdmp',
        tdmpSchoolCode: '575775',
        tdmpSchoolId: 42,
      }),
    );
    expect(events.emit).toHaveBeenCalledWith('school.updated', {
      schoolId: 'new-id',
    });
  });

  it('links an existing school with the same code and keeps our GPS', async () => {
    const { service, schools } = setup();
    const local = {
      id: 'local-1',
      code: '575775',
      name: 'Old name',
      latitude: -1.49,
      longitude: 29.6,
      locationSource: 'kmz',
      tdmpSchoolCode: null,
    };
    schools.findOne
      .mockResolvedValueOnce(null) // by TDMP link
      .mockResolvedValueOnce(local) // unlinked, same code
      .mockResolvedValueOnce(null); // no code clash
    const outcome = await service.apply({ school: tdmpSchool() });
    expect(outcome).toBe('linked');
    const saved = schools.save.mock.calls[0][0];
    expect(saved).toMatchObject({
      id: 'local-1',
      name: 'IPRC Musanze',
      latitude: -1.49,
      longitude: 29.6,
      locationSource: 'kmz',
      tdmpSchoolCode: '575775',
    });
  });

  it('only stamps the sync time when nothing changed', async () => {
    const { service, schools, events } = setup();
    const first = setup();
    await first.service.apply({ school: tdmpSchool() });
    const stored = { ...first.schools.save.mock.calls[0][0], id: 'linked-1' };
    schools.findOne.mockResolvedValueOnce(stored).mockResolvedValueOnce(null);
    const outcome = await service.apply({ school: tdmpSchool() });
    expect(outcome).toBe('unchanged');
    expect(schools.save).not.toHaveBeenCalled();
    expect(schools.update).toHaveBeenCalledWith('linked-1', {
      tdmpSyncedAt: expect.any(Date),
    });
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('refuses when another school already uses the TDMP code', async () => {
    const { service, schools } = setup();
    schools.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'other', name: 'Other school' });
    await expect(service.apply({ school: tdmpSchool() })).rejects.toThrow(
      ConflictException,
    );
  });
});
