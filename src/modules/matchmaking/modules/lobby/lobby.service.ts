import {
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
  Injectable,
} from '@nestjs/common';
import Redis from 'ioredis';
import {
  REDIS_CLIENT,
  validateWith,
  LobbyCodeSchema,
  GameTypeSchema,
  PositiveAmountSchema,
} from '@app/common';
import { PresenceService } from '@app/common/redis';
import { v4 as uuidv4 } from 'uuid';
import { GameManagerService } from '@modules/game/modules/game-manager/game-manager.service';
import { UsersService } from '@modules/users/users.service';
import { WalletService } from '@modules/wallet/wallet.service';

@Injectable()
export class LobbyService {
  private readonly logger = new Logger(LobbyService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly gameManagerService: GameManagerService,
    private readonly usersService: UsersService,
    private readonly presenceService: PresenceService,
    private readonly walletService: WalletService,
  ) {}

  async createLobby(
    userId: string,
    gameType: string,
    betAmount: number,
  ): Promise<{ code: string }> {
    this.logger.log(
      `Hit Service: createLobby args=${JSON.stringify({ userId, gameType, betAmount })}`,
    );
    validateWith(GameTypeSchema, gameType);
    validateWith(PositiveAmountSchema, betAmount);
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    const key = `lobby:${code}`;

    // Store lobby info with TTL 10m
    const lobbyData = {
      hostId: userId,
      gameType,
      betAmount,
      players: [userId],
    };

    await this.redis.set(key, JSON.stringify(lobbyData), 'EX', 600);
    return { code };
  }

  async joinLobby(userId: string, code: string): Promise<void> {
    this.logger.log(
      `Hit Service: joinLobby args=${JSON.stringify({ userId, code })}`,
    );
    validateWith(LobbyCodeSchema, code);
    const key = `lobby:${code}`;
    const dataStr = await this.redis.get(key);

    if (!dataStr) {
      throw new NotFoundException('Lobby not found or expired');
    }

    const lobbyData = JSON.parse(dataStr);

    // Check Balance for joining user
    const { balance } = await this.walletService.getBalance(userId);
    if (Number(balance) < lobbyData.betAmount) {
      throw new BadRequestException('Insufficient funds to join lobby');
    }

    // Host Online Check
    const isHostOnline = await this.presenceService.isOnline(lobbyData.hostId);
    if (!isHostOnline) {
      this.logger.warn(
        `[LobbyService] Host ${lobbyData.hostId} appears offline when User ${userId} tried to join lobby ${code}.`,
      );
      // Continue or throw? User asked for a log.
      return;
    }

    if (lobbyData.players.includes(userId)) {
      // Already joined? Just return or throw.
      return;
    }

    if (lobbyData.players.length >= 2) {
      throw new BadRequestException('Lobby is full');
    }

    lobbyData.players.push(userId);

    await this.redis.set(key, JSON.stringify(lobbyData), 'EX', 600);

    if (lobbyData.players.length === 2) {
      const matchId = uuidv4();

      // Fetch Usernames
      const [hostUser, joiningUser] = await Promise.all([
        this.usersService
          .findById(lobbyData.hostId)
          .catch(() => ({ username: 'Host' })),
        this.usersService
          .findById(userId)
          .catch(() => ({ username: 'Player 2' })),
      ]);

      const payload = {
        matchId,
        gameType: lobbyData.gameType,
        mode: 'friend',
        players: [
          {
            userId: lobbyData.hostId,
            isBot: false,
            username: hostUser.username,
          },
          { userId: userId, isBot: false, username: joiningUser.username },
        ],
        config: { betAmount: lobbyData.betAmount },
      };

      await this.gameManagerService.createGame(payload);
      // Clean up lobby?
      await this.redis.del(key);
    }
  }
}
