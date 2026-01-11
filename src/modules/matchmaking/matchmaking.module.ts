import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  LoggerModule,
  validateConfig,
  CacheModule,
  AuthModule,
  RedisModule,
} from '@app/common';
import { MatchmakingController } from './matchmaking.controller';
import { MatchmakingService } from './matchmaking.service';
import { z } from 'zod';
import { MatchQueueModule } from './modules/queue/match-queue.module';
import { LobbyModule } from './modules/lobby/lobby.module';
import { BotModule } from './modules/bot/bot.module';
import { GameModule } from '@modules/game/game.module';
import { UsersModule } from '@modules/users/users.module';

@Module({
  imports: [
    LoggerModule,
    ConfigModule.forFeature(() =>
      validateConfig(
        z.object({
          REDIS_HOST: z.string(),
          REDIS_PORT: z.coerce.number(),
        }),
      ),
    ),
    CacheModule,
    AuthModule,
    RedisModule,
    MatchQueueModule,
    LobbyModule,
    BotModule,
    GameModule,
    forwardRef(() => UsersModule),
  ],
  controllers: [MatchmakingController],
  providers: [MatchmakingService],
  exports: [MatchmakingService],
})
export class MatchmakingModule {}
