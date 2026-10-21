import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { normProvince } from "../geo";
import type { MapRegion } from "../region";
import type { ProvinceSummary } from "../types";
import { formatNumber, formatScore } from "../../../lib/format";

type Theme = "light" | "dark";

/** Outer ring of the focus mask: a box well beyond the map's maxBounds
 *  (small enough to draw unclipped without huge pixel coordinates). */
const WORLD_RING: L.LatLngTuple[] = [
  [-22, 10],
  [-22, 50],
  [18, 50],
  [18, 10],
];

/** Keeps the latest callback in a ref so Leaflet handlers never go stale. */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

/** Dims the neighbours and traces Rwanda's real (1:10m) border. */
export function RwandaFocus({
  region,
  theme,
  imagery,
  dim,
}: {
  region: MapRegion;
  theme: Theme;
  imagery: boolean;
  dim: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    const group = L.layerGroup();
    if (dim) {
      L.polygon([WORLD_RING, region.rwandaRing], {
        pane: "nm-mask",
        stroke: false,
        fillColor: theme === "dark" ? "#010309" : "#e2e8f0",
        fillOpacity: imagery ? 0.45 : theme === "dark" ? 0.72 : 0.5,
        fillRule: "evenodd",
        interactive: false,
        noClip: true,
      }).addTo(group);
    }
    L.polygon(region.rwandaRing, {
      fill: false,
      color: imagery ? "#ffffff" : theme === "dark" ? "#60a5fa" : "#2563eb",
      weight: 1.8,
      opacity: 0.95,
      interactive: false,
      className: "nm-rwanda-edge",
    }).addTo(group);
    group.addTo(map);
    return () => {
      group.remove();
    };
  }, [map, region, theme, imagery, dim]);
  return null;
}

export function LakeLayer({ region, theme }: { region: MapRegion; theme: Theme }) {
  const map = useMap();
  useEffect(() => {
    if (!region.lake) return;
    const layer = L.geoJSON(region.lake, {
      pane: "nm-mask",
      interactive: false,
      style: {
        color: theme === "dark" ? "#38bdf8" : "#0284c7",
        weight: 1,
        opacity: 0.7,
        fillColor: theme === "dark" ? "#0ea5e9" : "#38bdf8",
        fillOpacity: theme === "dark" ? 0.12 : 0.16,
      },
    }).addTo(map);
    return () => {
      layer.remove();
    };
  }, [map, region, theme]);
  return null;
}

interface ProvinceLayerProps {
  region: MapRegion;
  theme: Theme;
  imagery: boolean;
  /** Province currently filtered / summarised (by any name variant). */
  active: string;
  summaries: ProvinceSummary[];
  /** Off while a measuring tool is active, so clicks reach the map. */
  interactive: boolean;
  showBorders: boolean;
  /** Province previewed from the panel chips or search (lit like a hover). */
  preview: string | null;
  onClick: (name: string) => void;
}

/**
 * Provinces from geoBoundaries ADM1: invisible hit areas that light up on
 * hover (with a glass tooltip: name, schools, average score), internal
 * borders as hairlines, and the selected province outlined while the rest
 * are softly dimmed.
 */
export function ProvinceLayer({
  region,
  theme,
  imagery,
  active,
  summaries,
  interactive,
  showBorders,
  preview,
  onClick,
}: ProvinceLayerProps) {
  const map = useMap();
  const onClickRef = useLatest(onClick);
  const layersRef = useRef(new Map<string, L.GeoJSON>());
  const hoverRef = useRef<string | null>(null);
  const styleRef = useRef<(name: string) => L.PathOptions>(() => ({}));

  // Style function reads the latest props through a ref.
  useEffect(() => {
    const activeKey = normProvince(active);
    const previewKey = normProvince(preview ?? "");
    const line = imagery ? "#ffffff" : theme === "dark" ? "#93c5fd" : "#1d4ed8";
    styleRef.current = (name: string) => {
      const isActive = !!activeKey && normProvince(name) === activeKey;
      const isHover = hoverRef.current === name || (!!previewKey && normProvince(name) === previewKey);
      const dimOthers = !!activeKey && !isActive;
      return {
        stroke: isActive || isHover,
        color: line,
        weight: isActive ? 2.2 : 1.6,
        opacity: 0.95,
        fill: true,
        fillColor: dimOthers ? (theme === "dark" ? "#000000" : "#94a3b8") : line,
        fillOpacity: isHover ? 0.12 : isActive ? 0.06 : dimOthers ? (theme === "dark" ? 0.32 : 0.2) : 0,
        className: "nm-province",
      };
    };
    layersRef.current.forEach((layer, name) => {
      layer.setStyle(styleRef.current(name));
      // Class toggles restart the CSS flash each time a province becomes active.
      const on = !!activeKey && normProvince(name) === activeKey;
      layer.eachLayer((l) => (l as L.Path).getElement?.()?.classList.toggle("nm-province--active", on));
    });
  }, [active, theme, imagery, preview]);

  // Create / tear down the province hit areas.
  useEffect(() => {
    const layers = layersRef.current;
    const group = L.layerGroup();
    for (const p of region.provinces) {
      const layer = L.geoJSON(p.feature, {
        interactive,
        style: () => styleRef.current(p.name),
      });
      if (interactive) {
        layer.on("mouseover", () => {
          hoverRef.current = p.name;
          layer.setStyle(styleRef.current(p.name));
        });
        layer.on("mouseout", () => {
          if (hoverRef.current === p.name) hoverRef.current = null;
          layer.setStyle(styleRef.current(p.name));
        });
        layer.on("click", (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e);
          onClickRef.current(p.name);
        });
      }
      layers.set(p.name, layer);
      layer.addTo(group);
    }
    group.addTo(map);
    return () => {
      group.remove();
      layers.clear();
      hoverRef.current = null;
    };
  }, [map, region, interactive, onClickRef]);

  // Tooltips carry the live summaries.
  useEffect(() => {
    if (!interactive) return;
    layersRef.current.forEach((layer, name) => {
      const s = summaries.find((x) => normProvince(x.province) === normProvince(name));
      const html = `<span style="display:flex;flex-direction:column;gap:2px">
        <span style="font-size:12px;font-weight:600">${name}</span>
        <span style="font-size:11px;opacity:.7">${
          s
            ? `${formatNumber(s.total)} ${s.total === 1 ? "school" : "schools"} · average score ${formatScore(s.avgScore)}`
            : "No schools on the map"
        }</span>
        <span style="font-size:11px;opacity:.55">Click to open the province</span></span>`;
      layer.unbindTooltip();
      layer.bindTooltip(html, { sticky: true, direction: "top", className: "scm-tip", offset: [0, -8] });
    });
  }, [summaries, interactive, region]);

  // Internal province borders as hairlines.
  useEffect(() => {
    if (!showBorders || !region.provinceBorders) return;
    const layer = L.geoJSON(region.provinceBorders, {
      interactive: false,
      style: {
        color: imagery ? "#ffffff" : theme === "dark" ? "#cbd5e1" : "#334155",
        weight: 1.2,
        opacity: imagery ? 0.85 : theme === "dark" ? 0.45 : 0.5,
        lineJoin: "round",
      },
    }).addTo(map);
    return () => {
      layer.remove();
    };
  }, [map, region, theme, imagery, showBorders]);

  return null;
}

/** "Northern Province" → "Northern", "Kigali City" → "Kigali" (map labels only). */
const shortName = (name: string) => name.replace(/\s*(Province|City)\s*/g, " ").trim();

/** Province names (and school counts) at each province centre. */
export function ProvinceLabels({
  region,
  summaries,
  active,
  zoom,
}: {
  region: MapRegion;
  summaries: ProvinceSummary[];
  active: string;
  zoom: number;
}) {
  const map = useMap();
  const visible = zoom <= 11;
  useEffect(() => {
    if (!visible) return;
    const activeKey = normProvince(active);
    const group = L.layerGroup();
    for (const p of region.provinces) {
      const s = summaries.find((x) => normProvince(x.province) === normProvince(p.name));
      const isActive = !!activeKey && normProvince(p.name) === activeKey;
      L.marker(p.label, {
        pane: "nm-labels",
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: `nm-prov-label${isActive ? " nm-prov-label--active" : ""}`,
          iconSize: [0, 0],
          html: `<span>${shortName(p.name)}${s ? `<small>${formatNumber(s.total)} ${s.total === 1 ? "school" : "schools"}</small>` : ""}</span>`,
        }),
      }).addTo(group);
    }
    group.addTo(map);
    return () => {
      group.remove();
    };
  }, [map, region, summaries, active, visible]);
  return null;
}

interface DistrictLayerProps {
  region: MapRegion;
  theme: Theme;
  imagery: boolean;
  zoom: number;
  /** Schools per district name (for the tooltip). */
  counts: Record<string, number>;
  /** Selected district (outlined). */
  active: string;
  /** Off while a measuring tool is active, so clicks reach the map. */
  interactive: boolean;
  onClick: (name: string) => void;
}

/**
 * Districts — the finest level, from the same topology as the provinces and
 * the country, so their edges coincide exactly. Fine dashed hairlines from
 * zoom 8.5; once zoomed in (≥ 9.5) each district is a hover / click target
 * that takes over from the province hit areas.
 */
export function DistrictLayer({ region, theme, imagery, zoom, counts, active, interactive, onClick }: DistrictLayerProps) {
  const map = useMap();
  const onClickRef = useLatest(onClick);
  const showLines = zoom >= 8.5;
  const hit = interactive && zoom >= 9.5;

  useEffect(() => {
    if (!showLines || !region.districtBorders) return;
    const layer = L.geoJSON(region.districtBorders, {
      interactive: false,
      style: {
        color: imagery ? "#ffffff" : theme === "dark" ? "#94a3b8" : "#475569",
        weight: 0.8,
        opacity: imagery ? 0.6 : theme === "dark" ? 0.32 : 0.4,
        dashArray: "2 4",
        lineCap: "round",
      },
    }).addTo(map);
    return () => {
      layer.remove();
    };
  }, [map, region, theme, imagery, showLines]);

  useEffect(() => {
    if (!hit) return;
    const line = imagery ? "#ffffff" : theme === "dark" ? "#93c5fd" : "#1d4ed8";
    const style = (name: string, hover: boolean): L.PathOptions => {
      const on = !!active && active === name;
      return {
        stroke: hover || on,
        color: line,
        weight: on ? 2 : 1.4,
        opacity: 0.9,
        fill: true,
        fillColor: line,
        fillOpacity: hover ? 0.1 : on ? 0.05 : 0,
        className: "nm-district",
      };
    };
    const group = L.layerGroup();
    for (const d of region.districts) {
      const layer = L.geoJSON(d.feature, { style: () => style(d.name, false) });
      const n = counts[d.name] ?? 0;
      layer.bindTooltip(
        `<span style="display:flex;flex-direction:column;gap:2px">
          <span style="font-size:12px;font-weight:600">${d.name}</span>
          <span style="font-size:11px;opacity:.7">${shortName(d.province)} · ${n ? `${formatNumber(n)} ${n === 1 ? "school" : "schools"}` : "no schools on the map"}</span>
          <span style="font-size:11px;opacity:.55">Click to filter this district</span></span>`,
        { sticky: true, direction: "top", className: "scm-tip", offset: [0, -8] },
      );
      layer.on("mouseover", () => layer.setStyle(style(d.name, true)));
      layer.on("mouseout", () => layer.setStyle(style(d.name, false)));
      layer.on("click", (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        onClickRef.current(d.name);
      });
      layer.addTo(group);
    }
    group.addTo(map);
    return () => {
      group.remove();
    };
  }, [map, region, theme, imagery, hit, counts, active, onClickRef]);

  return null;
}
