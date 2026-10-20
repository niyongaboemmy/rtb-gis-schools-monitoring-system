import * as bcrypt from 'bcryptjs';
import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

/**
 * The one password policy (WS10.1). Used by create user, change password,
 * reset password and bulk import, and mirrored rule-for-rule by the client
 * strength meter (`client/src/components/auth/password-policy.ts`) — keep the
 * two in step.
 */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

/** How many previous passwords may not be reused. */
export const PASSWORD_HISTORY_SIZE = 5;

export type PasswordRule =
  | 'length'
  | 'upper'
  | 'lower'
  | 'digit'
  | 'symbol'
  | 'email';

const RULE_MESSAGES: Record<PasswordRule, string> = {
  length: `be ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters long`,
  upper: 'contain an uppercase letter',
  lower: 'contain a lowercase letter',
  digit: 'contain a number',
  symbol: 'contain a symbol (e.g. ! @ # $ %)',
  email: 'not contain your email address or its name part',
};

/**
 * Returns the rules a password breaks, or an empty array when it passes.
 * `email` is optional because some callers (the DTO) only know it from a
 * sibling field; the service always re-checks with the account's email.
 */
export function checkPasswordPolicy(
  password: string,
  context: { email?: string | null } = {},
): PasswordRule[] {
  const failures: PasswordRule[] = [];
  const value = typeof password === 'string' ? password : '';

  if (value.length < PASSWORD_MIN_LENGTH || value.length > PASSWORD_MAX_LENGTH)
    failures.push('length');
  if (!/[A-Z]/.test(value)) failures.push('upper');
  if (!/[a-z]/.test(value)) failures.push('lower');
  if (!/\d/.test(value)) failures.push('digit');
  if (!/[^A-Za-z0-9]/.test(value)) failures.push('symbol');

  const email = context.email?.trim().toLowerCase();
  if (email) {
    const lowered = value.toLowerCase();
    const local = email.split('@')[0] ?? '';
    // A 1–2 character local part would reject far too many passwords.
    if (
      lowered.includes(email) ||
      (local.length >= 3 && lowered.includes(local))
    )
      failures.push('email');
  }

  return failures;
}

/** One human sentence describing every broken rule. */
export function describePasswordFailures(failures: PasswordRule[]): string {
  if (!failures.length) return '';
  return `Password must ${failures.map((r) => RULE_MESSAGES[r]).join(', ')}.`;
}

/**
 * True when `password` matches any of the stored bcrypt hashes. Callers pass
 * the current hash plus the history, so "not among the last 5" includes the
 * password being replaced.
 */
export async function isPasswordReused(
  password: string,
  hashes: (string | null | undefined)[],
): Promise<boolean> {
  for (const hash of hashes) {
    if (hash && (await bcrypt.compare(password, hash))) return true;
  }
  return false;
}

/** Prepends `hash` and trims the history to the policy size. */
export function pushPasswordHistory(
  history: string[] | null | undefined,
  hash: string | null | undefined,
): string[] {
  const next = hash ? [hash, ...(history ?? [])] : [...(history ?? [])];
  return next.slice(0, PASSWORD_HISTORY_SIZE);
}

/**
 * class-validator decorator applying the static rules. `emailField` names a
 * sibling property holding the account email, when the DTO carries one.
 * History is checked in the service, which has the stored hashes.
 */
export function IsStrongPassword(
  options: { emailField?: string } = {},
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          if (typeof value !== 'string') return false;
          const email = options.emailField
            ? ((args.object as Record<string, unknown>)[options.emailField] as
                | string
                | undefined)
            : undefined;
          return checkPasswordPolicy(value, { email }).length === 0;
        },
        defaultMessage(args: ValidationArguments) {
          const email = options.emailField
            ? ((args.object as Record<string, unknown>)[options.emailField] as
                | string
                | undefined)
            : undefined;
          return describePasswordFailures(
            checkPasswordPolicy(String(args.value ?? ''), { email }),
          );
        },
      },
    });
  };
}
