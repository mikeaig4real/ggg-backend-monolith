import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule, validateConfig } from '@app/common';
import { LoggerModule } from '@app/common/logger';
import { GameController } from './game.controller';
import { z } from 'zod';
import { GameManagerModule } from './modules/game-manager/game-manager.module';
import { DiceModule } from './modules/games/dice/dice.module';
import { UsersModule } from '../users/users.module';
import { GameSharedModule } from '@app/common/game-shared';
import { MainGateway } from './main.gateway';

@Module({
  imports: [
    LoggerModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateConfig(
        z.object({
          REDIS_HOST: z.string(),
          REDIS_PORT: z.coerce.number(),
          TREAT_BOT_AS_USER: z
            .string()
            .optional()
            .transform((v) => v === 'true'),
        }),
      ),
      envFilePath: './.env',
    }),
    AuthModule,
    GameManagerModule,
    DiceModule,
    forwardRef(() => UsersModule),
    GameSharedModule,
  ],
  controllers: [GameController],
  providers: [MainGateway],
  exports: [MainGateway],
})
export class GameModule {}
