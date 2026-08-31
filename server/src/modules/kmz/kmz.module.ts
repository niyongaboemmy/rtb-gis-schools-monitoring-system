import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { KmzController } from './kmz.controller';
import { KmzService, KMZ_TMP_DIR } from './kmz.service';
import { KmzProcessor } from './kmz.processor';
import { School } from '../schools/entities/school.entity';
import { SchoolBoundary } from '../schools/entities/school-boundary.entity';
import { SchoolBuilding } from '../schools/entities/school-building.entity';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import { StorageModule } from '../storage/storage.module';
import { KMZ_QUEUE } from './kmz.constants';

export { KMZ_QUEUE };

// Direct-multipart KMZ staging — on the EBS volume, not the tmpfs /tmp.
const KMZ_UPLOAD_DIR = join(KMZ_TMP_DIR, 'rtb-kmz-uploads');
mkdirSync(KMZ_UPLOAD_DIR, { recursive: true });

@Module({
  imports: [
    TypeOrmModule.forFeature([School, SchoolBoundary, SchoolBuilding]),
    MulterModule.register({
      storage: diskStorage({
        destination: KMZ_UPLOAD_DIR,
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      limits: {
        fileSize: 2 * 1024 * 1024 * 1024, // 2 GB limit for large KMZ/KML surveys
        files: 1,
      },
    }),
    StorageModule,
    BullModule.registerQueue({ name: KMZ_QUEUE }),
  ],
  controllers: [KmzController],
  providers: [KmzService, KmzProcessor],
  exports: [KmzService],
})
export class KmzModule {}
