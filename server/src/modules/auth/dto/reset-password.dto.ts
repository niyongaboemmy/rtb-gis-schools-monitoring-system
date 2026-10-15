import { IsEmail, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsStrongPassword } from '../../../common/security/password-policy';

export class ResetPasswordDto {
  @ApiProperty({ example: 'admin@rtb.gov.rw' })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: '482017',
    description: '6-digit code from the email',
  })
  @Matches(/^\d{6}$/, { message: 'Code must be 6 digits' })
  otp: string;

  @ApiProperty({ example: 'New-Pass@2026' })
  @IsString()
  @IsStrongPassword({ emailField: 'email' })
  password: string;
}
