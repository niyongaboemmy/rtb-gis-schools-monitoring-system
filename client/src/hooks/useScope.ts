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
      ? `${node} ${tier!.charAt(0).toUpperCase()}${tier!.slice(1)}`
      : (levelName ?? tier!.charAt(0).toUpperCase() + tier!.slice(1));

  return { tier, rank, levelName, node, label, isNational };
}
