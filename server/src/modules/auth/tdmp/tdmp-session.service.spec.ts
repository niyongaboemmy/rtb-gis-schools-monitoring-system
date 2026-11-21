import { UnauthorizedException } from '@nestjs/common';
import { TdmpSessionService } from './tdmp-session.service';
import {
  TdmpRequestError,
  TdmpUnavailableError,
} from '../../tdmp/tdmp-api.client';
import { TdmpSignInRefused } from './tdmp-identity';

const MINUTE = 60_000;

function setup(
  over: {
    checkedMinutesAgo?: number;
    graceMinutes?: number;
    accessSource?: 'local' | 'tdmp';
  } = {},
) {
  const sessions = { update: jest.fn() };
  const oauth = {
    refresh: jest.fn().mockResolvedValue({
      access_token: 'at-2',
      refresh_token: 'rt-2',
    }),
    userinfo: jest.fn().mockResolvedValue({
      sub: '7',
      email: 'Jean@RTB.gov.rw',
      email_verified: true,
      given_name: 'Jean',
      family_name: 'Uwimana',
    }),
    accessScope: jest.fn().mockResolvedValue({
      userId: 7,
      email: 'Jean@RTB.gov.rw',
      roleNames: ['school_admin'],
      accessScope: { kind: 'school' },
    }),
  };
  const fresh = { id: 'u1', email: 'jean@rtb.gov.rw' };
  const identity = { resync: jest.fn().mockResolvedValue(fresh) };
  const audit = { record: jest.fn() };
  const service = new TdmpSessionService(
    sessions as never,
    {
      recheckMs: 15 * MINUTE,
      offlineGraceMs: (over.graceMinutes ?? 240) * MINUTE,
      loginEnabled: true,
      accessSource: over.accessSource ?? 'local',
    } as never,
    oauth as never,
    identity as never,
    audit as never,
    { get: () => 'refresh-secret-for-tests' } as never,
  );
  const session = {
    id: 's1',
    method: 'tdmp',
    externalRefreshTokenEnc: service.encrypt('rt-1'),
    externalCheckedAt: new Date(
      Date.now() - (over.checkedMinutesAgo ?? 30) * MINUTE,
    ),
  };
  const user = {
    id: 'u1',
    email: 'jean@rtb.gov.rw',
    tdmpUserId: '7',
    isActive: true,
  };
  return { service, sessions, oauth, identity, audit, session, user, fresh };
}

describe('TdmpSessionService.recheck', () => {
  it('ignores sessions that did not come from TDMP', async () => {
    const { service, oauth, session, user } = setup();
    await expect(
      service.recheck(
        { ...session, method: 'password' } as never,
        user as never,
      ),
    ).resolves.toBeNull();
    expect(oauth.refresh).not.toHaveBeenCalled();
  });

  it('does not call TDMP again before the re-check interval', async () => {
    const { service, oauth, session, user } = setup({ checkedMinutesAgo: 5 });
    await expect(
      service.recheck(session as never, user as never),
    ).resolves.toBeNull();
    expect(oauth.refresh).not.toHaveBeenCalled();
  });

  it('refreshes with TDMP, re-applies the user and stores the new token', async () => {
    const { service, oauth, identity, sessions, session, user, fresh } =
      setup();
    const before = session.externalRefreshTokenEnc;
    await expect(
      service.recheck(session as never, user as never),
    ).resolves.toBe(fresh);
    expect(oauth.refresh).toHaveBeenCalledWith('rt-1');
    expect(identity.resync).toHaveBeenCalledWith(
      user,
      expect.objectContaining({ tdmpUserId: '7', email: 'jean@rtb.gov.rw' }),
    );
    const update = sessions.update.mock.calls[0][1];
    expect(update.externalCheckedAt).toBeInstanceOf(Date);
    expect(update.externalRefreshTokenEnc).not.toBe(before);
  });

  it('ends our session when TDMP rejects the refresh token', async () => {
    const { service, oauth, sessions, audit, session, user } = setup();
    oauth.refresh.mockRejectedValue(
      new TdmpRequestError(400, { error: 'invalid_grant' }, '/oauth/token'),
    );
    await expect(
      service.recheck(session as never, user as never),
    ).rejects.toThrow(UnauthorizedException);
    expect(sessions.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 's1' }),
      expect.objectContaining({ revokedReason: 'tdmp_revoked' }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.tdmp_session_ended' }),
    );
  });

  it('ends the session when TDMP no longer grants access', async () => {
    const { service, identity, sessions, session, user } = setup();
    identity.resync.mockRejectedValue(
      new TdmpSignInRefused('not_allowed', 'deny'),
    );
    await expect(
      service.recheck(session as never, user as never),
    ).rejects.toThrow(UnauthorizedException);
    expect(sessions.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ revokedReason: 'tdmp_not_allowed' }),
    );
  });

  it('tolerates TDMP being down within the grace period, not after', async () => {
    const within = setup({ checkedMinutesAgo: 60, graceMinutes: 240 });
    within.oauth.refresh.mockRejectedValue(new TdmpUnavailableError('down'));
    await expect(
      within.service.recheck(within.session as never, within.user as never),
    ).resolves.toBeNull();

    const beyond = setup({ checkedMinutesAgo: 300, graceMinutes: 240 });
    beyond.oauth.refresh.mockRejectedValue(new TdmpUnavailableError('down'));
    await expect(
      beyond.service.recheck(beyond.session as never, beyond.user as never),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('shares one TDMP call between parallel refreshes', async () => {
    const { service, oauth, session, user } = setup();
    await Promise.all([
      service.recheck(session as never, user as never),
      service.recheck(session as never, user as never),
    ]);
    expect(oauth.refresh).toHaveBeenCalledTimes(1);
  });

  it('saves the rotated TDMP token even when the profile then fails', async () => {
    const { service, oauth, sessions, session, user } = setup();
    oauth.userinfo.mockRejectedValue(new TdmpUnavailableError('down'));
    await expect(
      service.recheck(session as never, user as never),
    ).resolves.toBeNull();
    const [id, saved] = sessions.update.mock.calls[0];
    expect(id).toBe('s1');
    expect(saved.externalRefreshTokenEnc).not.toBe(
      setup().session.externalRefreshTokenEnc,
    );

    // The next re-check presents the NEW token: TDMP treats a reused one as
    // stolen and cancels all of the user's tokens.
    session.externalCheckedAt = new Date(Date.now() - 30 * MINUTE);
    await service.recheck(session as never, user as never);
    expect(oauth.refresh).toHaveBeenLastCalledWith('rt-2');
  });

  it('takes name and email from the TDMP profile (no access-scope call)', async () => {
    const { service, oauth, identity, session, user } = setup();
    await service.recheck(session as never, user as never);
    expect(oauth.accessScope).not.toHaveBeenCalled();
    expect(identity.resync).toHaveBeenCalledWith(user, {
      tdmpUserId: '7',
      email: 'jean@rtb.gov.rw',
      emailVerified: true,
      name: null,
      givenName: 'Jean',
      familyName: 'Uwimana',
    });
  });

  it('reads role and area from TDMP only when it is their source', async () => {
    const { service, oauth, identity, session, user } = setup({
      accessSource: 'tdmp',
    });
    await service.recheck(session as never, user as never);
    expect(oauth.accessScope).toHaveBeenCalledWith('at-2');
    expect(identity.resync).toHaveBeenCalledWith(
      user,
      expect.objectContaining({ scope: expect.anything() }),
    );
  });

  it('ends the session if the TDMP profile belongs to someone else', async () => {
    const { service, oauth, sessions, session, user } = setup();
    oauth.userinfo.mockResolvedValue({ sub: '99' });
    await expect(
      service.recheck(session as never, user as never),
    ).rejects.toThrow(UnauthorizedException);
    expect(sessions.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ revokedReason: 'tdmp_not_allowed' }),
    );
  });
});
