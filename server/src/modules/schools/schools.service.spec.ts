import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SchoolsService } from './schools.service';
import { School } from './entities/school.entity';
import {
  SchoolBuilding,
  BuildingCondition,
  RoofCondition,
} from './entities/school-building.entity';
import { FacilityEntity } from './entities/facility.entity';
import { SchoolFacilitySurvey } from './entities/school-facility-survey.entity';
import { StorageService } from '../storage/storage.service';
import { AuditService } from '../audit/audit.service';
import { BuildingDto } from './dto/building.dto';

// ---------------------------------------------------------------------------
// Test-data factories
// ---------------------------------------------------------------------------

function buildSchool(overrides: Partial<School> = {}): School {
  return {
    id: 'school-uuid-1',
    name: 'Kigali TSS',
    code: 'KGL-001',
    buildings: [],
    boundaries: [],
    populationData: [],
    assessments: [],
    siteAnnotations: [],
    ...overrides,
  } as unknown as School;
}

function buildBuilding(overrides: Partial<SchoolBuilding> = {}): SchoolBuilding {
  return {
    id: 'building-uuid-1',
    schoolId: 'school-uuid-1',
    name: 'Main Block',
    condition: BuildingCondition.GOOD,
    roofCondition: RoofCondition.GOOD,
    annotations: [],
    media: [],
    ...overrides,
  } as unknown as SchoolBuilding;
}

/** Minimal QueryBuilder stub — only the shape used by findAll/getStats. */
function makeQb(result: any = { data: [], count: 0 }) {
  const qb: any = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([result.data ?? [], result.count ?? 0]),
    getRawMany: jest.fn().mockResolvedValue([]),
  };
  return qb;
}

// ---------------------------------------------------------------------------
// Service factory
// ---------------------------------------------------------------------------

interface Repos {
  schoolRepo: Record<string, jest.Mock>;
  buildingRepo: Record<string, jest.Mock>;
  facilityRepo: Record<string, jest.Mock>;
  surveyRepo: Record<string, jest.Mock>;
  storageService: Record<string, jest.Mock>;
  eventEmitter: Record<string, jest.Mock>;
  auditService: Record<string, jest.Mock>;
}

async function makeService(overrides: Partial<Repos> = {}): Promise<{ service: SchoolsService } & Repos> {
  const schoolRepo = {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((v) => ({ ...v })),
    save: jest.fn((v) => Promise.resolve(Array.isArray(v) ? v : { ...v, id: 'school-uuid-1' })),
    remove: jest.fn().mockResolvedValue(undefined),
    count: jest.fn().mockResolvedValue(0),
    createQueryBuilder: jest.fn().mockReturnValue(makeQb()),
    ...overrides.schoolRepo,
  };

  const buildingRepo = {
    findOne: jest.fn(),
    create: jest.fn((v) => ({ ...v, id: 'building-uuid-new' })),
    save: jest.fn((v) =>
      Promise.resolve(
        Array.isArray(v)
          ? v.map((b: any, i: number) => ({ ...b, id: `building-${i}` }))
          : { ...v, id: 'building-uuid-new' },
      ),
    ),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    remove: jest.fn().mockResolvedValue(undefined),
    createQueryBuilder: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    }),
    ...overrides.buildingRepo,
  };

  const facilityRepo = {
    find: jest.fn().mockResolvedValue([]),
    ...overrides.facilityRepo,
  };

  const surveyRepo = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((v) => v),
    save: jest.fn((v) => Promise.resolve(Array.isArray(v) ? v : { ...v })),
    ...overrides.surveyRepo,
  };

  const storageService = {
    deleteDirectory: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    upload: jest.fn().mockResolvedValue('http://mocked/path'),
    getUrl: jest.fn().mockResolvedValue('http://mocked/url'),
    ...overrides.storageService,
  };

  const eventEmitter = {
    emit: jest.fn(),
    ...overrides.eventEmitter,
  };

  const auditService = {
    log: jest.fn(),
    ...overrides.auditService,
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      SchoolsService,
      { provide: getRepositoryToken(School), useValue: schoolRepo },
      { provide: getRepositoryToken(SchoolBuilding), useValue: buildingRepo },
      { provide: getRepositoryToken(FacilityEntity), useValue: facilityRepo },
      { provide: getRepositoryToken(SchoolFacilitySurvey), useValue: surveyRepo },
      { provide: StorageService, useValue: storageService },
      { provide: EventEmitter2, useValue: eventEmitter },
      { provide: AuditService, useValue: auditService },
    ],
  }).compile();

  return {
    service: module.get(SchoolsService),
    schoolRepo,
    buildingRepo,
    facilityRepo,
    surveyRepo,
    storageService,
    eventEmitter,
    auditService,
  };
}

// ---------------------------------------------------------------------------
// §1: create — unique code → school + buildings created
// ---------------------------------------------------------------------------

describe('SchoolsService.create – unique code', () => {
  const createDto = {
    name: 'Kigali TSS',
    code: 'KGL-001',
    province: 'Kigali',
    district: 'Gasabo',
    buildings: [
      {
        name: 'Main Block',
        code: 'B01',
        area: 500,
        condition: BuildingCondition.GOOD,
        roofCondition: RoofCondition.GOOD,
        latitude: -1.94,
        longitude: 30.06,
        annotations: [],
        media: [],
      },
    ],
  } as any;

  it('returns the saved school (as returned by findOne at the end)', async () => {
    const fullSchool = buildSchool({ buildings: [buildBuilding()] });
    const { service, schoolRepo } = await makeService();

    // Duplicate-code check: null → no conflict
    schoolRepo.findOne.mockResolvedValueOnce(null);
    // Final this.findOne(savedSchool.id) → full school with relations
    schoolRepo.findOne.mockResolvedValueOnce(fullSchool);

    const result = await service.create(createDto);

    expect(result).toBe(fullSchool);
  });

  it('saves the school entity without buildings in the school table', async () => {
    const fullSchool = buildSchool();
    const { service, schoolRepo } = await makeService();

    schoolRepo.findOne.mockResolvedValueOnce(null);
    schoolRepo.findOne.mockResolvedValueOnce(fullSchool);

    await service.create(createDto);

    // schoolRepository.create should receive schoolData without `buildings` key
    const createArg = schoolRepo.create.mock.calls[0][0];
    expect(createArg).not.toHaveProperty('buildings');
    expect(createArg.code).toBe('KGL-001');
  });

  it('creates and saves each building with correct field mappings', async () => {
    const fullSchool = buildSchool({ buildings: [buildBuilding()] });
    const { service, schoolRepo, buildingRepo } = await makeService();

    schoolRepo.findOne.mockResolvedValueOnce(null);
    schoolRepo.findOne.mockResolvedValueOnce(fullSchool);

    await service.create(createDto);

    // buildingRepo.create called once per building
    expect(buildingRepo.create).toHaveBeenCalledTimes(1);

    const buildingArg = buildingRepo.create.mock.calls[0][0];
    expect(buildingArg.buildingCode).toBe('B01');
    expect(buildingArg.areaSquareMeters).toBe(500);
    expect(buildingArg.centroidLat).toBe(-1.94);
    expect(buildingArg.centroidLng).toBe(30.06);
    expect(buildingArg.condition).toBe(BuildingCondition.GOOD);
    expect(buildingArg.roofCondition).toBe(RoofCondition.GOOD);

    // buildingRepo.save called once with the array of created buildings
    expect(buildingRepo.save).toHaveBeenCalledTimes(1);
    expect(Array.isArray(buildingRepo.save.mock.calls[0][0])).toBe(true);
  });

  it('skips building creation when buildings array is empty', async () => {
    const fullSchool = buildSchool();
    const { service, schoolRepo, buildingRepo } = await makeService();

    schoolRepo.findOne.mockResolvedValueOnce(null);
    schoolRepo.findOne.mockResolvedValueOnce(fullSchool);

    await service.create({ ...createDto, buildings: [] } as any);

    expect(buildingRepo.create).not.toHaveBeenCalled();
    expect(buildingRepo.save).not.toHaveBeenCalled();
  });

  it('skips building creation when buildings is undefined', async () => {
    const { name, code, province, district } = createDto;
    const fullSchool = buildSchool();
    const { service, schoolRepo, buildingRepo } = await makeService();

    schoolRepo.findOne.mockResolvedValueOnce(null);
    schoolRepo.findOne.mockResolvedValueOnce(fullSchool);

    await service.create({ name, code, province, district } as any);

    expect(buildingRepo.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// §2: create — duplicate code → ConflictException
// ---------------------------------------------------------------------------

describe('SchoolsService.create – duplicate code', () => {
  it('throws ConflictException when school code already exists', async () => {
    const existing = buildSchool();
    const { service, schoolRepo } = await makeService();

    // mockResolvedValue (not Once) so repeated assertions don't exhaust the queue
    schoolRepo.findOne.mockResolvedValue(existing);

    await expect(
      service.create({ name: 'Other School', code: 'KGL-001' } as any),
    ).rejects.toThrow(ConflictException);
  });

  it('throws with the duplicate-code message', async () => {
    const existing = buildSchool();
    const { service, schoolRepo } = await makeService();

    schoolRepo.findOne.mockResolvedValue(existing);

    await expect(
      service.create({ name: 'Other School', code: 'KGL-001' } as any),
    ).rejects.toThrow('School with code "KGL-001" already exists');
  });

  it('does NOT persist anything when the code is a duplicate', async () => {
    const existing = buildSchool();
    const { service, schoolRepo, buildingRepo } = await makeService();

    schoolRepo.findOne.mockResolvedValue(existing);

    await expect(service.create({ code: 'KGL-001' } as any)).rejects.toThrow();

    expect(schoolRepo.save).not.toHaveBeenCalled();
    expect(buildingRepo.create).not.toHaveBeenCalled();
    expect(buildingRepo.save).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// §3: update — buildings provided → delete-then-recreate
// ---------------------------------------------------------------------------

describe('SchoolsService.update – buildings array provided', () => {
  const updateDto = {
    name: 'Updated School',
    buildings: [
      {
        name: 'New Block',
        code: 'B02',
        area: 300,
        condition: BuildingCondition.FAIR,
        roofCondition: RoofCondition.FAIR,
        annotations: [],
        media: [],
      },
    ],
  } as any;

  it('deletes existing buildings for the school before creating new ones', async () => {
    const school = buildSchool();
    const updatedSchool = buildSchool({ name: 'Updated School', buildings: [buildBuilding()] });
    const { service, schoolRepo, buildingRepo } = await makeService();

    // this.findOne at start of update
    schoolRepo.findOne.mockResolvedValueOnce(school);
    // this.findOne at end of update
    schoolRepo.findOne.mockResolvedValueOnce(updatedSchool);

    await service.update('school-uuid-1', updateDto);

    expect(buildingRepo.delete).toHaveBeenCalledWith({ schoolId: 'school-uuid-1' });
  });

  it('creates and persists each new building after deletion', async () => {
    const school = buildSchool();
    const updatedSchool = buildSchool({ buildings: [buildBuilding()] });
    const { service, schoolRepo, buildingRepo } = await makeService();

    schoolRepo.findOne.mockResolvedValueOnce(school);
    schoolRepo.findOne.mockResolvedValueOnce(updatedSchool);

    await service.update('school-uuid-1', updateDto);

    expect(buildingRepo.create).toHaveBeenCalledTimes(1);

    const buildingArg = buildingRepo.create.mock.calls[0][0];
    expect(buildingArg.buildingCode).toBe('B02');
    expect(buildingArg.areaSquareMeters).toBe(300);
    expect(buildingArg.condition).toBe(BuildingCondition.FAIR);
    expect(buildingArg.schoolId).toBe('school-uuid-1');

    expect(buildingRepo.save).toHaveBeenCalledTimes(1);
  });

  it('returns the school fetched by the second findOne call', async () => {
    const school = buildSchool();
    const updatedSchool = buildSchool({ name: 'Updated School' });
    const { service, schoolRepo } = await makeService();

    schoolRepo.findOne.mockResolvedValueOnce(school);
    schoolRepo.findOne.mockResolvedValueOnce(updatedSchool);

    const result = await service.update('school-uuid-1', updateDto);

    expect(result).toBe(updatedSchool);
  });

  it('deletes buildings then skips save when buildings array is empty ([])', async () => {
    const school = buildSchool();
    const updatedSchool = buildSchool({ buildings: [] });
    const { service, schoolRepo, buildingRepo } = await makeService();

    schoolRepo.findOne.mockResolvedValueOnce(school);
    schoolRepo.findOne.mockResolvedValueOnce(updatedSchool);

    await service.update('school-uuid-1', { buildings: [] } as any);

    // delete IS called (buildings key was present, even though empty)
    expect(buildingRepo.delete).toHaveBeenCalledWith({ schoolId: 'school-uuid-1' });
    // save is NOT called because the new array is empty
    expect(buildingRepo.save).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// §4: update — buildings undefined → leave existing buildings intact
// ---------------------------------------------------------------------------

describe('SchoolsService.update – buildings undefined (not provided)', () => {
  it('does NOT touch the building repository when buildings key is absent', async () => {
    const school = buildSchool();
    const updatedSchool = buildSchool({ name: 'Renamed School' });
    const { service, schoolRepo, buildingRepo } = await makeService();

    schoolRepo.findOne.mockResolvedValueOnce(school);
    schoolRepo.findOne.mockResolvedValueOnce(updatedSchool);

    // DTO has no `buildings` property → undefined
    await service.update('school-uuid-1', { name: 'Renamed School' } as any);

    expect(buildingRepo.delete).not.toHaveBeenCalled();
    expect(buildingRepo.create).not.toHaveBeenCalled();
    expect(buildingRepo.save).not.toHaveBeenCalled();
  });

  it('still saves the school-level field changes', async () => {
    const school = buildSchool();
    const updatedSchool = buildSchool({ name: 'Renamed School' });
    const { service, schoolRepo } = await makeService();

    schoolRepo.findOne.mockResolvedValueOnce(school);
    schoolRepo.findOne.mockResolvedValueOnce(updatedSchool);

    await service.update('school-uuid-1', { name: 'Renamed School' } as any);

    expect(schoolRepo.save).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// §5: addBuilding — annotation safety filter
// ---------------------------------------------------------------------------

describe('SchoolsService.addBuilding – annotation filter (no nested arrays → no DB crash)', () => {
  const schoolId = 'school-uuid-1';

  it('strips null entries from annotations before persisting', async () => {
    const { service, buildingRepo } = await makeService();

    const dto: BuildingDto = {
      name: 'Block C',
      annotations: [
        { id: 'a1', type: 'text', content: 'valid annotation', createdAt: '2024-01-01' },
        null,
        null,
      ] as any,
    } as any;

    await service.addBuilding(schoolId, dto);

    const createArg = buildingRepo.create.mock.calls[0][0];
    expect(createArg.annotations).toHaveLength(1);
    expect(createArg.annotations[0].id).toBe('a1');
  });

  it('strips nested array entries from annotations before persisting', async () => {
    const { service, buildingRepo } = await makeService();

    const dto: BuildingDto = {
      name: 'Block D',
      annotations: [
        { id: 'a1', type: 'point', content: 'valid', createdAt: '2024-01-01' },
        [{ id: 'nested', type: 'text', content: 'wrapped in array', createdAt: '2024-01-01' }],
        { id: 'a2', type: 'text', content: 'also valid', createdAt: '2024-01-01' },
      ] as any,
    } as any;

    await service.addBuilding(schoolId, dto);

    const createArg = buildingRepo.create.mock.calls[0][0];
    // The nested array is filtered out; only 'a1' and 'a2' survive
    expect(createArg.annotations).toHaveLength(2);
    expect(createArg.annotations.map((a: any) => a.id)).toEqual(['a1', 'a2']);
    // Confirm no entry is itself an array
    createArg.annotations.forEach((a: any) => expect(Array.isArray(a)).toBe(false));
  });

  it('strips mixed nulls + nested arrays, preserving only plain objects', async () => {
    const { service, buildingRepo } = await makeService();

    const dto: BuildingDto = {
      name: 'Block E',
      annotations: [
        null,
        [{ id: 'nested' }],
        { id: 'valid-1', type: 'text', content: 'x', createdAt: '2024-01-01' },
        undefined,
        [{ id: 'nested-2' }],
        { id: 'valid-2', type: 'polygon', content: 'y', createdAt: '2024-01-01' },
      ] as any,
    } as any;

    await service.addBuilding(schoolId, dto);

    const createArg = buildingRepo.create.mock.calls[0][0];
    expect(createArg.annotations).toHaveLength(2);
    expect(createArg.annotations[0].id).toBe('valid-1');
    expect(createArg.annotations[1].id).toBe('valid-2');
  });

  it('treats empty annotations as an empty array (no crash on falsy input)', async () => {
    const { service, buildingRepo } = await makeService();

    const dto: BuildingDto = { name: 'Block F' } as any;

    await service.addBuilding(schoolId, dto);

    const createArg = buildingRepo.create.mock.calls[0][0];
    expect(createArg.annotations).toEqual([]);
  });

  it('applies the same filter to media entries', async () => {
    const { service, buildingRepo } = await makeService();

    const dto: BuildingDto = {
      name: 'Block G',
      media: [
        { id: 'm1', path: '/img/1.jpg', type: 'image', title: 'Front', createdAt: '2024-01-01' },
        null,
        [{ id: 'nested-media' }],
        { id: 'm2', path: '/img/2.jpg', type: 'image', title: 'Back', createdAt: '2024-01-01' },
      ] as any,
    } as any;

    await service.addBuilding(schoolId, dto);

    const createArg = buildingRepo.create.mock.calls[0][0];
    expect(createArg.media).toHaveLength(2);
    expect(createArg.media.map((m: any) => m.id)).toEqual(['m1', 'm2']);
  });

  it('maps DTO fields to entity field names correctly', async () => {
    const { service, buildingRepo } = await makeService();

    const dto: BuildingDto = {
      name: 'Block H',
      code: 'BH-01',
      area: 750,
      condition: BuildingCondition.POOR,
      roofCondition: RoofCondition.NEEDS_REPAIR,
      latitude: -2.0,
      longitude: 29.5,
    } as any;

    await service.addBuilding(schoolId, dto);

    const createArg = buildingRepo.create.mock.calls[0][0];
    expect(createArg.buildingCode).toBe('BH-01');
    expect(createArg.areaSquareMeters).toBe(750);
    expect(createArg.centroidLat).toBe(-2.0);
    expect(createArg.centroidLng).toBe(29.5);
    expect(createArg.condition).toBe(BuildingCondition.POOR);
    expect(createArg.roofCondition).toBe(RoofCondition.NEEDS_REPAIR);
    expect(createArg.schoolId).toBe(schoolId);
  });
});

// ---------------------------------------------------------------------------
// §6: remove — storage cleanup called before DB deletion
// ---------------------------------------------------------------------------

describe('SchoolsService.remove', () => {
  it('calls storageService.deleteDirectory with the correct schools/ path', async () => {
    const school = buildSchool({ id: 'school-uuid-42' });
    const { service, schoolRepo, storageService } = await makeService();

    schoolRepo.findOne.mockResolvedValueOnce(school);

    await service.remove('school-uuid-42');

    expect(storageService.deleteDirectory).toHaveBeenCalledWith('schools/school-uuid-42');
  });

  it('calls schoolRepository.remove with the found school after storage cleanup', async () => {
    const school = buildSchool({ id: 'school-uuid-42' });
    const { service, schoolRepo } = await makeService();

    schoolRepo.findOne.mockResolvedValueOnce(school);

    await service.remove('school-uuid-42');

    expect(schoolRepo.remove).toHaveBeenCalledWith(school);
  });

  it('deletes storage BEFORE removing the DB row (call order)', async () => {
    const school = buildSchool({ id: 'school-uuid-42' });
    const callOrder: string[] = [];
    const { service, schoolRepo, storageService } = await makeService();

    schoolRepo.findOne.mockResolvedValueOnce(school);
    (storageService.deleteDirectory as jest.Mock).mockImplementation(async () => {
      callOrder.push('deleteDirectory');
    });
    (schoolRepo.remove as jest.Mock).mockImplementation(async () => {
      callOrder.push('remove');
    });

    await service.remove('school-uuid-42');

    expect(callOrder).toEqual(['deleteDirectory', 'remove']);
  });

  it('throws NotFoundException when the school does not exist', async () => {
    const { service, schoolRepo } = await makeService();

    schoolRepo.findOne.mockResolvedValue(null);

    await expect(service.remove('missing-id')).rejects.toThrow(NotFoundException);
  });

  it('throws with the correct not-found message', async () => {
    const { service, schoolRepo } = await makeService();

    schoolRepo.findOne.mockResolvedValue(null);

    await expect(service.remove('missing-id')).rejects.toThrow(
      'School with ID "missing-id" not found',
    );
  });

  it('does NOT call deleteDirectory when the school is not found', async () => {
    const { service, schoolRepo, storageService } = await makeService();

    schoolRepo.findOne.mockResolvedValue(null);

    await expect(service.remove('missing-id')).rejects.toThrow();

    expect(storageService.deleteDirectory).not.toHaveBeenCalled();
  });

  it('calls auditService.log with school.delete action after successful removal', async () => {
    const school = buildSchool({ id: 'school-uuid-42', name: 'Kigali TSS', code: 'KGL-001' });
    const { service, schoolRepo, auditService } = await makeService();
    const actor = { id: 'user-1', email: 'admin@rtb.gov.rw' };

    schoolRepo.findOne.mockResolvedValueOnce(school);

    await service.remove('school-uuid-42', actor);

    expect(auditService.log).toHaveBeenCalledWith(
      actor,
      'school.delete',
      'school',
      'school-uuid-42',
      { name: 'Kigali TSS', code: 'KGL-001' },
    );
  });

  it('calls auditService.log with null actor when no actor is provided', async () => {
    const school = buildSchool({ id: 'school-uuid-42' });
    const { service, schoolRepo, auditService } = await makeService();

    schoolRepo.findOne.mockResolvedValueOnce(school);

    await service.remove('school-uuid-42');

    expect(auditService.log).toHaveBeenCalledWith(
      null,
      'school.delete',
      'school',
      'school-uuid-42',
      expect.any(Object),
    );
  });

  it('does NOT call auditService.log when school is not found', async () => {
    const { service, schoolRepo, auditService } = await makeService();
    schoolRepo.findOne.mockResolvedValue(null);

    await expect(service.remove('missing-id')).rejects.toThrow();

    expect(auditService.log).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// §7: findOne — NotFoundException propagation
// ---------------------------------------------------------------------------

describe('SchoolsService.findOne', () => {
  it('returns the school when found', async () => {
    const school = buildSchool();
    const { service, schoolRepo } = await makeService();

    schoolRepo.findOne.mockResolvedValueOnce(school);

    const result = await service.findOne('school-uuid-1');
    expect(result).toBe(school);
    expect(schoolRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'school-uuid-1' },
      relations: ['buildings', 'boundaries', 'populationData', 'assessments'],
    });
  });

  it('throws NotFoundException when school does not exist', async () => {
    const { service, schoolRepo } = await makeService();

    schoolRepo.findOne.mockResolvedValue(null);

    await expect(service.findOne('nonexistent-id')).rejects.toThrow(NotFoundException);
  });

  it('throws with the correct not-found message', async () => {
    const { service, schoolRepo } = await makeService();

    schoolRepo.findOne.mockResolvedValue(null);

    await expect(service.findOne('nonexistent-id')).rejects.toThrow(
      'School with ID "nonexistent-id" not found',
    );
  });
});
