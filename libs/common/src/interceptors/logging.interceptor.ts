import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { FastifyRequest } from 'fastify';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() === 'http') {
      const ctx = context.switchToHttp();
      const request = ctx.getRequest<FastifyRequest>();
      const method = request.method;
      const url = request.url;
      const body = request.body;

      // Log Input
      this.logger.log(
        `Incoming Request: ${method} ${url} - Body: ${JSON.stringify(body)}`,
      );

      const now = Date.now();
      return next.handle().pipe(
        tap((response) => {
          const delay = Date.now() - now;
          // Log Output
          this.logger.log(
            `Response: ${method} ${url} - Time: ${delay}ms - Body: ${JSON.stringify(response)}`,
          );
        }),
      );
    }

    // Fallback for RPC/WS if needed, or just pass through
    return next.handle();
  }
}
