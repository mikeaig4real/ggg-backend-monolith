import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WALLET_CREATION_QUEUE } from '@app/common';

@Processor(WALLET_CREATION_QUEUE, { concurrency: 1 })
export class WalletCreationProcessor
  extends WorkerHost
  implements OnModuleInit
{
  private readonly logger = new Logger(WalletCreationProcessor.name);

  constructor(private readonly walletService: WalletService) {
    super();
  }

  onModuleInit() {
    this.logger.log(
      `WalletCreationProcessor initialized for queue: ${WALLET_CREATION_QUEUE}`,
    );
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(
      `Processing job ${job.id} of type ${job.name} with data ${JSON.stringify(job.data)}...`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed: ${error.message}`, error.stack);
  }

  @OnWorkerEvent('error')
  onError(error: Error) {
    this.logger.error(`Worker error: ${error.message}`, error.stack);
  }

  async process(job: Job<{ userId: string; email: string }>) {
    this.logger.log(`Executing process method for job ${job.id}`);
    try {
      const existingWallet = await this.walletService.getWallet(
        job.data.userId,
      );
      if (existingWallet) {
        this.logger.log(
          `Wallet already exists for User ID: ${job.data.userId}`,
        );
        return;
      }
      await this.walletService.createWallet(job.data.userId);
      this.logger.log(
        `Wallet created successfully for User ID: ${job.data.userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create wallet for User ID: ${job.data.userId}. Job will be retried.`,
        error,
      );
      throw error;
    }
  }
}
