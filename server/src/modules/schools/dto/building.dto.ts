import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import {
  BuildingCondition,
  RoofCondition,
} from '../entities/school-building.entity';

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
  rooms?: number;

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
}
