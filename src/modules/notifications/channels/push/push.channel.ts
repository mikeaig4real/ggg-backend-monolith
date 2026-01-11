import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import {
  INotificationChannel,
  NotificationData,
  NotificationRecipient,
} from '@modules/notifications/interfaces/notification-channel.interface';
import {
  validateWith,
  PushChannelDataSchema,
  NotificationRecipientSchema,
} from '@app/common';
import { type INotificationProvider } from '@modules/notifications/interfaces/notification-provider.interface';
import {
  NotificationType,
  NotificationChannelType,
} from '@modules/notifications/interfaces/notification-payload.interface';
import { UsersService } from '@modules/users/users.service';
import { ControlCenterService } from '@modules/control-center/control-center.service';
import { FirebasePushProvider } from './providers/firebase.push.provider';
import { LoggerPushProvider } from './providers/logger.push.provider';

@Injectable()
export class PushChannel implements INotificationChannel {
  private readonly logger = new Logger(PushChannel.name);
  private providers: Map<string, INotificationProvider> = new Map();

  constructor(
    private readonly controlCenter: ControlCenterService,
    private readonly firebase: FirebasePushProvider,
    private readonly loggerProvider: LoggerPushProvider,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
  ) {
    this.providers.set('firebase', firebase);
    this.providers.set('logger', loggerProvider);
  }

  async send(
    recipients: NotificationRecipient[],
    data: NotificationData,
  ): Promise<void> {
    validateWith(PushChannelDataSchema, data);

    // Determine active provider
    let providerName = await this.controlCenter.getActiveProvider(
      'notifications',
      'push',
    );
    if (!providerName || !this.providers.has(providerName)) {
      this.logger.warn(
        `Active Push provider '${providerName}' not found. Falling back to logger.`,
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

      if (!validatedRecipient) {
        this.logger.warn(
          `PushChannel: Recipient data for ${recipient.id} is malformed. Skipping.`,
        );
        continue;
      }

      // Filter based on settings
      if (
        data.type !== NotificationType.SYSTEM &&
        validatedRecipient.notificationSettings?.channels?.[
          NotificationChannelType.PUSH
        ] === false
      ) {
        this.logger.debug(
          `Skipping ${NotificationChannelType.PUSH} for user ${validatedRecipient.id} due to user settings.`,
        );
        continue;
      }

      const tokens: { type: 'mobile' | 'web'; token: string }[] = [];

      if (validatedRecipient.mobilePushToken)
        tokens.push({
          type: 'mobile',
          token: validatedRecipient.mobilePushToken,
        });
      if (validatedRecipient.webPushToken)
        tokens.push({ type: 'web', token: validatedRecipient.webPushToken });

      // Fallback for migration
      if (
        !validatedRecipient.mobilePushToken &&
        !validatedRecipient.webPushToken &&
        validatedRecipient.pushToken
      ) {
        tokens.push({ type: 'mobile', token: validatedRecipient.pushToken });
      }

      if (tokens.length === 0) {
        this.logger.debug(
          `No push tokens for recipient ${validatedRecipient.id}`,
        );
        continue;
      }

      for (const { type, token } of tokens) {
        try {
          const result = await provider.send(token, {
            title: data.title || 'Notification', // Fallback title
            body: data.message,
            data: data.metadata as any, // Cast to match expected string record if needed, though strictly it should be sanitized
          });

          if (result && result.invalidToken) {
            this.logger.warn(
              `Invalid ${type} token for user ${validatedRecipient.id}. Removing...`,
            );
            await this.usersService.removePushToken(
              validatedRecipient.id,
              type,
            );
          }
        } catch (error) {
          this.logger.error(
            `Failed to send Push to ${validatedRecipient.id} (${type}) via ${providerName}: ${error.message}`,
          );
        }
      }
    }
  }
}
