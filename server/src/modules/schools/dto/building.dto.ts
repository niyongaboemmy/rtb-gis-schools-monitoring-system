import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNumber,
  Max,
  Min,
  IsOptional,
  IsString,
  IsArray,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import {
  BuildingCondition,
  RoofCondition,
} from '../entities/school-building.entity';
import { IsPlausibleYear } from '../../../common/validation/plausible-year';

/** '' from a blank form select means "not assessed" → null. */
const blankToNull = ({ value }: { value: unknown }) =>
  value === '' ? null : value;

export class FacilityItemDto {
  @IsString()
  facility_id: string;

  @IsString()
  facility_name: string;

  @IsNumber()
  number_of_rooms: number;
}

export class BuildingDto {
  /** Existing building to update in place; omit to create a new one. */
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  id?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  function?: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  floors?: number;

  @ApiPropertyOptional({ description: 'Floor area in m²' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  area?: number;

  @ApiPropertyOptional({ description: 'Whole year, 1900 – current year' })
  @IsPlausibleYear()
  @IsOptional()
  yearBuilt?: number;

  @ApiPropertyOptional({
    enum: BuildingCondition,
    nullable: true,
    description:
      'Assessed condition; null = not assessed (does not feed the score)',
  })
  @Transform(blankToNull)
  @IsEnum(BuildingCondition)
  @IsOptional()
  condition?: BuildingCondition | null;

  @ApiPropertyOptional({ enum: RoofCondition, nullable: true })
  @Transform(blankToNull)
  @IsEnum(RoofCondition)
  @IsOptional()
  roofCondition?: RoofCondition | null;

  @ApiPropertyOptional({ description: '0–100' })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  structuralScore?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  longitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Object)
  @Transform(({ value }) => {
    // Not sent → leave the stored value alone on update.
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) return [];
    // Filter out null, undefined, and nested empty arrays (e.g. [[]])
    return value.filter(
      (item: any) =>
        item !== null &&
        item !== undefined &&
        typeof item === 'object' &&
        !Array.isArray(item),
    );
  })
  annotations?: Record<string, any>[];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Object)
  @Transform(({ value }) => {
    // Not sent → leave the stored value alone on update.
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item: any) =>
        item !== null &&
        item !== undefined &&
        typeof item === 'object' &&
        !Array.isArray(item),
    );
  })
  media?: Record<string, any>[];

  @ApiPropertyOptional({ type: [FacilityItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FacilityItemDto)
  @IsOptional()
  facilities?: FacilityItemDto[];
}
