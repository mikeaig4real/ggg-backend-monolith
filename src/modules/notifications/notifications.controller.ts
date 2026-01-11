import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { ConfigService } from '@nestjs/config';
import { SendNotificationDto } from './dto/send-notification.dto';
import { SendSmsDto } from './dto/send-sms.dto';
import { JwtAuthGuard } from '@guards/jwt-auth.guard';
import {
  AccountType,
  CurrentUser,
  Roles,
  type CurrentUserPayload,
} from '@app/common';
import { Public } from 'src/decorators/public.decorator';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {}

  @Post('send')
  @Roles(AccountType.ADMIN) // Only admins should trigger arbitrary notifications
  async send(
    @Body() dto: SendNotificationDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.logger.log(`Hit endpoint: send admin=${user._id} type=${dto.type}`);
    return this.notificationsService.send(dto);
  }

  @Post('sms/test')
  @Roles(AccountType.ADMIN)
  async sendTestSms(
    @Body() body: SendSmsDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.logger.log(`Hit endpoint: sendTestSms to=${body.phoneNumber}`);
    return this.notificationsService.sendSms(
      user._id.toString(),
      body.phoneNumber,
      body.message,
    );
  }

  @Post('test/email')
  @Public()
  async testEmail(@Body() body: { email: string }) {
    return this.notificationsService.sendVerificationEmail(
      'test-user-id',
      body.email,
      '123456',
      'TestUser',
    );
  }

  @Post('test/slack')
  @Public()
  async testSlack(@Body() body: { message: string; channel?: string }) {
    return this.notificationsService.sendSlack(
      body?.message || 'Test Slack Notification',
      body?.channel,
    );
  }

  @Post('test/whatsapp')
  @Public()
  async testWhatsapp(@Body() body: { message: string; phoneNumber?: string }) {
    const defaultTo = this.configService.get('META_WHATSAPP_DEFAULT_TO');
    return this.notificationsService.sendWhatsapp(
      'test-user-id',
      body?.phoneNumber || defaultTo,
      body?.message || 'Test WhatsApp Notification',
    );
  }

  @Get()
  async getMyNotifications(@CurrentUser() user: CurrentUserPayload) {
    this.logger.log(`Hit endpoint: getMyNotifications user=${user._id}`);
    const userId = user._id.toString();
    return this.notificationsService.getUserNotifications(userId);
  }

  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: CurrentUserPayload) {
    this.logger.log(`Hit endpoint: getUnreadCount user=${user._id}`);
    const userId = user._id.toString();
    return { count: await this.notificationsService.getUnreadCount(userId) };
  }

  @Patch(':id/read')
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.logger.log(
      `Hit endpoint: markAsRead user=${user._id} notificationId=${id}`,
    );
    const userId = user._id.toString();
    return this.notificationsService.markAsRead(id, userId);
  }

  @Patch('read-all')
  async markAllAsRead(@CurrentUser() user: CurrentUserPayload) {
    this.logger.log(`Hit endpoint: markAllAsRead user=${user._id}`);
    const userId = user._id.toString();
    return this.notificationsService.markAllAsRead(userId);
  }
}
