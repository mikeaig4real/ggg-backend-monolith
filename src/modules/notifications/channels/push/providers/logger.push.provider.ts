import { Logger } from '@nestjs/common';
import {
  INotificationProvider,
  NotificationContact,
  PushPayload,
} from '@modules/notifications/interfaces/notification-provider.interface';

export class LoggerPushProvider implements INotificationProvider<PushPayload> {
  private readonly logger = new Logger(LoggerPushProvider.name);

  async send(to: string, payload: PushPayload): Promise<any> {
    this.logger.log(
      `[Push Logger] Sending Push to ${to}: ${payload.title} - ${payload.body}`,
    );
    return { success: true, provider: this.getName() };
  }

  getName(): string {
    return 'logger-push';
  }

  async addContact(contact: NotificationContact): Promise<any> {
    this.logger.log(`[Push Logger] Adding contact: ${contact.email}`);
    return { success: true };
  }
}
