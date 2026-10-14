import { AuditAlertService } from './audit-alert.service';
import type { AuditLog } from './entities/audit-log.entity';

const row = (over: Partial<AuditLog>): AuditLog =>
  ({
    id: 'r',
    createdAt: new Date(),
    action: 'x',
    outcome: 'success',
    targetType: 'user',
    actorEmail: 'a@rtb.gov.rw',
    meta: null,
    changes: null,
    ...over,
  }) as AuditLog;

function setup(emails = 'sec@rtb.gov.rw, ciso@rtb.gov.rw') {
  const mail = { send: jest.fn().mockResolvedValue(undefined) };
  const config = {
    get: jest.fn((k: string) =>
      k === 'SECURITY_ALERT_EMAILS' ? emails : undefined,
    ),
  };
  return { svc: new AuditAlertService(config as any, mail as any), mail };
}

describe('AuditAlertService', () => {
  it('alerts on the 5th failed login for one email within 15 minutes', () => {
    const { svc, mail } = setup();
    const t0 = 1_000_000;
    const failed = row({
      action: 'auth.login_failed',
      outcome: 'failure',
      meta: { email: 'v@rtb.gov.rw' },
    });
    for (let i = 0; i < 4; i += 1)
      expect(svc.evaluate(failed, t0 + i * 1000)).toBeNull();
    expect(svc.evaluate(failed, t0 + 5000)).toBe('repeated_login_failures');
    expect(mail.send).toHaveBeenCalledTimes(1);
    expect(mail.send.mock.calls[0][0].to).toBe(
      'sec@rtb.gov.rw,ciso@rtb.gov.rw',
    );
  });

  it('does not count failures older than 15 minutes', () => {
    const { svc } = setup();
    const failed = row({
      action: 'auth.login_failed',
      meta: { email: 'v@x.y' },
    });
    for (let i = 0; i < 4; i += 1) svc.evaluate(failed, i);
    expect(svc.evaluate(failed, 16 * 60 * 1000)).toBeNull();
  });

  it('classifies lockouts, 2FA resets, role and permission changes, bulk deletes', () => {
    const { svc } = setup('');
    expect(svc.classify(row({ action: 'auth.account_locked' }))).toBe(
      'account_locked',
    );
    expect(svc.classify(row({ action: 'auth.2fa_reset' }))).toBe('2fa_reset');
    expect(svc.classify(row({ action: 'auth.mfa_reset' }))).toBe('2fa_reset');
    expect(svc.classify(row({ action: 'role.update' }))).toBe('role_change');
    expect(
      svc.classify(row({ action: 'role.update', outcome: 'denied' })),
    ).toBeNull();
    expect(
      svc.classify(
        row({ action: 'user.update', changes: { roleId: ['a', 'b'] } }),
      ),
    ).toBe('user_permission_change');
    expect(
      svc.classify(
        row({ action: 'user.update', changes: { phone: ['1', '2'] } }),
      ),
    ).toBeNull();
    expect(svc.classify(row({ action: 'school.bulk_delete' }))).toBe(
      'bulk_delete',
    );
    expect(
      svc.classify(row({ action: 'report.delete', meta: { deleted: 25 } })),
    ).toBe('bulk_delete');
    expect(svc.classify(row({ action: 'school.update' }))).toBeNull();
  });

  it('throttles to one email per alert type per 10 minutes', () => {
    const { svc, mail } = setup();
    svc.evaluate(row({ action: 'role.create' }), 0);
    svc.evaluate(row({ action: 'role.delete' }), 60_000);
    svc.evaluate(row({ action: 'auth.account_locked' }), 60_000);
    svc.evaluate(row({ action: 'role.update' }), 11 * 60_000);
    expect(mail.send).toHaveBeenCalledTimes(3);
  });

  it('fails soft when mail throws or no recipients are configured', async () => {
    const { svc, mail } = setup();
    mail.send.mockRejectedValueOnce(new Error('SMTP down'));
    expect(() => svc.evaluate(row({ action: 'auth.2fa_reset' }))).not.toThrow();
    await new Promise((r) => setImmediate(r));

    const none = setup('');
    none.svc.evaluate(row({ action: 'auth.2fa_reset' }));
    expect(none.mail.send).not.toHaveBeenCalled();
  });
});
