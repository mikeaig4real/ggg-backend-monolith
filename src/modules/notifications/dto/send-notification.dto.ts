import {
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  NotificationChannelType,
  NotificationType,
} from '@modules/notifications/interfaces/notification-payload.interface';

import { ApiProperty } from '@nestjs/swagger';

export class SendNotificationDto {
  @ApiProperty({
    description: 'Array of user IDs to receive the notification',
    example: ['60f1b5b3b3b3b3b3b3b3b3b3'],
  })
  @IsArray()
  @IsString({ each: true })
  userIds: string[];

  @ApiProperty({
    description: 'Channels to send the notification through',
    enum: NotificationChannelType,
    isArray: true,
    required: false,
    example: [NotificationChannelType.IN_APP, NotificationChannelType.EMAIL],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(NotificationChannelType, { each: true })
  channels?: NotificationChannelType[];

  @ApiProperty({
    description: 'Title of the notification',
    example: 'Welcome to ggg!',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Body message of the notification',
    example: 'Thank you for joining us.',
  })
  @IsString()
  message: string;

  @ApiProperty({
    description: 'HTML content for email notifications',
    required: false,
  })
  @IsOptional()
  @IsString()
  html?: string;

  @ApiProperty({
    description: 'Type of notification',
    enum: NotificationType,
    default: NotificationType.INFO,
    required: false,
  })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType = NotificationType.INFO;

  @ApiProperty({
    description: 'Additional metadata',
    required: false,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiProperty({
    description: 'Email template name',
    required: false,
    example: 'welcome_email',
  })
  @IsOptional()
  @IsString()
  template?: string;

  @ApiProperty({
    description: 'Context for email template',
    required: false,
  })
  @IsOptional()
  @IsObject()
  context?: Record<string, any>;
}
