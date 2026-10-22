import { IsPlausibleYear } from '../../../common/validation/plausible-year';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { SchoolType, SchoolStatus } from '../entities/school.entity';
import { BuildingDto } from './building.dto';

class EducationProgramDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  code?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  totalStudents?: number;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  @Min(0)
  capacity?: number;
}

export class CreateSchoolDto {
  @ApiProperty({ example: 'TSS-001' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'Nyamirama TSS' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ enum: SchoolType })
  @IsEnum(SchoolType)
  @IsOptional()
  type?: SchoolType;

  @ApiPropertyOptional({ enum: SchoolStatus })
  @IsEnum(SchoolStatus)
  @IsOptional()
  status?: SchoolStatus;

  @ApiProperty({ example: 'Eastern Province' })
  @IsString()
  province: string;

  @ApiProperty({ example: 'Kayonza' })
  @IsString()
  district: string;

  @ApiProperty({ example: 'Kabare' })
  @IsString()
  sector: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  cell?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  village?: string;

  @ApiProperty({ example: -1.9441 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({ example: 30.0619 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  elevation?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  website?: string;

  @ApiPropertyOptional({ description: 'Whole year, 1900 – current year' })
  @IsPlausibleYear()
  @IsOptional()
  establishedYear?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  headTeacher?: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  maleStudents?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  femaleStudents?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  totalStudents?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  totalTeachers?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  // Staff
  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  maleTeachers?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  femaleTeachers?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  adminStaff?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  maleAdminStaff?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  femaleAdminStaff?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  supportStaff?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  maleSupportStaff?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  femaleSupportStaff?: number;

  // Roads
  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Min(0)
  numberOfAccessRoads?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  roadState?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  roadStatusPercentage?: number;

  // Land
  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Min(0)
  usedLandArea?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Min(0)
  unusedLandArea?: number;

  // trades (TVET Trades)
  @ApiPropertyOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EducationProgramDto)
  @IsOptional()
  educationPrograms?: EducationProgramDto[];

  // Buildings
  @ApiPropertyOptional({ type: [BuildingDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BuildingDto)
  @IsOptional()
  buildings?: BuildingDto[];

  // GIS source files — the form collects these on the Location step and the
  // 2D viewer reads them back, so they must survive create/update.
  @ApiPropertyOptional({
    description: '2D KMZ/KML path for the OpenLayers viewer',
  })
  @IsString()
  @IsOptional()
  kmz2dFilePath?: string;

  @ApiPropertyOptional({ description: 'GeoTIFF raster overlay path' })
  @IsString()
  @IsOptional()
  tifFilePath?: string;

  @ApiPropertyOptional()
  @IsOptional()
  glb3dHomePosition?: any;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  glb3dAnnotations?: any[];
}
