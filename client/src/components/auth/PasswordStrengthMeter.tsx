import { Check, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { evaluatePassword, passwordScore } from "./password-policy";

const LEVELS = [
  { label: "Too weak", bar: "bg-red-500", text: "text-red-600 dark:text-red-400" },
  { label: "Weak", bar: "bg-orange-500", text: "text-orange-600 dark:text-orange-400" },
  { label: "Fair", bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  { label: "Strong", bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  { label: "Very strong", bar: "bg-emerald-600", text: "text-emerald-700 dark:text-emerald-300" },
];

/**
 * Live checklist of the password policy (WS10.1). Reused by the profile
 * change-password form, the reset flow and user creation.
 */
export function PasswordStrengthMeter({
  password,
  email,
  className,
  id,
}: {
  password: string;
  email?: string | null;
  className?: string;
  /** Lets the input reference the checklist via aria-describedby. */
  id?: string;
}) {
  const rules = evaluatePassword(password, email);
  const score = passwordScore(password, email);
  const level = LEVELS[score];

  return (
    <div className={cn("space-y-2", className)} id={id}>
      <div className="flex items-center gap-3">
        <div
          className="flex flex-1 gap-1"
          role="meter"
          aria-label="Password strength"
          aria-valuemin={0}
          aria-valuemax={4}
          aria-valuenow={score}
          aria-valuetext={password ? level.label : "Empty"}
        >
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                password && score >= i ? level.bar : "bg-muted",
              )}
            />
          ))}
        </div>
        <span className={cn("text-xs font-semibold w-20 text-right", password ? level.text : "text-muted-foreground")}>
          {password ? level.label : ""}
        </span>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
        {rules.map((rule) => (
          <li
            key={rule.id}
            className={cn(
              "flex items-center gap-1.5 text-xs",
              rule.met ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
            )}
          >
            {rule.met ? (
              <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
            ) : (
              <X className="h-3.5 w-3.5 shrink-0" aria-hidden />
            )}
            <span>
              {rule.label}
              <span className="sr-only">{rule.met ? " (met)" : " (not met)"}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-muted-foreground">
        Your last 5 passwords cannot be reused.
      </p>
    </div>
  );
}
