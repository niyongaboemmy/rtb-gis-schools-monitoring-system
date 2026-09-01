import { IsEmail, IsString, MinLength, Matches, IsOptional, IsUUID, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'John' })
  @IsString()
  @MinLength(2)
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @MinLength(2)
  lastName: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'SecurePass123!',
    description: 'Password must contain uppercase, lowercase, number, and special character',
  })
  @IsString()
  @MinLength(8)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    {
      message:
        'Password must contain uppercase, lowercase, number, and special character',
    },
  )
  password: string;

  @ApiProperty({ example: 'true', description: 'Must accept terms to register' })
  @IsBoolean()
  termsAccepted: boolean;

  @ApiProperty({
    example: 'uuid-of-school',
    required: false,
    description: 'School ID if registering as student at specific school',
  })
  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @ApiProperty({
    example: 'student',
    required: false,
    enum: ['student', 'teacher'],
    description: 'Account type (default: student)',
  })
  @IsOptional()
  @IsString()
  accountType?: 'student' | 'teacher';
}
