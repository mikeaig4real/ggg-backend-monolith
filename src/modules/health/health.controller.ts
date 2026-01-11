import { Controller, Get, Logger } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MongooseHealthIndicator,
  TypeOrmHealthIndicator,
  MicroserviceHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private health: HealthCheckService,
    private mongoose: MongooseHealthIndicator,
    private typeOrm: TypeOrmHealthIndicator,
    private microservice: MicroserviceHealthIndicator,
    private memory: MemoryHealthIndicator,
    private configService: ConfigService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    this.logger.log(`Hit endpoint: check`);
    return this.health.check([
      // MongoDB check
      () => this.mongoose.pingCheck('mongodb'),

      // TypeORM (Postgres) check 
      () => this.typeOrm.pingCheck('database'),

      // Redis Check
      () =>
        this.microservice.pingCheck('redis', {
          transport: Transport.REDIS,
          options: {
            host: this.configService.get('REDIS_HOST') || 'localhost',
            port: this.configService.get('REDIS_PORT') || 6379,
          },
        }),

      // Memory Check (heap used > 500MB)
      () => this.memory.checkHeap('memory_heap', 500 * 1024 * 1024),
    ]);
  }
}
