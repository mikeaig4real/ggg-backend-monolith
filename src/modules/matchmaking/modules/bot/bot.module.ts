import { Module, forwardRef } from '@nestjs/common';
import { BotService } from './bot.service';
import { GameManagerModule } from '@modules/game/modules/game-manager/game-manager.module';
import { UsersModule } from '@modules/users/users.module';

@Module({
  imports: [GameManagerModule, forwardRef(() => UsersModule)],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
