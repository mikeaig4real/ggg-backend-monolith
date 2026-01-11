import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  INotificationProvider,
  NotificationContact,
  EmailPayload,
} from '@modules/notifications/interfaces/notification-provider.interface';
import { Resend } from 'resend';

@Injectable()
export class ResendProvider implements INotificationProvider<EmailPayload> {
  private readonly logger = new Logger(ResendProvider.name);
  private resend: Resend;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.logger.warn('RESEND_API_KEY not configured');
    }
  }

  getName(): string {
    return 'resend';
  }

  async send(to: string, payload: EmailPayload): Promise<any> {
    if (!this.resend) throw new Error('Resend API Key not configured');

    const from =
      this.configService.get<string>('EMAIL_FROM') ||
      'ggg <onboarding@resend.dev>';

    try {
      const { data, error } = await this.resend.emails.send({
        from,
        to: [to],
        subject: payload.subject,
        html: payload.html || (payload.text as string),
        text: payload.text || ' ',
      });

      if (error) {
        throw new Error(error.message);
      }

      this.logger.log(`Email sent to ${to} via Resend: ${data?.id}`);
      return data;
    } catch (error: any) {
      this.logger.error(`Resend failed: ${error.message}`);
      throw error;
    }
  }

  async addContact(contact: NotificationContact): Promise<any> {
    if (!this.resend) throw new Error('Resend not configured');

    const audienceId =
      contact.listId || this.configService.get<string>('RESEND_AUDIENCE_ID');

    if (!audienceId) {
      throw new Error('Resend Audience ID required');
    }

    try {
      const { data, error } = await this.resend.contacts.create({
        email: contact.email,
        firstName: contact.firstName,
        lastName: contact.lastName,
        unsubscribed: false,
        audienceId: audienceId,
      });

      if (error) {
        throw new Error(error.message);
      }

      this.logger.log(`Added contact ${contact.email} to Resend Audience`);
      return data;
    } catch (error: any) {
      this.logger.error(`Resend Add Contact failed: ${error.message}`);
      throw error;
    }
  }
}
