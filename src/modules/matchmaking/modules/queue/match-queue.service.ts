import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import Redis from 'ioredis';
import { Queue } from 'bullmq';
import {
  REDIS_CLIENT,
  MATCH_TIMEOUT_QUEUE,
  validateWith,
  GameTypeSchema,
  TierSchema,
  PositiveAmountSchema,
} from '@app/common';

@Injectable()
export class MatchQueueService {
  private readonly logger = new Logger(MatchQueueService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectQueue(MATCH_TIMEOUT_QUEUE) private readonly timeoutQueue: Queue,
  ) {}

  async addToQueue(
    userId: string,
    gameType: string,
    tier: string,
    betAmount: number,
  ): Promise<void> {
    this.logger.log(
      `Hit Service: addToQueue args=${JSON.stringify({ userId, gameType, tier, betAmount })}`,
    );
    validateWith(GameTypeSchema, gameType);
    validateWith(TierSchema, tier);
    validateWith(PositiveAmountSchema, betAmount);
    const key = `queue:${gameType}:${tier}`;
    const payload = JSON.stringify({ userId, betAmount });

    // 1. Add to Redis Queue
    await this.redis.rpush(key, payload);

    // 2. Schedule Timeout Job (60 seconds)
    await this.timeoutQueue.add(
      'timeout',
      { userId, gameType, tier, betAmount },
      { delay: 60000, removeOnComplete: true }, // 60s delay
    );

    this.logger.log(`User ${userId} added to queue ${key} with 60s timeout.`);
  }
}
