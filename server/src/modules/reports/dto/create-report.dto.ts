import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsEnum,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { OmitType, PartialType } from '@nestjs/swagger';
import { ReportStatus } from '../entities/issue-report.entity';

/**
 * Relative path of a report attachment: `/files/reports/<file>` on the
 * file-server, or the legacy `/uploads/reports/<file>` that older records
 * still carry (re-sent when such a report is edited).
 */
export const REPORT_ATTACHMENT_PATH =
  /^\/(files|uploads)\/reports\/[A-Za-z0-9_-][A-Za-z0-9._-]{0,200}$/;

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

  @IsString({ each: true })
  @IsOptional()
  issueCategory?: string[];

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsEnum(ReportStatus)
  @IsOptional()
  status?: ReportStatus;

  /**
   * Relative file-server paths only (`/files/reports/<name>`), as returned by
   * the file-server upload and by the multipart path of POST /reports — so
   * `javascript:` or external URLs can never be stored and rendered.
   * A single multipart value arrives as a string and is wrapped.
   */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? [value] : value,
  )
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @Matches(REPORT_ATTACHMENT_PATH, {
    each: true,
    message: 'each attachment must be a /files/reports/<file> path',
  })
  attachments?: string[];
}

/** Fields a report manager may edit; status and school have their own rules. */
export class UpdateReportDto extends PartialType(
  OmitType(CreateReportDto, ['schoolId', 'status'] as const),
) {}

export class UpdateReportStatusDto {
  @IsEnum(ReportStatus)
  @IsNotEmpty()
  status: ReportStatus;

  /** Why the report was triaged this way (shown to the school). */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
