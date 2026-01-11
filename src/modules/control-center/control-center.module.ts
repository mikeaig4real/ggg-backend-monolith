import { Module, Global, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { ControlCenterController } from './control-center.controller';
import { ControlCenterService } from './control-center.service';
import { ControlCenterProcessor } from './control-center.processor';
import {
  ControlCenter,
  ControlCenterSchema,
} from './schemas/control-center.schema';
import { CONTROL_CENTER_QUEUE } from '@app/common/constants/queues';

import { UsersModule } from '../users/users.module';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ControlCenter.name, schema: ControlCenterSchema },
    ]),
    BullModule.registerQueue({
      name: CONTROL_CENTER_QUEUE,
    }),
    forwardRef(() => UsersModule),
  ],
  controllers: [ControlCenterController],
  providers: [ControlCenterService, ControlCenterProcessor],
  exports: [ControlCenterService],
})
export class ControlCenterModule {}
