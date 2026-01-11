import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  INotificationProvider,
  NotificationContact,
  EmailPayload,
} from '@modules/notifications/interfaces/notification-provider.interface';
import mailchimp from '@mailchimp/mailchimp_transactional';
import * as mailchimpMarketing from '@mailchimp/mailchimp_marketing';

@Injectable()
export class MailchimpProvider implements INotificationProvider<EmailPayload> {
  private readonly logger = new Logger(MailchimpProvider.name);
  private client: any; // Transactional Client
  private marketingClient: any; // Marketing Client (configured globally usually, but we'll set it up)

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('MAILCHIMP_API_KEY');
    const marketingApiKey =
      this.configService.get<string>('MAILCHIMP_MARKETING_API_KEY') || apiKey; // Often same, but can vary
    const serverPrefix = this.configService.get<string>(
      'MAILCHIMP_SERVER_PREFIX',
    ); // e.g. us19

    if (apiKey) {
      this.client = mailchimp(apiKey);
    } else {
      this.logger.warn('MAILCHIMP_API_KEY not configured');
    }

    if (marketingApiKey && serverPrefix) {
      mailchimpMarketing.setConfig({
        apiKey: marketingApiKey,
        server: serverPrefix,
      });
      this.marketingClient = mailchimpMarketing;
    } else {
      this.logger.warn(
        'MAILCHIMP_MARKETING_API_KEY or MAILCHIMP_SERVER_PREFIX not configured',
      );
    }
  }

  getName(): string {
    return 'mailchimp';
  }

  async send(to: string, payload: EmailPayload): Promise<any> {
    if (!this.client)
      throw new Error('Mailchimp Transactional API Key not configured');

    const from =
      this.configService.get<string>('EMAIL_FROM') || 'onboarding@resend.dev';

    const message = {
      from_email: from,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
      to: [
        {
          email: to,
          type: 'to',
        },
      ],
    };

    try {
      const response = await this.client.messages.send({
        message,
      });
      // Response is array of status objects
      const status = response[0];
      if (status.status === 'rejected' || status.status === 'invalid') {
        throw new Error(`Mailchimp rejected email: ${status.reject_reason}`);
      }

      this.logger.log(`Email sent to ${to} via Mailchimp: ${status.status}`);
      return response;
    } catch (error: any) {
      this.logger.error(`Mailchimp failed: ${error.message}`);
      throw error;
    }
  }

  async addContact(contact: NotificationContact): Promise<any> {
    if (!this.marketingClient)
      throw new Error('Mailchimp Marketing API not configured');

    const listId =
      contact.listId || this.configService.get<string>('MAILCHIMP_LIST_ID');
    if (!listId) {
      throw new Error('Mailchimp List ID required');
    }

    try {
      const response = await this.marketingClient.lists.addListMember(listId, {
        email_address: contact.email,
        status: 'subscribed',
        merge_fields: {
          FNAME: contact.firstName || '',
          LNAME: contact.lastName || '',
          ...contact.customFields,
        },
      });
      this.logger.log(
        `Added contact ${contact.email} to Mailchimp list ${listId}`,
      );
      return response;
    } catch (error: any) {
      this.logger.error(
        `Mailchimp Add Contact failed: ${error.message || error}`,
      );
      // Mailchimp marketing error handling is tricky, response often in error.response
      if (error.response?.body?.title === 'Member Exists') {
        this.logger.log(
          `Contact ${contact.email} already exists in Mailchimp.`,
        );
        return { status: 'exists' };
      }
      throw error;
    }
  }
}
