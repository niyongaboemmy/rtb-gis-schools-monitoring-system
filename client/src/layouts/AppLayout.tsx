import { useState, type ReactNode } from "react";
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
  User,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  Bell,
  MapPin,
  Layers,
  BarChart3,
  GraduationCap,
  ClipboardList,
} from "lucide-react";
import { cn } from "../lib/utils";
import { ThemeToggle } from "../components/ThemeToggle";
import { GlobalSearch } from "../components/GlobalSearch";
import type { PermissionType } from "../lib/permissions";
import { Permission } from "../lib/permissions";
import { useAuthorization } from "../hooks/useAuthorization";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../components/ui/tooltip";

/* ─── helpers ─────────────────────────────────────────────────── */
const SIDEBAR_EXPANDED = 256;
const SIDEBAR_COLLAPSED = 68;

export function ProtectedRoute({
  children,
  allowedRoles = [],
  requiredPermission,
}: {
  children?: ReactNode;
  allowedRoles?: string[];
  requiredPermission?: PermissionType;
}) {
  const { isAuthenticated, user, isAuthorized } = useAuthorization();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (requiredPermission && !isAuthorized(requiredPermission))
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
  const { user, isAuthorized } = useAuthorization();
  const location = useLocation();
  const navigate = useNavigate();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
      requiredPermission: Permission.CREATE_REPORT,
    },
    {
      name: "Reports",
      path: "/reports",
      icon: FileSearch,
      requiredPermission: Permission.EXPORT_REPORTS,
    },
    {
      name: "Settings",
      path: "/settings",
      icon: Settings,
      requiredPermission: Permission.MANAGE_USERS,
    },
  ];

  const navItems = allNavItems.filter(
    (item) => !item.requiredPermission || isAuthorized(item.requiredPermission),
  );

  const initials = `${user?.firstName?.charAt(0) ?? ""}${user?.lastName?.charAt(0) ?? ""}`;
  const roleName = (
    typeof user?.role === "object" ? user.role.name || "" : user?.role || ""
  )
    .replace(/_/g, " ")
    .toLowerCase();

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

  const currentSegment =
    location.pathname.split("/")[1]?.replace(/-/g, " ") || "dashboard";

  return (
    <div className="flex h-screen w-full bg-muted/30 overflow-hidden">
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
        initial={false}
        animate={{
          width: isSidebarCollapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED,
          x: isMobileMenuOpen
            ? 0
            : typeof window !== "undefined" && window.innerWidth < 1024
              ? -SIDEBAR_EXPANDED
              : 0,
        }}
        transition={{ type: "tween", ease: [0.4, 0, 0.2, 1], duration: 0.22 }}
        className={cn(
          "fixed inset-y-0 left-0 z-50 lg:relative shrink-0 flex flex-col",
          "bg-background border-r border-border/20",
        )}
      >
        {/* Logo / Brand – only shown in expanded state */}
        <AnimatePresence initial={false}>
          {!isSidebarCollapsed && (
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
                    RTB Monitoring
                  </p>
                  <p className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5">
                    Control center
                  </p>
                </div>
              </div>

              {/* Collapse button */}

              <motion.button
                onClick={() => setIsSidebarCollapsed(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center justify-center w-8 h-8 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                <PanelLeftClose className="w-4 h-4" />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapsed header: just the expand button */}
        {isSidebarCollapsed && (
          <div className="h-14 flex items-center justify-center border-b border-border/20 shrink-0">
            <motion.button
              onClick={() => setIsSidebarCollapsed(false)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              <PanelLeftOpen className="w-4 h-4" />
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
          className={cn(
            "flex-1 pb-2 space-y-0.5 overflow-y-auto mt-2",
            isSidebarCollapsed ? "px-0 flex flex-col items-center" : "px-3",
          )}
        >
          {navItems.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.path !== "/" && location.pathname.startsWith(item.path));

            const linkNode = (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  "relative flex items-center gap-3 rounded-xl transition-colors duration-150",
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
              <div
                className="flex items-center gap-3 px-2 py-2 pr-3 rounded-full bg-muted/40 hover:bg-muted/70 transition-colors cursor-pointer"
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
                <Settings className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapsed bottom avatar */}
        {isSidebarCollapsed && (
          <div className="p-3 border-t border-border/20 flex justify-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
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
        <header className="h-14 flex items-center justify-between gap-4 px-5 bg-background border-b border-border/20 shrink-0">
          {/* Left: collapsed RTB mark + mobile hamburger + breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile hamburger */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Menu className="w-4 h-4" />
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
                    RTB Monitoring Platform
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-muted-foreground shrink-0">GIS</span>
              <span className="text-muted-foreground/40 shrink-0">/</span>
              <span className="font-semibold text-foreground capitalize truncate">
                {currentSegment}
              </span>
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <GlobalSearch />
            <ThemeToggle />

            {/* Notification bell */}
            <button className="relative flex items-center justify-center w-9 h-9 rounded-full text-muted-foreground border border-transparent hover:text-foreground hover:bg-accent hover:border-border/20 transition-colors">
              <Bell className="w-4 h-4" />
              {/* Unread dot */}
              <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-primary" />
            </button>

            {/* Profile chip */}
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className={cn(
                "flex items-center gap-2 ml-1 pl-1 pr-3 py-1 rounded-full border transition-colors duration-150",
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
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{
                  type: "tween",
                  ease: [0.4, 0, 0.2, 1],
                  duration: 0.18,
                }}
                className="absolute right-5 top-[60px] w-58 z-50 bg-background border border-border/60 rounded-xl overflow-hidden"
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
                  {isAuthorized(Permission.MANAGE_USERS) && (
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
        <main className="flex-1 overflow-auto bg-slate-200/20 dark:bg-black">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              type: "tween",
              ease: [0.4, 0, 0.2, 1],
              duration: 0.22,
            }}
            className="container  mx-auto p-5 md:p-7 w-full h-full"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
}
