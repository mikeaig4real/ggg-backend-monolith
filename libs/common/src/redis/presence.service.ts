import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './constants';

@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async setOnline(userId: string, serverId: string): Promise<void> {
    this.logger.log(
      `Hit Service: setOnline args=${JSON.stringify({ userId, serverId })}`,
    );
    await this.redis.set(`user:presence:${userId}`, serverId, 'EX', 30);
  }

  async refreshHeartbeat(userId: string): Promise<void> {
    this.logger.log(
      `Hit Service: refreshHeartbeat args=${JSON.stringify({ userId })}`,
    );
    await this.redis.expire(`user:presence:${userId}`, 30);
  }

  async setOffline(userId: string): Promise<void> {
    this.logger.log(
      `Hit Service: setOffline args=${JSON.stringify({ userId })}`,
    );
    await this.redis.del(`user:presence:${userId}`);
  }

  async getActiveServer(userId: string): Promise<string | null> {
    this.logger.log(
      `Hit Service: getActiveServer args=${JSON.stringify({ userId })}`,
    );
    return this.redis.get(`user:presence:${userId}`);
  }

  async isOnline(userId: string): Promise<boolean> {
    this.logger.log(`Hit Service: isOnline args=${JSON.stringify({ userId })}`);
    const serverId = await this.getActiveServer(userId);
    return !!serverId;
  }
}
