import { Injectable, Logger } from '@nestjs/common';
import {
  INotificationProvider,
  NotificationContact,
  EmailPayload,
} from '@modules/notifications/interfaces/notification-provider.interface';

@Injectable()
export class LoggerEmailProvider implements INotificationProvider<EmailPayload> {
  private readonly logger = new Logger(LoggerEmailProvider.name);

  async send(to: string, payload: EmailPayload): Promise<any> {
    this.logger.log(`[Mock Email] To: ${to}, Subject: ${payload.subject}`);
    return { success: true };
  }

  async addContact(contact: NotificationContact): Promise<any> {
    this.logger.log(
      `[Mock Add Contact] Email: ${contact.email}, FName: ${contact.firstName}, ListId: ${contact.listId}`,
    );
    return { success: true };
  }

  getName(): string {
    return 'logger-email';
  }
}
