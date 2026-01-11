import { Module, forwardRef } from '@nestjs/common';
import { DiceGateway } from './dice.gateway';
import { GameManagerModule } from '@modules/game/modules/game-manager/game-manager.module';
import { GameSharedModule } from '@app/common/game-shared';
import { UsersModule } from '@modules/users/users.module';

@Module({
  imports: [GameSharedModule, GameManagerModule, forwardRef(() => UsersModule)],
  providers: [DiceGateway],
})
export class DiceModule {}
