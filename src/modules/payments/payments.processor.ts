import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PaymentsService } from './payments.service';
import { PAYMENTS_WEBHOOK_QUEUE } from '@app/common';

@Processor(PAYMENTS_WEBHOOK_QUEUE)
export class PaymentsProcessor extends WorkerHost {
  private readonly logger = new Logger(PaymentsProcessor.name);

  constructor(private readonly paymentsService: PaymentsService) {
    super();
  }
  async process(job: Job<any, any, string>): Promise<any> {
    const { provider: providerName, event } = job.data;
    this.logger.log(`Processing webhook from ${providerName}`);

    try {
      const provider = await this.paymentsService.getProvider(providerName);
      if (!provider) {
        throw new Error(`Provider ${providerName} not found`);
      }

      await provider.handleWebhookEvent(event);
    } catch (error: any) {
      this.logger.error(`Error processing payment webhook: ${error.message}`);
      throw error; // Retry job
    }

    return {};
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completed!`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job.id} failed: ${err.message}`);
  }
}
