import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import {
  getAuthTokenFromWebsocketHeaderHelper,
  GAME_CHANNELS,
  GAME_EVENTS,
  NOTIFICATION_EVENTS,
  REDIS_CLIENT,
  PresenceService,
} from '@app/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { UsersService } from '@modules/users/users.service';
import { Inject } from '@nestjs/common';

export abstract class BaseGameGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  @WebSocketServer()
  server: Server;

  protected logger = new Logger(BaseGameGateway.name);
  protected subClient: Redis;

  constructor(
    protected readonly presenceService: PresenceService,
    protected readonly usersService: UsersService,
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
      this.logger.log(`[BaseGameGateway] Received Redis Message: ${message}`);
      try {
        const payload = JSON.parse(message);
        const { matchId, event, state, result } = payload;

        if (!matchId || !event) return;

        this.logger.log(
          `[BaseGameGateway] Emitting event ${event} to room ${matchId}`,
        );

        switch (event) {
          case 'END':
            this.server
              .to(matchId)
              .emit('game_ended', { winner: result?.winnerId, state });
            break;
          case 'START':
          case GAME_EVENTS.STATE_UPDATE:
          default:
            this.logger.log(
              `[BaseGameGateway] About to emit game_update to ${matchId} with payload: ${JSON.stringify(
                state,
              )}`,
            );
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

      this.logger.log(
        `[BaseGameGateway] Verifying JWT for client ${client.id}`,
      );

      const user = await this.usersService.verify(jwt).catch((err) => {
        this.logger.error(`Auth failed: ${err.message}`);
        return null;
      });

      if (!user) {
        this.logger.warn(
          `[BaseGameGateway] Connection ${client.id} rejected: Invalid JWT`,
        );
        client.emit('error', { message: 'Invalid JWT' });
        client.disconnect();
        return;
      }

      (client as any).user = user;

      // Mark online
      const serverId = this.configService.get('SERVER_ID');
      const finalServerId = serverId || 'default-server';
      await this.presenceService.setOnline(user._id.toString(), finalServerId);

      // Join user-specific room for private notifications
      client.join(user._id.toString());

      this.logger.log(
        `[BaseGameGateway] User ${user._id} connected to ${JSON.stringify(finalServerId)} (Socket: ${client.id})`,
      );
    } catch (e) {
      this.logger.error(
        `[BaseGameGateway] Error in handleConnection for ${client.id}: ${e}`,
      );
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`[BaseGameGateway] Disconnect: ${client.id}`);
    const user = (client as any).user;
    if (user) {
      await this.presenceService.setOffline(user._id.toString());
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
      await this.presenceService.refreshHeartbeat(user._id.toString());
    }
  }

  @OnEvent(GAME_EVENTS.MATCH_READY)
  handleMatchReady(payload: any) {
    this.logger.log(
      `[BaseGameGateway] Handling MATCH_READY: ${JSON.stringify(payload)}`,
    );

    payload.players.forEach((player: any) => {
      if (!player.isBot) {
        this.logger.log(
          `[BaseGameGateway] Emitting MATCH_READY to user ${player.userId}`,
        );
        this.server.to(player.userId).emit(GAME_EVENTS.MATCH_READY, payload);
      }
    });
  }

  @OnEvent(NOTIFICATION_EVENTS.NEW_NOTIFICATION)
  handleNotification(payload: { userId: string; notification: any }) {
    this.logger.log(
      `[BaseGameGateway] Emitting notification to user ${payload.userId}`,
    );
    this.server.to(payload.userId).emit('notification', payload.notification);
  }
}
