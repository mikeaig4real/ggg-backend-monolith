import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { UseGuards, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ClientProxy } from '@nestjs/microservices';
import { PresenceService, REDIS_CLIENT } from '../../redis';
import { getAuthTokenFromWebsocketHeaderHelper } from '../../helpers';
import {
  USER_SERVICE,
  USER_EVENTS,
  GAME_EVENTS,
  GAME_CHANNELS,
} from '../../constants';
import { catchError, map, of, tap, firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@UseGuards()
export abstract class BaseGameGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  @WebSocketServer()
  server: Server;

  protected logger = new Logger(BaseGameGateway.name);
  protected subClient: Redis;

  constructor(
    protected readonly presenceService: PresenceService,
    @Inject(USER_SERVICE) protected readonly authClient: ClientProxy,
    protected readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) protected readonly redis: Redis,
  ) {}

  async onModuleInit() {
    this.subClient = this.redis.duplicate();
    await this.subClient.subscribe(GAME_CHANNELS.GAME_UPDATES);

    this.subClient.on('message', (channel, message) =>
      this.handleRedisMessage(channel, message),
    );
    this.logger.log('Subscribed to game:updates channel');
  }

  protected handleRedisMessage(channel: string, message: string) {
    if (channel === GAME_CHANNELS.GAME_UPDATES) {
      try {
        const payload = JSON.parse(message);
        const { matchId, event, state, result } = payload;

        if (!matchId || !event) return;

        switch (event) {
          case 'END':
            this.server
              .to(matchId)
              .emit('game_ended', { winner: result?.winnerId, state });
            break;
          case 'START':
          case GAME_EVENTS.STATE_UPDATE:
          default:
            this.server.to(matchId).emit('game_update', state);
            break;
        }
      } catch (e) {
        this.logger.error(`Failed to process Redis game update: ${e}`);
      }
    }
  }

  async handleConnection(client: Socket) {
    this.logger.log(`[BaseGameGateway] New connection attempt: ${client.id}`);
    try {
      const jwt = getAuthTokenFromWebsocketHeaderHelper(client);
      if (!jwt) {
        this.logger.warn(
          `[BaseGameGateway] Connection ${client.id} rejected: No JWT found`,
        );
        client.disconnect();
        return;
      }

      this.logger.debug(`[BaseGameGateway] Verifying JWT for ${client.id}...`);

      const user = await firstValueFrom(
        this.authClient
          .send(USER_EVENTS.AUTHENTICATE, {
            jwt,
            role: 'user',
          })
          .pipe(
            catchError((err) => {
              this.logger.error(
                `[BaseGameGateway] Authentication failed for ${client.id}: ${err}`,
              );
              return of(null);
            }),
          ),
      );

      if (!user) {
        this.logger.warn(
          `[BaseGameGateway] Connection ${client.id} rejected: Invalid JWT`,
        );
        client.emit('error', { message: 'Invalid JWT' });
        client.disconnect();
        return;
      }

      (client as any).user = user;

      const serverId = this.configService.get('SERVER_ID');
      const finalServerId = serverId || 'default-server';
      await this.presenceService.setOnline(user._id, finalServerId);
      this.logger.log(
        `[BaseGameGateway] User ${user._id} connected to ${JSON.stringify(finalServerId)} (Socket: ${client.id})`,
      );
    } catch (e) {
      this.logger.error(
        `[BaseGameGateway] Error in handleConnection for ${client.id}: ${e}`,
      );
      client.emit('error', { message: 'Internal server error' });
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`[BaseGameGateway] Disconnect: ${client.id}`);
    const user = (client as any).user;
    if (user) {
      await this.presenceService.setOffline(user._id);
      this.logger.log(`[BaseGameGateway] User ${user._id} marked offline`);
    }
  }

  @SubscribeMessage('identify')
  handleIdentify(client: Socket) {
    const user = (client as any).user;
    if (user) {
      this.logger.log(
        `[BaseGameGateway] Client ${client.id} identified as User ${user._id}`,
      );
      return { status: 'ok', userId: user._id };
    } else {
      this.logger.warn(
        `[BaseGameGateway] Client ${client.id} sent IDENTIFY but has no user context`,
      );
      client.disconnect();
    }
  }

  @SubscribeMessage(GAME_EVENTS.JOIN_ROOM)
  handleJoinRoom(client: Socket, payload: { roomId: string }) {
    client.join(payload.roomId);
    this.logger.log(`Client ${client.id} joined room ${payload.roomId}`);
  }

  @SubscribeMessage(GAME_EVENTS.LEAVE_ROOM)
  handleLeaveRoom(client: Socket, payload: { roomId: string }) {
    client.leave(payload.roomId);
    this.logger.log(`Client ${client.id} left room ${payload.roomId}`);
  }

  @SubscribeMessage(GAME_EVENTS.HEARTBEAT)
  async handleHeartbeat(client: Socket) {
    const user = (client as any).user;
    if (user) {
      await this.presenceService.refreshHeartbeat(user._id);
    }
  }
}
