import { Module, forwardRef } from '@nestjs/common';
import { LobbyService } from './lobby.service';
import { GameManagerModule } from '@modules/game/modules/game-manager/game-manager.module';
import { UsersModule } from '@modules/users/users.module';
import { RedisModule } from '@app/common';

@Module({
  imports: [RedisModule, GameManagerModule, forwardRef(() => UsersModule)],
  providers: [LobbyService],
  exports: [LobbyService],
})
export class LobbyModule {}
