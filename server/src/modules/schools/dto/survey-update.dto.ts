import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ComplianceLevel } from '../entities/school-facility-survey.entity';

export class SurveyUpdateItemDto {
  @IsString()
  itemId: string;

  @IsString()
  facilityId: string;

  @IsEnum(ComplianceLevel)
  compliance: ComplianceLevel;

  @IsOptional()
  @IsString()
  notes?: string;
}
