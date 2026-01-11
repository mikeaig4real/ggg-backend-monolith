import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AdminPermissions, AccountType } from '@app/common';

export class VerifyAuthDto {
  @ApiProperty({
    description: 'JWT Token to verify',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsNotEmpty()
  jwt: string;

  @ApiProperty({
    description: 'Required permission to check',
    enum: AdminPermissions,
    required: false,
  })
  @IsOptional()
  @IsEnum(AdminPermissions)
  permission?: string;

  @ApiProperty({
    description: 'Required role to check',
    enum: AccountType,
    required: false,
  })
  @IsOptional()
  @IsEnum(AccountType)
  role?: string;
}
