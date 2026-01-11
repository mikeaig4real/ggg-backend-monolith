import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { ACCOUNT_DELETION_QUEUE, TransactionHelperService } from '@app/common';
import { WalletService } from '@modules/wallet/wallet.service';
import { FriendsService } from '@modules/friends/friends.service';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { MainGateway } from '@modules/game/main.gateway';
import { MatchmakingService } from '@modules/matchmaking/matchmaking.service';
import { ClientSession } from 'mongoose';

@Processor(ACCOUNT_DELETION_QUEUE)
export class AccountDeletionProcessor extends WorkerHost {
  private readonly logger = new Logger(AccountDeletionProcessor.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly walletService: WalletService,
    @Inject(forwardRef(() => FriendsService))
    private readonly friendsService: FriendsService,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
    @Inject(forwardRef(() => MainGateway))
    private readonly mainGateway: MainGateway,
    @Inject(forwardRef(() => MatchmakingService))
    private readonly matchmakingService: MatchmakingService,
    private readonly transactionHelper: TransactionHelperService,
  ) {
    super();
  }

  async process(job: Job<{ userId: string }>) {
    const { userId } = job.data;
    this.logger.log(
      `[AccountDeletionProcessor] Processing deletion for user: ${userId}`,
    );

    try {
      // 0. Disconnect Socket & Clean Presense
      this.logger.log(
        `[AccountDeletionProcessor] Disconnecting socket for ${userId}`,
      );
      await this.mainGateway.disconnectUser(userId);

      this.logger.log(
        `[AccountDeletionProcessor] Cleaning matchmaking for ${userId}`,
      );
      await this.matchmakingService.cleanupUser(userId);

      // 1. Delete Wallet and related data (Postgres Transaction)
      await this.walletService.deleteWallet(userId);

      // 2. Delete User Data from other services (MongoDB & User Collection)
      await this.transactionHelper.runTransaction(
        async (session: ClientSession) => {
          this.logger.log(
            `[AccountDeletionProcessor] Deleting notifications for ${userId}`,
          );
          await this.notificationsService.cleanupUser(userId, session);

          this.logger.log(
            `[AccountDeletionProcessor] Deleting friendships for ${userId}`,
          );
          await this.friendsService.cleanupUser(userId, session);

          // 3. Finally, Hard Delete or Anonymize User in Users Collection
          const result = await this.usersRepository.deleteOne(
            { _id: userId },
            { session }, // UsersRepository needs to support session passing too!
          );

          if (result) {
            this.logger.log(
              `[AccountDeletionProcessor] Successfully deleted user: ${userId}`,
            );
          } else {
            this.logger.warn(
              `[AccountDeletionProcessor] User ${userId} not found during hard delete step.`,
            );
          }
        },
      );
    } catch (error) {
      this.logger.error(
        `[AccountDeletionProcessor] Failed to delete user ${userId}: ${error.message}`,
        error.stack,
      );
      throw error; // Let BullMQ handle retries
    }
  }
}
