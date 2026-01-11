import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { GameManagerService } from '@modules/game/modules/game-manager/game-manager.service';
import { UsersService } from '@modules/users/users.service';
import {
  validateWith,
  GameTypeSchema,
  PositiveAmountSchema,
} from '@app/common';

@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);

  constructor(
    private readonly gameManagerService: GameManagerService,
    private readonly usersService: UsersService,
  ) {}

  async createBotMatch(
    userId: string,
    gameType: string,
    betAmount: number,
  ): Promise<void> {
    this.logger.log(
      `Hit Service: createBotMatch args=${JSON.stringify({ userId, gameType, betAmount })}`,
    );
    validateWith(GameTypeSchema, gameType);
    validateWith(PositiveAmountSchema, betAmount);
    let botUser: { _id: any; username: any };
    try {
      botUser = await this.usersService.findOne({ isBot: true });
      if (!botUser) {
        throw new Error('Bot user not found in DB');
      }
    } catch (e) {
      this.logger.error(`[BotService] Failed to fetch bot user: ${e.message}`);
      botUser = { _id: 'bot_agent_v1', username: 'FallbackBot' };
    }

    let humanUser: { username: string; _id: string };
    try {
      humanUser = await this.usersService.findById(userId);
    } catch (e) {
      this.logger.error(
        `[BotService] Failed to fetch human user: ${e.message}`,
      );
      humanUser = { username: 'Player', _id: userId };
    }

    const matchId = uuidv4();
    const payload = {
      matchId,
      gameType,
      mode: 'bot',
      players: [
        { userId, isBot: false, username: humanUser.username },
        { userId: botUser._id, isBot: true, username: botUser.username },
      ],
      config: { betAmount, targetNumber: Math.floor(Math.random() * 11) + 2 },
      turn: userId,
    };

    await this.gameManagerService.createGame(payload);
  }
}
