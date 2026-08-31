import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L, { type Map as LeafletMap } from "leaflet";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Radio,
  ArrowUpRight,
  Search,
  Ruler,
  Plus,
  Minus,
  Locate,
  Layers,
  X,
  RotateCcw,
  Maximize2,
  Minimize2,
  Sparkles,
  Focus,
  type LucideIcon,
} from "lucide-react";
import "leaflet/dist/leaflet.css";
import { cn } from "../../lib/utils";
import {
  BASEMAP_ATTRIBUTION,
  basemapUrls,
  formatDistance,
  IMAGERY_ATTRIBUTION,
  IMAGERY_LABELS_URL,
  IMAGERY_URL,
  PRIORITY_META,
  priorityMeta,
  schoolPulseIcon,
  useEffectiveTheme,
  type MapSchool,
} from "./schoolMap";

type Basemap = "map" | "satellite";

/** Theme-reactive Esri basemap (free, no key): grey canvas or satellite imagery. */
export function ThemedTileLayer({
  theme,
  basemap = "map",
}: {
  theme: "light" | "dark";
  basemap?: Basemap;
}) {
  const u = basemapUrls(theme);
  if (basemap === "satellite") {
    return (
      <>
        <TileLayer
          key="imagery"
          url={IMAGERY_URL}
          maxZoom={19}
          attribution={IMAGERY_ATTRIBUTION}
        />
        <TileLayer key="imagery-labels" url={IMAGERY_LABELS_URL} maxZoom={19} />
      </>
    );
  }
  return (
    <>
      <TileLayer
        key={`${theme}-base`}
        url={u.base}
        maxZoom={16}
        attribution={BASEMAP_ATTRIBUTION}
        className={theme === "dark" ? "scm-tiles--dark" : "scm-tiles--light"}
      />
      <TileLayer key={`${theme}-ref`} url={u.reference} maxZoom={16} />
    </>
  );
}

const RWANDA_CENTER: [number, number] = [-1.9403, 29.8739];

/** Simplified national boundary of Rwanda ([lng, lat]) — used for the spotlight. */
const RWANDA_RING_LNGLAT: [number, number][] = [
  [30.4396, -1.048], [30.3401, -1.0985], [30.2135, -1.274], [30.1256, -1.3745],
  [30.0512, -1.4314], [29.9146, -1.4868], [29.8593, -1.364], [29.7926, -1.3705],
  [29.6424, -1.3916], [29.4938, -1.4351], [29.2835, -1.6128], [29.0161, -2.2897],
  [28.894, -2.49], [28.9178, -2.6781], [29.0417, -2.7262], [29.0547, -2.6835],
  [29.0743, -2.6037], [29.166, -2.5967], [29.2243, -2.6313], [29.266, -2.6186],
  [29.3261, -2.6523], [29.3505, -2.7003], [29.334, -2.7474], [29.3534, -2.8049],
  [29.3766, -2.8366], [29.4308, -2.8033], [29.4662, -2.8095], [29.5088, -2.8213],
  [29.5572, -2.8174], [29.6229, -2.8076], [29.7463, -2.8071], [29.826, -2.7743],
  [29.919, -2.6919], [29.9707, -2.4835], [30.1108, -2.4321], [30.2522, -2.3717],
  [30.4617, -2.3429], [30.5434, -2.413], [30.624, -2.4], [30.7446, -2.3799],
  [30.8366, -2.3326], [30.8585, -2.1823], [30.8764, -2.0382], [30.8295, -1.7547],
  [30.6708, -1.3866], [30.5038, -1.1653], [30.4594, -1.0763], [30.4396, -1.048],
];
const RWANDA_RING: [number, number][] = RWANDA_RING_LNGLAT.map(([lng, lat]) => [
  lat,
  lng,
]);
const WORLD_RING: [number, number][] = [
  [-89, -179],
  [-89, 179],
  [89, 179],
  [89, -179],
];
const RWANDA_BOUNDS = L.latLngBounds(RWANDA_RING);

/** Dims everything outside Rwanda and traces a glowing national border. */
function RwandaSpotlight({ theme }: { theme: "light" | "dark" }) {
  const fill = theme === "dark" ? "#04070f" : "#dfe6ef";
  return (
    <>
      <Polygon
        positions={[WORLD_RING, RWANDA_RING]}
        pathOptions={{
          stroke: false,
          fillColor: fill,
          fillOpacity: theme === "dark" ? 0.62 : 0.34,
          fillRule: "evenodd",
          interactive: false,
          className: "scm-rwanda-mask",
        }}
      />
      <Polygon
        positions={RWANDA_RING}
        pathOptions={{
          color: theme === "dark" ? "#60a5fa" : "#2563eb",
          weight: 1.5,
          opacity: 0.9,
          fill: false,
          interactive: false,
          className: "scm-rwanda-glow",
        }}
      />
    </>
  );
}

/** Native Leaflet scale bar (no dependency). */
function ScaleBar() {
  const map = useMap();
  useEffect(() => {
    const ctrl = L.control.scale({
      position: "bottomleft",
      imperial: false,
      maxWidth: 120,
    });
    ctrl.addTo(map);
    return () => {
      ctrl.remove();
    };
  }, [map]);
  return null;
}

/** First mount: frame the schools. After that: only keep the canvas sized. */
function ViewportSync({
  points,
  fit,
  onReady,
}: {
  points: [number, number][];
  fit: boolean;
  onReady: (map: LeafletMap) => void;
}) {
  const map = useMap();
  const framed = useRef(false);
  useEffect(() => {
    onReady(map);
    const frame = () => {
      map.invalidateSize({ animate: false });
      if (!fit || framed.current) return;
      if (points.length > 1) {
        map.fitBounds(L.latLngBounds(points), {
          padding: [56, 56],
          maxZoom: 11,
          animate: false,
        });
        framed.current = true;
      } else if (points.length === 1) {
        map.setView(points[0], 11, { animate: false });
        framed.current = true;
      }
    };
    frame();
    const ro = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map, points, fit, onReady]);
  return null;
}

/** Adds a vertex to the measuring path on every map click while active. */
function MeasureController({
  active,
  onAdd,
}: {
  active: boolean;
  onAdd: (p: [number, number]) => void;
}) {
  const map = useMap();
  useEffect(() => {
    if (!active) return;
    const el = map.getContainer();
    el.style.cursor = "crosshair";
    return () => {
      el.style.cursor = "";
    };
  }, [active, map]);
  useMapEvents({
    click: (e) => {
      if (active) onAdd([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

/** Smoothly recentres when the externally-selected school changes. */
function SelectionFocus({ target }: { target: [number, number] | null }) {
  const map = useMap();
  const prev = useRef<string>("");
  useEffect(() => {
    if (!target) return;
    const key = target.join(",");
    if (key === prev.current) return;
    prev.current = key;
    map.flyTo(target, Math.max(map.getZoom(), 11), { duration: 0.8 });
  }, [target, map]);
  return null;
}

/** Reports the visible bounds after every pan / zoom. */
function BoundsWatcher({ onChange }: { onChange: (b: L.LatLngBounds) => void }) {
  const map = useMapEvents({
    moveend: () => onChange(map.getBounds()),
    zoomend: () => onChange(map.getBounds()),
  });
  useEffect(() => {
    onChange(map.getBounds());
  }, [map, onChange]);
  return null;
}

interface SchoolCoverMapProps {
  schools: MapSchool[];
  /** `hero` = full-bleed immersive banner · `panel` = contained rounded card */
  variant?: "hero" | "panel";
  /** pan / zoom / double-click / touch + the tool rail + search + measure */
  interactive?: boolean;
  /** override the tool UI independently of `interactive` */
  tools?: boolean;
  /** allow mouse-wheel zoom (off by default so a hero doesn't eat page scroll) */
  scrollZoom?: boolean;
  defaultBasemap?: Basemap;
  fit?: boolean;
  title?: string;
  subtitle?: string;
  href?: string;
  hrefLabel?: string;
  showLegend?: boolean;
  showHud?: boolean;
  className?: string;
  heightClass?: string;
  onSchoolClick?: (school: MapSchool) => void;
  renderPopup?: (school: MapSchool) => ReactNode;
  /** id of the focused school — flies to it and paints a selection halo */
  selectedId?: string | null;
  /** id to emphasise (e.g. hovered in an external list) — dims the others */
  highlightId?: string | null;
  /** fires whenever the visible map bounds change (pan / zoom) */
  onBoundsChange?: (bounds: L.LatLngBounds) => void;
  children?: ReactNode;
}

interface Plotted {
  school: MapSchool;
  lat: number;
  lng: number;
}

export function SchoolCoverMap({
  schools,
  variant = "panel",
  interactive = false,
  tools,
  scrollZoom = false,
  defaultBasemap = "map",
  fit = true,
  title = "National School Network",
  subtitle,
  href = "/map",
  hrefLabel = "Full map",
  showLegend = true,
  showHud = true,
  className,
  heightClass,
  onSchoolClick,
  renderPopup,
  selectedId,
  highlightId,
  onBoundsChange,
  children,
}: SchoolCoverMapProps) {
  const theme = useEffectiveTheme();
  const canInteract = interactive || !!tools;
  const showTools = tools ?? interactive;

  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<LeafletMap | null>(null);
  const handleReady = useCallback((m: LeafletMap) => setMap(m), []);

  const [query, setQuery] = useState("");
  const [basemap, setBasemap] = useState<Basemap>(defaultBasemap);
  const [measuring, setMeasuring] = useState(false);
  const [measurePts, setMeasurePts] = useState<[number, number][]>([]);
  const [me, setMe] = useState<{ lat: number; lng: number; acc: number } | null>(
    null,
  );
  const [locating, setLocating] = useState(false);
  const [isFs, setIsFs] = useState(false);
  const [spotlight, setSpotlight] = useState(true);

  const plotted = useMemo<Plotted[]>(
    () =>
      schools
        .map((s) => ({
          school: s,
          lat: parseFloat(String(s.latitude)),
          lng: parseFloat(String(s.longitude)),
        }))
        .filter(
          (p) => isFinite(p.lat) && isFinite(p.lng) && p.lat !== 0 && p.lng !== 0,
        ),
    [schools],
  );

  const points = useMemo<[number, number][]>(
    () => plotted.map((p) => [p.lat, p.lng]),
    [plotted],
  );

  const selectedPoint = useMemo<[number, number] | null>(() => {
    if (!selectedId) return null;
    const hit = plotted.find((p) => p.school.id === selectedId);
    return hit ? [hit.lat, hit.lng] : null;
  }, [plotted, selectedId]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const { school } of plotted) {
      const key = (school.priorityLevel ?? "").toLowerCase();
      c[key] = (c[key] ?? 0) + 1;
    }
    return c;
  }, [plotted]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return plotted
      .filter(({ school }) =>
        [school.name, school.district, school.province, school.code]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      )
      .slice(0, 6);
  }, [query, plotted]);

  const measureTotal = useMemo(() => {
    let total = 0;
    for (let i = 1; i < measurePts.length; i++) {
      total += L.latLng(measurePts[i - 1]).distanceTo(L.latLng(measurePts[i]));
    }
    return total;
  }, [measurePts]);

  const cumulative = useMemo(() => {
    const out: number[] = [];
    let running = 0;
    measurePts.forEach((p, i) => {
      if (i > 0) running += L.latLng(measurePts[i - 1]).distanceTo(L.latLng(p));
      out.push(running);
    });
    return out;
  }, [measurePts]);

  /* wheel-zoom: enable in fullscreen or when explicitly allowed */
  useEffect(() => {
    if (!map) return;
    if (scrollZoom || isFs) map.scrollWheelZoom.enable();
    else map.scrollWheelZoom.disable();
  }, [map, scrollZoom, isFs]);

  /* fullscreen */
  useEffect(() => {
    const onFs = () =>
      setIsFs(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  useEffect(() => {
    if (map) setTimeout(() => map.invalidateSize({ animate: false }), 120);
  }, [map, isFs]);

  /* Esc exits measure mode */
  useEffect(() => {
    if (!measuring) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMeasuring(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [measuring]);

  const resetView = useCallback(() => {
    if (!map) return;
    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [56, 56], maxZoom: 11 });
    } else {
      map.setView(RWANDA_CENTER, 8);
    }
  }, [map, points]);

  const flyToSchool = useCallback(
    (p: Plotted) => {
      map?.flyTo([p.lat, p.lng], 14, { duration: 0.9 });
      setQuery("");
    },
    [map],
  );

  const frameRwanda = useCallback(() => {
    map?.flyToBounds(RWANDA_BOUNDS, { padding: [40, 40], duration: 0.8 });
  }, [map]);

  const locate = useCallback(() => {
    if (!map || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setMe({ lat: latitude, lng: longitude, acc: accuracy });
        map.flyTo([latitude, longitude], 13, { duration: 1 });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [map]);

  const toggleFs = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen();
    else containerRef.current?.requestFullscreen?.();
  }, []);

  const isHero = variant === "hero";
  const height =
    heightClass ??
    (isHero ? "h-[clamp(280px,44vh,540px)]" : "h-[clamp(220px,32vh,340px)]");

  return (
    <div
      ref={containerRef}
      className={cn(
        "group/scm relative isolate w-full overflow-hidden bg-[#eef2f7] text-foreground dark:bg-[#070b16]",
        isHero
          ? "rounded-b-3xl"
          : "rounded-3xl border border-border/25 dark:border-white/6",
        isFs ? "h-screen! w-screen! rounded-none! m-0!" : height,
        className,
      )}
    >
      <MapContainer
        center={RWANDA_CENTER}
        zoom={8}
        minZoom={6}
        maxZoom={18}
        className="absolute inset-0 h-full w-full bg-transparent!"
        zoomControl={false}
        attributionControl={false}
        scrollWheelZoom={false}
        dragging={canInteract}
        doubleClickZoom={canInteract}
        touchZoom={canInteract}
        keyboard={canInteract}
      >
        <ViewportSync points={points} fit={fit} onReady={handleReady} />
        <ThemedTileLayer theme={theme} basemap={basemap} />
        {spotlight && basemap === "map" && <RwandaSpotlight theme={theme} />}
        {showTools && !(showHud && showLegend) && <ScaleBar />}
        <MeasureController
          active={measuring}
          onAdd={(p) => setMeasurePts((prev) => [...prev, p])}
        />
        <SelectionFocus target={selectedPoint} />
        {onBoundsChange && <BoundsWatcher onChange={onBoundsChange} />}
        {showTools && <CursorReadout target={containerRef} />}

        {plotted.map(({ school, lat, lng }) => {
          const m = priorityMeta(school.priorityLevel);
          const isSelected = school.id === selectedId;
          const dimmed = !!highlightId && highlightId !== school.id && !isSelected;
          return (
            <Marker
              key={school.id}
              position={[lat, lng]}
              opacity={dimmed ? 0.35 : 1}
              zIndexOffset={isSelected ? 1000 : 0}
              icon={schoolPulseIcon(school.priorityLevel, 18, isSelected)}
              eventHandlers={
                onSchoolClick ? { click: () => onSchoolClick(school) } : undefined
              }
            >
              {renderPopup && (
                <Popup className="scm-popup">{renderPopup(school)}</Popup>
              )}
              <Tooltip className="scm-tip" direction="top" opacity={1}>
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: m.color, boxShadow: `0 0 6px ${m.color}` }}
                  />
                  <span className="text-[11px] font-bold">{school.name}</span>
                  <span className="text-[9px] font-black uppercase tracking-wider opacity-60">
                    {m.label}
                  </span>
                </span>
              </Tooltip>
            </Marker>
          );
        })}

        {measurePts.length > 0 && (
          <>
            <Polyline
              positions={measurePts}
              pathOptions={{
                color: "#38bdf8",
                weight: 2,
                dashArray: "3 7",
                opacity: 0.95,
              }}
            />
            {measurePts.map((p, i) => (
              <CircleMarker
                key={`${p[0]},${p[1]},${i}`}
                center={p}
                radius={4}
                pathOptions={{
                  color: "#38bdf8",
                  fillColor: "#0ea5e9",
                  fillOpacity: 1,
                  weight: 2,
                }}
              >
                <Tooltip permanent direction="top" className="scm-tip scm-tip--measure">
                  {i === 0 ? "Start" : formatDistance(cumulative[i])}
                </Tooltip>
              </CircleMarker>
            ))}
          </>
        )}

        {me && (
          <>
            <Circle
              center={[me.lat, me.lng]}
              radius={me.acc}
              pathOptions={{ stroke: false, fillColor: "#3b82f6", fillOpacity: 0.12 }}
            />
            <CircleMarker
              center={[me.lat, me.lng]}
              radius={6}
              pathOptions={{
                color: "#fff",
                weight: 2,
                fillColor: "#3b82f6",
                fillOpacity: 1,
              }}
            >
              <Tooltip className="scm-tip" direction="top">
                You are here
              </Tooltip>
            </CircleMarker>
          </>
        )}
      </MapContainer>

      {/* scrims — melt the hero into the page */}
      {isHero && !isFs && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-linear-to-b from-[#eef2f7] via-[#eef2f7]/50 to-transparent dark:from-[#070b16] dark:via-[#070b16]/50"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-28 bg-linear-to-t from-[#eef2f7] via-[#eef2f7]/60 to-transparent dark:from-[#070b16] dark:via-[#070b16]/60"
          />
        </>
      )}

      {showHud && (
        <>
          {/* corner ticks */}
          <div aria-hidden className="pointer-events-none absolute inset-3 z-10">
            {[
              "left-0 top-0 border-l-2 border-t-2",
              "right-0 top-0 border-r-2 border-t-2",
              "left-0 bottom-0 border-l-2 border-b-2",
              "right-0 bottom-0 border-r-2 border-b-2",
            ].map((pos) => (
              <span
                key={pos}
                className={cn(
                  "absolute h-4 w-4 border-primary/40 dark:border-white/15",
                  pos,
                )}
              />
            ))}
          </div>

          {/* header */}
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute left-5 right-5 top-4 z-20 flex items-start justify-between gap-3"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                <Radio className="h-3.5 w-3.5 animate-pulse text-emerald-500" />
                Live · {plotted.length} monitored
              </span>
              <h2 className="truncate text-sm font-black uppercase tracking-widest text-foreground drop-shadow-sm sm:text-base">
                {title}
              </h2>
              {subtitle && !showTools && (
                <span className="max-w-md text-[11px] font-semibold text-muted-foreground">
                  {subtitle}
                </span>
              )}
            </div>

            {href && (
              <Link
                to={href}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/40 bg-background/70 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-foreground backdrop-blur-md transition-colors hover:border-primary/50 hover:text-primary dark:border-white/10 dark:bg-white/5"
              >
                {hrefLabel}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </motion.div>
        </>
      )}

      {showTools && (
        <>
          {/* search */}
          <div className="absolute left-1/2 top-16 z-30 w-[min(88%,360px)] -translate-x-1/2 sm:top-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search schools, districts, provinces…"
                  className="h-10 w-full rounded-full border border-border/40 bg-background/85 pl-9 pr-9 text-xs font-semibold text-foreground shadow-lg outline-none backdrop-blur-md placeholder:text-muted-foreground/70 focus:border-primary/50 dark:border-white/10 dark:bg-[#0c1120]/85"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <AnimatePresence>
                {results.length > 0 && (
                  <motion.ul
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="mt-1.5 overflow-hidden rounded-2xl border border-border/40 bg-background/95 shadow-xl backdrop-blur-md dark:border-white/6 dark:bg-[#0c1120]/95"
                  >
                    {results.map((r) => (
                      <li key={r.school.id}>
                        <button
                          onClick={() => flyToSchool(r)}
                          className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left transition-colors hover:bg-primary/5"
                        >
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{
                              background: priorityMeta(r.school.priorityLevel)
                                .color,
                            }}
                          />
                          <span className="flex-1 truncate text-xs font-bold">
                            {r.school.name}
                          </span>
                          <span className="shrink-0 text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                            {r.school.district}
                          </span>
                        </button>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>

          {/* tool rail */}
          {map && (
            <div className="absolute right-4 top-16 z-30 flex flex-col gap-1.5">
              <ToolButton icon={Plus} label="Zoom in" onClick={() => map.zoomIn()} />
              <ToolButton
                icon={Minus}
                label="Zoom out"
                onClick={() => map.zoomOut()}
              />
              <ToolButton icon={RotateCcw} label="Reset view" onClick={resetView} />
              <ToolButton
                icon={Focus}
                label="Frame Rwanda"
                onClick={frameRwanda}
              />
              <span className="my-0.5 h-px w-8 self-center bg-border/50 dark:bg-white/15" />
              <ToolButton
                icon={Sparkles}
                label={spotlight ? "Spotlight: on" : "Spotlight: off"}
                active={spotlight}
                onClick={() => setSpotlight((v) => !v)}
              />
              <ToolButton
                icon={Ruler}
                label="Measure distance"
                active={measuring}
                onClick={() => {
                  setMeasuring((v) => !v);
                  if (measuring) setMeasurePts([]);
                }}
              />
              <ToolButton
                icon={Locate}
                label="My location"
                active={locating || !!me}
                onClick={locate}
              />
              <ToolButton
                icon={Layers}
                label={basemap === "map" ? "Satellite view" : "Map view"}
                active={basemap === "satellite"}
                onClick={() =>
                  setBasemap((b) => (b === "map" ? "satellite" : "map"))
                }
              />
              <ToolButton
                icon={isFs ? Minimize2 : Maximize2}
                label={isFs ? "Exit fullscreen" : "Fullscreen"}
                onClick={toggleFs}
              />
            </div>
          )}

          {/* measure readout */}
          <AnimatePresence>
            {measuring && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-16 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full border border-sky-400/40 bg-background/90 px-4 py-2 shadow-lg backdrop-blur-md dark:bg-[#0c1120]/90"
              >
                <Ruler className="h-3.5 w-3.5 text-sky-400" />
                <span className="text-xs font-black tabular-nums text-foreground">
                  {formatDistance(measureTotal)}
                </span>
                <span className="hidden text-[9px] font-bold uppercase tracking-wider text-muted-foreground sm:inline">
                  {measurePts.length} pts · click map · Esc to exit
                </span>
                {measurePts.length > 0 && (
                  <button
                    onClick={() => setMeasurePts([])}
                    className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-foreground hover:bg-muted/70"
                  >
                    Clear
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {showHud && (
        <>
          {/* legend */}
          {showLegend && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="absolute bottom-4 left-5 z-20 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl border border-border/30 bg-background/70 px-3.5 py-2 backdrop-blur-md dark:border-white/6 dark:bg-white/5"
            >
              {Object.entries(PRIORITY_META).map(([key, m]) => (
                <span key={key} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: m.color, boxShadow: `0 0 8px ${m.ring}` }}
                  />
                  <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                    {m.label}
                  </span>
                  <span className="text-[9px] font-black tabular-nums text-foreground/70">
                    {counts[key] ?? 0}
                  </span>
                </span>
              ))}
            </motion.div>
          )}

          {/* coverage readout + attribution */}
          <div className="absolute bottom-4 right-5 z-20 flex flex-col items-end gap-0.5 text-right">
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
              {plotted.length} / {schools.length} geo-located
            </span>
            <span className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground/40">
              {basemap === "satellite" ? "© Esri, Maxar" : "© Esri · OpenStreetMap"}
            </span>
          </div>
        </>
      )}

      {children && (
        <div className="absolute inset-x-0 bottom-0 z-30">{children}</div>
      )}
    </div>
  );
}

function ToolButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-xl border shadow-sm backdrop-blur-md transition-colors",
        active
          ? "border-primary/50 bg-primary text-primary-foreground"
          : "border-border/40 bg-background/80 text-foreground hover:border-primary/40 hover:text-primary dark:border-white/10 dark:bg-[#0c1120]/80",
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

/** Live cursor coordinates, portalled onto the map container as a HUD chip. */
function CursorReadout({
  target,
}: {
  target: RefObject<HTMLDivElement | null>;
}) {
  const [ll, setLl] = useState<L.LatLng | null>(null);
  useMapEvents({
    mousemove: (e) => setLl(e.latlng),
    mouseout: () => setLl(null),
  });
  if (!ll || !target.current) return null;
  return createPortal(
    <div className="pointer-events-none absolute bottom-14 left-1/2 z-20 hidden -translate-x-1/2 rounded-full border border-border/30 bg-background/80 px-3 py-1 font-mono text-[10px] font-semibold tabular-nums text-muted-foreground backdrop-blur-md md:block dark:border-white/6 dark:bg-[#0c1120]/80">
      {ll.lat.toFixed(4)}, {ll.lng.toFixed(4)}
    </div>,
    target.current,
  );
}
