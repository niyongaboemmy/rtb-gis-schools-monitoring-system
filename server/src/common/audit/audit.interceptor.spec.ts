/* eslint-disable @typescript-eslint/unbound-method -- jest assertions on mocked methods */
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of, throwError } from 'rxjs';
import { AuditInterceptor } from './audit.interceptor';
import { AuditContextGuard } from './audit-context.guard';
import { Audit } from './audit.decorator';
import { AUDIT_CTX_KEY, createAuditContext } from './request-context';
import { RequestContextMiddleware } from './request-context.middleware';
import { EventEmitter } from 'events';

class SchoolsController {
  update() {}
  @Audit('school.special', { target: 'school' })
  special() {}
}
Reflect.defineMetadata('path', 'schools', SchoolsController);
Reflect.defineMetadata('path', ':id', SchoolsController.prototype.update);

function execCtx(req: any, handler: (...a: unknown[]) => unknown) {
  return {
    getType: () => 'http',
    getClass: () => SchoolsController,
    getHandler: () => handler,
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => ({}) }),
  } as any;
}

describe('AuditContextGuard + AuditInterceptor', () => {
  const reflector = new Reflector();

  it('guard records the handler key and route without blocking', () => {
    const req: any = { method: 'PATCH', headers: {} };
    req[AUDIT_CTX_KEY] = createAuditContext(req);
    const ok = new AuditContextGuard(reflector).canActivate(
      execCtx(req, SchoolsController.prototype.update),
    );
    expect(ok).toBe(true);
    expect(req[AUDIT_CTX_KEY].handler).toMatchObject({
      key: 'SchoolsController.update',
      routePath: '/schools/:id',
      decorated: null,
    });
  });

  it('picks up @Audit metadata', () => {
    const req: any = { method: 'POST', headers: {} };
    req[AUDIT_CTX_KEY] = createAuditContext(req);
    new AuditContextGuard(reflector).canActivate(
      execCtx(req, SchoolsController.prototype.special),
    );
    expect(req[AUDIT_CTX_KEY].handler.decorated).toMatchObject({
      action: 'school.special',
    });
  });

  it('captures the response body', async () => {
    const req: any = { method: 'PATCH', headers: {} };
    req[AUDIT_CTX_KEY] = createAuditContext(req);
    const interceptor = new AuditInterceptor(reflector);
    await lastValueFrom(
      interceptor.intercept(execCtx(req, SchoolsController.prototype.update), {
        handle: () => of({ id: 's1', name: 'X' }),
      }),
    );
    expect(req[AUDIT_CTX_KEY].responseBody).toEqual({ id: 's1', name: 'X' });
  });

  it('captures HttpException status and message', async () => {
    const req: any = { method: 'PATCH', headers: {} };
    req[AUDIT_CTX_KEY] = createAuditContext(req);
    const interceptor = new AuditInterceptor(reflector);
    await expect(
      lastValueFrom(
        interceptor.intercept(
          execCtx(req, SchoolsController.prototype.update),
          {
            handle: () =>
              throwError(
                () => new BadRequestException(['name must be a string']),
              ),
          },
        ),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(req[AUDIT_CTX_KEY].error).toEqual({
      status: 400,
      message: 'name must be a string',
    });

    await expect(
      lastValueFrom(
        interceptor.intercept(
          execCtx(req, SchoolsController.prototype.update),
          {
            handle: () => throwError(() => new ForbiddenException()),
          },
        ),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(req[AUDIT_CTX_KEY].error.status).toBe(403);
  });
});

describe('RequestContextMiddleware', () => {
  function run(req: any, statusCode: number, between?: (req: any) => void) {
    const recordForRequest = jest.fn();
    const mw = new RequestContextMiddleware({ recordForRequest } as any);
    const res: any = Object.assign(new EventEmitter(), {
      headers: {} as Record<string, string>,
      statusCode,
      writableFinished: true,
      setHeader(k: string, v: string) {
        this.headers[k] = v;
      },
    });
    mw.use(req, res, () => between?.(req));
    res.emit('finish');
    res.emit('close');
    return { res, recordForRequest };
  }

  it('sets X-Request-Id and writes exactly one row on finish', () => {
    const req: any = {
      method: 'PATCH',
      headers: { 'user-agent': 'ua' },
      params: { id: 's1' },
      user: { id: 'u1', email: 'a@b.c', role: { name: 'admin' } },
    };
    const { res, recordForRequest } = run(req, 200, (r) => {
      r[AUDIT_CTX_KEY].handler = {
        key: 'SchoolsController.update',
        routePath: '/schools/:id',
      };
    });
    expect(res.headers['X-Request-Id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(recordForRequest).toHaveBeenCalledTimes(1);
    expect(recordForRequest.mock.calls[0][0]).toMatchObject({
      action: 'school.update',
      outcome: 'success',
      targetId: 's1',
      request: { requestId: res.headers['X-Request-Id'] },
    });
  });

  it('reuses a well-formed upstream request id', () => {
    const req: any = {
      method: 'POST',
      headers: { 'x-request-id': 'nginx-abc12345' },
    };
    const { res } = run(req, 200);
    expect(res.headers['X-Request-Id']).toBe('nginx-abc12345');
  });

  it('records 403 from a guard as denied', () => {
    const req: any = {
      method: 'DELETE',
      headers: {},
      params: { id: 'r1' },
      user: { id: 'u2', email: 'v@x.y', role: { name: 'viewer' } },
    };
    const { recordForRequest } = run(req, 403, (r) => {
      r[AUDIT_CTX_KEY].handler = {
        key: 'RolesController.remove',
        routePath: '/roles/:id',
      };
    });
    expect(recordForRequest.mock.calls[0][0]).toMatchObject({
      action: 'role.delete',
      outcome: 'denied',
      actor: { id: 'u2', role: 'viewer' },
    });
  });

  it('writes nothing for plain reads', () => {
    const req: any = { method: 'GET', headers: {} };
    const { recordForRequest } = run(req, 200, (r) => {
      r[AUDIT_CTX_KEY].handler = {
        key: 'SchoolsController.findAll',
        routePath: '/schools',
      };
    });
    expect(recordForRequest).not.toHaveBeenCalled();
  });
});
