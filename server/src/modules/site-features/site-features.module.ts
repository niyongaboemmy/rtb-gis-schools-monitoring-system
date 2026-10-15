import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchoolViewerState } from './entities/school-viewer-state.entity';
import { SiteFeature } from './entities/site-feature.entity';
import { School } from '../schools/entities/school.entity';
import { EventsModule } from '../events/events.module';
import { SiteFeaturesController } from './site-features.controller';
import { ViewerStateService } from './viewer-state.service';
import { SiteFeaturesService } from './site-features.service';

/**
 * Global so KmzService can back the legacy `kmz/2d/site-annotations`
 * endpoints with SiteFeaturesService without changing KmzModule's imports.
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([SchoolViewerState, SiteFeature, School]),
    EventsModule,
  ],
  controllers: [SiteFeaturesController],
  providers: [ViewerStateService, SiteFeaturesService],
  exports: [ViewerStateService, SiteFeaturesService],
})
export class SiteFeaturesModule {}
