import { IsNotEmpty, IsOptional, IsString, IsUUID, IsEnum } from 'class-validator';
import { ReportStatus } from '../entities/issue-report.entity';

export class CreateReportDto {
  @IsUUID()
  @IsNotEmpty()
  schoolId: string;

  @IsUUID()
  @IsOptional()
  buildingId?: string;

  @IsString()
  @IsNotEmpty()
  facilityId: string;

  @IsString()
  @IsNotEmpty()
  itemId: string;

  @IsString()
  @IsOptional()
  issueCategory?: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsEnum(ReportStatus)
  @IsOptional()
  status?: ReportStatus;

  @IsString({ each: true })
  @IsOptional()
  attachments?: string[];
}

export class UpdateReportStatusDto {
  @IsEnum(ReportStatus)
  @IsNotEmpty()
  status: ReportStatus;
}
