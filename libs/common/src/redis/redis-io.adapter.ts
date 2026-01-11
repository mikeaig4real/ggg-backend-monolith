import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { INestApplicationContext, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;
  private readonly redisHost: string;
  private readonly redisPort: number;
  private readonly logger = new Logger(RedisIoAdapter.name);
  private jwtService: JwtService;

  constructor(
    appOrHttpServer: INestApplicationContext,
    private readonly configService: ConfigService,
  ) {
    super(appOrHttpServer);
    this.redisHost = this.configService.get<string>('REDIS_HOST')!;
    this.redisPort = this.configService.get<number>('REDIS_PORT')!;

    try {
      this.jwtService = appOrHttpServer.get(JwtService);
    } catch (e) {
      this.logger.warn(
        'JwtService not found in application context, socket auth might fail if relied upon here.',
      );
    }
  }

  async connectToRedis(): Promise<void> {
    try {
      const pubClient = new Redis({
        host: this.redisHost,
        port: this.redisPort,
      });
      const subClient = pubClient.duplicate();

      await Promise.all([
        new Promise<void>((resolve, reject) => {
          pubClient.once('connect', () => {
            this.logger.log(
              `Redis Pub Client connected to ${this.redisHost}:${this.redisPort}`,
            );
            resolve();
          });
          pubClient.once('error', reject);
        }),
        new Promise<void>((resolve, reject) => {
          subClient.once('connect', () => {
            this.logger.log(
              `Redis Sub Client connected to ${this.redisHost}:${this.redisPort}`,
            );
            resolve();
          });
          subClient.once('error', reject);
        }),
      ]);

      this.adapterConstructor = createAdapter(pubClient, subClient);
      this.logger.log('RedisAdapter initialized successfully');
    } catch (error) {
      this.logger.error('Failed to connect to Redis for socket adapter', error);
      throw error;
    }
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const corsOrigin =
      this.configService.get<string>('CORS_ORIGIN') || 'http://localhost:5173';

    const optionsWithCors = {
      ...options,
      cors: {
        origin: [corsOrigin],
        credentials: true,
        methods: ['GET', 'POST'],
      },
    };

    const server = super.createIOServer(port, optionsWithCors);

    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    } else {
      this.logger.warn(
        'Redis adapter not initialized, falling back to default memory adapter',
      );
    }

    return server;
  }
}
