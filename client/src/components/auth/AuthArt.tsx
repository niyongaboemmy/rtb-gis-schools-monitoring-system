import { motion, useReducedMotion, type TargetAndTransition } from "framer-motion";
import { Fingerprint, KeyRound, LockKeyhole, Mail, ShieldCheck, ShieldPlus, Smartphone } from "lucide-react";
import { cn } from "../../lib/utils";

export type AuthArtVariant =
  | "signin"
  | "verify"
  | "choose"
  | "email"
  | "app"
  | "reset"
  | "password"
  | "success";

const ICONS = {
  signin: Fingerprint,
  verify: ShieldCheck,
  choose: ShieldPlus,
  email: Mail,
  app: Smartphone,
  reset: KeyRound,
  password: LockKeyhole,
} as const;

/** One looping gesture per screen — small, slow, and meaningful. */
const LOOPS: Record<Exclude<AuthArtVariant, "success">, TargetAndTransition> = {
  signin: { scale: [1, 1.06, 1], transition: { duration: 2.4, repeat: Infinity, ease: "easeInOut" } },
  verify: { scale: [1, 1.1, 1], transition: { duration: 1.8, repeat: Infinity, ease: "easeInOut" } },
  choose: { rotate: [0, -6, 6, 0], transition: { duration: 3, repeat: Infinity, ease: "easeInOut" } },
  email: { y: [0, -3, 0], transition: { duration: 2, repeat: Infinity, ease: "easeInOut" } },
  app: {
    rotate: [0, -10, 10, -10, 10, 0],
    transition: { duration: 0.6, repeat: Infinity, repeatDelay: 2.2, ease: "easeInOut" },
  },
  reset: { rotate: [-18, 18, -18], transition: { duration: 3, repeat: Infinity, ease: "easeInOut" } },
  password: { y: [0, -2, 0], transition: { duration: 2.2, repeat: Infinity, ease: "easeInOut" } },
};

/**
 * Animated illustration above each auth title. The gesture matches the
 * step (a fingerprint scan to sign in, an arriving email, a buzzing phone,
 * a swinging key…); `busy` adds a spinning ring while a request runs.
 */
export function AuthArt({ variant, busy }: { variant: AuthArtVariant; busy?: boolean }) {
  const reduce = useReducedMotion();
  const success = variant === "success";

  return (
    <div className="relative mb-5 h-14 w-14" aria-hidden>
      {/* Soft halo rings */}
      {!reduce &&
        [0, 1].map((i) => (
          <motion.span
            key={i}
            className={cn(
              "absolute inset-0 rounded-2xl border",
              success ? "border-emerald-500/40" : "border-primary/40",
            )}
            initial={{ scale: 1, opacity: 0 }}
            animate={{ scale: [1, 1.45], opacity: [0.5, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, delay: i * 1.2, ease: "easeOut" }}
          />
        ))}

      {/* Busy ring */}
      {busy && (
        <motion.span
          className="absolute -inset-1 rounded-[1.1rem] border-2 border-transparent border-t-primary border-r-primary/40"
          animate={reduce ? undefined : { rotate: 360 }}
          transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
        />
      )}

      <motion.div
        initial={reduce ? false : { scale: 0.6, opacity: 0, rotate: -8 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
        className={cn(
          "relative h-14 w-14 rounded-2xl flex items-center justify-center ring-1 overflow-hidden",
          success
            ? "bg-emerald-500/12 ring-emerald-500/25 text-emerald-600 dark:text-emerald-400"
            : "bg-primary/10 ring-primary/25 text-primary",
        )}
      >
        {success ? <DrawnCheck reduce={!!reduce} /> : <LoopingIcon variant={variant} reduce={!!reduce} />}

        {/* Scan line for the fingerprint */}
        {variant === "signin" && !reduce && (
          <motion.span
            className="absolute inset-x-2 h-0.5 rounded-full bg-primary/70 shadow-[0_0_8px_hsl(var(--primary))]"
            animate={{ top: ["18%", "80%", "18%"] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </motion.div>

      {/* "New message" dot for email */}
      {variant === "email" && (
        <motion.span
          className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-brand-gold ring-2 ring-background"
          initial={reduce ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 400, damping: 12 }}
        />
      )}
    </div>
  );
}

function LoopingIcon({ variant, reduce }: { variant: Exclude<AuthArtVariant, "success">; reduce: boolean }) {
  const Icon = ICONS[variant];
  return (
    <motion.span className="flex" animate={reduce ? undefined : LOOPS[variant]}>
      <Icon className="h-6 w-6" strokeWidth={1.75} />
    </motion.span>
  );
}

function DrawnCheck({ reduce }: { reduce: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <motion.circle
        cx="12"
        cy="12"
        r="9.5"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
      <motion.path
        d="M7.5 12.5l3 3 6-6.5"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.4, delay: 0.5, ease: "easeOut" }}
      />
    </svg>
  );
}
