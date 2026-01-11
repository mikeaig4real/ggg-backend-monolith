import { Injectable, Logger } from '@nestjs/common';
import {
  INotificationChannel,
  NotificationData,
  NotificationRecipient,
} from '@modules/notifications/interfaces/notification-channel.interface';
import {
  validateWith,
  SmsChannelDataSchema,
  NotificationRecipientSchema,
} from '@app/common';
import { type INotificationProvider } from '@modules/notifications/interfaces/notification-provider.interface';
import {
  NotificationType,
  NotificationChannelType,
} from '@modules/notifications/interfaces/notification-payload.interface';
import { ControlCenterService } from '@modules/control-center/control-center.service';
import { ClickSendSmsProvider } from './providers/clicksend.provider';
import { VonageSmsProvider } from './providers/vonage.provider';
import { TwilioSmsProvider } from './providers/twilio.provider';
import { TermiiSmsProvider } from './providers/termii.provider';
import { AfricasTalkingSmsProvider } from './providers/africastalking.provider';
import { LoggerSmsProvider } from './providers/logger.sms.provider';

@Injectable()
export class SmsChannel implements INotificationChannel {
  private readonly logger = new Logger(SmsChannel.name);
  private providers: Map<string, INotificationProvider> = new Map();

  constructor(
    private readonly controlCenter: ControlCenterService,
    private readonly clicksend: ClickSendSmsProvider,
    private readonly vonage: VonageSmsProvider,
    private readonly twilio: TwilioSmsProvider,
    private readonly termii: TermiiSmsProvider,
    private readonly africasTalking: AfricasTalkingSmsProvider,
    private readonly loggerProvider: LoggerSmsProvider,
  ) {
    this.providers.set('clicksend', clicksend);
    this.providers.set('vonage', vonage);
    this.providers.set('twilio', twilio);
    this.providers.set('termii', termii);
    this.providers.set('africastalking', africasTalking);
    this.providers.set('logger', loggerProvider);
  }

  async send(
    recipients: NotificationRecipient[],
    data: NotificationData,
  ): Promise<void> {
    validateWith(SmsChannelDataSchema, data);

    // Determine active provider
    let providerName = await this.controlCenter.getActiveProvider(
      'notifications',
      'sms',
    );
    if (!providerName || !this.providers.has(providerName)) {
      this.logger.warn(
        `Active SMS provider '${providerName}' not found. Falling back to logger.`,
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

      if (!validatedRecipient || !validatedRecipient.phoneNumber) {
        this.logger.warn(
          `SmsChannel: Recipient ${recipient.id} does not have a valid phone number. Skipping.`,
        );
        continue;
      }

      // Filter based on settings
      if (
        data.type !== NotificationType.SYSTEM &&
        validatedRecipient.notificationSettings?.channels?.[
          NotificationChannelType.SMS
        ] === false
      ) {
        this.logger.debug(
          `Skipping ${NotificationChannelType.SMS} for user ${validatedRecipient.id} due to user settings.`,
        );
        continue;
      }
      try {
        await provider.send(validatedRecipient.phoneNumber, {
          text: data.message,
        });
      } catch (error) {
        this.logger.error(
          `Failed to send SMS to ${validatedRecipient.phoneNumber} via ${providerName}: ${error.message}`,
        );
      }
    }
  }
}
