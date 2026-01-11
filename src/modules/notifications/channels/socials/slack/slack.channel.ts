import { Injectable, Logger, Inject } from '@nestjs/common';
import {
  INotificationChannel,
  NotificationData,
  NotificationRecipient,
} from '@modules/notifications/interfaces/notification-channel.interface';
import {
  type INotificationProvider,
  SlackPayload,
} from '@modules/notifications/interfaces/notification-provider.interface';
import {
  NotificationType,
  NotificationChannelType,
} from '@modules/notifications/interfaces/notification-payload.interface';
import { ControlCenterService } from '@modules/control-center/control-center.service';
import { SlackProvider } from './providers/slack.provider';

@Injectable()
export class SlackChannel implements INotificationChannel {
  private readonly logger = new Logger(SlackChannel.name);
  private providers: Map<string, INotificationProvider<SlackPayload>> =
    new Map();

  constructor(
    private readonly controlCenter: ControlCenterService,
    private readonly slack: SlackProvider,
  ) {
    this.providers.set('slack', slack);
  }

  async send(
    recipients: NotificationRecipient[],
    data: NotificationData,
  ): Promise<void> {
    this.logger.log(
      `Hit SlackChannel.send with args: recipientsCount=${recipients.length}`,
    );

    if (recipients.length === 0) {
      return;
    }

    const eligibleRecipients = recipients.filter((r) => {
      if (data.type === NotificationType.SYSTEM) return true;
      if (
        r.notificationSettings?.channels?.[NotificationChannelType.SLACK] ===
        false
      ) {
        this.logger.debug(
          `Skipping ${NotificationChannelType.SLACK} for user ${r.id} due to user settings.`,
        );
        return false;
      }
      return true;
    });

    if (eligibleRecipients.length === 0) {
      return;
    }

    let providerName = await this.controlCenter.getActiveProvider(
      'notifications',
      'slack',
    );
    if (!providerName || !this.providers.has(providerName)) {
      providerName = 'slack';
    }

    if (!this.providers.has(providerName)) {
      this.logger.error(
        `No available Slack provider found for key ${providerName}`,
      );
      return;
    }

    const provider = this.providers.get(providerName)!;

    const payload: SlackPayload = {
      text: data.message || '',
    };

    try {
      await provider.send('', payload);
      this.logger.log(`Slack notification processed via ${providerName}`);
    } catch (error: any) {
      this.logger.error(`Failed to send Slack notification: ${error.message}`);
    }
  }
}
