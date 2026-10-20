import { useEffect, useRef, useState } from "react";
import { geoDistance, geoGraticule10, geoOrthographic, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { cn } from "../../lib/utils";

/** Kigali — the globe settles here and the beacon pulses here. */
const KIGALI: [number, number] = [30.06, -1.95];
const RWANDA_ID = "646";
/** Resting view: Rwanda a little below centre so Africa reads as a whole. */
const HOME: [number, number] = [-KIGALI[0], -KIGALI[1] - 8];

// Canvas palettes per theme. Hues follow --primary / --brand-* so the
// globe matches the panel and the form in both themes.
const DARK = {
  oceanTop: "hsl(219 64% 22%)",
  oceanBottom: "hsl(224 71% 7%)",
  glow: "hsla(217, 91%, 60%, 0.35)",
  // Same hue at zero alpha — canvas "transparent" is black and greys the fade.
  glowEnd: "hsla(217, 91%, 60%, 0)",
  graticule: "hsla(213, 94%, 85%, 0.07)",
  land: "hsla(213, 94%, 78%, 0.16)",
  borders: "hsla(213, 94%, 88%, 0.14)",
  rwanda: "hsl(217 91% 60%)",
  rwandaEdge: "hsl(213 94% 85%)",
  beacon: "hsl(48 96% 58%)",
  beaconRing: "48, 96%, 58%",
  orbit: "hsla(213, 94%, 85%, 0.22)",
  satellite: "hsl(213 94% 85%)",
  satelliteBack: "hsla(213, 94%, 85%, 0.35)",
  rim: "hsla(213, 94%, 85%, 0.18)",
};
const LIGHT: typeof DARK = {
  oceanTop: "hsl(210 100% 98%)",
  oceanBottom: "hsl(214 90% 83%)",
  glow: "hsla(0, 0%, 100%, 0.75)",
  glowEnd: "hsla(0, 0%, 100%, 0)",
  graticule: "hsla(221, 83%, 40%, 0.10)",
  land: "hsla(221, 83%, 53%, 0.3)",
  borders: "hsla(221, 83%, 35%, 0.18)",
  rwanda: "hsl(221 83% 53%)",
  rwandaEdge: "hsl(224 76% 30%)",
  beacon: "hsl(38 92% 50%)",
  beaconRing: "38, 92%, 50%",
  orbit: "hsla(224, 76%, 35%, 0.35)",
  satellite: "hsl(224 76% 33%)",
  satelliteBack: "hsla(224, 76%, 33%, 0.3)",
  rim: "hsla(224, 76%, 40%, 0.25)",
};
const isDark = () => document.documentElement.classList.contains("dark");

type Land = { countries: GeoPermissibleObjects; borders: GeoPermissibleObjects; rwanda: GeoPermissibleObjects };

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Interactive orthographic globe for the sign-in brand panel: spins in to
 * Rwanda, highlights it with a beacon over Kigali, and can be dragged (or
 * rotated with the arrow keys). Drifts back home after a few idle seconds.
 */
export function AuthGlobe({ className }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const [interacted, setInteracted] = useState(false);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const label = labelRef.current;
    const ctx = canvas?.getContext("2d");
    if (!wrap || !canvas || !label || !ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let C = isDark() ? DARK : LIGHT;
    // Re-palette (and redraw once) when the theme class on <html> flips.
    const themeObserver = new MutationObserver(() => {
      C = isDark() ? DARK : LIGHT;
      if (!frame) frame = requestAnimationFrame(tick);
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    const projection = geoOrthographic().clipAngle(90).precision(0.6);
    const path = geoPath(projection, ctx);
    const graticule = geoGraticule10();

    let land: Land | null = null;
    let size = 0;
    let dpr = 1;
    let frame = 0;
    let visible = true;
    let cancelled = false;

    // Rotation state: [lambda, phi]. Intro starts a third of the way round.
    const rot: [number, number] = reduceMotion ? [...HOME] : [HOME[0] + 140, HOME[1] + 12];
    const introFrom: [number, number] = [...rot];
    const start = performance.now();
    const INTRO_MS = reduceMotion ? 0 : 2600;
    let introDone = reduceMotion;
    let dragging = false;
    let last: [number, number] = [0, 0];
    let velocity: [number, number] = [0, 0];
    let lastInput = 0;

    void import("world-atlas/countries-110m.json").then((mod) => {
      if (cancelled) return;
      const topo = (mod.default ?? mod) as unknown as Topology<{ countries: GeometryCollection }>;
      const countries = feature(topo, topo.objects.countries);
      land = {
        countries,
        borders: mesh(topo, topo.objects.countries, (a, b) => a !== b),
        rwanda: {
          type: "FeatureCollection",
          features: countries.features.filter((f) => String(f.id) === RWANDA_ID),
        },
      };
      if (!frame) frame = requestAnimationFrame(tick);
    });

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      size = Math.max(120, Math.min(rect.width, rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      if (!frame && !cancelled) frame = requestAnimationFrame(tick);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !frame) frame = requestAnimationFrame(tick);
    });
    io.observe(wrap);

    function drawOrbit(r: number, cx: number, cy: number, now: number, front: boolean) {
      const rx = r * 1.22;
      const ry = r * 0.3;
      const tilt = (-18 * Math.PI) / 180;
      ctx!.save();
      ctx!.translate(cx, cy);
      ctx!.rotate(tilt);
      ctx!.beginPath();
      // Front half = lower half of the ellipse (sin > 0).
      ctx!.ellipse(0, 0, rx, ry, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2);
      ctx!.setLineDash([2, 6]);
      ctx!.lineWidth = 1;
      ctx!.strokeStyle = C.orbit;
      ctx!.stroke();
      ctx!.setLineDash([]);

      const t = reduceMotion ? 0.6 : (now / 9000) * Math.PI * 2;
      const sin = Math.sin(t);
      if (sin > 0 === front) {
        const x = rx * Math.cos(t);
        const y = ry * sin;
        ctx!.beginPath();
        ctx!.arc(x, y, front ? 3 : 2, 0, Math.PI * 2);
        ctx!.fillStyle = front ? C.satellite : C.satelliteBack;
        ctx!.shadowColor = C.rwanda;
        ctx!.shadowBlur = front ? 10 : 0;
        ctx!.fill();
      }
      ctx!.restore();
    }

    function draw(now: number) {
      const s = size * dpr;
      const r = (size / 2) * 0.72 * dpr;
      const cx = s / 2;
      const cy = s / 2;
      ctx!.clearRect(0, 0, s, s);
      projection.scale(r).translate([cx, cy]).rotate([rot[0], rot[1], 0]);

      // Atmosphere glow
      const glow = ctx!.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.35);
      glow.addColorStop(0, C.glow);
      glow.addColorStop(1, C.glowEnd);
      ctx!.fillStyle = glow;
      ctx!.fillRect(0, 0, s, s);

      drawOrbit(r, cx, cy, now, false);

      // Ocean
      const ocean = ctx!.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
      ocean.addColorStop(0, C.oceanTop);
      ocean.addColorStop(1, C.oceanBottom);
      ctx!.beginPath();
      path({ type: "Sphere" });
      ctx!.fillStyle = ocean;
      ctx!.fill();

      ctx!.beginPath();
      path(graticule);
      ctx!.lineWidth = 0.6 * dpr;
      ctx!.strokeStyle = C.graticule;
      ctx!.stroke();

      if (land) {
        ctx!.beginPath();
        path(land.countries);
        ctx!.fillStyle = C.land;
        ctx!.fill();

        ctx!.beginPath();
        path(land.borders);
        ctx!.lineWidth = 0.5 * dpr;
        ctx!.strokeStyle = C.borders;
        ctx!.stroke();

        ctx!.beginPath();
        path(land.rwanda);
        ctx!.fillStyle = C.rwanda;
        ctx!.shadowColor = C.rwanda;
        ctx!.shadowBlur = 12 * dpr;
        ctx!.fill();
        ctx!.shadowBlur = 0;
        ctx!.lineWidth = 1 * dpr;
        ctx!.strokeStyle = C.rwandaEdge;
        ctx!.stroke();
      }

      // Rim light
      ctx!.beginPath();
      path({ type: "Sphere" });
      ctx!.lineWidth = 1 * dpr;
      ctx!.strokeStyle = C.rim;
      ctx!.stroke();

      // Beacon over Kigali, only while it faces us
      const centre: [number, number] = [-rot[0], -rot[1]];
      const facing = geoDistance(KIGALI, centre) < Math.PI / 2 - 0.08;
      const p = projection(KIGALI);
      if (facing && p) {
        const [bx, by] = p;
        if (!reduceMotion) {
          for (let i = 0; i < 2; i++) {
            const phase = ((now / 2200 + i / 2) % 1 + 1) % 1;
            ctx!.beginPath();
            ctx!.arc(bx, by, (4 + phase * 22) * dpr, 0, Math.PI * 2);
            ctx!.strokeStyle = `hsla(${C.beaconRing}, ${0.6 * (1 - phase)})`;
            ctx!.lineWidth = 1.2 * dpr;
            ctx!.stroke();
          }
        }
        ctx!.beginPath();
        ctx!.arc(bx, by, 3.2 * dpr, 0, Math.PI * 2);
        ctx!.fillStyle = C.beacon;
        ctx!.shadowColor = C.beacon;
        ctx!.shadowBlur = 10 * dpr;
        ctx!.fill();
        ctx!.shadowBlur = 0;

        label!.style.opacity = introDone ? "1" : "0";
        // Canvas is centred in a wider wrapper — offset into wrapper space.
        const lx = canvas!.offsetLeft + bx / dpr + 16;
        const ly = canvas!.offsetTop + by / dpr - 58;
        label!.style.transform = `translate(${lx}px, ${ly}px)`;
      } else {
        label!.style.opacity = "0";
      }

      drawOrbit(r, cx, cy, now, true);
    }

    function tick(now: number) {
      frame = 0;
      if (cancelled) return;

      if (!introDone) {
        const t = Math.min(1, (now - start) / INTRO_MS);
        const e = easeOut(t);
        rot[0] = introFrom[0] + (HOME[0] - introFrom[0]) * e;
        rot[1] = introFrom[1] + (HOME[1] - introFrom[1]) * e;
        if (t >= 1) introDone = true;
      } else if (!dragging) {
        // Inertia after a fling…
        if (Math.abs(velocity[0]) + Math.abs(velocity[1]) > 0.01) {
          rot[0] += velocity[0];
          rot[1] = Math.max(-70, Math.min(70, rot[1] + velocity[1]));
          velocity = [velocity[0] * 0.94, velocity[1] * 0.94];
        } else if (now - lastInput > 2500) {
          // …then drift home with a gentle sway so it never sits dead still.
          const sway = reduceMotion ? 0 : Math.sin(now / 4000) * 12;
          const targetL = HOME[0] + sway;
          let dl = ((targetL - rot[0] + 540) % 360) - 180;
          if (Math.abs(dl) < 0.001) dl = 0;
          rot[0] += dl * 0.03;
          rot[1] += (HOME[1] - rot[1]) * 0.03;
        }
      }

      draw(now);
      if (visible && (!reduceMotion || dragging || !introDone)) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);

    const nudge = () => {
      lastInput = performance.now();
      introDone = true;
      setInteracted(true);
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const onDown = (e: PointerEvent) => {
      dragging = true;
      last = [e.clientX, e.clientY];
      velocity = [0, 0];
      canvas.setPointerCapture(e.pointerId);
      nudge();
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const k = 70 / (size / 2);
      const dx = (e.clientX - last[0]) * k * 0.4;
      const dy = (e.clientY - last[1]) * k * 0.4;
      rot[0] += dx;
      rot[1] = Math.max(-70, Math.min(70, rot[1] - dy));
      velocity = [dx, -dy];
      last = [e.clientX, e.clientY];
      nudge();
    };
    const onUp = () => {
      dragging = false;
      lastInput = performance.now();
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const onKey = (e: KeyboardEvent) => {
      const step = 8;
      if (e.key === "ArrowLeft") rot[0] -= step;
      else if (e.key === "ArrowRight") rot[0] += step;
      else if (e.key === "ArrowUp") rot[1] = Math.min(70, rot[1] + step);
      else if (e.key === "ArrowDown") rot[1] = Math.max(-70, rot[1] - step);
      else if (e.key === "Home") rot.splice(0, 2, ...HOME);
      else return;
      e.preventDefault();
      velocity = [0, 0];
      nudge();
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("keydown", onKey);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      themeObserver.disconnect();
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={wrapRef} className={cn("relative flex items-center justify-center", className)}>
      <canvas
        ref={canvasRef}
        tabIndex={0}
        role="img"
        aria-label="Interactive globe highlighting Rwanda. Drag, or use the arrow keys, to rotate it."
        className="cursor-grab active:cursor-grabbing touch-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/60"
      />
      {/* Callout pinned to Kigali; positioned every frame from the projection. */}
      <div
        ref={labelRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 opacity-0 transition-opacity duration-500"
        style={{ willChange: "transform" }}
      >
        <div className="rounded-xl border border-brand-accent/20 dark:border-white/10 bg-white/85 dark:bg-brand/80 px-3 py-2 shadow-lg shadow-brand-accent/10 dark:shadow-none backdrop-blur-md">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-ink">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-gold" />
            Rwanda
          </p>
          <p className="text-[11px] text-brand-ink/65 dark:text-brand-soft/70">National TVET school network</p>
        </div>
      </div>
      <p
        className={cn(
          "pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 text-[11px] text-brand-ink/50 dark:text-white/40 transition-opacity duration-500",
          interacted && "opacity-0",
        )}
      >
        Drag to explore
      </p>
    </div>
  );
}
