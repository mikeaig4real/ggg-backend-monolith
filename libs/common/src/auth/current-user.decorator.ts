import { createParamDecorator, ExecutionContext } from '@nestjs/common';
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    if (context.getType() === 'ws') {
      return context.switchToWs().getClient().user;
    }
    return context.switchToHttp().getRequest().user;
  },
);
