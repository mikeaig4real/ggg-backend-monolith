import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebClient } from '@slack/web-api';
import {
  INotificationProvider,
  NotificationContact,
  SlackPayload,
} from '@modules/notifications/interfaces/notification-provider.interface';

@Injectable()
export class SlackProvider implements INotificationProvider<SlackPayload> {
  private readonly logger = new Logger(SlackProvider.name);
  private client: WebClient;
  private defaultChannel: string;

  constructor(private readonly configService: ConfigService) {
    const token = this.configService.get<string>('SLACK_BOT_TOKEN');
    this.defaultChannel =
      this.configService.get<string>('SLACK_DEFAULT_CHANNEL') || '#general';

    if (token) {
      this.client = new WebClient(token);
    } else {
      this.logger.warn('Slack credentials not found');
    }
  }

  getName(): string {
    return 'slack';
  }

  async send(to: string, payload: SlackPayload): Promise<any> {
    // 'to' could be a channel ID or user ID. If not provided, fallback to default channel or payload.channel
    const channelId = to || payload.channel || this.defaultChannel;

    if (!this.client) {
      const error = new Error('Slack not configured');
      this.logger.error(error.message);
      throw error;
    }

    try {
      const msg: any = {
        channel: channelId,
        text: payload.text,
      };

      if (payload.blocks) {
        msg.blocks = payload.blocks;
      }

      const result = await this.client.chat.postMessage(msg);

      this.logger.log(`Slack message sent to ${channelId}: ${result.ts}`);
      return result;
    } catch (error: any) {
      this.logger.error(`Slack Error: ${error.message}`);
      throw error;
    }
  }

  async addContact(contact: NotificationContact): Promise<any> {
    this.logger.warn('addContact not implemented for Slack');
    return;
  }
}
