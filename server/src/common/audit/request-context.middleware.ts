import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { AuditService } from '../../modules/audit/audit.service';
import {
  AUDIT_CTX_KEY,
  auditStorage,
  createAuditContext,
} from './request-context';
import { buildRequestAuditEntry } from './request-entry';

/**
 * Opens the per-request audit context (AsyncLocalStorage), assigns a request
 * id (also returned as `X-Request-Id`), and writes the automatic audit row
 * once the response has finished — which is the only point where the outcome
 * of guard rejections (401/403, which never reach interceptors) is known.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger('AuditRequest');

  constructor(private readonly auditService: AuditService) {}

  use(req: any, res: any, next: (err?: unknown) => void): void {
    const ctx = createAuditContext(req);
    req[AUDIT_CTX_KEY] = ctx;
    req.requestId = ctx.requestId;
    try {
      res.setHeader('X-Request-Id', ctx.requestId);
    } catch {
      /* headers already sent */
    }

    const finalize = () => {
      if (ctx.finalized) return;
      ctx.finalized = true;
      try {
        // An aborted request ('close' without 'finish') has no final status.
        const status = res.writableFinished
          ? res.statusCode
          : (ctx.error?.status ?? 499);
        const entry = buildRequestAuditEntry(ctx, status);
        if (entry) this.auditService.recordForRequest(entry, ctx);
      } catch (err) {
        this.logger.error(
          `Failed to build audit entry: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        // Release references held by the context.
        ctx.responseBody = undefined;
      }
    };
    res.once('finish', finalize);
    res.once('close', finalize);

    auditStorage.run(ctx, () => next());
  }
}
