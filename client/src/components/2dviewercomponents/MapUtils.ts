import { Fill, Stroke, Style, Circle as CircleStyle, Text } from "ol/style";
import Feature from "ol/Feature";

// ─────────────────────────────────────────────────────────────────────────────
// Types & Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface GroundOverlayData {
  north: number;
  south: number;
  east: number;
  west: number;
  imageUrl: string;
  isTiled?: boolean;
  maxZoom?: number;
  drawOrder: number;
}

export interface School2DViewerProps {
  /** Raw school object from the API */
  school: any;
  /** Override buildings list */
  buildings?: any[];
  /** Override places overlay */
  placesOverlay?: any;
  onClose?: () => void;
  isEmbed?: boolean;
  onSelectBuilding?: (building: any) => void;
  initialBuildingId?: string;
  /** High-resolution Cloud Optimized GeoTIFF path */
  tifFilePath?: string;
  /**
   * When true the viewer acts as a building-picker:
   * clicking a building immediately calls onPickerSelect and closes.
   */
  pickerMode?: boolean;
  /** Called with the picked building when pickerMode is active */
  onPickerSelect?: (building: any) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

export const kmlStyle = (feature: any) => {
  const name = getFeatureName(feature);
  const type = feature.getGeometry()?.getType();

  return new Style({
    fill: new Fill({ color: "rgba(0, 0, 0, 0)" }),
    stroke: new Stroke({ color: "rgba(0, 0, 0, 0)", width: 0 }),
    image: new CircleStyle({
      radius: 6,
      fill: new Fill({ color: "rgba(251, 191, 36, 0.95)" }),
      stroke: new Stroke({ color: "white", width: 1.5 }),
    }),
    text: name ? new Text({
      text: name,
      font: "bold 11px 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
      fill: new Fill({ color: "#fff" }),
      stroke: new Stroke({ color: "rgba(15, 23, 42, 0.95)", width: 4 }),
      offsetY: type === "Point" ? 18 : 0,
      overflow: true,
      placement: type === "LineString" ? "line" : "point",
    }) : undefined,
  });
};

export const kmlSelectedStyle = new Style({
  fill: new Fill({ color: "rgba(0, 0, 0, 0)" }),
  stroke: new Stroke({ color: "rgba(255, 255, 255, 0.5)", width: 2 }),
  image: new CircleStyle({
    radius: 8,
    fill: new Fill({ color: "#3b82f6" }),
    stroke: new Stroke({ color: "white", width: 2 }),
  }),
});

export const geojsonStyle = new Style({
  fill: new Fill({ color: "rgba(0, 0, 0, 0)" }),
  stroke: new Stroke({ color: "rgba(34, 197, 94, 0.8)", width: 2 }),
  image: new CircleStyle({
    radius: 5,
    fill: new Fill({ color: "rgba(34, 197, 94, 0.8)" }),
    stroke: new Stroke({ color: "white", width: 1.5 }),
  }),
});

export function getFeatureName(feat: Feature): string | undefined {
  const keys = ["name", "Name", "NAME", "title"];
  for (const k of keys) {
    const val = feat.get(k);
    if (val) return String(val);
  }
  return feat.getId()?.toString();
}

export function getFeatureDescription(feat: Feature): string | undefined {
  const keys = ["description", "Description", "desc", "info"];
  for (const k of keys) {
    const val = feat.get(k);
    if (val) return String(val);
  }
  return undefined;
}

export const placesStyleFunction = (feature: any) => {
  const name = getFeatureName(feature);
  const type = feature.getGeometry()?.getType();

  if (type === "Point") {
    return new Style({
      image: new CircleStyle({
        radius: 8,
        fill: new Fill({ color: "rgba(0, 0, 0, 0)" }),
        stroke: new Stroke({ color: "rgba(251, 191, 36, 0.95)", width: 2 }),
      }),
      text: name
        ? new Text({
            text: name,
            font: "bold 13px 'Inter', system-ui, sans-serif",
            fill: new Fill({ color: "#fff" }),
            stroke: new Stroke({ color: "rgba(0, 0, 0, 0.8)", width: 3 }),
            offsetY: 20,
            overflow: true,
          })
        : undefined,
    });
  }

  return new Style({
    fill: new Fill({ color: "rgba(251, 191, 36, 0)" }),
    stroke: new Stroke({ color: "rgba(251, 191, 36, 0.95)", width: 2.5 }),
    text: name
      ? new Text({
          text: name,
          font: "bold 13px 'Inter', system-ui, sans-serif",
          fill: new Fill({ color: "#fff" }),
          stroke: new Stroke({ color: "rgba(0, 0, 0, 0.8)", width: 3 }),
          offsetY: 0,
          overflow: true,
          placement: type === "LineString" ? "line" : "point",
        })
      : undefined,
  });
};

export const measureStyle = new Style({
  fill: new Fill({ color: "rgba(0, 0, 0, 0)" }),
  stroke: new Stroke({ color: "#3b82f6", width: 3, lineDash: [8, 5] }),
  image: new CircleStyle({
    radius: 6,
    fill: new Fill({ color: "#3b82f6" }),
    stroke: new Stroke({ color: "white", width: 2 }),
  }),
});

export const blockStyle = (feature?: any) => {
  const isPolygon = feature?.getGeometry()?.getType() === "Polygon";
  const annData = feature?.get("annotationData");
  const buildingData = feature?.get("buildingData");
  const name = feature?.get("buildingName") || buildingData?.buildingName || buildingData?.buildingCode || "Unnamed Block";
  
  // Read area from multiple possible locations (priority order)
  const rawArea = annData?.areaSquareMeters
    ?? feature?.get("buildingArea")
    ?? buildingData?.buildingArea
    ?? buildingData?.areaSquareMeters
    ?? "";
  const area = rawArea ? Number(rawArea) : 0;
  const areaLabel = area > 0 ? `${area.toFixed(1)}m²` : "";
  const labelText = feature?.get("hideLabel") ? "" : (name && areaLabel ? `${name} · ${areaLabel}` : name || areaLabel);

  if (isPolygon) {
    return new Style({
      fill: new Fill({ color: "rgba(0, 0, 0, 0)" }),
      stroke: new Stroke({ color: "#3b82f6", width: 3.5 }),
      text: labelText ? new Text({
        text: labelText,
        font: "bold 12px 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
        fill: new Fill({ color: "#fff" }),
        stroke: new Stroke({ color: "rgba(15, 23, 42, 0.95)", width: 4 }),
        overflow: true,
        placement: "point",
      }) : undefined,
    });
  }

  return new Style({
    image: new CircleStyle({
      radius: 10,
      fill: new Fill({ color: "#3b82f6" }),
      stroke: new Stroke({ color: "#fff", width: 2.5 }),
    }),
    text: labelText ? new Text({
      text: labelText,
      font: "bold 12px 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
      fill: new Fill({ color: "#fff" }),
      stroke: new Stroke({ color: "rgba(15, 23, 42, 0.95)", width: 4 }),
      offsetY: 22,
      overflow: true,
    }) : undefined,
  });
};

export const annotationStyle = new Style({
  fill: new Fill({ color: "rgba(0, 0, 0, 0)" }),
  stroke: new Stroke({ color: "#10b981", width: 3 }),
  image: new CircleStyle({
    radius: 7,
    fill: new Fill({ color: "#10b981" }),
    stroke: new Stroke({ color: "#fff", width: 2 }),
  }),
});

/** Maps iconType → emoji for inline map label prefix. */
const ICON_EMOJI_MAP: Record<string, string> = {
  pin:          "📍",
  warning:      "⚠️",
  info:         "ℹ️",
  danger:       "🚨",
  construction: "🚧",
  flag:         "🚩",
  maintenance:  "🔧",
  poi:          "⭐",
  inspection:   "🔍",
  water:        "💧",
  power:        "⚡",
  green:        "🌳",
  facility:     "🏫",
  path:         "👣",
  parking:      "🅿️",
};

/** Style for site-level annotations (not tied to any building block). */
export function siteAnnotationStyle(feature: Feature): Style {
  const ann = feature.get("annotationData");
  const rawLabel: string = feature.get("siteLabel") || ann?.title || ann?.label || ann?.content || "";
  const isText = ann?.type === "text" || ann?.type === "point";
  const pinColor: string = ann?.style?.color || "#8b5cf6";

  // Prefix title with icon emoji if iconType is known
  const iconType: string = ann?.icon || ann?.iconType || ann?.style?.iconType || "";
  const emoji = ICON_EMOJI_MAP[iconType] || "";
  const label = rawLabel ? (emoji ? `${emoji} ${rawLabel}` : rawLabel) : "";

  if (isText) {
    return new Style({
      image: new CircleStyle({
        radius: 7,
        fill: new Fill({ color: pinColor }),
        stroke: new Stroke({ color: "#ffffff", width: 2 }),
      }),
      text: label ? new Text({
        text: label,
        font: "bold 13px 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
        fill: new Fill({ color: "#ffffff" }),
        stroke: new Stroke({ color: "rgba(10, 10, 20, 0.9)", width: 4 }),
        offsetY: -20,
        overflow: true,
        backgroundFill: new Fill({ color: `${pinColor}cc` }),
        padding: [3, 7, 3, 7],
      }) : undefined,
    });
  }

  // Lines and polygons
  return new Style({
    fill: new Fill({ color: `${pinColor}26` }),
    stroke: new Stroke({ color: pinColor, width: 2.5, lineDash: [6, 4] }),
    image: new CircleStyle({
      radius: 6,
      fill: new Fill({ color: pinColor }),
      stroke: new Stroke({ color: "#fff", width: 1.5 }),
    }),
    text: label ? new Text({
      text: label,
      font: "bold 11px 'Inter', system-ui, sans-serif",
      fill: new Fill({ color: "#ffffff" }),
      stroke: new Stroke({ color: "rgba(10, 10, 20, 0.85)", width: 3 }),
      offsetY: -14,
      overflow: true,
    }) : undefined,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

export function formatLength(meters: number): string {
  return meters > 1000
    ? `${(meters / 1000).toFixed(2)} km`
    : `${meters.toFixed(1)} m`;
}

export function formatArea(sqm: number): string {
  return sqm > 10_000
    ? `${(sqm / 1_000_000).toFixed(4)} km²`
    : `${sqm.toFixed(1)} m²`;
}
