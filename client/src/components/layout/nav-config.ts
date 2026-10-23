/** Sidebar navigation model: menu tree, permission filtering, active-route matching. */
import {
  BarChart3,
  Building2,
  ClipboardCheck,
  ClipboardList,
  Compass,
  FileSearch,
  FileStack,
  GraduationCap,
  LayoutDashboard,
  Map,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { Permission, type PermissionType } from "../../lib/permissions";

/** The nav item that shows the waiting-for-review badge. */
export const REVIEW_PATH = "/reports/validate";

export interface NavLeaf {
  kind: "item";
  name: string;
  path: string;
  icon: LucideIcon;
  requiredPermission?: PermissionType;
  requiredAnyPermission?: PermissionType[];
  schoolLevelOnly?: boolean;
}

export interface NavGroup {
  kind: "group";
  id: string;
  name: string;
  icon: LucideIcon;
  items: NavLeaf[];
}

export type NavEntry = NavLeaf | NavGroup;

const TRIAGE = [
  Permission.VIEW_ALL_SCHOOLS_REPORTING_DASHBOARD,
  Permission.EDIT_SCHOOL_LOCATION,
] as PermissionType[];

/** Main menu, top to bottom. Related pages share a collapsible group. */
export const PRIMARY_NAV: NavEntry[] = [
  { kind: "item", name: "Dashboard", path: "/", icon: LayoutDashboard, requiredPermission: Permission.VIEW_DASHBOARD },
  {
    kind: "item",
    name: "School Dashboard",
    path: "/school-dashboard",
    icon: GraduationCap,
    requiredPermission: Permission.SCHOOL_LEVEL_DASHBOARD,
    schoolLevelOnly: true,
  },
  {
    kind: "group",
    id: "explore",
    name: "Map & Schools",
    icon: Compass,
    items: [
      { kind: "item", name: "National Map", path: "/map", icon: Map, requiredPermission: Permission.VIEW_MAP },
      { kind: "item", name: "Schools Directory", path: "/schools", icon: Building2, requiredPermission: Permission.VIEW_SCHOOLS },
    ],
  },
  { kind: "item", name: "Decision & Analytics", path: "/analytics", icon: BarChart3, requiredPermission: Permission.VIEW_ANALYTICS },
  {
    kind: "group",
    id: "reporting",
    name: "Reporting",
    icon: FileStack,
    items: [
      {
        kind: "item",
        name: "School Reporting",
        path: "/reporting",
        icon: ClipboardList,
        requiredAnyPermission: [
          Permission.VIEW_REPORTING,
          Permission.CREATE_REPORT,
          Permission.VIEW_ALL_SCHOOLS_REPORTING_DASHBOARD,
        ] as PermissionType[],
      },
      { kind: "item", name: "All Reports", path: "/reports", icon: FileSearch, requiredAnyPermission: TRIAGE },
      { kind: "item", name: "Review Reports", path: REVIEW_PATH, icon: ClipboardCheck, requiredAnyPermission: TRIAGE },
    ],
  },
];

/** Pinned above the profile card. */
export const FOOTER_NAV: NavEntry[] = [
  {
    kind: "item",
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
];

export interface NavAccess {
  isSchoolLevel: boolean;
  isAuthorized: (p: PermissionType) => boolean;
  isAnyAuthorized: (ps: PermissionType[]) => boolean;
}

function allowed(item: NavLeaf, a: NavAccess): boolean {
  if (item.schoolLevelOnly && !a.isSchoolLevel) return false;
  if (item.requiredPermission && !a.isAuthorized(item.requiredPermission)) return false;
  if (item.requiredAnyPermission && !a.isAnyAuthorized(item.requiredAnyPermission)) return false;
  return true;
}

/**
 * Drops what the user may not open. A group left with a single page is shown
 * as that plain page (no point in a one-item folder); an empty group vanishes.
 */
export function resolveNav(entries: NavEntry[], access: NavAccess): NavEntry[] {
  const out: NavEntry[] = [];
  for (const e of entries) {
    if (e.kind === "item") {
      if (allowed(e, access)) out.push(e);
      continue;
    }
    const items = e.items.filter((i) => allowed(i, access));
    if (items.length === 1) out.push(items[0]);
    else if (items.length > 1) out.push({ ...e, items });
  }
  return out;
}

export function leavesOf(entries: NavEntry[]): NavLeaf[] {
  return entries.flatMap((e) => (e.kind === "item" ? [e] : e.items));
}

/** Path of the nav item for `pathname`; the longest match wins (/reports/validate ≠ /reports). */
export function activeNavPath(pathname: string, leaves: NavLeaf[]): string | null {
  const matches = (p: string) => pathname === p || (p !== "/" && pathname.startsWith(`${p}/`));
  let best: string | null = null;
  for (const l of leaves) if (matches(l.path) && (!best || l.path.length > best.length)) best = l.path;
  return best;
}

/** `data-tour` id of a nav item (tour steps target e.g. `nav-reporting`). */
export const tourId = (path: string) => `nav-${path.replace(/^\//, "") || "dashboard"}`;

/** Badge text for a count, or null when there is nothing to show. */
export function badgeText(count: number | null | undefined): string | null {
  if (!count || count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}
