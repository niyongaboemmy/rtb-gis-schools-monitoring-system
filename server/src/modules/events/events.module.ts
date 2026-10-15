import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { School } from '../schools/entities/school.entity';
import { EventsGateway } from './events.gateway';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([School])],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class EventsModule {}
