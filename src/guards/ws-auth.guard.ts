import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { UsersService } from '@modules/users/users.service';
import { Socket } from 'socket.io';
import { getAuthTokenFromWebsocketHeaderHelper } from '@app/common';

@Injectable()
export class WsAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsAuthGuard.name);

  constructor(private readonly usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    const jwt = getAuthTokenFromWebsocketHeaderHelper(client);

    if (!jwt) {
      this.logger.warn(`WsAuthGuard: No JWT provided for client ${client.id}`);
      return false;
    }

    this.logger.log(`WsAuthGuard: Verifying JWT for client ${client.id}`);

    try {
      const user = await this.usersService.verify(jwt);
      // Attach user to client
      (client as any).user = user;
      return true;
    } catch (err) {
      this.logger.error(
        `WsAuthGuard: Verification failed for client ${client.id}: ${err.message}`,
      );
      return false;
    }
  }
}
