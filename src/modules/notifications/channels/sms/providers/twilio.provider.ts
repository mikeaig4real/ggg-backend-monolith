import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  INotificationProvider,
  NotificationContact,
  SmsPayload,
} from '@modules/notifications/interfaces/notification-provider.interface';
import { Twilio } from 'twilio';

@Injectable()
export class TwilioSmsProvider implements INotificationProvider<SmsPayload> {
  private readonly logger = new Logger(TwilioSmsProvider.name);
  private client: Twilio;

  constructor(private readonly configService: ConfigService) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');

    if (accountSid && authToken) {
      this.client = new Twilio(accountSid, authToken);
    } else {
      this.logger.warn('Twilio credentials not found');
    }
  }

  getName(): string {
    return 'twilio';
  }

  async send(to: string, payload: SmsPayload): Promise<any> {
    if (!this.client) {
      this.logger.error('Twilio credentials missing, cannot send SMS');
      throw new Error('Twilio not configured');
    }

    const from = this.configService.get<string>('TWILIO_FROM_NUMBER');
    try {
      const message = await this.client.messages.create({
        body: payload.text,
        from: from,
        to: to,
      });
      this.logger.log(`SMS Sent via Twilio to ${to}: ${message.sid}`);
      return message;
    } catch (err: any) {
      this.logger.error(`Twilio Error: ${err.message}`);
      throw err;
    }
  }

  async addContact(contact: NotificationContact): Promise<any> {
    this.logger.warn('addContact not implemented for Twilio');
    return;
  }
}
