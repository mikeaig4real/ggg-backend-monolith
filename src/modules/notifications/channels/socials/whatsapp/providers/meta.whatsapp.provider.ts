import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  INotificationProvider,
  NotificationContact,
  WhatsappPayload,
} from '@modules/notifications/interfaces/notification-provider.interface';

@Injectable()
export class MetaWhatsappProvider implements INotificationProvider<WhatsappPayload> {
  private readonly logger = new Logger(MetaWhatsappProvider.name);
  private readonly baseUrl = 'https://graph.facebook.com/v19.0'; // Or latest version

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  getName(): string {
    return 'meta-whatsapp';
  }

  async send(to: string, payload: WhatsappPayload): Promise<any> {
    const phoneNumberId = this.configService.get<string>(
      'META_WHATSAPP_PHONE_ID',
    );
    const accessToken = this.configService.get<string>('META_WHATSAPP_TOKEN');

    if (!phoneNumberId || !accessToken) {
      this.logger.error('Meta WhatsApp credentials missing');
      throw new Error('Meta WhatsApp not configured');
    }

    const url = `${this.baseUrl}/${phoneNumberId}/messages`;

    const body: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: payload.type,
    };

    if (payload.type === 'text' && payload.text) {
      body.text = payload.text;
    } else if (payload.type === 'template' && payload.template) {
      body.template = payload.template;
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, body, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }),
      );

      this.logger.log(
        `WhatsApp sent to ${to}: ${JSON.stringify(response.data)}`,
      );
      return response.data;
    } catch (error: any) {
      const msg = error.response?.data
        ? JSON.stringify(error.response.data)
        : error.message;
      this.logger.error(`Meta WhatsApp Error: ${msg}`);
      throw error;
    }
  }

  async addContact(contact: NotificationContact): Promise<any> {
    this.logger.warn('addContact not implemented for Meta WhatsApp');
    return;
  }
}
