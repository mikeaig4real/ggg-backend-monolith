import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendSmsDto {
  @ApiProperty({
    description: 'Phone number to send SMS to',
    example: '+1234567890',
  })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({
    description: 'Message content',
    example: 'Hello from ggg!',
  })
  @IsString()
  @IsNotEmpty()
  message: string;
}
