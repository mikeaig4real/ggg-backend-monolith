import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  INotificationProvider,
  NotificationContact,
  EmailPayload,
} from '@modules/notifications/interfaces/notification-provider.interface';
import FormData from 'form-data';
import Mailgun from 'mailgun.js';

@Injectable()
export class MailgunProvider implements INotificationProvider<EmailPayload> {
  private readonly logger = new Logger(MailgunProvider.name);
  private client: any; // Mailgun Client type
  private domain: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('MAILGUN_API_KEY');
    const username =
      this.configService.get<string>('MAILGUN_USERNAME') || 'api'; // Usually 'api'
    this.domain = this.configService.get<string>('MAILGUN_DOMAIN') || '';

    if (apiKey && this.domain) {
      const mailgun = new Mailgun(FormData);
      this.client = mailgun.client({ username, key: apiKey });
    } else {
      this.logger.warn('MAILGUN_API_KEY or MAILGUN_DOMAIN not configured');
    }
  }

  getName(): string {
    return 'mailgun';
  }

  async send(to: string, payload: EmailPayload): Promise<any> {
    if (!this.client || !this.domain) {
      throw new Error('Mailgun not configured properly');
    }

    const messageData = {
      from:
        this.configService.get<string>('EMAIL_FROM') ||
        `noreply@${this.domain}`,
      to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    };

    try {
      const result = await this.client.messages.create(
        this.domain,
        messageData,
      );
      this.logger.log(`Email sent to ${to} via Mailgun: ${result.id}`);
      return result;
    } catch (error: any) {
      this.logger.error(`Mailgun failed: ${error.message}`);
      throw error;
    }
  }

  async addContact(contact: NotificationContact): Promise<any> {
    if (!this.client) throw new Error('Mailgun not configured');

    const listAddress =
      contact.listId || this.configService.get<string>('MAILGUN_LIST_ADDRESS');
    if (!listAddress) {
      throw new Error('Mailgun List Address required');
    }

    try {
      const newMember = await this.client.lists.members.createMember(
        listAddress,
        {
          address: contact.email,
          name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
          vars: JSON.stringify(contact.customFields || {}),
          subscribed: true,
          upsert: 'yes',
        },
      );
      this.logger.log(
        `Added contact ${contact.email} to Mailgun list ${listAddress}`,
      );
      return newMember;
    } catch (error: any) {
      this.logger.error(`Mailgun Add Contact failed: ${error.message}`);
      throw error;
    }
  }
}
