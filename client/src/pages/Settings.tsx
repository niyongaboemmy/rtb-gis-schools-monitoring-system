import { useState } from "react";
import { Users as UsersIcon, Settings2, Layers, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "../components/ui/page-header";
import { cn } from "../lib/utils";

// Import modularized tabs
import { UsersTab } from "../components/settings/UsersTab";
import { RolesTab } from "../components/settings/RolesTab";
import { AccessLevelsTab } from "../components/settings/AccessLevelsTab";
import { ImigongoPattern } from "../components/ui/ImigongoPattern";

export default function Settings() {
  const [activeTab, setActiveTab] = useState<
    "users" | "roles" | "access-levels"
  >("users");

  return (
    <div className="relative space-y-8 pb-12 min-h-screen">
      {/* Background Pattern */}
      <ImigongoPattern 
        className="fixed inset-0 text-primary pointer-events-none mask-[linear-gradient(to_bottom_right,black_0%,transparent_40%,transparent_60%,black_100%)]" 
        opacity={0.05}
      />

      <div className="relative z-10 space-y-8">
        {/* Hero Header */}
      <PageHeader
        title="Control Center"
        description="Orchestrate users, define access roles, and monitor permissions."
        icon={Settings2}
        actions={
          <div className="flex bg-muted/20 p-1 rounded-full border border-border/30 backdrop-blur-md">
            {[
              { id: "users", label: "User Directory", icon: UsersIcon },
              { id: "roles", label: "Roles Management", icon: Shield },
              { id: "access-levels", label: "Access Levels", icon: Layers },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() =>
                  setActiveTab(tab.id as "users" | "roles" | "access-levels")
                }
                className={cn(
                  "relative flex items-center gap-2 px-4 py-2.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all duration-300",
                  activeTab === tab.id
                    ? "text-blue-600 dark:text-blue-100"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-blue-100/60 dark:bg-blue-700/30 rounded-full"
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 30,
                    }}
                  />
                )}
                <tab.icon className="w-3 h-3 relative z-10 shrink-0" />
                <span className="relative z-10">{tab.label}</span>
              </button>
            ))}
          </div>
        }
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === "users" && <UsersTab />}
          {activeTab === "roles" && <RolesTab />}
          {activeTab === "access-levels" && <AccessLevelsTab />}
        </motion.div>
      </AnimatePresence>
      </div>
    </div>
  );
}
