import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

/** Who TDMP says signed in. */
export interface TdmpIdentity {
  tdmpUserId: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  scope: TdmpAccessScope;
}

/**
 * Keeps the local copy of a TDMP user: created on first sign-in, and its
 * name, email, role and geographic placement refreshed from TDMP on every
 * sign-in and session re-check. Local data (reports, audit history, viewer
 * preferences) stays attached to the same row.
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

  /** Finds or creates the local user for a TDMP sign-in. */
  async signIn(identity: TdmpIdentity): Promise<User> {
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
        user = byEmail;
      }
    }

    if (user && !user.isActive)
      throw new TdmpSignInRefused('inactive', 'Account is deactivated here');

    if (!user)
      user = this.users.create({
        // Never used: TDMP users have no password here.
        password: randomToken(48),
        mustChangePassword: false,
        isActive: true,
      });

    return this.apply(user, identity);
  }

  /** Re-applies TDMP's current view of an existing user (session re-check). */
  async resync(user: User, identity: TdmpIdentity): Promise<User> {
    if (!user.isActive)
      throw new TdmpSignInRefused('inactive', 'Account is deactivated here');
    return this.apply(user, identity);
  }

  private async apply(user: User, identity: TdmpIdentity): Promise<User> {
    const placement = placementFromScope(identity.scope);
    if (!placement)
      throw new TdmpSignInRefused(
        'not_allowed',
        `TDMP scope "${identity.scope.accessScope?.kind ?? '?'}" gives no access`,
      );

    const roles = await this.roles.find({ relations: ['accessLevel'] });
    const roleNames = identity.scope.roleNames ?? [];
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

    const email =
      identity.email ??
      user.email ??
      `tdmp-${identity.tdmpUserId}@users.tdmp.invalid`;
    const name = splitName(
      identity.name ?? identity.scope.teacher?.names,
      email.split('@')[0],
    );

    Object.assign(user, {
      email,
      firstName:
        identity.name || !user.firstName ? name.firstName : user.firstName,
      lastName: identity.name || !user.lastName ? name.lastName : user.lastName,
      role,
      location: {
        tier: placement.tier,
        province: placement.province,
        district: placement.district,
        schoolId,
        schoolName: placement.schoolName,
      },
      authSource: 'tdmp' as const,
      tdmpUserId: identity.tdmpUserId,
    });
    const saved = await this.users.save(user);
    return this.users.findOneOrFail({
      where: { id: saved.id },
      relations: ['role', 'role.accessLevel'],
    });
  }
}
