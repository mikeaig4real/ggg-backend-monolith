import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  INotificationProvider,
  NotificationContact,
  EmailPayload,
} from '@modules/notifications/interfaces/notification-provider.interface';
import * as sgMail from '@sendgrid/mail';
import * as sgClient from '@sendgrid/client';

@Injectable()
export class SendGridProvider implements INotificationProvider<EmailPayload> {
  private readonly logger = new Logger(SendGridProvider.name);

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
    if (apiKey) {
      sgMail.setApiKey(apiKey);
      sgClient.setApiKey(apiKey);
    } else {
      this.logger.warn('SENDGRID_API_KEY not configured');
    }
  }

  getName(): string {
    return 'sendgrid';
  }

  async send(to: string, payload: EmailPayload): Promise<any> {
    if (!this.configService.get('SENDGRID_API_KEY')) {
      throw new Error('SendGrid API Key not configured');
    }

    const msg = {
      to,
      from:
        this.configService.get<string>('EMAIL_FROM') || 'onboarding@resend.dev',
      subject: payload.subject,
      text: payload.text || ' ', 
      html: payload.html || ' ', 
    };

    try {
      await sgMail.send(msg as sgMail.MailDataRequired);
      this.logger.log(`Email sent to ${to} via SendGrid`);
      return { success: true };
    } catch (error: any) {
      this.logger.error(
        `SendGrid failed: ${error.message} - ${JSON.stringify(
          error.response?.body,
        )}`,
      );
      throw error;
    }
  }

  async addContact(contact: NotificationContact): Promise<any> {
    // SendGrid Marketing Campaigns API (v3)
    const listId =
      contact.listId || this.configService.get<string>('SENDGRID_LIST_ID');

    if (!listId) {
      this.logger.warn('No List ID provided for SendGrid contact');
    }

    const data = {
      contacts: [
        {
          email: contact.email,
          first_name: contact.firstName,
          last_name: contact.lastName,
          custom_fields: contact.customFields,
        },
      ],
      list_ids: listId ? [listId] : [],
    };

    const request = {
      url: `/v3/marketing/contacts`,
      method: 'PUT' as const,
      body: data,
    };

    try {
      const [response, body] = await sgClient.request(request);
      this.logger.log(`Added contact ${contact.email} to SendGrid`);
      return body;
    } catch (error: any) {
      this.logger.error(
        `SendGrid Add Contact failed: ${error.message} - ${JSON.stringify(
          error.response?.body,
        )}`,
      );
      throw error;
    }
  }
}
