import { useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { basemapById, type BasemapId } from "../maps/schoolMap";
import { parseRange, parseView, type ScoreRange, type MapView } from "./geo";
import { DEFAULT_OVERLAYS, type OverlayId, type SortKey } from "./types";

const OVERLAYS: OverlayId[] = ["provinces", "districts", "labels", "lake", "focus", "clusters", "density"];
const SORTS: SortKey[] = ["priority", "score-asc", "score-desc", "name"];

export interface MapUrlState {
  priorities: Set<string>;
  province: string;
  district: string;
  range: ScoreRange;
  sort: SortKey;
  inViewOnly: boolean;
  schoolId: string | null;
  basemap: BasemapId;
  overlays: Set<OverlayId>;
  view: MapView | null;
  /** Raw `v` string, to tell our own writes from back/forward navigation. */
  viewRaw: string | null;
}

/**
 * Every shareable bit of the map (filters, selection, basemap, layers, view)
 * lives in the query string. Filter/selection changes push a history entry
 * (so back/forward steps through them); camera moves replace the current one.
 *
 * Patches read `window.location.search` fresh so several patches in the same
 * tick compose instead of overwriting each other.
 */
export function useMapUrlState() {
  const location = useLocation();
  const navigate = useNavigate();

  const state = useMemo<MapUrlState>(() => {
    const p = new URLSearchParams(location.search);
    const list = (k: string) => (p.get(k) ?? "").split(",").filter(Boolean);
    const layersRaw = p.get("layers");
    const sort = p.get("sort") as SortKey | null;
    return {
      priorities: new Set(list("priority")),
      province: p.get("province") ?? "",
      district: p.get("district") ?? "",
      range: parseRange(p.get("score")),
      sort: sort && SORTS.includes(sort) ? sort : "priority",
      inViewOnly: p.get("inview") === "1",
      schoolId: p.get("school"),
      basemap: basemapById(p.get("base")).id,
      overlays: new Set(
        layersRaw === null
          ? DEFAULT_OVERLAYS
          : (layersRaw.split(",").filter((l) => OVERLAYS.includes(l as OverlayId)) as OverlayId[]),
      ),
      view: parseView(p.get("v")),
      viewRaw: p.get("v"),
    };
  }, [location.search]);

  const patch = useCallback(
    (next: Record<string, string | null>, { replace = false } = {}) => {
      const p = new URLSearchParams(window.location.search);
      for (const [k, v] of Object.entries(next)) {
        if (v == null || v === "") p.delete(k);
        else p.set(k, v);
      }
      const search = p.toString();
      if (search === window.location.search.replace(/^\?/, "")) return;
      navigate({ pathname: location.pathname, search: search ? `?${search}` : "" }, { replace });
    },
    [navigate, location.pathname],
  );

  return { state, patch };
}

/** Serialises an overlay set; null when it equals the defaults (keeps URLs short). */
export function overlaysParam(set: Set<OverlayId>): string | null {
  const same =
    set.size === DEFAULT_OVERLAYS.length && DEFAULT_OVERLAYS.every((o) => set.has(o));
  if (same) return null;
  return OVERLAYS.filter((o) => set.has(o)).join(",") || "none";
}
