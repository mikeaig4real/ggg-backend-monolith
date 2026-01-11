import { Controller, Post, Body, Logger, UseGuards } from '@nestjs/common';
import {
  JoinRandomQueueDto,
  CreateLobbyDto,
  JoinLobbyDto,
  PlayBotDto,
  CurrentUser,
  type CurrentUserPayload,
} from '@app/common';
import { MatchmakingService } from './matchmaking.service';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';

@Controller('matchmaking')
@UseGuards(JwtAuthGuard)
export class MatchmakingController {
  private readonly logger = new Logger(MatchmakingController.name);
  constructor(private readonly matchmakingService: MatchmakingService) {}

  @Post('queue/join')
  async joinRandomQueue(
    @Body() data: JoinRandomQueueDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.logger.log(
      `Hit endpoint: joinRandomQueue user=${user._id} gameType=${data.gameType}`,
    );
    await this.matchmakingService.joinRandomQueue(
      user._id.toString(),
      data.gameType,
      data.tier,
      data.betAmount,
    );
    return { message: 'Joined queue' };
  }

  @Post('lobby/create')
  async createLobby(
    @Body() data: CreateLobbyDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.logger.log(`Hit endpoint: createLobby user=${user._id}`);
    return await this.matchmakingService.createLobby(
      user._id.toString(),
      data.gameType,
      data.betAmount,
    );
  }

  @Post('lobby/join')
  async joinLobby(
    @Body() data: JoinLobbyDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.logger.log(
      `Hit endpoint: joinLobby user=${user._id} code=${data.code}`,
    );
    await this.matchmakingService.joinLobby(user._id.toString(), data.code);
    return { message: 'Joined lobby' };
  }

  @Post('bot/play')
  async playWithBot(
    @Body() data: PlayBotDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.logger.log(`Hit endpoint: playWithBot user=${user._id}`);
    await this.matchmakingService.playWithBot(
      user._id.toString(),
      data.gameType,
      data.betAmount,
    );
    return { message: 'Bot match created' };
  }
}
