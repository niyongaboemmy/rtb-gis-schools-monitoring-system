import { ArrayMaxSize, IsArray, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Max rows per import request; larger sheets should be split. */
export const MAX_BULK_USER_ROWS = 2000;

/**
 * Rows parsed from the import sheet. Each row is validated individually in
 * the service so one bad row is reported instead of failing the batch; only
 * the known columns are read from it.
 */
export class BulkUsersDto {
  @ApiProperty({ type: 'array', items: { type: 'object' } })
  @IsArray()
  @ArrayMaxSize(MAX_BULK_USER_ROWS)
  @IsObject({ each: true })
  rows: Record<string, unknown>[];
}
