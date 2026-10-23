import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Lock, UserCircle } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { SecuritySettings } from "../components/auth/SecuritySettings";
import { ProfileHero } from "../components/profile/ProfileHero";
import { TabsBar, type TabItem } from "../components/ui/tabs-bar";
import { PersonalDetails } from "../components/profile/PersonalDetails";

type TabId = "personal" | "security";

/** `short` fits two tabs side by side on a 320px phone. */
const TABS: TabItem<TabId>[] = [
  { id: "personal", label: "Personal details", short: "Details", icon: UserCircle },
  { id: "security", label: "Security & privacy", short: "Security", icon: Lock },
];

const EASE = [0.22, 1, 0.36, 1] as const;

export default function Profile() {
  const { user, updateUser } = useAuthStore();
  const reduce = useReducedMotion();
  const [params, setParams] = useSearchParams();
  // The tab lives in the URL so "Security" can be linked to and survives reloads.
  const active: TabId = params.get("tab") === "security" ? "security" : "personal";
  const select = (id: TabId) => setParams(id === "personal" ? {} : { tab: id }, { replace: true });

  if (!user) return null;
  const openSecurity = () => select("security");

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <ProfileHero user={user} onOpenSecurity={openSecurity} />

      {/* Underline tabs on a full-width hairline (same bar as Settings) */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2, ease: EASE }}
      >
        <TabsBar
          tabs={TABS}
          active={active}
          onSelect={select}
          idPrefix="profile"
          label="Profile sections"
          className="-mt-2 border-b border-border/50"
        />
      </motion.div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={active}
          role="tabpanel"
          id={`profile-panel-${active}`}
          aria-labelledby={`profile-tab-${active}`}
          initial={reduce ? false : { opacity: 0, y: 12, filter: "blur(6px)" }}
          // `transitionEnd` drops the filter so it doesn't trap fixed descendants.
          animate={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
          exit={reduce ? undefined : { opacity: 0, y: -8, filter: "blur(4px)" }}
          transition={{ duration: 0.35, ease: EASE }}
        >
          {active === "personal" ? (
            <PersonalDetails user={user} onSaved={updateUser} onOpenSecurity={openSecurity} />
          ) : (
            <SecuritySettings />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
