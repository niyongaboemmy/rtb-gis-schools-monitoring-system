import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SiteFeature } from './entities/site-feature.entity';
import { SchoolViewerState } from './entities/school-viewer-state.entity';
import { School } from '../schools/entities/school.entity';
import { EventsGateway } from '../events/events.gateway';
import { Permission } from '../../common/constants/permissions.constant';
import {
  CreateSiteFeatureDto,
  LegacySiteAnnotationDto,
  UpdateSiteFeatureDto,
} from './dto/site-feature.dto';
import {
  featureToLegacyAnnotation,
  featuresToCsv,
  legacy3dToFeature,
  legacyAnnotationToFeature,
  type FeatureDraft,
} from './site-feature.mapping';
import { isPlausibleLatLng, type GeoOrigin } from '../kmz/geo-derive';

/** The subset of the request user the service needs. */
export interface ActingUser {
  id?: string;
  firstName?: string;
  lastName?: string;
  role?: { name?: string; permissions?: string[] } | null;
}

const MAX_FEATURES_PER_SCHOOL = 5000;

@Injectable()
export class SiteFeaturesService {
  private readonly logger = new Logger(SiteFeaturesService.name);

  constructor(
    @InjectRepository(SiteFeature)
    private readonly repo: Repository<SiteFeature>,
    @InjectRepository(School)
    private readonly schools: Repository<School>,
    @InjectRepository(SchoolViewerState)
    private readonly viewerStates: Repository<SchoolViewerState>,
    @Optional() private readonly events?: EventsGateway,
  ) {}

  async list(schoolId: string): Promise<SiteFeature[]> {
    await this.importLegacy(schoolId).catch((err) =>
      this.logger.warn(
        `Legacy feature import failed for ${schoolId}: ${err?.message || err}`,
      ),
    );
    return this.repo.find({
      where: { schoolId },
      order: { createdAt: 'ASC' },
    });
  }

  async create(
    schoolId: string,
    dto: CreateSiteFeatureDto,
    user: ActingUser | undefined,
  ): Promise<SiteFeature> {
    await this.assertSchool(schoolId);
    const count = await this.repo.count({ where: { schoolId } });
    if (count >= MAX_FEATURES_PER_SCHOOL)
      throw new ForbiddenException(
        `This school already has ${MAX_FEATURES_PER_SCHOOL} saved features.`,
      );
    const saved = await this.repo.save(
      this.repo.create({
        schoolId,
        kind: dto.kind,
        geometry: dto.geometry,
        modelCoords: dto.modelCoords ?? null,
        value: dto.value ?? null,
        unit: dto.unit ?? null,
        label: dto.label ?? null,
        description: dto.description ?? null,
        color: dto.color ?? null,
        properties: dto.properties ?? null,
        source: dto.source,
        legacyId: null,
        createdBy: user?.id ?? null,
        createdByName: displayName(user),
        updatedBy: user?.id ?? null,
      }),
    );
    this.emit(schoolId, saved.id, 'created');
    return saved;
  }

  async update(
    schoolId: string,
    id: string,
    dto: UpdateSiteFeatureDto,
    user: ActingUser | undefined,
  ): Promise<SiteFeature> {
    const f = await this.findOwnedOrPermitted(schoolId, id, user);
    for (const k of [
      'geometry',
      'modelCoords',
      'value',
      'unit',
      'label',
      'description',
      'color',
      'properties',
    ] as const) {
      if (dto[k] !== undefined) (f as any)[k] = dto[k];
    }
    f.updatedBy = user?.id ?? null;
    const saved = await this.repo.save(f);
    this.emit(schoolId, id, 'updated');
    return saved;
  }

  async remove(
    schoolId: string,
    id: string,
    user: ActingUser | undefined,
  ): Promise<{ success: true }> {
    const f = await this.findOwnedOrPermitted(schoolId, id, user);
    await this.repo.delete({ id: f.id });
    this.emit(schoolId, id, 'deleted');
    return { success: true };
  }

  async exportCsv(schoolId: string): Promise<string> {
    return featuresToCsv(await this.list(schoolId));
  }

  // ── Legacy 2D endpoints (`/kmz/2d/site-annotations`) ────────────────────

  async addLegacyAnnotation(
    schoolId: string,
    dto: LegacySiteAnnotationDto,
    user: ActingUser | undefined,
  ) {
    await this.assertSchool(schoolId);
    const draft = legacyAnnotationToFeature(dto);
    if (!draft)
      throw new ForbiddenException('Annotation has no usable coordinates.');
    const saved = await this.repo.save(
      this.repo.create({
        ...draft,
        legacyId: null,
        schoolId,
        createdBy: user?.id ?? null,
        createdByName: displayName(user),
        updatedBy: user?.id ?? null,
      }),
    );
    this.emit(schoolId, saved.id, 'created');
    return featureToLegacyAnnotation(saved);
  }

  /** Legacy delete: accepts the feature id or the pre-migration annotation id. */
  async removeLegacy(schoolId: string, id: string) {
    const f = await this.repo.findOne({
      where: isUuid(id) ? { schoolId, id } : { schoolId, legacyId: id },
    });
    if (f) {
      await this.repo.delete({ id: f.id });
      this.emit(schoolId, f.id, 'deleted');
    }
    return { success: true };
  }

  // ── Lazy, idempotent move of the old stores into site_features ─────────

  /**
   * Moves School.siteAnnotations (2D) and viewer-state measures/annotations
   * (3D) into site_features the first time a school's features are read, then
   * empties the old fields so nothing is imported twice. Runs on read (not
   * only in a migration) because dev databases use `synchronize`.
   */
  async importLegacy(schoolId: string): Promise<number> {
    const school = await this.schools.findOne({
      where: { id: schoolId },
      select: [
        'id',
        'latitude',
        'longitude',
        'siteAnnotations',
        'modelOriginLat',
        'modelOriginLng',
        'modelOriginAlt',
      ],
    });
    if (!school) return 0;
    const state = await this.viewerStates.findOne({ where: { schoolId } });
    const ann2d = Array.isArray(school.siteAnnotations)
      ? school.siteAnnotations
      : [];
    const measures = Array.isArray(state?.measures) ? state.measures : [];
    const notes = Array.isArray(state?.annotations) ? state.annotations : [];
    if (!ann2d.length && !measures.length && !notes.length) return 0;

    return this.repo.manager.transaction(async (m) => {
      // Lock the school row so two concurrent first reads can't both import.
      const locked = await m.getRepository(School).findOne({
        where: { id: schoolId },
        select: ['id', 'siteAnnotations'],
        lock: { mode: 'pessimistic_write' },
      });
      const lockedState = await m
        .getRepository(SchoolViewerState)
        .findOne({ where: { schoolId } });
      const a2 = Array.isArray(locked?.siteAnnotations)
        ? locked.siteAnnotations
        : [];
      const ms = Array.isArray(lockedState?.measures)
        ? lockedState.measures
        : [];
      const ns = Array.isArray(lockedState?.annotations)
        ? lockedState.annotations
        : [];

      const drafts: FeatureDraft[] = a2
        .map(legacyAnnotationToFeature)
        .filter((d): d is FeatureDraft => !!d);

      if (ms.length || ns.length) {
        const { origin, approximate } = modelOriginOf(school);
        if (origin) {
          for (const x of ms) {
            const d = legacy3dToFeature(x, 'measure', origin, approximate);
            if (d) drafts.push(d);
          }
          for (const x of ns) {
            const d = legacy3dToFeature(x, 'annotation', origin, approximate);
            if (d) drafts.push(d);
          }
        }
      }

      if (drafts.length) {
        await m.getRepository(SiteFeature).save(
          drafts.map((d) =>
            m.getRepository(SiteFeature).create({
              ...d,
              schoolId,
              createdBy: null,
              createdByName: null,
              updatedBy: null,
            }),
          ),
        );
      }
      if (a2.length)
        await m.getRepository(School).update(schoolId, { siteAnnotations: [] });
      if (
        lockedState &&
        (ms.length || ns.length) &&
        modelOriginOf(school).origin
      )
        await m
          .getRepository(SchoolViewerState)
          .update({ schoolId }, { measures: [], annotations: [] });
      if (drafts.length)
        this.logger.log(
          `Imported ${drafts.length} legacy site feature(s) for school ${schoolId}`,
        );
      return drafts.length;
    });
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  private async assertSchool(schoolId: string) {
    const exists = await this.schools.exist({ where: { id: schoolId } });
    if (!exists) throw new NotFoundException('School not found');
  }

  private async findOwnedOrPermitted(
    schoolId: string,
    id: string,
    user: ActingUser | undefined,
  ): Promise<SiteFeature> {
    const f = await this.repo.findOne({ where: { schoolId, id } });
    if (!f) throw new NotFoundException('Site feature not found');
    if (!canEditAnyFeature(user) && (!user?.id || f.createdBy !== user.id))
      throw new ForbiddenException(
        'You can only change measurements and notes you created.',
      );
    return f;
  }

  private emit(
    schoolId: string,
    id: string,
    op: 'created' | 'updated' | 'deleted',
  ) {
    try {
      this.events?.emitSiteFeatureChanged(schoolId, { schoolId, id, op });
    } catch {
      /* live updates are best-effort */
    }
  }
}

/** Owner-or-EDIT_SITE_ANNOTATIONS rule for editing / deleting a feature. */
export function canEditAnyFeature(user: ActingUser | undefined): boolean {
  const role = (user?.role?.name || '').toLowerCase().replace(/\s+/g, '_');
  if (role === 'super_admin') return true;
  return (user?.role?.permissions || []).includes(
    Permission.EDIT_SITE_ANNOTATIONS,
  );
}

function displayName(user: ActingUser | undefined): string | null {
  const n = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return n ? n.slice(0, 200) : null;
}

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    s,
  );
}

/** Model georeference origin, else the school point (approximate). */
export function modelOriginOf(school: Partial<School>): {
  origin: GeoOrigin | null;
  approximate: boolean;
} {
  if (isPlausibleLatLng(school.modelOriginLat, school.modelOriginLng)) {
    return {
      origin: {
        lat: Number(school.modelOriginLat),
        lng: Number(school.modelOriginLng),
        alt: Number(school.modelOriginAlt) || 0,
      },
      approximate: false,
    };
  }
  if (isPlausibleLatLng(school.latitude, school.longitude)) {
    return {
      origin: {
        lat: Number(school.latitude),
        lng: Number(school.longitude),
        alt: 0,
      },
      approximate: true,
    };
  }
  return { origin: null, approximate: true };
}
