/*
import { DynamicModule, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { RmqService } from './rmq.service';

interface RmqModuleOptions {
  name: string;
}

@Module({
  providers: [RmqService],
  exports: [RmqService],
})
export class RmqModule {
  static register({ name }: RmqModuleOptions): DynamicModule {
    return {
      module: RmqModule,
      imports: [
        ClientsModule.registerAsync([
          {
            name,
            useFactory: (configService: ConfigService) => ({
              transport: Transport.RMQ,
              options: {
                urls: [configService.get<string>('RABBITMQ_URI')!],
                queue: configService.get<string>(`RABBITMQ_${name}_QUEUE`)!,
              },
            }),
            inject: [ConfigService],
            extraProviders: [
              {
                provide: 'RMQ_DEBUG_LOG',
                useFactory: (configService: ConfigService) => {
                  console.log(
                    `[RmqModule] Registering client ${name} with queue: ${configService.get<string>(`RABBITMQ_${name}_QUEUE`)}`,
                  );
                },
                inject: [ConfigService],
              },
            ],
          },
        ]),
      ],
      exports: [ClientsModule],
    };
  }
}
*/
