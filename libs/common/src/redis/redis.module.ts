import { Module, Global, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PresenceService } from './presence.service';
import { REDIS_CLIENT } from './constants';
import Redis from 'ioredis';

const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: (configService: ConfigService) => {
    return new Redis({
      host: configService.get<string>('REDIS_HOST'),
      port: configService.get<number>('REDIS_PORT'),
    });
  },
  inject: [ConfigService],
};

@Global()
@Module({
  providers: [redisProvider, PresenceService],
  exports: [redisProvider, PresenceService],
})
export class RedisModule {}
