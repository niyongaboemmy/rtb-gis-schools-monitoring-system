import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { describeHandler } from './audit-context.guard';
import { getAuditContextFromRequest } from './request-context';

/**
 * Global AuditInterceptor (WS11.2). Captures what only the handler pipeline
 * knows — the response body (for created ids and target labels) and the
 * exception (for outcome/error) — into the request's audit context. The row
 * itself is written by RequestContextMiddleware when the response finishes,
 * so there is exactly one row per request, including guard rejections.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest();
    const ctx = getAuditContextFromRequest(req);
    if (!ctx) return next.handle();
    if (!ctx.handler) ctx.handler = describeHandler(context, this.reflector);

    return next.handle().pipe(
      tap({
        next: (body: unknown) => {
          ctx.responseBody = body;
        },
        error: (err: unknown) => {
          const status =
            err instanceof HttpException
              ? err.getStatus()
              : typeof (err as { status?: unknown })?.status === 'number'
                ? (err as { status: number }).status
                : 500;
          const message =
            err instanceof HttpException
              ? (() => {
                  const r = err.getResponse();
                  const m =
                    typeof r === 'object' && r
                      ? (r as { message?: unknown }).message
                      : r;
                  if (Array.isArray(m)) return m.join('; ');
                  return typeof m === 'string' ? m : err.message;
                })()
              : err instanceof Error
                ? err.message
                : String(err);
          ctx.error = { status, message };
        },
      }),
    );
  }
}
