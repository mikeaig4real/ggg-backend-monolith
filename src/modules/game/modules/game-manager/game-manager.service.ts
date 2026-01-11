import { Injectable, Inject, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { WalletService } from '@modules/wallet/wallet.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  REDIS_CLIENT,
  GameStateDto,
  GAME_EVENTS,
  GAME_CHANNELS,
  WALLET_OPERATIONS_QUEUE,
  WALLET_JOB_NAMES,
} from '@app/common';
import Redis from 'ioredis';

@Injectable()
export class GameManagerService {
  private readonly logger = new Logger(GameManagerService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly walletService: WalletService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    @InjectQueue(WALLET_OPERATIONS_QUEUE)
    private readonly walletOperationsQueue: Queue,
  ) {}

  async createGame(matchPayload: any) {
    this.logger.log(
      `Hit Service: createGame args=${JSON.stringify(matchPayload)}`,
    );
    const { matchId, players, config, gameType, turn } = matchPayload;

    let currentTurnIndex = 0;
    if (turn && players) {
      const idx = players.findIndex((p: { userId: any }) => p.userId === turn);
      if (idx !== -1) currentTurnIndex = idx;
    }

    const initialState: GameStateDto = {
      matchId,
      gameType: gameType || 'dice',
      status: 'LOADING',
      players, // [{ userId, isBot }]
      round: 1,
      maxRounds: config.maxRounds || 1,
      pot: 0,
      roundHistory: [],
      metadata: { config, currentTurnIndex }, // Store config and turn index
      updatedAt: Date.now(),
      turn,
    };

    const key = `game:${matchId}`;
    await this.redis.set(key, JSON.stringify(initialState));
    this.logger.log(`Game created: ${matchId}`);

    this.logger.log(`Emitting MATCH_READY for match ${matchId}`);
    this.eventEmitter.emit(GAME_EVENTS.MATCH_READY, {
      matchId,
      gameType,
      players: players.filter((p: { isBot: any }) => !p.isBot),
    });
  }

  async getGameState(matchId: string): Promise<GameStateDto | null> {
    this.logger.log(
      `Hit Service: getGameState args=${JSON.stringify({ matchId })}`,
    );
    const data = await this.redis.get(`game:${matchId}`);
    return data ? JSON.parse(data) : null;
  }

  async updateGameState(matchId: string, newState: GameStateDto) {
    this.logger.log(
      `Hit Service: updateGameState args=${JSON.stringify({ matchId })}`,
    );
    newState.updatedAt = Date.now();
    await this.redis.set(`game:${matchId}`, JSON.stringify(newState));
  }

  async handlePlayerConnected(matchId: string, userId: string) {
    this.logger.log(
      `Hit Service: handlePlayerConnected args=${JSON.stringify({ matchId, userId })}`,
    );
    const state = await this.getGameState(matchId);
    if (!state) return;

    if (state.status === 'LOADING') {
      if (!state.metadata.connectedPlayers) {
        state.metadata.connectedPlayers = [];
      }

      if (!state.metadata.connectedPlayers.includes(userId)) {
        state.metadata.connectedPlayers.push(userId);
        this.logger.log(`Player ${userId} connected to match ${matchId}`);
      }

      const humanPlayers = state.players.filter((p) => !p.isBot);
      if (state.metadata.connectedPlayers.length >= humanPlayers.length) {
        // All humans connected.
        await this.transitionToBetting(state);
      } else {
        await this.updateGameState(matchId, state);
      }
    }
  }

  private async transitionToBetting(state: GameStateDto) {
    state.status = 'BETTING';

    state.metadata.lockedPlayers = [];
    await this.updateGameState(state.matchId, state);
    this.logger.log(
      `Game ${state.matchId} transitioning to BETTING (Round ${state.round})`,
    );

    const betAmount = state.metadata.config.betAmount;
    const treatBotAsUser =
      this.configService.get<boolean>('TREAT_BOT_AS_USER') ?? true; // Default true

    const hasBot = state.players.some((p) => p.isBot);
    const isPracticeMode = hasBot && !treatBotAsUser;

    this.logger.log(
      `[GameManager] transitionToBetting: treatBotAsUser=${treatBotAsUser}, hasBot=${hasBot}, isPracticeMode=${isPracticeMode}`,
    );

    if (isPracticeMode) {
      this.logger.log(
        '[GameManager] Practice Mode: Skipping funds lock for all players.',
      );

      state.metadata.lockedPlayers = state.players.map((p) => p.userId);

      await this.transitionToPlaying(state);
      return;
    }

    const gameTypeCap =
      (state.gameType || 'dice').charAt(0).toUpperCase() +
      (state.gameType || 'dice').slice(1);
    const source = `Game:${gameTypeCap}`;

    for (const p of state.players) {
      this.logger.log(
        `[GameManager] Processing player ${p.userId} (isBot=${p.isBot})`,
      );
      if (!p.isBot || (p.isBot && treatBotAsUser)) {
        this.logger.log(`[GameManager] Queuing lockFunds for ${p.userId}`);
        try {
          await this.walletOperationsQueue.add(WALLET_JOB_NAMES.LOCK_FUNDS, {
            userId: p.userId,
            amount: betAmount,
            gameId: state.matchId,
            source,
          });
          // NOTE: We do NOT call handleFundsLocked here anymore.
        } catch (err) {
          this.logger.error(
            `Failed to queue lock funds for ${p.userId}: ${err}`,
          );
          // Emit failure event if needed, or handle game cancellation
        }
      } else {
        try {
          await this.walletOperationsQueue.add(WALLET_JOB_NAMES.LOCK_FUNDS, {
            userId: p.userId,
            amount: betAmount,
            gameId: state.matchId,
            shouldSkipWallet: true,
            source,
          });
        } catch (err) {
          this.logger.error(
            `Failed to queue lock funds for bot ${p.userId}: ${err}`,
          );
        }
      }
    }

    await this.redis.publish(
      GAME_CHANNELS.GAME_UPDATES,
      JSON.stringify({
        matchId: state.matchId,
        event: GAME_EVENTS.STATE_UPDATE,
        state,
      }),
    );
  }

  async handleFundsLocked(matchId: string, userId: string) {
    this.logger.log(
      `Hit Service: handleFundsLocked args=${JSON.stringify({ matchId, userId })}`,
    );
    const state = await this.getGameState(matchId);
    if (!state || state.status !== 'BETTING') return;

    if (!state.metadata.lockedPlayers) {
      state.metadata.lockedPlayers = [];
    }

    if (!state.metadata.lockedPlayers.includes(userId)) {
      state.metadata.lockedPlayers.push(userId);
      this.logger.log(`Funds locked for user ${userId} in match ${matchId}`);

      // Add to pot!
      const betAmount = state.metadata.config.betAmount;
      state.pot += betAmount;
    }

    if (state.metadata.lockedPlayers.length === state.players.length) {
      await this.transitionToPlaying(state);
    } else {
      await this.updateGameState(matchId, state);
    }
  }

  private async transitionToPlaying(state: GameStateDto) {
    state.status = 'PLAYING';
    await this.updateGameState(state.matchId, state);
    this.logger.log(`Game ${state.matchId} transitioning to PLAYING`);

    await this.redis.publish(
      GAME_CHANNELS.GAME_UPDATES,
      JSON.stringify({ matchId: state.matchId, event: 'START', state }),
    );
  }

  /**
   * Called by GameEngine when a round is over.
   */
  async handleRoundEnd(
    state: GameStateDto,
    result: { winnerId?: string; metadata?: any },
  ) {
    this.logger.log(
      `Hit Service: handleRoundEnd args=${JSON.stringify({ matchId: state.matchId, result })}`,
    );
    this.logger.log(
      `Round ${state.round} ended for match ${state.matchId}. Winner: ${result.winnerId}`,
    );
    const historyEntry = {
      round: state.round,
      winnerId: result.winnerId,
      bets: state.players.map((p) => ({
        userId: p.userId,
        amount: state.metadata.config.betAmount,
      })),
      metadata: result.metadata,
    };
    state.roundHistory.push(historyEntry);

    if (state.round >= state.maxRounds) {
      await this.endGame(state, {
        winnerId: result.winnerId,
        payout: state.pot,
      });
    } else {
      state.round++;
      await this.transitionToBetting(state);
    }
  }

  async endGame(
    state: GameStateDto,
    result: { winnerId?: string; payout: number },
  ) {
    this.logger.log(
      `Hit Service: endGame args=${JSON.stringify({ matchId: state.matchId, result })}`,
    );
    this.logger.log(
      `Ending game ${state.matchId}. Winner: ${result.winnerId}, Pot: ${state.pot}`,
    );
    state.status = 'SETTLED';
    if (result.winnerId) {
      state.winner = {
        winnerId: result.winnerId,
        payout: result.payout,
        metadata: (result as any).metadata,
      };
    }
    await this.updateGameState(state.matchId, state);

    const treatBotAsUser =
      this.configService.get<boolean>('TREAT_BOT_AS_USER') ?? true;
    const hasBot = state.players.some((p) => p.isBot);
    const isPracticeMode = hasBot && !treatBotAsUser;

    if (isPracticeMode) {
      this.logger.log(
        `[GameManager] Practice Mode: Skipping funds settlement for game ${state.matchId}`,
      );
    } else {
      // Settle funds
      if (result.winnerId) {
        try {
          const gameTypeCap =
            (state.gameType || 'dice').charAt(0).toUpperCase() +
            (state.gameType || 'dice').slice(1);
          await this.walletOperationsQueue.add(WALLET_JOB_NAMES.RELEASE_FUNDS, {
            winnerUserId: result.winnerId,
            amount: state.pot,
            gameId: state.matchId,
            source: `Game:${gameTypeCap}`,
          });
        } catch (err) {
          this.logger.error(`Failed to queue settle funds: ${err}`);
        }
      } else {
        this.logger.warn(
          `Game ${state.matchId} ended with no winner (Round ${state.round}). Potential Tie.`,
        );
      }
    }

    this.redis.publish(
      GAME_CHANNELS.GAME_UPDATES,
      JSON.stringify({ matchId: state.matchId, event: 'END', state, result }),
    );
  }
}
