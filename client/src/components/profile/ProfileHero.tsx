import { useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Check,
  Copy,
  KeyRound,
  Layers,
  Mail,
  MapPin,
  ShieldCheck,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { formatDate } from "../../lib/format";
import type { User } from "../../store/authStore";
import { accessLevelOf, roleNameOf, scopeLabelOf } from "./profile-utils";
import { GLASS } from "../ui/surfaces";

const EASE = [0.22, 1, 0.36, 1] as const;


/** The person's full name: plain, single colour, fades up once. */
function HeroName({ first, last }: { first: string; last: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.h1
      initial={reduce ? false : { opacity: 0, y: 6, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
      className="break-words text-[1.4rem] font-semibold leading-tight tracking-[-0.02em] text-foreground min-[400px]:text-2xl sm:text-3xl"
    >
      {[first, last].filter(Boolean).join(" ")}
    </motion.h1>
  );
}

function Avatar({ initials }: { initials: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: EASE }}
      whileHover={reduce ? undefined : { scale: 1.04 }}
      className="relative h-16 w-16 shrink-0 min-[400px]:h-20 min-[400px]:w-20 sm:h-24 sm:w-24"
    >
      {/* Slowly turning primary halo */}
      <motion.span
        aria-hidden
        animate={reduce ? undefined : { rotate: 360 }}
        transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
        className="absolute -inset-1 rounded-full bg-[conic-gradient(from_0deg,hsl(var(--primary)),hsl(var(--primary)/0.05),hsl(var(--primary)/0.6),hsl(var(--primary)/0.05),hsl(var(--primary)))] opacity-80 blur-[1px]"
      />
      <span className="absolute inset-0 flex items-center justify-center rounded-full bg-linear-to-br from-primary to-blue-700 text-xl font-bold tracking-tight text-white ring-4 ring-background min-[400px]:text-2xl sm:text-3xl">
        {initials || "?"}
      </span>
    </motion.div>
  );
}

function Chip({ icon: Icon, children, tone = "muted" }: { icon: LucideIcon; children: ReactNode; tone?: "primary" | "muted" }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
        tone === "primary"
          ? "bg-primary/10 text-primary ring-1 ring-inset ring-primary/20"
          : "bg-slate-900/[0.04] text-muted-foreground ring-1 ring-inset ring-border/40 dark:bg-white/[0.04]",
      )}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      <span className="truncate">{children}</span>
    </span>
  );
}

function CopyEmail({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked: nothing to do */
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="group/email inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full px-1 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={copied ? "Email copied" : `Copy email ${email}`}
    >
      <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="truncate">{email}</span>
      {copied ? (
        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden />
      ) : (
        <Copy className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover/email:opacity-100 group-focus-visible/email:opacity-100 [@media(hover:none)]:opacity-100" aria-hidden />
      )}
    </button>
  );
}

interface StatusTile {
  label: string;
  value: string;
  caption: string;
  icon: LucideIcon;
  tone: "good" | "warn" | "neutral";
}

const TONES = {
  good: "text-emerald-500 bg-emerald-500/10",
  warn: "text-amber-500 bg-amber-500/10",
  neutral: "text-primary bg-primary/10",
} as const;

function statusTiles(user: User): StatusTile[] {
  const mfa = user.totpEnabled;
  return [
    {
      label: "Two-factor",
      value: mfa ? "On" : "Off",
      caption: mfa ? "Authenticator app" : user.mfaRequired ? "Required for your role" : "Recommended",
      icon: mfa ? ShieldCheck : ShieldAlert,
      tone: mfa ? "good" : "warn",
    },
    {
      label: "Password",
      value: user.passwordChangedAt ? formatDate(user.passwordChangedAt) : "Never changed",
      caption: user.mustChangePassword ? "Change required" : "Last changed",
      icon: KeyRound,
      tone: user.mustChangePassword ? "warn" : "neutral",
    },
  ];
}

interface Props {
  user: User;
  /** Opens the Security tab (the status tiles link there). */
  onOpenSecurity: () => void;
}

export function ProfileHero({ user, onOpenSecurity }: Props) {
  const reduce = useReducedMotion();
  const initials = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase();
  const role = roleNameOf(user);
  const level = accessLevelOf(user);
  const area = scopeLabelOf(user);

  return (
    <motion.section
      aria-label="Account overview"
      initial={reduce ? false : { opacity: 0, y: -10, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: EASE }}
      className={cn("@container relative overflow-hidden rounded-[1.75rem] p-4 min-[400px]:p-5 sm:p-7", GLASS)}
    >
      {/* Soft primary light behind the avatar */}
      <span
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl dark:bg-primary/15"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-32 right-0 h-72 w-96 rounded-full bg-sky-400/10 blur-3xl"
      />

      <div className="relative flex flex-col gap-5 @3xl:flex-row @3xl:items-center @3xl:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-4 @md:flex-row @md:items-center @md:gap-6">
          <Avatar initials={initials} />
          <div className="min-w-0 space-y-2">
            <HeroName first={user.firstName} last={user.lastName} />
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35, ease: EASE }}
              className="flex flex-wrap items-center gap-1.5"
            >
              {role && <Chip icon={ShieldCheck} tone="primary">{role}</Chip>}
              {level && <Chip icon={Layers}>{level} access</Chip>}
              {area && <Chip icon={MapPin}>{area}</Chip>}
            </motion.div>
            <CopyEmail email={user.email} />
          </div>
        </div>

        {/* Security at a glance: each tile opens the Security tab */}
        <div className="grid grid-cols-1 gap-2.5 @sm:grid-cols-2 @3xl:w-[22rem] @3xl:shrink-0">
          {statusTiles(user).map((t, i) => (
            <motion.div
              key={t.label}
              initial={reduce ? false : { opacity: 0, y: 14, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.6, delay: 0.4 + i * 0.1, ease: EASE }}
            >
              <button
                type="button"
                onClick={onOpenSecurity}
                className="group flex w-full items-center gap-3 rounded-2xl bg-white/55 p-3 text-left outline-none ring-1 ring-inset ring-border/30 transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/80 hover:shadow-float focus-visible:ring-2 focus-visible:ring-ring dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
              >
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110", TONES[t.tone])}>
                  <t.icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{t.label}</span>
                  <span className="block truncate text-sm font-normal text-foreground">{t.value}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{t.caption}</span>
                </span>
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
