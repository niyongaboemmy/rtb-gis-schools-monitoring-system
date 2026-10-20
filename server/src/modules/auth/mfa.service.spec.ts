import * as bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { BadRequestException } from '@nestjs/common';
import { MfaService, normaliseRecoveryCode } from './mfa.service';
import type { User } from '../users/entities/user.entity';

/** One user row held in memory; update() merges like the real repository. */
function makeRepo(initial: Partial<User>) {
  const row = { ...initial } as User;
  const qb = {
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn(async () => ({ ...row })),
  };
  return {
    row,
    findOne: jest.fn(async () => ({ ...row })),
    update: jest.fn(async (_id: string, patch: Partial<User>) => {
      Object.assign(row, patch);
      return { affected: 1 };
    }),
    createQueryBuilder: jest.fn(() => qb),
  };
}

function makeService(
  user: Partial<User> = {},
  env: Record<string, string> = {},
) {
  const repo = makeRepo({
    id: 'u1',
    email: 'alice@rtb.gov.rw',
    firstName: 'Alice',
    totpEnabled: false,
    role: { permissions: [] } as never,
    ...user,
  });
  const config = {
    get: (k: string) => ({ JWT_SECRET: 'jwt-secret-for-tests', ...env })[k],
  };
  const mail = {
    sendLoginCode: jest.fn().mockResolvedValue(undefined),
    isConfigured: true,
  };
  const service = new MfaService(repo as never, config as never, mail as never);
  service.onModuleInit();
  return { service, repo, mail };
}

const codeFor = (secret: string, offsetSteps = 0) =>
  authenticator
    .clone({ epoch: Date.now() + offsetSteps * 30_000 })
    .generate(secret);

async function enrol(service: MfaService, repo: ReturnType<typeof makeRepo>) {
  const { secret } = await service.startEnrolment('u1');
  const { recoveryCodes } = await service.confirmEnrolment(
    'u1',
    codeFor(secret, -1),
  );
  return { secret, recoveryCodes, repo };
}

describe('MfaService – key management', () => {
  it('refuses to boot in production without TOTP_ENCRYPTION_KEY', () => {
    expect(() => makeService({}, { NODE_ENV: 'production' })).toThrow(
      /TOTP_ENCRYPTION_KEY is required/,
    );
  });

  it('refuses a malformed key', () => {
    expect(() => makeService({}, { TOTP_ENCRYPTION_KEY: 'short' })).toThrow(
      /32 bytes/,
    );
  });

  it('stores the secret encrypted, never in clear', async () => {
    const { service, repo } = makeService(
      {},
      { TOTP_ENCRYPTION_KEY: 'a'.repeat(64) },
    );
    const { secret } = await service.startEnrolment('u1');
    expect(repo.row.totpPendingSecretEnc).toMatch(/^k1:/);
    expect(repo.row.totpPendingSecretEnc).not.toContain(secret);
    expect(service.decrypt(repo.row.totpPendingSecretEnc!)).toBe(secret);
  });
});

describe('MfaService – enrolment', () => {
  it('returns an otpauth URI and a QR data URL', async () => {
    const { service } = makeService();
    const res = await service.startEnrolment('u1');
    expect(res.otpauthUrl).toMatch(
      /^otpauth:\/\/totp\/RTB%20GIS:alice%40rtb\.gov\.rw\?secret=/,
    );
    expect(res.qrDataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('enables 2FA only after a correct code and issues 10 hashed recovery codes', async () => {
    const { service, repo } = makeService();
    const { secret } = await service.startEnrolment('u1');
    await expect(service.confirmEnrolment('u1', '000000')).rejects.toThrow(
      BadRequestException,
    );
    expect(repo.row.totpEnabled).toBe(false);

    const { recoveryCodes } = await service.confirmEnrolment(
      'u1',
      codeFor(secret),
    );
    expect(repo.row.totpEnabled).toBe(true);
    expect(repo.row.totpPendingSecretEnc).toBeNull();
    expect(recoveryCodes).toHaveLength(10);
    expect(new Set(recoveryCodes).size).toBe(10);
    for (const code of recoveryCodes)
      expect(repo.row.totpRecoveryCodes).not.toContain(code);
  });
});

describe('MfaService – verification', () => {
  it('accepts the current code and ±1 step, rejects ±2 steps', async () => {
    const { service, repo } = makeService();
    const { secret } = await enrol(service, repo);
    expect(
      await service.verify('u1', { kind: 'totp', code: codeFor(secret, 1) }),
    ).toBe(true);

    const fresh = makeService();
    const e = await enrol(fresh.service, fresh.repo);
    expect(
      await fresh.service.verify('u1', {
        kind: 'totp',
        code: codeFor(e.secret, 3),
      }),
    ).toBe(false);
  });

  it('refuses to accept the same code twice (replay)', async () => {
    const { service, repo } = makeService();
    const { secret } = await enrol(service, repo);
    const code = codeFor(secret);
    expect(await service.verify('u1', { kind: 'totp', code })).toBe(true);
    expect(await service.verify('u1', { kind: 'totp', code })).toBe(false);
  });

  it('recovery codes are single-use and format-insensitive', async () => {
    const { service, repo } = makeService();
    const { recoveryCodes } = await enrol(service, repo);
    const code = recoveryCodes[0].toUpperCase().replace('-', ' ');
    expect(await service.verify('u1', { kind: 'recovery', code })).toBe(true);
    expect(await service.verify('u1', { kind: 'recovery', code })).toBe(false);
    expect(repo.row.totpRecoveryCodes).toHaveLength(9);
    expect(normaliseRecoveryCode('AbCdE-12345')).toBe('abcde12345');
  });

  it('email codes expire after 5 wrong guesses', async () => {
    const { service, mail } = makeService();
    await service.sendEmailCode({
      id: 'u1',
      email: 'alice@rtb.gov.rw',
      firstName: 'Alice',
    });
    const code = mail.sendLoginCode.mock.calls[0][2] as string;
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++)
      expect(await service.verify('u1', { kind: 'email', code: wrong })).toBe(
        false,
      );
    expect(await service.verify('u1', { kind: 'email', code })).toBe(false);
  });

  it('email codes work once', async () => {
    const { service, mail } = makeService();
    await service.sendEmailCode({
      id: 'u1',
      email: 'alice@rtb.gov.rw',
      firstName: 'Alice',
    });
    const code = mail.sendLoginCode.mock.calls[0][2] as string;
    expect(await service.verify('u1', { kind: 'email', code })).toBe(true);
    expect(await service.verify('u1', { kind: 'email', code })).toBe(false);
  });
});

describe('MfaService – disable & policy', () => {
  it('disables only with the right password and a valid code', async () => {
    const hash = await bcrypt.hash('Correct-Horse-1', 4);
    const { service, repo } = makeService({ password: hash });
    const { secret } = await enrol(service, repo);

    await expect(
      service.disable('u1', 'wrong', codeFor(secret)),
    ).rejects.toThrow(/password/);
    await expect(
      service.disable('u1', 'Correct-Horse-1', '000000'),
    ).rejects.toThrow(/code/);
    await service.disable('u1', 'Correct-Horse-1', codeFor(secret, 1));
    expect(repo.row.totpEnabled).toBe(false);
    expect(repo.row.totpSecretEnc).toBeNull();
  });

  it('requires 2FA for privileged roles only when enforcement is on', () => {
    const admin = { role: { permissions: ['MANAGE_USERS'] } } as never;
    const viewer = { role: { permissions: ['VIEW_MAP'] } } as never;
    const on = makeService({}, { MFA_ENFORCE_PRIVILEGED: 'true' }).service;
    const off = makeService().service; // non-production default
    expect(on.isRequiredFor(admin)).toBe(true);
    expect(on.isRequiredFor(viewer)).toBe(false);
    expect(off.isRequiredFor(admin)).toBe(false);
  });
});
