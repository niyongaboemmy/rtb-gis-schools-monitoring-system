import { ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';

function makeService() {
  const userRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((d) => ({ id: 'new-id', ...d })),
    save: jest.fn(async (u) => u),
    find: jest.fn(),
    update: jest.fn(),
  };
  const roleRepo = {
    findOne: jest.fn().mockResolvedValue({ id: 'r1', name: 'viewer' }),
  };
  const audit = { record: jest.fn() };
  const auth = {
    publicUser: jest.fn((u) => {
      const { password: _p, ...rest } = u;
      return rest;
    }),
    sendAdminReset: jest.fn().mockResolvedValue({}),
    changePassword: jest.fn(),
  };
  const sessions = { revokeAll: jest.fn() };
  const passwords = { assertPolicy: jest.fn() };
  const service = new UsersService(
    userRepo as never,
    roleRepo as never,
    audit as never,
    auth as never,
    sessions as never,
    passwords as never,
  );
  return { service, userRepo, audit, auth, sessions, passwords };
}

const actor = { id: 'admin-1', email: 'admin@rtb.gov.rw' };

describe('UsersService.create', () => {
  it('flags admin-created accounts for a forced password change and hides the hash', async () => {
    const { service, userRepo } = makeService();
    const result = await service.create(
      {
        firstName: 'A',
        lastName: 'B',
        email: 'New@RTB.gov.rw',
        password: 'Strong-Pass-2026',
      },
      actor,
    );
    expect(userRepo.create.mock.calls[0][0]).toMatchObject({
      email: 'new@rtb.gov.rw',
      mustChangePassword: true,
    });
    expect(result).not.toHaveProperty('password');
  });

  it('without a password, emails the user a set-password code', async () => {
    const { service, auth } = makeService();
    const result = await service.create(
      { firstName: 'A', lastName: 'B', email: 'n@rtb.gov.rw' },
      actor,
    );
    expect(auth.sendAdminReset).toHaveBeenCalledWith('new-id', actor, {});
    expect(result.inviteSent).toBe(true);
  });

  it('refuses a duplicate email', async () => {
    const { service, userRepo } = makeService();
    userRepo.findOne.mockResolvedValue({ id: 'x' });
    await expect(
      service.create(
        { firstName: 'A', lastName: 'B', email: 'n@rtb.gov.rw' },
        actor,
      ),
    ).rejects.toThrow(ConflictException);
  });
});

describe('UsersService.bulkCreate', () => {
  it('applies the password policy per row and flags imported accounts', async () => {
    const { service, userRepo, audit } = makeService();
    const result = await service.bulkCreate(
      [
        {
          firstName: 'Ok',
          lastName: 'User',
          email: 'ok@rtb.gov.rw',
          password: 'Strong-Pass-2026',
        },
        {
          firstName: 'Weak',
          lastName: 'User',
          email: 'weak@rtb.gov.rw',
          password: 'password',
        },
        {
          firstName: 'Bad',
          lastName: 'Mail',
          email: 'not-an-email',
          password: 'Strong-Pass-2026',
        },
      ],
      actor,
    );
    expect(result.created).toBe(1);
    expect(result.errors.map((e) => e.row)).toEqual([3, 4]);
    expect(result.errors[0].reason).toMatch(/^Password must/);
    expect(userRepo.create.mock.calls[0][0]).toMatchObject({
      mustChangePassword: true,
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user.bulk_import' }),
    );
  });
});

describe('UsersService.update', () => {
  it('audits a role change and signs the user out everywhere', async () => {
    const { service, userRepo, audit, sessions } = makeService();
    userRepo.findOne.mockResolvedValueOnce({
      id: 'u1',
      email: 'u@rtb.gov.rw',
      role: { id: 'r-old', name: 'viewer' },
    });
    await service.update('u1', { roleId: 'r-new' }, actor);
    expect(sessions.revokeAll).toHaveBeenCalledWith('u1', 'role_change');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user.role_change' }),
    );
  });
});
