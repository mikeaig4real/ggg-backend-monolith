import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { UsersRepository } from './users.repository';
import { InjectQueue } from '@nestjs/bullmq';
import { ACCOUNT_DELETION_QUEUE, CRON_CLEANUP_QUEUE } from '@app/common';
import { subHours } from 'date-fns';

@Processor(CRON_CLEANUP_QUEUE)
export class CronCleanupProcessor
  extends WorkerHost
  implements OnApplicationBootstrap
{
  private readonly logger = new Logger(CronCleanupProcessor.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    @InjectQueue(ACCOUNT_DELETION_QUEUE) private deletionQueue: Queue,
    @InjectQueue(CRON_CLEANUP_QUEUE) private cronQueue: Queue,
  ) {
    super();
  }

  async onApplicationBootstrap() {
    this.logger.log('[CronCleanupProcessor] Scheduling daily cleanup job...');

    await this.cronQueue.add(
      'cleanup',
      {},
      {
        jobId: 'cleanup-daily', // Enforce singleton by ID to prevent duplicates
        repeat: {
          pattern: '0 0 * * *', // Daily at midnight
        },
      },
    );
  }

  async process(job: Job<any>) {
    this.logger.log(
      '[CronCleanupProcessor] Starting cleanup of unverified users...',
    );

    try {
      const twentyFourHoursAgo = subHours(new Date(), 24);

      const unverifiedUsers = await this.usersRepository.find({
        emailVerified: false,
        createdAt: { $lt: twentyFourHoursAgo },
      });

      this.logger.log(
        `[CronCleanupProcessor] Found ${unverifiedUsers.length} unverified users to cleanup`,
      );

      for (const user of unverifiedUsers) {
        this.logger.log(
          `[CronCleanupProcessor] Scheduling deletion for user ${user._id} (${user.email})`,
        );

        // Schedule individual deletions
        await this.deletionQueue.add(
          'delete_account',
          { userId: user._id.toString() },
          {
            removeOnComplete: true,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 1000,
            },
          },
        );
      }

      this.logger.log('[CronCleanupProcessor] Cleanup job completed.');
    } catch (error) {
      this.logger.error(
        `[CronCleanupProcessor] Cleanup failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
