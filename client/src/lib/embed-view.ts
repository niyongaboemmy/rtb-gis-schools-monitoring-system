import { createContext, useContext } from "react";
import { useLocation } from "react-router-dom";
import { viewerLink } from "./viewer-tools";

/** The embedded views (mirrors server partner-embed.ts EMBED_VIEWS). */
export type EmbedView = "school-dashboard" | "school-map-2d" | "school-map-3d" | "national-map" | "national-dashboard";

export const SCHOOL_EMBED_VIEWS = ["school-dashboard", "school-map-2d", "school-map-3d"] as const;
export const isSchoolEmbedView = (v: string | null | undefined): v is (typeof SCHOOL_EMBED_VIEWS)[number] =>
  (SCHOOL_EMBED_VIEWS as readonly string[]).includes(v ?? "");

/**
 * Set inside an embedded view (/embed/*): the one view this page is. Viewers
 * use it to hide what belongs to other views (2D ↔ 3D switch, dashboard tab).
 * null everywhere else in the app.
 */
export const EmbedViewContext = createContext<EmbedView | null>(null);

export const useEmbedView = (): EmbedView | null => useContext(EmbedViewContext);

/**
 * Inside an embedded national view: the school views a school opened from it
 * may show (the partner key's school views). null outside embeds.
 */
export const EmbedDrillContext = createContext<readonly EmbedView[] | null>(null);

/** A school page: its overview (decision dashboard), 2D map or 3D model. */
export type SchoolTarget = "dashboard" | "map-2d" | "map-3d";

const TARGET_VIEW: Record<SchoolTarget, EmbedView> = {
  dashboard: "school-dashboard",
  "map-2d": "school-map-2d",
  "map-3d": "school-map-3d",
};

/** Router state a drilled-into school view uses for its "Back" button. */
export interface EmbedNavState {
  embedFrom?: string;
}

/**
 * Where a link to a school should go. In the app: the school's own page.
 * Inside an embedded national view: the embedded school view, so the user
 * stays in the iframe (`target` first, else another view the link allows),
 * or null when the link allows no school view (hide the link).
 */
export function useSchoolLink() {
  const view = useEmbedView();
  const drill = useContext(EmbedDrillContext);
  const { pathname, search } = useLocation();
  const embedded = view !== null;
  const state: EmbedNavState | undefined = embedded ? { embedFrom: pathname + search } : undefined;

  const href = (id: string, target: SchoolTarget): string | null => {
    if (!embedded) {
      if (target === "dashboard") return `/schools/${id}/decision`;
      return viewerLink(target === "map-3d" ? "3d" : "2d", id);
    }
    // A school view never opens another school.
    if (isSchoolEmbedView(view)) return null;
    const allowed = drill ?? [];
    if (allowed.includes(TARGET_VIEW[target])) return `/embed/schools/${id}/${target}`;
    return null;
  };

  /** `target`, or the first school view the link allows (for "Open school"). */
  const hrefOrFallback = (id: string, target: SchoolTarget): string | null => {
    const order: SchoolTarget[] = [target, ...(["dashboard", "map-2d", "map-3d"] as const).filter((t) => t !== target)];
    for (const t of order) {
      const h = href(id, t);
      if (h) return h;
      if (!embedded) break;
    }
    return null;
  };

  /**
   * Where a school link goes and how. In the app: the school's page. In an
   * embedded national view: the embedded school view when the link allows
   * it (`fallback`: any allowed view), otherwise the school in RTB GIS in a
   * NEW TAB (TDMP sign-in, then that school) — the iframe never navigates
   * away, which partner pages treat as leaving the embed. null: no link.
   */
  const open = (
    school: { id: string; code?: string | null },
    target: SchoolTarget,
    fallback = true,
  ): SchoolLinkTarget | null => {
    const inside = fallback ? hrefOrFallback(school.id, target) : href(school.id, target);
    if (inside) return { to: inside, newTab: false };
    if (!embedded || !school.code) return null;
    return { to: `${window.location.origin}/sso/tdmp?school=${encodeURIComponent(school.code)}`, newTab: true };
  };

  return { href, hrefOrFallback, open, state, embedded };
}

/** A school link: a path inside the app / embed, or an RTB GIS page for a new tab. */
export interface SchoolLinkTarget {
  to: string;
  newTab: boolean;
}

/** Props for `<Link>` from a SchoolLinkTarget (new tab: external, no opener). */
export function schoolLinkProps(t: SchoolLinkTarget, state?: EmbedNavState) {
  return t.newTab ? { to: t.to, target: "_blank", rel: "noopener noreferrer" } : { to: t.to, state };
}
