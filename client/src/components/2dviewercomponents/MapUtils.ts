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
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

export const kmlStyle = new Style({
  fill: new Fill({ color: "rgba(59, 130, 246, 0.25)" }),
  stroke: new Stroke({ color: "rgba(59, 130, 246, 0.9)", width: 2 }),
  image: new CircleStyle({
    radius: 6,
    fill: new Fill({ color: "rgba(59, 130, 246, 0.9)" }),
    stroke: new Stroke({ color: "white", width: 1.5 }),
  }),
});

export const kmlSelectedStyle = new Style({
  fill: new Fill({ color: "rgba(99, 179, 237, 0.35)" }),
  stroke: new Stroke({ color: "#63b3ed", width: 3 }),
  image: new CircleStyle({
    radius: 8,
    fill: new Fill({ color: "#63b3ed" }),
    stroke: new Stroke({ color: "white", width: 2 }),
  }),
});

export const geojsonStyle = new Style({
  fill: new Fill({ color: "rgba(34, 197, 94, 0.2)" }),
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
        fill: new Fill({ color: "rgba(251, 191, 36, 0.95)" }),
        stroke: new Stroke({ color: "#fff", width: 2 }),
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
  fill: new Fill({ color: "rgba(251, 191, 36, 0.15)" }),
  stroke: new Stroke({ color: "#fbbf24", width: 2, lineDash: [6, 4] }),
  image: new CircleStyle({
    radius: 5,
    fill: new Fill({ color: "#fbbf24" }),
    stroke: new Stroke({ color: "white", width: 1.5 }),
  }),
});

export const blockStyle = new Style({
  image: new CircleStyle({
    radius: 8,
    fill: new Fill({ color: "#6366f1" }),
    stroke: new Stroke({ color: "#fff", width: 2 }),
  }),
  text: new Text({
    font: "bold 12px 'Inter', system-ui, sans-serif",
    fill: new Fill({ color: "#fff" }),
    stroke: new Stroke({ color: "rgba(0, 0, 0, 0.8)", width: 3 }),
    offsetY: 18,
  }),
});

export const annotationStyle = new Style({
  fill: new Fill({ color: "rgba(239, 68, 68, 0.2)" }),
  stroke: new Stroke({ color: "#ef4444", width: 2.5 }),
  image: new CircleStyle({
    radius: 6,
    fill: new Fill({ color: "#ef4444" }),
    stroke: new Stroke({ color: "#fff", width: 1.5 }),
  }),
});

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
