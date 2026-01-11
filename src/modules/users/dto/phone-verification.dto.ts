import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InitiatePhoneVerificationDto {
  @ApiProperty({
    description: 'Phone number to verify',
    example: '+1234567890',
  })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;
}

export class CompletePhoneVerificationDto {
  @ApiProperty({
    description: 'Verification code sent via SMS',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  code: string;
}
