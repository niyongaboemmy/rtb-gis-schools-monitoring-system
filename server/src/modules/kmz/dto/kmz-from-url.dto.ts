import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Body of the "process a pre-uploaded file" routes (WS9.4 / WS9.7). */
export class KmzFromUrlDto {
  @ApiProperty({ example: '/files/kmz/1700000000000-site.kmz' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  fileUrl: string;

  @ApiProperty({ example: 'site.kmz' })
  @IsString()
  @MaxLength(255)
  // A plain file name: no directories, no control characters.
  // eslint-disable-next-line no-control-regex
  @Matches(/^[^\\/\x00-\x1f]+$/, {
    message: 'fileName must be a plain file name',
  })
  fileName: string;
}
