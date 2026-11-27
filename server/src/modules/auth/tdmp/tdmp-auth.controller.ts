import {
  Controller,
  Get,
  HttpCode,
  Logger,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
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
import { CsrfHeaderGuard } from '../guards/csrf-header.guard';
import { TdmpIdentityService } from './tdmp-identity.service';
import { TdmpSignInRefused } from './tdmp-identity';
import {
  clearPendingTdmp,
  readPendingTdmp,
  setPendingTdmp,
} from './tdmp-pending';

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
 * "Sign in with TDMP" (OAuth 2.0 authorization code + PKCE), following the
 * TDMP SSO integration guide (12 Nov 2026). The browser navigates here (not
 * XHR): /start sends it to TDMP, TDMP sends it back to /callback, which
 * signs the user in with our own session cookie and sends them on to the web
 * app. TDMP's sign-in proves who the user is (profile + signed ID token);
 * their role and area are decided in RTB GIS (TDMP_ACCESS_SOURCE).
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
  private async redirectToTdmp(
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
    const authorize = this.oauth.authorizeUrl({
      state: flow.state,
      challenge,
      nonce: flow.nonce,
      prompt: opts.silent ? 'none' : undefined,
    });
    // Interactive sign-in only: a silent attempt must not show a page.
    const target =
      this.tdmp.signinOrigin && !opts.silent
        ? await this.oauth.signinUrl(authorize, this.tdmp.signinOrigin)
        : authorize;
    return res.redirect(302, target);
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
      // Identity: the signed ID token and/or the profile (SSO guide §6.4).
      const claims = tokens.id_token
        ? await this.oauth.verifyIdToken(tokens.id_token, flow.nonce)
        : null;
      const info = await this.oauth
        .userinfo(tokens.access_token)
        .catch((err: unknown): TdmpUserInfo | null => {
          if (!claims) throw err;
          return null;
        });
      const sub = info?.sub ?? claims?.sub;
      if (sub == null || String(sub) === '')
        return this.fail(res, 'failed', meta, 'TDMP returned no user id');
      if (info?.sub && claims?.sub && String(info.sub) !== String(claims.sub))
        return this.fail(res, 'failed', meta, 'profile and ID token disagree');

      // Role and area from TDMP only when it provides them (§8, §12).
      const scope =
        this.tdmp.accessSource === 'tdmp'
          ? await this.oauth.accessScope(tokens.access_token)
          : null;
      const email = (info?.email ?? claims?.email ?? scope?.email ?? '')
        .trim()
        .toLowerCase();
      const { user, requested } = await this.identity.signIn({
        tdmpUserId: String(sub),
        email: email || null,
        emailVerified:
          (info?.email_verified ?? claims?.email_verified) === true,
        name: info?.name ?? claims?.name ?? null,
        givenName: info?.given_name ?? claims?.given_name ?? null,
        familyName: info?.family_name ?? claims?.family_name ?? null,
        scope,
      });
      if (requested)
        this.audit.record({
          action: 'auth.tdmp_access_requested',
          actor: { id: user.id, email: user.email },
          targetType: 'user',
          targetId: user.id,
          targetLabel: user.email,
          subjectUserId: user.id,
          meta: { tdmpUserId: user.tdmpUserId },
          request: meta,
        });

      let next = flow.next;
      let notice: string | null = null;
      if (flow.school && !user.accessPending) {
        const school = await this.schools.findOne({
          where: [{ tdmpSchoolCode: flow.school }, { code: flow.school }],
          select: ['id', 'province', 'district', 'sector'],
        });
        if (school && schoolMatchesScope(school, resolveAccessScope(user)))
          next = `/schools/${school.id}`;
        else notice = 'school_not_found';
      }

      // Privileged roles still use our second factor (TDMP sends no `amr`).
      if (this.authService.tdmpNeedsSecondFactor(user)) {
        setPendingTdmp(res, this.config, {
          userId: user.id,
          refreshToken: tokens.refresh_token,
        });
        const login = new URL(`${this.tdmp.appPublicUrl}/login`);
        login.searchParams.set('sso_mfa', '1');
        login.searchParams.set('next', next);
        return res.redirect(302, login.toString());
      }

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
      if (notice) target.searchParams.set('notice', notice);
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

  /**
   * Second step of a TDMP sign-in that needs our 2FA (the login page calls
   * this when it arrives with ?sso_mfa=1). Answers like password sign-in: a
   * 2FA challenge, an enrolment, or the session.
   */
  @Post('mfa')
  @HttpCode(200)
  @UseGuards(CsrfHeaderGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Continue a TDMP sign-in that needs 2FA' })
  async mfa(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const pending = readPendingTdmp(req, this.config);
    const result = await this.authService.startTdmpSecondFactor(
      pending,
      requestMeta(req),
    );
    if (!('refreshToken' in result)) return result;
    clearPendingTdmp(res, this.config);
    const { refreshToken, sessionId: _sid, ...body } = result;
    setRefreshCookie(
      res,
      this.config,
      refreshToken,
      this.sessionsService.refreshTtlMs,
    );
    return body;
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
