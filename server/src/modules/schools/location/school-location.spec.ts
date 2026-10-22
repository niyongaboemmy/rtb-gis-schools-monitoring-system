import { checkPoint, inRwanda, mayReplace } from './school-location.rules';
import { SchoolLocationService } from './school-location.service';

describe('school location rules', () => {
  it('accepts points in Rwanda and rounds to 7 decimals', () => {
    expect(checkPoint('-1.96263541', 30.55333049)).toEqual({
      lat: -1.9626354,
      lng: 30.5533305,
    });
    expect(inRwanda(-1.94, 30.06)).toBe(true);
  });
  it('explains swapped and outside points', () => {
    expect(checkPoint(30.55, -1.96)).toEqual({
      error: expect.stringMatching(/swapped/),
    });
    expect(checkPoint(0, 0)).toEqual({
      error: expect.stringMatching(/outside Rwanda/),
    });
    expect(checkPoint('x', 1)).toEqual({
      error: expect.stringMatching(/numbers/),
    });
  });
  it('applies the precedence: manual and KMZ always, a model only fills gaps, restore never', () => {
    const manual = { source: 'manual' as const, hasPoint: true };
    expect(mayReplace('kmz', manual)).toBe(true);
    expect(mayReplace('manual', { source: 'kmz', hasPoint: true })).toBe(true);
    expect(mayReplace('glb', manual)).toBe(false);
    expect(mayReplace('glb', { source: 'kmz', hasPoint: true })).toBe(false);
    expect(mayReplace('glb', { source: null, hasPoint: false })).toBe(true);
    expect(mayReplace('glb', { source: 'glb', hasPoint: true })).toBe(true);
    expect(mayReplace('restore', { source: null, hasPoint: false })).toBe(
      false,
    );
  });
});

describe('SchoolLocationService.setDerived', () => {
  const make = (school: Record<string, unknown>) => {
    const repo = {
      findOne: jest.fn().mockResolvedValue({ ...school }),
      save: jest.fn((s) => Promise.resolve(s)),
    };
    const audit = { record: jest.fn() };
    const events = { emitSchoolUpdated: jest.fn() };
    return {
      svc: new SchoolLocationService(
        repo as never,
        audit as never,
        events as never,
      ),
      repo,
      audit,
      events,
    };
  };

  it('a KMZ replaces a manual point, stamps the source, audits and notifies', async () => {
    const { svc, repo, audit, events } = make({
      id: 's',
      name: 'S',
      latitude: '-1.9000000',
      longitude: '30.0000000',
      locationSource: 'manual',
    });
    const r = await svc.setDerived(
      's',
      { lat: -1.9626354, lng: 30.5533304, source: 'kml:features' },
      'kmz',
    );
    expect(r.applied).toBe(true);
    expect(repo.save.mock.calls[0][0]).toMatchObject({
      latitude: -1.9626354,
      longitude: 30.5533304,
      locationSource: 'kmz',
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'school.location_update',
        meta: expect.objectContaining({ source: 'kmz' }),
      }),
    );
    expect(events.emitSchoolUpdated).toHaveBeenCalled();
  });

  it('a 3D model or a re-optimise never overrides a person or a KMZ', async () => {
    for (const kind of ['glb', 'restore'] as const) {
      const { svc, repo } = make({
        id: 's',
        latitude: -1.9,
        longitude: 30,
        locationSource: 'kmz',
      });
      expect(
        (await svc.setDerived('s', { lat: -1.95, lng: 30.1 }, kind)).applied,
      ).toBe(false);
      expect(repo.save).not.toHaveBeenCalled();
    }
  });

  it('ignores points outside Rwanda (e.g. a mis-georeferenced file)', async () => {
    const { svc, repo } = make({
      id: 's',
      latitude: 0,
      longitude: 0,
      locationSource: null,
    });
    expect(
      (await svc.setDerived('s', { lat: 48.85, lng: 2.35 }, 'kmz')).reason,
    ).toBe('outside Rwanda');
    expect(repo.save).not.toHaveBeenCalled();
  });
});
