import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
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
  @IsNumber()
  @IsOptional()
  @Min(0)
  totalStudents?: number;

  @ApiPropertyOptional()
  @IsNumber()
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

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  establishedYear?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  headTeacher?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Min(0)
  maleStudents?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Min(0)
  femaleStudents?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Min(0)
  totalStudents?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  totalTeachers?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  // Staff
  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  maleTeachers?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  femaleTeachers?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  adminStaff?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Min(0)
  maleAdminStaff?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Min(0)
  femaleAdminStaff?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  supportStaff?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Min(0)
  maleSupportStaff?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Min(0)
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

  @ApiPropertyOptional()
  @IsOptional()
  glb3dHomePosition?: any;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  glb3dAnnotations?: any[];
}
