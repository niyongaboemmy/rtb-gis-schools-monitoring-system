import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { School } from '../schools/entities/school.entity';
import { AuditModule } from '../audit/audit.module';
import { TdmpModule } from './tdmp.module';
import { TdmpSyncRun } from './entities/tdmp-sync-run.entity';
import { TdmpSettings } from './entities/tdmp-settings.entity';
import { Role } from '../roles/entities/role.entity';
import { TdmpConnectionService } from './tdmp-connection.service';
import { TdmpSyncService } from './tdmp-sync.service';
import { TdmpController } from './tdmp.controller';

/** School sync from TDMP, its schedule, school links and the connection check. */
@Module({
  imports: [
    TypeOrmModule.forFeature([School, TdmpSyncRun, TdmpSettings, Role]),
    TdmpModule,
    AuditModule,
  ],
  controllers: [TdmpController],
  providers: [TdmpSyncService, TdmpConnectionService],
  exports: [TdmpSyncService],
})
export class TdmpSyncModule {}
