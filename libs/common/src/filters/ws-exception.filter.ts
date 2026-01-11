import { Catch, ArgumentsHost, Logger } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Catch(WsException)
export class WsExceptionFilter extends BaseWsExceptionFilter {
  private readonly logger = new Logger(WsExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== 'ws') {
      return;
    }

    const client = host.switchToWs().getClient<Socket>();
    const error =
      exception instanceof WsException
        ? exception.getError()
        : exception instanceof Error
          ? exception.message
          : 'Unknown WebSocket Error';

    this.logger.error(`WS Error: ${JSON.stringify(error)}`);

    // Emit error event to client
    // Check if client and emit exist just in case
    if (client && typeof client.emit === 'function') {
      client.emit('error', {
        status: 'error',
        message: error,
      });
    }
  }
}
