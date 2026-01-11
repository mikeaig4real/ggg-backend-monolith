import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import {
  getPinoTransport,
  getPinoMixinFunction,
} from '@hyperdx/node-opentelemetry';
import pino from 'pino';
import * as crypto from 'crypto';

const transport = pino.transport({
  targets: [
    {
      target: 'pino-pretty',
      options: {
        singleLine: true,
        destination: 1, // stdout
      } as any,
    },
    getPinoTransport('info', { detectResources: true }),
  ],
});

const logger = pino(
  {
    mixin: getPinoMixinFunction,
  },
  transport,
);

@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        logger,
        genReqId: (req: any, res: any) => {
          if (req.id) return req.id;
          if (req.headers['x-request-id']) return req.headers['x-request-id'];
          const id = crypto.randomUUID();
          res.setHeader('x-request-id', id);
          return id;
        },
        serializers: {
          req(req) {
            return {
              method: req.method,
              url: req.url,
            };
          },
          res(res) {
            return {
              statusCode: res.statusCode,
            };
          },
        },
      },
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
