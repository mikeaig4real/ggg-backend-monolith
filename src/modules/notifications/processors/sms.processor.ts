import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { NOTIFICATION_SMS_QUEUE } from '@app/common';
import { SmsChannel } from '../channels/sms/sms.channel';

@Processor(NOTIFICATION_SMS_QUEUE)
export class SmsProcessor extends WorkerHost {
  private readonly logger = new Logger(SmsProcessor.name);

  constructor(private readonly smsChannel: SmsChannel) {
    super();
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(`Processing SMS job ${job.id}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`SMS job ${job.id} failed: ${error.message}`);
  }

  async process(job: Job<{ recipients: any[]; data: any }>) {
    const { recipients, data } = job.data;
    try {
      await this.smsChannel.send(recipients, data);
      this.logger.log(`SMS job ${job.id} completed successfully`);
    } catch (error) {
      this.logger.error(`Failed to send SMS: ${error.message}`);
      throw error;
    }
  }
}
