import { Injectable, Logger, Inject } from '@nestjs/common';
import {
  INotificationChannel,
  NotificationData,
  NotificationRecipient,
} from '@modules/notifications/interfaces/notification-channel.interface';
import {
  type INotificationProvider,
  WhatsappPayload,
} from '@modules/notifications/interfaces/notification-provider.interface';
import {
  NotificationType,
  NotificationChannelType,
} from '@modules/notifications/interfaces/notification-payload.interface';
import { ControlCenterService } from '@modules/control-center/control-center.service';
import { MetaWhatsappProvider } from './providers/meta.whatsapp.provider';

@Injectable()
export class WhatsappChannel implements INotificationChannel {
  private readonly logger = new Logger(WhatsappChannel.name);
  private providers: Map<string, INotificationProvider<WhatsappPayload>> =
    new Map();

  constructor(
    private readonly controlCenter: ControlCenterService,
    private readonly meta: MetaWhatsappProvider,
  ) {
    this.providers.set('meta', meta);
    // Future: add twilio or others
  }

  async send(
    recipients: NotificationRecipient[],
    data: NotificationData,
  ): Promise<void> {
    this.logger.log(
      `Hit WhatsappChannel.send with args: recipientsCount=${recipients.length}, template=${data.template || 'none'}`,
    );

    // Determine active provider
    // Default to 'meta' if not configured to avoid breaking change
    let providerName = await this.controlCenter.getActiveProvider(
      'notifications',
      'whatsapp',
    );
    if (!providerName || !this.providers.has(providerName)) {
      this.logger.warn(
        `Active WhatsApp provider '${providerName}' not found or not configured. Using meta as default if available.`,
      );
      providerName = 'meta';
    }

    // Check again
    if (!this.providers.has(providerName)) {
      this.logger.error(
        `No available WhatsApp provider found for key ${providerName}`,
      );
      return;
    }

    const provider = this.providers.get(providerName)!;

    for (const recipient of recipients) {
      if (!recipient.phoneNumber) {
        this.logger.warn(
          `No phone number for recipient ${recipient.id}, skipping WhatsApp.`,
        );
        continue;
      }

      // Filter based on settings
      if (
        data.type !== NotificationType.SYSTEM &&
        recipient.notificationSettings?.channels?.[
          NotificationChannelType.WHATSAPP
        ] === false
      ) {
        this.logger.debug(
          `Skipping ${NotificationChannelType.WHATSAPP} for user ${recipient.id} due to user settings.`,
        );
        continue;
      }

      let payload: WhatsappPayload;

      if (data.template) {
        payload = {
          type: 'template',
          template: {
            name: data.template,
            language: { code: 'en_US' },
            // components: data.context...
          },
        };
      } else {
        payload = {
          type: 'text',
          text: { body: data.message || '' },
        };
      }

      try {
        await provider.send(recipient.phoneNumber, payload);
        this.logger.log(
          `WhatsApp sent to ${recipient.phoneNumber} via ${providerName}`,
        );
      } catch (error: any) {
        this.logger.error(
          `Failed to send WhatsApp to ${recipient.phoneNumber}: ${error.message}`,
        );
      }
    }
  }
}
