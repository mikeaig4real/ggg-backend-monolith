/*
// REPLACED BY SHARED ADAPTER IN @app/common
// kept for reference as requested
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { INestApplicationContext } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;
  private readonly redisHost: string;
  private readonly redisPort: number;

  constructor(appOrHttpServer: any, private readonly configService: ConfigService) {
    super(appOrHttpServer);
    this.redisHost = this.configService.get<string>('REDIS_HOST')!;
    this.redisPort = this.configService.get<number>('REDIS_PORT')!;
  }

  async connectToRedis(): Promise<void> {
    const pubClient = new Redis({ host: this.redisHost, port: this.redisPort });
    const subClient = pubClient.duplicate();

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}
*/
