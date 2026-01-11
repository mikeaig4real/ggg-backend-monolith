import { Module, Global } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { PresenceService } from '../redis/presence.service';

@Global()
@Module({
  imports: [RedisModule],
  providers: [PresenceService],
  exports: [RedisModule, PresenceService],
})
export class GameSharedModule {}
