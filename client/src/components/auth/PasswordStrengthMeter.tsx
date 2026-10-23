import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { evaluatePassword, passwordScore } from "./password-policy";

/** Theme status tokens only (destructive / warning / success). */
const LEVELS = [
  { label: "Too weak", bar: "bg-destructive", text: "text-destructive" },
  { label: "Weak", bar: "bg-destructive/70", text: "text-destructive" },
  { label: "Fair", bar: "bg-warning", text: "text-warning" },
  { label: "Strong", bar: "bg-success/80", text: "text-success" },
  { label: "Very strong", bar: "bg-success", text: "text-success" },
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
  const reduce = useReducedMotion();
  const rules = evaluatePassword(password, email);
  const score = passwordScore(password, email);
  const level = LEVELS[score];

  return (
    <div className={cn("space-y-2.5", className)} id={id}>
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
            <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/70 dark:bg-white/[0.06]">
              <motion.div
                className={cn("h-full w-full origin-left rounded-full", level.bar)}
                initial={false}
                animate={{ scaleX: password && score >= i ? 1 : 0 }}
                transition={{ duration: reduce ? 0 : 0.35, delay: reduce ? 0 : (i - 1) * 0.04, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          ))}
        </div>
        <span className={cn("w-20 text-right text-xs font-medium transition-colors", password ? level.text : "text-muted-foreground")}>
          {password ? level.label : ""}
        </span>
      </div>
      <ul className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
        {rules.map((rule) => (
          <li
            key={rule.id}
            className={cn(
              "flex items-center gap-2 text-xs transition-colors duration-200",
              rule.met ? "text-success" : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors duration-200",
                rule.met ? "bg-success/15" : "bg-muted/70 dark:bg-white/[0.06]",
              )}
              aria-hidden
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={rule.met ? "met" : "unmet"}
                  initial={reduce ? false : { scale: 0.3, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.3, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 600, damping: 24 }}
                  className="flex"
                >
                  {rule.met ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : <X className="h-2.5 w-2.5" />}
                </motion.span>
              </AnimatePresence>
            </span>
            <span>
              {rule.label}
              <span className="sr-only">{rule.met ? " (met)" : " (not met)"}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-muted-foreground">Your last 5 passwords cannot be reused.</p>
    </div>
  );
}
