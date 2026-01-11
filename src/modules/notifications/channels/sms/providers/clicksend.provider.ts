import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  INotificationProvider,
  NotificationContact,
  SmsPayload,
} from '@modules/notifications/interfaces/notification-provider.interface';

@Injectable()
export class ClickSendSmsProvider implements INotificationProvider<SmsPayload> {
  private readonly logger = new Logger(ClickSendSmsProvider.name);
  private readonly baseUrl = 'https://rest.clicksend.com/v3';
  private authHeader: string | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    const username = this.configService.get<string>('CLICKSEND_USERNAME');
    const apiKey = this.configService.get<string>('CLICKSEND_API_KEY');

    if (username && apiKey) {
      this.authHeader =
        'Basic ' + Buffer.from(`${username}:${apiKey}`).toString('base64');
    } else {
      this.logger.warn('ClickSend credentials not found');
    }
  }

  getName(): string {
    return 'clicksend';
  }

  async send(to: string, payload: SmsPayload): Promise<any> {
    if (!this.authHeader) {
      const error = new Error('ClickSend credentials missing, cannot send SMS');
      this.logger.error(error.message);
      throw error;
    }

    const body = {
      messages: [
        {
          source: 'sdk',
          from: this.configService.get<string>('SMS_SENDER_ID') || 'ggg',
          body: payload.text,
          to: to,
        },
      ],
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/sms/send`, body, {
          headers: {
            Authorization: this.authHeader,
            'Content-Type': 'application/json',
          },
        }),
      );

      this.logger.log(`SMS Sent to ${to}: status=${response.status}`);
      return response.data;
    } catch (err: any) {
      this.logger.error(
        `ClickSend Error: ${err.message} - ${JSON.stringify(err.response?.data)}`,
      );
      throw err;
    }
  }

  async addContact(contact: NotificationContact): Promise<any> {
    this.logger.warn('addContact not implemented for ClickSend');
    return;
  }
}
