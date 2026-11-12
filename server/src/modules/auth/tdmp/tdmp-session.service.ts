import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { UserSession } from '../entities/user-session.entity';
import type { User } from '../../users/entities/user.entity';
import { TdmpConfig } from '../../tdmp/tdmp.config';
import { TdmpOAuthClient } from '../../tdmp/tdmp-oauth.client';
import {
  TdmpRequestError,
  TdmpUnavailableError,
} from '../../tdmp/tdmp-api.client';
import { AuditService } from '../../audit/audit.service';
import {
  decryptString,
  deriveKey,
  encryptString,
} from '../../../common/security/crypto';
import { TdmpIdentityService } from './tdmp-identity.service';
import { TdmpSignInRefused } from './tdmp-identity';
import type { RequestMeta } from '../request-meta';

const KEY_ID = 'tdmp1';

/**
 * Keeps a `tdmp` session honest after sign-in. On our refresh (every ~15
 * minutes) it uses the stored TDMP refresh token to confirm the account still
 * exists in TDMP and re-applies its role and scope. TDMP saying no ends our
 * session; TDMP being unreachable is tolerated for TDMP_OFFLINE_GRACE_MINUTES.
 */
@Injectable()
export class TdmpSessionService {
  private readonly logger = new Logger(TdmpSessionService.name);
  /** One re-check per session at a time (parallel tabs share it). */
  private readonly inflight = new Map<string, Promise<User | null>>();

  constructor(
    @InjectRepository(UserSession)
    private readonly sessions: Repository<UserSession>,
    private readonly config: TdmpConfig,
    private readonly oauth: TdmpOAuthClient,
    private readonly identity: TdmpIdentityService,
    private readonly audit: AuditService,
    private readonly configService: ConfigService,
  ) {}

  /** AES-256-GCM key for stored TDMP refresh tokens. */
  private get key(): Buffer {
    return deriveKey(
      this.configService.get<string>('JWT_REFRESH_SECRET') ?? '',
      'rtb-gis/tdmp-refresh-token/v1',
    );
  }

  encrypt(token: string): string {
    return encryptString(token, this.key, KEY_ID);
  }

  private decrypt(payload: string): string | null {
    try {
      return decryptString(payload, this.key);
    } catch {
      return null;
    }
  }

  /**
   * Re-checks the account behind a `tdmp` session when due. Returns the
   * refreshed user, null when nothing was checked, or throws 401 after
   * revoking the session.
   */
  recheck(
    session: UserSession,
    user: User,
    meta: RequestMeta = {},
  ): Promise<User | null> {
    if (session.method !== 'tdmp') return Promise.resolve(null);
    const running = this.inflight.get(session.id);
    if (running) return running;
    const job = this.doRecheck(session, user, meta).finally(() =>
      this.inflight.delete(session.id),
    );
    this.inflight.set(session.id, job);
    return job;
  }

  private async doRecheck(
    session: UserSession,
    user: User,
    meta: RequestMeta,
  ): Promise<User | null> {
    const checkedAt = session.externalCheckedAt?.getTime() ?? 0;
    if (Date.now() - checkedAt < this.config.recheckMs) return null;
    if (!this.config.loginEnabled) return null;
    const stored = session.externalRefreshTokenEnc
      ? this.decrypt(session.externalRefreshTokenEnc)
      : null;
    if (!stored) return null;

    try {
      const tokens = await this.oauth.refresh(stored);
      const scope = await this.oauth.accessScope(tokens.access_token);
      const fresh = await this.identity.resync(user, {
        tdmpUserId: user.tdmpUserId ?? String(scope.userId),
        email: scope.email?.trim().toLowerCase() || null,
        emailVerified: true,
        name: null,
        scope,
      });
      await this.sessions.update(session.id, {
        externalRefreshTokenEnc: tokens.refresh_token
          ? this.encrypt(tokens.refresh_token)
          : session.externalRefreshTokenEnc,
        externalCheckedAt: new Date(),
      });
      return fresh;
    } catch (err) {
      if (err instanceof TdmpUnavailableError) {
        const offlineFor = Date.now() - checkedAt;
        if (offlineFor <= this.config.offlineGraceMs) {
          this.logger.warn(
            `TDMP unreachable; keeping session ${session.id} (${err.message})`,
          );
          return null;
        }
        return this.end(session, user, 'tdmp_unreachable', meta);
      }
      if (err instanceof TdmpRequestError && err.status < 500)
        return this.end(session, user, 'tdmp_revoked', meta);
      if (err instanceof TdmpSignInRefused)
        return this.end(session, user, `tdmp_${err.reason}`, meta);
      throw err;
    }
  }

  private async end(
    session: UserSession,
    user: User,
    reason: string,
    meta: RequestMeta,
  ): Promise<never> {
    await this.sessions.update(
      { id: session.id, revokedAt: IsNull() },
      { revokedAt: new Date(), revokedReason: reason },
    );
    this.audit.record({
      action: 'auth.tdmp_session_ended',
      outcome: 'denied',
      actor: { id: user.id, email: user.email },
      targetType: 'user',
      targetId: user.id,
      subjectUserId: user.id,
      meta: { reason },
      request: { ...meta, sessionId: session.id },
    });
    throw new UnauthorizedException(
      'Your TDMP sign-in has ended. Please sign in again.',
    );
  }

  /** Sign-out: revokes the TDMP refresh token too (best effort). */
  async revokeAtTdmp(session: UserSession | null): Promise<void> {
    if (session?.method !== 'tdmp' || !session.externalRefreshTokenEnc) return;
    const token = this.decrypt(session.externalRefreshTokenEnc);
    if (token) await this.oauth.revoke(token);
  }
}
