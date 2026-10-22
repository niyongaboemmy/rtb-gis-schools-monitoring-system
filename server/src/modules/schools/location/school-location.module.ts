import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { School } from '../entities/school.entity';
import { AuditModule } from '../../audit/audit.module';
import { EventsModule } from '../../events/events.module';
import { SchoolLocationService } from './school-location.service';

/**
 * Global so the schools API and the KMZ / GLB pipeline share one
 * SchoolLocationService without new module cycles.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([School]), AuditModule, EventsModule],
  providers: [SchoolLocationService],
  exports: [SchoolLocationService],
})
export class SchoolLocationModule {}
