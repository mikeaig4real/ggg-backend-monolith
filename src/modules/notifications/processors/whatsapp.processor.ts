import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { NOTIFICATION_WHATSAPP_QUEUE } from '@app/common';
import { WhatsappChannel } from '../channels/socials/whatsapp/whatsapp.channel';
import {
  NotificationData,
  NotificationRecipient,
} from '../interfaces/notification-channel.interface';

@Processor(NOTIFICATION_WHATSAPP_QUEUE)
export class WhatsappProcessor extends WorkerHost {
  private readonly logger = new Logger(WhatsappProcessor.name);

  constructor(private readonly whatsappChannel: WhatsappChannel) {
    super();
  }

  async process(
    job: Job<{ recipients: NotificationRecipient[]; data: NotificationData }>,
  ) {
    this.logger.log(`Processing WhatsApp job ${job.id}`);
    const { recipients, data } = job.data;

    try {
      await this.whatsappChannel.send(recipients, data);
      this.logger.log(`WhatsApp job ${job.id} completed`);
    } catch (error: any) {
      this.logger.error(`WhatsApp job ${job.id} failed: ${error.message}`);
      throw error;
    }
  }
}
