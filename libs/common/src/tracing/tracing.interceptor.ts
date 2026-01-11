import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { trace } from '@opentelemetry/api';
import { randomUUID } from 'crypto';

@Injectable()
export class TracingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const type = context.getType();
    // Only intercept HTTP requests (Fastify/Express)
    if (type !== 'http') {
      return next.handle();
    }

    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest();
    const response = httpContext.getResponse();

    // Fastify assigns request.id, but we can enforce x-request-id
    const requestId =
      request.headers['x-request-id'] || request.id || randomUUID();

    // Ensure downstream or internal services see this ID
    request.headers['x-request-id'] = requestId;

    // Set response header
    response.header('x-request-id', requestId);

    // Attach to current Span
    const span = trace.getActiveSpan();
    if (span) {
      span.setAttribute('app.request.id', requestId);
      // Useful for filtering in HyperDX
      span.setAttribute('request_id', requestId);

      // Attach User Context if available (from AuthGuard)
      const user = request.user;
      if (user) {
        const userId = user.id || user._id;
        if (userId) {
          span.setAttribute('user.id', userId.toString());
          span.setAttribute('enduser.id', userId.toString()); // OTel semantic convention
        }
        if (user.email) {
          span.setAttribute('user.email', user.email);
        }
      }
    }

    return next.handle();
  }
}
