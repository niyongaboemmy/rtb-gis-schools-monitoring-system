import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { SessionsService, durationToMs } from './sessions.service';
import type { UserSession } from './entities/user-session.entity';

/** In-memory stand-in for the user_sessions repository. */
function makeRepo() {
  const rows = new Map<string, UserSession>();
  const matches = (row: UserSession, where: Record<string, unknown>) =>
    Object.entries(where).every(([k, v]) => {
      const actual = (row as unknown as Record<string, unknown>)[k];
      if (v && typeof v === 'object' && '_type' in v) {
        const op = v as { _type: string; _value?: unknown };
        if (op._type === 'isNull') return actual == null;
        if (op._type === 'not') return actual !== op._value;
      }
      return actual === v;
    });
  return {
    rows,
    create: (d: Partial<UserSession>) => ({ ...d }) as UserSession,
    save: jest.fn(async (s: UserSession) => {
      rows.set(s.id, { ...s, createdAt: s.createdAt ?? new Date() });
      return rows.get(s.id);
    }),
    findOne: jest.fn(async ({ where }: { where: { id: string } }) => {
      const r = rows.get(where.id);
      return r ? { ...r } : null;
    }),
    find: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
      [...rows.values()].filter((r) => matches(r, where)),
    ),
    update: jest.fn(
      async (
        where: string | Record<string, unknown>,
        patch: Partial<UserSession>,
      ) => {
        let affected = 0;
        for (const row of rows.values()) {
          if (
            typeof where === 'string' ? row.id === where : matches(row, where)
          ) {
            Object.assign(row, patch);
            affected++;
          }
        }
        return { affected };
      },
    ),
  };
}

function makeService() {
  const repo = makeRepo();
  const config = {
    get: (k: string) =>
      ({
        JWT_REFRESH_SECRET: 'refresh-secret-for-tests',
        JWT_REFRESH_EXPIRES_IN: '7d',
      })[k],
  };
  const audit = { record: jest.fn() };
  const service = new SessionsService(
    repo as never,
    new JwtService({}),
    config as never,
    audit as never,
  );
  return { service, repo, audit };
}

describe('SessionsService', () => {
  const meta = { ip: '10.0.0.5', userAgent: 'jest-agent' };

  it('parses durations', () => {
    expect(durationToMs('7d', 0)).toBe(7 * 86400e3);
    expect(durationToMs('15m', 0)).toBe(900e3);
    expect(durationToMs('3600', 0)).toBe(3600e3);
    expect(durationToMs('bogus', 42)).toBe(42);
  });

  it('creates a session that stores only a hash of the token', async () => {
    const { service, repo } = makeService();
    const { session, refreshToken } = await service.create(
      'user-1',
      meta,
      'password',
    );

    const row = repo.rows.get(session.id)!;
    expect(row.refreshTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.refreshTokenHash).not.toContain(refreshToken);
    expect(row).toMatchObject({
      userId: 'user-1',
      ip: '10.0.0.5',
      userAgent: 'jest-agent',
      method: 'password',
    });
  });

  it('rotates: the new token works, sessions on other devices are untouched', async () => {
    const { service } = makeService();
    const a = await service.create('user-1', meta, 'password');
    const b = await service.create('user-1', meta, 'password');

    const rotated = await service.rotate(a.refreshToken, meta);
    expect(rotated.sessionId).toBe(a.session.id);
    expect(rotated.refreshToken).not.toBe(a.refreshToken);

    await expect(
      service.rotate(rotated.refreshToken, meta),
    ).resolves.toBeDefined();
    await expect(service.rotate(b.refreshToken, meta)).resolves.toBeDefined();
  });

  it('treats reuse of a rotated token as theft: revokes the session and audits', async () => {
    const { service, repo, audit } = makeService();
    const { session, refreshToken: t0 } = await service.create(
      'user-1',
      meta,
      'password',
    );
    const { refreshToken: t1 } = await service.rotate(t0, meta);
    await service.rotate(t1, meta); // t0 is now two generations old

    await expect(service.rotate(t0, meta)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(repo.rows.get(session.id)!.revokedReason).toBe('reuse');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.refresh_reuse' }),
    );

    // The whole session is dead, including its newest token.
    await expect(service.rotate(t1, meta)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('honours the immediately previous token within the grace window (parallel tabs)', async () => {
    const { service } = makeService();
    const { refreshToken: t0 } = await service.create(
      'user-1',
      meta,
      'password',
    );
    await service.rotate(t0, meta);
    await expect(service.rotate(t0, meta)).resolves.toBeDefined();
  });

  it('rejects tokens of revoked or expired sessions and forged tokens', async () => {
    const { service, repo } = makeService();
    const a = await service.create('user-1', meta, 'password');
    await service.revoke(a.session.id, 'logout');
    await expect(service.rotate(a.refreshToken, meta)).rejects.toThrow(
      UnauthorizedException,
    );

    const b = await service.create('user-1', meta, 'password');
    repo.rows.get(b.session.id)!.expiresAt = new Date(Date.now() - 1000);
    await expect(service.rotate(b.refreshToken, meta)).rejects.toThrow(
      UnauthorizedException,
    );

    const forged = await new JwtService({}).signAsync(
      { sub: 'user-1', sid: b.session.id, typ: 'refresh', jti: 'x' },
      { secret: 'wrong-secret' },
    );
    await expect(service.rotate(forged, meta)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('revokeAll can keep the current device', async () => {
    const { service } = makeService();
    const keep = await service.create('user-1', meta, 'password');
    const other = await service.create('user-1', meta, 'password');

    await service.revokeAll('user-1', 'password_change', keep.session.id);

    const active = await service.listActive('user-1');
    expect(active.map((s) => s.id)).toEqual([keep.session.id]);
    await expect(service.rotate(other.refreshToken, meta)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("revokeOwn refuses another user's session", async () => {
    const { service } = makeService();
    const s = await service.create('user-1', meta, 'password');
    await expect(
      service.revokeOwn('user-2', s.session.id, 'user'),
    ).resolves.toBe(false);
    await expect(
      service.revokeOwn('user-1', s.session.id, 'user'),
    ).resolves.toBe(true);
  });
});
