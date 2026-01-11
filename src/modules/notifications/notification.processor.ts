import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NOTIFICATION_QUEUE } from '@app/common';
import { SendNotificationDto } from './dto/send-notification.dto';

@Processor(NOTIFICATION_QUEUE)
export class NotificationProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private readonly notificationsService: NotificationsService) {
    super();
  }

  onModuleInit() {
    this.logger.log(
      `NotificationProcessor initialized for queue: ${NOTIFICATION_QUEUE}`,
    );
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(
      `Processing notification job ${job.id} with data ${JSON.stringify(job.data)}...`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Notification job ${job.id} failed: ${error.message}`,
      error.stack,
    );
  }

  @OnWorkerEvent('error')
  onError(error: Error) {
    this.logger.error(
      `Notification worker error: ${error.message}`,
      error.stack,
    );
  }

  async process(job: Job<SendNotificationDto>) {
    this.logger.log(`Executing process method for notification job ${job.id}`);
    try {
      await this.notificationsService.dispatch(job.data);
      this.logger.log(`Notification job ${job.id} processed successfully`);
    } catch (error) {
      this.logger.error(
        `Failed to process notification job ${job.id}. Job will be retried if configured.`,
        error,
      );
      throw error;
    }
  }
}
