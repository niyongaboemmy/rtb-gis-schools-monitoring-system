import { Controller, Get, Logger, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request, Response } from 'express';
import { AuthService } from '../auth.service';
import { SessionsService } from '../sessions.service';
import { AuditService } from '../../audit/audit.service';
import { School } from '../../schools/entities/school.entity';
import { TdmpConfig } from '../../tdmp/tdmp.config';
import { createPkce, TdmpOAuthClient } from '../../tdmp/tdmp-oauth.client';
import { TdmpUnavailableError } from '../../tdmp/tdmp-api.client';
import type { TdmpUserInfo } from '../../tdmp/tdmp.types';
import {
  resolveAccessScope,
  schoolMatchesScope,
} from '../../../common/scope/access-scope';
import {
  decryptString,
  deriveKey,
  encryptString,
  randomToken,
} from '../../../common/security/crypto';
import { readCookie, secureCookies, setRefreshCookie } from '../refresh-cookie';
import { requestMeta } from '../request-meta';
import { TdmpIdentityService } from './tdmp-identity.service';
import { TdmpSignInRefused } from './tdmp-identity';

/** Short-lived cookie carrying the PKCE verifier, state and nonce. */
const FLOW_COOKIE = 'rtb_tdmp_flow';
const FLOW_COOKIE_PATH = '/api/v1/auth/tdmp';
const FLOW_TTL_MS = 10 * 60 * 1000;

interface FlowState {
  state: string;
  verifier: string;
  nonce: string;
  next: string;
  school?: string;
  /** Sent with prompt=none; an interactive retry follows if TDMP refuses. */
  silent?: boolean;
  exp: number;
}

/** TDMP answers these to prompt=none when the user must see a TDMP page. */
const NEEDS_INTERACTION = new Set([
  'login_required',
  'interaction_required',
  'consent_required',
  'account_selection_required',
]);

export type SsoError =
  | 'cancelled'
  | 'state'
  | 'not_allowed'
  | 'inactive'
  | 'unavailable'
  | 'failed';

/** A same-app path only — never another site. */
export function safeNext(next: unknown): string {
  return typeof next === 'string' &&
    next.startsWith('/') &&
    !next.startsWith('//') &&
    !next.includes('\\') &&
    next.length <= 512
    ? next
    : '/';
}

const SCHOOL_CODE_RE = /^[A-Za-z0-9._-]{1,64}$/;

/**
 * "Sign in with TDMP" (OAuth 2.0 authorization code + PKCE). The browser
 * navigates here (not XHR): /start sends it to TDMP, TDMP sends it back to
 * /callback, which signs the user in with our own session cookie and sends
 * them on to the web app.
 */
@ApiTags('auth')
@Controller('auth/tdmp')
export class TdmpAuthController {
  private readonly logger = new Logger(TdmpAuthController.name);

  constructor(
    private readonly tdmp: TdmpConfig,
    private readonly oauth: TdmpOAuthClient,
    private readonly identity: TdmpIdentityService,
    private readonly authService: AuthService,
    private readonly sessionsService: SessionsService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    @InjectRepository(School)
    private readonly schools: Repository<School>,
  ) {}

  private get flowKey(): Buffer {
    return deriveKey(
      this.config.get<string>('JWT_SECRET') ?? '',
      'rtb-gis/tdmp-flow/v1',
    );
  }

  @Get('start')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @ApiOperation({ summary: 'Start "Sign in with TDMP" (browser redirect)' })
  start(
    @Query('next') next: string | undefined,
    @Query('school') school: string | undefined,
    @Res() res: Response,
  ) {
    if (!this.tdmp.loginEnabled) return this.fail(res, 'unavailable');
    return this.redirectToTdmp(res, {
      next: safeNext(next),
      school: school && SCHOOL_CODE_RE.test(school) ? school : undefined,
      silent: this.tdmp.silentSignIn,
    });
  }

  /** New flow cookie (state, nonce, PKCE verifier) and off to TDMP. */
  private redirectToTdmp(
    res: Response,
    opts: { next: string; school?: string; silent: boolean },
  ) {
    const { verifier, challenge } = createPkce();
    const flow: FlowState = {
      state: randomToken(),
      verifier,
      nonce: randomToken(),
      next: opts.next,
      school: opts.school,
      silent: opts.silent || undefined,
      exp: Date.now() + FLOW_TTL_MS,
    };
    // Lax, not Strict: it must come back on TDMP's cross-site redirect.
    res.cookie(
      FLOW_COOKIE,
      encryptString(JSON.stringify(flow), this.flowKey, 'flow1'),
      {
        httpOnly: true,
        secure: secureCookies(this.config),
        sameSite: 'lax',
        path: FLOW_COOKIE_PATH,
        maxAge: FLOW_TTL_MS,
      },
    );
    return res.redirect(
      302,
      this.oauth.authorizeUrl({
        state: flow.state,
        challenge,
        nonce: flow.nonce,
        prompt: opts.silent ? 'none' : undefined,
      }),
    );
  }

  @Get('callback')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @ApiOperation({ summary: 'TDMP redirects here after sign-in' })
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const meta = requestMeta(req);
    const flow = this.readFlow(req);
    res.clearCookie(FLOW_COOKIE, { path: FLOW_COOKIE_PATH });

    if (!flow || !state || state !== flow.state)
      return this.fail(res, 'state', meta, 'state mismatch or expired');
    // Silent attempt refused (no TDMP session yet): ask again, interactively,
    // once. TDMP then shows its own sign-in page.
    if (error && flow.silent && NEEDS_INTERACTION.has(error))
      return this.redirectToTdmp(res, {
        next: flow.next,
        school: flow.school,
        silent: false,
      });
    if (error)
      return this.fail(
        res,
        error === 'access_denied' ? 'cancelled' : 'failed',
        meta,
        `TDMP error: ${error}`,
      );
    if (!code) return this.fail(res, 'failed', meta, 'no code');

    try {
      const tokens = await this.oauth.exchangeCode(code, flow.verifier);
      const claims = tokens.id_token
        ? this.oauth.checkIdToken(tokens.id_token, flow.nonce)
        : null;
      const [info, scope] = await Promise.all([
        this.oauth
          .userinfo(tokens.access_token)
          .catch((): TdmpUserInfo | null => null),
        this.oauth.accessScope(tokens.access_token),
      ]);

      const tdmpUserId = scope.userId ?? info?.sub ?? claims?.sub;
      if (tdmpUserId == null || String(tdmpUserId) === '')
        return this.fail(res, 'failed', meta, 'TDMP returned no user id');
      const email = (info?.email ?? claims?.email ?? scope.email ?? '')
        .trim()
        .toLowerCase();
      const user = await this.identity.signIn({
        tdmpUserId: String(tdmpUserId),
        email: email || null,
        emailVerified:
          (info?.email_verified ?? claims?.email_verified) === true,
        name: info?.name ?? claims?.name ?? null,
        scope,
      });

      const session = await this.authService.issueTdmpSession(
        user,
        meta,
        tokens.refresh_token,
      );
      setRefreshCookie(
        res,
        this.config,
        session.refreshToken,
        this.sessionsService.refreshTtlMs,
      );

      const target = new URL(`${this.tdmp.appPublicUrl}/sso/tdmp/complete`);
      let next = flow.next;
      if (flow.school) {
        const school = await this.schools.findOne({
          where: [{ tdmpSchoolCode: flow.school }, { code: flow.school }],
          select: ['id', 'province', 'district', 'sector'],
        });
        if (school && schoolMatchesScope(school, resolveAccessScope(user)))
          next = `/schools/${school.id}`;
        else target.searchParams.set('notice', 'school_not_found');
      }
      target.searchParams.set('next', next);
      return res.redirect(302, target.toString());
    } catch (err) {
      if (err instanceof TdmpSignInRefused)
        return this.fail(res, err.reason, meta, err.detail);
      if (err instanceof TdmpUnavailableError)
        return this.fail(res, 'unavailable', meta, err.message);
      this.logger.error(`TDMP sign-in failed: ${(err as Error).message}`);
      return this.fail(res, 'failed', meta, (err as Error).message);
    }
  }

  private readFlow(req: Request): FlowState | null {
    const raw = readCookie(req, FLOW_COOKIE);
    if (!raw) return null;
    try {
      const flow = JSON.parse(decryptString(raw, this.flowKey)) as FlowState;
      return flow.exp > Date.now() ? flow : null;
    } catch {
      return null;
    }
  }

  private fail(
    res: Response,
    reason: SsoError,
    meta: ReturnType<typeof requestMeta> = {},
    detail?: string,
  ) {
    if (detail)
      this.audit.record({
        action: 'auth.tdmp_login_failed',
        outcome: reason === 'cancelled' ? 'failure' : 'denied',
        targetType: 'user',
        meta: { reason, detail: detail.slice(0, 300) },
        request: meta,
      });
    const url = new URL(`${this.tdmp.appPublicUrl}/login`);
    url.searchParams.set('sso_error', reason);
    return res.redirect(302, url.toString());
  }
}
