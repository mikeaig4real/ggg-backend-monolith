import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { MatchQueueService } from './modules/queue/match-queue.service';
import { LobbyService } from './modules/lobby/lobby.service';
import { BotService } from './modules/bot/bot.service';
import { WalletService } from '@modules/wallet/wallet.service';
import {
  validateWith,
  GameTypeSchema,
  TierSchema,
  PositiveAmountSchema,
} from '@app/common';

@Injectable()
export class MatchmakingService {
  private readonly logger = new Logger(MatchmakingService.name);

  constructor(
    private readonly matchQueueService: MatchQueueService,
    private readonly lobbyService: LobbyService,
    private readonly botService: BotService,
    private readonly walletService: WalletService,
  ) {}

  async joinRandomQueue(
    userId: string,
    gameType: string,
    tier: string,
    betAmount: number,
  ) {
    this.logger.log(
      `Hit Service: joinRandomQueue args=${JSON.stringify({ userId, gameType, tier, betAmount })}`,
    );
    validateWith(GameTypeSchema, gameType);
    validateWith(TierSchema, tier);
    validateWith(PositiveAmountSchema, betAmount);

    const { balance } = await this.walletService.getBalance(userId);
    if (Number(balance) < betAmount) {
      throw new BadRequestException('Insufficient funds to join queue');
    }

    return this.matchQueueService.addToQueue(userId, gameType, tier, betAmount);
  }

  async createLobby(userId: string, gameType: string, betAmount: number) {
    this.logger.log(
      `Hit Service: createLobby args=${JSON.stringify({ userId, gameType, betAmount })}`,
    );
    validateWith(GameTypeSchema, gameType);
    validateWith(PositiveAmountSchema, betAmount);

    const { balance } = await this.walletService.getBalance(userId);
    if (Number(balance) < betAmount) {
      throw new BadRequestException('Insufficient funds to create lobby');
    }

    return this.lobbyService.createLobby(userId, gameType, betAmount);
  }

  async joinLobby(userId: string, code: string) {
    this.logger.log(
      `Hit Service: joinLobby args=${JSON.stringify({ userId, code })}`,
    );
    return this.lobbyService.joinLobby(userId, code);
  }

  async playWithBot(userId: string, gameType: string, betAmount: number) {
    this.logger.log(
      `Hit Service: playWithBot args=${JSON.stringify({ userId, gameType, betAmount })}`,
    );
    validateWith(GameTypeSchema, gameType);
    validateWith(PositiveAmountSchema, betAmount);

    const { balance } = await this.walletService.getBalance(userId);
    if (Number(balance) < betAmount) {
      throw new BadRequestException('Insufficient funds to play with bot');
    }

    return this.botService.createBotMatch(userId, gameType, betAmount);
  }

  async cleanupUser(userId: string) {
    this.logger.log(
      `Hit Service: cleanupUser args=${JSON.stringify({ userId })}`,
    );
    // TODO: Remove user from queues/lobbies
    // For now, relies on session/socket disconnected and subsequent timeout.
    this.logger.log(
      `[MatchmakingService] Cleaning up user ${userId} (No explicit queue removal currently)`,
    );
  }
}
