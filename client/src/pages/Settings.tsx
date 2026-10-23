import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { History, Layers, Settings2, Shield, Users as UsersIcon } from "lucide-react";
import { cn } from "../lib/utils";
import { EASE_OUT, GLASS } from "../components/ui/surfaces";
import { TabsBar, type TabItem } from "../components/ui/tabs-bar";
import { HeroSlotContext } from "../components/settings/hero-slot";
import { useScope } from "../hooks/useScope";
import { UsersTab } from "../components/settings/UsersTab";
import { RolesTab } from "../components/settings/RolesTab";
import { AccessLevelsTab } from "../components/settings/AccessLevelsTab";
import { AuditTrailTab } from "../components/settings/AuditTrailTab";
import { useAuthStore } from "../store/authStore";
import { hasPermission, Permission } from "../lib/permissions";

type SettingsTab = "users" | "roles" | "access-levels" | "audit";

/** `short` labels fit all four tabs on a phone. */
const ALL_TABS: TabItem<SettingsTab>[] = [
  { id: "users", label: "Users", short: "Users", icon: UsersIcon },
  { id: "roles", label: "Roles & permissions", short: "Roles", icon: Shield },
  { id: "access-levels", label: "Access levels", short: "Levels", icon: Layers },
  { id: "audit", label: "Audit trail", short: "Audit", icon: History },
];

/** Plain, single-colour title that fades up once. */
function HeroTitle() {
  const reduce = useReducedMotion();
  return (
    <motion.h1
      initial={reduce ? false : { opacity: 0, y: 6, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.6, delay: 0.1, ease: EASE_OUT }}
      className="text-xl font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-2xl"
    >
      Control center
    </motion.h1>
  );
}

export default function Settings() {
  const reduce = useReducedMotion();
  const user = useAuthStore((s) => s.user);
  const canViewAudit = hasPermission(user, Permission.VIEW_AUDIT_LOGS);
  const tabs = ALL_TABS.filter((t) => t.id !== "audit" || canViewAudit);
  const scope = useScope();

  // The tab lives in the URL, so each tab can be linked to and survives reloads.
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab") as SettingsTab | null;
  const active: SettingsTab = tabs.some((t) => t.id === requested) ? (requested as SettingsTab) : "users";
  const select = (id: SettingsTab) => setParams(id === "users" ? {} : { tab: id }, { replace: true });

  // The active tab can portal its summary (stat tiles) into the hero.
  const [heroSlot, setHeroSlot] = useState<HTMLElement | null>(null);

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      {/* One hero, like the dashboard's: identity, tabs, then the tab's numbers */}
      <motion.section
        aria-label="Settings"
        initial={reduce ? false : { opacity: 0, y: -10, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: EASE_OUT }}
        className={cn(
          "@container relative overflow-hidden rounded-[1.75rem] px-4 pt-4 min-[400px]:px-5 min-[400px]:pt-5 sm:px-6 sm:pt-6",
          // No summary: close just under the tabs (a little room keeps the
          // underline clear of the rounded corners).
          "pb-2 has-[[data-hero-slot]:not(:empty)]:pb-0",
          GLASS,
        )}
      >
        <span aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
        <span aria-hidden className="pointer-events-none absolute -bottom-32 right-0 h-64 w-96 rounded-full bg-sky-400/10 blur-3xl" />

        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground" aria-hidden>
              <Settings2 className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <HeroTitle />
              <p className="mt-0.5 truncate text-xs text-muted-foreground/70">Users, roles and access</p>
            </div>
          </div>
          {/* The area this account administers */}
          <span
            className={cn(
              "inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
              scope.isNational ? "bg-slate-900/[0.04] text-muted-foreground dark:bg-white/[0.05]" : "bg-primary/10 text-primary",
            )}
          >
            <Layers className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">{scope.isNational ? "National access" : `${scope.levelName ?? ""} · ${scope.label}`}</span>
          </span>
        </div>

        <TabsBar
          tabs={tabs}
          active={active}
          onSelect={select}
          idPrefix="settings"
          label="Settings sections"
          className="relative -mx-1 mt-5 border-b border-border/40 px-1"
        />

        <div ref={setHeroSlot} data-hero-slot className="relative py-4 empty:hidden sm:py-5" />
      </motion.section>

      <HeroSlotContext.Provider value={heroSlot}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={active}
          role="tabpanel"
          id={`settings-panel-${active}`}
          aria-labelledby={`settings-tab-${active}`}
          initial={reduce ? false : { opacity: 0, y: 12, filter: "blur(6px)" }}
          // `transitionEnd` drops the filter so it doesn't trap fixed descendants.
          animate={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
          exit={reduce ? undefined : { opacity: 0, y: -8, filter: "blur(4px)" }}
          transition={{ duration: 0.35, ease: EASE_OUT }}
        >
          {active === "users" && <UsersTab />}
          {active === "roles" && <RolesTab />}
          {active === "access-levels" && <AccessLevelsTab />}
          {active === "audit" && canViewAudit && <AuditTrailTab />}
        </motion.div>
      </AnimatePresence>
      </HeroSlotContext.Provider>
    </div>
  );
}
