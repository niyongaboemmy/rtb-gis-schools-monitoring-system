import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { User } from './entities/user.entity';
import { Role } from '../roles/entities/role.entity';
import { AuditService, AuditActor } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { SessionsService } from '../auth/sessions.service';
import { PasswordService } from '../auth/password.service';
import type { RequestMeta } from '../auth/request-meta';
import {
  checkPasswordPolicy,
  describePasswordFailures,
} from '../../common/security/password-policy';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto, UpdateUserDto } from './dto/update-user.dto';

/** Fields an admin edit is allowed to change, for the audit diff. */
const AUDITED_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'isActive',
  'phone',
  'department',
] as const;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    private readonly auditService: AuditService,
    private readonly authService: AuthService,
    private readonly sessionsService: SessionsService,
    private readonly passwordService: PasswordService,
  ) {}

  async findAll() {
    return this.userRepository.find({
      select: [
        'id',
        'firstName',
        'lastName',
        'email',
        'role',
        'location',
        'isActive',
        'createdAt',
        'lastLoginAt',
        'mustChangePassword',
        'totpEnabled',
      ],
    });
  }

  async findOne(id: string) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  /**
   * Admin-created accounts must change their password at first sign-in
   * (WS10.3). Without an initial password the account gets a random one and
   * the user is emailed a code to choose their own (WS10.4).
   */
  async create(dto: CreateUserDto, actor?: AuditActor, meta: RequestMeta = {}) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.userRepository.findOne({ where: { email } });
    if (existing)
      throw new ConflictException(`User with email ${email} already exists`);

    const invite = !dto.password;
    const password = dto.password ?? this.randomPassword();
    if (!invite) this.passwordService.assertPolicy(password, email);

    const { roleId, ...rest } = dto;
    const user = this.userRepository.create({
      ...rest,
      email,
      password,
      ...(roleId ? { role: { id: roleId } as Role } : {}),
      mustChangePassword: true,
      passwordChangedAt: new Date(),
    } as Partial<User>);
    const saved = await this.userRepository.save(user);
    this.auditService.record({
      action: 'user.create',
      actor: actor ?? null,
      targetType: 'user',
      targetId: saved.id,
      targetLabel: saved.email,
      subjectUserId: saved.id,
      meta: { roleId: roleId ?? null, invite },
      request: meta,
    });

    let inviteSent = false;
    if (invite && actor) {
      try {
        await this.authService.sendAdminReset(saved.id, actor, meta);
        inviteSent = true;
      } catch (err) {
        this.logger.warn(
          `Could not email set-password code to new user ${saved.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
    return { ...this.authService.publicUser(saved), inviteSent };
  }

  /** Admin edit. Passwords cannot be set here — use send-reset. */
  async update(
    id: string,
    dto: UpdateUserDto,
    actor?: AuditActor,
    meta: RequestMeta = {},
  ) {
    const user = await this.findOne(id);
    const changes: Record<string, [unknown, unknown]> = {};
    const { roleId, email, ...rest } = dto;

    if (email !== undefined) {
      const normalised = email.trim().toLowerCase();
      if (normalised !== user.email) {
        const clash = await this.userRepository.findOne({
          where: { email: normalised },
        });
        if (clash)
          throw new ConflictException(
            `User with email ${normalised} already exists`,
          );
        changes.email = [user.email, normalised];
        user.email = normalised;
      }
    }
    for (const field of AUDITED_FIELDS) {
      if (field === 'email') continue;
      const next = (rest as Record<string, unknown>)[field];
      if (
        next !== undefined &&
        next !== (user as unknown as Record<string, unknown>)[field]
      )
        changes[field] = [
          (user as unknown as Record<string, unknown>)[field],
          next,
        ];
    }
    if (rest.location !== undefined)
      changes.location = [user.location ?? null, rest.location ?? null];
    if (roleId && roleId !== user.role?.id) {
      changes.role = [user.role?.name ?? null, roleId];
      user.role = { id: roleId } as Role;
    }

    Object.assign(user, rest);
    const saved = await this.userRepository.save(user);

    // Deactivation or a role change takes effect on every device now.
    if (rest.isActive === false || changes.role)
      await this.sessionsService.revokeAll(
        id,
        rest.isActive === false ? 'deactivated' : 'role_change',
      );

    if (Object.keys(changes).length)
      this.auditService.record({
        action: changes.role ? 'user.role_change' : 'user.update',
        actor: actor ?? null,
        targetType: 'user',
        targetId: id,
        targetLabel: saved.email,
        subjectUserId: id,
        changes,
        request: meta,
      });
    return this.authService.publicUser(saved);
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    const user = await this.findOne(id);
    Object.assign(user, dto);
    const saved = await this.userRepository.save(user);
    return this.authService.publicUser(saved);
  }

  changePassword(
    user: Pick<User, 'id' | 'email' | 'firstName'>,
    currentPass: string,
    newPass: string,
    currentSessionId?: string,
    meta: RequestMeta = {},
  ) {
    return this.authService.changePassword(
      user,
      currentPass,
      newPass,
      currentSessionId,
      meta,
    );
  }

  async deactivate(id: string, actor?: AuditActor, meta: RequestMeta = {}) {
    // load → save (not update) so the audit subscriber records the diff.
    const user = await this.findOne(id);
    user.isActive = false;
    await this.userRepository.save(user);
    await this.sessionsService.revokeAll(id, 'deactivated');
    this.auditService.record({
      action: 'user.deactivate',
      actor: actor ?? null,
      targetType: 'user',
      targetId: id,
      targetLabel: user.email,
      subjectUserId: id,
      changes: { isActive: [true, false] },
      request: meta,
    });
    return { message: 'User deactivated' };
  }

  async bulkCreate(
    rows: Record<string, unknown>[],
    actor?: AuditActor,
    meta: RequestMeta = {},
  ) {
    const results = {
      created: 0,
      skipped: 0,
      errors: [] as { row: number; email: string; reason: string }[],
    };
    const str = (v: unknown) =>
      v === undefined || v === null ? '' : String(v as string).trim();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] ?? {};
      const rowNum = i + 2; // +2 because row 1 is header
      const firstName = str(row.firstName);
      const lastName = str(row.lastName);
      const email = str(row.email).toLowerCase();
      const password =
        row.password == null ? '' : String(row.password as string);
      const roleName = str(row.roleName);

      // Basic validation
      if (!firstName || !lastName || !email || !password) {
        results.errors.push({
          row: rowNum,
          email: email || '(empty)',
          reason:
            'Missing required fields: firstName, lastName, email, password',
        });
        continue;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
        results.errors.push({
          row: rowNum,
          email,
          reason: 'Invalid email address',
        });
        continue;
      }
      if (firstName.length > 100 || lastName.length > 100) {
        results.errors.push({
          row: rowNum,
          email,
          reason: 'Name is too long (max 100 characters)',
        });
        continue;
      }
      const policy = checkPasswordPolicy(password, { email });
      if (policy.length) {
        results.errors.push({
          row: rowNum,
          email,
          reason: describePasswordFailures(policy),
        });
        continue;
      }

      // Check duplicate
      const existing = await this.userRepository.findOne({ where: { email } });
      if (existing) {
        results.skipped++;
        results.errors.push({
          row: rowNum,
          email,
          reason: 'Email already exists — skipped',
        });
        continue;
      }

      try {
        const userData: Partial<User> = {
          firstName,
          lastName,
          email,
          password,
          // Imported passwords are shared in a spreadsheet: always replace them.
          mustChangePassword: true,
          passwordChangedAt: new Date(),
        };

        // Resolve role by name
        if (roleName) {
          const role = await this.roleRepository.findOne({
            where: { name: roleName },
          });
          if (role) userData.role = { id: role.id } as Role;
        }

        // Build location from columns
        const location: User['location'] = {};
        if (str(row.province)) location.province = str(row.province);
        if (str(row.district)) location.district = str(row.district);
        if (str(row.sector)) location.sector = str(row.sector);
        if (str(row.schoolId)) location.schoolId = str(row.schoolId);
        if (Object.keys(location).length > 0) userData.location = location;

        const user = this.userRepository.create(userData);
        await this.userRepository.save(user);
        results.created++;
      } catch (err: unknown) {
        results.errors.push({
          row: rowNum,
          email,
          reason: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    this.auditService.record({
      action: 'user.bulk_import',
      actor: actor ?? null,
      targetType: 'user',
      meta: {
        rows: rows.length,
        created: results.created,
        skipped: results.skipped,
        failed: results.errors.length - results.skipped,
      },
      request: meta,
    });
    return results;
  }

  sendReset(id: string, actor: AuditActor, meta: RequestMeta = {}) {
    return this.authService.sendAdminReset(id, actor, meta);
  }

  resetMfa(id: string, actor: AuditActor, meta: RequestMeta = {}) {
    return this.authService.adminResetMfa(id, actor, meta);
  }

  /** Meets the policy; the user never sees it (they set their own). */
  private randomPassword() {
    return `${crypto.randomBytes(18).toString('base64url')}aA1!`;
  }
}
