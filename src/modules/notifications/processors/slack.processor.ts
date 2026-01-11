import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { NOTIFICATION_SLACK_QUEUE } from '@app/common';
import { SlackChannel } from '../channels/socials/slack/slack.channel';
import {
  NotificationData,
  NotificationRecipient,
} from '../interfaces/notification-channel.interface';

@Processor(NOTIFICATION_SLACK_QUEUE)
export class SlackProcessor extends WorkerHost {
  private readonly logger = new Logger(SlackProcessor.name);

  constructor(private readonly slackChannel: SlackChannel) {
    super();
  }

  async process(
    job: Job<{ recipients: NotificationRecipient[]; data: NotificationData }>,
  ) {
    this.logger.log(`Processing Slack job ${job.id}`);
    const { recipients, data } = job.data;

    try {
      await this.slackChannel.send(recipients, data);
      this.logger.log(`Slack job ${job.id} completed`);
    } catch (error: any) {
      this.logger.error(`Slack job ${job.id} failed: ${error.message}`);
      throw error;
    }
  }
}
