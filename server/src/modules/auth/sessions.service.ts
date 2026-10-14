import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { IsNull, Not, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { UserSession } from './entities/user-session.entity';
import { AuditService } from '../audit/audit.service';
import { hexDigestsEqual, sha256Hex } from '../../common/security/crypto';
import { REFRESH_REUSE_GRACE_MS } from './auth.constants';
import type { RequestMeta } from './request-meta';

export interface RefreshPayload {
  sub: string;
  sid: string;
  typ: 'refresh';
  jti: string;
}

/** Parses `7d`, `15m`, `3600` (seconds) style durations into ms. */
export function durationToMs(
  value: string | undefined,
  fallbackMs: number,
): number {
  const m = /^\s*(\d+)\s*([smhd])?\s*$/i.exec(value ?? '');
  if (!m) return fallbackMs;
  const n = Number(m[1]);
  const unit = (m[2] ?? 's').toLowerCase();
  const mult = { s: 1e3, m: 60e3, h: 3600e3, d: 86400e3 }[unit] ?? 1e3;
  return n * mult;
}

/**
 * Multi-device refresh sessions (WS9.11). Each sign-in creates a row; the
 * refresh token names its row (`sid`) and rotates on every use. Presenting
 * an already-rotated token (outside a short grace window) is treated as
 * theft: the whole session is revoked.
 */
@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(UserSession)
    private readonly sessions: Repository<UserSession>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  get refreshTtlMs() {
    return durationToMs(
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN'),
      7 * 86400e3,
    );
  }

  /** Starts a session and returns its first refresh token. */
  async create(userId: string, meta: RequestMeta, method: string) {
    const id = crypto.randomUUID();
    const refreshToken = await this.sign(userId, id);
    const now = new Date();
    const session = await this.sessions.save(
      this.sessions.create({
        id,
        userId,
        refreshTokenHash: sha256Hex(refreshToken),
        previousTokenHash: null,
        rotatedAt: null,
        userAgent: meta.userAgent ?? null,
        ip: meta.ip ?? null,
        method,
        lastUsedAt: now,
        expiresAt: new Date(now.getTime() + this.refreshTtlMs),
        revokedAt: null,
        revokedReason: null,
      }),
    );
    return { session, refreshToken };
  }

  /**
   * Validates a presented refresh token and rotates it. Throws 401 on any
   * failure; a replayed (already rotated) token also revokes the session.
   */
  async rotate(refreshToken: string, meta: RequestMeta) {
    const denied = () =>
      new UnauthorizedException('Session expired. Please sign in again.');

    let payload: RefreshPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshPayload>(
        refreshToken,
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        },
      );
    } catch {
      throw denied();
    }
    if (payload?.typ !== 'refresh' || !payload.sid || !payload.sub)
      throw denied();

    const session = await this.sessions.findOne({ where: { id: payload.sid } });
    if (!session || session.userId !== payload.sub) throw denied();
    if (session.revokedAt) throw denied();
    if (session.expiresAt.getTime() <= Date.now()) {
      await this.revoke(session.id, 'expired');
      throw denied();
    }

    const presented = sha256Hex(refreshToken);
    const isCurrent = hexDigestsEqual(presented, session.refreshTokenHash);
    const isGraceReplay =
      !isCurrent &&
      hexDigestsEqual(presented, session.previousTokenHash) &&
      !!session.rotatedAt &&
      Date.now() - session.rotatedAt.getTime() <= REFRESH_REUSE_GRACE_MS;

    if (!isCurrent && !isGraceReplay) {
      await this.revoke(session.id, 'reuse');
      this.auditService.record({
        action: 'auth.refresh_reuse',
        outcome: 'denied',
        actor: { id: session.userId },
        targetType: 'user',
        targetId: session.userId,
        subjectUserId: session.userId,
        meta: { sessionId: session.id },
        request: { ...meta, sessionId: session.id },
      });
      throw denied();
    }

    const next = await this.sign(session.userId, session.id);
    const now = new Date();
    await this.sessions.update(session.id, {
      refreshTokenHash: sha256Hex(next),
      previousTokenHash: session.refreshTokenHash,
      rotatedAt: now,
      lastUsedAt: now,
      ip: meta.ip ?? session.ip,
      userAgent: meta.userAgent ?? session.userAgent,
    });
    return {
      userId: session.userId,
      sessionId: session.id,
      refreshToken: next,
    };
  }

  /** Reads the session id from a refresh token without rotating it. */
  async peek(refreshToken: string): Promise<RefreshPayload | null> {
    try {
      const p = await this.jwtService.verifyAsync<RefreshPayload>(
        refreshToken,
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        },
      );
      return p?.typ === 'refresh' && p.sid ? p : null;
    } catch {
      return null;
    }
  }

  async revoke(sessionId: string, reason: string) {
    await this.sessions.update(
      { id: sessionId, revokedAt: IsNull() },
      { revokedAt: new Date(), revokedReason: reason },
    );
  }

  /** Revokes every live session of a user, optionally keeping one. */
  async revokeAll(userId: string, reason: string, exceptSessionId?: string) {
    await this.sessions.update(
      exceptSessionId
        ? { userId, revokedAt: IsNull(), id: Not(exceptSessionId) }
        : { userId, revokedAt: IsNull() },
      { revokedAt: new Date(), revokedReason: reason },
    );
  }

  /** Revokes one session, only if it belongs to `userId`. */
  async revokeOwn(userId: string, sessionId: string, reason: string) {
    const result = await this.sessions.update(
      { id: sessionId, userId, revokedAt: IsNull() },
      { revokedAt: new Date(), revokedReason: reason },
    );
    return (result.affected ?? 0) > 0;
  }

  async listActive(userId: string) {
    const rows = await this.sessions.find({
      where: { userId, revokedAt: IsNull() },
      order: { lastUsedAt: 'DESC' },
    });
    const now = Date.now();
    return rows.filter((s) => s.expiresAt.getTime() > now);
  }

  private sign(userId: string, sid: string) {
    return this.jwtService.signAsync(
      { sub: userId, sid, typ: 'refresh', jti: crypto.randomUUID() },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: Math.floor(this.refreshTtlMs / 1000),
      },
    );
  }
}
