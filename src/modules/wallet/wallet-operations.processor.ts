import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WalletService } from './wallet.service';
import {
  WALLET_OPERATIONS_QUEUE,
  WALLET_JOB_NAMES,
  WALLET_EVENTS,
  DepositJobPayload,
  WithdrawJobPayload,
  LockFundsJobPayload,
  ReleaseFundsJobPayload,
  RevertGameJobPayload,
  WalletJobData,
} from '@app/common';

@Processor(WALLET_OPERATIONS_QUEUE)
export class WalletOperationsProcessor extends WorkerHost {
  private readonly logger = new Logger(WalletOperationsProcessor.name);

  constructor(
    private readonly walletService: WalletService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super();
  }

  async process(job: Job<WalletJobData, any, string>): Promise<void> {
    this.logger.log(`Processing wallet operation job ${job.name}`);

    try {
      switch (job.name) {
        case WALLET_JOB_NAMES.DEPOSIT:
          await this.handleDeposit(job.data as DepositJobPayload);
          break;
        case WALLET_JOB_NAMES.WITHDRAW:
          await this.handleWithdraw(job.data as WithdrawJobPayload);
          break;
        case WALLET_JOB_NAMES.LOCK_FUNDS:
          await this.handleLockFunds(job.data as LockFundsJobPayload);
          break;
        case WALLET_JOB_NAMES.RELEASE_FUNDS:
          await this.handleReleaseFunds(job.data as ReleaseFundsJobPayload);
          break;
        case WALLET_JOB_NAMES.REVERT_GAME:
          await this.handleRevertGame(job.data as RevertGameJobPayload);
          break;
        default:
          this.logger.warn(`Unknown job name: ${job.name}`);
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to process job ${job.name}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async handleDeposit(data: {
    userId: string;
    amount: number;
    source?: string;
  }) {
    const { userId, amount, source } = data;
    await this.walletService.deposit(userId, amount, source);
    this.logger.log(
      `Processed deposit for user ${userId} amount ${amount} source ${source}`,
    );
  }

  private async handleWithdraw(data: { userId: string; amount: number }) {
    const { userId, amount } = data;
    await this.walletService.withdraw(userId, amount);
    this.logger.log(`Processed withdrawal for user ${userId} amount ${amount}`);
  }

  private async handleLockFunds(data: {
    userId: string;
    amount: number;
    gameId: string;
    shouldSkipWallet?: boolean;
    source?: string;
  }) {
    const { userId, amount, gameId, shouldSkipWallet, source } = data;

    if (shouldSkipWallet) {
      this.logger.log(`Skipping wallet lock for cleanup/bot user ${userId}`);
    } else {
      await this.walletService.lockFunds(userId, amount, gameId, source);
    }

    this.logger.log(
      `Processed lock funds for user ${userId} amount ${amount} game ${gameId}`,
    );

    // Emit event for Game Controller/Manager
    this.eventEmitter.emit(WALLET_EVENTS.FUNDS_LOCKED, {
      matchId: gameId,
      userId,
    });
  }

  private async handleReleaseFunds(data: {
    winnerUserId: string;
    amount: number;
    gameId: string;
    source?: string;
  }) {
    const { winnerUserId, amount, gameId, source } = data;
    await this.walletService.releaseFunds(winnerUserId, amount, gameId, source);
    this.logger.log(
      `Processed release funds for user ${winnerUserId} amount ${amount} game ${gameId}`,
    );
  }

  private async handleRevertGame(data: { gameId: string }) {
    const { gameId } = data;
    await this.walletService.revertGame(gameId);
    this.logger.log(`Processed revert game for game ${gameId}`);
  }
}
