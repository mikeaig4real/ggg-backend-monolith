import { IsString, IsOptional, MinLength, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: 'The new username',
    minLength: 3,
    example: 'cool_user_123',
  })
  @IsString()
  @IsOptional()
  @MinLength(3)
  username?: string;

  @ApiPropertyOptional({
    description: 'User biography',
    example: 'Just a casual gamer.',
  })
  @IsString()
  @IsOptional()
  bio?: string;

  @ApiPropertyOptional({
    description: 'Profile picture URL',
    example: 'https://example.com/avatar.jpg',
  })
  @IsString()
  @IsOptional()
  @IsUrl()
  profilePicture?: string;

  @ApiPropertyOptional({
    description: 'Notification settings per channel',
    example: {
      channels: {
        email: true,
        sms: true,
        push: true,
        whatsapp: true,
        slack: true,
        'in-app': true,
      },
    },
  })
  @IsOptional()
  notificationSettings?: {
    channels: {
      email?: boolean;
      sms?: boolean;
      push?: boolean;
      whatsapp?: boolean;
      slack?: boolean;
      'in-app'?: boolean;
    };
  };
}
