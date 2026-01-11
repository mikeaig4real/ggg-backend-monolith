import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'User password (min 6 characters)',
    example: 'strongPassword123',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({
    description: 'Username',
    example: 'fateplayer1',
  })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({
    description: 'ReCAPTCHA token',
    required: false,
  })
  @IsOptional()
  @IsString()
  captchaToken?: string;

  @ApiProperty({
    description: 'Phone number',
    required: false,
    example: '+1234567890',
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;
}
