import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  LayoutDashboard,
  Map,
  Building2,
  BarChart3,
  FileSearch,
  Settings,
  ArrowRight,
  Command,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../lib/utils";

/* ── Search index ──────────────────────────────────────────────── */
const SEARCH_ITEMS = [
  {
    group: "Pages",
    items: [
      {
        label: "Dashboard",
        description: "System overview & key metrics",
        path: "/",
        icon: LayoutDashboard,
        keywords: "home overview stats metrics priority",
      },
      {
        label: "National Map",
        description: "Interactive GIS school map",
        path: "/map",
        icon: Map,
        keywords: "map gis geography schools location",
      },
      {
        label: "Schools Directory",
        description: "Browse and manage all schools",
        path: "/schools",
        icon: Building2,
        keywords: "schools list directory buildings",
      },
      {
        label: "Decision & Analytics",
        description: "Advanced data analytics",
        path: "/analytics",
        icon: BarChart3,
        keywords: "analytics data charts graphs decisions",
      },
      {
        label: "Reports",
        description: "Generate and export reports",
        path: "/reports",
        icon: FileSearch,
        keywords: "reports export pdf download",
      },
      {
        label: "Settings",
        description: "Platform configuration & users",
        path: "/settings",
        icon: Settings,
        keywords: "settings users roles permissions config",
      },
    ],
  },
  {
    group: "Quick actions",
    items: [
      {
        label: "Add new school",
        description: "Register a school in the system",
        path: "/schools",
        icon: Building2,
        keywords: "new school add create",
      },
      {
        label: "View analytics",
        description: "Open the analytics dashboard",
        path: "/analytics",
        icon: BarChart3,
        keywords: "analytics view charts",
      },
      {
        label: "Export report",
        description: "Generate a new report",
        path: "/reports",
        icon: FileSearch,
        keywords: "export report generate",
      },
      {
        label: "Manage users",
        description: "User accounts & permissions",
        path: "/settings",
        icon: Settings,
        keywords: "users manage accounts",
      },
    ],
  },
];

type SearchItem = (typeof SEARCH_ITEMS)[0]["items"][0];

function scoreMatch(item: SearchItem, query: string): number {
  const q = query.toLowerCase().trim();
  if (!q) return 1;
  const label = item.label.toLowerCase();
  const desc = item.description.toLowerCase();
  const kw = item.keywords.toLowerCase();
  if (label.startsWith(q)) return 3;
  if (label.includes(q)) return 2;
  if (desc.includes(q) || kw.includes(q)) return 1;
  return 0;
}

/* ── Component ─────────────────────────────────────────────────── */
export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  /* Cmd+K shortcut */
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((v) => !v);
      }
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  /* Auto-focus input */
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 60);
      setQuery("");
      setActiveIndex(0);
    }
  }, [isOpen]);

  /* Filtered results */
  const results = SEARCH_ITEMS.map((group) => ({
    group: group.group,
    items: group.items
      .map((item) => ({ item, score: scoreMatch(item, query) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item),
  })).filter((g) => g.items.length > 0);

  const flatItems = results.flatMap((g) => g.items);

  const go = useCallback(
    (path: string) => {
      navigate(path);
      setIsOpen(false);
    },
    [navigate],
  );

  /* Keyboard navigation */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && flatItems[activeIndex]) {
      go(flatItems[activeIndex].path);
    }
  };

  // Reset active index when results change
  useEffect(() => setActiveIndex(0), [query]);

  return (
    <>
      {/* Search trigger button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "hidden sm:flex items-center gap-2 h-9 px-3.5 rounded-full border border-border/20",
          "bg-muted/30 hover:bg-muted/60 text-muted-foreground hover:text-foreground",
          "transition-colors duration-150 text-xs",
        )}
      >
        <Search className="w-3.5 h-3.5 shrink-0" />
        <span>Search...</span>
        <span className="ml-1 flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
          <Command className="w-2.5 h-2.5" />K
        </span>
      </button>

      {/* Mobile search icon */}
      <button
        onClick={() => setIsOpen(true)}
        className="sm:hidden flex items-center justify-center w-9 h-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      >
        <Search className="w-4 h-4" />
      </button>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="search-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-60 bg-foreground/20 backdrop-blur-sm flex items-start justify-center pt-[12vh] px-4"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              key="search-modal"
              initial={{ opacity: 0, y: -16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.97 }}
              transition={{
                type: "tween",
                ease: [0.4, 0, 0.2, 1],
                duration: 0.2,
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-background border border-border/60 rounded-2xl overflow-hidden"
            >
              {/* Input row */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border/20">
                <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Search pages, actions..."
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <kbd className="hidden sm:flex items-center px-1.5 py-0.5 rounded border border-border/60 text-[10px] text-muted-foreground font-mono">
                  esc
                </kbd>
              </div>

              {/* Results */}
              <div className="max-h-80 overflow-y-auto py-2">
                {results.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No results for &ldquo;{query}&rdquo;
                  </div>
                ) : (
                  results.map((group) => (
                    <div key={group.group}>
                      <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-muted-foreground/60 tracking-wide">
                        {group.group}
                      </p>
                      {group.items.map((item) => {
                        const globalIdx = flatItems.indexOf(item);
                        const isActive = globalIdx === activeIndex;
                        return (
                          <button
                            key={item.path + item.label}
                            onClick={() => go(item.path)}
                            onMouseEnter={() => setActiveIndex(globalIdx)}
                            className={cn(
                              "flex items-center gap-3 w-full px-4 py-3 text-left transition-colors duration-100 rounded-none",
                              isActive ? "bg-primary/8" : "hover:bg-accent/60",
                            )}
                          >
                            <div
                              className={cn(
                                "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                                isActive
                                  ? "bg-primary/15 text-primary"
                                  : "bg-muted/50 text-muted-foreground",
                              )}
                            >
                              <item.icon className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p
                                className={cn(
                                  "text-sm font-medium leading-none",
                                  isActive ? "text-primary" : "text-foreground",
                                )}
                              >
                                {item.label}
                              </p>
                              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                                {item.description}
                              </p>
                            </div>
                            {isActive && (
                              <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Footer hint */}
              <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border/20 text-[10px] text-muted-foreground/50">
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 rounded border border-border/20 font-mono">
                    ↑↓
                  </kbd>{" "}
                  navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 rounded border border-border/20 font-mono">
                    ↵
                  </kbd>{" "}
                  open
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 rounded border border-border/20 font-mono">
                    esc
                  </kbd>{" "}
                  close
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
