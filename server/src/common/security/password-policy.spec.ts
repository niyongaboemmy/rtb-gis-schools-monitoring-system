import { validate } from 'class-validator';
import * as bcrypt from 'bcryptjs';
import {
  IsStrongPassword,
  PASSWORD_HISTORY_SIZE,
  checkPasswordPolicy,
  describePasswordFailures,
  isPasswordReused,
  pushPasswordHistory,
} from './password-policy';

describe('checkPasswordPolicy', () => {
  it('accepts a password meeting every rule', () => {
    expect(checkPasswordPolicy('Kigali-Rwanda2026')).toEqual([]);
  });

  it.each([
    ['Sh0rt!pw', 'length'],
    ['alllowercase-2026', 'upper'],
    ['ALLUPPERCASE-2026', 'lower'],
    ['No-Digits-Here!!', 'digit'],
    ['NoSymbolsHere2026', 'symbol'],
  ])('rejects %p for %s', (pw, rule) => {
    expect(checkPasswordPolicy(pw)).toContain(rule);
  });

  it('rejects a password containing the email or its name part', () => {
    expect(
      checkPasswordPolicy('Alice.Mugisha#2026', {
        email: 'alice.mugisha@rtb.gov.rw',
      }),
    ).toContain('email');
    expect(
      checkPasswordPolicy('x-alice@rtb.gov.rw-X1', {
        email: 'alice@rtb.gov.rw',
      }),
    ).toContain('email');
    // Case-insensitive.
    expect(
      checkPasswordPolicy('ALICE-strong-2026', { email: 'alice@rtb.gov.rw' }),
    ).toContain('email');
  });

  it('ignores very short email local parts', () => {
    expect(
      checkPasswordPolicy('Strong-Pass-2026', { email: 'jo@rtb.gov.rw' }),
    ).toEqual([]);
  });

  it('describes failures in one sentence', () => {
    expect(describePasswordFailures(['upper', 'digit'])).toBe(
      'Password must contain an uppercase letter, contain a number.',
    );
  });
});

describe('password history', () => {
  it('keeps only the last 5, newest first', () => {
    const history = pushPasswordHistory(['h4', 'h3', 'h2', 'h1', 'h0'], 'h5');
    expect(history).toEqual(['h5', 'h4', 'h3', 'h2', 'h1']);
    expect(history).toHaveLength(PASSWORD_HISTORY_SIZE);
  });

  it('detects reuse against stored bcrypt hashes', async () => {
    const hashes = [await bcrypt.hash('Old-Pass-2025!', 4), null];
    await expect(isPasswordReused('Old-Pass-2025!', hashes)).resolves.toBe(
      true,
    );
    await expect(isPasswordReused('New-Pass-2026!', hashes)).resolves.toBe(
      false,
    );
  });
});

describe('@IsStrongPassword', () => {
  class Dto {
    email = 'grace@rtb.gov.rw';
    @IsStrongPassword({ emailField: 'email' })
    password: string;
  }

  it('passes a strong password', async () => {
    const dto = Object.assign(new Dto(), { password: 'Volcano-Peak-77' });
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('fails with a readable message, including the email rule', async () => {
    const dto = Object.assign(new Dto(), { password: 'grace' });
    const [error] = await validate(dto);
    expect(error.constraints?.isStrongPassword).toMatch(/^Password must be 10/);
    expect(error.constraints?.isStrongPassword).toMatch(/email address/);
  });

  it('fails a non-string', async () => {
    const dto = Object.assign(new Dto(), {
      password: 12345 as unknown as string,
    });
    await expect(validate(dto)).resolves.toHaveLength(1);
  });
});
