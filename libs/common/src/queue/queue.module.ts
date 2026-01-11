import { DynamicModule, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

@Module({})
export class QueueModule {
  static register({ name }: { name: string }): DynamicModule {
    return {
      module: QueueModule,
      imports: [
        BullModule.registerQueueAsync({
          name,
        }),
      ],
      exports: [BullModule],
    };
  }
}
