import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UsersService } from '@modules/users/users.service';
import { AdminPermissions, AccountType } from '@app/common';
import { IS_PUBLIC_KEY } from 'src/decorators/public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization as string;

    if (!authHeader) return false;
    const jwt = authHeader.split(' ')[1];
    if (!jwt) return false;

    const permission = this.reflector.getAllAndOverride<AdminPermissions>(
      'permission',
      [context.getHandler(), context.getClass()],
    );

    const role =
      this.reflector.getAllAndOverride<AccountType>('role', [
        context.getHandler(),
        context.getClass(),
      ]) ?? AccountType.USER;

    this.logger.log(
      `Authenticating ${role} with permission ${permission} for Token: ${jwt.slice(0, 6)}...`,
    );

    try {
      const user = await this.usersService.verify(jwt, permission, role);
      request.user = user;
      return true;
    } catch (err) {
      this.logger.error(`Auth failed: ${err.message}`);
      throw new UnauthorizedException();
    }
  }
}
