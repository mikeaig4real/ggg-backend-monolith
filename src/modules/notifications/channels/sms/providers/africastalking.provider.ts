import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  INotificationProvider,
  NotificationContact,
  SmsPayload,
} from '@modules/notifications/interfaces/notification-provider.interface';

@Injectable()
export class AfricasTalkingSmsProvider implements INotificationProvider<SmsPayload> {
  private readonly logger = new Logger(AfricasTalkingSmsProvider.name);
  private client: any;
  private sms: any;

  constructor(private readonly configService: ConfigService) {
    const username = this.configService.get<string>('AFRICASTALKING_USERNAME');
    const apiKey = this.configService.get<string>('AFRICASTALKING_API_KEY');

    if (username && apiKey) {
      const AfricasTalking = require('africastalking')({
        apiKey,
        username,
      });
      this.client = AfricasTalking;
      this.sms = AfricasTalking.SMS;
    } else {
      this.logger.warn("Africa's Talking credentials not found");
    }
  }

  getName(): string {
    return 'africastalking';
  }

  async send(to: string, payload: SmsPayload): Promise<any> {
    if (!this.sms) {
      const error = new Error("Africa's Talking not configured");
      this.logger.error(error.message);
      throw error;
    }

    try {
      this.logger.log(`Sending SMS via Africa's Talking to ${to}`);

      const senderId = this.configService.get<string>(
        'AFRICASTALKING_SENDER_ID',
      );
      const options: any = {
        to: [to],
        message: payload.text,
      };

      if (senderId) {
        options.from = senderId;
      }

      const response = await this.sms.send(options);
      this.logger.log(`Africa's Talking Response: ${JSON.stringify(response)}`);
      return response;
    } catch (err: any) {
      const errorMessage = err.response?.data
        ? JSON.stringify(err.response.data)
        : err.message;
      this.logger.error(`Africa's Talking Error: ${errorMessage}`);
      throw err;
    }
  }

  async addContact(contact: NotificationContact): Promise<any> {
    this.logger.warn("addContact not implemented for Africa's Talking");
    return;
  }
}
