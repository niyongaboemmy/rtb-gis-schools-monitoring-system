import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GoogleLoginDto {
  @ApiProperty({
    description: 'ID token issued by Google Identity Services on the client',
  })
  @IsString()
  @IsNotEmpty()
  idToken: string;
}
