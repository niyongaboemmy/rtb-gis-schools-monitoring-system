import { IsEmail, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
  @ApiProperty({ example: 'admin@rtb.gov.rw' })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: '482017',
    description: '6-digit code from the email',
  })
  @Matches(/^\d{6}$/, { message: 'Code must be 6 digits' })
  otp: string;
}
