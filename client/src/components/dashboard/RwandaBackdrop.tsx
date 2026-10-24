import { schoolPoint } from "../../lib/school-location";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { geoMercator, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { useReducedMotion } from "framer-motion";
import { cn } from "../../lib/utils";
import { PRIORITY_META, priorityMeta, type MapSchool } from "../maps/schoolMap";

type RegionProps = {
  name: string;
  role: "rwanda" | "neighbour" | "lake" | "borders" | "province-borders" | "province-label" | "province";
};
type RegionFeature = Feature<Geometry, RegionProps>;
type Region = {
  rwanda: RegionFeature;
  borders: RegionFeature[];
  lakes: RegionFeature[];
  provinceBorders: RegionFeature[];
  provinceLabels: RegionFeature[];
  provinceShapes: RegionFeature[];
};

/** Without a slot (narrow screens): share of the height, behind the title. */
const HERO_SHARE_NARROW = 0.37;
/** Breathing room inside the slot (fractions of its size). The top is tight on
 *  purpose: the floating title capsule overlaps the country's northern edge. */
const SLOT_INSET = { top: 0.015, bottom: 0.05, left: 0.01, right: 0.01 };
/** Quiet country names placed in each neighbour, near Rwanda. */
const NEIGHBOUR_LABELS: { name: string; at: [number, number] }[] = [
  { name: "DR CONGO", at: [28.6, -2.45] },
  { name: "UGANDA", at: [30.05, -0.85] },
  { name: "TANZANIA", at: [31.15, -2.2] },
  { name: "BURUNDI", at: [29.85, -3.05] },
];
const PARALLAX = 12;

type Slot = { x: number; y: number; w: number; h: number };
/** Hovered school dot, in viewport coordinates. */
type Hover = { id: string; x: number; top: number; bottom: number };

/** Loaded once per session; shared by every mount. */
let regionCache: Promise<Region> | null = null;
function loadRegion() {
  regionCache ??= import("../auth/rwanda-region.json").then((mod) => {
    const fc = (mod.default ?? mod) as unknown as FeatureCollection<Geometry, RegionProps>;
    return {
      rwanda: fc.features.find((f) => f.properties.role === "rwanda")!,
      // Neighbour-to-neighbour borders only (no edges shared with Rwanda).
      borders: fc.features.filter((f) => f.properties.role === "borders"),
      lakes: fc.features.filter((f) => f.properties.role === "lake"),
      // Province borders: geoBoundaries RWA ADM1 (CC BY 4.0, Rwanda Geo Portal).
      provinceBorders: fc.features.filter((f) => f.properties.role === "province-borders"),
      provinceLabels: fc.features.filter((f) => f.properties.role === "province-label"),
      provinceShapes: fc.features.filter((f) => f.properties.role === "province"),
    };
  });
  return regionCache;
}

interface Props {
  schools: MapSchool[];
  /**
   * Layout element the country is fitted into (e.g. the hero stage), so the
   * map lines up with the page. Measured at scroll position 0, so the fixed
   * backdrop and the slot coincide at the top of the page.
   */
  anchor?: RefObject<HTMLElement | null>;
  /** Clicking a school dot (e.g. open its decision dashboard). */
  onSchoolClick?: (school: MapSchool) => void;
  /** Per-province summaries (server aggregates) shown as ringed badges. */
  provinces?: ProvinceSummary[];
  /** Clicking a province region or badge (e.g. open its district summary). */
  onProvinceClick?: (province: ProvinceSummary) => void;
  className?: string;
}

/**
 * Rwanda map used as the dashboard's background.
 *
 * Real borders (Natural Earth 1:10m Rwanda, 1:50m neighbours, 1:10m Lake
 * Kivu) shown in full and fitted to the hero: a dot-matrix fill, a glowing
 * edge that draws itself in, hairline neighbour borders with quiet names,
 * and one dot per school in its priority colour. Interactive but calm: the
 * map drifts against the cursor (parallax), a soft spotlight follows the
 * pointer over the country, and school dots show a glass tooltip on hover
 * and open the school on click. Everything else passes clicks through.
 */
export function RwandaBackdrop({ schools, anchor, onSchoolClick, provinces, onProvinceClick, className }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const spotRef = useRef<SVGCircleElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [slot, setSlot] = useState<Slot | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [activeProvince, setActiveProvince] = useState<string | null>(null);
  const reduce = useReducedMotion();
  const uid = useId().replace(/:/g, "");

  useEffect(() => {
    let alive = true;
    void loadRegion().then((r) => alive && setRegion(r));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setBox((b) => (Math.abs(b.w - r.width) > 1 || Math.abs(b.h - r.height) > 1 ? { w: r.width, h: r.height } : b));
      const a = anchor?.current;
      if (!a) return setSlot(null);
      const ar = a.getBoundingClientRect();
      // Only a wide slot makes a stage; narrow layouts use the fallback.
      if (ar.width < 380 || ar.height < 300) return setSlot(null);
      // Undo the page's current scroll so the slot is placed where it sits
      // at the top of the page (the backdrop itself never scrolls).
      const scroller = a.closest("#main-content");
      const scrollY = scroller ? scroller.scrollTop : 0;
      const next = { x: ar.left - r.left, y: ar.top - r.top + scrollY, w: ar.width, h: ar.height };
      setSlot((p) =>
        p && Math.abs(p.x - next.x) < 1 && Math.abs(p.y - next.y) < 1 && Math.abs(p.w - next.w) < 1 && Math.abs(p.h - next.h) < 1
          ? p
          : next,
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (anchor?.current) ro.observe(anchor.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [anchor]);

  // The backdrop is position:fixed, so wheel/trackpad scrolls on its
  // interactive parts (provinces, school dots) would go to the window, not
  // the app's scroll container. Forward them so the page always scrolls.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const scroller = el.closest("#main-content");
      if (!scroller || e.ctrlKey) return; // ctrl+wheel = browser zoom
      e.preventDefault();
      scroller.scrollBy({ top: e.deltaY, left: e.deltaX });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Parallax + cursor spotlight, eased every frame (no React renders).
  useEffect(() => {
    const el = wrapRef.current;
    const svg = svgRef.current;
    if (!el || !svg || reduce || !slot) return;
    const cur = { x: 0, y: 0, sx: -999, sy: -999, so: 0 };
    const target = { x: 0, y: 0, sx: -999, sy: -999, so: 0 };
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      target.x = -((e.clientX - r.left) / r.width - 0.5) * PARALLAX;
      target.y = -((e.clientY - r.top) / r.height - 0.5) * PARALLAX * 0.7;
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      target.sx = e.clientX - r.left - cur.x;
      target.sy = e.clientY - r.top - cur.y;
      target.so = inside ? 1 : 0;
      if (cur.sx < -900) {
        cur.sx = target.sx;
        cur.sy = target.sy;
      }
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const onLeave = () => {
      target.x = target.y = 0;
      target.so = 0;
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const tick = () => {
      frame = 0;
      const k = 0.08;
      cur.x += (target.x - cur.x) * k;
      cur.y += (target.y - cur.y) * k;
      cur.sx += (target.sx - cur.sx) * 0.18;
      cur.sy += (target.sy - cur.sy) * 0.18;
      cur.so += (target.so - cur.so) * 0.12;
      svg.style.transform = `translate3d(${cur.x.toFixed(2)}px, ${cur.y.toFixed(2)}px, 0)`;
      const spot = spotRef.current;
      if (spot) {
        spot.setAttribute("cx", cur.sx.toFixed(1));
        spot.setAttribute("cy", cur.sy.toFixed(1));
        spot.style.opacity = cur.so.toFixed(3);
      }
      const settling =
        Math.abs(target.x - cur.x) + Math.abs(target.y - cur.y) + Math.abs(target.so - cur.so) + Math.abs(target.sx - cur.sx) > 0.05;
      if (settling) frame = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      svg.style.transform = "";
    };
  }, [reduce, slot, region]);

  const drawing = useMemo(() => {
    if (!region || box.w < 50 || box.h < 50) return null;
    // The whole country always fits in the hero, so it's seen in full before
    // the cards scroll over it: in the layout slot when there is one (wide
    // screens), otherwise centred behind the title.
    const pad = Math.max(20, Math.min(box.w, box.h) * 0.05);
    const extent: [[number, number], [number, number]] = slot
      ? [
          [slot.x + slot.w * SLOT_INSET.left, slot.y + slot.h * SLOT_INSET.top],
          [slot.x + slot.w * (1 - SLOT_INSET.right), slot.y + slot.h * (1 - SLOT_INSET.bottom)],
        ]
      : [
          [pad, pad],
          [box.w - pad, box.h * HERO_SHARE_NARROW],
        ];
    const projection = geoMercator().fitExtent(extent, region.rwanda);
    // fitExtent centres the country; in the slot, pin it to the top instead so
    // any spare height goes below the map, not into an empty band under the title.
    if (slot) {
      const top = geoPath(projection).bounds(region.rwanda)[0][1];
      const [tx, ty] = projection.translate();
      projection.translate([tx, ty - (top - extent[0][1])]);
    }
    const pathFn = geoPath(projection);
    const [[bx0, by0], [bx1, by1]] = pathFn.bounds(region.rwanda);
    const dots = schools
      .map((s) => {
        const pt = schoolPoint(s);
        if (!pt) return null;
        const p = projection([pt.lng, pt.lat]);
        return p ? { school: s, x: p[0], y: p[1], meta: priorityMeta(s.priorityLevel) } : null;
      })
      .filter((d): d is NonNullable<typeof d> => d !== null);
    const labels = NEIGHBOUR_LABELS.map((l) => {
      const p = projection(l.at);
      return p ? { name: l.name, x: p[0], y: p[1] } : null;
    })
      // Only names that fall in the map's own column (not under the panel).
      .filter((l): l is NonNullable<typeof l> => l !== null && (!slot || (l.x > slot.x + 40 && l.x < slot.x + slot.w - 40 && l.y > slot.y + 40)));
    const kivu = region.lakes[0];
    const kivuLabel = kivu ? projection([29.12, -2.05]) : null;
    // Dot spacing scales a little with the map so it reads the same everywhere.
    const scale = projection.scale();
    return {
      rwanda: pathFn(region.rwanda) ?? "",
      neighbours: region.borders.map((f) => pathFn(f) ?? ""),
      lakes: region.lakes.map((f) => pathFn(f) ?? ""),
      provinceBorders: region.provinceBorders.map((f) => pathFn(f) ?? ""),
      provinceShapes: region.provinceShapes.map((f) => ({ name: f.properties.name, d: pathFn(f) ?? "" })),
      provinceAnchors: region.provinceLabels
        .map((f) => {
          const p = f.geometry.type === "Point" ? projection(f.geometry.coordinates as [number, number]) : null;
          return p ? { name: f.properties.name, x: p[0], y: p[1] } : null;
        })
        .filter((a): a is NonNullable<typeof a> => a !== null),
      labels,
      kivuLabel,
      // Fade mask centred on the country (percent of the backdrop), wide
      // enough to keep Rwanda whole and let the neighbours fade out.
      mask: {
        x: (((bx0 + bx1) / 2) / box.w) * 100,
        y: (((by0 + by1) / 2) / box.h) * 100,
        rx: ((bx1 - bx0) / box.w) * 100 * 1.25,
        ry: ((by1 - by0) / box.h) * 100 * 1.25,
      },
      dots,
      centre: { x: (bx0 + bx1) / 2, y: (by0 + by1) / 2, rx: (bx1 - bx0) * 0.75, ry: (by1 - by0) * 0.75 },
      span: { w: bx1 - bx0, h: by1 - by0 },
      // Province badges shrink with the map so they never crowd a small one.
      badgeScale: Math.max(0.62, Math.min(1, (bx1 - bx0) / 620)),
      grid: Math.max(7, Math.min(12, scale / 1100)),
      dotRadius: Math.max(2.6, Math.min(4.6, scale / 3800)),
    };
  }, [region, box, slot, schools]);

  const hovered = hover && drawing?.dots.find((d) => d.school.id === hover.id);
  const interactive = !!slot && !!onSchoolClick;

  return (
    <div ref={wrapRef} aria-hidden className={cn("pointer-events-none select-none", !slot && "opacity-55", className)}>
      {/* Masked layer: the map melts into the page towards the edges. */}
      <div
        className="absolute inset-0"
        style={
          drawing
            ? {
                maskImage: `radial-gradient(ellipse ${drawing.mask.rx}% ${drawing.mask.ry}% at ${drawing.mask.x}% ${drawing.mask.y}%, black 55%, transparent 100%)`,
                WebkitMaskImage: `radial-gradient(ellipse ${drawing.mask.rx}% ${drawing.mask.ry}% at ${drawing.mask.x}% ${drawing.mask.y}%, black 55%, transparent 100%)`,
              }
            : undefined
        }
      >
        {drawing && (
          <svg ref={svgRef} width={box.w} height={box.h} className="rb-in block will-change-transform">
            <defs>
              <pattern id={`rb-dots-${uid}`} width={drawing.grid} height={drawing.grid} patternUnits="userSpaceOnUse">
                <circle cx={drawing.grid / 2} cy={drawing.grid / 2} r={0.9} className="fill-slate-400/30 dark:fill-blue-300/25" />
              </pattern>
              <linearGradient id={`rb-fill-${uid}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" className="[stop-color:hsl(var(--primary))] [stop-opacity:0.035] dark:[stop-opacity:0.14]" />
                <stop offset="1" className="[stop-color:hsl(var(--primary))] [stop-opacity:0.01] dark:[stop-opacity:0.04]" />
              </linearGradient>
              <radialGradient id={`rb-haze-${uid}`}>
                <stop offset="0" className="[stop-color:hsl(var(--primary))] [stop-opacity:0] dark:[stop-opacity:0.22]" />
                <stop offset="1" className="[stop-color:hsl(var(--primary))] [stop-opacity:0]" />
              </radialGradient>
              <radialGradient id={`rb-spot-${uid}`}>
                <stop offset="0" className="[stop-color:hsl(var(--primary))] [stop-opacity:0.14] dark:[stop-opacity:0.45]" />
                <stop offset="0.5" className="[stop-color:hsl(var(--primary))] [stop-opacity:0.04] dark:[stop-opacity:0.1]" />
                <stop offset="1" className="[stop-color:hsl(var(--primary))] [stop-opacity:0]" />
              </radialGradient>
              <linearGradient id={`rb-lake-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" className="[stop-color:#38bdf8] [stop-opacity:0.16] dark:[stop-opacity:0.28]" />
                <stop offset="1" className="[stop-color:#0ea5e9] [stop-opacity:0.08] dark:[stop-opacity:0.14]" />
              </linearGradient>
              <clipPath id={`rb-clip-${uid}`}>
                <path d={drawing.rwanda} />
              </clipPath>
              <linearGradient id={`rb-sweep-${uid}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" className="[stop-color:hsl(var(--primary))] [stop-opacity:0]" />
                <stop offset="0.5" className="[stop-color:hsl(var(--primary))] [stop-opacity:0.22] dark:[stop-opacity:0.3]" />
                <stop offset="1" className="[stop-color:hsl(var(--primary))] [stop-opacity:0]" />
              </linearGradient>
              <filter id={`rb-glow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="6" />
              </filter>
            </defs>

            {/* Neighbours: lowest layer — hairline borders + quiet names */}
            <g className="rb-fill">
              <g>
              {drawing.neighbours.map((d, i) => (
                <path
                  key={i}
                  d={d}
                  className="fill-none stroke-slate-400/25 dark:stroke-white/[0.1]"
                  strokeWidth={0.9}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              </g>
              {drawing.labels.map((l) => (
                <text
                  key={l.name}
                  x={l.x}
                  y={l.y}
                  textAnchor="middle"
                  className="fill-slate-500/70 text-[12px] font-semibold tracking-[0.3em] dark:fill-white/40"
                >
                  {l.name}
                </text>
              ))}
            </g>

            {/* Soft brand haze behind the country */}
            <ellipse cx={drawing.centre.x} cy={drawing.centre.y} rx={drawing.centre.rx} ry={drawing.centre.ry} fill={`url(#rb-haze-${uid})`} />

            {/* Rwanda */}
            <g className="rb-fill">
              <path d={drawing.rwanda} fill={`url(#rb-fill-${uid})`} />
              <path d={drawing.rwanda} fill={`url(#rb-dots-${uid})`} />
            </g>

            {/* Cursor spotlight, lighting the dot grid inside the country */}
            <g clipPath={`url(#rb-clip-${uid})`}>
              <circle ref={spotRef} cx={-999} cy={-999} r={Math.max(120, drawing.span.w * 0.22)} fill={`url(#rb-spot-${uid})`} style={{ opacity: 0 }} />
              {/* A soft light sweep crosses the country now and then (a "pass"). */}
              <rect
                className="rb-sweep hidden dark:block"
                x={drawing.centre.x - drawing.span.w / 2 - 220}
                y={drawing.centre.y - drawing.span.h / 2}
                width={220}
                height={drawing.span.h}
                fill={`url(#rb-sweep-${uid})`}
                style={{ ["--rb-travel" as string]: `${drawing.span.w + 440}px` }}
              />
            </g>

            {/* Lake Kivu */}
            <g className="rb-fill">
              {drawing.lakes.map((d, i) => (
                <path key={i} d={d} fill={`url(#rb-lake-${uid})`} className="stroke-sky-500/30 dark:stroke-sky-300/35" strokeWidth={1} />
              ))}
              {drawing.kivuLabel && (
                <text
                  x={drawing.kivuLabel[0]}
                  y={drawing.kivuLabel[1]}
                  textAnchor="middle"
                  transform={`rotate(-62 ${drawing.kivuLabel[0]} ${drawing.kivuLabel[1]})`}
                  className="fill-sky-700/60 text-[12px] font-medium italic tracking-[0.2em] dark:fill-sky-200/45"
                >
                  Lake Kivu
                </text>
              )}
            </g>

            {/* Border: glow + a crisp line that draws itself in */}
            <path d={drawing.rwanda} fill="none" filter={`url(#rb-glow-${uid})`} className="hidden stroke-blue-400/30 dark:block" strokeWidth={6} />
            <path
              d={drawing.rwanda}
              fill="none"
              pathLength={1}
              className="rb-draw stroke-primary/45 dark:stroke-blue-300/55"
              strokeWidth={1.25}
              strokeLinejoin="round"
            />

            {/* Province regions: hover highlights, click opens the district summary */}
            <g className="rb-fill">
              {drawing.provinceShapes.map(({ name, d }) => {
                const sum = provinces?.find((p) => normProvince(p.province) === normProvince(name));
                const on = activeProvince === name;
                return (
                  <path
                    key={name}
                    d={d}
                    className={cn(
                      "transition-[fill-opacity] duration-300",
                      slot && sum && onProvinceClick && "pointer-events-auto cursor-pointer",
                    )}
                    fill="hsl(var(--primary))"
                    fillOpacity={on ? 0.12 : 0}
                    onPointerEnter={() => setActiveProvince(name)}
                    onPointerLeave={() => setActiveProvince((a) => (a === name ? null : a))}
                    onClick={() => sum && onProvinceClick?.(sum)}
                  />
                );
              })}
            </g>

            {/* Provinces: internal borders (inside Rwanda only) */}
            <g className="rb-fill" clipPath={`url(#rb-clip-${uid})`}>
              {drawing.provinceBorders.map((d, i) => (
                <path
                  key={i}
                  d={d}
                  fill="none"
                  className="stroke-primary/30 dark:stroke-blue-300/25"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </g>

            {/* Province summary badges: average score as a progress ring */}
            {drawing.provinceAnchors.map((a, i) => {
              const sum = provinces?.find((p) => normProvince(p.province) === normProvince(a.name));
              if (!sum) return null;
              return (
                <ProvinceBadge
                  key={a.name}
                  scale={drawing.badgeScale}
                  x={a.x}
                  y={a.y}
                  name={a.name}
                  summary={sum}
                  index={i}
                  interactive={!!slot}
                  active={activeProvince === a.name}
                  onHover={(on) => setActiveProvince(on ? a.name : null)}
                  onClick={onProvinceClick ? () => onProvinceClick(sum) : undefined}
                />
              );
            })}

            {/* Schools */}
            {drawing.dots.map(({ school, x, y, meta }, i) => {
              const active = hover?.id === school.id;
              return (
                <g key={school.id} transform={`translate(${x} ${y})`}>
                  <g className="rb-dot" style={{ animationDelay: `${1500 + i * 110}ms` }}>
                    {meta.beacon && <circle r={drawing.dotRadius} fill="none" stroke={meta.color} strokeWidth={1.2} className="rb-pulse" />}
                    <circle r={drawing.dotRadius * (active ? 3.4 : 2.4)} fill={meta.color} opacity={active ? 0.22 : 0.12} className="transition-all duration-300" />
                    <circle
                      r={drawing.dotRadius * (active ? 1.45 : 1)}
                      fill={meta.color}
                      className="stroke-white transition-all duration-300 dark:stroke-slate-950"
                      strokeWidth={1.4}
                    />
                    {/* Generous invisible hit area */}
                    {interactive && (
                      <circle
                        r={Math.max(12, drawing.dotRadius * 3.2)}
                        fill="transparent"
                        className="pointer-events-auto cursor-pointer"
                        onPointerEnter={(e) => {
                          const cr = (e.currentTarget as SVGCircleElement).getBoundingClientRect();
                          setHover({ id: school.id, x: cr.left + cr.width / 2, top: cr.top, bottom: cr.bottom });
                        }}
                        onPointerLeave={() => setHover((h) => (h?.id === school.id ? null : h))}
                        onClick={() => onSchoolClick?.(school)}
                      />
                    )}
                  </g>
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* School tooltip: portalled above all page content, viewport-clamped. */}
      {hovered && hover && createPortal(<SchoolTip hover={hover} dot={hovered} />, document.body)}

      <style>{`
        .rb-in { animation: rb-in 900ms ease-out both; }
        @keyframes rb-in { from { opacity: 0; } to { opacity: 1; } }
        .rb-draw { stroke-dasharray: 1; stroke-dashoffset: 1; animation: rb-draw 2.2s cubic-bezier(.65,0,.35,1) 150ms forwards; }
        @keyframes rb-draw { to { stroke-dashoffset: 0; } }
        .rb-fill { animation: rb-fade 1.2s ease-out 900ms both; }
        @keyframes rb-fade { from { opacity: 0; } to { opacity: 1; } }
        .rb-sweep { animation: rb-sweep 7s cubic-bezier(.45,0,.55,1) 2.6s infinite; opacity: 0; }
        @keyframes rb-sweep {
          0% { transform: translateX(0); opacity: 0; }
          8% { opacity: 1; }
          45% { transform: translateX(var(--rb-travel)); opacity: 1; }
          50%, 100% { transform: translateX(var(--rb-travel)); opacity: 0; }
        }
        .rb-badge { transform-box: fill-box; transform-origin: center; animation: rb-dot 600ms cubic-bezier(.34,1.56,.64,1) both; }
        .rb-halo { transform-box: fill-box; transform-origin: center; animation: rb-breathe 3.2s ease-in-out infinite; }
        @keyframes rb-breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.12); } }
        .rb-ring { stroke-dashoffset: var(--rb-ring); animation: rb-ring 1.3s cubic-bezier(.22,1,.36,1) both; }
        @keyframes rb-ring { to { stroke-dashoffset: 0; } }
        .rb-dot { transform-box: fill-box; transform-origin: center; animation: rb-dot 520ms cubic-bezier(.34,1.56,.64,1) both; }
        @keyframes rb-dot { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .rb-pulse { transform-box: fill-box; transform-origin: center; animation: rb-pulse 2.6s ease-out infinite; }
        @keyframes rb-pulse { from { transform: scale(1); opacity: 0.7; } to { transform: scale(4.2); opacity: 0; } }

        @media (prefers-reduced-motion: reduce) {
          .rb-in, .rb-pulse, .rb-dot, .rb-fill, .rb-badge, .rb-halo { animation: none; }
          .rb-ring { animation: none; stroke-dashoffset: 0; }
          .rb-draw { animation: none; stroke-dashoffset: 0; }
          .rb-sweep { display: none; }
        }
      `}</style>
    </div>
  );
}

type Dot = { school: MapSchool; meta: ReturnType<typeof priorityMeta> };

/** Glass tooltip for a school dot: above it, or below when there's no room. */
function SchoolTip({ hover, dot }: { hover: Hover; dot: Dot }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; below: boolean } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const gap = 12;
    const margin = 12;
    // Keep clear of the sticky app header (56px).
    const below = hover.top - height - gap < 56 + margin;
    const top = below ? hover.bottom + gap : hover.top - height - gap;
    const left = Math.min(Math.max(hover.x - width / 2, margin), window.innerWidth - width - margin);
    setPos({ left, top, below });
  }, [hover]);

  return (
    <div
      ref={ref}
      role="tooltip"
      className="pointer-events-none fixed z-[10001] w-max max-w-64 rounded-2xl bg-white/85 px-3.5 py-2.5 shadow-[0_20px_50px_-20px_rgba(15,23,42,0.45)] backdrop-blur-xl backdrop-saturate-150 transition-opacity duration-150 dark:bg-slate-900/85 dark:shadow-black/60"
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, opacity: pos ? 1 : 0 }}
    >
      <p className="text-sm font-semibold leading-snug text-slate-900 dark:text-white">{dot.school.name}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-600 dark:text-white/60">
        <span className="h-2 w-2 rounded-full" style={{ background: dot.meta.color }} />
        {dot.meta.label} priority
        {dot.school.district ? <span className="text-slate-400 dark:text-white/35">· {dot.school.district}</span> : null}
      </p>
      <p className="mt-1.5 text-[13px] font-medium text-primary">Click to open the school →</p>
    </div>
  );
}

export interface ProvinceSummary {
  province: string;
  total: number;
  avgScore: number | null;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

/** "City of Kigali" / "Kigali City" / "kigali" → "kigali". */
const normProvince = (s: string) =>
  s
    .toLowerCase()
    .replace(/province|city of|city/g, "")
    .trim();

/** Intervention Priority band for a score (Critical <35, High <55, Medium <75, Low ≥75). */
const bandFor = (score: number) =>
  priorityMeta(score < 35 ? "critical" : score < 55 ? "high" : score < 75 ? "medium" : "low");

const RING_R = 17;
const RING_C = 2 * Math.PI * RING_R;

/**
 * Glass badge at a province's centre: a progress ring for the average School
 * Condition Score (coloured by its priority band), the province name and its
 * school count. Hover expands it with the priority breakdown.
 */
function ProvinceBadge({
  x,
  y,
  name,
  summary,
  index,
  interactive,
  active,
  onHover,
  onClick,
  scale = 1,
}: {
  scale?: number;
  x: number;
  y: number;
  name: string;
  summary: ProvinceSummary;
  index: number;
  interactive: boolean;
  active: boolean;
  onHover: (on: boolean) => void;
  onClick?: () => void;
}) {
  const score = summary.avgScore;
  const meta = score === null ? priorityMeta(undefined) : bandFor(score);
  const pct = score === null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  const label = name.replace(" Province", "");
  const delay = `${1700 + index * 140}ms`;
  return (
    <g
      transform={`translate(${x} ${y}) scale(${scale})`}
      className={interactive ? cn("pointer-events-auto", onClick ? "cursor-pointer" : "cursor-default") : undefined}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
      onClick={onClick}
    >
      <g className="rb-badge" style={{ animationDelay: delay }}>
        <g style={{ transform: `scale(${active ? 1.12 : 1})`, transition: "transform 250ms cubic-bezier(.22,1,.36,1)" }}>
          {/* glass disc */}
          {/* soft halo in the band colour; brighter when active */}
          <circle r={RING_R + 14} fill={meta.color} opacity={active ? 0.18 : 0.07} style={{ transition: "opacity 250ms" }} className="rb-halo" />
          <circle r={RING_R + 7} className="fill-white/85 dark:fill-slate-900/75" style={{ filter: "drop-shadow(0 6px 14px rgba(15,23,42,0.12))" }} />
          {/* track + progress */}
          <circle r={RING_R} fill="none" strokeWidth={3.5} className="stroke-slate-900/[0.07] dark:stroke-white/10" />
          <circle
            r={RING_R}
            fill="none"
            stroke={meta.color}
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeDasharray={`${RING_C * pct} ${RING_C}`}
            transform="rotate(-90)"
            className="rb-ring"
            style={{ animationDelay: delay, ["--rb-ring" as string]: `${RING_C}` }}
          />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-slate-900 text-[14px] font-semibold tabular-nums dark:fill-white"
          >
            {score === null ? "—" : Math.round(score)}
          </text>
        </g>

        {/* name + count (expands to the breakdown on hover) */}
        <g transform={`translate(0 ${RING_R + 18})`}>
          <rect
            x={active ? -82 : -54}
            y={-10}
            width={active ? 164 : 108}
            height={active ? (onClick ? 50 : 36) : 20}
            rx={10}
            className="fill-white/85 dark:fill-slate-900/80"
            style={{ transition: "all 250ms cubic-bezier(.22,1,.36,1)", filter: "drop-shadow(0 4px 10px rgba(15,23,42,0.08))" }}
          />
          <text textAnchor="middle" y={0} dominantBaseline="central" className="fill-slate-800 text-[10.5px] font-semibold dark:fill-white/90">
            {label}
            <tspan className="fill-slate-500 font-normal dark:fill-white/50"> · {summary.total} {summary.total === 1 ? "school" : "schools"}</tspan>
          </text>
          {active && onClick && (
            <text textAnchor="middle" y={30} dominantBaseline="central" className="fill-primary text-[9.5px] font-semibold">
              Click for districts →
            </text>
          )}
          {active && (
            <text textAnchor="middle" y={16} dominantBaseline="central" className="text-[12px] font-medium tabular-nums">
              {(["critical", "high", "medium", "low"] as const).map((k, i) => (
                <tspan key={k} fill={PRIORITY_META[k].color} dx={i ? 6 : 0}>
                  ● <tspan className="fill-slate-600 dark:fill-white/70">{summary[k]}</tspan>
                </tspan>
              ))}
            </text>
          )}
        </g>
      </g>
    </g>
  );
}
