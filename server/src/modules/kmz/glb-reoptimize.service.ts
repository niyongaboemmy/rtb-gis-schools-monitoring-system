import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import { Not, IsNull, Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { School } from '../schools/entities/school.entity';
import { StorageService } from '../storage/storage.service';
import { KMZ_QUEUE, GLB_JOB_OPTIONS } from './kmz.constants';
import type { GlbJobData } from './kmz.processor';

/**
 * Self-healing sweep for school 3D models.
 *
 * A GLB is considered "optimized" once its raw original has been archived to
 * `schools/<id>/3d/_source/<name>.glb`. Any served `schools/<id>/3d/*.glb`
 * without that marker is a raw photogrammetry export (often >1 GB) that will
 * time out the download and crash the browser tab — so we re-enqueue it through
 * the same `process-glb` pipeline the upload path uses (retries + telemetry
 * included). No operator action, no browser open.
 *
 * Runs: ~30 s after boot (GLB_REOPTIMIZE_ON_BOOT=false to disable), nightly
 * (GLB_REOPTIMIZE_CRON=false to disable), and on demand from the admin
 * endpoints in kmz.controller.
 */
@Injectable()
export class GlbReoptimizeService implements OnModuleInit {
  private readonly logger = new Logger(GlbReoptimizeService.name);

  constructor(
    @InjectQueue(KMZ_QUEUE) private readonly queue: Queue,
    private readonly storage: StorageService,
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
  ) {}

  onModuleInit(): void {
    if ((process.env.GLB_REOPTIMIZE_ON_BOOT ?? 'true') !== 'true') return;
    setTimeout(() => {
      this.enqueueUnoptimized()
        .then(({ enqueued, skipped }) => {
          if (enqueued.length) {
            this.logger.log(
              `boot sweep: enqueued ${enqueued.length} raw GLB(s) for optimization (${skipped} already optimized)`,
            );
          }
        })
        .catch((err: any) =>
          this.logger.warn(`boot sweep failed: ${err?.message || err}`),
        );
    }, 30_000).unref();
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async nightlySweep(): Promise<void> {
    if ((process.env.GLB_REOPTIMIZE_CRON ?? 'true') !== 'true') return;
    const { enqueued } = await this.enqueueUnoptimized();
    if (enqueued.length) {
      this.logger.log(
        `nightly sweep: re-enqueued ${enqueued.length} raw GLB(s)`,
      );
    }
  }

  /**
   * Walk local storage and enqueue a `process-glb` (source: 'restore') job for
   * every school GLB that has not been optimized yet.
   *
   * @param force  also re-optimize models that already have a `_source/` marker
   *               (re-runs from the archived original).
   * @param onlySchoolId  restrict the sweep to one school.
   */
  async enqueueUnoptimized(
    opts: { force?: boolean; onlySchoolId?: string } = {},
  ): Promise<{ enqueued: string[]; skipped: number }> {
    const root = this.storage.getLocalRoot();
    if (!root) {
      this.logger.log('re-optimize sweep skipped — non-local storage backend');
      return { enqueued: [], skipped: 0 };
    }

    const schoolsDir = path.join(root, 'schools');
    if (!fs.existsSync(schoolsDir)) return { enqueued: [], skipped: 0 };

    // Schools the optimizer already tried and failed on (OOM, timeout, …). Don't
    // re-hammer them on every boot/nightly sweep — they need a code fix or an
    // explicit `force`. A later success clears modelOptimizeError.
    const failed = new Set<string>();
    if (!opts.force) {
      const rows = await this.schoolRepo.find({
        where: { modelOptimizeError: Not(IsNull()), modelOptimized: false },
        select: ['id'],
      });
      for (const r of rows) failed.add(r.id);
    }

    const enqueued: string[] = [];
    let skipped = 0;

    for (const schoolId of fs.readdirSync(schoolsDir)) {
      if (opts.onlySchoolId && schoolId !== opts.onlySchoolId) continue;
      if (failed.has(schoolId)) {
        skipped++;
        continue;
      }

      const dir = path.join(schoolsDir, schoolId, '3d');
      let entries: string[];
      try {
        if (!fs.statSync(dir).isDirectory()) continue;
        entries = fs.readdirSync(dir);
      } catch {
        continue; // no 3d/ dir for this school
      }

      for (const name of entries.filter((f) =>
        f.toLowerCase().endsWith('.glb'),
      )) {
        const served = path.join(dir, name);
        const archived = path.join(dir, '_source', name);
        const alreadyOptimized = fs.existsSync(archived);

        if (alreadyOptimized && !opts.force) {
          skipped++;
          continue;
        }

        // Optimize from the true original: the archived copy if we have one,
        // otherwise the served file (which is still raw).
        const sourcePath = alreadyOptimized ? archived : served;
        try {
          const job = await this.queue.add(
            'process-glb',
            {
              schoolId,
              tempFilePath: sourcePath,
              originalName: name,
              mimetype: 'model/gltf-binary',
              source: 'restore',
            } satisfies GlbJobData,
            GLB_JOB_OPTIONS,
          );
          enqueued.push(String(job.id));
        } catch (err: any) {
          this.logger.warn(
            `failed to enqueue ${schoolId}/${name}: ${err?.message || err}`,
          );
        }
      }
    }

    return { enqueued, skipped };
  }
}
