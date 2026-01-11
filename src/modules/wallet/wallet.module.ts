import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import {
  PostgresDatabaseModule,
  LoggerModule,
  WALLET_CREATION_QUEUE,
  WALLET_MAINTENANCE_QUEUE,
  WALLET_OPERATIONS_QUEUE,
  QueueModule,
  AuthModule,
} from '@app/common';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { UsersModule } from '@modules/users/users.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Wallet } from './entities/wallet.entity';
import { Transaction } from './entities/transaction.entity';
import { EscrowHold } from './entities/escrow-hold.entity';
import { z } from 'zod';
import { WalletCreationProcessor } from './wallet-creation.processor';
import { WalletMaintenanceProcessor } from './wallet-maintenance.processor';
import { WalletOperationsProcessor } from './wallet-operations.processor';

@Module({
  imports: [
    LoggerModule,
    AuthModule,
    ConfigModule,
    forwardRef(() => UsersModule),
    PostgresDatabaseModule,
    QueueModule.register({ name: WALLET_CREATION_QUEUE }),
    QueueModule.register({ name: WALLET_MAINTENANCE_QUEUE }),
    QueueModule.register({ name: WALLET_OPERATIONS_QUEUE }),
    BullBoardModule.forFeature(
      {
        name: WALLET_CREATION_QUEUE,
        adapter: BullMQAdapter,
      },
      {
        name: WALLET_MAINTENANCE_QUEUE,
        adapter: BullMQAdapter,
      },
      {
        name: WALLET_OPERATIONS_QUEUE,
        adapter: BullMQAdapter,
      },
    ),
    TypeOrmModule.forFeature([Wallet, Transaction, EscrowHold]),
    NotificationsModule,
  ],
  controllers: [WalletController],
  providers: [
    WalletService,
    WalletCreationProcessor,
    WalletMaintenanceProcessor,
    WalletOperationsProcessor,
  ],
  exports: [WalletService],
})
export class WalletModule {}
