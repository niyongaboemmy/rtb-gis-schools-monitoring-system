import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../roles/entities/role.entity';
import { School } from '../../schools/entities/school.entity';
import { TdmpConfig } from '../../tdmp/tdmp.config';
import type { TdmpAccessScope } from '../../tdmp/tdmp.types';
import { randomToken } from '../../../common/security/crypto';
import {
  pickRole,
  placementFromScope,
  splitName,
  TdmpSignInRefused,
} from './tdmp-identity';

/**
 * Who TDMP says signed in: the profile (`/oauth/userinfo`) or the verified ID
 * token. TDMP sign-in carries no role or area (SSO guide §8); `scope` is only
 * set when TDMP_ACCESS_SOURCE=tdmp.
 */
export interface TdmpIdentity {
  tdmpUserId: string;
  email: string | null;
  emailVerified: boolean;
  name?: string | null;
  givenName?: string | null;
  familyName?: string | null;
  scope?: TdmpAccessScope | null;
}

/**
 * Where a pending user sits: the school tier with no school, so every
 * scoped query matches nothing even before JwtStrategy refuses the request.
 */
export const PENDING_LOCATION: User['location'] = { tier: 'school' };

/**
 * Keeps the local copy of a TDMP user. Accounts are linked by TDMP's `sub`;
 * an existing RTB GIS account (or one an admin pre-registered) is matched by
 * verified email once. Name and email follow TDMP; role and area are set
 * here (TDMP_ACCESS_SOURCE=local) or taken from TDMP (`tdmp`).
 */
@Injectable()
export class TdmpIdentityService {
  private readonly logger = new Logger(TdmpIdentityService.name);

  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Role)
    private readonly roles: Repository<Role>,
    @InjectRepository(School)
    private readonly schools: Repository<School>,
    private readonly config: TdmpConfig,
  ) {}

  /**
   * Finds or creates the local user for a TDMP sign-in. `requested` = a new
   * account that now waits for an administrator.
   */
  async signIn(
    identity: TdmpIdentity,
  ): Promise<{ user: User; requested: boolean }> {
    let user = await this.users.findOne({
      where: { tdmpUserId: identity.tdmpUserId },
    });

    if (!user && identity.email) {
      const byEmail = await this.users.findOne({
        where: { email: identity.email },
      });
      if (byEmail) {
        // An existing account is only taken over on a verified address.
        if (!identity.emailVerified)
          throw new TdmpSignInRefused(
            'not_allowed',
            'TDMP email is not verified; it matches an existing account',
          );
        if (byEmail.tdmpUserId && byEmail.tdmpUserId !== identity.tdmpUserId)
          throw new TdmpSignInRefused(
            'not_allowed',
            'Email belongs to another TDMP account',
          );
        if (byEmail.authSource === 'partner')
          throw new TdmpSignInRefused(
            'not_allowed',
            'Email belongs to a partner account',
          );
        user = byEmail;
      }
    }

    if (user && !user.isActive)
      throw new TdmpSignInRefused('inactive', 'Account is deactivated here');

    const isNew = !user;
    user ??= this.users.create({
      // Never used: TDMP users have no password here.
      password: randomToken(48),
      mustChangePassword: false,
      isActive: true,
    });

    const saved = await this.apply(user, identity, isNew);
    return { user: saved, requested: isNew && saved.accessPending };
  }

  /** Re-applies TDMP's current view of an existing user (session re-check). */
  async resync(user: User, identity: TdmpIdentity): Promise<User> {
    if (!user.isActive)
      throw new TdmpSignInRefused('inactive', 'Account is deactivated here');
    return this.apply(user, identity, false);
  }

  private async apply(
    user: User,
    identity: TdmpIdentity,
    isNew: boolean,
  ): Promise<User> {
    if (this.config.accessSource === 'tdmp')
      await this.applyTdmpAccess(user, identity);
    else if (isNew) await this.applyNewLocalAccess(user);

    await this.applyProfile(user, identity);
    user.authSource = 'tdmp';
    user.tdmpUserId = identity.tdmpUserId;

    const saved = await this.users.save(user);
    return this.users.findOneOrFail({
      where: { id: saved.id },
      relations: ['role', 'role.accessLevel'],
    });
  }

  /**
   * TDMP_ACCESS_SOURCE=local, first sign-in of someone nobody pre-registered:
   * TDMP_DEFAULT_ROLE when set, otherwise the waiting list.
   */
  private async applyNewLocalAccess(user: User) {
    const role = this.config.defaultRoleName
      ? await this.roles.findOne({
          where: { name: this.config.defaultRoleName },
        })
      : null;
    if (this.config.defaultRoleName && !role)
      this.logger.warn(
        `TDMP_DEFAULT_ROLE "${this.config.defaultRoleName}" does not exist; new TDMP users wait for access`,
      );
    if (role) {
      user.role = role;
      user.accessPending = false;
      user.location = null as unknown as User['location'];
    } else {
      user.role = null as unknown as Role;
      user.accessPending = true;
      user.location = { ...PENDING_LOCATION };
    }
  }

  /** TDMP_ACCESS_SOURCE=tdmp: role from the mapping, area from TDMP's scope. */
  private async applyTdmpAccess(user: User, identity: TdmpIdentity) {
    const scope = identity.scope;
    if (!scope)
      throw new TdmpSignInRefused('not_allowed', 'TDMP sent no access scope');
    const placement = placementFromScope(scope);
    if (!placement)
      throw new TdmpSignInRefused(
        'not_allowed',
        `TDMP scope "${scope.accessScope?.kind ?? '?'}" gives no access`,
      );

    const roles = await this.roles.find({ relations: ['accessLevel'] });
    const roleNames = scope.roleNames ?? [];
    const role = pickRole(roleNames, roles, this.config.defaultRoleName);
    if (!role)
      throw new TdmpSignInRefused(
        'not_allowed',
        `No RTB GIS role is mapped to TDMP roles [${roleNames.join(', ')}]`,
      );

    let schoolId: string | undefined;
    if (placement.schoolCode) {
      const school = await this.schools.findOne({
        where: [
          { tdmpSchoolCode: placement.schoolCode },
          { code: placement.schoolCode },
        ],
        select: ['id', 'name', 'province', 'district'],
      });
      schoolId = school?.id;
      if (!school)
        this.logger.warn(
          `TDMP user ${identity.tdmpUserId}: anchor school ${placement.schoolCode} is not in RTB GIS yet`,
        );
      placement.province ??= school?.province;
      placement.district ??= school?.district;
      placement.schoolName ??= school?.name;
    }

    user.role = role;
    user.accessPending = false;
    user.location = {
      tier: placement.tier,
      province: placement.province,
      district: placement.district,
      schoolId,
      schoolName: placement.schoolName,
    };
    identity.name ??= scope.teacher?.names ?? null;
  }

  /** Name and email follow TDMP; values TDMP leaves out keep ours. */
  private async applyProfile(user: User, identity: TdmpIdentity) {
    const email = identity.email;
    if (email && email !== user.email) {
      const clash = user.id
        ? await this.users.findOne({ where: { email, id: Not(user.id) } })
        : await this.users.findOne({ where: { email } });
      if (clash)
        this.logger.warn(
          `TDMP email for user ${identity.tdmpUserId} is used by another account; keeping the old email`,
        );
      else user.email = email;
    }
    user.email ??= `tdmp-${identity.tdmpUserId}@users.tdmp.invalid`;

    const split = splitName(identity.name, user.email.split('@')[0]);
    const given = identity.givenName?.trim() || null;
    const family = identity.familyName?.trim() || null;
    if (given || identity.name) user.firstName = given ?? split.firstName;
    if (family || identity.name) user.lastName = family ?? split.lastName;
    user.firstName ||= split.firstName;
    user.lastName ??= '';
  }
}
