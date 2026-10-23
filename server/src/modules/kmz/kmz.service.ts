import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import * as JSZip from 'jszip';
import * as xml2js from 'xml2js';
import * as fs from 'fs';
import {
  School,
  KmzProcessingStatus,
  type ModelQuality,
  type ModelQualityMeasure,
  type ModelVariants,
} from '../schools/entities/school.entity';
import { execFile } from 'child_process';
import {
  SchoolBoundary,
  BoundaryType,
} from '../schools/entities/school-boundary.entity';
import {
  SchoolBuilding,
  BuildingCondition,
} from '../schools/entities/school-building.entity';
import { StorageService } from '../storage/storage.service';
import { KMZ_QUEUE, GLB_JOB_OPTIONS } from './kmz.constants';
import type { GlbJobData, Kmz2dJobData } from './kmz.processor';
import {
  optimizeGlbFile,
  ensureGlbTools,
  isGlbOptimizerAvailable,
  resolveHeapMb,
  type GlbOptimizeResult,
} from './glb-optimizer';
import {
  DRAPE_PAGE,
  buildDrape,
  tilesDirFromUrl,
  type DrapeResult,
} from './glb-drape';
import { optimizeProfile } from './glb-optimizer';
import { GlbReoptimizeService } from './glb-reoptimize.service';
import {
  buildKtx2Variant,
  ktx2ObjectName,
  shouldBuildKtx2,
  webpGpuBytes,
} from './glb-ktx2';
import {
  pickKmlCoordinate,
  deriveCoordinateFromGlb,
  isPlausibleLatLng,
  type DerivedCoordinate,
  deriveGlbGeoInfo,
  compareModelScale,
  lonLatExtentMeters,
  collectGeoJsonPositions,
  readGlbHeaderBytes,
} from './geo-derive';
import {
  isModelJobStage,
  type ModelJobResult,
  type ModelJobStage,
} from './model-job';
import {
  SiteFeaturesService,
  type ActingUser,
} from '../site-features/site-features.service';
import { SchoolLocationService } from '../schools/location/school-location.service';
import { buildOverlayPyramid } from './overlay-pyramid';
import { buildSiteTiles } from './overlay-tiles';

/** A 2D manifest with the optional tile pyramid (overlay-pyramid.ts). */
type Kmz2dManifestWithPyramid = {
  groundOverlays?: Array<Record<string, unknown>>;
  pyramid?: { status?: string } & Record<string, unknown>;
  /** Full-detail map tiles (overlay-tiles.ts), built after the pyramid. */
  tiles?: { status?: string } & Record<string, unknown>;
} & Record<string, unknown>;

/** Photo overlays that go into the pyramid (tiled giants and GeoTIFFs stay separate). */
const pyramidPhotos = (m: Kmz2dManifestWithPyramid) =>
  (m.groundOverlays ?? []).filter(
    (o) =>
      o &&
      !o.isTiled &&
      typeof o.imageUrl === 'string' &&
      !/\.tiff?(\?|$)/i.test(o.imageUrl),
  );
import type { LegacySiteAnnotationDto } from '../site-features/dto/site-feature.dto';
import { Readable } from 'stream';
import unzipper from 'unzipper';
import {
  ExtractionBudget,
  assertSafeZip,
  kmzZipLimits,
} from '../../common/security/upload-validation';
import * as path from 'path';
import archiver from 'archiver';
import type { Response } from 'express';
import sharp from 'sharp';
import * as os from 'os';
import { createHash } from 'crypto';

/** SHA-256 of a file, streamed (originals can be 1–2 GB). */
export function hashFile(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256');
    fs.createReadStream(file)
      .on('data', (d) => h.update(d))
      .on('error', reject)
      .on('end', () => resolve(h.digest('hex')));
  });
}

/** Manifest kept beside the original 3D model in `3d/_source/`. */
export function sourceManifest(
  fileName: string,
  bytes: number,
  sha256: string,
  quality: unknown,
): {
  fileName: string;
  bytes: number;
  sha256: string;
  keptAt: string;
  precompressed: boolean | null;
  quality: unknown;
} {
  const q = quality as { precompressed?: boolean } | null;
  return {
    fileName,
    bytes,
    sha256,
    keptAt: new Date().toISOString(),
    precompressed: q?.precompressed ?? null,
    quality,
  };
}

/** The detail meter (glb-tools/quality.mjs), run as a child process. */
const QUALITY_SCRIPT = path.join(process.cwd(), 'glb-tools', 'quality.mjs');

/**
 * Scratch space for KMZ downloads / extraction. Defaults to the OS temp dir,
 * but on the EC2 box `/tmp` is a ~4 GB tmpfs (RAM-backed) — a multi-GB KMZ
 * fills it and every write fails with EDQUOT. Point KMZ_TMP_DIR at the EBS
 * data volume (e.g. /var/lib/rtb/tmp) in production.
 */
export const KMZ_TMP_DIR: string = (() => {
  const dir = process.env.KMZ_TMP_DIR || os.tmpdir();
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    /* best effort */
  }
  return dir;
})();

/** Outcome of the best-effort GLB optimize step. */
interface OptimizeOutcome {
  /** Optimizer metrics when it actually ran (null when it never started). */
  result: GlbOptimizeResult | null;
  /** True iff the served object is now the optimized build. */
  optimized: boolean;
  /** Why the served object is still raw (null when optimized). */
  error: string | null;
}

@Injectable()
export class KmzService implements OnModuleInit {
  private readonly logger = new Logger(KmzService.name);
  constructor(
    @InjectRepository(School)
    private readonly schoolRepository: Repository<School>,
    @InjectRepository(SchoolBoundary)
    private readonly boundaryRepository: Repository<SchoolBoundary>,
    @InjectRepository(SchoolBuilding)
    private readonly buildingRepository: Repository<SchoolBuilding>,
    private readonly storageService: StorageService,
    @InjectQueue(KMZ_QUEUE) private readonly kmzQueue: Queue,
    @Optional() private readonly siteFeatures?: SiteFeaturesService,
    @Optional() private readonly eventEmitter?: EventEmitter2,
    @Optional() private readonly schoolLocation?: SchoolLocationService,
    @Optional() private readonly glbReoptimize?: GlbReoptimizeService,
  ) {
    // Warm the GLB optimizer (installs its deps once if the deploy didn't).
    void ensureGlbTools();
  }

  /**
   * One clear startup line so a prod `pm2 logs rtb-api | grep "GLB optimizer"`
   * immediately answers "is the optimizer alive" — the difference between a
   * served 20 MB model and a served 1.9 GB one.
   */
  async onModuleInit(): Promise<void> {
    try {
      const ready = await ensureGlbTools();
      if (ready) {
        this.logger.log('GLB optimizer: READY');
      } else {
        this.logger.warn(
          `GLB optimizer: UNAVAILABLE (${
            isGlbOptimizerAvailable()
              ? 'script present but deps failed to install'
              : 'glb-tools/optimize.mjs or its node_modules missing'
          }) — raw GLBs will be served until fixed`,
        );
      }
    } catch (err: any) {
      this.logger.warn(`GLB optimizer: UNAVAILABLE (${err?.message || err})`);
    }
  }

  async uploadGlbModel(schoolId: string, file: Express.Multer.File) {
    const school = await this.schoolRepository.findOne({
      where: { id: schoolId },
    });
    if (!school) throw new NotFoundException(`School ${schoolId} not found`);

    const filename = file.originalname.toLowerCase();
    if (!filename.endsWith('.glb')) {
      throw new BadRequestException(
        'File must be a .glb file. Use POST /kmz/2d for KMZ/KML files',
      );
    }

    await this.schoolRepository.update(schoolId, {
      kmzStatus: KmzProcessingStatus.PROCESSING,
    });

    const job = await this.kmzQueue.add(
      'process-glb',
      {
        schoolId,
        tempFilePath: file.path,
        originalName: file.originalname,
        mimetype: file.mimetype,
        source: 'upload',
      } satisfies GlbJobData,
      GLB_JOB_OPTIONS,
    );

    this.logger.log(
      `Enqueued process-glb job ${job.id} for school ${schoolId}`,
    );

    return {
      message: 'GLB file accepted for processing',
      schoolId,
      jobId: job.id,
      statusUrl: `/api/v1/schools/${schoolId}/kmz/status`,
    };
  }

  /**
   * Serve, optimize, measure and (when needed) build the KTX2 copy of one
   * school model. `onStage` reports progress (model-job.ts) for the
   * "Reprocess" panel. Re-processing reads only the original's header in this
   * process — originals can be 1–2 GB; the optimizer child reads the rest.
   */
  async processGlbJob(
    data: GlbJobData,
    onStage: (stage: ModelJobStage) => void = () => {},
  ): Promise<ModelJobResult> {
    const { schoolId, tempFilePath, originalName, mimetype } = data;
    const isRestore = data.source === 'restore';
    try {
      onStage('reading');
      const sourceBytes = fs.statSync(tempFilePath).size;
      // JSON header only: all the location / georeference readers need.
      const header = readGlbHeaderBytes(tempFilePath) ?? Buffer.alloc(0);
      const filePath = `schools/${schoolId}/3d/${originalName}`;

      // 1. Serve the raw model straight away so the viewer works even if the
      //    optimization step is slow or fails. On a re-optimize sweep the file
      //    is already the served object, so this upload is skipped.
      let publicPath: string | null;
      if (isRestore) {
        publicPath =
          (await this.storageService.getFileUrl(filePath)) ??
          `/files/${filePath}`;
      } else {
        publicPath = await this.storageService.uploadFile(
          filePath,
          fs.readFileSync(tempFilePath),
          mimetype,
        );
      }

      // 2. Best-effort: replace it with an optimized build (reproject geographic
      //    vertices to local metres, mesh simplify, Meshopt geometry
      //    compression, WebP textures). Raw photogrammetry exports are ~30x
      //    heavier than the web needs. Any failure here leaves the raw model in
      //    place.
      const opt = await this.optimizeAndReplaceGlb(
        schoolId,
        tempFilePath,
        originalName,
        mimetype,
        filePath,
        onStage,
      ).catch((err: any) => {
        const msg = String(err?.message || err);
        this.logger.warn(`GLB optimize skipped for school ${schoolId}: ${msg}`);
        const outcome: OptimizeOutcome = {
          result: null,
          optimized: false,
          error: msg,
        };
        return outcome;
      });
      const optResult = opt.result;

      // A failed re-optimize must not downgrade a school that already serves a
      // good optimized build (a previous run, or one produced off-box). Only
      // report failure when what's actually served is still the heavy raw file.
      let effective = opt;
      if (!opt.optimized && isRestore) {
        const servedBytes = this.servedFileBytes(filePath);
        if (servedBytes != null && servedBytes < sourceBytes * 0.5) {
          this.logger.log(
            `Re-optimize failed for ${schoolId} but a ${(
              servedBytes / 1048576
            ).toFixed(1)} MB optimized build is already served — keeping it`,
          );
          effective = { result: null, optimized: true, error: null };
        }
      }

      onStage('saving');
      // Detail of the served model and of the file as delivered (Phase 1).
      if (optResult?.quality) {
        await this.schoolRepository
          .update(schoolId, {
            modelQuality: {
              served: optResult.quality as ModelQualityMeasure,
              source: (optResult.qualityIn as ModelQualityMeasure) ?? null,
              profile: optResult.profile ?? 'standard',
              textures: (optResult.textures ?? []) as ModelQuality['textures'],
              measuredAt: new Date().toISOString(),
              drape: optResult.drape
                ? {
                    draped: optResult.drape.draped,
                    pages: optResult.drape.pages?.length,
                    cm: optResult.drape.cm,
                    skipped: optResult.drape.skipped,
                    alignment: optResult.drape.alignment,
                  }
                : null,
            },
          })
          .catch(() => null);
      }

      await this.writeModelTelemetry(schoolId, {
        optimized: effective.optimized,
        bytes:
          effective.result?.bytesOut ??
          this.servedFileBytes(filePath) ??
          sourceBytes,
        error: effective.error,
      });

      // 3. Sync the school's coordinates to whatever the model says. Preferred
      //    source is the optimizer's reprojection centroid (it decoded the
      //    geometry); otherwise fall back to a JSON-chunk read (CESIUM_RTC /
      //    ECEF node / geographic POSITION bounds).
      const derivedCoord: DerivedCoordinate | null =
        optResult?.reprojected && optResult.lat != null && optResult.lng != null
          ? {
              lat: optResult.lat,
              lng: optResult.lng,
              source: 'glb:reprojected',
            }
          : deriveCoordinateFromGlb(header);
      await this.syncSchoolCoordinate(
        schoolId,
        derivedCoord,
        isRestore ? 'restore' : 'glb',
      ).catch(() => {});

      // 3b. Georeference origin + model scale check (WS5.3 / WS6.4).
      await this.writeModelGeoref(schoolId, header, effective.optimized).catch(
        (err: any) =>
          this.logger.warn(
            `Model scale check skipped for ${schoolId}: ${err?.message || err}`,
          ),
      );

      // A bare GLB upload no longer creates a `school_buildings` row. The 3D
      // viewer resolves the model from the file server + `kmzFilePath`, not from
      // a building record. Buildings are structural-inventory data and must be
      // entered manually with a real assessed condition so they can legitimately
      // feed the infrastructure score. On a genuine upload also purge any stub
      // rows a previous version auto-created for the model file: `condition`
      // still at the enum default and every inventory field empty.
      if (!isRestore) {
        await this.buildingRepository
          .createQueryBuilder()
          .delete()
          .where('school_id = :schoolId', { schoolId })
          // Stubs: condition unset (or the pre-v2 enum default 'fair').
          .andWhere('(condition IS NULL OR condition = :defaultCondition)', {
            defaultCondition: BuildingCondition.FAIR,
          })
          .andWhere(`("roofCondition" IS NULL OR "roofCondition" = 'good')`)
          .andWhere('"yearBuilt" IS NULL')
          .andWhere('"structuralScore" IS NULL')
          .andWhere('"areaSquareMeters" IS NULL')
          .andWhere('floors IS NULL')
          .andWhere('"buildingCode" IS NULL')
          .andWhere('notes IS NULL')
          .andWhere('"footprintGeojson" IS NULL')
          .andWhere('"lastInspectionDate" IS NULL')
          .execute();
        this.eventEmitter?.emit('school.updated', { schoolId });
      }

      await this.schoolRepository.update(schoolId, {
        kmzStatus: KmzProcessingStatus.COMPLETED,
        kmzFilePath: publicPath || filePath,
        kmzProcessedAt: new Date(),
      });

      this.logger.log(`GLB processing completed for school ${schoolId}`);

      // 4. GPU-compressed variant for heavy textures (Phase 3). The model is
      //    already live; this only adds a lighter option for phones.
      let ktx2 = false;
      if (optResult?.quality && effective.optimized) {
        ktx2 = await this.refreshKtx2Variant(
          schoolId,
          filePath,
          [
            ...((optResult.quality as ModelQualityMeasure).textures ?? []),
            // Draped pages are textures too (GPU memory).
            ...(optResult.drape?.pages ?? []).map(() => ({
              width: DRAPE_PAGE,
              height: DRAPE_PAGE,
              mime: 'image/webp',
            })),
          ],
          onStage,
        ).catch((err: any) => {
          this.logger.warn(
            `KTX2 variant skipped for ${schoolId}: ${err?.message || err}`,
          );
          return false;
        });
      }

      const served = optResult?.quality as ModelQualityMeasure | undefined;
      return {
        optimized: effective.optimized,
        bytesIn: sourceBytes,
        bytesOut: optResult?.bytesOut ?? this.servedFileBytes(filePath),
        trisIn: optResult?.trisIn ?? null,
        trisOut: optResult?.trisOut ?? null,
        detailCm:
          served?.cmPerPixel?.horizontal?.median ??
          served?.cmPerPixel?.overall?.median ??
          null,
        drapeCm: optResult?.drape?.draped ? (optResult.drape.cm ?? null) : null,
        ktx2,
        error: effective.error,
      };
    } catch (err: any) {
      this.logger.error(
        `GLB processing failed for school ${schoolId}: ${err.message}`,
      );
      await this.schoolRepository.update(schoolId, {
        kmzStatus: KmzProcessingStatus.FAILED,
      });
      throw err;
    } finally {
      // A 'restore' job's tempFilePath is a real file inside storage — never
      // delete it. Only a fresh upload's staged temp file is disposable.
      if (!isRestore) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch {
          /* already gone */
        }
      }
    }
  }

  /**
   * Build (or drop) the KTX2 variant of the served model `servedObjectName`.
   * Built only when the textures exceed the WebP GPU budget (glb-ktx2.ts);
   * otherwise any older variant is removed so it can't go stale.
   */
  private async refreshKtx2Variant(
    schoolId: string,
    servedObjectName: string,
    textures: Array<{ width?: number; height?: number; mime?: string }>,
    onStage: (stage: ModelJobStage) => void = () => {},
  ): Promise<boolean> {
    const school = await this.schoolRepository.findOne({
      where: { id: schoolId },
      select: ['id', 'modelVariants'],
    });
    const previous = school?.modelVariants?.ktx2?.objectName;
    const objectName = ktx2ObjectName(servedObjectName);
    const clear = async () => {
      for (const name of new Set([previous, objectName].filter(Boolean)))
        await this.storageService.deleteFile(name as string).catch(() => {});
      if (school?.modelVariants)
        await this.schoolRepository.update(schoolId, { modelVariants: null });
    };
    if (!shouldBuildKtx2(textures)) {
      await clear();
      return false;
    }
    onStage('gpu-copy');

    const served = await this.storageService.readFile(servedObjectName);
    if (!served) throw new Error('served model not readable');
    const workDir = path.join(KMZ_TMP_DIR, 'glb-ktx2');
    fs.mkdirSync(workDir, { recursive: true });
    const stamp = `${schoolId}-${Date.now()}`;
    const input = path.join(workDir, `${stamp}.glb`);
    const output = path.join(workDir, `${stamp}.ktx2.glb`);
    try {
      fs.writeFileSync(input, served);
      const r = await buildKtx2Variant(input, output);
      const url =
        (await this.storageService.uploadFile(
          objectName,
          fs.readFileSync(output),
          'model/gltf-binary',
        )) ?? `/files/${objectName}`;
      if (previous && previous !== objectName)
        await this.storageService.deleteFile(previous).catch(() => {});
      const modelVariants: ModelVariants = {
        ktx2: {
          url,
          objectName,
          bytes: r.bytesOut,
          gpuBytes: r.gpuBytes,
          webpGpuBytes: webpGpuBytes(textures),
          builtAt: new Date().toISOString(),
        },
      };
      await this.schoolRepository.update(schoolId, { modelVariants });
      this.logger.log(
        `KTX2 variant for ${schoolId}: ${(r.bytesOut / 1048576).toFixed(1)} MB, ` +
          `GPU ${(r.gpuBytes / 1048576).toFixed(0)} MB (WebP ${(
            webpGpuBytes(textures) / 1048576
          ).toFixed(0)} MB), ${(r.ms / 1000).toFixed(0)}s`,
      );
      return true;
    } catch (err) {
      await clear(); // never leave a variant that no longer matches the model
      throw err;
    } finally {
      for (const f of [input, output]) fs.rmSync(f, { force: true });
    }
  }

  /** Schools whose model is being measured right now (one at a time each). */
  private readonly measuring = new Set<string>();

  /**
   * Measure an already-processed model once, in the background (quality.mjs
   * in a child process; reads files only, never re-optimizes). Used for
   * schools processed before measurements existed.
   */
  private ensureModelQuality(school: School): void {
    const root = this.storageService.getLocalRoot();
    if (!root || school.modelQuality || !school.kmzFilePath) return;
    if (!/\.glb(\?|$)/i.test(school.kmzFilePath)) return;
    if (this.measuring.has(school.id)) return;
    const objectName = this.storageService.urlToObjectName(school.kmzFilePath);
    if (!objectName) return;
    const served = path.join(root, objectName);
    if (!fs.existsSync(served)) return;
    const source = path.join(
      path.dirname(served),
      '_source',
      path.basename(served),
    );
    this.measuring.add(school.id);
    const measure = (file: string) =>
      new Promise<ModelQualityMeasure | null>((resolve) => {
        if (!fs.existsSync(file)) return resolve(null);
        execFile(
          process.execPath,
          [`--max-old-space-size=${resolveHeapMb()}`, QUALITY_SCRIPT, file],
          { timeout: 10 * 60_000, maxBuffer: 8 * 1024 * 1024 },
          (err, stdout) => {
            if (err) return resolve(null);
            try {
              resolve(
                JSON.parse(String(stdout).trim().split('\n').pop() ?? 'null'),
              );
            } catch {
              resolve(null);
            }
          },
        );
      });
    void (async () => {
      try {
        const servedQ = await measure(served);
        if (!servedQ) return;
        const sourceQ = await measure(source);
        await this.schoolRepository.update(school.id, {
          modelQuality: {
            served: servedQ,
            source: sourceQ,
            profile: 'measured',
            measuredAt: new Date().toISOString(),
          },
        });
        this.logger.log(
          `[3D] Measured model detail for ${school.id}: ${servedQ.cmPerPixel?.horizontal?.median ?? '?'} cm/px (${servedQ.score})`,
        );
      } catch (e) {
        this.logger.warn(
          `[3D] Model measurement failed for ${school.id}: ${(e as Error).message}`,
        );
      } finally {
        this.measuring.delete(school.id);
      }
    })();
  }

  /**
   * Byte size of the object currently served at `objectName`, from the local
   * storage root. null for the MinIO backend or when the file is absent.
   */
  private servedFileBytes(objectName: string): number | null {
    const root = this.storageService.getLocalRoot();
    if (!root) return null;
    try {
      return fs.statSync(path.join(root, objectName)).size;
    } catch {
      return null;
    }
  }

  /**
   * Persist the outcome of the optimize step so the API and the 3D viewer can
   * tell an optimized build from a raw multi-GB one, and surface the reason it
   * failed. Best-effort — never throws into the job.
   */
  /**
   * Store the model's georeference origin (when its vertices were geographic
   * and the served build is the reprojected one) and compare its horizontal
   * extent with the KMZ footprint: ground-overlay bounds first, else the
   * stored boundary polygons. Best-effort; never throws into the job.
   */
  private async writeModelGeoref(
    schoolId: string,
    rawGlb: Buffer,
    servedIsOptimized: boolean,
  ): Promise<void> {
    const info = deriveGlbGeoInfo(rawGlb);
    const origin = info?.geographic && servedIsOptimized ? info.origin : null;

    let scaleFactor: number | null = null;
    let warning: string | null = null;
    if (info) {
      const school = await this.schoolRepository.findOne({
        where: { id: schoolId },
        select: ['id', 'kmz2dManifest'],
      });
      const boxes = school?.kmz2dManifest?.groundOverlays ?? [];
      let positions: number[][] = boxes.flatMap((b) => [
        [b.west, b.south],
        [b.east, b.north],
      ]);
      if (!positions.length) {
        const boundaries = await this.boundaryRepository.find({
          where: { schoolId },
          select: ['id', 'geojson'],
        });
        positions = collectGeoJsonPositions(boundaries.map((b) => b.geojson));
      }
      const footprint = lonLatExtentMeters(positions);
      const check = footprint ? compareModelScale(info, footprint) : null;
      if (check) {
        scaleFactor = check.scaleFactor;
        warning = check.warning;
        if (warning) this.logger.warn(`Model scale (${schoolId}): ${warning}`);
      }
    }

    await this.schoolRepository.update(schoolId, {
      modelScaleFactor: scaleFactor,
      modelScaleWarning: warning,
      modelOriginLat: origin?.lat ?? null,
      modelOriginLng: origin?.lng ?? null,
      modelOriginAlt: origin?.alt ?? null,
    });
  }

  private async writeModelTelemetry(
    schoolId: string,
    o: { optimized: boolean; bytes: number; error: string | null },
  ): Promise<void> {
    try {
      await this.schoolRepository.update(schoolId, {
        modelOptimized: o.optimized,
        modelBytes: Math.round(o.bytes),
        modelOptimizeError: o.optimized ? null : o.error,
        modelOptimizedAt: o.optimized ? new Date() : undefined,
      });
    } catch (err: any) {
      this.logger.warn(
        `Failed to write model telemetry for ${schoolId}: ${err?.message || err}`,
      );
    }
  }

  /**
   * Runs the forked GLB optimizer and, on success, archives the original under
   * `3d/_source/` and overwrites the served object with the optimized build.
   * The served path (and therefore every stored `modelPath` / `kmzFilePath`)
   * is unchanged, so no DB updates are needed.
   *
   * Returns an outcome describing whether the served object is now the
   * optimized build and, if not, why not.
   */
  private async optimizeAndReplaceGlb(
    schoolId: string,
    sourcePath: string,
    originalName: string,
    mimetype: string,
    servedObjectName: string,
    onStage: (stage: ModelJobStage) => void = () => {},
  ): Promise<OptimizeOutcome> {
    if (!(await ensureGlbTools())) {
      this.logger.warn(
        'glb-tools unavailable (install failed or script missing) — serving raw GLB',
      );
      return {
        result: null,
        optimized: false,
        error: 'glb-tools unavailable (optimizer not installed on this host)',
      };
    }

    const workDir = path.join(KMZ_TMP_DIR, 'glb-opt');
    fs.mkdirSync(workDir, { recursive: true });
    const outPath = path.join(workDir, `${schoolId}-${Date.now()}.glb`);

    try {
      // Tunables (ratio, max tris, WebP quality, heap, timeout) live in
      // glb-optimizer.ts / optimize.mjs and honour GLB_OPT_HEAP_MB /
      // GLB_OPT_TIMEOUT_MS / GLB_MAX_OUT_TRIS / GLB_TEXTURE_QUALITY /
      // GLB_SIMPLIFY_ERROR.
      const r = await optimizeGlbFile(sourcePath, outPath, {
        onStage: (stage) => {
          if (isModelJobStage(stage)) onStage(stage);
        },
      });

      // Keep the raw model only when the optimizer neither shrank it nor had to
      // reproject it — a reprojected build must replace the raw one even when it
      // is not smaller, because the raw geometry renders as an invisible sliver.
      if (r.bytesOut >= r.bytesIn && !r.reprojected) {
        this.logger.warn(
          `GLB optimize produced no size gain for ${schoolId} — keeping raw`,
        );
        return {
          result: r,
          optimized: false,
          error: 'optimizer produced no size gain',
        };
      }

      // Roofs and ground from the site map's photos, when it has them.
      r.drape = await this.drapeIfPossible(schoolId, outPath, r, onStage);
      if (r.drape?.draped) r.bytesOut = fs.statSync(outPath).size;

      const optimizedBuffer = fs.readFileSync(outPath);
      // Keep the original — unless we are re-processing from that very
      // archived copy (rewriting a 1–2 GB file onto itself).
      const archiveName = `schools/${schoolId}/3d/_source/${originalName}`;
      const localRoot = this.storageService.getLocalRoot();
      const fromArchive =
        !!localRoot &&
        path.resolve(localRoot, archiveName) === path.resolve(sourcePath);
      if (!fromArchive) {
        await this.storageService.uploadFile(
          archiveName,
          fs.readFileSync(sourcePath),
          mimetype,
        );
      }
      // What was delivered, so it can be checked and re-processed later.
      await hashFile(sourcePath)
        .then((sha256) =>
          this.storageService.uploadFile(
            `${archiveName}.manifest.json`,
            Buffer.from(
              JSON.stringify(
                sourceManifest(
                  originalName,
                  fs.statSync(sourcePath).size,
                  sha256,
                  r.qualityIn ?? null,
                ),
                null,
                2,
              ),
            ),
            'application/json',
          ),
        )
        .catch((err: any) =>
          this.logger.warn(
            `Could not write source manifest for ${schoolId}: ${err?.message || err}`,
          ),
        );
      await this.storageService.uploadFile(
        servedObjectName,
        optimizedBuffer,
        'model/gltf-binary',
      );

      this.logger.log(
        `GLB optimized for ${schoolId}: ` +
          `${(r.bytesIn / 1048576).toFixed(1)}MB -> ${(r.bytesOut / 1048576).toFixed(1)}MB ` +
          `(${r.ratio}x, ${r.trisIn.toLocaleString()} -> ${r.trisOut.toLocaleString()} tris, ` +
          `${(r.ms / 1000).toFixed(0)}s, ${r.method ?? 'exact'}` +
          `${r.reprojected ? `, reprojected @ ${r.lat},${r.lng}` : ''})`,
      );
      return { result: r, optimized: true, error: null };
    } finally {
      try {
        fs.unlinkSync(outPath);
      } catch {
        /* ignore */
      }
    }
  }

  /**
   * Ortho draping (glb-drape.ts) of the optimized model at `modelPath`, in
   * place: needs a geo-referenced model (the optimizer reprojected it) and the
   * school's full-detail 2D tiles on local storage. Never throws; returns why
   * it was skipped instead.
   */
  private async drapeIfPossible(
    schoolId: string,
    modelPath: string,
    r: GlbOptimizeResult,
    onStage: (stage: ModelJobStage) => void,
  ): Promise<DrapeResult | null> {
    if (process.env.GLB_DRAPE === '0') return null;
    if (!r.reprojected || !r.origin)
      return { skipped: 'model is not geo-referenced' };
    const school = await this.schoolRepository.findOne({
      where: { id: schoolId },
      select: ['id', 'kmz2dManifest'],
    });
    const tiles = (school?.kmz2dManifest as Kmz2dManifestWithPyramid | null)
      ?.tiles;
    if (tiles?.status !== 'ready' || typeof tiles.url !== 'string')
      return { skipped: 'no full-detail 2D map tiles yet' };
    const dir = tilesDirFromUrl(tiles.url, this.storageService.getLocalRoot());
    if (!dir || !fs.existsSync(dir))
      return { skipped: '2D map tiles not on local storage' };
    onStage('draping');
    const out = modelPath.replace(/\.glb$/i, '.draped.glb');
    try {
      const d = await buildDrape(modelPath, out, {
        lat: r.origin.lat,
        lng: r.origin.lng,
        tilesDir: dir,
        tilesMaxZoom: Number(tiles.maxZoom),
        modelCm:
          (r.quality as ModelQualityMeasure | null | undefined)?.cmPerPixel
            ?.horizontal?.median ?? null,
      });
      if (!d.skipped && fs.existsSync(out)) {
        fs.renameSync(out, modelPath);
        this.logger.log(
          `Draped ${schoolId}: ${d.draped} faces on ${d.pages?.length} page(s) at ${d.cm} cm/px ` +
            `(alignment ${d.alignment?.shiftEastCm},${d.alignment?.shiftSouthCm} cm, ncc ${d.alignment?.ncc}), ${d.ms} ms`,
        );
      } else {
        this.logger.log(`Drape skipped for ${schoolId}: ${d.skipped}`);
      }
      return d;
    } catch (err) {
      const msg = (err as Error).message?.slice(0, 200);
      this.logger.warn(`Drape failed for ${schoolId}: ${msg}`);
      return { skipped: `drape failed: ${msg}` };
    } finally {
      fs.rmSync(out, { force: true });
    }
  }

  /**
   * After new 2D tiles, re-process the school's 3D model so its roofs and
   * ground pick them up — except when the stored original would take the
   * low-memory path (it would lose triangles; Nyanza-sized files).
   */
  private async reprocessModelForTiles(schoolId: string): Promise<void> {
    if (!this.glbReoptimize || process.env.GLB_DRAPE === '0') return;
    const school = await this.schoolRepository.findOne({
      where: { id: schoolId },
      select: ['id', 'kmzFilePath'],
    });
    const objectName = school?.kmzFilePath
      ? this.storageService.urlToObjectName(school.kmzFilePath)
      : null;
    const root = this.storageService.getLocalRoot();
    if (!objectName || !root || !/\.glb$/i.test(objectName)) return;
    const served = path.join(root, objectName);
    const archived = path.join(
      path.dirname(served),
      '_source',
      path.basename(served),
    );
    const source = fs.existsSync(archived) ? archived : served;
    if (!fs.existsSync(source)) return;
    const { lowMem } = optimizeProfile({
      heapMb: resolveHeapMb(),
      inputBytes: fs.statSync(source).size,
      totalMem: os.totalmem(),
    });
    if (lowMem) {
      this.logger.log(
        `New 2D tiles for ${schoolId}: 3D model not re-processed automatically (large original, low-memory path) — use Reprocess on a bigger worker`,
      );
      return;
    }
    const r = await this.glbReoptimize.startForSchool(schoolId);
    this.logger.log(
      `New 2D tiles for ${schoolId}: 3D model re-processing ${r.reason}`,
    );
  }

  /**
   * Hand a coordinate read from an uploaded file to SchoolLocationService —
   * the one place that decides whether it replaces the school's location
   * (a KMZ upload always does; a 3D model only fills a missing or
   * model-derived point; a restore / re-optimise never does).
   */
  private async syncSchoolCoordinate(
    schoolId: string,
    coord: DerivedCoordinate | null,
    kind: 'kmz' | 'glb' | 'restore' = 'kmz',
  ): Promise<void> {
    if (!this.schoolLocation) return;
    await this.schoolLocation.setDerived(schoolId, coord, kind);
  }

  async processGeospatialBuffer(
    schoolId: string,
    fileBuffer: Buffer,
    fileName: string,
    publicKmzPath?: string,
  ): Promise<any> {
    try {
      const geojsonFeatures: any[] = [];
      const buildings: SchoolBuilding[] = [];
      let modelMap: Record<string, string> = {};

      if (fileName.toLowerCase().endsWith('.kmz')) {
        let zipFile: JSZip;
        let kmlFiles: string[];

        // Zip-bomb / path-traversal guard (WS9.7). Outside the try below so
        // a rejected archive never falls through to the unzipper fallback.
        assertSafeZip(fileBuffer, kmzZipLimits());

        try {
          // 1. Load JSZip
          const jszipInstance: any = await JSZip.loadAsync(fileBuffer);
          zipFile = jszipInstance as unknown as JSZip;
          kmlFiles = Object.keys(jszipInstance.files).filter((name: string) =>
            name.toLowerCase().endsWith('.kml'),
          );

          if (kmlFiles.length === 0) {
            throw new Error('No KML file found inside KMZ');
          }

          // 2. Extract EVERYTHING from zip to preserve structure
          const extraction = await this.extractKmzArchive(
            schoolId,
            zipFile as any,
          );
          modelMap = extraction.modelMap;
          const rootKmlPath = extraction.rootKmlPath;
          const thumbnailUrl = extraction.thumbnailUrl;

          // 3. Process KML Files
          const parser = new xml2js.Parser({
            explicitArray: false,
            mergeAttrs: true,
          });

          const allOverlays: any[] = [];
          const allViews: any[] = [];

          const rootKmlFile =
            kmlFiles.find((p) => p.toLowerCase().endsWith('doc.kml')) ||
            kmlFiles[0];
          let rootInitialView = null;

          for (const kmlPath of kmlFiles) {
            const content = await zipFile.files[kmlPath].async('string');
            const parsed = await parser
              .parseStringPromise(content)
              .catch(() => null);
            if (!parsed) continue;

            const { placemarks, overlays, views } =
              this.extractKmlFeatures(parsed);

            const parsedOverlays = overlays
              .map((o) => this.parseGroundOverlay(o, modelMap))
              .filter((o) => !!o);
            const parsedViews = views
              .map((v) => this.parseKmlView(v))
              .filter((v) => !!v);

            allOverlays.push(...parsedOverlays);
            allViews.push(...parsedViews);

            if (
              kmlPath === rootInitialView ||
              (kmlPath.toLowerCase().includes('doc.kml') && !rootInitialView)
            ) {
              if (parsedViews.length > 0) rootInitialView = parsedViews[0];
            }

            for (const pm of placemarks) {
              const feature = this.placemarkToGeoJson(pm);
              if (feature) geojsonFeatures.push(feature);

              const modelData = this.parseModel(pm, modelMap);
              if (modelData) {
                const b = this.buildingRepository.create({
                  schoolId,
                  name: modelData.name,
                  modelPath: modelData.modelPath,
                  modelName: modelData.modelName,
                  modelMetadata: modelData.modelMetadata,
                  centroidLat: modelData.modelMetadata.location.lat,
                  centroidLng: modelData.modelMetadata.location.lng,
                });
                buildings.push(b);

                // Priority coordinate sync: use the first model's location as school location if missing/far
                if (buildings.length === 1) {
                  await this.schoolRepository.update(schoolId, {
                    latitude: b.centroidLat,
                    longitude: b.centroidLng,
                  });
                }
              }
            }
          }

          if (rootKmlPath) publicKmzPath = rootKmlPath;
          if (thumbnailUrl) {
            await this.schoolRepository.update(schoolId, { thumbnailUrl });
          }

          const initialView = rootInitialView || allViews[0] || null;
          const overlaysMetadata = allOverlays;

          // Relative, same-origin path (matches StorageService.urlPrefix). The
          // client prepends its file-server base; nginx serves it in prod.
          const assetsBaseUrl = `/files/schools/${schoolId}/kmz_content`;

          const updatedGeoJson = {
            type: 'FeatureCollection',
            features: geojsonFeatures.map((f) => ({
              ...f,
              properties: {
                ...f.properties,
                description: this.rewriteKmlDescription(
                  f.properties?.description,
                  assetsBaseUrl,
                ),
              },
            })),
            properties: {
              initialView,
              overlays: overlaysMetadata,
            },
          };

          await this.schoolRepository.update(schoolId, {
            geojsonContent: updatedGeoJson as any,
            kmzStatus: KmzProcessingStatus.COMPLETED,
            kmzFilePath: publicKmzPath || fileName,
            kmzMasterKmlPath: rootKmlPath || undefined,
            kmzProcessedAt: new Date(),
          });

          // Keep the school's coordinates in sync with the uploaded KMZ
          // (authored view, ground-overlay bounds, or placemark centroid).
          await this.syncSchoolCoordinate(
            schoolId,
            pickKmlCoordinate({
              initialView,
              groundOverlays: overlaysMetadata as any,
              points: geojsonFeatures
                .filter((f) => f?.geometry?.type === 'Point')
                .map(
                  (f) =>
                    [
                      Number(f.geometry.coordinates?.[0]),
                      Number(f.geometry.coordinates?.[1]),
                    ] as [number, number],
                ),
            }),
          ).catch(() => {});
        } catch (zipError: any) {
          this.logger.warn(
            `JSZip failed: ${zipError.message}, trying unzipper`,
          );
          // Fallback to unzipper for problematic ZIP files
          const result = await this.extractKmzWithUnzipper(
            schoolId,
            fileBuffer,
          );
          modelMap = result.modelMap;

          // Process KML files
          const parser = new xml2js.Parser({
            explicitArray: false,
            mergeAttrs: true,
          });
          for (const kmlData of result.kmlFiles) {
            const parsed = await parser
              .parseStringPromise(kmlData.content)
              .catch(() => null);
            if (!parsed) continue;
            const { placemarks } = this.extractKmlFeatures(parsed);
            for (const pm of placemarks) {
              const feature = this.placemarkToGeoJson(pm);
              if (feature) geojsonFeatures.push(feature);
              const modelData = this.parseModel(pm, modelMap);
              if (modelData) {
                buildings.push(
                  this.buildingRepository.create({
                    schoolId,
                    name: modelData.name,
                    modelPath: modelData.modelPath,
                    modelName: modelData.modelName,
                    modelMetadata: modelData.modelMetadata,
                    centroidLat: modelData.modelMetadata.location.lat,
                    centroidLng: modelData.modelMetadata.location.lng,
                  }),
                );
              }
            }
          }

          await this.schoolRepository.update(schoolId, {
            geojsonContent: {
              type: 'FeatureCollection',
              features: geojsonFeatures,
            } as any,
            kmzStatus: KmzProcessingStatus.COMPLETED,
            kmzFilePath: fileName,
            kmzMasterKmlPath: result.rootKmlPath || undefined,
            kmzProcessedAt: new Date(),
            thumbnailUrl: result.thumbnailUrl || undefined,
          });

          // Save boundaries and buildings
          await this.boundaryRepository.delete({ schoolId });
          const boundaries = geojsonFeatures
            .filter(
              (f) =>
                f.geometry?.type === 'Polygon' ||
                f.geometry?.type === 'MultiPolygon',
            )
            .map((f) =>
              this.boundaryRepository.create({
                schoolId,
                name: f.properties?.name || 'Boundary',
                boundaryType: BoundaryType.CAMPUS,
                geojson: f.geometry,
                sourceFile: fileName,
                kmlPlacemarkId: f.id,
                properties: f.properties,
              }),
            );
          if (boundaries.length > 0)
            await this.boundaryRepository.save(boundaries);
          if (buildings.length > 0) {
            await this.buildingRepository.delete({ schoolId });
            await this.buildingRepository.save(buildings);
            this.eventEmitter?.emit('school.updated', { schoolId });
          }

          return {
            placemarkCount: geojsonFeatures.length,
            modelCount: buildings.length,
            status: 'completed',
            data: { type: 'FeatureCollection', features: geojsonFeatures },
          };
        }
      } else {
        const parser = new xml2js.Parser({
          explicitArray: false,
          mergeAttrs: true,
        });
        const parsed = await parser.parseStringPromise(
          fileBuffer.toString('utf-8'),
        );
        const { placemarks, views } = this.extractKmlFeatures(parsed);

        for (const pm of placemarks) {
          const feature = this.placemarkToGeoJson(pm);
          if (feature) geojsonFeatures.push(feature);
        }

        const initialView =
          views.length > 0 ? this.parseKmlView(views[0]) : null;

        await this.schoolRepository.update(schoolId, {
          geojsonContent: {
            type: 'FeatureCollection',
            features: geojsonFeatures,
            properties: { initialView },
          } as any,
          kmzStatus: KmzProcessingStatus.COMPLETED,
          kmzFilePath: publicKmzPath || fileName,
          kmzProcessedAt: new Date(),
        });
      }

      // Restore boundary and building updates
      await this.boundaryRepository.delete({ schoolId });
      const boundaries = geojsonFeatures
        .filter(
          (f) =>
            f.geometry?.type === 'Polygon' ||
            f.geometry?.type === 'MultiPolygon',
        )
        .map((f) =>
          this.boundaryRepository.create({
            schoolId,
            name: f.properties?.name || 'Boundary',
            boundaryType: BoundaryType.CAMPUS,
            geojson: f.geometry,
            sourceFile: fileName,
            kmlPlacemarkId: f.id,
            properties: f.properties,
          }),
        );
      if (boundaries.length > 0) await this.boundaryRepository.save(boundaries);

      if (buildings.length > 0) {
        await this.buildingRepository.delete({ schoolId });
        await this.buildingRepository.save(buildings);
        this.eventEmitter?.emit('school.updated', { schoolId });
      }

      const updatedSchool = await this.schoolRepository.findOne({
        where: { id: schoolId },
      });

      return {
        placemarkCount: geojsonFeatures.length,
        modelCount: buildings.length,
        status: 'completed',
        data: updatedSchool?.geojsonContent || {
          type: 'FeatureCollection',
          features: geojsonFeatures,
        },
      };
    } catch (error) {
      await this.schoolRepository.update(schoolId, {
        kmzStatus: KmzProcessingStatus.FAILED,
      });
      // Clean up any partially-extracted kmz_content so the DB and disk stay in sync
      await this.storageService.deleteDirectory(
        `schools/${schoolId}/kmz_content`,
      );
      throw error;
    }
  }

  private async extractKmzArchive(
    schoolId: string,
    zip: JSZip,
  ): Promise<{
    rootKmlPath: string | null;
    thumbnailUrl: string | null;
    modelMap: Record<string, string>;
  }> {
    const modelMap: Record<string, string> = {};
    let rootKmlPath: string | null = null;
    let thumbnailUrl: string | null = null;

    const files = Object.keys(zip.files).filter((f) => !f.endsWith('/'));
    // Header sizes can lie; count what is really decompressed.
    const budget = new ExtractionBudget(kmzZipLimits());

    // Batch processing to avoid overhead but some concurrency
    const BATCH_SIZE = 50;
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (fileName) => {
          const file = zip.files[fileName];
          const buffer = await file.async('nodebuffer');
          budget.add(fileName, buffer.length);
          const contentType = this.getContentType(fileName);

          const publicPath = await this.storageService.uploadFile(
            `schools/${schoolId}/kmz_content/${fileName}`,
            buffer as any,
            contentType,
          );

          if (!publicPath) {
            // Throw so the whole extraction fails atomically — prevents DB being
            // updated with a kmzMasterKmlPath whose referenced assets are missing
            throw new Error(`Failed to extract KMZ asset: ${fileName}`);
          }

          this.logger.log(`Extracted KMZ member: ${fileName} -> ${publicPath}`);

          // Identify root KML (prefer doc.kml in the root)
          if (fileName.toLowerCase().endsWith('.kml')) {
            if (
              !rootKmlPath ||
              fileName.toLowerCase() === 'doc.kml' ||
              fileName.toLowerCase() === 'index.kml'
            ) {
              rootKmlPath = publicPath;
              this.logger.log(`Identified root KML: ${fileName}`);
            }
          }

          // Identify thumbnail or first image
          if (/\.(png|jpg|jpeg|webp)$/i.test(fileName)) {
            const isExplicitThumb =
              fileName.toLowerCase().includes('thumb') ||
              fileName.toLowerCase().includes('preview') ||
              fileName.toLowerCase().includes('logo');
            if (!thumbnailUrl || isExplicitThumb) {
              thumbnailUrl = publicPath;
            }
          }

          // Map models
          if (
            fileName.toLowerCase().endsWith('.dae') ||
            fileName.toLowerCase().endsWith('.glb')
          ) {
            modelMap[fileName] = publicPath;
          }
        }),
      );
    }

    return { rootKmlPath, thumbnailUrl, modelMap };
  }

  private getContentType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const map: Record<string, string> = {
      kml: 'application/vnd.google-earth.kml+xml',
      kmz: 'application/vnd.google-earth.kmz',
      dae: 'model/vnd.collada+xml',
      glb: 'model/gltf-binary',
      gltf: 'model/gltf+json',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      tga: 'image/x-targa',
      bmp: 'image/bmp',
      dds: 'image/vnd-ms.dds',
    };
    return map[ext || ''] || 'application/octet-stream';
  }

  private parseModel(placemark: any, modelMap: Record<string, string>): any {
    const model = placemark.Model;
    if (!model) return null;

    const href = model.Link?.href || model.Link;
    // Try to find exact match or relative match in modelMap
    const modelPath =
      modelMap[href] ||
      Object.values(modelMap).find((p) => p.endsWith(href)) ||
      null;

    // KML orientation often needs normalization or defaults
    const loc = model.Location || {};
    const ori = model.Orientation || {};
    const sca = model.Scale || {};

    return {
      name: placemark.name || 'Structural Model',
      modelPath,
      modelName: href,
      modelMetadata: {
        location: {
          lat: Number(loc.latitude || 0),
          lng: Number(loc.longitude || 0),
          alt: Number(loc.altitude || 0),
        },
        orientation: {
          heading: Number(ori.heading || 0),
          tilt: Number(ori.tilt || 0),
          roll: Number(ori.roll || 0),
        },
        scale: {
          x: Number(sca.x || 1),
          y: Number(sca.y || 1),
          z: Number(sca.z || 1),
        },
        altitudeMode: model.altitudeMode || 'absolute',
      },
    };
  }

  async getKmzStatus(schoolId: string) {
    const school = await this.schoolRepository.findOne({
      where: { id: schoolId },
    });
    if (!school) throw new NotFoundException(`School ${schoolId} not found`);

    // Models processed before detail measurement existed: measure once.
    this.ensureModelQuality(school);

    return {
      schoolId,
      status: school.kmzStatus,
      kmzFilePath: school.kmzFilePath ?? null,
      kmz2dFilePath: school.kmz2dFilePath ?? null,
      processedAt: school.kmzProcessedAt ?? null,
      // 3D-model optimize telemetry — lets the viewer avoid auto-downloading a
      // raw multi-GB GLB and show a "preparing on server" state instead.
      modelOptimized: school.modelOptimized ?? null,
      modelBytes: school.modelBytes == null ? null : Number(school.modelBytes),
      modelOptimizeError: school.modelOptimizeError ?? null,
      modelOptimizedAt: school.modelOptimizedAt ?? null,
      // Detail: cm of surface per texture pixel, served vs delivered.
      modelQuality: school.modelQuality ?? null,
      modelVariants: school.modelVariants ?? null,
      // Scale check vs the KMZ footprint (WS6.4) and the model-frame origin
      // the viewers use to convert model ↔ WGS84 (WS5.3).
      modelScaleFactor: school.modelScaleFactor ?? null,
      modelScaleWarning: school.modelScaleWarning ?? null,
      modelOrigin:
        school.modelOriginLat != null && school.modelOriginLng != null
          ? {
              lat: Number(school.modelOriginLat),
              lng: Number(school.modelOriginLng),
              alt: Number(school.modelOriginAlt ?? 0),
            }
          : null,
    };
  }

  async getKmzContent(schoolId: string) {
    const school = await this.schoolRepository.findOne({
      where: { id: schoolId },
    });
    if (!school) throw new NotFoundException(`School ${schoolId} not found`);

    return {
      schoolId,
      kmzStatus: school.kmzStatus,
      processedAt: school.kmzProcessedAt,
      geojsonContent: school.geojsonContent,
    };
  }

  async getPlacesOverlayContent(schoolId: string) {
    const school = await this.schoolRepository.findOne({
      where: { id: schoolId },
    });
    if (!school) throw new NotFoundException(`School ${schoolId} not found`);

    return {
      schoolId,
      placesOverlayFilePath: school.placesOverlayFilePath,
      placesOverlayData: school.placesOverlayData,
    };
  }

  private extractKmlFeatures(parsed: any): {
    placemarks: any[];
    overlays: any[];
    views: any[];
  } {
    const placemarks: any[] = [];
    const overlays: any[] = [];
    const views: any[] = [];

    const traverse = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;

      const lookup = (o: any, keys: string[]) => {
        for (const key of keys) {
          if (o[key]) return o[key];
        }
        return null;
      };

      // Placemark
      const pm = lookup(obj, ['Placemark', 'gx:Placemark']);
      if (pm) {
        const pms = Array.isArray(pm) ? pm : [pm];
        placemarks.push(...pms);
      }

      // GroundOverlay
      const ov = lookup(obj, ['GroundOverlay', 'gx:GroundOverlay']);
      if (ov) {
        const ovs = Array.isArray(ov) ? ov : [ov];
        overlays.push(...ovs);
      }

      // LookAt / Camera
      const la = lookup(obj, ['LookAt', 'gx:LookAt']);
      if (la) {
        const ls = Array.isArray(la) ? la : [la];
        views.push(...ls.map((l) => ({ type: 'LookAt', ...l })));
      }

      const ca = lookup(obj, ['Camera', 'gx:Camera']);
      if (ca) {
        const cs = Array.isArray(ca) ? ca : [ca];
        views.push(...cs.map((c) => ({ type: 'Camera', ...c })));
      }

      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'object') traverse(obj[key]);
      }
    };

    traverse(parsed);
    return { placemarks, overlays, views };
  }

  private getKmlValue(val: any): string {
    if (val === undefined || val === null) return '';
    if (Array.isArray(val)) return this.getKmlValue(val[0]);
    if (typeof val === 'string') return val;
    if (typeof val === 'object') {
      return (
        val._text ||
        val._ ||
        (val.$ ? val._ : '') ||
        (val.toString && val.toString() !== '[object Object]'
          ? val.toString()
          : '') ||
        ''
      );
    }
    return String(val);
  }

  private parseKmlView(view: any): any {
    if (!view) return null;
    return {
      type: view.type,
      longitude: Number(this.getKmlValue(view.longitude) || 0),
      latitude: Number(this.getKmlValue(view.latitude) || 0),
      altitude: Number(this.getKmlValue(view.altitude) || 0),
      heading: Number(this.getKmlValue(view.heading) || 0),
      tilt: Number(this.getKmlValue(view.tilt) || 0),
      roll: Number(this.getKmlValue(view.roll) || 0),
      range: Number(this.getKmlValue(view.range) || 1200),
      altitudeMode: this.getKmlValue(view.altitudeMode) || 'relativeToGround',
    };
  }

  private parseGroundOverlay(
    overlay: any,
    modelMap: Record<string, string>,
  ): any {
    const icon = overlay.Icon;
    if (!icon) return null;

    const href = this.getKmlValue(icon.href);
    const imagePath =
      modelMap[href] ||
      Object.values(modelMap).find((p) => p.endsWith(href)) ||
      null;

    const box = overlay.LatLonBox || {};
    return {
      name: this.getKmlValue(overlay.name) || 'Ground Overlay',
      imagePath,
      bounds: {
        north: Number(this.getKmlValue(box.north) || 0),
        south: Number(this.getKmlValue(box.south) || 0),
        east: Number(this.getKmlValue(box.east) || 0),
        west: Number(this.getKmlValue(box.west) || 0),
      },
      color: this.getKmlValue(overlay.color) || 'ffffffff',
      visibility: this.getKmlValue(overlay.visibility) !== '0',
    };
  }

  private placemarkToGeoJson(placemark: any): any {
    // ... (rest of the file as before)
    try {
      const name = placemark.name?._text || placemark.name || 'Unknown';
      const description =
        placemark.description?._text || placemark.description || '';

      // 1. Polygon
      if (placemark.Polygon) {
        const coords = this.parseKmlCoordinates(
          placemark.Polygon?.outerBoundaryIs?.LinearRing?.coordinates,
        );
        if (coords) {
          return {
            type: 'Feature',
            id: placemark.id,
            geometry: { type: 'Polygon', coordinates: [coords] },
            properties: { name, description },
          };
        }
      }

      // 2. LineString
      if (placemark.LineString) {
        const coords = this.parseKmlCoordinates(
          placemark.LineString?.coordinates,
        );
        if (coords) {
          return {
            type: 'Feature',
            id: placemark.id,
            geometry: { type: 'LineString', coordinates: coords },
            properties: { name, description },
          };
        }
      }

      // 3. Point
      if (placemark.Point) {
        const coords = this.parseKmlCoordinates(placemark.Point?.coordinates);
        if (coords && coords.length > 0) {
          return {
            type: 'Feature',
            id: placemark.id,
            geometry: { type: 'Point', coordinates: coords[0] },
            properties: { name, description },
          };
        }
      }

      // 4. MultiGeometry
      if (placemark.MultiGeometry) {
        const geometries: any[] = [];
        const mg = placemark.MultiGeometry;

        // Recursively handle sub-geometries if needed, but for now simple extract
        if (mg.Polygon) {
          const pms = Array.isArray(mg.Polygon) ? mg.Polygon : [mg.Polygon];
          for (const p of pms) {
            const coords = this.parseKmlCoordinates(
              p.outerBoundaryIs?.LinearRing?.coordinates,
            );
            if (coords)
              geometries.push({ type: 'Polygon', coordinates: [coords] });
          }
        }
        if (mg.LineString) {
          const lss = Array.isArray(mg.LineString)
            ? mg.LineString
            : [mg.LineString];
          for (const l of lss) {
            const coords = this.parseKmlCoordinates(l.coordinates);
            if (coords)
              geometries.push({ type: 'LineString', coordinates: coords });
          }
        }
        if (mg.Point) {
          const pts = Array.isArray(mg.Point) ? mg.Point : [mg.Point];
          for (const p of pts) {
            const coords = this.parseKmlCoordinates(p.coordinates);
            if (coords && coords.length > 0)
              geometries.push({ type: 'Point', coordinates: coords[0] });
          }
        }

        if (geometries.length > 0) {
          return {
            type: 'Feature',
            id: placemark.id,
            geometry: { type: 'GeometryCollection', geometries },
            properties: { name, description },
          };
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  private rewriteKmlDescription(description: string, baseUrl: string): string {
    if (!description || typeof description !== 'string')
      return description || '';

    // Replace relative src="path" or src='path' with baseUrl/path
    // Exclude absolute URLs and data URIs
    return description.replace(
      /(src=["'])(?!https?:\/\/|\/|data:)([^"'>]+)(["'])/gi,
      (match, p1, p2, p3) => {
        // Clean up p2 if it starts with ./
        const cleanPath = p2.startsWith('./') ? p2.substring(2) : p2;
        return `${p1}${baseUrl}/${cleanPath}${p3}`;
      },
    );
  }

  private parseKmlCoordinates(coordStr: any): number[][] | null {
    if (!coordStr) return null;

    // Handle xml2js different variations of string content
    const str =
      typeof coordStr === 'string'
        ? coordStr
        : coordStr._ ||
          (typeof coordStr === 'object' ? JSON.stringify(coordStr) : '');

    try {
      return str
        .trim()
        .split(/\s+/)
        .map((point: string) => {
          const parts = point.split(',').map(Number);
          return parts.slice(0, 3); // [lng, lat, alt]
        })
        .filter((p: number[]) => p.length >= 2 && !p.some(isNaN));
    } catch {
      return null;
    }
  }

  // Alternative KMZ extraction using unzipper for problematic ZIP files
  private async extractKmzWithUnzipper(
    schoolId: string,
    fileBuffer: Buffer,
  ): Promise<{
    rootKmlPath: string | null;
    thumbnailUrl: string | null;
    modelMap: Record<string, string>;
    kmlFiles: { name: string; content: string }[];
  }> {
    const modelMap: Record<string, string> = {};
    let rootKmlPath: string | null = null;
    let thumbnailUrl: string | null = null;
    const kmlFiles: { name: string; content: string }[] = [];

    // Create a Readable stream from the buffer
    const readable = Readable.from(fileBuffer);
    const directory = readable.pipe(unzipper.Parse({ forceStream: true }));
    const limits = kmzZipLimits();
    const budget = new ExtractionBudget(limits);

    for await (const entry of directory) {
      const fileName = entry.path;
      const type = entry.type; // 'Directory' or 'File'
      // Rejects traversal names and counts entries before any bytes are read.
      budget.add(fileName, 0);

      if (type === 'Directory') {
        entry.autodrain();
        continue;
      }

      try {
        const chunks: Buffer[] = [];
        let entryBytes = 0;
        for await (const chunk of entry) {
          entryBytes += chunk.length;
          // Stop mid-entry rather than buffering a bomb in memory.
          if (budget.bytes + entryBytes > limits.maxTotalUncompressed)
            budget.add(fileName, entryBytes);
          chunks.push(chunk);
        }
        budget.add(fileName, entryBytes);
        const buffer = Buffer.concat(chunks);
        const contentType = this.getContentType(fileName);

        const publicPath = await this.storageService.uploadFile(
          `schools/${schoolId}/kmz_content/${fileName}`,
          buffer as any,
          contentType,
        );

        if (!publicPath) {
          throw new Error(
            `Failed to extract KMZ asset (unzipper): ${fileName}`,
          );
        }

        this.logger.log(`Extracted (unzipper): ${fileName} -> ${publicPath}`);

        // Identify KML files
        if (fileName.toLowerCase().endsWith('.kml')) {
          kmlFiles.push({
            name: fileName,
            content: buffer.toString('utf-8'),
          });
          if (!rootKmlPath || fileName.toLowerCase() === 'doc.kml') {
            rootKmlPath = publicPath;
          }
        }

        // Identify thumbnail
        if (/\.(png|jpg|jpeg|webp)$/i.test(fileName)) {
          if (!thumbnailUrl || fileName.toLowerCase().includes('thumb')) {
            thumbnailUrl = publicPath;
          }
        }

        // Map models
        if (
          fileName.toLowerCase().endsWith('.dae') ||
          fileName.toLowerCase().endsWith('.glb')
        ) {
          modelMap[fileName] = publicPath;
        }
      } catch (err) {
        this.logger.error(`Error processing ${fileName}: ${err}`);
        entry.autodrain();
      }
    }

    return { rootKmlPath, thumbnailUrl, modelMap, kmlFiles };
  }

  async generateModelKmz(schoolId: string, res: Response) {
    const school = await this.schoolRepository.findOne({
      where: { id: schoolId },
    });
    if (!school) throw new NotFoundException(`School ${schoolId} not found`);

    let daePath = '';
    const uploadDir = path.join(
      process.cwd(),
      'public',
      'uploads',
      'schools',
      schoolId,
      'kmz_content',
    );

    if (fs.existsSync(uploadDir)) {
      const files = fs.readdirSync(uploadDir);
      const daeFile = files.find(
        (f) =>
          f.toLowerCase().endsWith('.dae') || f.toLowerCase().endsWith('.glb'),
      );
      if (daeFile) {
        daePath = path.join(uploadDir, daeFile);
      }
    }

    if (!daePath || !fs.existsSync(daePath)) {
      throw new NotFoundException(
        `No 3D .dae or .glb model found for school ${schoolId}`,
      );
    }

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.google-earth.kmz');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${school.name.replace(/[^a-zA-Z0-9]/g, '_')}_3D_Model.kmz"`,
    );

    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (err) => {
      this.logger.error(`Error generating KMZ archive for ${schoolId}`, err);
      if (!res.headersSent) {
        res.status(500).send({ message: 'Failed to generate KMZ' });
      }
    });

    archive.pipe(res);

    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Placemark>
    <name>${school.name} 3D Model</name>
    <Model>
      <altitudeMode>relativeToGround</altitudeMode>
      <Location>
        <longitude>${school.longitude || 0}</longitude>
        <latitude>${school.latitude || 0}</latitude>
        <altitude>${school.elevation || 0}</altitude>
      </Location>
      <Orientation>
        <heading>0</heading>
        <tilt>0</tilt>
        <roll>0</roll>
      </Orientation>
      <Scale>
        <x>1</x><y>1</y><z>1</z>
      </Scale>
      <Link>
        <href>models/${path.basename(daePath)}</href>
      </Link>
    </Model>
  </Placemark>
</kml>`;

    archive.append(kml, { name: 'doc.kml' });
    archive.file(daePath, { name: `models/${path.basename(daePath)}` });

    // Include other files (textures, etc.) from the kmz_content folder
    if (fs.existsSync(uploadDir)) {
      const files = fs.readdirSync(uploadDir);
      for (const f of files) {
        if (
          !f.toLowerCase().endsWith('.dae') &&
          !f.toLowerCase().endsWith('.glb') &&
          !f.toLowerCase().endsWith('.kml')
        ) {
          archive.file(path.join(uploadDir, f), { name: `models/${f}` });
        }
      }
    }

    archive.finalize();
  }

  async uploadPlacesOverlay(schoolId: string, file: Express.Multer.File) {
    const school = await this.schoolRepository.findOne({
      where: { id: schoolId },
    });
    if (!school) throw new NotFoundException(`School ${schoolId} not found`);

    const filename = file.originalname.toLowerCase();
    if (!filename.endsWith('.kmz') && !filename.endsWith('.kml')) {
      throw new BadRequestException('File must be a .kmz or .kml file');
    }

    // Read file from disk
    const fs = require('fs');
    const fileBuffer = fs.readFileSync(file.path);

    // Save the places overlay file
    const filePath = `schools/${schoolId}/places-overlay/${file.originalname}`;
    const publicPath = await this.storageService.uploadFile(
      filePath,
      fileBuffer,
      file.mimetype,
    );

    // Process the file to extract features for overlay
    const result = await this.processPlacesOverlayBuffer(
      schoolId,
      fileBuffer,
      file.originalname,
      publicPath || undefined,
    );

    // Clean up temp file
    try {
      fs.unlinkSync(file.path);
    } catch (e) {
      this.logger.warn(`Failed to clean up temp file: ${file.path}`);
    }

    return {
      message: 'Places overlay file uploaded and processed successfully',
      schoolId,
      ...result,
    };
  }

  private async processPlacesOverlayBuffer(
    schoolId: string,
    fileBuffer: Buffer,
    fileName: string,
    publicPath?: string,
  ): Promise<any> {
    try {
      const geojsonFeatures: any[] = [];

      if (fileName.toLowerCase().endsWith('.kmz')) {
        assertSafeZip(fileBuffer, kmzZipLimits());
        const jszipInstance = await JSZip.loadAsync(fileBuffer);
        const kmlFiles = Object.keys(jszipInstance.files).filter(
          (name: string) => name.toLowerCase().endsWith('.kml'),
        );

        if (kmlFiles.length === 0) {
          throw new Error('No KML file found inside KMZ');
        }

        // Extract all files from the KMZ
        const extraction = await this.extractPlacesOverlayArchive(
          schoolId,
          jszipInstance as any,
        );

        // Process KML Files
        const parser = new xml2js.Parser({
          explicitArray: false,
          mergeAttrs: true,
        });

        for (const kmlPath of kmlFiles) {
          const content = await jszipInstance.files[kmlPath].async('string');
          const parsed = await parser
            .parseStringPromise(content)
            .catch(() => null);
          if (!parsed) continue;

          const { placemarks } = this.extractKmlFeatures(parsed);

          for (const pm of placemarks) {
            const feature = this.placemarkToGeoJson(pm);
            if (feature) geojsonFeatures.push(feature);
          }
        }
      } else {
        // Process KML file directly
        const parser = new xml2js.Parser({
          explicitArray: false,
          mergeAttrs: true,
        });
        const parsed = await parser.parseStringPromise(
          fileBuffer.toString('utf-8'),
        );
        const { placemarks } = this.extractKmlFeatures(parsed);

        for (const pm of placemarks) {
          const feature = this.placemarkToGeoJson(pm);
          if (feature) geojsonFeatures.push(feature);
        }
      }

      const placesOverlayData = {
        type: 'FeatureCollection',
        features: geojsonFeatures,
        properties: {
          sourceFile: fileName,
          uploadedAt: new Date().toISOString(),
        },
      };

      console.log(
        '[PlacesOverlay] Generated GeoJSON:',
        JSON.stringify(placesOverlayData, null, 2).substring(0, 500),
      );

      await this.schoolRepository.update(schoolId, {
        placesOverlayFilePath: publicPath || fileName,
        placesOverlayData: placesOverlayData as any,
      });

      return {
        placemarkCount: geojsonFeatures.length,
        status: 'completed',
        data: placesOverlayData,
      };
    } catch (error: any) {
      this.logger.error(`Failed to process places overlay: ${error.message}`);
      throw error;
    }
  }

  private async extractPlacesOverlayArchive(
    schoolId: string,
    zip: JSZip,
  ): Promise<{
    modelMap: Record<string, string>;
  }> {
    const modelMap: Record<string, string> = {};

    const files = Object.keys(zip.files).filter((f) => !f.endsWith('/'));
    const budget = new ExtractionBudget(kmzZipLimits());

    const BATCH_SIZE = 50;
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (fileName) => {
          const file = zip.files[fileName];
          const buffer = await file.async('nodebuffer');
          budget.add(fileName, buffer.length);
          const contentType = this.getContentType(fileName);

          const publicPath = await this.storageService.uploadFile(
            `schools/${schoolId}/places-overlay_content/${fileName}`,
            buffer as any,
            contentType,
          );

          if (!publicPath) {
            this.logger.error(
              `FAILED to extract file from places overlay KMZ: ${fileName}`,
            );
            return;
          }

          this.logger.log(
            `Extracted places overlay KMZ member: ${fileName} -> ${publicPath}`,
          );

          // Map model files for reference
          if (
            fileName.toLowerCase().endsWith('.dae') ||
            fileName.toLowerCase().endsWith('.glb')
          ) {
            modelMap[fileName] = publicPath;
          }
        }),
      );
    }

    return { modelMap };
  }

  /**
   * Upload a 2D-specific KMZ/KML file for the OpenLayers viewer.
   * Extracts all assets server-side and stores a pre-computed manifest
   * so the client does NOT need to download and unzip the raw KMZ.
   */
  /**
   * Downloads a pre-uploaded asset from the file-server to a temp file, then the
   * caller enqueues it exactly like a direct upload.
   *
   * Production-hardened: resolves relative URLs against FILE_SERVER_BASE_URL
   * (the client builds with VITE_FILE_SERVER_URL=/files, so `fileUrl` arrives as
   * `/files/...`), verifies the HTTP status, follows redirects, enforces a
   * timeout and a size ceiling, and always cleans up a partial file on failure.
   */
  private async downloadToTemp(
    fileUrl: string,
    fileName: string,
  ): Promise<string> {
    const https = require('https');
    const http = require('http');

    const base = (
      process.env.FILE_SERVER_BASE_URL || 'http://localhost:3002'
    ).replace(/\/$/, '');
    const startUrl = /^https?:\/\//i.test(fileUrl)
      ? fileUrl
      : `${base}/${fileUrl.replace(/^\/+/, '')}`;

    const maxBytes =
      parseInt(process.env.KMZ_MAX_DOWNLOAD_MB || '6144', 10) * 1024 * 1024;
    const timeoutMs = parseInt(
      process.env.KMZ_DOWNLOAD_TIMEOUT_MS || '600000',
      10,
    );

    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_') || 'upload.bin';
    const tempPath = path.join(
      KMZ_TMP_DIR,
      `rtb-upload-${Date.now()}-${safeName}`,
    );

    const fetchOnce = (url: string, redirectsLeft: number): Promise<void> =>
      new Promise<void>((resolve, reject) => {
        let settled = false;
        const done = (err?: Error) => {
          if (settled) return;
          settled = true;
          if (err) {
            fs.unlink(tempPath, () => {});
            reject(err);
          } else {
            resolve();
          }
        };

        const client = url.startsWith('https') ? https : http;
        const req = client.get(url, (res: any) => {
          const status = res.statusCode || 0;

          // Redirects
          if (status >= 300 && status < 400 && res.headers.location) {
            res.resume();
            if (redirectsLeft <= 0) {
              return done(new Error(`Too many redirects fetching ${fileUrl}`));
            }
            const next = new URL(res.headers.location, url).toString();
            return fetchOnce(next, redirectsLeft - 1).then(
              () => done(),
              (e) => done(e),
            );
          }

          if (status < 200 || status >= 300) {
            res.resume();
            return done(
              new Error(
                `File-server returned ${status} for ${fileUrl} — the asset may not have finished uploading.`,
              ),
            );
          }

          const declared = parseInt(res.headers['content-length'] || '0', 10);
          if (declared && declared > maxBytes) {
            res.destroy();
            return done(
              new Error(
                `Asset is ${Math.round(declared / 1048576)} MB — exceeds the ${Math.round(
                  maxBytes / 1048576,
                )} MB limit.`,
              ),
            );
          }

          let received = 0;
          const out = fs.createWriteStream(tempPath);
          out.on('error', done);
          res.on('error', done);
          res.on('data', (chunk: Buffer) => {
            received += chunk.length;
            if (received > maxBytes) {
              res.destroy();
              out.destroy();
              done(new Error(`Asset exceeds the download size limit.`));
            }
          });
          res.pipe(out);
          out.on('finish', () => out.close(() => done()));
        });

        req.setTimeout(timeoutMs, () => {
          req.destroy(new Error(`Timed out downloading ${fileUrl}`));
        });
        req.on('error', done);
      });

    await fetchOnce(startUrl, 3);
    return tempPath;
  }

  async uploadKmz2dFromUrl(
    schoolId: string,
    fileUrl: string,
    fileName: string,
  ) {
    const school = await this.schoolRepository.findOne({
      where: { id: schoolId },
    });
    if (!school) throw new NotFoundException(`School ${schoolId} not found`);

    const name = (
      fileName ||
      fileUrl.split('/').pop() ||
      'upload.kmz'
    ).toLowerCase();
    if (!name.endsWith('.kmz') && !name.endsWith('.kml')) {
      throw new BadRequestException('File must be a .kmz or .kml file');
    }

    const tempFilePath = await this.downloadToTemp(fileUrl, name);
    await this.schoolRepository.update(schoolId, {
      kmzStatus: KmzProcessingStatus.PROCESSING,
    });

    const job = await this.kmzQueue.add('process-kmz2d', {
      schoolId,
      tempFilePath,
      originalName: name,
      mimetype: name.endsWith('.kml')
        ? 'application/vnd.google-earth.kml+xml'
        : 'application/vnd.google-earth.kmz',
    } satisfies Kmz2dJobData);

    this.logger.log(
      `Enqueued process-kmz2d (from-url) job ${job.id} for school ${schoolId}`,
    );
    return {
      message: '2D KMZ file accepted for processing',
      schoolId,
      jobId: job.id,
      statusUrl: `/api/v1/schools/${schoolId}/kmz/status`,
    };
  }

  async uploadGlbFromUrl(schoolId: string, fileUrl: string, fileName: string) {
    const school = await this.schoolRepository.findOne({
      where: { id: schoolId },
    });
    if (!school) throw new NotFoundException(`School ${schoolId} not found`);

    const name = (
      fileName ||
      fileUrl.split('/').pop() ||
      'model.glb'
    ).toLowerCase();
    if (!name.endsWith('.glb')) {
      throw new BadRequestException('File must be a .glb file');
    }

    const tempFilePath = await this.downloadToTemp(fileUrl, name);
    await this.schoolRepository.update(schoolId, {
      kmzStatus: KmzProcessingStatus.PROCESSING,
    });

    const job = await this.kmzQueue.add('process-glb', {
      schoolId,
      tempFilePath,
      originalName: name,
      mimetype: 'model/gltf-binary',
    } satisfies GlbJobData);

    this.logger.log(
      `Enqueued process-glb (from-url) job ${job.id} for school ${schoolId}`,
    );
    return {
      message: 'GLB file accepted for processing',
      schoolId,
      jobId: job.id,
      statusUrl: `/api/v1/schools/${schoolId}/kmz/status`,
    };
  }

  async uploadKmz2d(schoolId: string, file: Express.Multer.File) {
    const school = await this.schoolRepository.findOne({
      where: { id: schoolId },
    });
    if (!school) throw new NotFoundException(`School ${schoolId} not found`);

    const filename = file.originalname.toLowerCase();
    if (!filename.endsWith('.kmz') && !filename.endsWith('.kml')) {
      throw new BadRequestException('File must be a .kmz or .kml file');
    }

    await this.schoolRepository.update(schoolId, {
      kmzStatus: KmzProcessingStatus.PROCESSING,
    });

    const job = await this.kmzQueue.add('process-kmz2d', {
      schoolId,
      tempFilePath: file.path,
      originalName: file.originalname,
      mimetype: file.mimetype,
    } satisfies Kmz2dJobData);

    this.logger.log(
      `Enqueued process-kmz2d job ${job.id} for school ${schoolId}`,
    );

    return {
      message: '2D KMZ file accepted for processing',
      schoolId,
      jobId: job.id,
      statusUrl: `/api/v1/schools/${schoolId}/kmz/status`,
    };
  }

  async processKmz2dJob(data: Kmz2dJobData): Promise<void> {
    const { schoolId, tempFilePath, originalName, mimetype } = data;
    try {
      const fileBuffer = fs.readFileSync(tempFilePath);

      const filePath = `schools/${schoolId}/kmz_2d/${originalName}`;
      const publicPath = await this.storageService.uploadFile(
        filePath,
        fileBuffer,
        mimetype,
      );

      if (!publicPath) {
        throw new Error('Failed to store 2D KMZ file in storage');
      }

      let manifest: any = null;
      try {
        manifest = await this.extractKmz2dAssets(
          schoolId,
          fileBuffer,
          originalName,
        );
        this.logger.log(
          `[2D] Manifest built for school ${schoolId}: ${manifest?.kmlUrls?.length || 0} KML(s), ${manifest?.groundOverlays?.length || 0} overlay(s)`,
        );
      } catch (err: any) {
        this.logger.warn(
          `[2D] Manifest extraction failed (client will fall back to browser processing): ${err.message}`,
        );
      }

      // The previous upload's pyramid is removed once the new one is saved.
      const previousPyramid = (
        (
          await this.schoolRepository.findOne({
            where: { id: schoolId },
            select: ['id', 'kmz2dManifest'],
          })
        )?.kmz2dManifest as Kmz2dManifestWithPyramid | null
      )?.pyramid?.buildId;
      await this.schoolRepository.update(schoolId, {
        kmzStatus: KmzProcessingStatus.COMPLETED,
        kmz2dFilePath: publicPath,
        // "building": the pyramid is made right below, in this job — the
        // viewer's one-time trigger must not queue a second build meanwhile.
        kmz2dManifest: manifest
          ? {
              ...manifest,
              pyramid: {
                status: 'building',
                queuedAt: new Date().toISOString(),
                ...(previousPyramid ? { buildId: previousPyramid } : {}),
              },
            }
          : manifest,
        kmzProcessedAt: new Date(),
      });

      // One tile pyramid for all the drone photos, so the map loads only the
      // tiles on screen (overlay-pyramid.ts). Best effort: without it the
      // viewer falls back to compositing the photos itself.
      await this.buildKmz2dPyramid(schoolId).catch((e) =>
        this.logger.warn(
          `[2D] Pyramid build failed for ${schoolId}: ${e?.message ?? e}`,
        ),
      );
      // Then the full-detail tiles, in their own (longer) background job.
      await this.queueTilesBuild(schoolId, true).catch((e) =>
        this.logger.warn(
          `[2D] Tiles not queued for ${schoolId}: ${e?.message ?? e}`,
        ),
      );

      // Sync the school's coordinates to whatever the KMZ says (authored view,
      // ground-overlay bounds, or placemark centroid).
      await this.syncSchoolCoordinate(
        schoolId,
        manifest?.derivedCenter ?? null,
      ).catch(() => {});

      this.logger.log(`2D KMZ processing completed for school ${schoolId}`);
    } catch (err: any) {
      this.logger.error(
        `2D KMZ processing failed for school ${schoolId}: ${err.message}`,
      );
      await this.schoolRepository.update(schoolId, {
        kmzStatus: KmzProcessingStatus.FAILED,
      });
      throw err;
    } finally {
      try {
        fs.unlinkSync(tempFilePath);
      } catch {
        /* already gone */
      }
    }
  }

  /**
   * Return pre-computed 2D manifest for the viewer.
   * Includes resolved absolute URLs for KML files and ground overlay images.
   */
  async getKmz2dManifest(schoolId: string) {
    const school = await this.schoolRepository.findOne({
      where: { id: schoolId },
    });
    if (!school) throw new NotFoundException(`School ${schoolId} not found`);

    // Site maps uploaded before tile pyramids existed get one built once,
    // in the background (from the photos already stored; the school's
    // location is not touched).
    const manifest = school.kmz2dManifest as Kmz2dManifestWithPyramid | null;
    if (
      manifest &&
      (!manifest.pyramid ||
        manifest.pyramid.status === 'queued' ||
        manifest.pyramid.status === 'building') &&
      pyramidPhotos(manifest).length
    ) {
      await this.queuePyramidBuild(schoolId).catch(() => null);
    } else if (
      manifest?.pyramid?.status === 'ready' &&
      !manifest.tiles &&
      pyramidPhotos(manifest).length
    ) {
      // …and the full-detail tiles once, after the pyramid.
      await this.queueTilesBuild(schoolId).catch(() => null);
    }

    return {
      schoolId,
      manifest: school.kmz2dManifest ?? null,
      kmz2dFilePath: school.kmz2dFilePath ?? null,
    };
  }

  /** Queue a pyramid build for a school (deduplicated per school). */
  async queuePyramidBuild(
    schoolId: string,
    force = false,
  ): Promise<{ queued: boolean }> {
    const school = await this.schoolRepository.findOne({
      where: { id: schoolId },
      select: ['id', 'kmz2dManifest'],
    });
    const manifest = school?.kmz2dManifest as Kmz2dManifestWithPyramid | null;
    if (!manifest || !pyramidPhotos(manifest).length) return { queued: false };
    // A queued build that never ran (queue restarted) is retried after 30 min.
    const rawQueuedAt: unknown = manifest.pyramid?.queuedAt;
    const queuedAt =
      typeof rawQueuedAt === 'string' ? Date.parse(rawQueuedAt) : NaN;
    const stale =
      !Number.isFinite(queuedAt) || Date.now() - queuedAt > 30 * 60_000;
    const pending =
      manifest.pyramid?.status === 'queued' ||
      manifest.pyramid?.status === 'building';
    if (pending && !stale && !force) return { queued: false };
    await this.schoolRepository.update(schoolId, {
      kmz2dManifest: {
        ...manifest,
        pyramid: { status: 'queued', queuedAt: new Date().toISOString() },
      } as any,
    });
    await this.kmzQueue.add(
      'build-pyramid',
      { schoolId },
      {
        jobId: `pyramid-${schoolId}-${Date.now()}`,
        attempts: 2,
        backoff: { type: 'exponential' as const, delay: 30_000 },
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    );
    return { queued: true };
  }

  /**
   * Build the site map's tile pyramid from its stored photos and record it in
   * the manifest (`manifest.pyramid`). Each build gets its own folder, so the
   * file server can cache tiles for a year; older builds are removed.
   */
  async buildKmz2dPyramid(schoolId: string): Promise<boolean> {
    const school = await this.schoolRepository.findOne({
      where: { id: schoolId },
      select: ['id', 'kmz2dManifest'],
    });
    const manifest = school?.kmz2dManifest as Kmz2dManifestWithPyramid | null;
    const photos = manifest ? pyramidPhotos(manifest) : [];
    if (!manifest) return false;
    if (!photos.length) {
      // Nothing to combine (e.g. one large image, already tiled on upload).
      if (manifest.pyramid?.status !== 'none') {
        await this.schoolRepository.update(schoolId, {
          kmz2dManifest: { ...manifest, pyramid: { status: 'none' } } as any,
        });
      }
      return false;
    }

    const started = Date.now();
    const buildId = started.toString(36);
    const outDir = path.join(KMZ_TMP_DIR, `pyramid_${schoolId}_${buildId}`);
    /** Save the result; returns the build it replaced (to clean up). */
    const save = async (
      pyramid: Record<string, unknown>,
    ): Promise<string | null> => {
      // Re-read: the manifest may have changed while we were building.
      const fresh = await this.schoolRepository.findOne({
        where: { id: schoolId },
        select: ['id', 'kmz2dManifest'],
      });
      if (!fresh?.kmz2dManifest) return null;
      const previous = (fresh.kmz2dManifest as Kmz2dManifestWithPyramid).pyramid
        ?.buildId;
      await this.schoolRepository.update(schoolId, {
        kmz2dManifest: { ...fresh.kmz2dManifest, pyramid } as any,
      });
      return typeof previous === 'string' ? previous : null;
    };

    try {
      const built = await buildOverlayPyramid(
        photos.map((o) => ({
          north: Number(o.north),
          south: Number(o.south),
          east: Number(o.east),
          west: Number(o.west),
          drawOrder: Number(o.drawOrder) || 0,
          load: () => this.storageService.readFile(String(o.imageUrl)),
        })),
        {
          outDir,
          maxPx: Number(process.env.KMZ_PYRAMID_MAX_PX) || 8192,
        },
      );
      if (!built) {
        await save({ status: 'failed', reason: 'no usable photos' });
        return false;
      }

      const root = `schools/${schoolId}/kmz_2d_content/_pyramid`;
      const prefix = `${root}/${buildId}`;
      await this.uploadDirectory(outDir, prefix);
      const sample = await this.storageService.getFileUrl(
        `${prefix}/0/0/0.webp`,
      );
      const base = (sample ?? `/files/${prefix}/0/0/0.webp`).replace(
        /\/0\/0\/0\.webp(\?.*)?$/,
        '',
      );

      const replaced = await save({
        status: 'ready',
        buildId,
        url: `${base}/{z}/{y}/{x}.webp`,
        maxZoom: built.maxZoom,
        resolution: built.resolution,
        origin: built.origin,
        extent: built.extent,
        width: built.width,
        height: built.height,
        photos: built.used,
        tiles: built.tiles,
        builtAt: new Date().toISOString(),
      });
      // Only now, with the new tiles in place, drop the build they replace.
      if (replaced && replaced !== buildId) {
        await this.storageService
          .deleteDirectory(`${root}/${replaced}`)
          .catch(() => null);
      }
      this.logger.log(
        `[2D] Pyramid for ${schoolId}: ${built.used}/${built.total} photos -> ${built.width}x${built.height}px, ` +
          `${built.tiles} tiles, z0-${built.maxZoom}, ${Date.now() - started} ms`,
      );
      return true;
    } catch (err) {
      await save({
        status: 'failed',
        reason: (err as Error).message?.slice(0, 200),
      }).catch(() => null);
      throw err;
    } finally {
      await fs.promises
        .rm(outDir, { recursive: true, force: true })
        .catch(() => null);
    }
  }

  /**
   * Queue a full-detail tiles build (deduplicated per school; a build left
   * queued for 30 min, e.g. after a queue restart, is queued again).
   */
  async queueTilesBuild(
    schoolId: string,
    force = false,
  ): Promise<{ queued: boolean; reason?: string }> {
    const school = await this.schoolRepository.findOne({
      where: { id: schoolId },
      select: ['id', 'kmz2dManifest'],
    });
    const manifest = school?.kmz2dManifest as Kmz2dManifestWithPyramid | null;
    if (!manifest || !pyramidPhotos(manifest).length)
      return { queued: false, reason: 'no-photos' };
    if (await this.activeTilesJob(schoolId))
      return { queued: false, reason: 'already-running' };
    const rawQueuedAt: unknown = manifest.tiles?.queuedAt;
    const queuedAt =
      typeof rawQueuedAt === 'string' ? Date.parse(rawQueuedAt) : NaN;
    const stale =
      !Number.isFinite(queuedAt) || Date.now() - queuedAt > 30 * 60_000;
    const pending =
      manifest.tiles?.status === 'queued' ||
      manifest.tiles?.status === 'building';
    if (pending && !stale && !force)
      return { queued: false, reason: 'already-running' };
    const keep = manifest.tiles?.status === 'ready' ? manifest.tiles : null;
    await this.schoolRepository.update(schoolId, {
      kmz2dManifest: {
        ...manifest,
        // A ready build stays in use until the new one replaces it.
        tiles: keep
          ? { ...keep, rebuild: { queuedAt: new Date().toISOString() } }
          : { status: 'queued', queuedAt: new Date().toISOString() },
      } as any,
    });
    await this.kmzQueue.add(
      'build-tiles',
      { schoolId },
      {
        jobId: `tiles-${schoolId}-${Date.now()}`,
        attempts: 2,
        backoff: { type: 'exponential' as const, delay: 60_000 },
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    );
    return { queued: true };
  }

  /** The school's 'build-tiles' jobs, newest first. */
  private async tilesJobs(schoolId: string) {
    const jobs = await this.kmzQueue.getJobs(
      ['active', 'waiting', 'delayed', 'prioritized', 'completed', 'failed'],
      0,
      500,
    );
    return jobs
      .filter((j) => j?.name === 'build-tiles' && j.data?.schoolId === schoolId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  private async activeTilesJob(schoolId: string) {
    for (const j of await this.tilesJobs(schoolId)) {
      const st = await j.getState();
      if (['active', 'waiting', 'delayed', 'prioritized'].includes(st))
        return j;
    }
    return null;
  }

  /** What the site map's tiles are, and how far the latest build is. */
  async getTilesStatus(schoolId: string) {
    const school = await this.schoolRepository.findOne({
      where: { id: schoolId },
      select: ['id', 'kmz2dManifest'],
    });
    if (!school) throw new NotFoundException(`School ${schoolId} not found`);
    const manifest = school.kmz2dManifest as Kmz2dManifestWithPyramid | null;
    const latest = (await this.tilesJobs(schoolId))[0];
    let job: Record<string, unknown> | null = null;
    if (latest) {
      const st = await latest.getState();
      const p = latest.progress as { done?: number; total?: number } | number;
      const state =
        st === 'active'
          ? 'running'
          : st === 'completed'
            ? 'done'
            : st === 'failed'
              ? 'failed'
              : latest.attemptsMade > 0
                ? 'retrying'
                : 'queued';
      job = {
        jobId: String(latest.id),
        state,
        percent:
          state === 'done'
            ? 100
            : typeof p === 'object' && p?.total
              ? Math.round(((p.done ?? 0) / p.total) * 100)
              : 0,
        done: typeof p === 'object' ? (p?.done ?? null) : null,
        total: typeof p === 'object' ? (p?.total ?? null) : null,
        attempt: Math.max(1, latest.attemptsMade + (st === 'active' ? 1 : 0)),
        maxAttempts: latest.opts.attempts ?? 1,
        queuedAt: new Date(latest.timestamp).toISOString(),
        startedAt: latest.processedOn
          ? new Date(latest.processedOn).toISOString()
          : null,
        finishedAt:
          latest.finishedOn && (state === 'done' || state === 'failed')
            ? new Date(latest.finishedOn).toISOString()
            : null,
        error:
          state === 'failed' || state === 'retrying'
            ? latest.failedReason
            : null,
      };
    }
    return {
      photos: manifest ? pyramidPhotos(manifest).length : 0,
      tiles: manifest?.tiles ?? null,
      job,
    };
  }

  /**
   * Build the site map's full-detail tiles from its stored photos
   * (overlay-tiles.ts) and record them in `manifest.tiles`. Each build has its
   * own folder (cached for a year); the build it replaces is then removed.
   */
  async buildKmz2dTiles(
    schoolId: string,
    onProgress: (done: number, total: number) => void = () => {},
  ): Promise<Record<string, unknown> | null> {
    const school = await this.schoolRepository.findOne({
      where: { id: schoolId },
      select: ['id', 'kmz2dManifest'],
    });
    const manifest = school?.kmz2dManifest as Kmz2dManifestWithPyramid | null;
    const photos = manifest ? pyramidPhotos(manifest) : [];
    if (!manifest || !photos.length) return null;

    const started = Date.now();
    const buildId = started.toString(36);
    const outDir = path.join(KMZ_TMP_DIR, `tiles_${schoolId}_${buildId}`);
    const root = `schools/${schoolId}/kmz_2d_content/_tiles`;
    /** Save the tiles entry; returns the build it replaced. */
    const save = async (tiles: Record<string, unknown> | null) => {
      const fresh = await this.schoolRepository.findOne({
        where: { id: schoolId },
        select: ['id', 'kmz2dManifest'],
      });
      if (!fresh?.kmz2dManifest) return null;
      const before = (fresh.kmz2dManifest as Kmz2dManifestWithPyramid).tiles;
      await this.schoolRepository.update(schoolId, {
        kmz2dManifest: { ...fresh.kmz2dManifest, tiles } as any,
      });
      return typeof before?.buildId === 'string' ? before.buildId : null;
    };
    const current = manifest.tiles?.status === 'ready' ? manifest.tiles : null;
    if (!current)
      await save({ status: 'building', queuedAt: new Date().toISOString() });

    try {
      const built = await buildSiteTiles(
        photos.map((o) => ({
          north: Number(o.north),
          south: Number(o.south),
          east: Number(o.east),
          west: Number(o.west),
          drawOrder: Number(o.drawOrder) || 0,
          load: () => this.storageService.readFile(String(o.imageUrl)),
        })),
        {
          outDir,
          // Building is ~90% of the work; copying to storage the rest.
          onProgress: (d, t) => onProgress(Math.round((d / t) * 90), 100),
        },
      );
      if (!built) {
        await save(current ?? { status: 'failed', reason: 'no usable photos' });
        return null;
      }
      const prefix = `${root}/${buildId}`;
      await this.uploadDirectory(outDir, prefix);
      onProgress(98, 100);
      const sampleName = `${prefix}/${built.maxZoom}`;
      const sample = await this.storageService.getFileUrl(
        `${sampleName}/0/0.webp`,
      );
      const base = (sample ?? `/files/${sampleName}/0/0.webp`).replace(
        /\/\d+\/0\/0\.webp(\?.*)?$/,
        '',
      );
      const entry = {
        status: 'ready',
        buildId,
        url: `${base}/{z}/{x}/{y}.webp`,
        minZoom: built.minZoom,
        maxZoom: built.maxZoom,
        extent: built.extent,
        groundCmPerPx: built.groundCmPerPx,
        sourceCmPerPx: built.sourceCmPerPx,
        tiles: built.tiles,
        bytes: built.bytes,
        photos: built.photos,
        ms: Date.now() - started,
        builtAt: new Date().toISOString(),
      };
      const replaced = await save(entry);
      if (replaced && replaced !== buildId) {
        await this.storageService
          .deleteDirectory(`${root}/${replaced}`)
          .catch(() => null);
      }
      onProgress(100, 100);
      // The 3D model's roofs and ground can now use these photos.
      await this.reprocessModelForTiles(schoolId).catch((e) =>
        this.logger.warn(
          `3D re-processing after tiles not started for ${schoolId}: ${(e as Error).message}`,
        ),
      );
      this.logger.log(
        `[2D] Tiles for ${schoolId}: ${built.tiles} tiles z${built.minZoom}-${built.maxZoom} ` +
          `(${built.groundCmPerPx} cm/px), ${(built.bytes / 1048576).toFixed(0)} MB, ${Date.now() - started} ms`,
      );
      return entry;
    } catch (err) {
      // A failed rebuild keeps the tiles in use; a first build is marked failed.
      await save(
        current ?? {
          status: 'failed',
          reason: (err as Error).message?.slice(0, 200),
        },
      ).catch(() => null);
      throw err;
    } finally {
      await fs.promises
        .rm(outDir, { recursive: true, force: true })
        .catch(() => null);
    }
  }

  /** Upload a local folder tree to storage under a prefix. */
  private async uploadDirectory(
    localDir: string,
    prefix: string,
  ): Promise<void> {
    const entries = await fs.promises.readdir(localDir, {
      withFileTypes: true,
    });
    const files = entries.filter((e) => !e.isDirectory());
    // Small batches: a pyramid can hold thousands of tiles.
    for (let i = 0; i < files.length; i += 32) {
      await Promise.all(
        files.slice(i, i + 32).map(async (e) => {
          const ext = path.extname(e.name).toLowerCase();
          const mime =
            ext === '.webp'
              ? 'image/webp'
              : ext === '.png'
                ? 'image/png'
                : ext === '.jpg' || ext === '.jpeg'
                  ? 'image/jpeg'
                  : 'application/octet-stream';
          await this.storageService.uploadFile(
            `${prefix}/${e.name}`,
            await fs.promises.readFile(path.join(localDir, e.name)),
            mime,
          );
        }),
      );
    }
    for (const d of entries.filter((e) => e.isDirectory())) {
      await this.uploadDirectory(
        path.join(localDir, d.name),
        `${prefix}/${d.name}`,
      );
    }
  }

  /**
   * Server-side KMZ extraction for the 2D viewer.
   * Unpacks the archive, uploads every asset to the file server, then builds
   * a lightweight manifest the client can use instead of the raw KMZ.
   */
  async extractKmz2dAssets(
    schoolId: string,
    fileBuffer: Buffer,
    fileName: string,
  ): Promise<{
    kmlUrls: string[];
    groundOverlays: any[];
    initialView: any | null;
    derivedCenter: DerivedCoordinate | null;
  }> {
    const kmlUrls: string[] = [];
    const groundOverlays: any[] = [];
    let initialView: any = null;
    const points: Array<[number, number]> = []; // [lng, lat] from placemark geometry

    if (fileName.toLowerCase().endsWith('.kml')) {
      // Bare KML file — just store it, no extraction needed
      const publicPath = await this.storageService.uploadFile(
        `schools/${schoolId}/kmz_2d_content/doc.kml`,
        fileBuffer,
        'application/vnd.google-earth.kml+xml',
      );
      if (publicPath) kmlUrls.push(publicPath);

      // Parse for initial view
      const parser = new xml2js.Parser({
        explicitArray: false,
        mergeAttrs: true,
      });
      const parsed = await parser
        .parseStringPromise(fileBuffer.toString('utf-8'))
        .catch(() => null);
      if (parsed) {
        const { views, placemarks } = this.extractKmlFeatures(parsed);
        if (views.length > 0) initialView = this.parseKmlView(views[0]);
        points.push(...this.collectPlacemarkPoints(placemarks));
      }
      return {
        kmlUrls,
        groundOverlays,
        initialView,
        derivedCenter: pickKmlCoordinate({
          initialView,
          groundOverlays,
          points,
        }),
      };
    }

    // ── KMZ (zip) extraction ───────────────────────────────────────────────
    // Relative, same-origin path (matches StorageService.urlPrefix).
    const assetBaseUrl = `/files/schools/${schoolId}/kmz_2d_content`;

    // Zip-bomb / path-traversal guard (WS9.7) before anything is inflated.
    assertSafeZip(fileBuffer, kmzZipLimits());
    const budget = new ExtractionBudget(kmzZipLimits());

    let jszipInstance: any;
    try {
      jszipInstance = await (JSZip as any).loadAsync(fileBuffer);
    } catch (err: any) {
      throw new Error(`Failed to open KMZ archive: ${err.message}`);
    }

    // Map of in-zip path → { url, isTiled, maxZoom }
    const assetUrlMap: Record<
      string,
      {
        url: string;
        isTiled?: boolean;
        maxZoom?: number;
        width?: number;
        height?: number;
      }
    > = {};
    const allKmlPaths: string[] = [];
    const files = Object.keys(jszipInstance.files).filter(
      (f: string) => !jszipInstance.files[f].dir,
    );

    const uploadDirectoryToStorage = async (
      localDir: string,
      storagePrefix: string,
    ): Promise<void> => {
      const dirFiles = await fs.promises.readdir(localDir, {
        withFileTypes: true,
      });
      for (const file of dirFiles) {
        const p = path.join(localDir, file.name);
        if (file.isDirectory()) {
          await uploadDirectoryToStorage(p, `${storagePrefix}/${file.name}`);
        } else {
          const buf = await fs.promises.readFile(p);
          const ext = path.extname(file.name).toLowerCase();
          let mime = 'application/octet-stream';
          if (ext === '.png') mime = 'image/png';
          else if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
          await this.storageService.uploadFile(
            `${storagePrefix}/${file.name}`,
            buf as any,
            mime,
          );
        }
      }
    };

    // Upload all assets in batches
    const BATCH_SIZE = 30;
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (zipPath: string) => {
          const fileBuf =
            await jszipInstance.files[zipPath].async('nodebuffer');
          budget.add(zipPath, fileBuf.length);
          const contentType = this.getContentType(zipPath);

          let isTiled = false;
          let tileUrlTemplate = '';
          let maxZoom = 0;
          let tiledSize: { width: number; height: number } | undefined;

          const isOptimizeable =
            (contentType === 'image/jpeg' || contentType === 'image/png') &&
            !zipPath.toLowerCase().includes('.tif');

          if (isOptimizeable) {
            try {
              const meta = await sharp(fileBuf).metadata();
              if (
                (meta.width && meta.width > 2048) ||
                (meta.height && meta.height > 2048)
              ) {
                this.logger.log(
                  `Image ${zipPath} is massive (${meta.width}x${meta.height}). Tiling on backend to save client GPU!`,
                );
                const tmpDir = path.join(
                  KMZ_TMP_DIR,
                  `kmz_chunk_${Date.now()}_${Math.random()}`,
                );
                await fs.promises.mkdir(tmpDir, { recursive: true });

                await sharp(fileBuf)
                  .tile({ layout: 'google', size: 256 })
                  .toFile(tmpDir);

                const storagePrefix = `schools/${schoolId}/kmz_2d_content/${zipPath}_tiled`;
                // Read what libvips wrote BEFORE removing the folder (this
                // used to look after deleting it, so it always guessed jpg).
                const levels = (
                  await fs.promises.readdir(tmpDir).catch(() => [])
                )
                  .map(Number)
                  .filter(Number.isInteger);
                const files00 = await fs.promises
                  .readdir(path.join(tmpDir, '0', '0'))
                  .catch(() => []);
                const tileExt =
                  files00
                    .find((f) => !f.startsWith('blank'))
                    ?.split('.')
                    .pop() || 'jpg';
                await uploadDirectoryToStorage(tmpDir, storagePrefix);
                await fs.promises
                  .rm(tmpDir, { recursive: true, force: true })
                  .catch(() => null);

                // libvips' google layout is {z}/{y}/{x}, image pinned top-left.
                tileUrlTemplate = `/files/${storagePrefix}/{z}/{y}/{x}.${tileExt}`;
                tiledSize = { width: meta.width, height: meta.height };
                maxZoom = levels.length
                  ? Math.max(...levels)
                  : Math.ceil(
                      Math.log2(Math.max(meta.width, meta.height) / 256),
                    );
                isTiled = true;
              }
            } catch (e) {
              this.logger.warn(`Sharp failed to tile ${zipPath}: ` + e);
            }
          }

          if (!isTiled) {
            const publicPath = await this.storageService.uploadFile(
              `schools/${schoolId}/kmz_2d_content/${zipPath}`,
              fileBuf,
              contentType,
            );
            if (publicPath) {
              assetUrlMap[zipPath] = { url: publicPath };
              const baseName = zipPath.split('/').pop()!;
              if (!assetUrlMap[baseName])
                assetUrlMap[baseName] = { url: publicPath };
            }
          } else {
            assetUrlMap[zipPath] = {
              url: tileUrlTemplate,
              isTiled: true,
              maxZoom,
              ...tiledSize,
            };
            const baseName = zipPath.split('/').pop()!;
            if (!assetUrlMap[baseName])
              assetUrlMap[baseName] = {
                url: tileUrlTemplate,
                isTiled: true,
                maxZoom,
                ...tiledSize,
              };
          }

          if (zipPath.toLowerCase().endsWith('.kml')) {
            allKmlPaths.push(zipPath);
          }
        }),
      );
    }

    // Prefer doc.kml / index.kml as the root KML
    const rootKmlPath =
      allKmlPaths.find((p) => p.toLowerCase() === 'doc.kml') ||
      allKmlPaths.find((p) => p.toLowerCase() === 'index.kml') ||
      allKmlPaths[0];

    if (rootKmlPath && assetUrlMap[rootKmlPath]) {
      kmlUrls.push(assetUrlMap[rootKmlPath].url);
    }

    // Parse every KML for overlays and initial view
    const parser = new xml2js.Parser({
      explicitArray: false,
      mergeAttrs: true,
    });
    for (const kmlPath of allKmlPaths) {
      const content = await jszipInstance.files[kmlPath].async('string');
      const parsed = await parser.parseStringPromise(content).catch(() => null);
      if (!parsed) continue;

      const { overlays, views, placemarks } = this.extractKmlFeatures(parsed);
      points.push(...this.collectPlacemarkPoints(placemarks));

      for (const ov of overlays) {
        const icon = ov.Icon;
        if (!icon) continue;
        const href = this.getKmlValue(icon.href);
        const kmlDir = kmlPath.includes('/')
          ? kmlPath.substring(0, kmlPath.lastIndexOf('/') + 1)
          : '';
        let resolvedHref = href;
        if (!href.startsWith('http') && !href.startsWith('/')) {
          resolvedHref = kmlDir + href;
          resolvedHref = resolvedHref.replace(/\.\//g, '');
        }

        const mapEntry =
          assetUrlMap[resolvedHref] ||
          assetUrlMap[href] ||
          Object.entries(assetUrlMap).find(
            ([k]) => k.endsWith('/' + href) || k === href,
          )?.[1];

        const imageUrl = mapEntry ? mapEntry.url : `${assetBaseUrl}/${href}`;
        const isTiled = mapEntry ? mapEntry.isTiled || false : false;
        const maxZoom = mapEntry ? mapEntry.maxZoom : undefined;
        // Pixel size of a server-tiled image: lets the viewer build an exact grid.
        const tiledWidth = mapEntry?.width;
        const tiledHeight = mapEntry?.height;

        const box = ov.LatLonBox || {};
        const drawOrder = parseInt(this.getKmlValue(ov.drawOrder) || '0', 10);
        groundOverlays.push({
          name: this.getKmlValue(ov.name) || 'Overlay',
          imageUrl,
          isTiled,
          maxZoom,
          ...(tiledWidth && tiledHeight
            ? { width: tiledWidth, height: tiledHeight }
            : {}),
          north: parseFloat(this.getKmlValue(box.north) || '0'),
          south: parseFloat(this.getKmlValue(box.south) || '0'),
          east: parseFloat(this.getKmlValue(box.east) || '0'),
          west: parseFloat(this.getKmlValue(box.west) || '0'),
          drawOrder: isNaN(drawOrder) ? 0 : drawOrder,
        });
      }

      if (!initialView && views.length > 0) {
        initialView = this.parseKmlView(views[0]);
      }
    }

    // Deduplicate overlays (in case multiple KMLs define the same hierarchy)
    const uniqueOverlays: any[] = [];
    const seen = new Set<string>();
    for (const ov of groundOverlays) {
      const key = `${ov.imageUrl}_${ov.north}_${ov.south}_${ov.west}_${ov.east}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueOverlays.push(ov);
      }
    }

    // Sort overlays so higher draw-order layers go on top
    uniqueOverlays.sort((a, b) => a.drawOrder - b.drawOrder);

    return {
      kmlUrls,
      groundOverlays: uniqueOverlays,
      initialView,
      derivedCenter: pickKmlCoordinate({
        initialView,
        groundOverlays: uniqueOverlays,
        points,
      }),
    };
  }

  /**
   * Every [lng, lat] vertex drawn in the parsed KML placemarks (points,
   * lines, polygon rings, multi-geometries), capped for very large files.
   */
  private collectPlacemarkPoints(placemarks: any[]): Array<[number, number]> {
    const out: Array<[number, number]> = [];
    const MAX = 20000;
    const asArray = (v: unknown): any[] =>
      Array.isArray(v) ? v : v ? [v] : [];
    const push = (raw: unknown) => {
      const coords = this.parseKmlCoordinates(raw as any);
      for (const c of coords || []) {
        if (out.length >= MAX) return;
        const [lng, lat] = c;
        if (Number.isFinite(lng) && Number.isFinite(lat)) out.push([lng, lat]);
      }
    };
    const walk = (g: any) => {
      if (!g || out.length >= MAX) return;
      asArray(g.Point).forEach((p) => push(p?.coordinates));
      asArray(g.LineString).forEach((l) => push(l?.coordinates));
      asArray(g.Polygon).forEach((p) =>
        push(p?.outerBoundaryIs?.LinearRing?.coordinates),
      );
      asArray(g.MultiGeometry).forEach(walk);
    };
    for (const pm of placemarks || []) walk(pm);
    return out;
  }

  async removeOverlay(schoolId: string, index: number) {
    const school = await this.schoolRepository.findOne({
      where: { id: schoolId },
    });
    if (!school || !school.kmz2dManifest) return { success: false };

    const overlays = [...(school.kmz2dManifest.groundOverlays || [])];
    if (index >= 0 && index < overlays.length) {
      overlays.splice(index, 1);
      school.kmz2dManifest.groundOverlays = overlays;
      await this.schoolRepository.save(school);
      return { success: true, manifest: school.kmz2dManifest };
    }
    return { success: false, message: 'Invalid overlay index' };
  }

  /**
   * Add a new overlay (KMZ/KML) to the existing 2D manifest.
   * This allows stacking multiple drone imagery layers over time.
   */
  async addOverlay(schoolId: string, file: Express.Multer.File) {
    const school = await this.schoolRepository.findOne({
      where: { id: schoolId },
    });
    if (!school) throw new NotFoundException('School not found');

    const fileBuffer = fs.readFileSync(file.path);
    const newManifest = await this.extractKmz2dAssets(
      schoolId,
      fileBuffer,
      file.originalname,
    );

    // Clean up temp file
    try {
      fs.unlinkSync(file.path);
    } catch (e) {
      this.logger.warn(`Failed to clean up: ${file.path}`);
    }

    const currentManifest = school.kmz2dManifest || {
      kmlUrls: [],
      groundOverlays: [],
    };

    // Merge new assets
    const mergedManifest = {
      ...currentManifest,
      kmlUrls: [
        ...(currentManifest.kmlUrls || []),
        ...(newManifest.kmlUrls || []),
      ],
      groundOverlays: [
        ...(currentManifest.groundOverlays || []),
        ...(newManifest.groundOverlays || []),
      ],
      initialView: newManifest.initialView || currentManifest.initialView,
    };

    school.kmz2dManifest = mergedManifest;
    await this.schoolRepository.save(school);

    return {
      success: true,
      manifest: mergedManifest,
      addedOverlays: newManifest.groundOverlays?.length || 0,
    };
  }

  /** Legacy 2D endpoint, now backed by `site_features` (WS5.2 / WS9.4). */
  async addSiteAnnotation(
    schoolId: string,
    annotation: LegacySiteAnnotationDto,
    user?: ActingUser,
  ) {
    if (this.siteFeatures) {
      return this.siteFeatures.addLegacyAnnotation(schoolId, annotation, user);
    }
    const school = await this.schoolRepository.findOne({
      where: { id: schoolId },
    });
    if (!school) throw new NotFoundException('School not found');

    const annotations = school.siteAnnotations || [];
    const newAnn = {
      id: annotation.id || `ann-${Date.now()}`,
      type: annotation.type,
      label: annotation.label,
      description: annotation.description,
      coordinates: annotation.coordinates,
      style: annotation.style || {},
      createdAt: new Date().toISOString(),
    };
    annotations.push(newAnn);
    school.siteAnnotations = annotations;
    await this.schoolRepository.save(school);
    return newAnn;
  }

  async removeSiteAnnotation(schoolId: string, id: string) {
    if (this.siteFeatures) {
      return this.siteFeatures.removeLegacy(schoolId, id);
    }
    const school = await this.schoolRepository.findOne({
      where: { id: schoolId },
    });
    if (!school) throw new NotFoundException('School not found');

    const annotations = (school.siteAnnotations || []).filter(
      (a) => a.id !== id,
    );
    school.siteAnnotations = annotations;
    await this.schoolRepository.save(school);
    return { success: true };
  }
}
