import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { LatLngBounds } from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Navigation,
  Map as MapIcon,
  SlidersHorizontal,
  ChevronLeft,
  X,
  Eye,
  RotateCcw,
} from "lucide-react";
import { PageHeader } from "../components/ui/page-header";
import { cn } from "../lib/utils";
import {
  useSchoolsStore,
  calculatedScore,
  type School,
} from "../store/schoolsStore";
import { SchoolCoverMap } from "../components/maps/SchoolCoverMap";
import { PRIORITY_META, priorityMeta } from "../components/maps/schoolMap";

const PRIORITY_KEYS = ["critical", "high", "medium", "low"] as const;
const RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const hasCoords = (s: School) =>
  s.latitude != null &&
  s.longitude != null &&
  Number(s.latitude) !== 0 &&
  Number(s.longitude) !== 0;

export default function NationalMap() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { allSchools, allSchoolsLoading, allSchoolsLoaded, fetchAllSchools } =
    useSchoolsStore();

  const [panelOpen, setPanelOpen] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true,
  );
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [bounds, setBounds] = useState<LatLngBounds | null>(null);

  useEffect(() => {
    void fetchAllSchools();
  }, [fetchAllSchools]);

  /* ── URL-synced state ── */
  const activePriorities = useMemo(() => {
    const raw = params.get("priority");
    return new Set(raw ? raw.split(",").filter(Boolean) : []);
  }, [params]);
  const province = params.get("province") ?? "";
  const selectedId = params.get("school");

  const patch = useCallback(
    (next: Record<string, string | null>) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(next)) {
            if (v == null || v === "") p.delete(k);
            else p.set(k, v);
          }
          return p;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const togglePriority = (key: string) => {
    const next = new Set(activePriorities);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    patch({ priority: [...next].join(",") || null });
  };
  const selectSchool = (id: string | null) => patch({ school: id });
  const resetFilters = () =>
    patch({ priority: null, province: null, school: null });

  /* ── derived data ── */
  const mappable = useMemo(() => allSchools.filter(hasCoords), [allSchools]);
  const provinces = useMemo(
    () =>
      [...new Set(mappable.map((s) => s.province).filter(Boolean))].sort(),
    [mappable],
  );

  const byProvince = useMemo(
    () => (province ? mappable.filter((s) => s.province === province) : mappable),
    [mappable, province],
  );

  const priorityCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of byProvince) {
      const k = (s.priorityLevel ?? "").toLowerCase();
      c[k] = (c[k] ?? 0) + 1;
    }
    return c;
  }, [byProvince]);

  const filtered = useMemo(() => {
    const list =
      activePriorities.size === 0
        ? byProvince
        : byProvince.filter((s) =>
            activePriorities.has((s.priorityLevel ?? "").toLowerCase()),
          );
    return [...list].sort((a, b) => {
      const r =
        (RANK[(a.priorityLevel ?? "").toLowerCase()] ?? 9) -
        (RANK[(b.priorityLevel ?? "").toLowerCase()] ?? 9);
      return r !== 0 ? r : calculatedScore(a) - calculatedScore(b);
    });
  }, [byProvince, activePriorities]);

  const inView = useMemo(() => {
    if (!bounds) return filtered.length;
    return filtered.filter((s) =>
      bounds.contains([Number(s.latitude), Number(s.longitude)]),
    ).length;
  }, [bounds, filtered]);

  const avgScore = useMemo(() => {
    if (!filtered.length) return 0;
    return Math.round(
      filtered.reduce((sum, s) => sum + calculatedScore(s), 0) / filtered.length,
    );
  }, [filtered]);

  const selected = useMemo(
    () => filtered.find((s) => s.id === selectedId) ?? null,
    [filtered, selectedId],
  );

  const loading = allSchoolsLoading && !allSchoolsLoaded;

  return (
    <div className="relative flex h-[calc(100vh-8rem)] w-full flex-col space-y-4">
      <PageHeader
        title="National Map"
        description="Geospatial workspace — filter, search, measure & inspect the TVET network"
        icon={MapIcon}
        actions={
          <Button
            variant="outline"
            onClick={() => setPanelOpen((v) => !v)}
            className="h-9 gap-2 rounded-xl border-border/20 text-[10px] font-black uppercase tracking-wider shadow-none"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {panelOpen ? "Hide panel" : "Filters & list"}
          </Button>
        }
      />

      {loading ? (
        <Card className="flex flex-1 items-center justify-center overflow-hidden rounded-3xl border border-border/20 bg-slate-100/50 shadow-none backdrop-blur-sm dark:bg-white/5">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
            <p className="animate-pulse text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Initialising GIS engine…
            </p>
          </div>
        </Card>
      ) : (
        <div className="relative flex-1 overflow-hidden rounded-3xl">
          <SchoolCoverMap
            schools={filtered}
            variant="panel"
            interactive
            scrollZoom
            showHud={false}
            showLegend={false}
            title="National Map"
            href=""
            heightClass="absolute inset-0"
            selectedId={selectedId}
            highlightId={hoverId}
            onBoundsChange={setBounds}
            onSchoolClick={(s) => selectSchool(s.id === selectedId ? null : s.id)}
            renderPopup={(s) => (
              <div className="min-w-55 p-1">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-black tracking-widest text-muted-foreground">
                    {s.code}
                  </span>
                  <Badge
                    variant={
                      s.priorityLevel === "critical" ? "destructive" : "default"
                    }
                    className="rounded-full px-2 py-0 text-[9px] font-black uppercase"
                  >
                    {s.priorityLevel || "Unassessed"}
                  </Badge>
                </div>
                <h4 className="mb-1 text-sm font-bold text-foreground">
                  {s.name}
                </h4>
                <p className="mb-4 text-[11px] font-medium text-muted-foreground">
                  {s.district}, {s.province}
                </p>
                <Button
                  onClick={() => navigate(`/schools/${s.id}`)}
                  size="sm"
                  className="h-9 w-full gap-2 rounded-full font-bold"
                >
                  <Navigation className="h-3.5 w-3.5" /> View school details
                </Button>
              </div>
            )}
          />

          {/* ── Inspector panel ── */}
          <div
            className={cn(
              "absolute left-4 top-4 z-40 flex w-[min(88vw,340px)] flex-col overflow-hidden rounded-2xl border border-border/40 bg-background/85 shadow-2xl backdrop-blur-xl transition-[transform,opacity] duration-300 dark:border-white/6 dark:bg-[#0c1120]/85",
              "bottom-4",
              panelOpen
                ? "translate-x-0 opacity-100"
                : "pointer-events-none -translate-x-[calc(100%+1.5rem)] opacity-0",
            )}
          >
            {/* head */}
            <div className="flex items-center justify-between border-b border-border/20 px-4 py-3">
              <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-foreground">
                <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
                Filters
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-[9px] font-black uppercase tracking-wider text-muted-foreground hover:text-primary"
                >
                  <RotateCcw className="h-3 w-3" /> Reset
                </button>
                <button
                  onClick={() => setPanelOpen(false)}
                  aria-label="Collapse panel"
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* filters */}
            <div className="space-y-3 border-b border-border/20 px-4 py-3">
              <div className="flex flex-wrap gap-1.5">
                {PRIORITY_KEYS.map((key) => {
                  const on =
                    activePriorities.size === 0 || activePriorities.has(key);
                  const meta = PRIORITY_META[key];
                  return (
                    <button
                      key={key}
                      onClick={() => togglePriority(key)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider transition-colors",
                        on
                          ? "border-transparent text-white"
                          : "border-border/40 text-muted-foreground opacity-60 dark:border-white/6",
                      )}
                      style={on ? { background: meta.color } : undefined}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          on ? "bg-white/90" : "",
                        )}
                        style={on ? undefined : { background: meta.color }}
                      />
                      {meta.label}
                      <span className="tabular-nums opacity-80">
                        {priorityCounts[key] ?? 0}
                      </span>
                    </button>
                  );
                })}
              </div>

              <select
                value={province}
                onChange={(e) => patch({ province: e.target.value || null })}
                className="h-9 w-full rounded-xl border border-border/40 bg-background/60 px-3 text-xs font-bold text-foreground outline-none focus:border-primary/50 dark:border-white/6 dark:bg-white/5"
              >
                <option value="">All provinces</option>
                {provinces.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {/* summary */}
            <div className="space-y-2 border-b border-border/20 px-4 py-3">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                <span>
                  <span className="text-foreground">{filtered.length}</span> of{" "}
                  {mappable.length} schools
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" /> {inView} in view
                </span>
              </div>
              <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
                {PRIORITY_KEYS.map((key) => {
                  const n = filtered.filter(
                    (s) => (s.priorityLevel ?? "").toLowerCase() === key,
                  ).length;
                  if (!n) return null;
                  return (
                    <span
                      key={key}
                      style={{
                        width: `${(n / filtered.length) * 100}%`,
                        background: PRIORITY_META[key].color,
                      }}
                    />
                  );
                })}
              </div>
              <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Avg. intelligence score{" "}
                <span className="tabular-nums text-foreground">{avgScore}</span>
              </div>
            </div>

            {/* list */}
            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-4 py-10 text-center text-xs font-semibold text-muted-foreground">
                  No schools match these filters.
                </p>
              ) : (
                filtered.map((s) => {
                  const meta = priorityMeta(s.priorityLevel);
                  const active = s.id === selectedId;
                  return (
                    <button
                      key={s.id}
                      onClick={() => selectSchool(active ? null : s.id)}
                      onMouseEnter={() => setHoverId(s.id)}
                      onMouseLeave={() =>
                        setHoverId((cur) => (cur === s.id ? null : cur))
                      }
                      className={cn(
                        "flex w-full items-center gap-2.5 border-b border-border/10 px-4 py-2.5 text-left transition-colors",
                        active ? "bg-primary/10" : "hover:bg-primary/5",
                      )}
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{
                          background: meta.color,
                          boxShadow: `0 0 7px ${meta.ring}`,
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold text-foreground">
                          {s.name}
                        </span>
                        <span className="block truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {s.district}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-black tabular-nums text-foreground/80">
                        {calculatedScore(s)}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {/* selected detail */}
            {selected && (
              <div className="border-t border-border/20 bg-muted/30 p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-foreground">
                      {selected.name}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {selected.code} · {selected.district}, {selected.province}
                    </p>
                  </div>
                  <button
                    onClick={() => selectSchool(null)}
                    aria-label="Clear selection"
                    className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mb-3 flex items-center gap-2">
                  <Badge
                    className="rounded-full px-2 py-0 text-[9px] font-black uppercase"
                    style={{ background: priorityMeta(selected.priorityLevel).color }}
                  >
                    {selected.priorityLevel || "Unassessed"}
                  </Badge>
                  <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    Score{" "}
                    <span className="tabular-nums text-foreground">
                      {calculatedScore(selected)}
                    </span>
                  </span>
                </div>
                <Button
                  onClick={() => navigate(`/schools/${selected.id}`)}
                  size="sm"
                  className="h-8 w-full gap-2 rounded-lg text-[10px] font-black uppercase tracking-wider"
                >
                  <Navigation className="h-3.5 w-3.5" /> Open full profile
                </Button>
              </div>
            )}
          </div>

          {/* re-open handle */}
          {!panelOpen && (
            <button
              onClick={() => setPanelOpen(true)}
              className="absolute left-4 top-4 z-40 flex items-center gap-2 rounded-xl border border-border/40 bg-background/85 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-foreground shadow-lg backdrop-blur-md dark:border-white/6 dark:bg-[#0c1120]/85"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
              Filters · {filtered.length}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
