import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { NOTIFICATION_PUSH_QUEUE } from '@app/common';
import { PushChannel } from '../channels/push/push.channel';

@Processor(NOTIFICATION_PUSH_QUEUE)
export class PushProcessor extends WorkerHost {
  private readonly logger = new Logger(PushProcessor.name);

  constructor(private readonly pushChannel: PushChannel) {
    super();
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(`Processing Push job ${job.id}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Push job ${job.id} failed: ${error.message}`);
  }

  async process(job: Job<{ recipients: any[]; data: any }>) {
    const { recipients, data } = job.data;
    try {
      await this.pushChannel.send(recipients, data);
      this.logger.log(`Push job ${job.id} completed successfully`);
    } catch (error) {
      this.logger.error(`Failed to send push: ${error.message}`);
      throw error;
    }
  }
}
