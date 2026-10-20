import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const AUDIT_OUTCOMES = ['success', 'failure', 'denied'] as const;
export const MAX_PAGE_LIMIT = 200;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

/** Filters shared by the listing and the CSV export (WS11.7). */
export class AuditFilterDto {
  @ApiPropertyOptional({ description: 'ISO date/time, inclusive' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO date/time, inclusive' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Transform(trim)
  actorId?: string;

  @ApiPropertyOptional({ description: 'Actor email (substring)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(trim)
  actor?: string;

  @ApiPropertyOptional({
    description: 'Action prefix, e.g. "school" or "school.update"',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(trim)
  action?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Transform(trim)
  targetType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(trim)
  targetId?: string;

  @ApiPropertyOptional({
    description:
      'School id: the school itself plus rows linked to it (buildings, uploads)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Transform(trim)
  schoolId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Transform(trim)
  subjectUserId?: string;

  @ApiPropertyOptional({ description: 'Comma list of success,failure,denied' })
  @IsOptional()
  @IsString()
  @Matches(/^(success|failure|denied)(,(success|failure|denied))*$/)
  @Transform(trim)
  outcome?: string;

  @ApiPropertyOptional({
    description:
      'Free text over action, target label, target id and actor email',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(trim)
  q?: string;
}

export class AuditQueryDto extends AuditFilterDto {
  @ApiPropertyOptional({ default: 50, maximum: MAX_PAGE_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_LIMIT)
  limit?: number;

  @ApiPropertyOptional({ description: 'Legacy offset paging; prefer cursor' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional({
    description: 'Opaque cursor from a previous nextCursor',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;
}

export class AuditExportQueryDto extends AuditFilterDto {
  @ApiPropertyOptional({ default: 50000, maximum: 50000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50000)
  max?: number;
}
