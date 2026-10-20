import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * A Google credential from the browser — exactly one of:
 *  - `idToken`: from Google's rendered button (Identity Services ID token);
 *  - `accessToken`: from the custom-styled button (OAuth token client,
 *    scope "openid email profile"). The server checks it was issued to our
 *    client ID before trusting it.
 */
export class GoogleLoginDto {
  @ApiPropertyOptional({
    description: 'ID token issued by Google Identity Services',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(8192)
  idToken?: string;

  @ApiPropertyOptional({
    description: 'OAuth access token from the Google token client',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  accessToken?: string;
}
