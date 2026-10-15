import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * The refresh token normally arrives in the httpOnly cookie and the body is
 * empty. `userId` + `refreshToken` are accepted once, from clients that still
 * hold a pre-cookie token in localStorage, to migrate them without a forced
 * sign-out.
 */
export class RefreshDto {
  @ApiPropertyOptional({ description: 'Legacy only' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: 'Legacy only' })
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  refreshToken?: string;
}
