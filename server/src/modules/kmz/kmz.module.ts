import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KmzController } from './kmz.controller';
import { KmzService } from './kmz.service';
import { School } from '../schools/entities/school.entity';
import { SchoolBoundary } from '../schools/entities/school-boundary.entity';
import { SchoolBuilding } from '../schools/entities/school-building.entity';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([School, SchoolBoundary, SchoolBuilding]),
    MulterModule.register({
      storage: diskStorage({
        destination: './temp/uploads',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      limits: {
        fileSize: 2 * 1024 * 1024 * 1024, // 2GB limit for large KMZ/KML surveys
        files: 1,
      },
    }),
    StorageModule,
  ],
  controllers: [KmzController],
  providers: [KmzService],
  exports: [KmzService],
})
export class KmzModule {}
