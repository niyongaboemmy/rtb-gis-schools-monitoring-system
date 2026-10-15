import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const SIX_DIGITS = /^\d{6}$/;

/** Carries the short-lived token issued by /auth/login when 2FA is needed. */
export class MfaTokenDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  mfaToken: string;
}

/** Second step of sign-in: exactly one of the three factors. */
export class MfaVerifyDto extends MfaTokenDto {
  @ApiPropertyOptional({ example: '123456', description: 'Authenticator code' })
  @IsOptional()
  @Matches(SIX_DIGITS, { message: 'Code must be 6 digits' })
  code?: string;

  @ApiPropertyOptional({ example: 'abcde-23456' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  recoveryCode?: string;

  @ApiPropertyOptional({
    example: '123456',
    description: 'Code emailed by /auth/2fa/email',
  })
  @IsOptional()
  @Matches(SIX_DIGITS, { message: 'Code must be 6 digits' })
  emailCode?: string;
}

export class MfaEnrollConfirmDto extends MfaTokenDto {
  @ApiProperty({ example: '123456' })
  @Matches(SIX_DIGITS, { message: 'Code must be 6 digits' })
  code: string;
}

export class TotpCodeDto {
  @ApiProperty({ example: '123456' })
  @Matches(SIX_DIGITS, { message: 'Code must be 6 digits' })
  code: string;
}

export class DisableMfaDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  password: string;

  @ApiProperty({ description: 'Authenticator code or a recovery code' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  code: string;
}
