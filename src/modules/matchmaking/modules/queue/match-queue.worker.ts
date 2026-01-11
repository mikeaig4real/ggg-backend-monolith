import { Injectable, OnModuleInit, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@app/common';
import { v4 as uuidv4 } from 'uuid';
import { GameManagerService } from '@modules/game/modules/game-manager/game-manager.service';
import { UsersService } from '@modules/users/users.service';

@Injectable()
export class MatchQueueWorker implements OnModuleInit {
  private readonly logger = new Logger(MatchQueueWorker.name);
  private isRunning = true;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly gameManagerService: GameManagerService,
    private readonly usersService: UsersService,
  ) {}

  async onModuleInit() {
    this.processQueues();
  }
  async processQueues() {
    const redisSubscriber = this.redis.duplicate();
    
    const queues = ['queue:dice:standard', 'queue:dice:bronze'];

    this.logger.log(
      `Starting MatchQueueWorker for queues: ${queues.join(', ')}`,
    );

    while (this.isRunning) {
      try {
        // Rotate queues to prevent starvation if one queue is busy but incomplete
        const currentQueues = [...queues];

        // Wait up to 1s for ANY player in ANY queue
        const res1 = await redisSubscriber.blpop(currentQueues, 1);
        if (!res1) {
          // No one in any queue, just loop
          continue;
        }

        const [queueKey, payload1Str] = res1;
        let payload2Str = await this.redis.lpop(queueKey);

        if (!payload2Str) {
          // Wait for opponent in SPECIFIC queue for 2 seconds
          this.logger.log(`Waiting for opponent in ${queueKey}...`);
          const res2 = await redisSubscriber.blpop(queueKey, 2);
          if (res2) {
            payload2Str = res2[1];
          } else {
            // Timeout: No match found. Put P1 back to head of queue.
            this.logger.log(
              `Timeout waiting in ${queueKey}. Re-queuing player.`,
            );
            await this.redis.lpush(queueKey, payload1Str);

            // Move this queue to end of list for next iteration (Round Robin)
            const idx = queues.indexOf(queueKey);
            if (idx > -1) {
              queues.push(queues.splice(idx, 1)[0]);
            }
            continue;
          }
        }

        const player1 = JSON.parse(payload1Str);
        const player2 = JSON.parse(payload2Str);

        await this.createMatch(player1, player2, queueKey);
      } catch (error) {
        this.logger.error('Error in MatchQueueWorker loop', error);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  async createMatch(p1: any, p2: any, queueKey: string) {
    const matchId = uuidv4();
    const [_, gameType, tier] = queueKey.split(':');

    // Fetch user details for usernames
    const [user1, user2] = await Promise.all([
      this.usersService.findById(p1.userId).catch(() => null),
      this.usersService.findById(p2.userId).catch(() => null),
    ]);

    // Random turn
    const turn = Math.random() > 0.5 ? p1.userId : p2.userId;

    const payload = {
      matchId,
      gameType,
      mode: 'random',
      players: [
        {
          userId: p1.userId,
          isBot: false,
          username: user1?.username || 'Unknown',
        },
        {
          userId: p2.userId,
          isBot: false,
          username: user2?.username || 'Unknown',
        },
      ],
      config: {
        betAmount: p1.betAmount,
        targetNumber:
          gameType === 'dice' ? Math.floor(Math.random() * 11) + 2 : undefined,
      },
      turn,
    };

    this.logger.log(`Match found ${matchId} for ${gameType}`);
    await this.gameManagerService.createGame(payload);
  }
}
