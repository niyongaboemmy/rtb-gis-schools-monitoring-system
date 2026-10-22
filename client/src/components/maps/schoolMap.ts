import { useEffect, useState } from "react";
import L from "leaflet";
import { bandOf } from "../../lib/scoring";
import { useTheme } from "../ThemeProvider";

/* ─────────────────────────────  status system  ───────────────────────────── */

export interface MapSchool {
  id: string;
  name: string;
  code?: string;
  district?: string;
  province?: string;
  priorityLevel?: string;
  latitude?: number | string;
  longitude?: number | string;
}

export const PRIORITY_META: Record<
  string,
  { label: string; color: string; ring: string; beacon: boolean }
> = {
  critical: { label: "Critical", color: "#ef4444", ring: "rgba(239,68,68,.5)", beacon: true },
  high: { label: "High", color: "#f59e0b", ring: "rgba(245,158,11,.5)", beacon: true },
  medium: { label: "Medium", color: "#3b82f6", ring: "rgba(59,130,246,.45)", beacon: false },
  low: { label: "Low", color: "#10b981", ring: "rgba(16,185,129,.45)", beacon: false },
};

export const priorityMeta = (p?: string) =>
  PRIORITY_META[(p ?? "").toLowerCase()] ?? {
    label: "Unclassified",
    color: "#64748b",
    ring: "rgba(100,116,139,.4)",
    beacon: false,
  };

/** NASA-style beacon pin — pulses for critical/high, static for the rest. */
export function schoolPulseIcon(priority?: string, size = 18, selected = false) {
  const m = priorityMeta(priority);
  const s = selected ? Math.round(size * 1.5) : size;
  return L.divIcon({
    className: selected ? "scm-pin scm-pin--selected" : "scm-pin",
    html: `<span class="scm-pin__wrap" style="--scm-c:${m.color}">
      ${m.beacon || selected ? '<span class="scm-pin__pulse"></span>' : ""}
      <span class="scm-pin__core"></span>
    </span>`,
    iconSize: [s, s],
    iconAnchor: [s / 2, s / 2],
    tooltipAnchor: [0, -s / 2 - 2],
  });
}

/* ─────────────────────────────  theme + tiles  ───────────────────────────── */

/** Resolves the app theme ("system" → the OS preference) and stays reactive. */
export function useEffectiveTheme(): "light" | "dark" {
  const { theme } = useTheme();
  const [system, setSystem] = useState<"light" | "dark">(() =>
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light",
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) =>
      setSystem(e.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return theme === "system" ? system : theme;
}

/**
 * Esri "Canvas" grey basemaps — free, no API key / no token, light + dark pair.
 * (CARTO's basemaps now watermark tiles without a key.)
 */
export const BASEMAP_ATTRIBUTION =
  'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors';

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";

export const basemapUrls = (theme: "light" | "dark") =>
  theme === "dark"
    ? {
        base: `${ESRI}/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
        reference: `${ESRI}/Reference/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`,
      }
    : {
        base: `${ESRI}/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
        reference: `${ESRI}/Reference/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`,
      };

/** Free Esri World Imagery (satellite) + a places overlay tuned for imagery. */
export const IMAGERY_URL = `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`;
export const IMAGERY_LABELS_URL = `${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`;
export const IMAGERY_ATTRIBUTION =
  "Imagery &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community";

/** Haversine-friendly distance formatter. */
export const formatDistance = (metres: number) =>
  metres < 1000
    ? `${Math.round(metres)} m`
    : `${(metres / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} km`;

/* ─────────────────────────────  score bands  ───────────────────────────── */

export type PriorityKey = "critical" | "high" | "medium" | "low";

/** Intervention Priority band for a 0–100 score — the shared client model (lib/scoring). */
export const scoreBand = (score: number): PriorityKey => bandOf(score);

/* ─────────────────────────────  basemap catalogue  ───────────────────────────── */

export type BasemapId = "auto" | "light" | "dark" | "satellite" | "streets" | "topo";

export interface BasemapDef {
  id: BasemapId;
  label: string;
  /** Tile URL ({z}/{y}/{x}); `auto` resolves against the theme at render time. */
  base: (theme: "light" | "dark") => string;
  /** Optional labels / reference overlay. */
  reference?: (theme: "light" | "dark") => string | null;
  attribution: string;
  maxZoom: number;
  /** Canvas basemaps get the subtle tone filter used across the app. */
  tone?: (theme: "light" | "dark") => "light" | "dark" | null;
}

/** Free Esri basemaps — no API key or token required. */
export const BASEMAPS: BasemapDef[] = [
  {
    id: "auto",
    label: "Match theme",
    base: (t) => basemapUrls(t).base,
    reference: (t) => basemapUrls(t).reference,
    attribution: BASEMAP_ATTRIBUTION,
    maxZoom: 16,
    tone: (t) => t,
  },
  {
    id: "light",
    label: "Light",
    base: () => basemapUrls("light").base,
    reference: () => basemapUrls("light").reference,
    attribution: BASEMAP_ATTRIBUTION,
    maxZoom: 16,
    tone: () => "light",
  },
  {
    id: "dark",
    label: "Dark",
    base: () => basemapUrls("dark").base,
    reference: () => basemapUrls("dark").reference,
    attribution: BASEMAP_ATTRIBUTION,
    maxZoom: 16,
    tone: () => "dark",
  },
  {
    id: "satellite",
    label: "Satellite",
    base: () => IMAGERY_URL,
    reference: () => IMAGERY_LABELS_URL,
    attribution: IMAGERY_ATTRIBUTION,
    maxZoom: 19,
  },
  {
    id: "streets",
    label: "Streets",
    base: () => `${ESRI}/World_Street_Map/MapServer/tile/{z}/{y}/{x}`,
    attribution: BASEMAP_ATTRIBUTION,
    maxZoom: 19,
  },
  {
    id: "topo",
    label: "Terrain",
    base: () => `${ESRI}/World_Topo_Map/MapServer/tile/{z}/{y}/{x}`,
    attribution: BASEMAP_ATTRIBUTION,
    maxZoom: 19,
  },
];

export const basemapById = (id: string | null | undefined): BasemapDef =>
  BASEMAPS.find((b) => b.id === id) ?? BASEMAPS[0];

/** A single z7 tile over Rwanda, for basemap preview thumbnails. */
export const basemapPreviewUrl = (def: BasemapDef, theme: "light" | "dark") =>
  def.base(theme).replace("{z}", "7").replace("{y}", "64").replace("{x}", "74");
