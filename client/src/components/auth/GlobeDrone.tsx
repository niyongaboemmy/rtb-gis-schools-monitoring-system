import { useImperativeHandle, useRef, type Ref } from "react";
import { geoDistance, geoInterpolate, type GeoPath, type GeoProjection } from "d3-geo";
import { RWANDA_CENTER, RWANDA_SCHOOLS, ZOOM_RWANDA, ZOOM_SCHOOL, type LonLat } from "./globe-scope";
import { FONT_SANS } from "../../lib/fonts";

/**
 * A survey drone working the platform's scope: TVET schools in Rwanda.
 *
 * Cycle: the globe rests → the camera dives into Rwanda → the drone takes off
 * from Kigali and surveys a run of schools (every school is visited before
 * any repeats), hovering at each to "capture" (camera close-up, footprint,
 * scan line, shutter flashes, live telemetry card) → the camera climbs back
 * out to the globe. Telemetry follows real photogrammetry practice: ~120 m
 * AGL, ~3.3 cm/px GSD on a 1-inch sensor.
 *
 * Everything is driven from the globe's own animation frame (no React
 * re-renders): the parent calls `camera()`, `drawGround()` and `update()`.
 */

export interface DroneFrame {
  now: number;
  projection: GeoProjection;
  /** Globe centre [lon, lat] currently facing the viewer. */
  centre: [number, number];
  /** Canvas offset inside the wrapper and its CSS size. */
  offsetX: number;
  offsetY: number;
  dpr: number;
  /** Globe radius at zoom 1, and its centre, in CSS px (canvas space). */
  radius: number;
  /** Current camera zoom (1 = whole globe). */
  zoom: number;
  /** Canvas CSS size (square). */
  canvasSize: number;
  cx: number;
  wrapWidth: number;
  wrapHeight: number;
  /** False until the intro spin has finished. */
  active: boolean;
  dark: boolean;
  /** Box (wrapper px) the telemetry card should avoid — the Rwanda callout. */
  avoid: Box | null;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export interface GlobeDroneHandle {
  /** Positions the drone; returns whether it or its card covers `f.avoid`. */
  update: (f: DroneFrame) => boolean;
  /** Where the camera should look (null = free: the whole globe). */
  camera: () => { focus: [number, number]; zoom: number } | null;
  /** Ground layer (route, footprint) — call inside the canvas draw, before the beacon. */
  drawGround: (ctx: CanvasRenderingContext2D, path: GeoPath, f: DroneFrame) => void;
}

type Phase = "rest" | "dive" | "fly" | "scan" | "done" | "ascend";

const RAD = Math.PI / 180;
const KIGALI: LonLat = [30.06, -1.95];
const REST_MS = 3200;
const FIRST_REST_MS = 900;
const DIVE_MS = 1700;
const ASCEND_MS = 1500;
const SCAN_MS = 4600;
const DONE_MS = 1400;
/** The camera starts pulling back this far into the "Synced" beat. */
const ZOOM_RELEASE_MS = 500;
const SCHOOLS_PER_RUN = 3;

const TASKS = ["Campus orthomosaic", "Workshop roof inspection", "Site boundary mapping", "Classroom block scan"];

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerpAngle = (a: number, b: number, k: number) => a + ((((b - a) % 360) + 540) % 360 - 180) * k;
const shuffled = (n: number) => {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const fmtCoord = ([lon, lat]: LonLat) =>
  `${Math.abs(lat).toFixed(4)}° ${lat < 0 ? "S" : "N"}  ${Math.abs(lon).toFixed(4)}° ${lon < 0 ? "W" : "E"}`;

/**
 * Close-up progress: 0 at the Rwanda overview, 1 at a school close-up.
 * Measured on a log scale so it tracks how the zoom feels.
 */
const closeUp = (zoom: number) => clamp01(Math.log(zoom / ZOOM_RWANDA) / Math.log(ZOOM_SCHOOL / ZOOM_RWANDA));
/** 0 on the whole globe, 1 once the camera is down at the Rwanda overview. */
const inRwanda = (zoom: number) => clamp01(Math.log(zoom) / Math.log(ZOOM_RWANDA));

interface Mission {
  school: number;
  task: string;
  agl: number;
  frames: number;
  stop: number;
}

export function GlobeDrone({ ref }: { ref: Ref<GlobeDroneHandle> }) {
  const droneRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const lensRef = useRef<HTMLDivElement>(null);
  const t = {
    status: useRef<HTMLSpanElement>(null),
    stop: useRef<HTMLSpanElement>(null),
    dot: useRef<HTMLSpanElement>(null),
    mission: useRef<HTMLParagraphElement>(null),
    place: useRef<HTMLParagraphElement>(null),
    coords: useRef<HTMLParagraphElement>(null),
    timecode: useRef<HTMLSpanElement>(null),
    zoom: useRef<HTMLSpanElement>(null),
    agl: useRef<HTMLSpanElement>(null),
    gsd: useRef<HTMLSpanElement>(null),
    battery: useRef<HTMLSpanElement>(null),
    frames: useRef<HTMLSpanElement>(null),
    bar: useRef<HTMLSpanElement>(null),
  };

  // Mutable flight state — never rendered through React.
  const s = useRef({
    phase: "rest" as Phase,
    /** Survey order (shuffled), position in it, and this run's queue. */
    order: shuffled(RWANDA_SCHOOLS.length),
    orderPos: 0,
    queue: [] as number[],
    /** Schools captured during the current run (shown green on the map). */
    visited: new Set<number>(),
    runs: 0,
    from: KIGALI as LonLat,
    to: KIGALI as LonLat,
    pos: KIGALI as LonLat,
    interp: geoInterpolate(KIGALI, KIGALI),
    phaseStart: 0,
    flightMs: 0,
    heading: 0,
    pitch: 0,
    roll: 0,
    altitude: 0,
    battery: 97,
    mission: null as Mission | null,
    lastFrames: -1,
    flash: 0,
    visible: 0,
    /** 0→1 slow push-in on the drone during a capture. */
    push: 0,
    /** Last on-screen placement (CSS px) — the camera beam starts here. */
    screen: null as { x: number; y: number; alt: number; size: number } | null,
  });

  useImperativeHandle(ref, () => {
    const setText = (el: HTMLElement | null, text: string) => {
      if (el && el.textContent !== text) el.textContent = text;
    };

    /** Next SCHOOLS_PER_RUN schools, cycling through all of them in shuffled order. */
    const planRun = () => {
      const st = s.current;
      st.queue = [];
      for (let i = 0; i < SCHOOLS_PER_RUN; i++) {
        if (st.orderPos >= st.order.length) {
          st.order = shuffled(RWANDA_SCHOOLS.length);
          st.orderPos = 0;
        }
        st.queue.push(st.order[st.orderPos++]);
      }
      st.visited = new Set();
    };

    const setPhase = (phase: Phase, now: number) => {
      s.current.phase = phase;
      s.current.phaseStart = now;
    };

    const startFlight = (now: number) => {
      const st = s.current;
      const school = st.queue.shift()!;
      st.from = st.pos;
      st.to = RWANDA_SCHOOLS[school].at;
      st.interp = geoInterpolate(st.from, st.to);
      st.flightMs = 1500 + (geoDistance(st.from, st.to) / RAD) * 1500;
      st.mission = {
        school,
        task: pick(TASKS),
        agl: 100 + Math.round(Math.random() * 6) * 5,
        frames: 48 + Math.round(Math.random() * 10) * 4,
        stop: SCHOOLS_PER_RUN - st.queue.length,
      };
      setPhase("fly", now);
    };

    const fillCard = () => {
      const st = s.current;
      const m = st.mission;
      if (!m) return;
      const school = RWANDA_SCHOOLS[m.school];
      setText(t.mission.current, school.name);
      setText(t.place.current, `${m.task} · ${school.district} District`);
      setText(t.stop.current, `Stop ${m.stop}/${SCHOOLS_PER_RUN}`);
      setText(t.coords.current, fmtCoord(st.to));
      setText(t.agl.current, `${m.agl} m`);
      // 1-inch sensor, 8.8 mm lens, 5472 px: GSD ≈ 2.74 cm/px per 100 m.
      setText(t.gsd.current, `${((m.agl / 100) * 2.74).toFixed(1)} cm/px`);
      setText(t.battery.current, `${st.battery}%`);
      st.lastFrames = -1;
    };

    const setStatus = (done: boolean) => {
      setText(t.status.current, done ? "Synced" : "Capturing");
      const dot = t.dot.current;
      if (dot) dot.dataset.state = done ? "done" : "rec";
      const bar = t.bar.current;
      if (bar) bar.dataset.state = done ? "done" : "rec";
    };

    const drawSchools = (ctx: CanvasRenderingContext2D, f: DroneFrame, alpha: number) => {
      const st = s.current;
      const d = f.dpr;
      const target = st.mission && st.phase !== "rest" && st.phase !== "ascend" ? st.mission.school : -1;
      const placed: Box[] = [];
      const gold = f.dark ? "48, 96%, 58%" : "38, 92%, 50%";
      const green = "152, 76%, 45%";
      const ink = f.dark ? "213, 94%, 82%" : "224, 76%, 40%";
      const halo = f.dark ? "224, 71%, 6%" : "0, 0%, 100%";
      ctx.font = `600 ${11 * d}px ${FONT_SANS}`;
      ctx.textBaseline = "middle";

      // Draw the target last so its label wins any collision.
      const order = RWANDA_SCHOOLS.map((_, i) => i).sort((a, b) => (a === target ? 1 : b === target ? -1 : 0));
      const labels: { i: number; x: number; y: number }[] = [];
      for (const i of order) {
        const sp = f.projection(RWANDA_SCHOOLS[i].at);
        if (!sp) continue;
        const isTarget = i === target;
        const done = st.visited.has(i) && !isTarget;
        const hue = isTarget ? gold : done ? green : ink;
        if (isTarget) {
          const phase = (f.now / 1600) % 1;
          ctx.beginPath();
          ctx.arc(sp[0], sp[1], (6 + phase * 14) * d, 0, Math.PI * 2);
          ctx.strokeStyle = `hsla(${gold}, ${0.55 * (1 - phase) * alpha})`;
          ctx.lineWidth = 1.4 * d;
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(sp[0], sp[1], (isTarget ? 5 : 3.6) * d, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, ${alpha})`;
        ctx.fill();
        ctx.lineWidth = 2 * d;
        ctx.strokeStyle = `hsla(${halo}, ${0.95 * alpha})`;
        ctx.stroke();
        labels.push({ i, x: sp[0], y: sp[1] });
      }

      // Labels: pill to the right of each marker, skipped if they'd overlap.
      for (const { i, x, y } of labels.reverse()) {
        const isTarget = i === target;
        const text = RWANDA_SCHOOLS[i].short;
        const w = ctx.measureText(text).width + 14 * d;
        const h = 18 * d;
        const box = { x: x + 9 * d, y: y - h / 2, w, h };
        if (!isTarget && placed.some((b) => overlaps(b, box))) continue;
        placed.push(box);
        ctx.beginPath();
        ctx.roundRect(box.x, box.y, box.w, box.h, h / 2);
        ctx.fillStyle = isTarget
          ? `hsla(${gold}, ${0.95 * alpha})`
          : `hsla(${halo}, ${0.78 * alpha})`;
        ctx.fill();
        ctx.fillStyle = isTarget
          ? `hsla(224, 71%, 8%, ${alpha})`
          : `hsla(${st.visited.has(i) ? green : ink}, ${alpha})`;
        ctx.fillText(text, box.x + 7 * d, y + 0.5 * d);
      }
    };

    return {
      camera() {
        const st = s.current;
        switch (st.phase) {
          case "rest":
          case "ascend":
            return null;
          case "scan":
            return { focus: st.to, zoom: ZOOM_SCHOOL };
          case "done":
            return performance.now() - st.phaseStart < ZOOM_RELEASE_MS
              ? { focus: st.to, zoom: ZOOM_SCHOOL }
              : { focus: RWANDA_CENTER, zoom: ZOOM_RWANDA };
          default:
            return { focus: RWANDA_CENTER, zoom: ZOOM_RWANDA };
        }
      },

      update(f) {
        const st = s.current;
        const drone = droneRef.current;
        const body = bodyRef.current;
        const shadow = shadowRef.current;
        const card = cardRef.current;
        if (!drone || !body || !shadow || !card) return false;

        if (!f.active) {
          drone.style.opacity = shadow.style.opacity = card.style.opacity = "0";
          if (lensRef.current) lensRef.current.style.opacity = "0";
          st.phaseStart = f.now;
          return false;
        }

        // ── State machine ─────────────────────────────────────────────
        const elapsed = f.now - st.phaseStart;
        let targetPitch = 0;
        if (st.phase === "rest") {
          if (elapsed > (st.runs === 0 ? FIRST_REST_MS : REST_MS)) {
            planRun();
            st.pos = KIGALI;
            st.altitude = 0;
            setPhase("dive", f.now);
          }
        } else if (st.phase === "dive") {
          // Take off from Kigali as the camera comes down over Rwanda.
          if (elapsed > DIVE_MS) startFlight(f.now);
        } else if (st.phase === "ascend") {
          if (elapsed > ASCEND_MS) {
            st.runs += 1;
            setPhase("rest", f.now);
          }
        } else if (st.phase === "fly") {
          const k = Math.min(1, elapsed / st.flightMs);
          st.pos = st.interp(easeInOut(k));
          targetPitch = Math.sin(Math.PI * k) * 22; // nose down mid-leg
          if (k >= 1) {
            st.phase = "scan";
            st.phaseStart = f.now;
            fillCard();
            setStatus(false);
          }
        } else if (st.phase === "scan") {
          const k = Math.min(1, elapsed / SCAN_MS);
          const m = st.mission!;
          const frames = Math.round(k * m.frames);
          if (frames !== st.lastFrames) {
            if (frames > st.lastFrames && st.lastFrames >= 0 && frames % 6 === 0) st.flash = 1;
            st.lastFrames = frames;
            setText(t.frames.current, `${frames}/${m.frames}`);
            if (t.bar.current) t.bar.current.style.transform = `scaleX(${k})`;
          }
          if (k >= 1) {
            st.phase = "done";
            st.phaseStart = f.now;
            st.battery = st.battery <= 41 ? 98 : st.battery - 1 - Math.round(Math.random() * 2);
            setText(t.battery.current, `${st.battery}%`);
            setStatus(true);
            st.visited.add(m.school);
          }
        } else if (st.phase === "done" && elapsed > DONE_MS) {
          if (st.queue.length) startFlight(f.now);
          else setPhase("ascend", f.now);
        }

        // ── Screen placement ──────────────────────────────────────────
        const p = f.projection(st.pos);
        const facing = geoDistance(st.pos, f.centre) < Math.PI / 2 - 0.15;
        const working = st.phase !== "rest" && st.phase !== "ascend";
        st.visible += ((working && facing && p ? 1 : 0) - st.visible) * (working ? 0.12 : 0.18);
        if (!p) return false;
        const x = f.offsetX + p[0] / f.dpr;
        const y = f.offsetY + p[1] / f.dpr;

        // Heading from the screen direction of travel; slow yaw sweep while scanning.
        if (st.phase === "fly") {
          const k = Math.min(1, (f.now - st.phaseStart) / st.flightMs);
          const ahead = f.projection(st.interp(Math.min(1, easeInOut(k) + 0.02)));
          if (ahead && (Math.abs(ahead[0] - p[0]) + Math.abs(ahead[1] - p[1]) > 0.3)) {
            const want = (Math.atan2(ahead[1] - p[1], ahead[0] - p[0]) * 180) / Math.PI + 90;
            const before = st.heading;
            st.heading = lerpAngle(st.heading, want, 0.08);
            st.roll += (Math.max(-14, Math.min(14, (st.heading - before) * 6)) - st.roll) * 0.1;
          }
        } else {
          st.heading += Math.sin(f.now / 900) * 0.15;
          st.roll *= 0.9;
        }
        st.pitch += (targetPitch - st.pitch) * 0.08;

        // The camera zooming in brings the drone closer too: it grows ~2.7×,
        // then a slow push-in during the capture brings it ~30% closer again.
        // It hovers higher above its target so the shot below stays visible.
        const zr = inRwanda(f.zoom);
        const zp = closeUp(f.zoom);
        const pushTarget = st.phase === "scan" ? Math.min(1, (f.now - st.phaseStart) / SCAN_MS) : 0;
        st.push += (pushTarget - st.push) * (pushTarget > st.push ? 0.04 : 0.08);
        const size =
          Math.max(48, Math.min(74, f.radius * 0.27)) * (0.75 + 0.5 * zr) * (1 + 1.3 * zp) * (1 + 0.3 * st.push * zp);

        // Altitude: climb out of Kigali, cruise, rise above the target in the
        // close-up so the shot below stays visible, gentle hover bob.
        const cruise = f.radius * 0.085 * (0.8 + 0.6 * zr);
        const targetAlt =
          st.phase === "dive" ? cruise * clamp01((f.now - st.phaseStart) / DIVE_MS) : (st.phase === "fly" ? cruise : cruise * 0.7) + zp * size * 0.72;
        st.altitude += (targetAlt - st.altitude) * 0.08;
        const bob = Math.sin(f.now / 520) * (1.2 + zp * 2);
        const alt = st.altitude + bob;
        st.screen = { x, y, alt, size };

        const op = String(Math.max(0, Math.min(1, st.visible)));
        drone.style.opacity = op;
        drone.style.width = drone.style.height = `${size}px`;
        drone.style.transform = `translate(${x - size / 2}px, ${y - alt - size / 2}px)`;
        body.style.transform = `rotate(${st.heading}deg) perspective(${240 + zp * 360}px) rotateX(${st.pitch}deg) rotateY(${st.roll}deg)`;

        // Shadow: the drone's own silhouette on the ground, cast by a sun to
        // the upper left — offset, softer and fainter the higher it hovers.
        const lift = Math.min(1, alt / (size * 1.6));
        shadow.style.opacity = String(Number(op) * (f.dark ? 0.55 : 0.32) * (1 - 0.55 * lift));
        shadow.style.width = shadow.style.height = `${size * 0.92}px`;
        shadow.style.filter = `blur(${(1 + lift * 5).toFixed(1)}px)`;
        shadow.style.transform = `translate(${x + alt * 0.12 - size * 0.46}px, ${y + alt * 0.06 - size * 0.46}px) rotate(${st.heading}deg) scale(${1 - 0.15 * lift})`;

        const droneBox: Box = { x: x - size / 2, y: y - alt - size / 2, w: size, h: size };
        let covers = st.visible > 0.3 && !!f.avoid && overlaps(droneBox, f.avoid);

        // ── Telemetry card ────────────────────────────────────────────
        const showCard = (st.phase === "scan" || st.phase === "done") && zp > 0.3;
        card.style.opacity = showCard ? op : "0";
        if (showCard) {
          const w = card.offsetWidth;
          const h = card.offsetHeight;
          const gap = size * 0.6;
          const clamp = (b: Box): Box => ({
            ...b,
            x: Math.max(8, Math.min(f.wrapWidth - w - 8, b.x)),
            y: Math.max(8, Math.min(f.wrapHeight - h - 8, b.y)),
          });
          // Prefer the outer side of the globe, above the drone; take the
          // first spot that keeps clear of the drone and the Rwanda callout.
          const outerRight = x > f.offsetX + f.cx;
          const right = { x: x + gap, w, h };
          const left = { x: x - w - gap, w, h };
          const above = y - alt - h + size * 0.2;
          const below = y - alt + size * 0.6;
          const order = outerRight ? [right, left] : [left, right];
          const candidates = [
            ...order.map((c) => clamp({ ...c, y: above })),
            ...order.map((c) => clamp({ ...c, y: below })),
          ];
          const clear = candidates.find((b) => !overlaps(b, droneBox) && !(f.avoid && overlaps(b, f.avoid)));
          const spot = clear ?? candidates[0];
          if (!clear && f.avoid && overlaps(spot, f.avoid)) covers = true;
          card.style.transform = `translate(${spot.x}px, ${spot.y}px)`;
        }
        // ── Viewfinder over the lens while zoomed ─────────────────────
        const lens = lensRef.current;
        if (lens) {
          const k = closeUp(f.zoom);
          lens.style.opacity = String(k);
          lens.style.width = lens.style.height = `${f.canvasSize}px`;
          lens.style.transform = `translate(${f.offsetX}px, ${f.offsetY}px) scale(${1.04 - 0.04 * k})`;
          if (k > 0) {
            const secs = st.phase === "scan" ? Math.floor((f.now - st.phaseStart) / 1000) : Math.floor(SCAN_MS / 1000);
            setText(t.timecode.current, `00:00:${String(secs).padStart(2, "0")}`);
            setText(t.zoom.current, `${f.zoom.toFixed(1)}×`);
          }
        }
        return covers;
      },

      drawGround(ctx, path, f) {
        const st = s.current;
        if (!f.active) return;
        const a = st.visible;
        const d = f.dpr;
        const ink = f.dark ? "213, 94%, 82%" : "224, 76%, 40%";
        ctx.save();

        // Over Rwanda: every sample school as a labelled marker — the target
        // glows gold, schools surveyed this run turn green.
        const schoolsAlpha = clamp01((inRwanda(f.zoom) - 0.75) / 0.2);
        if (schoolsAlpha > 0.02) drawSchools(ctx, f, schoolsAlpha);
        if (st.visible < 0.05) {
          ctx.restore();
          return;
        }

        // Route: flown part solid-ish, remaining part dotted, target ring.
        if (st.phase === "fly") {
          ctx.beginPath();
          path({ type: "LineString", coordinates: [st.from, st.pos] });
          ctx.strokeStyle = `hsla(${ink}, ${0.45 * a})`;
          ctx.lineWidth = 1.2 * d;
          ctx.setLineDash([]);
          ctx.stroke();
          ctx.beginPath();
          path({ type: "LineString", coordinates: [st.pos, st.to] });
          ctx.strokeStyle = `hsla(${ink}, ${0.3 * a})`;
          ctx.setLineDash([1.5 * d, 4 * d]);
          ctx.stroke();
          ctx.setLineDash([]);
          const tp = f.projection(st.to);
          if (tp && geoDistance(st.to, f.centre) < Math.PI / 2) {
            ctx.beginPath();
            ctx.arc(tp[0], tp[1], 3.5 * d, 0, Math.PI * 2);
            ctx.strokeStyle = `hsla(${ink}, ${0.6 * a})`;
            ctx.lineWidth = 1 * d;
            ctx.stroke();
          }
        }

        // Camera footprint with corner brackets, sweep line and shutter flash.
        if (st.phase === "scan" || st.phase === "done") {
          const p = f.projection(st.pos);
          if (p) {
            const k = st.phase === "scan" ? Math.min(1, (f.now - st.phaseStart) / SCAN_MS) : 1;
            const fadeOut = st.phase === "done" ? Math.max(0, 1 - (f.now - st.phaseStart) / DONE_MS) : 1;
            const grow = Math.min(1, (f.now - st.phaseStart) / 300);
            const half = f.radius * 0.07 * d * (1 + Math.min(0.6, (f.zoom - 1) * 0.2)) * (st.phase === "scan" ? grow : 1);
            const alpha = a * fadeOut;
            const accent = f.dark ? "217, 91%, 65%" : "221, 83%, 53%";

            // Camera beam from the gimbal down to the footprint (shows once the
            // drone has climbed above its target in the close-up).
            const sc = st.screen;
            const zp = Math.max(0, Math.min(1, (f.zoom - 1) / 1.4));
            if (sc && zp > 0.05) {
              const h = (st.heading * Math.PI) / 180;
              const gx = (sc.x - f.offsetX + Math.sin(h) * 0.28 * sc.size) * d;
              const gy = (sc.y - sc.alt - f.offsetY - Math.cos(h) * 0.28 * sc.size) * d;
              const corners = ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([cx, cy]) => {
                const lx = cx * half;
                const ly = cy * half;
                return [p[0] + lx * Math.cos(h) - ly * Math.sin(h), p[1] + lx * Math.sin(h) + ly * Math.cos(h)] as const;
              });
              corners.sort((u, v) => Math.atan2(u[1] - gy, u[0] - gx) - Math.atan2(v[1] - gy, v[0] - gx));
              const beam = ctx.createLinearGradient(gx, gy, p[0], p[1]);
              beam.addColorStop(0, `hsla(${accent}, ${0.32 * alpha * zp})`);
              beam.addColorStop(1, `hsla(${accent}, ${0.06 * alpha * zp})`);
              ctx.beginPath();
              ctx.moveTo(gx, gy);
              for (const [cx, cy] of corners) ctx.lineTo(cx, cy);
              ctx.closePath();
              ctx.fillStyle = beam;
              ctx.fill();
            }

            ctx.translate(p[0], p[1]);
            ctx.rotate((st.heading * Math.PI) / 180);

            ctx.fillStyle = `hsla(${accent}, ${0.12 * alpha})`;
            ctx.fillRect(-half, -half, half * 2, half * 2);
            if (st.flash > 0.01) {
              ctx.fillStyle = `hsla(0, 0%, 100%, ${0.45 * st.flash * alpha})`;
              ctx.fillRect(-half, -half, half * 2, half * 2);
              st.flash *= 0.82;
            }

            const c = half * 0.38;
            ctx.strokeStyle = `hsla(${accent}, ${0.95 * alpha})`;
            ctx.lineWidth = 1.4 * d;
            ctx.beginPath();
            for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
              ctx.moveTo(sx * half, sy * half + -sy * c);
              ctx.lineTo(sx * half, sy * half);
              ctx.lineTo(sx * half + -sx * c, sy * half);
            }
            ctx.stroke();

            if (st.phase === "scan") {
              const sweep = -half + ((f.now / 900) % 1) * half * 2;
              const g = ctx.createLinearGradient(0, sweep - half * 0.5, 0, sweep);
              g.addColorStop(0, `hsla(${accent}, 0)`);
              g.addColorStop(1, `hsla(${accent}, ${0.35 * alpha})`);
              ctx.fillStyle = g;
              ctx.fillRect(-half, Math.max(-half, sweep - half * 0.5), half * 2, Math.min(half * 0.5, sweep + half));
              ctx.beginPath();
              ctx.moveTo(-half, sweep);
              ctx.lineTo(half, sweep);
              ctx.strokeStyle = `hsla(${accent}, ${0.9 * alpha})`;
              ctx.lineWidth = 1 * d;
              ctx.stroke();
              // progress tick along the bottom edge
              ctx.beginPath();
              ctx.moveTo(-half, half + 4 * d);
              ctx.lineTo(-half + half * 2 * k, half + 4 * d);
              ctx.strokeStyle = `hsla(${accent}, ${0.8 * alpha})`;
              ctx.lineWidth = 1.5 * d;
              ctx.stroke();
            }
          }
        }
        ctx.restore();
      },
    };
    // Refs are stable; build the handle once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <style>{DRONE_CSS}</style>

      {/* Camera viewfinder — fades in over the round lens while zoomed */}
      <div
        ref={lensRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 rounded-full opacity-0"
        style={{ willChange: "transform, opacity" }}
      >
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,transparent_58%,rgba(30,64,175,0.14)_100%)] dark:bg-[radial-gradient(circle,transparent_55%,rgba(2,6,23,0.55)_100%)]" />
        <div className="absolute inset-0 rounded-full ring-1 ring-brand-accent/30 dark:ring-white/15" />
        {/* corner brackets, inset so they sit inside the circle */}
        {(["left-[19%] top-[19%] border-l-2 border-t-2 rounded-tl-md", "right-[19%] top-[19%] border-r-2 border-t-2 rounded-tr-md", "left-[19%] bottom-[19%] border-l-2 border-b-2 rounded-bl-md", "right-[19%] bottom-[19%] border-r-2 border-b-2 rounded-br-md"] as const).map((c) => (
          <span key={c} className={`absolute h-6 w-6 border-brand-accent/80 dark:border-white/70 ${c}`} />
        ))}
        {/* centre crosshair */}
        <span className="absolute left-1/2 top-1/2 h-px w-5 -translate-x-1/2 -translate-y-1/2 bg-brand-accent/70 dark:bg-white/60" />
        <span className="absolute left-1/2 top-1/2 h-5 w-px -translate-x-1/2 -translate-y-1/2 bg-brand-accent/70 dark:bg-white/60" />
        {/* Readout bar along the bottom — the drone hovers in the upper half. */}
        <div className="absolute bottom-[10%] left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-white/80 px-3 py-1 font-mono text-[10px] tabular-nums text-brand-ink/80 shadow-sm backdrop-blur-md dark:bg-black/50 dark:text-white/80">
          <span className="gd-dot h-1.5 w-1.5 rounded-full" data-state="rec" />
          <span className="font-medium text-brand-ink dark:text-white">
            REC <span ref={t.timecode}>00:00:00</span>
          </span>
          <span className="text-brand-ink/30 dark:text-white/25">|</span>
          <span ref={t.zoom} className="font-medium text-brand-ink dark:text-white">1.0×</span>
          <span className="text-brand-ink/30 dark:text-white/25">|</span>
          ISO 100 · 1/1000 s · f/2.8
        </div>
      </div>

      {/* Ground shadow */}
      <div
        ref={shadowRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 opacity-0"
        style={{ willChange: "transform, filter" }}
      >
        <DroneSilhouette />
      </div>

      {/* Drone */}
      <div ref={droneRef} aria-hidden className="pointer-events-none absolute left-0 top-0 opacity-0" style={{ willChange: "transform" }}>
        <div ref={bodyRef} className="h-full w-full" style={{ transformStyle: "preserve-3d", willChange: "transform" }}>
          <DroneSvg />
        </div>
      </div>

      {/* Live telemetry card */}
      <div
        ref={cardRef}
        aria-hidden
        className="gd-card pointer-events-none absolute left-0 top-0 w-[244px] opacity-0 transition-opacity duration-300"
        style={{ willChange: "transform" }}
      >
        <div className="rounded-xl border border-brand-accent/20 bg-white/95 p-2.5 shadow-xl shadow-brand-accent/10 backdrop-blur-md dark:border-white/10 dark:bg-[hsl(224_71%_6%)]/95 dark:shadow-black/40">
          <div className="flex items-center justify-between font-mono text-[9.5px] uppercase tracking-wider">
            <span className="flex items-center gap-1.5 font-semibold text-brand-ink/80 dark:text-white/80">
              <span ref={t.dot} className="gd-dot h-1.5 w-1.5 rounded-full" data-state="rec" />
              DRN-01
              <span className="text-brand-ink/35 dark:text-white/30">·</span>
              <span ref={t.stop} className="font-medium text-brand-ink/60 dark:text-white/55" />
            </span>
            <span ref={t.status} className="text-brand-ink/55 dark:text-white/50">
              Capturing
            </span>
          </div>
          <p ref={t.mission} className="mt-1.5 line-clamp-2 text-[12.5px] font-semibold leading-snug text-brand-ink dark:text-white" />
          <p ref={t.place} className="mt-0.5 truncate text-[11px] text-brand-ink/70 dark:text-white/65" />
          <p ref={t.coords} className="mt-0.5 truncate font-mono text-[10px] text-brand-ink/55 dark:text-brand-soft/65" />
          <div className="mt-2 grid grid-cols-3 gap-1.5 border-t border-brand-accent/10 pt-2 dark:border-white/10">
            <Stat label="AGL" valueRef={t.agl} />
            <Stat label="GSD" valueRef={t.gsd} />
            <Stat label="Batt" valueRef={t.battery} />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="relative h-1 flex-1 overflow-hidden rounded-full bg-brand-accent/10 dark:bg-white/10">
              <span ref={t.bar} className="gd-bar absolute inset-0 origin-left rounded-full" data-state="rec" style={{ transform: "scaleX(0)" }} />
            </span>
            <span className="font-mono text-[10px] tabular-nums text-brand-ink/70 dark:text-white/70">
              <span ref={t.frames}>0/0</span> img
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

function Stat({ label, valueRef }: { label: string; valueRef: Ref<HTMLSpanElement> }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[8.5px] uppercase tracking-wider text-brand-ink/45 dark:text-white/40">{label}</p>
      <span ref={valueRef} className="block truncate font-mono text-[10.5px] font-medium tabular-nums text-brand-ink dark:text-white/90" />
    </div>
  );
}

/** Motor positions (front pair slightly forward-swept, like folding-arm quads). */
const MOTORS: [number, number][] = [
  [-17.5, -14.5],
  [17.5, -14.5],
  [17.5, 15],
  [-17.5, 15],
];
/** Where each arm leaves the fuselage. */
const ARM_ROOTS: [number, number][] = [
  [-5.5, -6.5],
  [5.5, -6.5],
  [5.5, 7],
  [-5.5, 7],
];
const FUSELAGE =
  "M0 -16.5 C4.6 -16.5 7.4 -12.6 8.1 -6.8 L8.8 5.4 C9 11.6 5.8 15.6 0 16 C-5.8 15.6 -9 11.6 -8.8 5.4 L-8.1 -6.8 C-7.4 -12.6 -4.6 -16.5 0 -16.5 Z";

/** Tapered arm as a quad from (x1,y1) width w1 to (x2,y2) width w2. */
function armPath([x1, y1]: [number, number], [x2, y2]: [number, number], w1 = 4.4, w2 = 2.8) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const nx = -(y2 - y1) / len;
  const ny = (x2 - x1) / len;
  const p = (x: number, y: number, w: number, k: number) => `${(x + nx * w * k).toFixed(2)} ${(y + ny * w * k).toFixed(2)}`;
  return `M${p(x1, y1, w1, 0.5)} L${p(x2, y2, w2, 0.5)} L${p(x2, y2, w2, -0.5)} L${p(x1, y1, w1, -0.5)} Z`;
}

/**
 * Top-down enterprise survey quadcopter, nose up (DJI Mavic/Matrice style):
 * tapered fuselage with top-light shading, gimbal camera, front obstacle
 * sensors, GPS dome, cooling vents, tapered arms, motor bells, airfoil
 * blades over motion-blur discs (diagonal pairs counter-rotate), red
 * orientation lights and a blinking green status light.
 */
function DroneSvg() {
  return (
    <svg viewBox="-32 -32 64 64" className="gd-drone h-full w-full overflow-visible">
      <defs>
        <linearGradient id="gd-shell" x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#6b7480" />
          <stop offset="0.45" stopColor="#3a414b" />
          <stop offset="1" stopColor="#1b1f25" />
        </linearGradient>
        <linearGradient id="gd-panel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="gd-arm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4a525d" />
          <stop offset="1" stopColor="#23282f" />
        </linearGradient>
        <radialGradient id="gd-bell" cx="0.38" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#8a929d" />
          <stop offset="0.55" stopColor="#3b424c" />
          <stop offset="1" stopColor="#14181d" />
        </radialGradient>
        <radialGradient id="gd-lens" cx="0.4" cy="0.38" r="0.7">
          <stop offset="0" stopColor="#60a5fa" />
          <stop offset="0.45" stopColor="#1e3a8a" />
          <stop offset="1" stopColor="#020617" />
        </radialGradient>
        <radialGradient id="gd-disc">
          <stop offset="0.28" stopColor="currentColor" stopOpacity="0" />
          <stop offset="0.7" stopColor="currentColor" stopOpacity="0.13" />
          <stop offset="0.93" stopColor="currentColor" stopOpacity="0.2" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
        <filter id="gd-soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.35" />
        </filter>
      </defs>

      {/* Arms */}
      {MOTORS.map((m, i) => (
        <g key={`arm${i}`}>
          <path d={armPath(ARM_ROOTS[i], m)} fill="url(#gd-arm)" stroke="#12161b" strokeWidth="0.35" />
          <path d={armPath(ARM_ROOTS[i], m, 1.2, 0.7)} fill="#ffffff" opacity="0.1" />
        </g>
      ))}

      {/* Front arm orientation lights (under the front motors) */}
      <circle cx="-14.6" cy="-12" r="1" className="gd-led-front" />
      <circle cx="14.6" cy="-12" r="1" className="gd-led-front" />

      {/* Fuselage */}
      <path d={FUSELAGE} fill="url(#gd-shell)" stroke="#0e1115" strokeWidth="0.5" />
      <path d={FUSELAGE} fill="url(#gd-panel)" transform="scale(0.72) translate(0 -1.5)" />
      {/* panel seam */}
      <path d="M-6.2 -3.5 Q0 -5 6.2 -3.5" fill="none" stroke="#0e1115" strokeOpacity="0.55" strokeWidth="0.35" />
      {/* GPS dome */}
      <circle cx="0" cy="2.2" r="2.7" fill="#4b535e" stroke="#1a1e24" strokeWidth="0.35" />
      <circle cx="-0.8" cy="1.4" r="1" fill="#ffffff" opacity="0.22" />
      {/* cooling vents */}
      {[8.4, 10, 11.6].map((y) => (
        <line key={y} x1="-3.6" x2="3.6" y1={y} y2={y} stroke="#0e1115" strokeOpacity="0.7" strokeWidth="0.5" strokeLinecap="round" />
      ))}
      {/* front obstacle-avoidance sensors */}
      <ellipse cx="-3.4" cy="-12.2" rx="1.25" ry="0.8" fill="#05070a" />
      <ellipse cx="3.4" cy="-12.2" rx="1.25" ry="0.8" fill="#05070a" />
      <circle cx="-3.7" cy="-12.4" r="0.3" fill="#93c5fd" opacity="0.7" />
      <circle cx="3.1" cy="-12.4" r="0.3" fill="#93c5fd" opacity="0.7" />
      {/* gimbal + camera */}
      <rect x="-3.9" y="-21" width="7.8" height="6.2" rx="2.4" fill="#16191e" stroke="#4a525d" strokeWidth="0.4" />
      <circle cx="0" cy="-18.1" r="2.35" fill="url(#gd-lens)" stroke="#0b0d10" strokeWidth="0.4" />
      <circle cx="0" cy="-18.1" r="1.25" fill="none" stroke="#93c5fd" strokeOpacity="0.35" strokeWidth="0.25" />
      <circle cx="-0.75" cy="-18.85" r="0.45" fill="#ffffff" opacity="0.85" />
      {/* rear status light */}
      <circle cx="0" cy="14.2" r="0.9" className="gd-led-rear" />

      {/* Motors + props */}
      {MOTORS.map(([x, y], i) => (
        <g key={`m${i}`} transform={`translate(${x} ${y})`}>
          <circle r="12" fill="url(#gd-disc)" className="gd-disc" />
          <circle r="11.4" fill="none" className="gd-tip" strokeWidth="0.3" />
          <g className={i % 2 === 0 ? "gd-prop gd-cw" : "gd-prop gd-ccw"} filter="url(#gd-soft)">
            {/* two airfoil blades: wide root, slim swept tip */}
            <path d="M0 -0.9 C3.5 -1.9 7.5 -1.8 11.2 -0.6 C11.6 -0.2 11.4 0.4 10.9 0.5 C7.4 1 3.5 1.1 0 0.9 Z" className="gd-blade" />
            <path d="M0 0.9 C-3.5 1.9 -7.5 1.8 -11.2 0.6 C-11.6 0.2 -11.4 -0.4 -10.9 -0.5 C-7.4 -1 -3.5 -1.1 0 -0.9 Z" className="gd-blade" />
          </g>
          <circle r="3.4" fill="url(#gd-bell)" stroke="#0e1115" strokeWidth="0.4" />
          <circle r="2.1" fill="none" stroke="#9aa3ae" strokeOpacity="0.45" strokeWidth="0.3" />
          <circle r="0.85" fill="#c4cad2" />
        </g>
      ))}
    </svg>
  );
}

/** Flat silhouette used as the ground shadow (blurred by height). */
function DroneSilhouette() {
  return (
    <svg viewBox="-32 -32 64 64" className="h-full w-full overflow-visible" fill="#020617">
      {MOTORS.map((m, i) => (
        <g key={i}>
          <path d={armPath(ARM_ROOTS[i], m)} />
          <circle cx={m[0]} cy={m[1]} r="11" opacity="0.35" />
          <circle cx={m[0]} cy={m[1]} r="3.4" />
        </g>
      ))}
      <path d={FUSELAGE} />
      <rect x="-3.9" y="-21" width="7.8" height="6.2" rx="2.4" />
    </svg>
  );
}

const DRONE_CSS = `
.gd-disc { color: #0f172a; }
.dark .gd-disc { color: #e2e8f0; }
.gd-tip { stroke: rgba(15, 23, 42, 0.18); }
.dark .gd-tip { stroke: rgba(226, 232, 240, 0.22); }
.gd-blade { fill: rgba(15, 23, 42, 0.3); }
.dark .gd-blade { fill: rgba(226, 232, 240, 0.32); }
.gd-prop { transform-box: fill-box; transform-origin: center; }
.gd-cw { animation: gd-spin 0.26s linear infinite; }
.gd-ccw { animation: gd-spin 0.26s linear infinite reverse; }
.gd-drone { filter: drop-shadow(0 1px 1.5px rgba(0, 0, 0, 0.35)); }
@keyframes gd-spin { to { transform: rotate(360deg); } }
.gd-led-front { fill: #ef4444; filter: drop-shadow(0 0 1.5px #ef4444); }
.gd-led-rear { fill: #22c55e; animation: gd-blink 1.2s steps(1) infinite; filter: drop-shadow(0 0 1.5px #22c55e); }
@keyframes gd-blink { 0%, 60% { opacity: 1; } 61%, 100% { opacity: 0.15; } }
.gd-dot[data-state="rec"] { background: #ef4444; box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.18); animation: gd-blink 1s steps(1) infinite; }
.gd-dot[data-state="done"] { background: #10b981; box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.18); }
.gd-bar[data-state="rec"] { background: hsl(var(--primary)); }
.gd-bar[data-state="done"] { background: #10b981; transform: scaleX(1) !important; }
@media (prefers-reduced-motion: reduce) {
  .gd-cw, .gd-ccw, .gd-led-rear, .gd-dot { animation: none !important; }
}
`;
