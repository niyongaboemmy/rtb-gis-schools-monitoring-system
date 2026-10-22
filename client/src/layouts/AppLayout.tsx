import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import type { Socket } from "socket.io-client";
import { connectSocket } from "../lib/socket";
import {
  Navigate,
  Outlet,
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import {
  Map,
  LayoutDashboard,
  Building2,
  Settings,
  LogOut,
  FileSearch,
  ClipboardCheck,
  User,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  MapPin,
  Layers,
  BarChart3,
  GraduationCap,
  ClipboardList,
  X,
} from "lucide-react";
import { cn } from "../lib/utils";
import { ThemeToggle } from "../components/ThemeToggle";
import { GlobalSearch } from "../components/GlobalSearch";
import type { PermissionType } from "../lib/permissions";
import { Permission } from "../lib/permissions";
import { useAuthorization } from "../hooks/useAuthorization";
import { useScope, isSchoolLevelUser } from "../hooks/useScope";
import { Breadcrumbs } from "../components/layout/Breadcrumbs";
import { NotificationBell } from "../components/layout/NotificationBell";
import { HelpMenu } from "../components/layout/HelpMenu";
import { Tour } from "../components/layout/Tour";
import {
  NATIONAL_TOUR,
  SCHOOL_TOUR,
  markTourSeen,
  tourSeen,
} from "../components/layout/layout-utils";
import {
  useNotifications,
  describeStatusChange,
  describeAssignment,
  type ReportStatusChangedPayload,
  type ReportAssignedPayload,
} from "../components/layout/notifications";
import { useFocusTrap } from "../components/layout/useFocusTrap";
import { useToast } from "../components/ui/toast";
import { titleCase } from "../lib/labels";
import { IdleTimeoutGuard } from "../components/auth/IdleTimeoutGuard";
import { motion, AnimatePresence } from "framer-motion";
import { usePendingReviewCount } from "../hooks/usePendingReviewCount";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../components/ui/tooltip";

/* ─── helpers ─────────────────────────────────────────────────── */
/** The nav item that shows the waiting-for-review badge. */
const REVIEW_PATH = "/reports/validate";
const SIDEBAR_EXPANDED = 256;
const SIDEBAR_COLLAPSED = 68;
const DESKTOP_QUERY = "(min-width: 1024px)";

/** Tracks the lg breakpoint so the sidebar can become an off-canvas drawer. */
function useIsDesktop() {
  const get = () =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(DESKTOP_QUERY).matches
      : true;
  const [isDesktop, setIsDesktop] = useState(get);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(DESKTOP_QUERY);
    const on = () => setIsDesktop(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return isDesktop;
}

export function ProtectedRoute({
  children,
  allowedRoles = [],
  requiredPermission,
  requiredAnyPermission,
}: {
  children?: ReactNode;
  allowedRoles?: string[];
  requiredPermission?: PermissionType;
  requiredAnyPermission?: PermissionType[];
}) {
  const { isAuthenticated, user, isAuthorized, isAnyAuthorized } =
    useAuthorization();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (requiredPermission && !isAuthorized(requiredPermission))
    return <Navigate to="/welcome" replace />;
  if (
    requiredAnyPermission &&
    requiredAnyPermission.length > 0 &&
    !isAnyAuthorized(requiredAnyPermission)
  )
    return <Navigate to="/welcome" replace />;
  if (allowedRoles.length > 0 && user) {
    const rawRole = typeof user.role === "object" ? user.role.name : user.role;
    const roleName = (rawRole || "").toLowerCase().replace(/\s+/g, '_');
    
    // Super Admin bypass for allowedRoles list
    if (roleName === "super_admin") return children ? <>{children}</> : <Outlet />;
    
    if (!allowedRoles.includes(rawRole))
      return <Navigate to="/welcome" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}

/* ─── main layout ─────────────────────────────────────────────── */
export function AppLayout() {
  const { logout } = useAuthStore();
  const { user, isAuthorized, isAnyAuthorized } = useAuthorization();
  const location = useLocation();
  const navigate = useNavigate();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isDesktop = useIsDesktop();
  const sidebarRef = useRef<HTMLElement>(null);
  const closeMobileMenu = useCallback(() => setIsMobileMenuOpen(false), []);
  // Off-canvas drawer on small screens: trap focus, Esc closes (WS3.3/3.4).
  useFocusTrap(sidebarRef, !isDesktop && isMobileMenuOpen, closeMobileMenu);
  // Close the drawer on any navigation or when growing to desktop
  // ("adjust state during render" pattern, no effect needed).
  const [menuKey, setMenuKey] = useState(`${location.pathname}|${isDesktop}`);
  const currentMenuKey = `${location.pathname}|${isDesktop}`;
  if (menuKey !== currentMenuKey) {
    setMenuKey(currentMenuKey);
    if (isMobileMenuOpen) setIsMobileMenuOpen(false);
  }

  const profileMenuRef = useRef<HTMLDivElement>(null);
  const closeProfile = useCallback(() => setIsProfileOpen(false), []);
  useFocusTrap(profileMenuRef, isProfileOpen, closeProfile);

  const toast = useToast();
  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);
  const bindNotifications = useNotifications((st) => st.bind);
  const addNotification = useNotifications((st) => st.add);
  const canTriageAll = isAnyAuthorized([
    Permission.VIEW_ALL_SCHOOLS_REPORTING_DASHBOARD,
    Permission.EDIT_SCHOOL_LOCATION,
  ]);
  const reportsPath: "/reports" | "/reporting" = canTriageAll ? "/reports" : "/reporting";
  const reportsPathRef = useRef(reportsPath);
  useEffect(() => {
    reportsPathRef.current = reportsPath;
  }, [reportsPath]);

  useEffect(() => {
    bindNotifications(user?.id ?? null);
  }, [user?.id, bindNotifications]);

  useEffect(() => {
    if (!user?.id) return;

    // Connect to the same origin — Vite proxies /socket.io → :3001 in dev,
    // and in production the API server serves both HTTP and WS on the same origin.
    const socket: Socket = connectSocket();

    // Join on every (re)connect so the room survives network drops.
    const userId = user.id;
    socket.on("connect", () => socket.emit("join", `user:${userId}`));

    // WS3.11: keep a persistent notification and show the usual toast.
    socket.on("report:status_changed", (payload: ReportStatusChangedPayload) => {
      const n = describeStatusChange(payload, reportsPathRef.current);
      addNotification(n);
      const t = toastRef.current;
      const show =
        n.tone === "success" ? t.success : n.tone === "danger" ? t.error : n.tone === "warning" ? t.warning : t.info;
      show(n.body, { title: n.title });
    });
    socket.on("report:assigned", (payload: ReportAssignedPayload) => {
      const n = describeAssignment(payload, reportsPathRef.current);
      addNotification(n);
      toastRef.current.info(n.body, { title: n.title });
    });

    return () => {
      socket.emit("leave", `user:${userId}`);
      socket.disconnect();
    };
  }, [user?.id, addNotification]);

  // First-run guided tour (WS3.7), once per user and role variant.
  const tourVariant = isSchoolLevelUser(user) ? "school" : "national";
  const [tourOpen, setTourOpen] = useState(false);
  useEffect(() => {
    if (!user?.id || tourSeen(user.id, tourVariant)) return;
    const t = window.setTimeout(() => setTourOpen(true), 900);
    return () => window.clearTimeout(t);
  }, [user?.id, tourVariant]);
  const tourUserId = user?.id;
  const closeTour = useCallback(() => {
    setTourOpen(false);
    if (tourUserId) markTourSeen(tourUserId, tourVariant);
  }, [tourUserId, tourVariant]);

  const allNavItems = [
    {
      name: "Dashboard",
      path: "/",
      icon: LayoutDashboard,
      requiredPermission: Permission.VIEW_DASHBOARD,
    },
    {
      name: "School Dashboard",
      path: "/school-dashboard",
      icon: GraduationCap,
      requiredPermission: Permission.SCHOOL_LEVEL_DASHBOARD,
      schoolLevelOnly: true,
    },
    {
      name: "National Map",
      path: "/map",
      icon: Map,
      requiredPermission: Permission.VIEW_MAP,
    },
    {
      name: "Schools Directory",
      path: "/schools",
      icon: Building2,
      requiredPermission: Permission.VIEW_SCHOOLS,
    },
    {
      name: "Decision & Analytics",
      path: "/analytics",
      icon: BarChart3,
      requiredPermission: Permission.VIEW_ANALYTICS,
    },
    {
      name: "School Reporting",
      path: "/reporting",
      icon: ClipboardList,
      requiredAnyPermission: [
        Permission.VIEW_REPORTING,
        Permission.CREATE_REPORT,
        Permission.VIEW_ALL_SCHOOLS_REPORTING_DASHBOARD,
      ] as PermissionType[],
    },
    {
      name: "Reports",
      path: "/reports",
      icon: FileSearch,
      requiredAnyPermission: [
        Permission.VIEW_ALL_SCHOOLS_REPORTING_DASHBOARD,
        Permission.EDIT_SCHOOL_LOCATION,
      ] as PermissionType[],
    },
    {
      name: "Review reports",
      path: "/reports/validate",
      icon: ClipboardCheck,
      requiredAnyPermission: [
        Permission.VIEW_ALL_SCHOOLS_REPORTING_DASHBOARD,
        Permission.EDIT_SCHOOL_LOCATION,
      ] as PermissionType[],
    },
    {
      name: "Settings",
      path: "/settings",
      icon: Settings,
      requiredAnyPermission: [
        Permission.MANAGE_USERS,
        Permission.VIEW_USERS,
        Permission.MANAGE_ROLES,
        Permission.VIEW_AUDIT_LOGS,
      ] as PermissionType[],
    },
  ] as {
    name: string;
    path: string;
    icon: typeof LayoutDashboard;
    requiredPermission?: PermissionType;
    requiredAnyPermission?: PermissionType[];
    schoolLevelOnly?: boolean;
  }[];

  const scope = useScope();
  const isSchoolLevel = scope.tier === "school";

  const navItems = allNavItems.filter((item) => {
    if (item.schoolLevelOnly && !isSchoolLevel) return false;
    if (item.requiredPermission && !isAuthorized(item.requiredPermission))
      return false;
    if (item.requiredAnyPermission && !isAnyAuthorized(item.requiredAnyPermission))
      return false;
    return true;
  });
  // Reports waiting for review — shown as a badge on "Review reports".
  const reviewCount = usePendingReviewCount(navItems.some((i) => i.path === REVIEW_PATH));
  const initials = `${user?.firstName?.charAt(0) ?? ""}${user?.lastName?.charAt(0) ?? ""}`;
  const roleName = titleCase(
    typeof user?.role === "object" ? user.role.name || "" : user?.role || "",
  );

  const accessLevelName: string | null =
    typeof user?.role === "object" && user?.role !== null
      ? user.role.accessLevel?.name || null
      : null;

  const loc = user?.location;
  const scopeLabel = loc
    ? loc.schoolName
      ? loc.schoolName
      : loc.sector
        ? `${loc.sector}, ${loc.district}`
        : loc.district
          ? `${loc.district}, ${loc.province}`
          : (loc.province ?? null)
    : null;

  const drawerHidden = !isDesktop && !isMobileMenuOpen;

  return (
    <div className="flex h-screen w-full bg-muted/30 overflow-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[400] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        Skip to content
      </a>
      {/* ── Mobile overlay ─────────────────────────────── */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            key="mobile-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ────────────────────────────────────── */}
      <motion.aside
        ref={sidebarRef}
        id="app-sidebar"
        aria-label="Main menu"
        {...(!isDesktop && isMobileMenuOpen
          ? { role: "dialog", "aria-modal": true }
          : {})}
        // Off-screen drawer must not be reachable by Tab / screen readers.
        inert={drawerHidden || undefined}
        initial={false}
        animate={{
          width: isSidebarCollapsed && isDesktop ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED,
          x: drawerHidden ? -SIDEBAR_EXPANDED : 0,
        }}
        transition={{ type: "tween", ease: [0.4, 0, 0.2, 1], duration: 0.22 }}
        className={cn(
          "fixed inset-y-0 left-0 z-50 lg:relative shrink-0 flex flex-col",
          "bg-background border-r border-border/20",
        )}
      >
        {/* Logo / Brand – only shown in expanded state */}
        <AnimatePresence initial={false}>
          {(!isSidebarCollapsed || !isDesktop) && (
            <motion.div
              key="sidebar-header"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="h-14 flex items-center px-4 gap-3 justify-between border-b border-border/20 shrink-0"
            >
              {/* Brand mark */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <img
                  src="/logortb.png"
                  alt="RTB Logo"
                  className="w-8 h-auto object-contain shrink-0"
                />
                <div className="overflow-hidden">
                  <p className="text-sm font-semibold text-foreground whitespace-nowrap leading-none">
                    TVET 3D GIS
                  </p>
                  <p className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5">
                    Control center
                  </p>
                </div>
              </div>

              {/* Close (mobile drawer) */}
              <button
                type="button"
                onClick={closeMobileMenu}
                aria-label="Close menu"
                className="lg:hidden flex items-center justify-center w-8 h-8 rounded-xl text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>

              {/* Collapse button (desktop) */}
              <motion.button
                type="button"
                aria-label="Collapse sidebar"
                onClick={() => setIsSidebarCollapsed(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="hidden lg:flex items-center justify-center w-8 h-8 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <PanelLeftClose className="w-4 h-4" aria-hidden="true" />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapsed header: just the expand button */}
        {isSidebarCollapsed && isDesktop && (
          <div className="h-14 flex items-center justify-center border-b border-border/20 shrink-0">
            <motion.button
              type="button"
              aria-label="Expand sidebar"
              onClick={() => setIsSidebarCollapsed(false)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              <PanelLeftOpen className="w-4 h-4" aria-hidden="true" />
            </motion.button>
          </div>
        )}

        {/* Nav section label */}
        <AnimatePresence initial={false}>
          {!isSidebarCollapsed && (
            <motion.p
              key="nav-label"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="px-5 pt-5 pb-1.5 text-[10px] font-semibold text-muted-foreground/60 tracking-wide"
            >
              Navigation
            </motion.p>
          )}
        </AnimatePresence>

        {/* Nav items */}
        <nav
          aria-label="Primary"
          data-tour="nav"
          className={cn(
            "flex-1 pb-2 space-y-0.5 overflow-y-auto mt-2",
            isSidebarCollapsed ? "px-0 flex flex-col items-center" : "px-3",
          )}
        >
          {navItems.map((item) => {
            // Longest match wins, so /reports/validate is not also "Reports".
            const matches = (p: string) => location.pathname === p || (p !== "/" && location.pathname.startsWith(`${p}/`));
            const isActive =
              matches(item.path) && !navItems.some((o) => o.path.length > item.path.length && o.path.startsWith(item.path) && matches(o.path));

            const badge = item.path === REVIEW_PATH && reviewCount ? (reviewCount > 99 ? "99+" : String(reviewCount)) : null;
            const linkNode = (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                aria-current={isActive ? "page" : undefined}
                aria-label={isSidebarCollapsed ? (badge ? `${item.name}, ${badge} waiting` : item.name) : undefined}
                data-tour={`nav-${item.path.replace(/^\//, "") || "dashboard"}`}
                className={cn(
                  "relative flex items-center gap-3 rounded-xl transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isSidebarCollapsed
                    ? "w-10 h-10 justify-center"
                    : "w-full px-3 py-2.5",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
                )}
              >
                {/* Active background pill */}
                {isActive && (
                  <motion.span
                    layoutId="sidebar-pill"
                    className="absolute inset-0 rounded-xl bg-primary/10"
                    transition={{
                      type: "tween",
                      ease: [0.4, 0, 0.2, 1],
                      duration: 0.2,
                    }}
                  />
                )}

                <item.icon
                  className={cn(
                    "relative z-10 w-4 h-4 shrink-0 transition-colors duration-150",
                    isActive ? "text-primary" : "",
                  )}
                />

                <AnimatePresence initial={false}>
                  {!isSidebarCollapsed && (
                    <motion.span
                      key="link-text"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="relative z-10 text-[13px] font-medium whitespace-nowrap"
                    >
                      {item.name}
                    </motion.span>
                  )}
                </AnimatePresence>

                {/* Waiting-for-review count: a pill when expanded, a corner badge when collapsed */}
                <AnimatePresence initial={false}>
                  {badge && (
                    <motion.span
                      key={badge}
                      initial={{ scale: 0.4, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.4, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 520, damping: 26 }}
                      className={cn(
                        "z-10 rounded-full bg-red-500 text-center font-semibold tabular-nums text-white",
                        isSidebarCollapsed
                          ? "absolute -right-1 -top-1 min-w-4 px-1 text-[9px] leading-4 ring-2 ring-background"
                          : "relative ml-auto min-w-5 px-1.5 text-[11px] leading-5",
                      )}
                      title={`${badge} report${badge === "1" ? "" : "s"} waiting for review`}
                    >
                      {badge}
                      {!isSidebarCollapsed && <span className="sr-only"> waiting for review</span>}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            );

            return isSidebarCollapsed ? (
              <Tooltip key={item.path}>
                <TooltipTrigger asChild>{linkNode}</TooltipTrigger>
                <TooltipContent
                  side="right"
                  sideOffset={12}
                  className="text-xs font-medium"
                >
                  {item.name}
                </TooltipContent>
              </Tooltip>
            ) : (
              linkNode
            );
          })}
        </nav>

        {/* User card at sidebar bottom */}
        <AnimatePresence initial={false}>
          {!isSidebarCollapsed && (
            <motion.div
              key="user-footer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="p-3 border-t border-border/20"
            >
              <button
                type="button"
                aria-label="Open my profile"
                className="w-full text-left flex items-center gap-3 px-2 py-2 pr-3 rounded-full bg-muted/40 hover:bg-muted/70 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => navigate("/profile")}
              >
                {/* Avatar */}
                <div className="w-7 h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[11px] font-semibold border border-primary/20 shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground leading-none truncate">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate capitalize">
                    {roleName}
                  </p>
                  {accessLevelName && (
                    <div className="flex items-center gap-1 mt-1">
                      <Layers className="w-2.5 h-2.5 text-primary/60 shrink-0" />
                      <p className="text-[9px] text-primary/70 font-semibold truncate">
                        {accessLevelName}
                        {scopeLabel && ` · ${scopeLabel}`}
                      </p>
                    </div>
                  )}
                </div>
                {/* Settings cog  */}
                <Settings className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapsed bottom avatar */}
        {isSidebarCollapsed && (
          <div className="p-3 border-t border-border/20 flex justify-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Open my profile"
                  onClick={() => navigate("/profile")}
                  className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[11px] font-semibold border border-primary/20 hover:bg-primary/25 transition-colors"
                >
                  {initials}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={12} className="text-xs">
                {user?.firstName} {user?.lastName}
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </motion.aside>

      {/* ── Main area ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-5 bg-background border-b border-border/20 shrink-0">
          {/* Left: collapsed RTB mark + mobile hamburger + breadcrumb */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open menu"
              aria-expanded={isMobileMenuOpen}
              aria-controls="app-sidebar"
              className="lg:hidden flex items-center justify-center w-9 h-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Menu className="w-4 h-4" aria-hidden="true" />
            </button>

            {/* RTB mark – appears in topbar when sidebar is collapsed */}
            <AnimatePresence initial={false}>
              {isSidebarCollapsed && (
                <motion.div
                  key="topbar-rtb"
                  initial={{ opacity: 0, scale: 0.8, x: -8 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.8, x: -8 }}
                  transition={{
                    type: "tween",
                    ease: [0.4, 0, 0.2, 1],
                    duration: 0.2,
                  }}
                  className="hidden lg:flex items-center gap-2 mr-1"
                >
                  <img
                    src="/logortb.png"
                    alt="RTB Logo"
                    className="w-7 h-auto object-contain shrink-0"
                  />
                  <span className="text-sm font-semibold text-foreground whitespace-nowrap">
                    TVET 3D GIS
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Breadcrumbs + school switcher (WS3.9) */}
            <Breadcrumbs />
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <div data-tour="search">
              <GlobalSearch />
            </div>

            {/* Access-scope chip — the geographic window this account operates in */}
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  data-tour="scope"
                  tabIndex={0}
                  className={cn(
                    "hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    scope.isNational
                      ? "border-border/30 text-muted-foreground"
                      : "border-primary/25 text-primary bg-primary/10",
                  )}
                >
                  <Layers className="w-3 h-3 shrink-0" />
                  {scope.label}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {scope.isNational
                  ? "National access — all schools in view"
                  : `${scope.levelName ?? ""} access — limited to ${scope.label}`}
              </TooltipContent>
            </Tooltip>

            <ThemeToggle />

            {/* Notifications (WS3.11) + Help (WS3.7) */}
            <NotificationBell />
            <HelpMenu onStartTour={() => setTourOpen(true)} />

            {/* Profile chip */}
            <button
              type="button"
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              aria-haspopup="menu"
              aria-expanded={isProfileOpen}
              aria-label="Account menu"
              className={cn(
                "flex items-center gap-2 ml-1 pl-1 pr-1 sm:pr-3 py-1 rounded-full border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isProfileOpen
                  ? "bg-accent border-border"
                  : "border-border/20 hover:bg-accent hover:border-border",
              )}
            >
              <div className="w-6 h-6 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[9px] font-semibold border border-primary/20">
                {initials}
              </div>
              <span className="hidden sm:block text-xs font-medium text-foreground leading-none">
                {user?.firstName}
              </span>
            </button>
          </div>
        </header>

        {/* Profile dropdown */}
        <AnimatePresence>
          {isProfileOpen && (
            <>
              <motion.div
                key="profile-bg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 z-40"
                onClick={() => setIsProfileOpen(false)}
              />
              <motion.div
                key="profile-menu"
                ref={profileMenuRef}
                role="menu"
                aria-label="Account"
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{
                  type: "tween",
                  ease: [0.4, 0, 0.2, 1],
                  duration: 0.18,
                }}
                className="absolute right-3 sm:right-5 top-[60px] w-58 max-w-[calc(100vw-1.5rem)] z-50 bg-background border border-border/60 rounded-xl overflow-hidden"
              >
                {/* Avatar block */}
                <div className="px-4 py-4 flex items-center gap-3 bg-muted/20 border-b border-border/20">
                  <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-semibold border border-primary/20">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-none truncate">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {user?.email}
                    </p>
                    <span className="inline-block mt-1 text-[9px] font-semibold text-primary bg-primary/10 border border-primary/15 rounded-full px-2 py-0.5 capitalize">
                      {roleName}
                    </span>
                    {accessLevelName && (
                      <div className="flex items-center gap-1 mt-1">
                        <Layers className="w-2.5 h-2.5 text-primary/60 shrink-0" />
                        <span className="text-[9px] font-semibold text-primary/70">
                          {accessLevelName}
                          {scopeLabel && ` · ${scopeLabel}`}
                        </span>
                      </div>
                    )}
                    {scopeLabel && !accessLevelName && (
                      <div className="flex items-center gap-1 mt-1">
                        <MapPin className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                        <span className="text-[9px] text-muted-foreground font-medium">
                          {scopeLabel}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Menu items */}
                <div className="p-1.5 space-y-0.5">
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      navigate("/profile");
                    }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-foreground hover:bg-accent rounded-lg transition-colors text-left"
                  >
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                    My profile
                  </button>
                  {isAnyAuthorized([
                    Permission.MANAGE_USERS,
                    Permission.VIEW_USERS,
                    Permission.MANAGE_ROLES,
                    Permission.VIEW_AUDIT_LOGS,
                  ]) && (
                    <button
                      onClick={() => {
                        setIsProfileOpen(false);
                        navigate("/settings");
                      }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-foreground hover:bg-accent rounded-lg transition-colors text-left"
                    >
                      <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                      Settings
                    </button>
                  )}
                </div>

                <div className="p-1.5 border-t border-border/20">
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      logout();
                      toast.info("You have signed out");
                    }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-destructive hover:bg-destructive/8 rounded-lg transition-colors text-left"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign out
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Page content */}
        <main
          id="main-content"
          tabIndex={-1}
          className={cn(
            "flex-1 overflow-auto bg-slate-200/20 dark:bg-black [--app-shell-inset:0px] focus:outline-none",
            isSidebarCollapsed
              ? "lg:[--app-shell-inset:68px]"
              : "lg:[--app-shell-inset:256px]",
          )}
        >
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              type: "tween",
              ease: [0.4, 0, 0.2, 1],
              duration: 0.22,
            }}
            className="container mx-auto p-4 sm:p-5 md:p-7 w-full h-full"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>

      {/* WS9.16 inactivity sign-out (Agent A) */}
      <IdleTimeoutGuard />
      <Tour
        open={tourOpen}
        onClose={closeTour}
        steps={tourVariant === "school" ? SCHOOL_TOUR : NATIONAL_TOUR}
      />
    </div>
  );
}
