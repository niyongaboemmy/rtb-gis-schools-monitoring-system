import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { KmzService } from './kmz.service';
import { KMZ_QUEUE } from './kmz.constants';

export interface GlbJobData {
  schoolId: string;
  tempFilePath: string;
  originalName: string;
  mimetype: string;
  /**
   * 'upload'  — a fresh multipart upload; tempFilePath is a throwaway staged
   *             file that must be uploaded as the served object and unlinked.
   * 'restore' — a re-optimize sweep; tempFilePath points at a file already in
   *             storage (the served GLB or its archived `_source/` original)
   *             that must NOT be unlinked, and is already the served object.
   */
  source?: 'upload' | 'restore';
}

export interface Kmz2dJobData {
  schoolId: string;
  tempFilePath: string;
  originalName: string;
  mimetype: string;
}

@Processor(KMZ_QUEUE)
export class KmzProcessor extends WorkerHost {
  private readonly logger = new Logger(KmzProcessor.name);

  constructor(private readonly kmzService: KmzService) {
    super();
  }

  async process(job: Job<GlbJobData | Kmz2dJobData>): Promise<unknown> {
    this.logger.log(
      `Processing job ${job.id} [${job.name}] for school ${job.data.schoolId}`,
    );

    switch (job.name) {
      case 'process-glb':
        return this.kmzService.processGlbJob(job.data as GlbJobData);

      case 'process-kmz2d':
        return this.kmzService.processKmz2dJob(job.data as Kmz2dJobData);

      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
        return null;
    }
  }
}
