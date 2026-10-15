import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsObject, IsOptional } from 'class-validator';

/** Caps keep one school's state from growing without bound. */
export const MAX_VIEWER_ITEMS = 2000;

export class UpdateViewerStateDto {
  @ApiPropertyOptional({ description: 'Camera home {position, target, …}' })
  @IsOptional()
  @IsObject()
  home?: Record<string, unknown> | null;

  @ApiPropertyOptional({ description: 'buildingId → model-space point' })
  @IsOptional()
  @IsObject()
  buildingPins?: Record<string, unknown>;

  /** @deprecated Ignored — notes are saved as site features. */
  @ApiPropertyOptional({ type: [Object], deprecated: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_VIEWER_ITEMS)
  annotations?: unknown[];

  /** @deprecated Ignored — measurements are saved as site features. */
  @ApiPropertyOptional({ type: [Object], deprecated: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_VIEWER_ITEMS)
  measures?: unknown[];
}
