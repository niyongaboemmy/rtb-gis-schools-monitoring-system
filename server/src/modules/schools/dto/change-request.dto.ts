import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsIn,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CHANGE_REQUESTABLE_FIELDS } from '../school-field-permissions';

export class ChangeRequestFieldDto {
  @ApiProperty({ example: 'latitude', enum: CHANGE_REQUESTABLE_FIELDS })
  @IsString()
  @IsIn(CHANGE_REQUESTABLE_FIELDS)
  field: string;

  @ApiProperty({
    description: 'Proposed new value (text, number, or a short description)',
    example: -1.9441,
  })
  @IsDefined()
  proposedValue: unknown;
}

export class CreateChangeRequestDto {
  @ApiProperty({ type: [ChangeRequestFieldDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ChangeRequestFieldDto)
  fields: ChangeRequestFieldDto[];

  @ApiProperty({ example: 'The school pin sits on the neighbouring plot.' })
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  reason: string;
}
