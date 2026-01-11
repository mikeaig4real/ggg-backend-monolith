import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, Inject } from '@nestjs/common';
import {
  MATCHMAKING_EVENTS,
  REDIS_CLIENT,
  API_GATEWAY,
  MATCH_TIMEOUT_QUEUE,
} from '@app/common';
import Redis from 'ioredis';
import { ClientProxy } from '@nestjs/microservices';

@Processor(MATCH_TIMEOUT_QUEUE)
export class MatchTimeoutProcessor extends WorkerHost {
  private readonly logger = new Logger(MatchTimeoutProcessor.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(API_GATEWAY) private readonly apiGatewayClient: ClientProxy,
  ) {
    super();
  }

  async process(
    job: Job<
      { userId: string; gameType: string; tier: string; betAmount: number },
      any,
      string
    >,
  ): Promise<any> {
    const { userId, gameType, tier, betAmount } = job.data;
    const queueKey = `queue:${gameType}:${tier}`;

    this.logger.log(
      `Processing timeout for user ${userId} in queue ${queueKey}`,
    );

    const payload = JSON.stringify({ userId, betAmount });
    const removedCount = await this.redis.lrem(queueKey, 1, payload);

    if (removedCount > 0) {
      this.logger.log(
        `User ${userId} timed out. Removed from ${queueKey}. Emitting MATCH_TIMEOUT.`,
      );

      this.apiGatewayClient.emit(MATCHMAKING_EVENTS.MATCH_TIMEOUT, {
        userId,
        gameType,
      });
    } else {
      this.logger.log(
        `User ${userId} no longer in queue ${queueKey} (Matched or Left). Timeout ignored.`,
      );
    }
  }
}
