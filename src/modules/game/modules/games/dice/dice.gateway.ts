import {
  SubscribeMessage,
  WebSocketGateway,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { UsePipes, ValidationPipe } from '@nestjs/common';
import { RollDiceDto, JoinRoomDto } from '@app/common/dto';
import { Socket } from 'socket.io';
import { BaseGameGateway } from '@modules/game/base.gateway';
import { UseGuards, Inject } from '@nestjs/common';
import { WsAuthGuard } from '@guards/ws-auth.guard';
import { REDIS_CLIENT } from '@app/common';
import { GameManagerService } from '../../game-manager/game-manager.service';
import { DiceEngine } from './dice.engine';
import { PresenceService } from '@app/common/redis';
import { UsersService } from '@modules/users/users.service';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@WebSocketGateway({ namespace: 'dice', cors: { origin: '*' } })
@UseGuards(WsAuthGuard)
export class DiceGateway extends BaseGameGateway {
  private engine = new DiceEngine();

  constructor(
    protected readonly presenceService: PresenceService,
    protected readonly usersService: UsersService,
    private readonly gameManager: GameManagerService,
    protected readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) protected readonly redis: Redis,
  ) {
    super(presenceService, usersService, configService, redis);
  }

  @SubscribeMessage('roll_dice')
  async handleRoll(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: RollDiceDto,
  ) {
    this.logger.log(`[DiceGateway] Dice Roll Request: ${JSON.stringify(data)}`);
    const user = (client as any).user;
    const { matchId } = data;

    let state = await this.gameManager.getGameState(matchId);
    if (!state) {
      this.logger.log(`[DiceGateway] Game Not Found: ${matchId}`);
      client.emit('error', { message: 'Game not found' });
      return;
    }

    if (state.status !== 'PLAYING') {
      this.logger.log(`[DiceGateway] Game Not Active: ${matchId}`);
      client.emit('error', { message: 'Game not active' });
      return;
    }

    try {
      this.logger.log(
        `[DiceGateway] Validating Turn: ${JSON.stringify(state)}`,
      );
      if (state.turn !== user._id.toString()) {
        this.logger.log(`[DiceGateway] Not Your Turn: ${matchId}`);
        throw new Error('Not your turn');
      }

      this.logger.log(`[DiceGateway] Notifying Roll: ${JSON.stringify(state)}`);
      this.server.to(matchId).emit('player_rolling', { userId: user._id });

      this.logger.log(
        `[DiceGateway] Artificial Delay: ${JSON.stringify(state)}`,
      );
      await new Promise((resolve) => setTimeout(resolve, 2000));

      this.logger.log(
        `[DiceGateway] Processsing Roll: ${JSON.stringify(state)}`,
      );
      state = this.engine.processMove(state, {
        userId: user._id,
        action: 'roll',
      });
      this.logger.log(`[DiceGateway] Processed Roll: ${JSON.stringify(state)}`);

      const winner = this.engine.checkWinner(state);
      this.logger.log(`[DiceGateway] Game Winner: ${JSON.stringify(winner)}`);

      if (winner) {
        this.logger.log(`[DiceGateway] Game Ended: ${JSON.stringify(winner)}`);

        await this.gameManager.updateGameState(matchId, state);
        this.server.to(matchId).emit('game_update', state);

        await new Promise((resolve) => setTimeout(resolve, 2500));

        await this.gameManager.endGame(state, winner);

        this.server.to(matchId).emit('game_ended', { winner, state });
      } else {
        this.logger.log(`[DiceGateway] Game Updated: ${JSON.stringify(state)}`);

        await this.gameManager.updateGameState(matchId, state);

        this.server.to(matchId).emit('game_update', state);

        // Check for Tie / Round End (All players rolled but no winner)
        if (Object.keys(state.metadata.dice).length === state.players.length) {
          this.logger.log('[DiceGateway] Round Ended (Tie). Resetting...');

          await new Promise((resolve) => setTimeout(resolve, 3000));

          state = this.engine.resetRound(state);
          await this.gameManager.updateGameState(matchId, state);
          this.server.to(matchId).emit('game_update', state);
          this.logger.log('[DiceGateway] Round Reset Complete.');
        }
      }

      this.logger.log(
        `[DiceGateway] Checking Bot Turn: ${JSON.stringify(state)}`,
      );
      this.checkBotTurn(state);
    } catch (e: any) {
      this.logger.error(`[DiceGateway] Dice Roll Error: ${e}`);
      client.emit('error', { message: e.message });
    }
  }

  @SubscribeMessage('join_room')
  override async handleJoinRoom(client: Socket, payload: JoinRoomDto) {
    super.handleJoinRoom(client, payload);
    const user = (client as any).user;
    await this.gameManager.handlePlayerConnected(payload.roomId, user._id);
  }

  private async checkBotTurn(state: any) {
    this.logger.log(
      `[DiceGateway] checkBotTurn called for state: ${JSON.stringify(state)}`,
    );
    const players = state.players;
    const turnIndex = state.metadata.currentTurnIndex;
    const currentPlayer = players[turnIndex];

    if (currentPlayer.isBot && state.status === 'PLAYING') {
      this.logger.log(`[DiceGateway] Bot ${currentPlayer.userId} is acting...`);

      this.server
        .to(state.matchId)
        .emit('player_rolling', { userId: currentPlayer.userId });
      this.logger.log(`[DiceGateway] Bot rolling event emitted.`);

      setTimeout(async () => {
        // Re-fetch state in case of race
        let refetchedState = await this.gameManager.getGameState(state.matchId);
        if (!refetchedState || refetchedState.status !== 'PLAYING') {
          this.logger.log(
            '[DiceGateway] Bot turn aborted: Game not playing or state missing',
          );
          return;
        }

        try {
          this.logger.log(
            `[DiceGateway] Processing Bot Move for ${currentPlayer.userId}`,
          );
          refetchedState = this.engine.processMove(refetchedState, {
            userId: currentPlayer.userId,
            action: 'roll',
          });
          this.logger.log(
            `[DiceGateway] Bot Move Processed. New State: ${JSON.stringify(refetchedState)}`,
          );

          const winner = this.engine.checkWinner(refetchedState);
          this.logger.log(
            `[DiceGateway] Bot Roll Winner Check: ${JSON.stringify(winner)}`,
          );

          if (winner) {
            await this.gameManager.updateGameState(
              state.matchId,
              refetchedState,
            );
            this.server.to(state.matchId).emit('game_update', refetchedState);

            await new Promise((resolve) => setTimeout(resolve, 2500));

            await this.gameManager.endGame(refetchedState, winner);
            this.server
              .to(state.matchId)
              .emit('game_ended', { winner, state: refetchedState });
            this.logger.log('[DiceGateway] Bot caused Game End');
          } else {
            await this.gameManager.updateGameState(
              state.matchId,
              refetchedState,
            );
            this.server.to(state.matchId).emit('game_update', refetchedState);
            this.logger.log('[DiceGateway] Bot Turn Complete. Game Updated.');

            // Check for Tie / Round End
            if (
              Object.keys(refetchedState.metadata.dice).length ===
              refetchedState.players.length
            ) {
              this.logger.log(
                '[DiceGateway] Bot - Round Ended (Tie). Resetting...',
              );

              await new Promise((resolve) => setTimeout(resolve, 3000));

              refetchedState = this.engine.resetRound(refetchedState);
              await this.gameManager.updateGameState(
                state.matchId,
                refetchedState,
              );
              this.server.to(state.matchId).emit('game_update', refetchedState);
            }

            this.checkBotTurn(refetchedState);
          }
        } catch (e) {
          this.logger.error(`[DiceGateway] Bot Error: ${e}`);
        }
      }, 3000); // 3 seconds delay for bot (visuals)
    } else {
      this.logger.log(
        `[DiceGateway] Not a bot turn or game not playing. (Player: ${JSON.stringify(currentPlayer)})`,
      );
    }
  }
}
