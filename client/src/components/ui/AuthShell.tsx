import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { AlertCircle, Box, CheckCircle2, Info, LineChart, Map as MapIcon, ShieldCheck } from "lucide-react";
import { ImigongoPattern } from "./ImigongoPattern";
import { PrivacyNoticeModal } from "../auth/PrivacyNotice";
import { AuthGlobe } from "../auth/AuthGlobe";
import { ThemeToggle } from "../ThemeToggle";
import { cn } from "../../lib/utils";

const FEATURES = [
  { icon: MapIcon, text: "National school map" },
  { icon: Box, text: "3D campus models" },
  { icon: LineChart, text: "Condition scores" },
];

interface AuthShellProps {
  title: ReactNode;
  description?: ReactNode;
  /** Optional icon tile above the title (e.g. on 2FA or reset steps). */
  icon?: ReactNode;
  /** Optional "Step x of y" indicator for multi-step flows. */
  progress?: { current: number; total: number; label?: string };
  /** Changing it replays the entry animation (one per step). */
  stepKey?: string;
  children: ReactNode;
}

/**
 * Shared chrome for every unauthenticated screen (sign in, 2FA, password
 * reset, forced change): a brand panel on wide screens, a compact brand row
 * on small ones, and one consistent title + form column.
 */
export function AuthShell({ title, description, icon, progress, stepKey, children }: AuthShellProps) {
  const [showPrivacy, setShowPrivacy] = useState(false);

  return (
    <div className="min-h-dvh w-full flex bg-background font-sans">
      {/* Brand panel — wide screens only */}
      <aside className="hidden lg:flex lg:w-[46%] xl:w-1/2 sticky top-0 h-dvh overflow-hidden text-white bg-brand bg-linear-to-br from-brand-2 via-brand to-brand">
        <ImigongoPattern
          className="absolute inset-0 text-brand-soft mask-[linear-gradient(to_bottom,black_0%,transparent_35%)]"
          opacity={0.04}
          scale={1.3}
        />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[70%] aspect-square bg-brand-accent/15 blur-[120px] rounded-full pointer-events-none" />

        <div className="relative z-10 flex flex-col w-full p-10 xl:p-12 gap-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-white/10 ring-1 ring-white/10 flex items-center justify-center">
              <img src="/logortb.png" alt="" className="h-6 w-6 object-contain" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold">TVET 3D GIS</p>
              <p className="text-xs text-brand-soft/60">Rwanda TVET Board</p>
            </div>
          </div>

          <AuthGlobe className="flex-1 min-h-0 -mx-4" />

          <div className="max-w-md space-y-5">
            <div className="space-y-3">
              <h1 className="text-2xl xl:text-3xl font-semibold tracking-tight leading-tight">
                School infrastructure,{" "}
                <span className="text-brand-soft whitespace-nowrap">mapped in 3D.</span>
              </h1>
              <p className="text-sm text-brand-soft/70 leading-relaxed">
                Monitor, plan and improve technical and vocational training
                schools across Rwanda with geospatial data you can trust.
              </p>
            </div>
            <ul className="flex flex-wrap gap-2">
              {FEATURES.map(({ icon: Icon, text }) => (
                <li
                  key={text}
                  className="inline-flex items-center gap-2 rounded-full bg-white/6 ring-1 ring-white/10 px-3 py-1.5 text-xs font-medium text-white/85"
                >
                  <Icon className="h-3.5 w-3.5 text-brand-soft" aria-hidden />
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>

      {/* Form column */}
      <main className="flex-1 min-w-0 flex flex-col">
        <header className="flex items-center justify-between gap-3 px-5 sm:px-8 pt-5">
          {/* Compact brand row — small screens */}
          <div className="lg:hidden flex items-center gap-2.5">
            <img src="/logortb.png" alt="" className="h-8 w-8 object-contain" />
            <div className="leading-tight">
              <p className="text-sm font-semibold text-foreground">TVET 3D GIS</p>
              <p className="text-xs text-muted-foreground">Rwanda TVET Board</p>
            </div>
          </div>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center px-5 sm:px-8 py-8">
          <motion.div
            key={stepKey}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="w-full max-w-[400px] space-y-6"
          >
            <div className="space-y-2">
              {icon && (
                <div className="mb-4 h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center [&_svg]:h-5 [&_svg]:w-5">
                  {icon}
                </div>
              )}
              {progress && <StepProgress {...progress} />}
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
              {description && (
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
              )}
            </div>
            {children}
          </motion.div>
        </div>

        <footer className="px-5 sm:px-8 pb-6 flex flex-col sm:flex-row items-center justify-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground text-center">
          <span>© {new Date().getFullYear()} Rwanda TVET Board · Authorised personnel only</span>
          <button
            type="button"
            onClick={() => setShowPrivacy(true)}
            className="inline-flex items-center gap-1 font-medium hover:text-foreground hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Privacy &amp; terms
          </button>
        </footer>
        <PrivacyNoticeModal isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} />
      </main>
    </div>
  );
}

function StepProgress({ current, total, label }: { current: number; total: number; label?: string }) {
  return (
    <div className="mb-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        Step {current} of {total}
        {label ? ` · ${label}` : ""}
      </p>
      <div
        className="flex gap-1.5"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current}
        aria-label={`Step ${current} of ${total}`}
      >
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i < current ? "bg-primary" : "bg-muted",
            )}
          />
        ))}
      </div>
    </div>
  );
}

const ALERT_STYLES = {
  error: { cls: "bg-destructive/8 text-destructive border-destructive/25", Icon: AlertCircle },
  success: {
    cls: "bg-emerald-500/8 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
    Icon: CheckCircle2,
  },
  info: { cls: "bg-primary/8 text-foreground border-primary/20", Icon: Info },
} as const;

/** Inline status message for auth forms. Errors are announced immediately. */
export function AuthAlert({ tone = "error", children }: { tone?: keyof typeof ALERT_STYLES; children: ReactNode }) {
  const { cls, Icon } = ALERT_STYLES[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm", cls)}
    >
      <Icon className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
