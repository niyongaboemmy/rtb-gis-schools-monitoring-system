import { Fragment, useState, type RefObject } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronRight, ChevronsLeft, Layers, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import {
  REVIEW_PATH,
  activeNavPath,
  badgeText,
  leavesOf,
  tourId,
  type NavEntry,
  type NavGroup,
  type NavLeaf,
} from "./nav-config";

export const SIDEBAR_EXPANDED = 256;
export const SIDEBAR_COLLAPSED = 68;
/** Drawer width on phones/tablets; capped at 85vw by CSS so the page peeks out. */
const SIDEBAR_DRAWER = 288;
const PROFILE_PATH = "/profile";
const EASE = [0.4, 0, 0.2, 1] as const;
const GROUPS_KEY = "rtb-nav-groups";

function readGroups(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(GROUPS_KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

function writeGroups(v: Record<string, boolean>) {
  try {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(v));
  } catch {
    /* storage blocked: open/closed just isn't remembered */
  }
}

export interface SidebarUser {
  initials: string;
  fullName: string;
  roleName: string;
  /** e.g. "District · Gasabo, Kigali" */
  scopeLine: string | null;
}

interface SidebarProps {
  asideRef: RefObject<HTMLElement | null>;
  pathname: string;
  isDesktop: boolean;
  /** Desktop icon-rail mode (ignored in the mobile drawer). */
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onToggleCollapsed: () => void;
  primary: NavEntry[];
  footer: NavEntry[];
  reviewCount: number | null;
  user: SidebarUser;
}

export function Sidebar({
  asideRef,
  pathname,
  isDesktop,
  collapsed: collapsedPref,
  mobileOpen,
  onCloseMobile,
  onToggleCollapsed,
  primary,
  footer,
  reviewCount,
  user,
}: SidebarProps) {
  // The drawer is always full width, whatever the desktop preference is.
  const collapsed = collapsedPref && isDesktop;
  const drawerHidden = !isDesktop && !mobileOpen;
  const activePath = activeNavPath(pathname, leavesOf([...primary, ...footer]));
  const review = badgeText(reviewCount);
  const profileActive = pathname === PROFILE_PATH || pathname.startsWith(`${PROFILE_PATH}/`);

  const [openGroups, setOpenGroups] = useState(readGroups);
  const isOpen = (g: NavGroup) => openGroups[g.id] ?? true;
  const setGroup = (id: string, open: boolean) => {
    const next = { ...openGroups, [id]: open };
    setOpenGroups(next);
    writeGroups(next);
  };

  // Navigating into a closed group opens it so the current page stays visible
  // ("adjust state during render": no effect needed).
  const [seenPath, setSeenPath] = useState(activePath);
  if (seenPath !== activePath) {
    setSeenPath(activePath);
    const owner = primary.find((e): e is NavGroup => e.kind === "group" && e.items.some((i) => i.path === activePath));
    if (owner && !isOpen(owner)) setGroup(owner.id, true);
  }

  const leafBadge = (leaf: NavLeaf) => (leaf.path === REVIEW_PATH ? review : null);

  const renderLeaf = (leaf: NavLeaf, opts: { nested?: boolean; group?: string } = {}) => {
    const isActive = leaf.path === activePath;
    const badge = leafBadge(leaf);
    const link = (
      <Link
        key={leaf.path}
        to={leaf.path}
        onClick={onCloseMobile}
        aria-current={isActive ? "page" : undefined}
        aria-label={collapsed ? (badge ? `${leaf.name}, ${badge} waiting` : leaf.name) : undefined}
        data-tour={tourId(leaf.path)}
        className={cn(
          "group/link relative flex items-center gap-3 rounded-xl outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring",
          collapsed ? "mx-auto h-10 w-10 justify-center" : cn("w-full px-3", isDesktop ? "h-9" : "h-11"),
          isActive ? "text-primary" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
        )}
      >
        {isActive && (
          <motion.span
            layoutId="sidebar-pill"
            className="absolute inset-0 rounded-xl bg-primary/10"
            transition={{ type: "tween", ease: EASE, duration: 0.22 }}
          />
        )}

        <leaf.icon
          aria-hidden="true"
          className={cn(
            "relative z-10 shrink-0 transition-transform duration-150 group-hover/link:scale-110",
            opts.nested ? "h-[15px] w-[15px]" : "h-4 w-4",
          )}
        />

        {!collapsed && (
          <span className={cn("relative z-10 truncate", opts.nested ? "text-[13px]" : "text-[15px]", "font-medium")}>
            {leaf.name}
          </span>
        )}

        <AnimatePresence initial={false}>
          {badge && (
            <motion.span
              key={badge}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ type: "spring", stiffness: 520, damping: 26 }}
              className={cn(
                "z-10 rounded-full bg-red-500 text-center font-medium tabular-nums text-white",
                collapsed
                  ? "absolute -right-1 -top-1 min-w-4 px-1 text-[12px] leading-4 ring-2 ring-background"
                  : "relative ml-auto min-w-5 px-1.5 text-[13px] leading-5",
              )}
              title={`${badge} report${badge === "1" ? "" : "s"} waiting for review`}
            >
              {badge}
              {!collapsed && <span className="sr-only"> waiting for review</span>}
            </motion.span>
          )}
        </AnimatePresence>
      </Link>
    );

    if (!collapsed) return link;
    return (
      <Tooltip key={leaf.path}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={12} className="text-xs font-medium">
          {opts.group && <span className="text-muted-foreground">{opts.group} › </span>}
          {leaf.name}
          {badge && <span className="ml-1.5 text-red-500">{badge}</span>}
        </TooltipContent>
      </Tooltip>
    );
  };

  const renderGroup = (g: NavGroup, edges: { top: boolean; bottom: boolean }) => {
    // Icon rail: the group's pages stay one click away, framed by hairlines.
    if (collapsed) {
      return (
        <div key={g.id} role="group" aria-label={g.name} className="space-y-1">
          {edges.top && <div aria-hidden="true" className="mx-auto my-1.5 h-px w-6 bg-border/50" />}
          {g.items.map((leaf) => renderLeaf(leaf, { group: g.name }))}
          {edges.bottom && <div aria-hidden="true" className="mx-auto my-1.5 h-px w-6 bg-border/50" />}
        </div>
      );
    }

    const open = isOpen(g);
    const holdsActive = g.items.some((i) => i.path === activePath);
    const groupBadge = g.items.some((i) => i.path === REVIEW_PATH) ? review : null;
    const panelId = `nav-group-${g.id}`;
    return (
      <div key={g.id} className="pt-0.5">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setGroup(g.id, !open)}
          className={cn(
            "group/head flex w-full items-center gap-3 rounded-xl px-3 outline-none transition-colors duration-150 hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring",
            isDesktop ? "h-9" : "h-11",
            holdsActive && !open ? "text-primary" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <g.icon aria-hidden="true" className="h-4 w-4 shrink-0 transition-transform duration-150 group-hover/head:scale-110" />
          <span className="truncate text-[15px] font-medium">{g.name}</span>
          <span className="ml-auto flex items-center gap-1.5">
            <AnimatePresence initial={false}>
              {!open && groupBadge && (
                <motion.span
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.4, opacity: 0 }}
                  className="min-w-5 rounded-full bg-red-500 px-1.5 text-center text-[13px] font-medium leading-5 tabular-nums text-white"
                >
                  {groupBadge}
                  <span className="sr-only"> waiting for review</span>
                </motion.span>
              )}
            </AnimatePresence>
            {holdsActive && !open && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary" />}
            <ChevronDown
              aria-hidden="true"
              className={cn("h-3.5 w-3.5 shrink-0 opacity-60 transition-transform duration-200", open ? "rotate-0" : "-rotate-90")}
            />
          </span>
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              id={panelId}
              key="panel"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "tween", ease: EASE, duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="ml-[1.3rem] mt-0.5 space-y-0.5 border-l border-border/50 pb-1 pl-2">
                {g.items.map((leaf) => renderLeaf(leaf, { nested: true }))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // In the rail a group is framed by hairlines, never doubled or at the ends.
  const renderEntries = (entries: NavEntry[]) =>
    entries.map((e, i) =>
      e.kind === "item" ? (
        <Fragment key={e.path}>{renderLeaf(e)}</Fragment>
      ) : (
        renderGroup(e, { top: i > 0 && entries[i - 1].kind !== "group", bottom: i < entries.length - 1 })
      ),
    );

  return (
    <motion.aside
      ref={asideRef}
      id="app-sidebar"
      aria-label="Main menu"
      {...(!isDesktop && mobileOpen ? { role: "dialog", "aria-modal": true } : {})}
      // Off-screen drawer must not be reachable by Tab / screen readers.
      inert={drawerHidden || undefined}
      initial={false}
      animate={{
        width: isDesktop ? (collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED) : SIDEBAR_DRAWER,
        x: drawerHidden ? "-100%" : 0,
      }}
      transition={{ type: "tween", ease: EASE, duration: 0.22 }}
      // Swipe left to dismiss the drawer.
      drag={!isDesktop && mobileOpen ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: 0.5, right: 0 }}
      onDragEnd={(_, info) => {
        if (info.offset.x < -72 || info.velocity.x < -500) onCloseMobile();
      }}
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex shrink-0 flex-col bg-background lg:relative",
        "max-w-[85vw] border-r border-border/20",
        !isDesktop && mobileOpen && "shadow-2xl shadow-black/20",
      )}
    >
      {/* Desktop collapse handle on the sidebar's edge */}
      {isDesktop && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              aria-controls="app-sidebar"
              className="absolute -right-3 top-[18px] z-20 flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground shadow-sm outline-none transition-colors hover:border-primary/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronsLeft
                aria-hidden="true"
                className={cn("h-3.5 w-3.5 transition-transform duration-200", collapsed && "rotate-180")}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8} className="text-xs">
            {collapsed ? "Expand" : "Collapse"} sidebar
            <kbd className="ml-2 rounded border border-border/60 px-1 font-sans text-[12px] text-muted-foreground">Ctrl B</kbd>
          </TooltipContent>
        </Tooltip>
      )}

      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {/* Brand */}
        <div
          className={cn(
            "flex h-14 shrink-0 items-center gap-3 border-b border-border/20",
            collapsed ? "justify-center px-0" : "px-4",
          )}
        >
          <img src="/logortb.png" alt="RTB Logo" className="h-auto w-8 shrink-0 object-contain" />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="whitespace-nowrap text-sm font-semibold leading-none text-foreground">TVET 3D GIS</p>
              <p className="mt-0.5 whitespace-nowrap text-[12px] text-muted-foreground">Control center</p>
            </div>
          )}
          {!isDesktop && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close menu"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Main menu */}
        <nav
          aria-label="Primary"
          data-tour="nav"
          className={cn("flex-1 space-y-0.5 overflow-y-auto overscroll-contain py-3", collapsed ? "px-0" : "px-3")}
        >
          {!collapsed && (
            <p className="px-3 pb-1.5 text-[12px] font-medium uppercase tracking-wider text-muted-foreground/60">
              Workspace
            </p>
          )}
          {renderEntries(primary)}
        </nav>

        {/* Pinned: settings + profile */}
        <div className={cn("shrink-0 space-y-1.5 border-t border-border/20 py-3", collapsed ? "px-0" : "px-3")}>
          {footer.length > 0 && <div className="space-y-0.5">{renderEntries(footer)}</div>}

          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to={PROFILE_PATH}
                  onClick={onCloseMobile}
                  aria-label="My profile"
                  aria-current={profileActive ? "page" : undefined}
                  className={cn(
                    "mx-auto flex h-9 w-9 items-center justify-center rounded-full border text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    profileActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-primary/20 bg-primary/15 text-primary hover:bg-primary/25",
                  )}
                >
                  {user.initials}
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={12} className="text-xs">
                {user.fullName}
                <span className="block text-muted-foreground">{user.roleName}</span>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Link
              to={PROFILE_PATH}
              onClick={onCloseMobile}
              aria-label="My profile"
              aria-current={profileActive ? "page" : undefined}
              className={cn(
                "group/profile flex w-full items-center gap-3 rounded-2xl px-2 py-2 pr-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                profileActive ? "bg-primary/10" : "bg-muted/40 hover:bg-muted/70",
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[13px] font-medium transition-colors",
                  profileActive ? "border-primary bg-primary text-primary-foreground" : "border-primary/20 bg-primary/15 text-primary",
                )}
              >
                {user.initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-xs font-normal leading-none", profileActive ? "text-primary" : "text-foreground")}>{user.fullName}</p>
                {/* Role · level on one line; the level truncates first, full text on hover. */}
                <p
                  className="mt-1 flex min-w-0 items-center gap-1 text-[12px] leading-none"
                  title={user.scopeLine ? `${user.roleName} · ${user.scopeLine}` : user.roleName}
                >
                  <span className="shrink-0 capitalize text-muted-foreground">{user.roleName}</span>
                  {user.scopeLine && (
                    <>
                      <span aria-hidden="true" className="text-muted-foreground/40">·</span>
                      <Layers className="h-2.5 w-2.5 shrink-0 text-primary/60" aria-hidden="true" />
                      <span className="truncate font-normal text-primary/70">{user.scopeLine}</span>
                    </>
                  )}
                </p>
              </div>
              <ChevronRight
                aria-hidden="true"
                className={cn(
                  "h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-hover/profile:translate-x-0.5",
                  profileActive ? "text-primary" : "text-muted-foreground",
                )}
              />
            </Link>
          )}
        </div>
      </div>
    </motion.aside>
  );
}
