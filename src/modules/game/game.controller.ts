import {
  Controller,
  Logger,
  Get,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  GAME_EVENTS,
  WALLET_EVENTS,
  MATCHMAKING_EVENTS,
  CurrentUser,
  type CurrentUserPayload,
} from '@app/common';
import { GameManagerService } from './modules/game-manager/game-manager.service';
import { JwtAuthGuard } from '@guards/jwt-auth.guard';

@Controller('game')
export class GameController {
  private readonly logger = new Logger(GameController.name);
  constructor(private readonly gameManagerService: GameManagerService) {}

  @OnEvent(MATCHMAKING_EVENTS.MATCH_FOUND)
  async handleMatchFound(data: any) {
    this.logger.log(
      `[Game Controller] match.found received: ${JSON.stringify(data)}`,
    );
    // No ack needed for Event Emitter
    await this.gameManagerService.createGame(data);
  }

  @OnEvent(WALLET_EVENTS.FUNDS_LOCKED)
  async handleFundsLocked(data: { matchId: string; userId: string }) {
    this.logger.log(
      `[Game Controller] funds.locked received: ${JSON.stringify(data)}`,
    );
    await this.gameManagerService.handleFundsLocked(data.matchId, data.userId);
  }

  @Get('health')
  async healthCheck() {
    this.logger.log('Hit endpoint: GameController.healthCheck');
    return { status: 'ok', service: 'game-service-monolith' };
  }

  @Get(':matchId/state')
  @UseGuards(JwtAuthGuard)
  async getGameState(
    @Param('matchId') matchId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.logger.log(
      `Hit endpoint: getGameState user=${user._id} matchId=${matchId}`,
    );
    return this.gameManagerService.getGameState(matchId);
  }
}
