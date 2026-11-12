import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type SelectQueryBuilder } from 'typeorm';
import { School } from '../schools/entities/school.entity';
import { SchoolBoundary } from '../schools/entities/school-boundary.entity';
import {
  applyAccess,
  schoolInAccess,
  type PartnerAccess,
} from './partner-access';

/**
 * How trustworthy a school's point is, from where it came:
 * surveyed (KMZ site map / 3D model), manual (a person set it), tdmp (TDMP's
 * own GPS, kept until surveyed), unverified (seed / unknown).
 */
export type CoordinateQuality = 'surveyed' | 'manual' | 'tdmp' | 'unverified';

export function coordinateQuality(
  source: string | null | undefined,
): CoordinateQuality {
  if (source === 'kmz' || source === 'glb') return 'surveyed';
  if (source === 'manual') return 'manual';
  if (source === 'tdmp') return 'tdmp';
  return 'unverified';
}

export interface ListQuery {
  updatedSince?: string;
  status?: string;
  district?: string;
  page?: number;
  limit?: number;
}

const MAX_LIMIT = 1000;

const num = (v: unknown) => (v == null ? null : Number(v));

/** School data RTB GIS shares with partner platforms. Read-only. */
@Injectable()
export class PartnerSchoolsService {
  constructor(
    @InjectRepository(School) private readonly schools: Repository<School>,
    @InjectRepository(SchoolBoundary)
    private readonly boundaries: Repository<SchoolBoundary>,
  ) {}

  private filtered(
    q: ListQuery,
    changedColumn: 'locationUpdatedAt' | 'updatedAt',
    access: PartnerAccess,
  ): SelectQueryBuilder<School> {
    const qb = applyAccess(this.schools.createQueryBuilder('s'), access);
    if (q.updatedSince) {
      const since = new Date(q.updatedSince);
      if (Number.isNaN(since.getTime()))
        throw new BadRequestException(
          'updatedSince must be an ISO date-time, e.g. 2026-11-12T00:00:00Z',
        );
      qb.andWhere(`s."${changedColumn}" > :since`, { since });
    }
    if (q.status) qb.andWhere('s.status = :status', { status: q.status });
    if (q.district)
      qb.andWhere('s.district ILIKE :district', { district: q.district });
    return qb;
  }

  private page(q: ListQuery) {
    const limit = Math.min(Math.max(Number(q.limit) || 100, 1), MAX_LIMIT);
    const page = Math.max(Number(q.page) || 1, 1);
    return { limit, page, skip: (page - 1) * limit };
  }

  /** Every school with its point: the feed TDMP updates its own GPS from. */
  async coordinates(q: ListQuery, access: PartnerAccess) {
    const { limit, page, skip } = this.page(q);
    const [rows, total] = await this.filtered(q, 'locationUpdatedAt', access)
      .select([
        's.id',
        's.code',
        's.tdmpSchoolCode',
        's.name',
        's.district',
        's.sector',
        's.status',
        's.latitude',
        's.longitude',
        's.elevation',
        's.locationSource',
        's.locationUpdatedAt',
      ])
      .orderBy('s.locationUpdatedAt', 'ASC', 'NULLS FIRST')
      .addOrderBy('s.id', 'ASC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();
    const data = rows.map((s) => ({
      schoolCode: s.tdmpSchoolCode ?? s.code,
      rtbGisId: s.id,
      name: s.name,
      district: s.district,
      sector: s.sector,
      status: s.status,
      latitude: num(s.latitude),
      longitude: num(s.longitude),
      elevation: num(s.elevation),
      source: s.locationSource ?? null,
      quality: coordinateQuality(s.locationSource),
      updatedAt: s.locationUpdatedAt ? s.locationUpdatedAt.toISOString() : null,
    }));
    return {
      data,
      page: { current: page, limit, total },
      generatedAt: new Date().toISOString(),
    };
  }

  /** The same feed as a GeoJSON FeatureCollection (points, WGS84). */
  async coordinatesGeoJson(q: ListQuery, access: PartnerAccess) {
    const res = await this.coordinates(q, access);
    return {
      type: 'FeatureCollection' as const,
      features: res.data
        .filter((d) => d.latitude != null && d.longitude != null)
        .map(({ latitude, longitude, ...props }) => ({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [longitude, latitude],
          },
          properties: props,
        })),
      page: res.page,
      generatedAt: res.generatedAt,
    };
  }

  /** The school list with what can be embedded for each school. */
  async list(q: ListQuery, access: PartnerAccess) {
    const { limit, page, skip } = this.page(q);
    const [rows, total] = await this.filtered(q, 'updatedAt', access)
      .select([
        's.id',
        's.code',
        's.tdmpSchoolCode',
        's.name',
        's.type',
        's.status',
        's.province',
        's.district',
        's.sector',
        's.latitude',
        's.longitude',
        's.locationSource',
        's.locationUpdatedAt',
        's.overallScore',
        's.priorityLevel',
        's.kmz2dFilePath',
        's.tifFilePath',
        's.modelBytes',
        's.updatedAt',
      ])
      .orderBy('s.name', 'ASC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();
    return {
      data: rows.map((s) => this.summary(s)),
      page: { current: page, limit, total },
    };
  }

  private summary(s: School) {
    return {
      schoolCode: s.tdmpSchoolCode ?? s.code,
      rtbGisId: s.id,
      name: s.name,
      type: s.type,
      status: s.status,
      province: s.province,
      district: s.district,
      sector: s.sector,
      latitude: num(s.latitude),
      longitude: num(s.longitude),
      coordinateQuality: coordinateQuality(s.locationSource),
      locationUpdatedAt: s.locationUpdatedAt
        ? s.locationUpdatedAt.toISOString()
        : null,
      conditionScore: s.overallScore != null ? Number(s.overallScore) : null,
      priority: s.priorityLevel ?? null,
      views: {
        dashboard: true,
        map2d: true,
        // 2D drone imagery / 3D model uploaded: the views show more than the base map.
        imagery2d: !!(s.kmz2dFilePath || s.tifFilePath),
        model3d: !!s.modelBytes,
      },
      updatedAt: s.updatedAt ? s.updatedAt.toISOString() : null,
    };
  }

  /** One school by TDMP / SDMS code, with its campus boundary. */
  async detail(code: string, access: PartnerAccess) {
    const s = await this.schools.findOne({
      where: [{ tdmpSchoolCode: code }, { code }],
    });
    if (!s || !schoolInAccess(access, s))
      throw new NotFoundException(`No school with code ${code} in RTB GIS`);
    const boundaries = await this.boundaries.find({
      where: { schoolId: s.id },
      select: ['id', 'name', 'boundaryType', 'geojson', 'areaSquareMeters'],
    });
    return {
      ...this.summary(s),
      elevation: num(s.elevation),
      boundaries: boundaries.map((b) => ({
        name: b.name,
        type: b.boundaryType,
        areaSquareMeters:
          b.areaSquareMeters != null ? Number(b.areaSquareMeters) : null,
        geojson: b.geojson,
      })),
    };
  }
}
