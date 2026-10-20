import { useAuthStore } from "../store/authStore";

export type AccessTier =
  | "national"
  | "province"
  | "district"
  | "sector"
  | "school";

export interface ResolvedScope {
  /** machine tier, or null when the role has no access level configured */
  tier: AccessTier | null;
  /** 10 national … 50 school; 100 when unconfigured */
  rank: number;
  /** display name of the level, e.g. "District" */
  levelName: string | null;
  /** the bound geographic node, e.g. "Musanze" or a school name */
  node: string | null;
  /** full readable label, e.g. "Musanze District" or "National" */
  label: string;
  /** true → user sees the whole country */
  isNational: boolean;
}

const RANK_BY_TIER: Record<AccessTier, number> = {
  national: 10,
  province: 20,
  district: 30,
  sector: 40,
  school: 50,
};

/**
 * Resolves the current user's geographic access scope from the login payload.
 * Mirrors the server's `resolveAccessScope` so the UI can label and adapt to it.
 */
/** "Musanze" + district → "Musanze District"; "Kigali TSS School" stays as is. */
function withTier(node: string, tier: string): string {
  const word = tier.charAt(0).toUpperCase() + tier.slice(1);
  return new RegExp(`\\b${word}$`, "i").test(node.trim()) ? node : `${node} ${word}`;
}

export function useScope(): ResolvedScope {
  const user = useAuthStore((s) => s.user);

  const role = user && typeof user.role === "object" ? user.role : null;
  const roleName = (role?.name || "").toLowerCase().replace(/\s+/g, "_");
  const al = role?.accessLevel ?? null;

  let tier: AccessTier | null = null;
  const rawTier = (al?.slug || al?.name || "").toLowerCase();
  if (rawTier in RANK_BY_TIER) tier = rawTier as AccessTier;

  let rank =
    typeof al?.rank === "number" && al.rank > 0
      ? al.rank
      : tier
        ? RANK_BY_TIER[tier]
        : 100;

  let levelName = al?.name ?? null;

  if (roleName === "super_admin") {
    tier = "national";
    rank = 10;
    levelName = levelName || "National";
  }

  const loc = user?.location ?? null;
  const node =
    tier === "school"
      ? loc?.schoolName || null
      : tier === "sector"
        ? loc?.sector || null
        : tier === "district"
          ? loc?.district || null
          : tier === "province"
            ? loc?.province || null
            : null;

  const isNational = !tier || tier === "national" || rank <= 10;

  const label = isNational
    ? "National"
    : node
      ? withTier(node, tier!)
      : (levelName ?? tier!.charAt(0).toUpperCase() + tier!.slice(1));

  return { tier, rank, levelName, node, label, isNational };
}

type ScopeUser = {
  role?: unknown;
  location?: { schoolId?: string } | null;
} | null | undefined;

function roleOf(user: ScopeUser) {
  const r = user?.role;
  return r && typeof r === "object"
    ? (r as {
        name?: string;
        permissions?: string[];
        accessLevel?: { slug?: string | null; name?: string } | null;
      })
    : null;
}

/**
 * True for school-tier users bound to a school (WS3.6): their role's access
 * level is School and their location carries a schoolId.
 */
export function isSchoolLevelUser(user: ScopeUser): boolean {
  const al = roleOf(user)?.accessLevel;
  const tier = (al?.slug || al?.name || "").toLowerCase();
  return tier === "school" && !!user?.location?.schoolId;
}

/**
 * Where a user lands after login or on "/" (WS3.6): school leaders go to
 * their school dashboard, national/sub-national roles to the national
 * dashboard, and anyone without dashboard access to the welcome page.
 */
export function homePathFor(user: ScopeUser): string {
  const role = roleOf(user);
  const perms = role?.permissions ?? [];
  const superAdmin =
    (role?.name || "").toLowerCase().replace(/\s+/g, "_") === "super_admin";
  const can = (p: string) => superAdmin || perms.includes(p);
  if (isSchoolLevelUser(user) && can("SCHOOL_LEVEL_DASHBOARD"))
    return "/school-dashboard";
  if (can("VIEW_DASHBOARD")) return "/";
  return "/welcome";
}
