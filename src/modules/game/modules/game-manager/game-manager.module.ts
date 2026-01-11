import { Module } from '@nestjs/common';
import { GameManagerService } from './game-manager.service';
import { RedisModule } from '@app/common';
import { WalletModule } from '@modules/wallet/wallet.module';

import { BullModule } from '@nestjs/bullmq';
import { WALLET_OPERATIONS_QUEUE } from '@app/common';

@Module({
  imports: [
    RedisModule,
    WalletModule,
    BullModule.registerQueue({
      name: WALLET_OPERATIONS_QUEUE,
    }),
  ],
  providers: [GameManagerService],
  exports: [GameManagerService],
})
export class GameManagerModule {}
