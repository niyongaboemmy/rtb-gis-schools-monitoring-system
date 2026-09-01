import { IsEmail, IsString, Matches, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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

  @ApiProperty({ example: 'NewPass@123' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Password must contain an uppercase letter, a lowercase letter and a number',
  })
  password: string;
}
