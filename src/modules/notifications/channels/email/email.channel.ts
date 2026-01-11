import { Injectable, Logger } from '@nestjs/common';
import {
  INotificationChannel,
  NotificationData,
  NotificationRecipient,
} from '@modules/notifications/interfaces/notification-channel.interface';
import {
  validateWith,
  EmailChannelDataSchema,
  NotificationRecipientSchema,
} from '@app/common';
import { type INotificationProvider } from '@modules/notifications/interfaces/notification-provider.interface';
import {
  NotificationType,
  NotificationChannelType,
} from '@modules/notifications/interfaces/notification-payload.interface';
import { ControlCenterService } from '@modules/control-center/control-center.service';
import { SendGridProvider } from './providers/sendgrid.provider';
import { MailgunProvider } from './providers/mailgun.provider';
import { ResendProvider } from './providers/resend.provider';
import { MailchimpProvider } from './providers/mailchimp.provider';
import { LoggerEmailProvider } from './providers/logger.email.provider';

@Injectable()
export class EmailChannel implements INotificationChannel {
  private readonly logger = new Logger(EmailChannel.name);
  private providers: Map<string, INotificationProvider> = new Map();

  constructor(
    private readonly controlCenter: ControlCenterService,
    private readonly sendgrid: SendGridProvider,
    private readonly mailgun: MailgunProvider,
    private readonly resend: ResendProvider,
    private readonly mailchimp: MailchimpProvider,
    private readonly loggerProvider: LoggerEmailProvider,
  ) {
    this.providers.set('sendgrid', sendgrid);
    this.providers.set('mailgun', mailgun);
    this.providers.set('resend', resend);
    this.providers.set('mailchimp', mailchimp);
    this.providers.set('logger', loggerProvider);
  }

  async send(
    recipients: NotificationRecipient[],
    data: NotificationData,
  ): Promise<void> {
    validateWith(EmailChannelDataSchema, data);

    // Determine active provider
    let providerName = await this.controlCenter.getActiveProvider(
      'notifications',
      'email',
    );
    if (!providerName || !this.providers.has(providerName)) {
      this.logger.warn(
        `Active email provider '${providerName}' not found. Falling back to logger.`,
      );
      providerName = 'logger';
    }
    const provider = this.providers.get(providerName)!;

    for (const recipient of recipients) {
      const validatedRecipient = validateWith(
        NotificationRecipientSchema,
        recipient,
        { quiet: true },
      );

      if (!validatedRecipient || !validatedRecipient.email) {
        this.logger.warn(
          `EmailChannel: Recipient ${recipient.id} has no valid email or is malformed. Skipping.`,
        );
        continue;
      }

      // Filter based on settings
      if (
        data.type !== NotificationType.SYSTEM &&
        validatedRecipient.notificationSettings?.channels?.[
          NotificationChannelType.EMAIL
        ] === false
      ) {
        this.logger.debug(
          `Skipping ${NotificationChannelType.EMAIL} for user ${validatedRecipient.id} due to user settings.`,
        );
        continue;
      }

      try {
        await provider.send(validatedRecipient.email, {
          subject: data.title,
          text: data.message,
          html:
            data.html ||
            `<html><body><h1>${data.title}</h1><p>${data.message}</p></body></html>`,
        });
      } catch (error) {
        this.logger.error(
          `Failed to send email to ${validatedRecipient.email} via ${providerName}`,
          error,
        );
      }
    }
  }
}
