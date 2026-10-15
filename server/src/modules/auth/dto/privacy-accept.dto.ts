import { IsString, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PrivacyAcceptDto {
  @ApiProperty({ example: '2026-10-draft' })
  @IsString()
  @MaxLength(32)
  @Matches(/^[\w.-]+$/)
  version: string;
}
