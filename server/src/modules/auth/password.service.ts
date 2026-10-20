import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../users/entities/user.entity';
import {
  checkPasswordPolicy,
  describePasswordFailures,
  isPasswordReused,
  pushPasswordHistory,
  PASSWORD_HISTORY_SIZE,
} from '../../common/security/password-policy';

const BCRYPT_COST = 12;

/**
 * Applies the password policy (WS10.1) and writes new passwords. All password
 * changes — self-service, reset, admin — go through `setPassword`, so the
 * history and `mustChangePassword` bookkeeping lives in one place.
 */
@Injectable()
export class PasswordService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /** Throws 400 with a readable message when `password` breaks the static rules. */
  assertPolicy(password: string, email?: string | null) {
    const failures = checkPasswordPolicy(password, { email });
    if (failures.length)
      throw new BadRequestException(describePasswordFailures(failures));
  }

  /**
   * Validates against policy + history and stores the new bcrypt hash.
   * `repository.update` bypasses the entity's hashing hook on purpose: the
   * value written is already a hash.
   */
  async setPassword(
    userId: string,
    newPassword: string,
    options: { mustChangePassword?: boolean } = {},
  ) {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .addSelect('user.passwordHistory')
      .where('user.id = :userId', { userId })
      .getOne();
    if (!user) throw new NotFoundException('User not found');

    this.assertPolicy(newPassword, user.email);

    const recent = [user.password, ...(user.passwordHistory ?? [])].slice(
      0,
      PASSWORD_HISTORY_SIZE,
    );
    if (await isPasswordReused(newPassword, recent))
      throw new BadRequestException(
        `Choose a password you have not used before (your last ${PASSWORD_HISTORY_SIZE} cannot be reused).`,
      );

    const hash = await bcrypt.hash(newPassword, BCRYPT_COST);
    await this.userRepository.update(userId, {
      password: hash,
      passwordHistory: pushPasswordHistory(user.passwordHistory, user.password),
      passwordChangedAt: new Date(),
      mustChangePassword: options.mustChangePassword ?? false,
      failedLoginCount: 0,
      lockedUntil: null,
    });
    return user;
  }

  /** Compares against the stored hash. */
  async verifyCurrent(userId: string, password: string): Promise<boolean> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :userId', { userId })
      .getOne();
    if (!user?.password) return false;
    return bcrypt.compare(password ?? '', user.password);
  }
}
