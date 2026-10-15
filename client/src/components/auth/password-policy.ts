/**
 * Client mirror of the server password policy
 * (server/src/common/security/password-policy.ts). The server is the
 * authority; this only drives the strength meter. Keep the two in step.
 */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

export type PasswordRuleId = "length" | "upper" | "lower" | "digit" | "symbol" | "email";

export interface PasswordRuleResult {
  id: PasswordRuleId;
  label: string;
  met: boolean;
}

export function evaluatePassword(
  password: string,
  email?: string | null,
): PasswordRuleResult[] {
  const value = password ?? "";
  const rules: PasswordRuleResult[] = [
    {
      id: "length",
      label: `At least ${PASSWORD_MIN_LENGTH} characters`,
      met: value.length >= PASSWORD_MIN_LENGTH && value.length <= PASSWORD_MAX_LENGTH,
    },
    { id: "upper", label: "An uppercase letter", met: /[A-Z]/.test(value) },
    { id: "lower", label: "A lowercase letter", met: /[a-z]/.test(value) },
    { id: "digit", label: "A number", met: /\d/.test(value) },
    { id: "symbol", label: "A symbol (e.g. ! @ # $ %)", met: /[^A-Za-z0-9]/.test(value) },
  ];

  const normalised = email?.trim().toLowerCase();
  if (normalised) {
    const lowered = value.toLowerCase();
    const local = normalised.split("@")[0] ?? "";
    rules.push({
      id: "email",
      label: "Does not contain your email or its name part",
      met:
        value.length > 0 &&
        !lowered.includes(normalised) &&
        !(local.length >= 3 && lowered.includes(local)),
    });
  }
  return rules;
}

/** True when every rule passes. History is only checked by the server. */
export function isPasswordAcceptable(password: string, email?: string | null): boolean {
  return evaluatePassword(password, email).every((r) => r.met);
}

/** 0–4 for the meter bar: share of rules met, with length weighted in. */
export function passwordScore(password: string, email?: string | null): number {
  if (!password) return 0;
  const rules = evaluatePassword(password, email);
  const met = rules.filter((r) => r.met).length;
  if (met === rules.length) return password.length >= 14 ? 4 : 3;
  return Math.min(2, Math.floor((met / rules.length) * 3));
}
