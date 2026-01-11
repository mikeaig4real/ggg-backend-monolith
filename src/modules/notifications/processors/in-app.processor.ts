import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { NOTIFICATION_IN_APP_QUEUE } from '@app/common';
import { InAppChannel } from '../channels/in-app/in-app.channel';

@Processor(NOTIFICATION_IN_APP_QUEUE)
export class InAppProcessor extends WorkerHost {
  private readonly logger = new Logger(InAppProcessor.name);

  constructor(private readonly inAppChannel: InAppChannel) {
    super();
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(`Processing In-App job ${job.id}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`In-App job ${job.id} failed: ${error.message}`);
  }

  async process(job: Job<{ recipients: any[]; data: any }>) {
    const { recipients, data } = job.data;
    try {
      await this.inAppChannel.send(recipients, data);
      this.logger.log(`In-App job ${job.id} completed successfully`);
    } catch (error) {
      this.logger.error(`Failed to send In-App notification: ${error.message}`);
      throw error;
    }
  }
}
