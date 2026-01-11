import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  INotificationProvider,
  NotificationContact,
  SmsPayload,
} from '@modules/notifications/interfaces/notification-provider.interface';
import { Vonage } from '@vonage/server-sdk';
import { Auth } from '@vonage/auth';

@Injectable()
export class VonageSmsProvider implements INotificationProvider<SmsPayload> {
  private readonly logger = new Logger(VonageSmsProvider.name);
  private vonage: Vonage;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('VONAGE_API_KEY');
    const apiSecret = this.configService.get<string>('VONAGE_API_SECRET');

    if (apiKey && apiSecret) {
      this.vonage = new Vonage(
        new Auth({
          apiKey: apiKey,
          apiSecret: apiSecret,
        }),
      );
    } else {
      this.logger.warn('Vonage credentials not found');
    }
  }

  getName(): string {
    return 'vonage';
  }

  async send(to: string, payload: SmsPayload): Promise<any> {
    if (!this.vonage) {
      this.logger.error('Vonage credentials missing, cannot send SMS');
      throw new Error('Vonage not configured');
    }

    const from = this.configService.get<string>('SMS_SENDER_ID') || 'ggg';
    const text = payload.text;

    try {
      const resp = await this.vonage.sms.send({ to, from, text });
      this.logger.log(`SMS Sent via Vonage to ${to}`);
      return resp;
    } catch (err: any) {
      this.logger.error(`Vonage Error: ${err.message}`);
      throw err;
    }
  }

  async addContact(contact: NotificationContact): Promise<any> {
    this.logger.warn('addContact not implemented for Vonage');
    return;
  }
}
