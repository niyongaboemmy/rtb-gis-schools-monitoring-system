import { schoolPoint } from "../lib/school-location";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type L from "leaflet";
import { X } from "lucide-react";
import { api } from "../lib/api";
import { cn } from "../lib/utils";
import { formatNumber, formatScore } from "../lib/format";
import { hasPermission, Permission } from "../lib/permissions";
import { useAuthStore } from "../store/authStore";
import { calculatedScore, useSchoolsStore, type School } from "../store/schoolsStore";
import { useToast } from "../components/ui/toast";
import { basemapById, useEffectiveTheme, type BasemapId } from "../components/maps/schoolMap";
import type { HierarchyItem, NationalOverview } from "../components/dashboard/types";
import { MapCanvas } from "../components/national-map/MapCanvas";
import { CommandBar, type SearchHit } from "../components/national-map/CommandBar";
import { PanelBody } from "../components/national-map/PanelBody";
import { BottomSheet, SidePanel, type SheetSnap } from "../components/national-map/Panels";
import { SchoolCardBody } from "../components/national-map/SchoolCard";
import { ProvinceCardBody } from "../components/national-map/ProvinceCard";
import { LayersPanel } from "../components/national-map/LayersPanel";
import { ToolRail } from "../components/national-map/ToolRail";
import { Legend, MapStateCard, ToolHud } from "../components/national-map/Hud";
import { useMapRegion } from "../components/national-map/region";
import { isFullRange, nearest, normProvince, type LatLng, type ScoreRange } from "../components/national-map/geo";
import { overlaysParam, useMapUrlState } from "../components/national-map/useMapUrlState";
import { EASE, GLASS_STRONG, MUTED, STRONG, isTyping, useBreakpoint } from "../components/national-map/tokens";
import type { OverlayId, PlottedSchool, ProvinceSummary, SortKey, ToolMode, ViewRequest, ViewRequestInput } from "../components/national-map/types";

const RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const RECENT_KEY = "rtb-natmap-recent";
const num = (v: unknown) => {
  const n = Number(v);
  return v === null || v === undefined || v === "" || !Number.isFinite(n) ? null : n;
};

function toPlotted(s: School): PlottedSchool | null {
  // Only real points in Rwanda are plotted (not 0,0, swapped or abroad).
  const p = schoolPoint(s);
  if (!p) return null;
  const { lat, lng } = p;
  return {
    school: s,
    lat,
    lng,
    score: s.overallScore == null || (s.overallScore as unknown) === "" ? null : calculatedScore(s),
    priority: (s.priorityLevel ?? "").toLowerCase(),
  };
}

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 6) : [];
  } catch {
    return [];
  }
}

/** Counts + average score per group (only figures this page already showed). */
function summarise(label: string, pts: PlottedSchool[]) {
  const scored = pts.filter((p) => p.score !== null);
  const by = (k: string) => pts.filter((p) => p.priority === k).length;
  return {
    label,
    total: pts.length,
    avgScore: scored.length ? scored.reduce((s, p) => s + (p.score ?? 0), 0) / scored.length : null,
    critical: by("critical"),
    high: by("high"),
    medium: by("medium"),
    low: by("low"),
  };
}

export default function NationalMap() {
  const toast = useToast();
  const reduce = !!useReducedMotion();
  const theme = useEffectiveTheme();
  const bp = useBreakpoint();
  const phone = bp === "phone";
  const desktop = bp === "desktop";
  const { user } = useAuthStore();
  const canAnalytics = hasPermission(user, Permission.VIEW_ANALYTICS);
  const canDecision = hasPermission(user, Permission.VIEW_INTELLIGENCE);
  const can3d = hasPermission(user, Permission.SCHOOL_VIEW_2D3D_MAP);

  const { allSchools, allSchoolsLoading, allSchoolsLoaded, fetchAllSchools, invalidateAllSchools } = useSchoolsStore();
  const { state: url, patch } = useMapUrlState();
  const region = useMapRegion();

  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const nonce = useRef(0);
  const [cursorEl, setCursorEl] = useState<HTMLSpanElement | null>(null);

  const [hoverId, setHoverId] = useState<string | null>(null);
  const [bounds, setBounds] = useState<L.LatLngBounds | null>(null);
  // Starts closed so the country gets the whole stage; Filters opens it.
  const [panelOpen, setPanelOpen] = useState(false);
  // Priority band under the pointer in the legend: the map spotlights it.
  const [focusBand, setFocusBand] = useState<string | null>(null);
  // Province lit (not selected) while pointing at a chip or search result.
  const [previewProvince, setPreviewProvince] = useState<string | null>(null);
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>("peek");
  const [layersOpen, setLayersOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(() => typeof window === "undefined" || window.innerWidth >= 768);
  const [tool, setTool] = useState<ToolMode>("none");
  const [measurePts, setMeasurePts] = useState<LatLng[]>([]);
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [me, setMe] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [isFs, setIsFs] = useState(false);
  const [provinceCard, setProvinceCard] = useState<string | null>(null);
  const [viewRequest, setViewRequest] = useState<ViewRequest | null>(null);
  const [recentIds, setRecentIds] = useState<string[]>(readRecent);
  const [overview, setOverview] = useState<NationalOverview | null>(null);
  // A shared ?school= link (without a view) centres on that school on load.
  const [initialFocusId] = useState(() => (url.view ? null : url.schoolId));

  useEffect(() => {
    void fetchAllSchools();
  }, [fetchAllSchools]);

  // Province aggregates (server) — only for roles that may read analytics.
  useEffect(() => {
    if (!canAnalytics) return;
    let alive = true;
    api
      .get<NationalOverview>("/analytics/overview")
      .then((r) => alive && setOverview(r.data))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [canAnalytics]);

  /* ───────────────────────── derived data ───────────────────────── */

  const plottedAll = useMemo(
    () =>
      allSchools
        // Operating network only — inactive / under-renovation schools are hidden.
        .filter((s) => (s.status ?? "active") === "active")
        .map(toPlotted)
        .filter((p): p is PlottedSchool => p !== null),
    [allSchools],
  );

  const provinces = useMemo(() => {
    const names = new Set(plottedAll.map((p) => p.school.province).filter(Boolean));
    return [...names].sort();
  }, [plottedAll]);

  // Panel chips: every province on the map (even empty ones), with counts.
  const provinceChips = useMemo(() => {
    const names = region?.provinces.map((p) => p.name) ?? provinces;
    return names.map((name) => ({
      name,
      count: plottedAll.filter((p) => normProvince(p.school.province) === normProvince(name)).length,
    }));
  }, [region, provinces, plottedAll]);

  const districtCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const p of plottedAll) if (p.school.district) out[p.school.district] = (out[p.school.district] ?? 0) + 1;
    return out;
  }, [plottedAll]);

  const byArea = useMemo(() => {
    const pk = normProvince(url.province);
    return plottedAll.filter(
      (p) => (!pk || normProvince(p.school.province) === pk) && (!url.district || p.school.district === url.district),
    );
  }, [plottedAll, url.province, url.district]);

  const districts = useMemo(() => {
    const pk = normProvince(url.province);
    return [
      ...new Set(plottedAll.filter((p) => !pk || normProvince(p.school.province) === pk).map((p) => p.school.district).filter(Boolean)),
    ].sort();
  }, [plottedAll, url.province]);

  const inRange = useCallback(
    (p: PlottedSchool, r: ScoreRange) => isFullRange(r) || (p.score !== null && p.score >= r[0] && p.score <= r[1]),
    [],
  );

  const priorityCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of byArea) if (inRange(p, url.range)) c[p.priority] = (c[p.priority] ?? 0) + 1;
    return c;
  }, [byArea, url.range, inRange]);

  const filtered = useMemo(
    () =>
      byArea.filter(
        (p) => (url.priorities.size === 0 || url.priorities.has(p.priority)) && inRange(p, url.range),
      ),
    [byArea, url.priorities, url.range, inRange],
  );

  const sorted = useMemo(() => {
    const by: Record<SortKey, (a: PlottedSchool, b: PlottedSchool) => number> = {
      priority: (a, b) => (RANK[a.priority] ?? 9) - (RANK[b.priority] ?? 9) || (a.score ?? 101) - (b.score ?? 101),
      "score-asc": (a, b) => (a.score ?? 101) - (b.score ?? 101),
      "score-desc": (a, b) => (b.score ?? -1) - (a.score ?? -1),
      name: (a, b) => a.school.name.localeCompare(b.school.name),
    };
    return [...filtered].sort(by[url.sort]);
  }, [filtered, url.sort]);

  const inView = useMemo(
    () => (bounds ? sorted.filter((p) => bounds.contains([p.lat, p.lng])) : sorted),
    [bounds, sorted],
  );
  const list = url.inViewOnly ? inView : sorted;

  const scored = filtered.filter((p) => p.score !== null);
  const avgScore = scored.length ? scored.reduce((s, p) => s + (p.score ?? 0), 0) / scored.length : null;

  const selected = useMemo(
    () => (url.schoolId ? (plottedAll.find((p) => p.school.id === url.schoolId) ?? null) : null),
    [plottedAll, url.schoolId],
  );
  const selectedHidden = !!selected && !filtered.some((p) => p.school.id === selected.school.id);
  const mapPoints = useMemo(
    () => (selected && selectedHidden ? [...filtered, selected] : filtered),
    [filtered, selected, selectedHidden],
  );

  const nearby = useMemo(
    () => (selected ? nearest([selected.lat, selected.lng], plottedAll, 3, (p) => p.school.id === selected.school.id) : []),
    [selected, plottedAll],
  );
  const nearestHits = useMemo(
    () => (origin && tool === "nearest" ? nearest(origin, filtered, 5).map((n) => ({ point: n.point, meters: n.meters })) : []),
    [origin, tool, filtered],
  );

  const provinceSummaries = useMemo<ProvinceSummary[]>(() => {
    if (overview?.provinceStats?.length) {
      return overview.provinceStats.map((p) => ({ ...p, avgScore: num(p.avgScore) }));
    }
    const groups = new Map<string, PlottedSchool[]>();
    for (const p of plottedAll) {
      const k = p.school.province;
      if (!k) continue;
      groups.set(k, [...(groups.get(k) ?? []), p]);
    }
    return [...groups.entries()].map(([name, pts]) => {
      const { label: province, ...rest } = summarise(name, pts);
      return { province, ...rest };
    });
  }, [overview, plottedAll]);

  const provinceSummary = useMemo(() => {
    if (!provinceCard) return null;
    const hit = provinceSummaries.find((s) => normProvince(s.province) === normProvince(provinceCard));
    return hit ?? { province: provinceCard, total: 0, avgScore: null, critical: 0, high: 0, medium: 0, low: 0 };
  }, [provinceCard, provinceSummaries]);

  const localDistricts = useMemo<HierarchyItem[] | null>(() => {
    if (canAnalytics || !provinceCard) return null;
    const pk = normProvince(provinceCard);
    const groups = new Map<string, PlottedSchool[]>();
    for (const p of plottedAll) {
      if (normProvince(p.school.province) !== pk || !p.school.district) continue;
      groups.set(p.school.district, [...(groups.get(p.school.district) ?? []), p]);
    }
    return [...groups.entries()].map(([d, pts]) => {
      const s = summarise(d, pts);
      return { ...s, avgScore: s.avgScore ?? (null as unknown as number) };
    });
  }, [canAnalytics, provinceCard, plottedAll]);

  const recent = useMemo(
    () => recentIds.map((id) => plottedAll.find((p) => p.school.id === id)).filter((p): p is PlottedSchool => !!p),
    [recentIds, plottedAll],
  );

  const activeFilters =
    (url.priorities.size > 0 ? 1 : 0) + (url.province ? 1 : 0) + (url.district ? 1 : 0) + (isFullRange(url.range) ? 0 : 1);

  const loading = allSchoolsLoading && !allSchoolsLoaded;
  // The store swallows fetch errors: neither loading nor loaded → it failed.
  const loadFailed = !allSchoolsLoading && !allSchoolsLoaded;

  /* ───────────────────────── layout ───────────────────────── */

  const showPanel = !phone && panelOpen;
  const cardOpen = !!selected || !!provinceSummary;
  // Phones: keep fly targets above the half-open bottom sheet.
  const sheetCover = typeof window === "undefined" ? 300 : Math.round((window.innerHeight - 56 - 68) * 0.55) + 16;
  const padFor = useCallback(
    (card: boolean, panel: boolean): [number, number, number, number] =>
      phone
        ? [120, 24, sheetCover, 24]
        : [84, card ? (desktop ? 410 : 390) : 80, 40, panel ? (desktop ? 400 : 370) : 40],
    [phone, desktop, sheetCover],
  );
  const padding = padFor(cardOpen, showPanel);

  /* ───────────────────────── actions ───────────────────────── */

  const request = useCallback((r: ViewRequestInput) => {
    nonce.current += 1;
    setViewRequest({ ...r, nonce: nonce.current } as ViewRequest);
  }, []);

  const remember = useCallback((id: string) => {
    setRecentIds((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, 6);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable — recent list stays in memory */
      }
      return next;
    });
  }, []);

  const selectSchool = useCallback(
    (p: PlottedSchool, { fly = true } = {}) => {
      patch({ school: p.school.id });
      remember(p.school.id);
      setProvinceCard(null);
      // Pad for the layout after this selection (card open; tablet panel closed).
      if (fly) request({ kind: "fly", center: [p.lat, p.lng], zoom: 14, pad: padFor(true, bp === "desktop" && panelOpen) });
      if (bp === "tablet") setPanelOpen(false);
      if (phone) setSheetSnap("half");
    },
    [patch, remember, request, bp, phone, padFor, panelOpen],
  );

  const closeSchool = useCallback(() => {
    patch({ school: null });
    if (phone) setSheetSnap("peek");
  }, [patch, phone]);

  const onMarker = useCallback(
    (p: PlottedSchool) => {
      if (tool === "distance" || tool === "area") return setMeasurePts((pts) => [...pts, [p.lat, p.lng]]);
      if (tool === "nearest") return setOrigin([p.lat, p.lng]);
      if (p.school.id === url.schoolId) return closeSchool();
      selectSchool(p, { fly: false });
    },
    [tool, url.schoolId, selectSchool, closeSchool],
  );

  /** Fly to a province's outline (or back to all of Rwanda for none). */
  const flyToProvince = useCallback(
    (name: string | null) => {
      const shape = name ? region?.provinces.find((p) => normProvince(p.name) === normProvince(name)) : null;
      if (shape) request({ kind: "bounds", bounds: shape.bounds, maxZoom: 11 });
      else request({ kind: "rwanda" });
    },
    [region, request],
  );

  const openProvince = useCallback(
    (name: string) => {
      patch({ province: name, district: null, school: null });
      setProvinceCard(name);
      setPreviewProvince(null);
      if (phone) setSheetSnap("half");
      flyToProvince(name);
    },
    [patch, phone, flyToProvince],
  );

  /** Province filter from the panel: filter, fly there, keep the list in view. */
  const pickProvince = useCallback(
    (name: string) => {
      patch({ province: name || null, district: null });
      setPreviewProvince(null);
      flyToProvince(name || null);
    },
    [patch, flyToProvince],
  );

  const pickDistrict = useCallback(
    (d: string) => {
      if (!d) {
        patch({ district: null });
        return flyToProvince(url.province || null);
      }
      const pts = plottedAll.filter((p) => p.school.district === d);
      patch({ district: d, province: pts[0]?.school.province ?? url.province ?? null });
      if (pts.length) {
        const lats = pts.map((p) => p.lat);
        const lngs = pts.map((p) => p.lng);
        request({
          kind: "bounds",
          bounds: [
            [Math.min(...lats) - 0.08, Math.min(...lngs) - 0.08],
            [Math.max(...lats) + 0.08, Math.max(...lngs) + 0.08],
          ],
          maxZoom: 11,
        });
      }
    },
    [patch, plottedAll, request, url.province, flyToProvince],
  );

  const onSearchPick = useCallback(
    (hit: SearchHit) => {
      if (hit.kind === "school") selectSchool(hit.point);
      else if (hit.kind === "district") {
        setProvinceCard(null);
        pickDistrict(hit.name);
        if (!phone) setPanelOpen(true);
      } else openProvince(hit.name);
    },
    [selectSchool, pickDistrict, openProvince, phone],
  );

  // Moving through search results previews them: a province lights up, a
  // school's pin is singled out.
  const onSearchPreview = useCallback((hit: SearchHit | null) => {
    setPreviewProvince(hit?.kind === "province" ? hit.name : null);
    setHoverId(hit?.kind === "school" ? hit.point.school.id : null);
  }, []);

  const resetFilters = useCallback(() => {
    patch({ priority: null, province: null, district: null, score: null });
    if (url.province || url.district) request({ kind: "rwanda" });
  }, [patch, request, url.province, url.district]);

  const togglePriority = useCallback(
    (key: string) => {
      const next = new Set(url.priorities);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      patch({ priority: [...next].join(",") || null });
    },
    [url.priorities, patch],
  );

  const setOverlay = (o: OverlayId, on: boolean) => {
    const next = new Set(url.overlays);
    if (on) next.add(o);
    else next.delete(o);
    patch({ layers: overlaysParam(next) });
  };

  const changeTool = (t: ToolMode) => {
    setTool(t);
    setMeasurePts([]);
    setOrigin(null);
    if (t !== "none") setLayersOpen(false);
  };

  const onToolPoint = useCallback(
    (pt: LatLng) => {
      if (tool === "nearest") setOrigin(pt);
      else setMeasurePts((pts) => [...pts, pt]);
    },
    [tool],
  );

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("Location is not available in this browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setMe({ lat: latitude, lng: longitude, acc: accuracy });
        request({ kind: "fly", center: [latitude, longitude], zoom: 13 });
        setLocating(false);
      },
      () => {
        setLocating(false);
        toast.error("Could not get your location. Check the browser's location permission.");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [request, toast]);

  const toggleFs = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen?.();
  }, []);

  useEffect(() => {
    const on = () => setIsFs(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  const onView = useCallback(
    (v: string) => {
      if (v !== new URLSearchParams(window.location.search).get("v")) patch({ v }, { replace: true });
    },
    [patch],
  );
  const onBounds = useCallback((b: L.LatLngBounds) => setBounds(b), []);

  /* ───────────────────────── keyboard ───────────────────────── */

  const escRef = useRef<() => boolean>(() => false);
  const togglePriorityRef = useRef(togglePriority);
  useEffect(() => {
    togglePriorityRef.current = togglePriority;
  });
  useEffect(() => {
    escRef.current = () => {
      if (tool !== "none") return changeTool("none"), true;
      if (layersOpen) return setLayersOpen(false), true;
      if (selected) return closeSchool(), true;
      if (provinceCard) return setProvinceCard(null), true;
      if (phone && sheetSnap !== "peek") return setSheetSnap("peek"), true;
      if (bp === "tablet" && panelOpen) return setPanelOpen(false), true;
      return false;
    };
  });

  useEffect(() => {
    // Capture phase on window: runs before the app-wide ⌘K palette listener.
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        e.stopImmediatePropagation();
        searchRef.current?.focus();
        return;
      }
      if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "Escape") {
        if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
        if (escRef.current()) e.preventDefault();
      } else if (e.key === "f" || e.key === "F") {
        toggleFs();
      } else if (e.key === "l" || e.key === "L") {
        setLayersOpen((v) => !v);
      } else if (e.key === "r" || e.key === "R") {
        request({ kind: "rwanda" });
      } else if (e.key >= "1" && e.key <= "4") {
        togglePriorityRef.current((["critical", "high", "medium", "low"] as const)[Number(e.key) - 1]);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [toggleFs, request]);

  /* ───────────────────────── render ───────────────────────── */

  const panelProps = {
    loading,
    total: plottedAll.length,
    filteredCount: filtered.length,
    inViewCount: inView.length,
    avgScore,
    scoredCount: scored.length,
    priorityCounts,
    priorities: url.priorities,
    onTogglePriority: togglePriority,
    provinceChips,
    province: url.province,
    onProvince: pickProvince,
    onPreviewProvince: setPreviewProvince,
    onFocusBand: setFocusBand,
    districts,
    district: url.district,
    onDistrict: (d: string) => pickDistrict(d),
    range: url.range,
    onRange: (r: ScoreRange) => patch({ score: isFullRange(r) ? null : `${r[0]}-${r[1]}` }, { replace: true }),
    sort: url.sort,
    onSort: (s: SortKey) => patch({ sort: s === "priority" ? null : s }),
    inViewOnly: url.inViewOnly,
    onInViewOnly: (v: boolean) => patch({ inview: v ? "1" : null }),
    list,
    selectedId: url.schoolId,
    hoverId,
    onHover: setHoverId,
    onSelect: (p: PlottedSchool) => selectSchool(p),
    activeFilters,
    onReset: resetFilters,
  };

  const schoolCard = selected && (
    <SchoolCardBody
      point={selected}
      nearby={nearby}
      canDecision={canDecision}
      can3d={can3d}
      filteredOut={selectedHidden}
      onClose={closeSchool}
      onZoom={() => request({ kind: "fly", center: [selected.lat, selected.lng], zoom: 16 })}
      onPick={(p) => selectSchool(p)}
      hideClose={phone}
    />
  );
  const provinceCardEl = !selected && provinceSummary && (
    <ProvinceCardBody
      summary={provinceSummary}
      district={url.district}
      localDistricts={localDistricts}
      onDistrict={pickDistrict}
      onShowList={() => {
        setProvinceCard(null);
        if (phone) setSheetSnap("half");
        else setPanelOpen(true);
      }}
      onClear={() => {
        patch({ province: null, district: null });
        setProvinceCard(null);
        request({ kind: "rwanda" });
      }}
      onClose={() => setProvinceCard(null)}
      hideClose={phone}
    />
  );

  const subtitle = `${formatNumber(filtered.length)} of ${formatNumber(plottedAll.length)} schools${activeFilters ? ` · ${activeFilters} ${activeFilters === 1 ? "filter" : "filters"}` : ""}`;
  const legendCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of filtered) c[p.priority] = (c[p.priority] ?? 0) + 1;
    return c;
  }, [filtered]);
  const unassessed = filtered.filter((p) => !(p.priority in RANK)).length;
  const basemapLabel = `${basemapById(url.basemap).id === "satellite" ? "© Esri, Maxar" : "© Esri, OpenStreetMap"} · Boundaries © NISR`;

  return (
    <div
      ref={rootRef}
      className={cn(
        "nm-root isolate overflow-hidden bg-[#eef2f7] text-foreground dark:bg-[#04070e]",
        isFs ? "fixed inset-0" : "fixed bottom-0 left-[var(--app-shell-inset,0px)] right-0 top-14 z-0 transition-[left] duration-200",
      )}
    >
      {/* Map */}
      <div className="absolute inset-0 z-0">
        <MapCanvas
          theme={theme}
          basemap={url.basemap as BasemapId}
          overlays={url.overlays}
          region={region}
          points={mapPoints}
          selectedId={url.schoolId}
          hoverId={hoverId}
          focusBand={focusBand}
          previewProvince={previewProvince}
          activeProvince={url.province}
          provinceSummaries={provinceSummaries}
          tool={tool}
          measurePoints={measurePts}
          nearestOrigin={origin}
          nearestTargets={nearestHits.map((n) => [n.point.lat, n.point.lng] as LatLng)}
          me={me}
          viewRequest={viewRequest}
          initialView={url.view}
          pendingFocus={selected && selected.school.id === initialFocusId ? [selected.lat, selected.lng] : null}
          expectFocus={!!initialFocusId && !allSchoolsLoaded && !loadFailed}
          padding={padding}
          reduceMotion={reduce}
          cursorTarget={cursorEl}
          onSelect={onMarker}
          onHover={setHoverId}
          onProvinceClick={openProvince}
          districtCounts={districtCounts}
          activeDistrict={url.district}
          onDistrictClick={(d) => {
            setProvinceCard(null);
            pickDistrict(d);
          }}
          onToolPoint={onToolPoint}
          onView={onView}
          onBounds={onBounds}
        />
      </div>

      {/* Overlays: pointer events pass through empty space to the map. */}
      <div className="pointer-events-none absolute inset-0 z-10">
        {/* Command bar */}
        <div
          className={cn(
            "absolute flex justify-center",
            phone ? "inset-x-3 top-3" : desktop ? "right-[76px] top-4" : "inset-x-3 top-3",
          )}
          style={desktop ? { left: showPanel ? 392 : 16 } : undefined}
        >
          <CommandBar
            points={plottedAll}
            provinceNames={region?.provinces.map((p) => p.name) ?? provinces}
            recent={recent}
            total={filtered.length}
            inView={inView.length}
            compact={phone}
            panelOpen={phone ? sheetSnap !== "peek" && !cardOpen : panelOpen}
            activeFilters={activeFilters}
            inputRef={searchRef}
            onPick={onSearchPick}
            onPreview={onSearchPreview}
            onTogglePanel={() => {
              if (phone) {
                if (selected) closeSchool();
                setProvinceCard(null);
                setSheetSnap((s) => (s === "peek" || cardOpen ? "half" : "peek"));
              } else setPanelOpen((v) => !v);
            }}
          />
        </div>

        {/* Tools */}
        <ToolRail
          horizontal={phone}
          tool={tool}
          layersOpen={layersOpen}
          legendOpen={legendOpen}
          fullscreen={isFs}
          locating={locating}
          located={!!me}
          onZoom={(d) => request({ kind: "zoom", delta: d })}
          onReset={() => request({ kind: "rwanda" })}
          onLocate={locate}
          onTool={changeTool}
          onLayers={() => setLayersOpen((v) => !v)}
          onLegend={() => setLegendOpen((v) => !v)}
          onFullscreen={toggleFs}
          className={cn(
            "absolute",
            phone ? "left-3 right-3 top-[64px] w-fit max-w-[calc(100%-1.5rem)] ml-auto" : desktop ? "right-4 top-4" : "right-3 top-[76px]",
          )}
        />

        {/* Side panel (tablet / desktop) */}
        {!phone && (
          <SidePanel
            open={showPanel}
            title="Schools"
            onClose={() => setPanelOpen(false)}
            className={cn("absolute w-[360px] max-w-[calc(100%-5rem)]", desktop ? "bottom-4 left-4 top-4" : "bottom-3 left-3 top-[76px] w-[340px]")}
          >
            <PanelBody {...panelProps} />
          </SidePanel>
        )}

        {/* Detail card (tablet / desktop) */}
        {!phone && (
          <AnimatePresence mode="wait">
            {(schoolCard || provinceCardEl) && (
              <motion.aside
                key={selected ? `s-${selected.school.id}` : `p-${provinceSummary?.province}`}
                aria-label={selected ? `${selected.school.name} details` : `${provinceSummary?.province} summary`}
                initial={reduce ? { opacity: 0 } : { opacity: 0, x: 24, scale: 0.98 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: 24, scale: 0.98 }}
                transition={{ duration: 0.4, ease: EASE }}
                className={cn(
                  "pointer-events-auto absolute flex max-h-[calc(100%-6rem)] flex-col overflow-hidden rounded-[1.5rem]",
                  GLASS_STRONG,
                  desktop ? "right-[76px] top-[84px] w-[320px]" : "right-[64px] top-[76px] w-[312px] max-w-[calc(100%-5rem)]",
                )}
              >
                {schoolCard || provinceCardEl}
              </motion.aside>
            )}
          </AnimatePresence>
        )}

        {/* Layers */}
        <AnimatePresence>
          {layersOpen && (
            <LayersPanel
              theme={theme}
              basemap={url.basemap as BasemapId}
              overlays={url.overlays}
              onBasemap={(b) => patch({ base: b === "auto" ? null : b })}
              onToggle={setOverlay}
              onClose={() => setLayersOpen(false)}
              className={cn(
                "absolute z-20",
                phone
                  ? "inset-x-3 top-[112px] max-h-[calc(100%-230px)]"
                  : desktop
                    ? "right-[76px] top-[84px] max-h-[calc(100%-6rem)] w-[320px]"
                    : "right-[64px] top-[76px] max-h-[calc(100%-6rem)] w-[320px]",
              )}
            />
          )}
        </AnimatePresence>

        {/* Bottom: legend + tool readout */}
        <div
          className={cn(
            "absolute flex items-end gap-3",
            phone ? "inset-x-3 bottom-[86px] flex-col items-stretch" : desktop ? "bottom-4 right-[150px]" : "bottom-3 right-[140px]",
          )}
          style={phone ? undefined : { left: showPanel ? (desktop ? 392 : 364) : desktop ? 16 : 12 }}
        >
          <AnimatePresence>
            {legendOpen && !(phone && tool !== "none") && !loading && (
              <Legend
                key="legend"
                counts={legendCounts}
                unassessed={unassessed}
                active={url.priorities}
                onToggle={togglePriority}
                onFocusBand={setFocusBand}
                density={url.overlays.has("density")}
                clusters={url.overlays.has("clusters")}
                className={phone ? "self-start" : "max-w-[min(100%,420px)]"}
              />
            )}
          </AnimatePresence>
          <div className="flex min-w-0 flex-1 justify-center">
            <AnimatePresence>
              {tool !== "none" && (
                <ToolHud
                  key="hud"
                  tool={tool}
                  points={measurePts}
                  nearest={nearestHits}
                  onUndo={() => setMeasurePts((p) => p.slice(0, -1))}
                  onClear={() => {
                    setMeasurePts([]);
                    setOrigin(null);
                  }}
                  onExit={() => changeTool("none")}
                  onPick={(p) => {
                    changeTool("none");
                    selectSchool(p);
                  }}
                />
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Cursor + attribution */}
        <p
          className={cn(
            "absolute bottom-1 right-4 hidden items-center gap-2 text-[10px] md:flex",
            MUTED,
          )}
        >
          <span ref={setCursorEl} className="font-mono tabular-nums" />
          <span>{basemapLabel}</span>
        </p>

        {/* States */}
        {(loading || loadFailed || (!loading && allSchoolsLoaded && plottedAll.length === 0)) && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            {loading ? (
              <MapStateCard kind="loading" title="Loading the school network…" />
            ) : loadFailed ? (
              <MapStateCard
                kind="error"
                title="The schools could not be loaded"
                description="The map is shown without schools. Check your connection and try again."
                onRetry={() => {
                  invalidateAllSchools();
                  void fetchAllSchools();
                }}
              />
            ) : (
              <MapStateCard
                kind="empty"
                title="No schools to show on the map yet"
                description="Schools appear here once their location (latitude and longitude) is recorded. A GIS analyst can add it from the school record or by uploading a KMZ file."
              />
            )}
          </div>
        )}

        {/* Phone bottom sheet: list, or the open school / province card */}
        {phone && (
          <BottomSheet
            id="national-map-panel"
            label={selected ? `${selected.school.name} details` : provinceSummary ? `${provinceSummary.province} summary` : "Filters and school list"}
            snap={sheetSnap}
            onSnap={setSheetSnap}
            header={
              <div className="flex items-center gap-3 px-5 pb-3">
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-sm font-semibold", STRONG)}>
                    {selected ? selected.school.name : provinceSummary ? provinceSummary.province : "Schools on the map"}
                  </p>
                  <p className={cn("truncate text-xs", MUTED)}>
                    {selected
                      ? `${selected.school.district} · score ${formatScore(selected.score)}`
                      : provinceSummary
                        ? `${formatNumber(provinceSummary.total)} ${provinceSummary.total === 1 ? "school" : "schools"} · avg ${formatScore(provinceSummary.avgScore)}`
                        : `${subtitle} · avg ${formatScore(avgScore)}`}
                  </p>
                </div>
                {(selected || provinceSummary) && (
                  <button
                    type="button"
                    onClick={() => (selected ? closeSchool() : (setProvinceCard(null), setSheetSnap("peek")))}
                    aria-label={selected ? "Close school details" : "Close province summary"}
                    className={cn("rounded-full p-2 hover:bg-slate-900/5 dark:hover:bg-white/10", MUTED)}
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </div>
            }
          >
            {schoolCard || provinceCardEl || <PanelBody {...panelProps} compact />}
          </BottomSheet>
        )}
      </div>
    </div>
  );
}
