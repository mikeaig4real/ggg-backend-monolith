import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { WALLET_MAINTENANCE_QUEUE, WALLET_JOB_NAMES } from '@app/common';
import { WalletService } from './wallet.service';
import { EscrowHold, EscrowStatus } from './entities/escrow-hold.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { subHours } from 'date-fns';

@Processor(WALLET_MAINTENANCE_QUEUE)
export class WalletMaintenanceProcessor extends WorkerHost {
  private readonly logger = new Logger(WalletMaintenanceProcessor.name);

  constructor(
    private readonly walletService: WalletService,
    @InjectRepository(EscrowHold)
    private readonly escrowHoldRepository: Repository<EscrowHold>,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    switch (job.name) {
      case WALLET_JOB_NAMES.REVERT_STALE_GAMES:
        return this.handleRevertStaleGames(job);
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
        return;
    }
  }

  private async handleRevertStaleGames(job: Job) {
    this.logger.log('Starting stale game check...');

    const cutoffDate = subHours(new Date(), 24);

    try {
      const staleEscrows = await this.escrowHoldRepository.find({
        where: {
          status: EscrowStatus.HELD,
          // createdAt: LessThan(cutoffDate),
        },
        select: ['gameId'],
      });

      if (staleEscrows.length === 0) {
        this.logger.log('No stale games found.');
        return { processed: 0 };
      }

      const uniqueGameIds = [...new Set(staleEscrows.map((e) => e.gameId))];
      this.logger.log(
        `Found ${uniqueGameIds.length} stale games to revert: ${uniqueGameIds.join(', ')}`,
      );

      let processedCount = 0;
      for (const gameId of uniqueGameIds) {
        try {
          this.logger.log(`Reverting stale game: ${gameId}`);
          await this.walletService.revertGame(gameId);
          processedCount++;
        } catch (error) {
          this.logger.error(
            `Failed to revert game ${gameId}: ${error.message}`,
            error.stack,
          );
        }
      }

      this.logger.log(
        `Stale game check complete. Reverted: ${processedCount}/${uniqueGameIds.length}`,
      );
      return { processed: processedCount, total: uniqueGameIds.length };
    } catch (error) {
      this.logger.error('Error during stale game check', error);
      throw error;
    }
  }
}
