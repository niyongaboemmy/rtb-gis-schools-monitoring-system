import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessLevel } from './entities/access-level.entity';
import { AccessLevelsService } from './access-levels.service';
import { AccessLevelsController } from './access-levels.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AccessLevel])],
  controllers: [AccessLevelsController],
  providers: [AccessLevelsService],
  exports: [AccessLevelsService],
})
export class AccessLevelsModule {}
