import { Logger, Injectable } from '@nestjs/common';
import {
  type INotificationProvider,
  NotificationContact,
  SmsPayload,
} from '@modules/notifications/interfaces/notification-provider.interface';

@Injectable()
export class LoggerSmsProvider implements INotificationProvider<SmsPayload> {
  private readonly logger = new Logger(LoggerSmsProvider.name);

  async send(to: string, payload: SmsPayload): Promise<any> {
    this.logger.log(`[SMS Logger] Sending SMS to ${to}: ${payload.text}`);
    return { success: true, provider: this.getName() };
  }

  getName(): string {
    return 'logger-sms';
  }

  async addContact(contact: NotificationContact): Promise<any> {
    this.logger.log(`[SMS Logger] Adding contact: ${contact.email}`);
    return { success: true };
  }
}
