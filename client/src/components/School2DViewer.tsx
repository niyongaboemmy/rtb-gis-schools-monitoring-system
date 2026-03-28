import { useEffect, useRef, useState, useCallback } from "react";
import "ol/ol.css";
import OLMap from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import XYZ from "ol/source/XYZ";
import KML from "ol/format/KML";
import GeoJSONFormat from "ol/format/GeoJSON";
import { PMTilesVectorSource } from "ol-pmtiles";
import VectorTileLayer from "ol/layer/VectorTile";
import Draw from "ol/interaction/Draw";
import { getLength, getArea } from "ol/sphere";
import { fromLonLat, toLonLat, transformExtent } from "ol/proj";
import { getIntersection, isEmpty as isExtentEmpty } from "ol/extent";
import DataTile from "ol/source/DataTile";
import GeoTIFFSource from "ol/source/GeoTIFF";
import WebGLTileLayer from "ol/layer/WebGLTile";
import { createXYZ } from "ol/tilegrid";
import ScaleLine from "ol/control/ScaleLine";
import { Fill, Stroke, Style, Circle as CircleStyle, Text } from "ol/style";
import { LineString, Polygon } from "ol/geom";
import Overlay from "ol/Overlay";
import Feature from "ol/Feature";
import JSZip from "jszip";
import rwandaBoundaries from "../assets/maps/rwanda-boundaries.json";
import {
  X,
  Globe,
  Ruler,
  Square,
  MapPin,
  Search,
  Eye,
  EyeOff,
  Layers,
  Trash2,
  ZoomIn,
  ZoomOut,
  Home,
  Satellite,
  Moon,
  Map as MapIcon2,
  Download,
  Info,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { FILE_SERVER_URL } from "../lib/api";
import { cn } from "../lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Props (identical to School3DViewProps for drop-in compatibility)
// ─────────────────────────────────────────────────────────────────────────────
interface School2DViewerProps {
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
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface GroundOverlayData {
  north: number;
  south: number;
  east: number;
  west: number;
  imageUrl: string;
  drawOrder: number;
}

interface UnpackedKmzFile {
  kmlText: string;
  kmlBlob: Blob;
  sourceUri: string;
  cleanup: () => void;
  allKmlTexts: Map<string, string>;
  assetMap: Map<string, string>;
}

async function unpackKmzFile(file: File): Promise<UnpackedKmzFile> {
  const createdBlobUrls: string[] = [];
  const buffer = await file.arrayBuffer();
  const sourceUri = `https://local-kmz-host/${encodeURIComponent(file.name)}`;
  const sig = new Uint8Array(buffer, 0, 2);
  const isZip = sig[0] === 0x50 && sig[1] === 0x4b;
  let kmlText = "";
  const allKmlTexts = new Map<string, string>();
  const assetMap = new Map<string, string>();

  if (isZip) {
    const zip = await new JSZip().loadAsync(buffer);

    // Extract all non-KML files as blob URLs
    await Promise.all(
      Object.keys(zip.files)
        .filter((n) => !n.toLowerCase().endsWith(".kml") && !zip.files[n].dir)
        .map(async (name) => {
          const blob = await zip.files[name].async("blob");
          const url = URL.createObjectURL(blob);
          createdBlobUrls.push(url);
          assetMap.set(name, url);
          // Also map by basename for relative resolution
          const base = name.split("/").pop() ?? "";
          if (base && !assetMap.has(base)) assetMap.set(base, url);
        }),
    );

    // Rewrite hrefs in every KML file found in the archive
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
        const resolved =
          assetMap.get(withDir) ??
          assetMap.get(path) ??
          assetMap.get(path.split("/").pop() ?? "") ??
          null;
        return resolved ? `<href>${resolved}</href>` : `<href>${path}</href>`;
      });
      allKmlTexts.set(kmlPath, rewritten);
    }

    const rootKml =
      kmlEntries.find((n) => n.toLowerCase() === "doc.kml") ?? kmlEntries[0];
    if (!rootKml) throw new Error("No .kml found.");
    kmlText = allKmlTexts.get(rootKml) ?? "";
  } else {
    kmlText = new TextDecoder("utf-8").decode(buffer);
    allKmlTexts.set("doc.kml", kmlText);
  }

  return {
    kmlText,
    kmlBlob: new Blob([kmlText], {
      type: "application/vnd.google-earth.kml+xml",
    }),
    sourceUri,
    cleanup: () => createdBlobUrls.forEach((u) => URL.revokeObjectURL(u)),
    allKmlTexts,
    assetMap,
  };
}

/** Parse every <GroundOverlay> block in a (rewritten) KML text. */
function parseGroundOverlaysFromKml(kmlText: string): GroundOverlayData[] {
  const overlays: GroundOverlayData[] = [];
  const re = /<GroundOverlay[^>]*>([\s\S]*?)<\/GroundOverlay>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(kmlText)) !== null) {
    const xml = m[1];
    const north = parseFloat(
      xml.match(/<north>([\d.+\-eE]+)<\/north>/)?.[1] ?? "nan",
    );
    const south = parseFloat(
      xml.match(/<south>([\d.+\-eE]+)<\/south>/)?.[1] ?? "nan",
    );
    const east = parseFloat(
      xml.match(/<east>([\d.+\-eE]+)<\/east>/)?.[1] ?? "nan",
    );
    const west = parseFloat(
      xml.match(/<west>([\d.+\-eE]+)<\/west>/)?.[1] ?? "nan",
    );
    const drawOrder = parseInt(
      xml.match(/<drawOrder>(\d+)<\/drawOrder>/)?.[1] ?? "0",
      10,
    );
    const iconHref =
      xml
        .match(/<Icon[^>]*>[\s\S]*?<href>([^<]*)<\/href>[\s\S]*?<\/Icon>/i)?.[1]
        ?.trim() ?? "";

    if (
      isNaN(north) ||
      isNaN(south) ||
      isNaN(east) ||
      isNaN(west) ||
      north <= south ||
      east <= west ||
      !iconHref
    )
      continue;

    overlays.push({ north, south, east, west, imageUrl: iconHref, drawOrder });
  }
  return overlays;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function getFeatureName(feat: Feature): string | undefined {
  const keys = ["name", "Name", "NAME", "title"];
  for (const k of keys) {
    const val = feat.get(k);
    if (val) return String(val);
  }
  return feat.getId()?.toString();
}

function getFeatureDescription(feat: Feature): string | undefined {
  const keys = ["description", "Description", "desc", "info"];
  for (const k of keys) {
    const val = feat.get(k);
    if (val) return String(val);
  }
  return undefined;
}

function formatLength(meters: number): string {
  return meters > 1000
    ? `${(meters / 1000).toFixed(2)} km`
    : `${meters.toFixed(1)} m`;
}

function formatArea(sqm: number): string {
  return sqm > 10_000
    ? `${(sqm / 1_000_000).toFixed(4)} km²`
    : `${sqm.toFixed(1)} m²`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const kmlStyle = new Style({
  fill: new Fill({ color: "rgba(59, 130, 246, 0.25)" }),
  stroke: new Stroke({ color: "rgba(59, 130, 246, 0.9)", width: 2 }),
  image: new CircleStyle({
    radius: 6,
    fill: new Fill({ color: "rgba(59, 130, 246, 0.9)" }),
    stroke: new Stroke({ color: "white", width: 1.5 }),
  }),
});

const kmlSelectedStyle = new Style({
  fill: new Fill({ color: "rgba(99, 179, 237, 0.35)" }),
  stroke: new Stroke({ color: "#63b3ed", width: 3 }),
  image: new CircleStyle({
    radius: 8,
    fill: new Fill({ color: "#63b3ed" }),
    stroke: new Stroke({ color: "white", width: 2 }),
  }),
});

const geojsonStyle = new Style({
  fill: new Fill({ color: "rgba(34, 197, 94, 0.2)" }),
  stroke: new Stroke({ color: "rgba(34, 197, 94, 0.8)", width: 2 }),
  image: new CircleStyle({
    radius: 5,
    fill: new Fill({ color: "rgba(34, 197, 94, 0.8)" }),
    stroke: new Stroke({ color: "white", width: 1.5 }),
  }),
});

const placesStyleFunction = (feature: any) => {
  const name = getFeatureName(feature);

  return new Style({
    // Make fill transparent to remove the orange background inside polygons
    fill: new Fill({ color: "transparent" }),
    // Keep a visible border for polygons/boundaries
    stroke: new Stroke({ color: "rgba(251, 191, 36, 0.95)", width: 2.5 }),
    image: new CircleStyle({
      radius: 6,
      fill: new Fill({ color: "rgba(251, 191, 36, 0.95)" }),
      stroke: new Stroke({ color: "#1a1a2e", width: 2 }),
    }),
    text: name
      ? new Text({
          text: name,
          font: "bold 13px 'Inter', system-ui, sans-serif",
          fill: new Fill({ color: "#fff" }),
          stroke: new Stroke({ color: "rgba(0, 0, 0, 0.8)", width: 3 }),
          offsetY: 14,
          overflow: true,
          placement:
            feature.getGeometry()?.getType() === "LineString"
              ? "line"
              : "point",
        })
      : undefined,
  });
};

const measureStyle = new Style({
  fill: new Fill({ color: "rgba(251, 191, 36, 0.15)" }),
  stroke: new Stroke({ color: "#fbbf24", width: 2, lineDash: [6, 4] }),
  image: new CircleStyle({
    radius: 5,
    fill: new Fill({ color: "#fbbf24" }),
    stroke: new Stroke({ color: "white", width: 1.5 }),
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export default function School2DViewer({
  school,
  buildings,
  placesOverlay,
  onClose,
  onSelectBuilding,
  initialBuildingId,
}: School2DViewerProps) {
  // ── Derive spatial URLs locally ───────────────────────────────────────────
  const buildUrl = (path: string | undefined, subfolder: string) => {
    if (!path) return undefined;
    if (path.startsWith("http")) return path;
    const cleanPath = path.replace(/^\/?files\//, ""); // Remove 'files/' or '/files/' prefix
    if (cleanPath.includes("/")) {
      // It's probably a full relative path like "schools/123/kmz/file.kmz"
      return `${FILE_SERVER_URL}/${cleanPath}`;
    }
    // Just a filename
    return `${FILE_SERVER_URL}/schools/${school.id}/${subfolder}/${cleanPath}`;
  };

  const kmz3dUrl = buildUrl(school.kmzFilePath, "kmz");
  const kmzUrl = buildUrl(school.kmz2dFilePath, "kmz_2d") ?? kmz3dUrl;
  const placesOverlayUrl = buildUrl(
    school.placesOverlayFilePath,
    "places-overlay",
  );
  const tifUrl = buildUrl(school.tifFilePath, "tif");

  const fallbackLocation = {
    lat: Number(school.latitude) || 0,
    lng: Number(school.longitude) || 0,
  };

  const effectiveBuildings = buildings ?? school.buildings ?? [];
  const effectivePlacesOverlay = placesOverlay ?? school.placesOverlayData;
  const geojson = school.geojsonContent;

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<OLMap | null>(null);
  const kmlLayerRef = useRef<VectorLayer | null>(null);
  const geojsonLayerRef = useRef<VectorLayer | null>(null);
  const placesLayerRef = useRef<VectorLayer | null>(null);
  const measureLayerRef = useRef<VectorLayer | null>(null);
  const measureSourceRef = useRef<VectorSource>(new VectorSource());
  const activeDrawRef = useRef<Draw | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipOverlayRef = useRef<Overlay | null>(null);
  const cleanupKmzRef = useRef<(() => void) | null>(null);
  const groundOverlayLayersRef = useRef<any[]>([]);
  const selectedFeatureRef = useRef<Feature | null>(null);
  const basemapLayerRef = useRef<TileLayer<XYZ> | null>(null);
  const basemapLabelLayerRef = useRef<TileLayer<XYZ> | null>(null);
  const overlayExtentRef = useRef<[number, number, number, number] | null>(
    null,
  );

  const [showBasicInfo, setShowBasicInfo] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Initialising map…");
  const [isTileLoading, setIsTileLoading] = useState(false);
  const [measurementMode, setMeasurementMode] = useState<
    "none" | "distance" | "area"
  >("none");
  const [measureResult, setMeasureResult] = useState<string | null>(null);
  const [showPlacesOverlay, setShowPlacesOverlay] = useState(true);
  const [showNavigator, setShowNavigator] = useState(false);
  const [features, setFeatures] = useState<
    Array<{ name: string; feature: Feature }>
  >([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentLat, setCurrentLat] = useState(fallbackLocation.lat);
  const [currentLng, setCurrentLng] = useState(fallbackLocation.lng);
  const [decodingCount, setDecodingCount] = useState(0);
  const [selectedFeatureName, setSelectedFeatureName] = useState<string | null>(
    null,
  );
  const [basemapStyle, setBasemapStyle] = useState<
    | "satellite"
    | "dark"
    | "street"
    | "offline"
    | "nsdi"
    | "ghost"
    | "google"
    | "google-hybrid"
  >("google");
  const [kmzOpacity, setKmzOpacity] = useState(1);
  const [showOpacitySlider, setShowOpacitySlider] = useState(false);
  const [infoFeature, setInfoFeature] = useState<{
    name: string;
    description?: string;
  } | null>(null);

  // Basemap URL resolver
  const getBasemapUrl = (style: string) => {
    const urls: Record<string, string> = {
      satellite:
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      dark: "https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      street: "https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      nsdi: "https://geodata.rw/geoserver/gwc/service/wmts?layer=rwanda:orto_2008&style=&tilematrixset=EPSG:900913&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/png&TileMatrix=EPSG:900913:{z}&TileCol={x}&TileRow={y}",
      offline: `${FILE_SERVER_URL}/maps/rwanda.pmtiles`,
      google: "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
      "google-hybrid": "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
    };
    return urls[style];
  };

  const ghostLayerRef = useRef<VectorLayer | null>(null);
  const offlineLayerRef = useRef<VectorTileLayer | null>(null);

  // Switch basemap
  const switchBasemap = useCallback(
    (
      style:
        | "satellite"
        | "dark"
        | "street"
        | "offline"
        | "nsdi"
        | "ghost"
        | "google"
        | "google-hybrid",
    ) => {
      setBasemapStyle(style);
      const layer = basemapLayerRef.current;

      // Handle standard raster layers
      if (layer) {
        if (
          style !== "ghost" &&
          style !== "offline"
        ) {
          layer.setVisible(true);
          const url = getBasemapUrl(style);
          if (url) {
            const source = layer.getSource() as XYZ;
            source.setUrl(url);
            
            // Fix Overzooming: Most tilesets (like Esri) stop at level 19. 
            // We tell OL to scale them if we go beyond that.
            if (style === "satellite" || style === "nsdi") {
              // @ts-ignore
              source.maxZoom = 19; 
            } else {
              // @ts-ignore
              source.maxZoom = 23; 
            }
            source.refresh();
          }
        } else {
          layer.setVisible(false);
        }
      }

      // Handle Ghost (GeoJSON) layer
      if (ghostLayerRef.current) {
        ghostLayerRef.current.setVisible(style === "ghost" || style === "offline");
      }

      // Handle PMTiles (Offline) layer
      if (offlineLayerRef.current) {
        offlineLayerRef.current.setVisible(style === "offline");
      }

      // Show/hide label overlay
      basemapLabelLayerRef.current?.setVisible(style === "satellite" || style === "nsdi");
    },
    [],
  );

  // Update KMZ ground overlay opacity
  useEffect(() => {
    groundOverlayLayersRef.current.forEach((l) => l.setOpacity(kmzOpacity));
  }, [kmzOpacity]);

  // Fit to KMZ overlay extent
  const fitToKmzExtent = useCallback(() => {
    if (overlayExtentRef.current && mapRef.current) {
      mapRef.current.getView().fit(overlayExtentRef.current, {
        padding: [60, 60, 60, 60],
        duration: 600,
      });
    }
  }, []);

  // Export map as PNG
  const exportMapPng = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.once("rendercomplete", () => {
      const canvas = document.createElement("canvas");
      const size = map.getSize()!;
      canvas.width = size[0];
      canvas.height = size[1];
      const ctx = canvas.getContext("2d")!;
      Array.from(
        document.querySelectorAll(
          ".ol-layer canvas",
        ) as NodeListOf<HTMLCanvasElement>,
      ).forEach((c) => {
        if (c.width > 0) {
          ctx.globalAlpha = parseFloat(c.style.opacity) || 1;
          ctx.drawImage(c, 0, 0);
        }
      });
      const link = document.createElement("a");
      link.href = canvas.toDataURL();
      link.download = `school-map-${Date.now()}.png`;
      link.click();
    });
    map.renderSync();
  }, []);

  // ── Map initialisation ──────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const basemapSrc = new XYZ({
      url: getBasemapUrl("google"),
      attributions: "© Google, Esri, DigitalGlobe",
      maxZoom: 19, // Use 19 as the 'tile' limit to enable overzooming up to 23
      crossOrigin: "anonymous",
    });
    const basemap = new TileLayer({ source: basemapSrc, zIndex: 0 });
    basemapLayerRef.current = basemap;

    // Satellite labels overlay (roads, place names)
    const labelSrc = new XYZ({
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      maxZoom: 23,
      crossOrigin: "anonymous",
    });
    const labelLayer = new TileLayer({
      source: labelSrc,
      zIndex: 1,
      opacity: 0.85,
    });
    basemapLabelLayerRef.current = labelLayer;

    const measureSource = measureSourceRef.current;
    const measureLayer = new VectorLayer({
      source: measureSource,
      style: measureStyle,
      zIndex: 50,
    });
    measureLayerRef.current = measureLayer;

    const map = new OLMap({
      target: containerRef.current,
      layers: [basemap, labelLayer, measureLayer],
      view: new View({
        center: fromLonLat([fallbackLocation.lng, fallbackLocation.lat]),
        zoom: 19,
        maxZoom: 25,
      }),
      controls: [],
    });

    // ── Optimized Basemaps (Ghost & Offline) ─────────────────────────────────
    // 1. Ghost Layer (Lightweight GeoJSON)
    const ghostSource = new VectorSource({
      features: new GeoJSONFormat().readFeatures(rwandaBoundaries, {
        featureProjection: "EPSG:3857",
      }),
    });
    const ghostLayer = new VectorLayer({
      source: ghostSource,
      style: new Style({
        fill: new Fill({ color: "rgba(30, 41, 59, 0.05)" }),
        stroke: new Stroke({ color: "rgba(148, 163, 184, 0.5)", width: 1 }),
      }),
      visible: false,
      zIndex: -1,
    });
    map.addLayer(ghostLayer);
    ghostLayerRef.current = ghostLayer;

    // 2. Offline Layer (PMTiles)
    const pmtilesUrl = `${FILE_SERVER_URL}/maps/rwanda.pmtiles`;
    const offlineSource = new PMTilesVectorSource({
      url: pmtilesUrl,
      attributions: ["© OpenStreetMap"],
    });
    const offlineLayer = new VectorTileLayer({
      source: offlineSource,
      visible: false,
      zIndex: -1,
      // Minimalist style for offline browsing
      style: new Style({
        stroke: new Stroke({ color: "#e2e8f0", width: 1 }),
        fill: new Fill({ color: "#f8fafc" }),
      }),
    });
    map.addLayer(offlineLayer);
    offlineLayerRef.current = offlineLayer;

    map.addControl(new ScaleLine({ units: "metric" }));

    // Pointer move → telemetry HUD
    map.on("pointermove", (evt: any) => {
      if (evt.dragging) return;
      const [lng, lat] = toLonLat(evt.coordinate);
      setCurrentLat(lat);
      setCurrentLng(lng);
    });

    // Click → feature selection
    map.on("click", (evt: any) => {
      if (activeDrawRef.current) return; // don't select while drawing
      let found = false;
      map.forEachFeatureAtPixel(
        evt.pixel,
        (f: any, layer: any) => {
          if (found) return;
          if (
            layer !== kmlLayerRef.current &&
            layer !== geojsonLayerRef.current &&
            layer !== placesLayerRef.current
          )
            return;
          const feat = f as Feature;
          const name = getFeatureName(feat);
          const description = getFeatureDescription(feat);

          // Reset previous selection
          if (
            selectedFeatureRef.current &&
            selectedFeatureRef.current !== feat
          ) {
            selectedFeatureRef.current.setStyle(undefined);
          }
          feat.setStyle(kmlSelectedStyle);
          selectedFeatureRef.current = feat;
          setSelectedFeatureName(name ?? null);
          setInfoFeature(name ? { name, description } : null);

          // Try matching a building
          if (name && onSelectBuilding) {
            const building = effectiveBuildings.find(
              (b: any) =>
                b.name?.toLowerCase() === name.toLowerCase() ||
                b.code?.toLowerCase() === name.toLowerCase(),
            );
            if (building) onSelectBuilding(building);
          }
          found = true;
        },
        { hitTolerance: 6 },
      );
      if (!found) {
        if (selectedFeatureRef.current) {
          selectedFeatureRef.current.setStyle(undefined);
          selectedFeatureRef.current = null;
        }
        setSelectedFeatureName(null);
        setInfoFeature(null);
      }
    });

    // Tooltip overlay for measurements
    if (tooltipRef.current) {
      const overlay = new Overlay({
        element: tooltipRef.current,
        offset: [0, -15],
        positioning: "bottom-center",
      });
      map.addOverlay(overlay);
      tooltipOverlayRef.current = overlay;
    }

    mapRef.current = map;

    return () => {
      cleanupKmzRef.current?.();
      groundOverlayLayersRef.current.forEach((l) => map.removeLayer(l));
      groundOverlayLayersRef.current = [];
      map.setTarget(undefined);
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load KML/KMZ ────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const loadGroundOverlays = (overlays: GroundOverlayData[]) => {
      groundOverlayLayersRef.current.forEach((l) => map.removeLayer(l));
      groundOverlayLayersRef.current = [];

      if (overlays.length === 0) return null;

      const sorted = [...overlays].sort((a, b) => a.drawOrder - b.drawOrder);

      // ── Bounding extent (sync — loadKml needs it immediately to fit the view) ──
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const ov of sorted) {
        const ext = transformExtent(
          [ov.west, ov.south, ov.east, ov.north],
          "EPSG:4326",
          "EPSG:3857",
        );
        if (ext[0] < minX) minX = ext[0];
        if (ext[1] < minY) minY = ext[1];
        if (ext[2] > maxX) maxX = ext[2];
        if (ext[3] > maxY) maxY = ext[3];
      }

      // ── Group by drawOrder so overlapping images paint in the correct order ──
      const groupedByLevel = new Map<number, GroundOverlayData[]>();
      for (const ov of sorted) {
        if (!groupedByLevel.has(ov.drawOrder))
          groupedByLevel.set(ov.drawOrder, []);
        groupedByLevel.get(ov.drawOrder)!.push(ov);
      }
      const levels = Array.from(groupedByLevel.keys()).sort((a, b) => a - b);

      // ImageBitmaps kept alive while layers are on the map
      const bitmaps: Map<string, ImageBitmap> = new Map();
      const thumbs: Map<string, ImageBitmap> = new Map();
      const pendingDecodes: Map<string, Promise<void>> = new Map();
      const tileGrid = createXYZ({ maxZoom: 25, tileSize: 256 });

      // ── Progressive async loader (fire-and-forget) ────────────────────────
      const loadLevels = async () => {
        setIsTileLoading(true);

        const fetchWithRetry = async (url: string, retries = 2): Promise<Blob> => {
          for (let i = 0; i <= retries; i++) {
            try {
              const res = await fetch(url);
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              return await res.blob();
            } catch (err) {
              if (i === retries) throw err;
              await new Promise(r => setTimeout(r, 1000 * (i + 1))); // Exponential backoff
            }
          }
          throw new Error("Failed after retries");
        };

        for (const level of levels) {
          if (!mapRef.current) return;
          const map = mapRef.current;
          const batch = groupedByLevel.get(level) ?? [];

          for (const ov of batch) {
            if (!mapRef.current) return;

            // Geographic extent of this overlay in EPSG:3857
            const ovExt = transformExtent(
              [ov.west, ov.south, ov.east, ov.north],
              "EPSG:4326",
              "EPSG:3857",
            ) as [number, number, number, number];

            // ─────────────────────────────────────────────────────────────────
            // CASE A: Cloud Optimized GeoTIFF (Highest Performance)
            // ─────────────────────────────────────────────────────────────────
            const isTif = ov.imageUrl.toLowerCase().endsWith(".tif") || ov.imageUrl.toLowerCase().endsWith(".tiff");
            
            if (isTif) {
              const source = new GeoTIFFSource({
                sources: [{ url: ov.imageUrl }],
                wrapX: false,
                interpolate: true,
              });

              const layer = new WebGLTileLayer({
                source,
                zIndex: 5 + level,
                opacity: kmzOpacity,
                extent: ovExt,
              });

              map.addLayer(layer);
              groundOverlayLayersRef.current.push(layer);
              continue; // Move to next overlay
            }

            // ─────────────────────────────────────────────────────────────────
            // CASE B: Standard Image (JPG/PNG) - Optimized with Lazy Decoding
            // ─────────────────────────────────────────────────────────────────
            const [extW, extS, extE, extN] = ovExt;
            const extWd = extE - extW;
            const extHt = extN - extS;

            const source = new DataTile({
              tileGrid,
              tileSize: 256,
              interpolate: true,
              wrapX: false,
              loader: async (z: number, x: number, y: number): Promise<ImageBitmap> => {
                const te = tileGrid.getTileCoordExtent([z, x, y]);
                const ix = getIntersection(te, ovExt);

                if (isExtentEmpty(ix)) {
                  const canvas = new OffscreenCanvas(256, 256);
                  return canvas.transferToImageBitmap();
                }

                const createTileFromBitmap = (bm: ImageBitmap, tbm?: ImageBitmap | null) => {
                  const [ixW, ixS, ixE, ixN] = ix;
                  const [tW, tS, tE, tN] = te;
                  const tileWd = tE - tW;
                  const tileHt = tN - tS;

                  const dstX = ((ixW - tW) / tileWd) * 256;
                  const dstY = ((tN - ixN) / tileHt) * 256;
                  const dstW = ((ixE - ixW) / tileWd) * 256;
                  const dstH = ((ixN - ixS) / tileHt) * 256;

                  const fullSrcW = ((ixE - ixW) / extWd) * bm.width;
                  let chosenBm = bm;
                  
                  // Use thumbnail if downsampling aggressively
                  if (tbm && fullSrcW > dstW * 4) {
                    chosenBm = tbm;
                  }

                  const srcX = ((ixW - extW) / extWd) * chosenBm.width;
                  const srcY = ((extN - ixN) / extHt) * chosenBm.height;
                  const srcW = ((ixE - ixW) / extWd) * chosenBm.width;
                  const srcH = ((ixN - ixS) / extHt) * chosenBm.height;

                  const canvas = new OffscreenCanvas(256, 256);
                  const ctx = canvas.getContext("2d")!;
                  ctx.imageSmoothingEnabled = true;
                  ctx.imageSmoothingQuality = "high";
                  ctx.drawImage(chosenBm, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH);
                  return canvas.transferToImageBitmap();
                };

                // 1. Check if bitmap is already decoded
                let existing = bitmaps.get(ov.imageUrl);
                if (existing) {
                  return createTileFromBitmap(existing, thumbs.get(ov.imageUrl));
                }

                // 2. Not decoded? Check for a pending decode promise
                let pending = pendingDecodes.get(ov.imageUrl);
                if (!pending) {
                  // 3. Start a new decode task
                  pending = (async () => {
                    try {
                      setDecodingCount((prev) => prev + 1);
                      const blob = await fetchWithRetry(ov.imageUrl);
                      const bm = await createImageBitmap(blob);
                      bitmaps.set(ov.imageUrl, bm);
                      
                      // Create thumbnail for overview levels
                      if (bm.width > 2048 || bm.height > 2048) {
                        const scale = 1024 / Math.max(bm.width, bm.height);
                        const tbm = await createImageBitmap(bm, {
                          resizeWidth: Math.round(bm.width * scale),
                          resizeHeight: Math.round(bm.height * scale),
                          resizeQuality: "high"
                        });
                        thumbs.set(ov.imageUrl, tbm);
                      }
                    } catch (err) {
                      console.error(`[Pool] Failed to decode ${ov.imageUrl}:`, err);
                      // Clear pending so we can try again later if needed
                      pendingDecodes.delete(ov.imageUrl);
                      throw err;
                    } finally {
                      setDecodingCount((prev) => Math.max(0, prev - 1));
                    }
                  })();
                  pendingDecodes.set(ov.imageUrl, pending);
                }

                // 4. Wait for the pending decode to complete (either first attempt or subsequent)
                try {
                  await pending;
                  existing = bitmaps.get(ov.imageUrl);
                  if (existing) {
                    return createTileFromBitmap(existing, thumbs.get(ov.imageUrl));
                  }
                } catch (err) {
                  // Fallback to empty if both attempts failed
                }

                const canvas = new OffscreenCanvas(256, 256);
                return canvas.transferToImageBitmap();
              },
            });

            const tileLayer = new TileLayer({
              source,
              zIndex: 5 + level,
              opacity: kmzOpacity,
              extent: ovExt,
            });

            map.addLayer(tileLayer);
            groundOverlayLayersRef.current.push(tileLayer);
          }

          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        }
        mapRef.current?.once("rendercomplete", () => setIsTileLoading(false));
      };

      void loadLevels();

      const prevCleanup = cleanupKmzRef.current;
      cleanupKmzRef.current = () => {
        prevCleanup?.();
        bitmaps.forEach((b) => b.close());
        thumbs.forEach((t) => t.close());
        bitmaps.clear();
        thumbs.clear();
      };

      return minX !== Infinity
        ? ([minX, minY, maxX, maxY] as [number, number, number, number])
        : null;
    };

    const loadKml = async (
      kmlText: string,
      groundOverlays?: GroundOverlayData[],
    ) => {
      const kmlFormat = new KML({ extractStyles: false });
      let parsed: Feature[];
      try {
        parsed = kmlFormat.readFeatures(kmlText, {
          featureProjection: "EPSG:3857",
          dataProjection: "EPSG:4326",
        }) as Feature[];
      } catch {
        parsed = [];
      }

      const source = new VectorSource({ features: parsed });
      const layer = new VectorLayer({ source, style: kmlStyle, zIndex: 30 });
      if (kmlLayerRef.current) map.removeLayer(kmlLayerRef.current);
      map.addLayer(layer);
      kmlLayerRef.current = layer;

      // Ground overlay tiles take priority for extent fitting
      const overlayExtent =
        groundOverlays && groundOverlays.length > 0
          ? loadGroundOverlays(groundOverlays)
          : null;

      const fitExtent =
        overlayExtent ??
        (() => {
          const e = source.getExtent();
          return e && e[0] !== Infinity
            ? (e as [number, number, number, number])
            : null;
        })();

      if (fitExtent) {
        overlayExtentRef.current = fitExtent;
        map.getView().fit(fitExtent, {
          padding: [60, 60, 60, 60],
          duration: 600,
        });
      }

      // Collect named features for the navigator
      const named = parsed
        .map((f) => ({ name: getFeatureName(f), feature: f }))
        .filter(
          (item): item is { name: string; feature: Feature } => !!item.name,
        );
      setFeatures((prev) => {
        const current = new Map(prev.map((p) => [p.name, p]));
        named.forEach((n) => current.set(n.name, n));
        return Array.from(current.values());
      });
      setIsLoading(false);
    };

    const run = async () => {
      // Prioritize direct GeoTIFF if available
      if (tifUrl) {
        setLoadingMessage("Initialising high-res GeoTIFF…");
        loadGroundOverlays([{
          north: 90, south: -90, east: 180, west: -180, // Extent will be derived from metadata usually
          imageUrl: tifUrl,
          drawOrder: 0
        }]);
      }

      if (kmzUrl) {
        setLoadingMessage("Fetching spatial data…");
        try {
          const res = await fetch(kmzUrl);
          const contentType = res.headers.get("content-type") ?? "";
          const isZip =
            kmzUrl.toLowerCase().endsWith(".kmz") ||
            contentType.includes("zip") ||
            contentType.includes("kmz");

          if (isZip) {
            const blob = await res.blob();
            const file = new File([blob], "data.kmz", { type: blob.type });
            cleanupKmzRef.current?.();
            const unpacked = await unpackKmzFile(file);
            cleanupKmzRef.current = unpacked.cleanup;

            // Collect GroundOverlay tiles from ALL KML files in the archive
            const allOverlays: GroundOverlayData[] = [];
            for (const kmlText of unpacked.allKmlTexts.values()) {
              allOverlays.push(...parseGroundOverlaysFromKml(kmlText));
            }

            await loadKml(
              unpacked.kmlText,
              allOverlays.length > 0 ? allOverlays : undefined,
            );
          } else {
            const text = await res.text();
            await loadKml(text);
          }
        } catch (err) {
          console.error("[School2DViewer] KML fetch failed", err);
          setIsLoading(false);
        }
        return;
      }

      // No spatial file — just centre on fallback
      setIsLoading(false);
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kmzUrl, tifUrl]);

  // ── Load GeoJSON ─────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geojson) return;

    try {
      const gjFormat = new GeoJSONFormat();
      const parsed = gjFormat.readFeatures(geojson, {
        featureProjection: "EPSG:3857",
        dataProjection: "EPSG:4326",
      }) as Feature[];

      const source = new VectorSource({ features: parsed });
      const layer = new VectorLayer({ source, style: geojsonStyle, zIndex: 8 });

      if (geojsonLayerRef.current) map.removeLayer(geojsonLayerRef.current);
      map.addLayer(layer);
      geojsonLayerRef.current = layer;
    } catch (err) {
      console.error("[School2DViewer] GeoJSON load failed", err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geojson]);

  // ── Load Places Overlay ──────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const loadPlaces = async (kmlText: string) => {
      const kmlFormat = new KML({ extractStyles: false });
      let parsed: Feature[];
      try {
        parsed = kmlFormat.readFeatures(kmlText, {
          featureProjection: "EPSG:3857",
          dataProjection: "EPSG:4326",
        }) as Feature[];
      } catch {
        parsed = [];
      }
      const source = new VectorSource({ features: parsed });
      const layer = new VectorLayer({
        source,
        style: placesStyleFunction,
        zIndex: 40,
        visible: showPlacesOverlay,
      });
      if (placesLayerRef.current) map.removeLayer(placesLayerRef.current);
      map.addLayer(layer);
      placesLayerRef.current = layer;

      const named = parsed
        .map((f) => ({ name: getFeatureName(f), feature: f }))
        .filter(
          (item): item is { name: string; feature: Feature } => !!item.name,
        );
      setFeatures((prev) => {
        const current = new Map(prev.map((p) => [p.name, p]));
        named.forEach((n) => current.set(n.name, n));
        return Array.from(current.values());
      });
    };

    if (
      effectivePlacesOverlay?.features ||
      effectivePlacesOverlay?.type === "FeatureCollection"
    ) {
      // GeoJSON format
      try {
        const gjFormat = new GeoJSONFormat();
        const parsed = gjFormat.readFeatures(effectivePlacesOverlay, {
          featureProjection: "EPSG:3857",
          dataProjection: "EPSG:4326",
        }) as Feature[];
        const source = new VectorSource({ features: parsed });
        const layer = new VectorLayer({
          source,
          style: placesStyleFunction,
          zIndex: 40,
          visible: showPlacesOverlay,
        });
        if (placesLayerRef.current) map.removeLayer(placesLayerRef.current);
        map.addLayer(layer);
        placesLayerRef.current = layer;

        const named = parsed
          .map((f) => ({ name: getFeatureName(f), feature: f }))
          .filter(
            (item): item is { name: string; feature: Feature } => !!item.name,
          );
        setFeatures((prev) => {
          const current = new Map(prev.map((p) => [p.name, p]));
          named.forEach((n) => current.set(n.name, n));
          return Array.from(current.values());
        });
      } catch (err) {
        console.error("[School2DViewer] Places overlay GeoJSON failed", err);
      }
      return;
    }

    if (placesOverlayUrl) {
      fetch(placesOverlayUrl)
        .then((r) => r.text())
        .then(loadPlaces)
        .catch((err) =>
          console.error("[School2DViewer] Places overlay fetch failed", err),
        );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectivePlacesOverlay, placesOverlayUrl]);

  // ── Toggle places visibility ─────────────────────────────────────────────
  useEffect(() => {
    placesLayerRef.current?.setVisible(showPlacesOverlay);
  }, [showPlacesOverlay]);

  // ── Measurement interaction ──────────────────────────────────────────────
  const stopDraw = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (activeDrawRef.current) {
      map.removeInteraction(activeDrawRef.current);
      activeDrawRef.current = null;
    }
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    stopDraw();
    if (measurementMode === "none") {
      setMeasureResult(null);
      tooltipOverlayRef.current?.setPosition(undefined);
      return;
    }

    const type = measurementMode === "distance" ? "LineString" : "Polygon";
    const draw = new Draw({
      source: measureSourceRef.current,
      type,
      style: measureStyle,
    });

    draw.on("drawstart", () => {
      measureSourceRef.current.clear();
      setMeasureResult(null);
      tooltipOverlayRef.current?.setPosition(undefined);
    });

    draw.on("drawend", (evt) => {
      const geom = evt.feature.getGeometry();
      if (!geom) return;

      let result = "";
      let tooltipPos: number[] | undefined;

      if (geom instanceof LineString) {
        const cloned = geom
          .clone()
          .transform("EPSG:3857", "EPSG:4326") as LineString;
        result = formatLength(getLength(cloned));
        tooltipPos = geom.getLastCoordinate();
      } else if (geom instanceof Polygon) {
        const cloned = geom
          .clone()
          .transform("EPSG:3857", "EPSG:4326") as Polygon;
        result = formatArea(getArea(cloned));
        tooltipPos = geom.getInteriorPoint().getCoordinates();
      }

      setMeasureResult(result);
      if (tooltipPos) tooltipOverlayRef.current?.setPosition(tooltipPos);
    });

    map.addInteraction(draw);
    activeDrawRef.current = draw;

    return () => stopDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measurementMode]);

  // ── Navigator fly-to ─────────────────────────────────────────────────────
  const flyToFeature = useCallback((feature: Feature) => {
    const map = mapRef.current;
    if (!map) return;
    const geom = feature.getGeometry();
    if (!geom) return;
    const extent = geom.getExtent();
    map.getView().fit(extent, {
      padding: [80, 80, 80, 80],
      duration: 600,
      maxZoom: 20,
    });
    // Select it
    if (selectedFeatureRef.current && selectedFeatureRef.current !== feature) {
      selectedFeatureRef.current.setStyle(undefined);
    }
    feature.setStyle(kmlSelectedStyle);
    selectedFeatureRef.current = feature;

    const name = getFeatureName(feature);
    const description = getFeatureDescription(feature);
    setSelectedFeatureName(name ?? null);
    setInfoFeature(name ? { name, description } : null);
  }, []);

  // ── Initial Focus ────────────────────────────────────────────────────────
  useEffect(() => {
    if (
      !initialBuildingId ||
      isLoading ||
      !mapRef.current ||
      features.length === 0
    )
      return;

    const target = features.find((f) => {
      const bId = f.feature.get("id");
      const name = f.feature.get("name")?.toString().toLowerCase();
      // Try matching by ID or by name (since some KMLs use names as IDs)
      return (
        bId === initialBuildingId ||
        name?.includes(initialBuildingId.toLowerCase())
      );
    });

    if (target) {
      flyToFeature(target.feature);
    }
  }, [initialBuildingId, isLoading, features, flyToFeature]);

  // ── Clear measurements ────────────────────────────────────────────────────
  const clearMeasurements = useCallback(() => {
    measureSourceRef.current.clear();
    setMeasureResult(null);
    tooltipOverlayRef.current?.setPosition(undefined);
  }, []);

  const filteredFeatures = features.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#0f1117] w-full h-full">
      {/* ── Map container ─────────────────────────────────────────────────── */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* ── Floating Title & Info Button ──────────────────────────────────── */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 pr-2 pl-6 py-2 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 shadow-2xl flex items-center gap-4">
        <h1 className="text-xl font-bold text-white tracking-wide truncate max-w-[250px] md:max-w-md">
          {school.name}
        </h1>
        <Button
          variant="secondary"
          size="sm"
          className="rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/5 font-semibold"
          onClick={() => setShowBasicInfo(true)}
        >
          <Info className="h-4 w-4 mr-1.5" />
          Info
        </Button>
      </div>

      {/* ── Tooltip overlay (OL uses DOM element) ────────────────────────── */}
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute rounded-lg bg-black/80 px-2 py-1 text-xs font-bold text-amber-300 border border-amber-400/30 whitespace-nowrap"
        style={{ display: measureResult ? "block" : "none" }}
      >
        {measureResult}
      </div>

      {/* ── Background tile-loading indicator ───────────────────────────────── */}
      {isTileLoading && !isLoading && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full bg-black/70 backdrop-blur-sm px-3 py-1.5 border border-white/10 pointer-events-none">
          <div className="flex items-center gap-0.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-1 w-1 rounded-full bg-blue-400 animate-bounce"
                style={{ animationDelay: `${i * 0.12}s` }}
              />
            ))}
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
            Loading imagery…
          </span>
        </div>
      )}

      {/* ── Loading overlay ───────────────────────────────────────────────── */}
      {(isLoading || isTileLoading || decodingCount > 0) && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-[#0f1117]/90 backdrop-blur-sm">
          <div className="flex items-center justify-center h-16 w-16 rounded-full bg-blue-500/10 border border-blue-500/20">
            <Globe className="h-8 w-8 text-blue-400 animate-pulse" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-xs font-black uppercase tracking-widest text-white/80">
              {decodingCount > 0 ? "Optimizing Quality..." : loadingMessage}
            </p>
            {decodingCount > 0 && (
              <p className="text-[10px] text-blue-300/60 animate-pulse">
                Rendering {decodingCount} high-res native textures...
              </p>
            )}
            <div className="flex items-center gap-1 justify-center pt-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-1 w-1 rounded-full bg-blue-400 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Top-right toolbar ────────────────────────────────────────────── */}
      <div className="absolute right-4 top-4 z-30 flex flex-col gap-2">
        <Card className="bg-background/60 backdrop-blur-xl rounded-2xl border border-border/10 p-2 flex flex-col gap-1 shadow-xl">
          {/* Close */}
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl hover:bg-destructive/10 hover:text-destructive"
              onClick={onClose}
              title="Close viewer"
            >
              <X className="h-4 w-4" />
            </Button>
          )}



          {/* Feature navigator */}
          <Button
            variant={showNavigator ? "default" : "ghost"}
            size="icon"
            className="h-9 w-9 rounded-xl"
            onClick={() => setShowNavigator((v) => !v)}
            title="Feature navigator"
          >
            <Layers className="h-4 w-4" />
          </Button>

          {/* Places overlay toggle */}
          <Button
            variant={showPlacesOverlay ? "default" : "ghost"}
            size="icon"
            className={cn(
              "h-9 w-9 rounded-xl",
              showPlacesOverlay &&
                "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30",
            )}
            onClick={() => setShowPlacesOverlay((v) => !v)}
            title={
              showPlacesOverlay ? "Hide places overlay" : "Show places overlay"
            }
          >
            {showPlacesOverlay ? (
              <Eye className="h-4 w-4" />
            ) : (
              <EyeOff className="h-4 w-4" />
            )}
          </Button>

          {/* KMZ opacity */}
          <Button
            variant={showOpacitySlider ? "default" : "ghost"}
            size="icon"
            className="h-9 w-9 rounded-xl"
            onClick={() => setShowOpacitySlider((v) => !v)}
            title="KMZ layer opacity"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>

          <div className="h-px bg-border/20 mx-1" />

          {/* Basemap: Google Satellite (NEW Default) */}
          <Button
            variant={basemapStyle === "google" ? "default" : "ghost"}
            size="icon"
            className="h-9 w-9 rounded-xl border border-white/10"
            onClick={() => switchBasemap("google")}
            title="Google Satellite (High Compatibility)"
          >
            <Globe className="h-4 w-4 text-sky-400" />
          </Button>

          {/* Basemap: satellite (Esri) */}
          <Button
            variant={basemapStyle === "satellite" ? "default" : "ghost"}
            size="icon"
            className="h-9 w-9 rounded-xl"
            onClick={() => switchBasemap("satellite")}
            title="Esri World Imagery"
          >
            <Satellite className="h-4 w-4" />
          </Button>

          {/* Basemap: dark */}
          <Button
            variant={basemapStyle === "dark" ? "default" : "ghost"}
            size="icon"
            className="h-9 w-9 rounded-xl"
            onClick={() => switchBasemap("dark")}
            title="Dark basemap"
          >
            <Moon className="h-4 w-4" />
          </Button>

          {/* Basemap: street */}
          <Button
            variant={basemapStyle === "street" ? "default" : "ghost"}
            size="icon"
            className="h-9 w-9 rounded-xl"
            onClick={() => switchBasemap("street")}
            title="Street map"
          >
            <MapIcon2 className="h-4 w-4" />
          </Button>

          {/* Basemap: NSDI */}
          <Button
            variant={basemapStyle === "nsdi" ? "default" : "ghost"}
            size="icon"
            className="h-9 w-9 rounded-xl"
            onClick={() => switchBasemap("nsdi")}
            title="Official Rwanda NSDI map (Faster locally)"
          >
            <Globe className="h-4 w-4" />
          </Button>

          {/* Basemap: Offline */}
          <Button
            variant={basemapStyle === "offline" ? "default" : "ghost"}
            size="icon"
            className="h-9 w-9 rounded-xl"
            onClick={() => switchBasemap("offline")}
            title="Offline cached map (PMTiles)"
          >
            <Download className="h-4 w-4" />
          </Button>

          {/* Basemap: Ghost */}
          <Button
            variant={basemapStyle === "ghost" ? "default" : "ghost"}
            size="icon"
            className="h-9 w-9 rounded-xl"
            onClick={() => switchBasemap("ghost")}
            title="Low bandwidth mode (Vector only)"
          >
            <Layers className="h-4 w-4" />
          </Button>

          <div className="h-px bg-border/20 mx-1" />

          {/* Distance measurement */}
          <Button
            variant={measurementMode === "distance" ? "default" : "ghost"}
            size="icon"
            className={cn(
              "h-9 w-9 rounded-xl",
              measurementMode === "distance" &&
                "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30",
            )}
            onClick={() =>
              setMeasurementMode((m) =>
                m === "distance" ? "none" : "distance",
              )
            }
            title="Measure distance"
          >
            <Ruler className="h-4 w-4" />
          </Button>

          {/* Area measurement */}
          <Button
            variant={measurementMode === "area" ? "default" : "ghost"}
            size="icon"
            className={cn(
              "h-9 w-9 rounded-xl",
              measurementMode === "area" &&
                "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30",
            )}
            onClick={() =>
              setMeasurementMode((m) => (m === "area" ? "none" : "area"))
            }
            title="Measure area"
          >
            <Square className="h-4 w-4" />
          </Button>

          {/* Clear measurements */}
          {measurementMode !== "none" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                setMeasurementMode("none");
                clearMeasurements();
              }}
              title="Clear measurements"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}

          <div className="h-px bg-border/20 mx-1" />

          {/* Zoom in */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl"
            onClick={() =>
              mapRef.current
                ?.getView()
                .animate({
                  zoom: (mapRef.current.getView().getZoom() ?? 19) + 1,
                  duration: 200,
                })
            }
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>

          {/* Zoom out */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl"
            onClick={() =>
              mapRef.current
                ?.getView()
                .animate({
                  zoom: (mapRef.current.getView().getZoom() ?? 19) - 1,
                  duration: 200,
                })
            }
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>

          {/* Fit to KMZ extent */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl"
            onClick={fitToKmzExtent}
            title="Fit to school area"
          >
            <Home className="h-4 w-4" />
          </Button>

          {/* Export PNG */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl"
            onClick={exportMapPng}
            title="Export map as PNG"
          >
            <Download className="h-4 w-4" />
          </Button>
        </Card>
      </div>

      {/* ── Opacity slider panel ───────────────────────────────────────────── */}
      {showOpacitySlider && (
        <div className="absolute right-16 top-[72px] z-30 w-44">
          <Card className="bg-background/70 backdrop-blur-xl rounded-2xl border border-border/10 shadow-xl p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">
              KMZ Opacity
            </p>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={kmzOpacity}
              onChange={(e) => setKmzOpacity(parseFloat(e.target.value))}
              className="w-full accent-blue-500"
            />
            <p className="text-center text-xs font-bold mt-1 text-blue-300">
              {Math.round(kmzOpacity * 100)}%
            </p>
          </Card>
        </div>
      )}

      {/* ── Feature navigator panel ───────────────────────────────────────── */}
      {showNavigator && (
        <div className="absolute left-4 top-4 z-30 w-72">
          <Card className="bg-background/70 backdrop-blur-xl rounded-2xl border border-border/10 shadow-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-blue-400" />
                <span className="text-xs font-black uppercase tracking-widest">
                  Features ({features.length})
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full"
                onClick={() => setShowNavigator(false)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>

            {/* Search */}
            <div className="px-3 pb-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3 w-3 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search features…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl bg-muted/40 border border-border/20 pl-7 pr-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto max-h-[380px] px-2 pb-3 space-y-0.5">
              {filteredFeatures.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-6">
                  No features found
                </p>
              ) : (
                filteredFeatures.map(({ name, feature }) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => flyToFeature(feature)}
                    className={cn(
                      "w-full text-left rounded-xl px-3 py-2 text-xs transition-colors",
                      selectedFeatureName === name
                        ? "bg-primary/15 text-primary font-bold"
                        : "hover:bg-muted/40 text-foreground/80",
                    )}
                  >
                    {name}
                  </button>
                ))
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ── Feature info popup ────────────────────────────────────────────── */}
      {infoFeature && (
        <div className="absolute bottom-16 left-1/2 z-30 -translate-x-1/2 max-w-sm w-full px-4">
          <div className="rounded-2xl bg-black/80 backdrop-blur-xl border border-white/10 px-4 py-3 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                <div className="flex-1 overflow-auto max-h-[40vh] custom-scrollbar">
                  <p className="text-xs font-bold text-white">
                    {infoFeature.name}
                  </p>
                  {infoFeature.description && (
                    <div
                      className="text-[10px] text-white/80 mt-1 space-y-2 [&_table]:w-full [&_td]:py-1 [&_td:first-child]:font-semibold [&_td:first-child]:text-white/60"
                      dangerouslySetInnerHTML={{
                        __html: infoFeature.description,
                      }}
                    />
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  if (selectedFeatureRef.current) {
                    selectedFeatureRef.current.setStyle(undefined);
                    selectedFeatureRef.current = null;
                  }
                  setSelectedFeatureName(null);
                  setInfoFeature(null);
                }}
                className="text-muted-foreground hover:text-white transition-colors shrink-0 bg-white/5 rounded-full p-1 border border-white/10"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Measurement mode banner ───────────────────────────────────────── */}
      {measurementMode !== "none" && (
        <div className="absolute top-4 left-1/2 z-30 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-2xl bg-amber-500/15 backdrop-blur-xl border border-amber-400/30 px-4 py-2 shadow-xl">
            {measurementMode === "distance" ? (
              <Ruler className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            ) : (
              <Square className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            )}
            <span className="text-xs font-bold text-amber-300">
              {measurementMode === "distance"
                ? "Click to draw line — double-click to finish"
                : "Click to draw polygon — double-click to finish"}
            </span>
            {measureResult && (
              <>
                <span className="mx-1 text-amber-400/50">·</span>
                <span className="text-xs font-black text-amber-200">
                  {measureResult}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Bottom HUD ───────────────────────────────────────────────────── */}
      <div className="absolute bottom-4 right-4 z-20">
        <div className="rounded-xl bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 text-[10px] font-mono text-white/60 space-x-3">
          <span>
            {currentLat >= 0 ? "N" : "S"} {Math.abs(currentLat).toFixed(6)}°
          </span>
          <span>
            {currentLng >= 0 ? "E" : "W"} {Math.abs(currentLng).toFixed(6)}°
          </span>
        </div>
      </div>

      {/* ── 2D badge ──────────────────────────────────────────────────────── */}
      <div className="absolute bottom-4 left-4 z-20">
        <div className="flex items-center gap-1.5 rounded-xl bg-blue-500/15 border border-blue-400/20 px-3 py-1.5">
          <Globe className="h-3 w-3 text-blue-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-300">
            2D · OpenLayers
          </span>
        </div>
      </div>

      {/* ── Basic Info Modal ────────────────────────────────────────────── */}
      {showBasicInfo && (
        <div className="absolute inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-8 text-white overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

            <div className="flex items-start justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold tracking-tight mb-1">{school.name}</h2>
                <div className="flex items-center gap-2 text-sm text-white/50 font-medium tracking-wide">
                  <MapPin className="h-3.5 w-3.5" />
                  {[school.province, school.district, school.sector].filter(Boolean).join(" • ") || "Location Unknown"}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full bg-white/5 hover:bg-white/20 text-white/70 hover:text-white shrink-0"
                onClick={() => setShowBasicInfo(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-y-6 gap-x-8">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1.5">School Code</p>
                <p className="text-lg font-mono font-medium">{school.code || "N/A"}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1.5">Level</p>
                <p className="text-lg font-medium">{school.level || "N/A"}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1.5">Type</p>
                <p className="text-lg font-medium capitalize">{school.type?.toLowerCase() || "N/A"}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1.5">Status</p>
                <div className="flex items-center gap-2">
                  <div className={cn("h-2 w-2 rounded-full", school.status === "ACTIVE" ? "bg-emerald-400" : "bg-amber-400")} />
                  <p className="text-lg font-medium capitalize">{school.status?.toLowerCase() || "Active"}</p>
                </div>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1.5">Coordinates</p>
                <p className="text-sm font-mono text-white/70">{Number(school.latitude).toFixed(6)}, {Number(school.longitude).toFixed(6)}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
