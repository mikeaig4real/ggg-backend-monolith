import { Module, forwardRef } from '@nestjs/common';
import { MatchQueueService } from './match-queue.service';
import { MatchQueueWorker } from './match-queue.worker';
import { GameManagerModule } from '@modules/game/modules/game-manager/game-manager.module';
import { UsersModule } from '@modules/users/users.module';
import { RedisModule, MATCH_TIMEOUT_QUEUE } from '@app/common';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';

@Module({
  imports: [
    RedisModule,
    GameManagerModule,
    forwardRef(() => UsersModule),
    BullModule.registerQueue({
      name: MATCH_TIMEOUT_QUEUE,
    }),
    BullBoardModule.forFeature({
      name: MATCH_TIMEOUT_QUEUE,
      adapter: BullMQAdapter,
    }),
  ],
  providers: [MatchQueueService, MatchQueueWorker],
  exports: [MatchQueueService],
})
export class MatchQueueModule {}
