import { useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../lib/utils";

const modes = [
  { key: "light", icon: Sun, label: "Light" },
  { key: "system", icon: Monitor, label: "System" },
  { key: "dark", icon: Moon, label: "Dark" },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const CurrentIcon = modes.find((m) => m.key === theme)?.icon || Monitor;

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle theme menu"
        className={cn(
          "flex items-center justify-center w-9 h-9 rounded-full transition-colors duration-200 border",
          isOpen
            ? "bg-accent border-border"
            : "bg-muted/30 border-border/20 hover:bg-accent hover:border-border text-muted-foreground hover:text-foreground"
        )}
      >
        <CurrentIcon className="w-4 h-4" />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Invisible backdrop to catch clicks */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.95 }}
              transition={{ type: "tween", ease: [0.4, 0, 0.2, 1], duration: 0.15 }}
              className="absolute right-0 top-[42px] z-50 w-36 p-1.5 bg-background border border-border/60 rounded-xl overflow-hidden"
            >
              {modes.map(({ key, icon: Icon, label }) => {
                const isActive = theme === key;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setTheme(key);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-2.5 w-full px-2.5 py-1.5 text-xs rounded-lg transition-colors text-left",
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground hover:bg-accent"
                    )}
                  >
                    <Icon className={cn("w-3.5 h-3.5", isActive ? "text-primary" : "text-muted-foreground")} />
                    {label}
                  </button>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
