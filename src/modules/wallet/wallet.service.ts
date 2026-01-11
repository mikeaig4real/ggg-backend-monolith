import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Wallet } from './entities/wallet.entity';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from './entities/transaction.entity';
import { EscrowHold, EscrowStatus } from './entities/escrow-hold.entity';

import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  WALLET_MAINTENANCE_QUEUE,
  WALLET_JOB_NAMES,
  validateWith,
  PositiveAmountSchema,
} from '@app/common';
import { NotificationsService } from '@modules/notifications/notifications.service';
import {
  NotificationType,
  NotificationChannelType,
} from '@modules/notifications/interfaces/notification-payload.interface';
import {
  TransactionUpdateType,
  enrichTransactionUpdateTemplate,
} from '@modules/notifications/channels/email/templates/general/transaction-update';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(EscrowHold)
    private readonly escrowHoldRepository: Repository<EscrowHold>,
    private readonly dataSource: DataSource,
    @InjectQueue(WALLET_MAINTENANCE_QUEUE) private maintenanceQueue: Queue,
    private readonly notificationsService: NotificationsService,
  ) {}

  async onModuleInit() {
    this.logger.log('Hit Service: onModuleInit');
    // Schedule repeating job (Daily at Midnight)
    await this.maintenanceQueue.add(
      WALLET_JOB_NAMES.REVERT_STALE_GAMES,
      {},
      {
        repeat: {
          pattern: '0 0 * * *', // Daily at 00:00
        },
        jobId: 'revert-stale-games-daily', // Ensure only one cron exists
      },
    );

    // Run IMMEDIATELY on startup (One-off)
    this.logger.log('Triggering immediate stale game check on startup...');
    await this.maintenanceQueue.add(WALLET_JOB_NAMES.REVERT_STALE_GAMES, {
      trigger: 'startup',
    });
  }

  async getWallet(userId: string) {
    this.logger.log(
      `Hit Service: getWallet args=${JSON.stringify({ userId })}`,
    );
    return this.walletRepository.findOne({ where: { userId } });
  }

  async createWallet(userId: string) {
    this.logger.log(
      `Hit Service: createWallet args=${JSON.stringify({ userId })}`,
    );
    const existing = await this.walletRepository.findOne({ where: { userId } });
    if (existing) {
      this.logger.log(`[WalletService] Wallet already exists for ${userId}`);
      return existing;
    }

    const wallet = this.walletRepository.create({ userId, balance: 1000 }); // Bonus logic could go here
    const saved = await this.walletRepository.save(wallet);
    this.logger.log(
      `[WalletService] Wallet created for ${userId}. Balance: ${saved.balance}`,
    );
    return saved;
  }

  async getBalance(userId: string) {
    this.logger.log(
      `Hit Service: getBalance args=${JSON.stringify({ userId })}`,
    );
    const wallet = await this.walletRepository.findOne({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    return { balance: wallet.balance, currency: wallet.currency };
  }

  async deposit(userId: string, amount: number, source?: string) {
    this.logger.log(
      `Hit Service: deposit args=${JSON.stringify({ userId, amount })}`,
    );
    validateWith(PositiveAmountSchema, amount);

    const wallet = await this.walletRepository.findOne({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    wallet.balance = Number(wallet.balance) + amount;
    await this.walletRepository.save(wallet);

    const transaction = this.transactionRepository.create({
      wallet,
      amount,
      type: TransactionType.DEPOSIT,
      status: TransactionStatus.COMPLETED,
      referenceId: `dep_${Date.now()}`,
      source: source || 'system',
    });

    await this.transactionRepository.save(transaction);

    // Send Notification
    this.notificationsService
      .sendTransactionNotification({
        userId,
        type: TransactionUpdateType.DEPOSIT,
        amount,
        currency: wallet.currency,
        referenceId: transaction.referenceId,
        transactionId: transaction.id,
      })
      .catch((e) => {
        this.logger.error(`Failed to send deposit notification: ${e}`);
      });

    return { success: true, newBalance: wallet.balance };
  }

  async withdraw(userId: string, amount: number, source?: string) {
    this.logger.log(
      `Hit Service: withdraw args=${JSON.stringify({ userId, amount })}`,
    );
    validateWith(PositiveAmountSchema, amount);

    const wallet = await this.walletRepository.findOne({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    if (Number(wallet.balance) < amount)
      throw new BadRequestException('Insufficient funds');

    wallet.balance = Number(wallet.balance) - amount;
    await this.walletRepository.save(wallet);

    const transaction = this.transactionRepository.create({
      wallet,
      amount,
      type: TransactionType.WITHDRAW,
      status: TransactionStatus.COMPLETED,
      referenceId: `with_${Date.now()}`,
      source: source || 'system',
    });
    await this.transactionRepository.save(transaction);

    // Send Notification
    this.notificationsService
      .sendTransactionNotification({
        userId,
        type: TransactionUpdateType.WITHDRAW,
        amount,
        currency: wallet.currency,
        referenceId: transaction.referenceId,
        transactionId: transaction.id,
      })
      .catch((e) => {
        this.logger.error(`Failed to send withdraw notification: ${e}`);
      });

    return { success: true, newBalance: wallet.balance };
  }

  async lockFunds(
    userId: string,
    amount: number,
    gameId: string,
    source?: string,
  ) {
    this.logger.log(
      `Hit Service: lockFunds args=${JSON.stringify({ userId, amount, gameId })}`,
    );
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const wallet = await queryRunner.manager.findOne(Wallet, {
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!wallet) throw new NotFoundException('Wallet not found');

      const currentBalance = Number(wallet.balance);

      if (currentBalance < amount) {
        this.logger.warn(
          `[WalletService] Insufficient funds for locking. User: ${userId}, Balance: ${currentBalance}, Req: ${amount}`,
        );
        throw new BadRequestException('Insufficient funds');
      }

      wallet.balance = currentBalance - amount;
      await queryRunner.manager.save(wallet);

      const transaction = queryRunner.manager.create(Transaction, {
        wallet,
        amount,
        type: TransactionType.WAGER,
        status: TransactionStatus.COMPLETED,
        referenceId: gameId,
        source: source || 'game',
      });
      await queryRunner.manager.save(transaction);

      const hold = queryRunner.manager.create(EscrowHold, {
        wallet,
        amount,
        gameId,
        status: EscrowStatus.HELD,
        source: source || 'game',
      });
      await queryRunner.manager.save(hold);

      await queryRunner.commitTransaction();
      this.logger.log(
        `[WalletService] Funds locked successfully for user ${userId} in game ${gameId}`,
      );

      this.notificationsService
        .sendTransactionNotification({
          userId,
          type: TransactionUpdateType.LOCKED,
          amount,
          currency: wallet.currency,
          referenceId: gameId,
          escrowId: hold.id,
        })
        .catch((e) =>
          this.logger.error(`Failed to send lock notification: ${e.message}`),
        );

      return { success: true };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`[WalletService] Failed to lock funds: ${err.message}`);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async releaseFunds(
    winnerUserId: string,
    amount: number,
    gameId: string,
    source?: string,
  ) {
    this.logger.log(
      `Hit Service: releaseFunds args=${JSON.stringify({ winnerUserId, amount, gameId })}`,
    );
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const wallet = await queryRunner.manager.findOne(Wallet, {
        where: { userId: winnerUserId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!wallet) throw new NotFoundException('Wallet not found');

      wallet.balance = Number(wallet.balance) + amount;
      await queryRunner.manager.save(wallet);

      const transaction = queryRunner.manager.create(Transaction, {
        wallet,
        amount,
        type: TransactionType.PAYOUT,
        status: TransactionStatus.COMPLETED,
        referenceId: gameId,
        source: source || 'game',
      });
      await queryRunner.manager.save(transaction);

      await queryRunner.manager.update(
        EscrowHold,
        { gameId },
        { status: EscrowStatus.RELEASED },
      );

      await queryRunner.commitTransaction();
      this.logger.log(
        `[WalletService] Funds released successfully to ${winnerUserId} for game ${gameId}`,
      );

      // Send Notification
      this.notificationsService
        .sendTransactionNotification({
          userId: winnerUserId,
          type: TransactionUpdateType.RELEASED,
          amount,
          currency: wallet.currency,
          referenceId: gameId,
          transactionId: transaction.id,
        })
        .catch((e) =>
          this.logger.error(
            `Failed to send release notification: ${e.message}`,
          ),
        );

      return { success: true };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `[WalletService] Failed to release funds: ${err.message}`,
      );
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async revertGame(gameId: string) {
    this.logger.log(
      `Hit Service: revertGame args=${JSON.stringify({ gameId })}`,
    );
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const transactions = await queryRunner.manager.find(Transaction, {
        where: { referenceId: gameId, status: TransactionStatus.COMPLETED },
        relations: ['wallet'],
      });

      if (transactions.length === 0) {
        this.logger.warn(
          `[WalletService] No transactions found for game ${gameId} to revert.`,
        );
        return { success: false, message: 'No transactions found' };
      }

      const reversalTransactions: Transaction[] = [];

      for (const tx of transactions) {
        if (!tx.wallet) continue;

        const amount = Number(tx.amount);
        let newBalance = Number(tx.wallet.balance);
        let type: TransactionType;

        if (tx.type === TransactionType.WAGER) {
          newBalance += amount;
          type = TransactionType.REFUND;
        } else if (tx.type === TransactionType.PAYOUT) {
          newBalance -= amount;
          type = TransactionType.REFUND;
        } else {
          continue;
        }

        await queryRunner.manager.findOne(Wallet, {
          where: { id: tx.wallet.id },
          lock: { mode: 'pessimistic_write' },
        });

        await queryRunner.manager.update(Wallet, tx.wallet.id, {
          balance: newBalance,
        });

        const reversalTx = queryRunner.manager.create(Transaction, {
          wallet: tx.wallet,
          amount: amount,
          type: type,
          status: TransactionStatus.COMPLETED,
          referenceId: gameId,
        });
        await queryRunner.manager.save(reversalTx);
        reversalTransactions.push(reversalTx);
      }

      await queryRunner.manager.update(
        EscrowHold,
        { gameId },
        { status: EscrowStatus.REFUNDED },
      );

      await queryRunner.commitTransaction();
      this.logger.log(
        `[WalletService] Game ${gameId} transactions reverted successfully.`,
      );

      for (const reversalTx of reversalTransactions) {
        if (!reversalTx.wallet) continue;

        this.notificationsService
          .sendTransactionNotification({
            userId: reversalTx.wallet.userId,
            type: TransactionUpdateType.REFUNDED,
            amount: Number(reversalTx.amount),
            currency: reversalTx.wallet.currency,
            referenceId: gameId,
            transactionId: reversalTx.id,
          })
          .catch((e) =>
            this.logger.error(
              `Failed to send refund notification to ${reversalTx.wallet.userId}: ${e.message}`,
            ),
          );
      }

      return { success: true };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `[WalletService] Failed to revert game ${gameId}: ${err.message}`,
      );
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
  async getTransactions(userId: string) {
    this.logger.log(
      `Hit Service: getTransactions args=${JSON.stringify({ userId })}`,
    );
    // Find wallet first
    const wallet = await this.walletRepository.findOne({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    return this.transactionRepository.find({
      where: { wallet: { id: wallet.id } },
      order: { createdAt: 'DESC' },
    });
  }

  async getEscrows(userId: string) {
    this.logger.log(
      `Hit Service: getEscrows args=${JSON.stringify({ userId })}`,
    );
    // Find wallet first
    const wallet = await this.walletRepository.findOne({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    return this.escrowHoldRepository.find({
      where: { wallet: { id: wallet.id } },
      order: { createdAt: 'DESC' },
    });
  }

  async getTransactionById(id: string) {
    this.logger.log(
      `Hit Service: getTransactionById args=${JSON.stringify({ id })}`,
    );
    const transaction = await this.transactionRepository.findOne({
      where: { id },
      relations: ['wallet'],
    });
    if (!transaction) throw new NotFoundException('Transaction not found');
    return transaction;
  }

  async getEscrowById(id: string) {
    this.logger.log(
      `Hit Service: getEscrowById args=${JSON.stringify({ id })}`,
    );
    const escrow = await this.escrowHoldRepository.findOne({
      where: { id },
      relations: ['wallet'],
    });
    if (!escrow) throw new NotFoundException('Escrow not found');
    return escrow;
  }

  async deleteWallet(userId: string) {
    this.logger.log(
      `Hit Service: deleteWallet args=${JSON.stringify({ userId })}`,
    );
    const wallet = await this.walletRepository.findOne({ where: { userId } });
    if (!wallet) {
      this.logger.warn(
        `Wallet not found for user ${userId}, skipping deletion.`,
      );
      return;
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.delete(Transaction, {
        wallet: { id: wallet.id },
      });

      await queryRunner.manager.delete(EscrowHold, {
        wallet: { id: wallet.id },
      });

      await queryRunner.manager.delete(Wallet, { id: wallet.id });

      await queryRunner.commitTransaction();
      this.logger.log(`Wallet and related data deleted for user ${userId}`);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to delete wallet for user ${userId}: ${err.message}`,
      );
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
