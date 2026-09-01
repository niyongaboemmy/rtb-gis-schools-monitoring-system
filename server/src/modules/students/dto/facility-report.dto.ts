import { IsString, IsOptional, IsEnum, IsArray, MinLength, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ReportPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ReportStatus {
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  REJECTED = 'rejected',
}

export class CreateFacilityReportDto {
  @ApiProperty({
    example: 'Classroom 101 roof leak',
    description: 'Brief title of the issue',
  })
  @IsString()
  @MinLength(5)
  title: string;

  @ApiProperty({
    example: 'Water leaking from roof during rain, causing damage to desks',
    description: 'Detailed description of the facility issue',
  })
  @IsString()
  @MinLength(10)
  description: string;

  @ApiProperty({
    example: 'classroom',
    description: 'Category of facility (classroom, washroom, dormitory, etc.)',
  })
  @IsString()
  facilityCategory: string;

  @ApiProperty({ example: 'high', enum: ReportPriority })
  @IsEnum(ReportPriority)
  priority: ReportPriority;

  @ApiProperty({
    example: ['photo-url-1', 'photo-url-2'],
    required: false,
    description: 'URLs of attached photos',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];

  @ApiProperty({
    example: 'uuid-of-building',
    required: false,
    description: 'Building ID if applicable',
  })
  @IsOptional()
  @IsUUID()
  buildingId?: string;

  @ApiProperty({
    example: 'Contact name for follow-up',
    required: false,
  })
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiProperty({
    example: '+250700000000',
    required: false,
    description: 'Contact phone number',
  })
  @IsOptional()
  @IsString()
  contactPhone?: string;
}

export class UpdateReportStatusDto {
  @ApiProperty({ example: 'in_progress', enum: ReportStatus })
  @IsEnum(ReportStatus)
  status: ReportStatus;

  @ApiProperty({
    example: 'Currently assessing the damage',
    required: false,
    description: 'Status update message',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
