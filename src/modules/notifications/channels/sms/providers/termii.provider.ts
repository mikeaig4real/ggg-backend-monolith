import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import {
  INotificationProvider,
  NotificationContact,
  SmsPayload,
} from '@modules/notifications/interfaces/notification-provider.interface';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class TermiiSmsProvider implements INotificationProvider<SmsPayload> {
  private readonly logger = new Logger(TermiiSmsProvider.name);
  private readonly apiKey: string;
  private readonly senderId: string;
  private readonly baseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.apiKey = this.configService.get<string>('TERMII_API_KEY') || '';
    this.senderId = this.configService.get<string>('TERMII_SENDER_ID') || 'ggg';
    this.baseUrl =
      this.configService.get<string>('TERMII_BASE_URL') ||
      'https://api.ng.termii.com';

    if (!this.apiKey) {
      this.logger.warn('Termii API Key not found');
    }
  }

  getName(): string {
    return 'termii';
  }

  async send(to: string, payload: SmsPayload): Promise<any> {
    if (!this.apiKey) {
      this.logger.error('Termii API Key missing, cannot send SMS');
      throw new Error('Termii not configured');
    }

    const url = `${this.baseUrl}/api/sms/send`;
    const data = {
      to,
      from: this.senderId,
      sms: payload.text,
      type: 'plain',
      api_key: this.apiKey,
      channel: 'generic', // Use 'dnd' for transactional if needed, but 'generic' is safer for now
    };

    try {
      this.logger.log(`Sending SMS via Termii to ${to}`);
      const response = await firstValueFrom(this.httpService.post(url, data));
      this.logger.log(`Termii Response: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (err: any) {
      this.logger.error(
        `Termii Error: ${err.message} - ${JSON.stringify(err.response?.data)}`,
      );
      throw err;
    }
  }

  async addContact(contact: NotificationContact): Promise<any> {
    this.logger.warn('addContact not implemented for Termii');
    return;
  }
}
