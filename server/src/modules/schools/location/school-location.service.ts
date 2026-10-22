import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { School } from '../entities/school.entity';
import { AuditService } from '../../audit/audit.service';
import { EventsGateway } from '../../events/events.gateway';
import {
  checkPoint,
  inRwanda,
  mayReplace,
  round7,
  type LocationSource,
} from './school-location.rules';

export interface LocationActor {
  id?: string | null;
  email?: string | null;
}

export interface LocationResult {
  applied: boolean;
  reason?: string;
  latitude?: number;
  longitude?: number;
  source?: LocationSource;
}

/**
 * The single way to change a school's location. Validates the point
 * (inside Rwanda, not swapped), applies the precedence rules, stamps where it
 * came from and when, writes one audit row, and tells open viewers.
 */
@Injectable()
export class SchoolLocationService {
  private readonly logger = new Logger(SchoolLocationService.name);

  constructor(
    @InjectRepository(School) private readonly schools: Repository<School>,
    @Optional() private readonly audit?: AuditService,
    @Optional() private readonly events?: EventsGateway,
  ) {}

  /** A person's edit (form, map pin): refused with a 400 when the point is wrong. */
  async setManual(
    schoolId: string,
    lat: unknown,
    lng: unknown,
    actor?: LocationActor | null,
  ): Promise<LocationResult> {
    const p = checkPoint(lat, lng);
    if ('error' in p) throw new BadRequestException(p.error);
    return this.apply(schoolId, p.lat, p.lng, 'manual', actor ?? null);
  }

  /**
   * A location read from an uploaded file. Never throws: a point outside
   * Rwanda, or one the rules don't allow, is skipped and logged.
   */
  async setDerived(
    schoolId: string,
    point: { lat: number; lng: number; source?: string } | null,
    kind: 'kmz' | 'glb' | 'restore',
  ): Promise<LocationResult> {
    if (!point) return { applied: false, reason: 'no point in the file' };
    if (!inRwanda(point.lat, point.lng)) {
      this.logger.warn(
        `School ${schoolId}: ${kind} location ${point.lat},${point.lng} (${point.source ?? '?'}) is outside Rwanda — ignored`,
      );
      return { applied: false, reason: 'outside Rwanda' };
    }
    try {
      return await this.apply(
        schoolId,
        round7(point.lat),
        round7(point.lng),
        kind,
        null,
        point.source,
      );
    } catch (err) {
      this.logger.warn(
        `School ${schoolId}: could not set ${kind} location: ${(err as Error).message}`,
      );
      return { applied: false, reason: 'error' };
    }
  }

  private async apply(
    schoolId: string,
    lat: number,
    lng: number,
    incoming: LocationSource | 'restore',
    actor: LocationActor | null,
    detail?: string,
  ): Promise<LocationResult> {
    const school = await this.schools.findOne({
      where: { id: schoolId },
      select: [
        'id',
        'name',
        'latitude',
        'longitude',
        'locationSource',
        'locationUpdatedAt',
      ],
    });
    if (!school) throw new NotFoundException('School not found');

    const curLat = Number(school.latitude);
    const curLng = Number(school.longitude);
    const hasPoint = inRwanda(curLat, curLng);
    if (
      !mayReplace(incoming, { source: school.locationSource ?? null, hasPoint })
    ) {
      return {
        applied: false,
        reason: `kept the ${school.locationSource ?? 'existing'} location`,
      };
    }
    const source = incoming as LocationSource;
    const same = round7(curLat) === lat && round7(curLng) === lng;
    if (same && school.locationSource === source) {
      return {
        applied: false,
        reason: 'unchanged',
        latitude: lat,
        longitude: lng,
        source,
      };
    }

    school.latitude = lat;
    school.longitude = lng;
    school.locationSource = source;
    school.locationUpdatedAt = new Date();
    await this.schools.save(school);

    this.audit?.record({
      action: 'school.location_update',
      actor: actor
        ? { id: actor.id ?? null, email: actor.email ?? null }
        : null,
      targetType: 'school',
      targetId: schoolId,
      targetLabel: school.name,
      changes: same
        ? null
        : { latitude: [curLat, lat], longitude: [curLng, lng] },
      meta: { source, ...(detail ? { detail } : {}) },
    });
    this.events?.emitSchoolUpdated(schoolId, {
      schoolId,
      fields: ['latitude', 'longitude'],
      latitude: lat,
      longitude: lng,
      locationSource: source,
    });
    this.logger.log(
      `School ${schoolId} location (${source}${detail ? `: ${detail}` : ''}): ${curLat},${curLng} -> ${lat},${lng}`,
    );
    return { applied: true, latitude: lat, longitude: lng, source };
  }
}
