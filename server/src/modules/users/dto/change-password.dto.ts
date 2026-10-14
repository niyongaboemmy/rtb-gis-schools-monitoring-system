import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsStrongPassword } from '../../../common/security/password-policy';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  currentPassword: string;

  /** Email containment and history are checked in the service. */
  @ApiProperty({ example: 'New-Pass@2026' })
  @IsString()
  @IsStrongPassword()
  newPassword: string;
}
