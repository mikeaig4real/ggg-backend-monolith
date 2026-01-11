import { Module, Global } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import * as redisStore from 'cache-manager-ioredis';

@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      useFactory: (configService: ConfigService) => {
        const store = redisStore.create({
          host: configService.get<string>('REDIS_HOST'),
          port: configService.get<number>('REDIS_PORT'),
          ttl: 600,
        });

        return {
          store: redisStore,
          host: configService.get<string>('REDIS_HOST'),
          port: configService.get<number>('REDIS_PORT'),
          ttl: 600,
          retryStrategy: (times: number) => {
            console.warn(`Redis connection retry attempt ${times}`);
            return Math.min(times * 50, 2000);
          },
          // ioredis options
          enableOfflineQueue: true,
          onClient: (client: any) => {
            client.on('error', (err: any) => {
              console.error('Redis Client Error:', err);
            });
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  exports: [NestCacheModule],
})
export class CacheModule {}
