import { Fill, Stroke, Style, Circle as CircleStyle, Text } from "ol/style";
import Feature from "ol/Feature";
import JSZip from "jszip";


// ─────────────────────────────────────────────────────────────────────────────
// Types & Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface GroundOverlayData {
  north: number;
  south: number;
  east: number;
  west: number;
  imageUrl: string;
  drawOrder: number;
}

export interface UnpackedKmzFile {
  kmlText: string;
  sourceUri: string;
  cleanup: () => void;
  allKmlTexts: Map<string, string>;
  assetBlobs: Map<string, Blob>;
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
    fill: new Fill({ color: "rgba(251, 191, 36, 0.1)" }),
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

export async function unpackKmzFile(file: File): Promise<UnpackedKmzFile> {
  const createdBlobUrls: string[] = [];
  const buffer = await file.arrayBuffer();
  const sourceUri = `https://local-kmz-host/${encodeURIComponent(file.name)}`;
  const zip = await JSZip.loadAsync(buffer);

  const assetMap = new Map<string, string>();
  const assetBlobs = new Map<string, Blob>();
  await Promise.all(
    Object.keys(zip.files)
      .filter((n) => !n.toLowerCase().endsWith(".kml") && !zip.files[n].dir)
      .map(async (name) => {
        const blob = await zip.files[name].async("blob");
        const url = URL.createObjectURL(blob);
        createdBlobUrls.push(url);
        assetMap.set(name, url);
        assetBlobs.set(url, blob);
        
        const base = name.split("/").pop() ?? "";
        if (base && !assetMap.has(base)) assetMap.set(base, url);
      }),
  );

  const allKmlTexts = new Map<string, string>();
  const kmlEntries = Object.keys(zip.files).filter((n) =>
    n.toLowerCase().endsWith(".kml"),
  );

  for (const kmlPath of kmlEntries) {
    const rawText = await zip.files[kmlPath].async("text");
    const kmlDir = kmlPath.includes("/")
      ? kmlPath.split("/").slice(0, -1).join("/")
      : "";

    const rewritten = rawText.replace(/<href>([^<]+)<\/href>/gi, (_, raw) => {
      const path = raw.trim();
      const withDir = kmlDir ? `${kmlDir}/${path}` : path;
      const resolved = assetMap.get(withDir) ?? assetMap.get(path) ?? assetMap.get(path.split("/").pop() ?? "") ?? null;
      if (resolved) return `<href>${resolved}</href>`;
      return `<href>${path}</href>`;
    });
    allKmlTexts.set(kmlPath, rewritten);
  }

  const rootKml = kmlEntries.find((n) => n.toLowerCase() === "doc.kml") ?? kmlEntries[0];
  if (!rootKml) throw new Error("No .kml found in KMZ.");

  return {
    kmlText: allKmlTexts.get(rootKml)!,
    sourceUri,
    cleanup: () => createdBlobUrls.forEach((u) => URL.revokeObjectURL(u)),
    allKmlTexts,
    assetBlobs,
  };
}

export function parseGroundOverlaysFromKml(kmlText: string): GroundOverlayData[] {
  const overlays: GroundOverlayData[] = [];
  const re = /<GroundOverlay[^>]*>([\s\S]*?)<\/GroundOverlay>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(kmlText)) !== null) {
    const xml = m[1];
    const north = parseFloat(xml.match(/<north>([\d.+\-eE]+)<\/north>/)?.[1] ?? "nan");
    const south = parseFloat(xml.match(/<south>([\d.+\-eE]+)<\/south>/)?.[1] ?? "nan");
    const east = parseFloat(xml.match(/<east>([\d.+\-eE]+)<\/east>/)?.[1] ?? "nan");
    const west = parseFloat(xml.match(/<west>([\d.+\-eE]+)<\/west>/)?.[1] ?? "nan");
    const drawOrder = parseInt(xml.match(/<drawOrder>(\d+)<\/drawOrder>/)?.[1] ?? "0", 10);
    const iconHref = xml.match(/<Icon[^>]*>[\s\S]*?<href>([^<]*)<\/href>[\s\S]*?<\/Icon>/i)?.[1]?.trim() ?? "";

    if (isNaN(north) || isNaN(south) || isNaN(east) || isNaN(west) || north <= south || east <= west || !iconHref) continue;

    overlays.push({ north, south, east, west, imageUrl: iconHref, drawOrder });
  }
  return overlays;
}

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
