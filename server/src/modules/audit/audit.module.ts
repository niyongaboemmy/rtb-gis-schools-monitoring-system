import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditAlertService } from './audit-alert.service';
import { AuditIntegrityService } from './audit-integrity.service';
import { AuditRetentionService } from './audit-retention.service';
import { MailModule } from '../mail/mail.module';
import { AuditDiffSubscriber } from '../../common/audit/audit-diff.subscriber';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog]), MailModule],
  controllers: [AuditController],
  providers: [
    AuditService,
    AuditAlertService,
    AuditIntegrityService,
    AuditRetentionService,
    AuditDiffSubscriber,
  ],
  exports: [AuditService],
})
export class AuditModule {}
