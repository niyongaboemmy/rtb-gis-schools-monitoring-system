/**
 * Partner key access levels as the TDMP admin page shows and edits them.
 * Mirrors server/src/modules/partner/partner-access.ts.
 */
export type AccessTier = "national" | "province" | "district" | "schools";

export interface PartnerKey {
  id: string;
  name: string;
  partner: string;
  keyPrefix: string;
  scopes: string[];
  allowedOrigins: string[];
  accessTier?: AccessTier;
  accessProvince?: string | null;
  accessDistrict?: string | null;
  accessSchoolCodes?: string[] | null;
  allowedViews?: string[];
  createdBy: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface AccessValue {
  accessTier: AccessTier;
  accessProvince: string;
  accessDistrict: string;
  accessSchoolCodes: string;
  allowedViews: string[];
}

export const VIEWS: Array<{ id: string; label: string }> = [
  { id: "school-dashboard", label: "Dashboard" },
  { id: "school-map-2d", label: "2D map" },
  { id: "school-map-3d", label: "3D model" },
  { id: "national-map", label: "National map" },
];
export const ALL_VIEWS = VIEWS.map((v) => v.id);

/** One line for a key's reach, e.g. "Muhanga district". */
export function accessSummary(k: Pick<PartnerKey, "accessTier" | "accessProvince" | "accessDistrict" | "accessSchoolCodes">): string {
  switch (k.accessTier ?? "national") {
    case "province":
      return `${k.accessProvince} province`;
    case "district":
      return `${k.accessDistrict} district${k.accessProvince ? ` (${k.accessProvince})` : ""}`;
    case "schools":
      return `${k.accessSchoolCodes?.length ?? 0} school(s): ${(k.accessSchoolCodes ?? []).slice(0, 4).join(", ")}${(k.accessSchoolCodes?.length ?? 0) > 4 ? "…" : ""}`;
    default:
      return "All schools (national)";
  }
}

export const viewsOf = (k: Pick<PartnerKey, "allowedViews">) => (k.allowedViews?.length ? k.allowedViews : ALL_VIEWS);

export const fromKey = (k?: PartnerKey): AccessValue => ({
  accessTier: k?.accessTier ?? "national",
  accessProvince: k?.accessProvince ?? "",
  accessDistrict: k?.accessDistrict ?? "",
  accessSchoolCodes: (k?.accessSchoolCodes ?? []).join("\n"),
  allowedViews: k ? viewsOf(k) : ALL_VIEWS,
});

/** The access level as the API expects it. */
export function toPayload(v: AccessValue) {
  return {
    accessTier: v.accessTier,
    ...(v.accessTier === "province" || v.accessTier === "district" ? { accessProvince: v.accessProvince } : {}),
    ...(v.accessTier === "district" ? { accessDistrict: v.accessDistrict } : {}),
    ...(v.accessTier === "schools" ? { accessSchoolCodes: v.accessSchoolCodes.split(/[\s,;]+/).filter(Boolean) } : {}),
    allowedViews: v.allowedViews,
  };
}

/** Is the access level complete enough to save? */
export function accessReady(v: AccessValue): boolean {
  if (!v.allowedViews.length) return false;
  if (v.accessTier === "province") return !!v.accessProvince;
  if (v.accessTier === "district") return !!v.accessProvince && !!v.accessDistrict;
  if (v.accessTier === "schools") return v.accessSchoolCodes.split(/[\s,;]+/).filter(Boolean).length > 0;
  return true;
}

