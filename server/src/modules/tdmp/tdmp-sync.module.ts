import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { School } from '../schools/entities/school.entity';
import { AuditModule } from '../audit/audit.module';
import { TdmpModule } from './tdmp.module';
import { TdmpSyncRun } from './entities/tdmp-sync-run.entity';
import { TdmpSyncService } from './tdmp-sync.service';
import { TdmpController } from './tdmp.controller';

/** School sync from TDMP, school links and the live staff list. */
@Module({
  imports: [
    TypeOrmModule.forFeature([School, TdmpSyncRun]),
    TdmpModule,
    AuditModule,
  ],
  controllers: [TdmpController],
  providers: [TdmpSyncService],
  exports: [TdmpSyncService],
})
export class TdmpSyncModule {}
