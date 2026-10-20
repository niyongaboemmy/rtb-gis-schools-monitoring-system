import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ForbiddenException } from '@nestjs/common';
import {
  CreateSiteFeatureDto,
  LegacySiteAnnotationDto,
  MAX_FEATURE_POINTS,
} from './dto/site-feature.dto';
import {
  csvCell,
  featureToLegacyAnnotation,
  featuresToCsv,
  legacy3dToFeature,
  legacyAnnotationToFeature,
  modelPlanArea,
} from './site-feature.mapping';
import {
  SiteFeaturesService,
  canEditAnyFeature,
  modelOriginOf,
} from './site-features.service';
import { Permission } from '../../common/constants/permissions.constant';
import type { SiteFeature } from './entities/site-feature.entity';

const errs = (cls: any, body: unknown) =>
  validateSync(plainToInstance(cls, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

const line = {
  type: 'LineString',
  coordinates: [
    [30.55, -1.96, 1450],
    [30.551, -1.961, 1452],
  ],
};

describe('CreateSiteFeatureDto validation (WS5.2 / WS9.4)', () => {
  const base = {
    kind: 'measure_distance',
    source: '3d',
    geometry: line,
    value: 12.3,
    unit: 'm',
  };

  it('accepts a valid 3D distance with model coords', () => {
    expect(
      errs(CreateSiteFeatureDto, {
        ...base,
        modelCoords: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 2, z: 3 },
        ],
        color: '#3b82f6',
        properties: { surfaceArea: 3 },
      }),
    ).toHaveLength(0);
  });

  it.each([
    ['unknown kind', { ...base, kind: 'scribble' }],
    ['unknown source', { ...base, source: '4d' }],
    [
      'bad geometry type',
      { ...base, geometry: { type: 'Circle', coordinates: [1, 2] } },
    ],
    [
      'NaN coordinate',
      {
        ...base,
        geometry: {
          type: 'LineString',
          coordinates: [
            [30, NaN],
            [30, -1],
          ],
        },
      },
    ],
    [
      'string coordinate',
      {
        ...base,
        geometry: {
          type: 'LineString',
          coordinates: [
            ['30', -1],
            [30, -1],
          ],
        },
      },
    ],
    [
      'latitude out of range',
      { ...base, geometry: { type: 'Point', coordinates: [30, 95] } },
    ],
    [
      'one-point line',
      { ...base, geometry: { type: 'LineString', coordinates: [[30, -1]] } },
    ],
    [
      'open polygon ring',
      {
        ...base,
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [30, -1],
              [30.1, -1],
              [30, -1.1],
            ],
          ],
        },
      },
    ],
    [
      'too many points',
      {
        ...base,
        geometry: {
          type: 'LineString',
          coordinates: Array.from(
            { length: MAX_FEATURE_POINTS + 1 },
            (_, i) => [30 + i * 1e-6, -1],
          ),
        },
      },
    ],
    ['bad model coord', { ...base, modelCoords: [{ x: 1, y: 'a', z: 0 }] }],
    [
      'extra model-coord key',
      { ...base, modelCoords: [{ x: 1, y: 2, z: 0, evil: 1 }] },
    ],
    ['bad colour', { ...base, color: 'red; drop table' }],
    ['huge properties', { ...base, properties: { blob: 'x'.repeat(5000) } }],
    ['unknown field', { ...base, sneaky: true }],
  ])('rejects %s', (_name, body) => {
    expect(errs(CreateSiteFeatureDto, body).length).toBeGreaterThan(0);
  });
});

describe('LegacySiteAnnotationDto', () => {
  it('accepts what the 2D viewer sent', () => {
    expect(
      errs(LegacySiteAnnotationDto, {
        id: 'meas-1',
        type: 'polygon',
        coordinates: [30, -1, 30.1, -1, 30.1, -1.1, 30, -1],
        label: 'Area',
        title: 'Area',
        style: { color: '#fbbf24' },
        areaSquareMeters: 100,
        footprintCoords: [],
        activeBlock: null,
      }),
    ).toHaveLength(0);
  });

  it('rejects non-numeric coordinates', () => {
    expect(
      errs(LegacySiteAnnotationDto, { type: 'point', coordinates: ['x', 1] })
        .length,
    ).toBeGreaterThan(0);
  });
});

describe('legacy conversions', () => {
  it('maps a 2D area measurement', () => {
    const f = legacyAnnotationToFeature({
      id: 'meas-9',
      type: 'polygon',
      coordinates: [30, -1, 30.001, -1, 30.001, -1.001],
      areaSquareMeters: 12345,
      title: 'Court',
      style: { color: '#fbbf24', iconType: 'flag' },
    })!;
    expect(f.kind).toBe('measure_area');
    expect(f.value).toBe(12345);
    expect(f.geometry.type).toBe('Polygon');
    expect((f.geometry.coordinates as number[][][])[0]).toHaveLength(4); // closed
    expect(f.legacyId).toBe('meas-9');
    expect(f.color).toBe('#fbbf24');
    expect(f.properties).toMatchObject({ icon: 'flag' });
  });

  it('maps a nested-coords 2D note and round-trips to the legacy shape', () => {
    const f = legacyAnnotationToFeature({
      id: 'ann-1',
      type: 'point',
      coordinates: [[30, -1]],
      label: 'Gate',
    })!;
    expect(f.kind).toBe('note');
    expect(f.geometry).toEqual({ type: 'Point', coordinates: [30, -1] });
    const back = featureToLegacyAnnotation({
      ...f,
      id: 'uuid',
      schoolId: 's',
      createdAt: new Date(0),
    } as SiteFeature);
    expect(back).toMatchObject({
      id: 'uuid',
      type: 'point',
      coordinates: [30, -1],
      label: 'Gate',
    });
  });

  it('maps a 3D area measure with plan area and keeps model coords', () => {
    const origin = { lat: -1.96, lng: 30.55, alt: 1400 };
    const pts = [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
      { x: 10, y: 3, z: -4 },
      { x: 0, y: 3, z: -4 },
    ];
    const f = legacy3dToFeature(
      { id: 'abc', mode: 'area', points: pts, result: 50 },
      'measure',
      origin,
      false,
    )!;
    expect(f.kind).toBe('measure_area');
    expect(f.value).toBeCloseTo(40, 9); // plan, not the stored surface value
    expect(f.properties).toMatchObject({ surfaceArea: 50 });
    expect(f.modelCoords).toEqual(pts);
    expect(f.source).toBe('3d');
    const ring = (f.geometry.coordinates as number[][][])[0];
    expect(ring[0][0]).toBeCloseTo(30.55, 6);
    expect(ring[0][2]).toBeCloseTo(1400, 2);
    expect(modelPlanArea(pts)).toBeCloseTo(40, 9);
  });

  it('flags an approximate georeference', () => {
    const f = legacy3dToFeature(
      { id: 'n', point: { x: 1, y: 2, z: 3 }, text: 'hi' },
      'annotation',
      { lat: -2, lng: 30, alt: 0 },
      true,
    )!;
    expect(f.kind).toBe('note');
    expect(f.properties).toEqual({ approximateGeoref: true });
  });

  it('prefers the model origin over the school point', () => {
    expect(
      modelOriginOf({
        modelOriginLat: -1.9,
        modelOriginLng: 30.1,
        modelOriginAlt: 1500,
        latitude: -2,
        longitude: 29,
      }),
    ).toEqual({
      origin: { lat: -1.9, lng: 30.1, alt: 1500 },
      approximate: false,
    });
    expect(modelOriginOf({ latitude: -2, longitude: 29 }).approximate).toBe(
      true,
    );
    expect(modelOriginOf({}).origin).toBeNull();
  });
});

describe('CSV export', () => {
  it('defuses formula injection and quotes', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('-12.5')).toBe('-12.5');
    expect(csvCell('a,b')).toBe('"a,b"');
  });

  it('writes a header and one row per feature', () => {
    const csv = featuresToCsv([
      {
        id: '1',
        kind: 'measure_distance',
        label: 'Fence',
        value: 12.3456,
        unit: 'm',
        source: '2d',
        createdByName: 'Ana',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        description: null,
        geometry: {
          type: 'LineString',
          coordinates: [
            [30, -1],
            [30.001, -1],
          ],
        },
      } as unknown as SiteFeature,
    ]);
    const lines = csv.replace('﻿', '').trim().split('\r\n');
    expect(lines[0]).toMatch(/^id,kind,label,value/);
    expect(lines[1]).toContain('12.3'); // 2D precision
    expect(lines[1]).not.toContain('12.3456');
  });
});

describe('SiteFeaturesService permissions + events', () => {
  const editor = {
    id: 'u2',
    role: {
      name: 'gis_analyst',
      permissions: [Permission.EDIT_SITE_ANNOTATIONS],
    },
  };
  const owner = {
    id: 'u1',
    role: {
      name: 'school_leader',
      permissions: [Permission.SAVE_SITE_FEATURES],
    },
  };
  const other = {
    id: 'u3',
    role: {
      name: 'school_leader',
      permissions: [Permission.SAVE_SITE_FEATURES],
    },
  };

  function make() {
    const feature = {
      id: 'f1',
      schoolId: 's1',
      createdBy: 'u1',
    } as SiteFeature;
    const repo = {
      findOne: jest.fn().mockResolvedValue(feature),
      delete: jest.fn().mockResolvedValue({}),
      save: jest.fn(async (x) => x),
    };
    const events = { emitSiteFeatureChanged: jest.fn() };
    const svc = new SiteFeaturesService(
      repo as any,
      {} as any,
      {} as any,
      events as any,
    );
    return { svc, repo, events };
  }

  it('owner can delete own feature and an event is emitted', async () => {
    const { svc, repo, events } = make();
    await svc.remove('s1', 'f1', owner);
    expect(repo.delete).toHaveBeenCalledWith({ id: 'f1' });
    expect(events.emitSiteFeatureChanged).toHaveBeenCalledWith('s1', {
      schoolId: 's1',
      id: 'f1',
      op: 'deleted',
    });
  });

  it("another user cannot delete someone else's feature", async () => {
    const { svc, repo } = make();
    await expect(svc.remove('s1', 'f1', other)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('EDIT_SITE_ANNOTATIONS can edit any feature', async () => {
    const { svc, events } = make();
    const r = await svc.update('s1', 'f1', { label: 'renamed' }, editor);
    expect(r.label).toBe('renamed');
    expect(events.emitSiteFeatureChanged).toHaveBeenCalledWith('s1', {
      schoolId: 's1',
      id: 'f1',
      op: 'updated',
    });
    expect(canEditAnyFeature({ role: { name: 'Super Admin' } })).toBe(true);
    expect(canEditAnyFeature(other)).toBe(false);
  });
});
