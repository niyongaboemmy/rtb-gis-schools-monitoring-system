import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  BuildingCondition,
  RoofCondition,
} from '../entities/school-building.entity';

export class FacilityItemDto {
  @IsString()
  facility_id: string;

  @IsString()
  facility_name: string;

  @IsNumber()
  number_of_rooms: number;
}

export class BuildingDto {
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
  @IsNumber()
  @IsOptional()
  floors?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  area?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  yearBuilt?: number;

  @ApiPropertyOptional({ enum: BuildingCondition })
  @IsEnum(BuildingCondition)
  @IsOptional()
  condition?: BuildingCondition;

  @ApiPropertyOptional({ enum: RoofCondition })
  @IsEnum(RoofCondition)
  @IsOptional()
  roofCondition?: RoofCondition;

  @ApiPropertyOptional()
  @IsNumber()
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

  @ApiPropertyOptional({ type: [FacilityItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FacilityItemDto)
  @IsOptional()
  facilities?: FacilityItemDto[];
}
