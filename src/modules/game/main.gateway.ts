import { WebSocketGateway } from '@nestjs/websockets';
import { BaseGameGateway } from './base.gateway';
import { UseGuards, Inject } from '@nestjs/common';
import { WsAuthGuard } from '../../guards/ws-auth.guard';
import { REDIS_CLIENT, PresenceService } from '@app/common';
import { UsersService } from '@modules/users/users.service';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@WebSocketGateway({ cors: { origin: '*' } })
@UseGuards(WsAuthGuard)
export class MainGateway extends BaseGameGateway {
  constructor(
    protected readonly presenceService: PresenceService,
    protected readonly usersService: UsersService,
    protected readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) protected readonly redis: Redis,
  ) {
    super(presenceService, usersService, configService, redis);
  }

  async disconnectUser(userId: string) {
    this.logger.log(`[MainGateway] Force disconnecting user ${userId}`);
    this.server.in(userId).disconnectSockets(true);
    await this.presenceService.setOffline(userId);
  }
}
