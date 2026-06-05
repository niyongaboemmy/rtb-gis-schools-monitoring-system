import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

export interface AuditActor {
  id: string;
  email: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  /**
   * Fire-and-forget audit entry. Never throws — a logging failure must not
   * block the primary operation.
   */
  log(
    actor: AuditActor | null,
    action: string,
    targetType: string,
    targetId?: string,
    meta?: Record<string, unknown>,
  ): void {
    this.auditLogRepository
      .save(
        this.auditLogRepository.create({
          actorId: actor?.id ?? undefined,
          actorEmail: actor?.email ?? undefined,
          action,
          targetType,
          targetId: targetId ?? undefined,
          meta: meta ?? undefined,
        }),
      )
      .catch((err: Error) =>
        this.logger.error(`Failed to write audit log: ${err.message}`),
      );
  }

  findAll(limit = 200, offset = 0): Promise<[AuditLog[], number]> {
    return this.auditLogRepository.findAndCount({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }
}
