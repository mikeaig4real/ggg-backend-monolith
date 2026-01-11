import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterPushTokenDto {
  @ApiProperty({
    description: 'Push notification token',
    example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    description: 'Device type',
    enum: ['mobile', 'web'],
    example: 'mobile',
  })
  @IsNotEmpty()
  @IsEnum(['mobile', 'web'])
  type: 'mobile' | 'web';
}
