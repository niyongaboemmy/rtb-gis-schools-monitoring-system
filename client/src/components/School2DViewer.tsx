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
import Draw from "ol/interaction/Draw";
import { getLength, getArea } from "ol/sphere";
import { fromLonLat, toLonLat } from "ol/proj";
import ScaleLine from "ol/control/ScaleLine";
import { Fill, Stroke, Style, Circle as CircleStyle } from "ol/style";
import { LineString, Polygon } from "ol/geom";
import Overlay from "ol/Overlay";
import Feature from "ol/Feature";
import JSZip from "jszip";
import {
  X,
  Maximize2,
  Minimize2,
  Globe,
  Ruler,
  Square,
  MapPin,
  Search,
  Eye,
  EyeOff,
  Layers,
  Trash2,
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
}

// ─────────────────────────────────────────────────────────────────────────────
// unpackKmzFile — copied verbatim from School3DView.tsx
// ─────────────────────────────────────────────────────────────────────────────
interface UnpackedKmzFile {
  kmlText: string;
  kmlBlob: Blob;
  sourceUri: string;
  cleanup: () => void;
}

async function unpackKmzFile(file: File): Promise<UnpackedKmzFile> {
  const createdBlobUrls: string[] = [];
  const buffer = await file.arrayBuffer();
  const sourceUri = `https://local-kmz-host/${encodeURIComponent(file.name)}`;
  const sig = new Uint8Array(buffer, 0, 2);
  const isZip = sig[0] === 0x50 && sig[1] === 0x4b;
  let kmlText: string;

  if (isZip) {
    const zip = await new JSZip().loadAsync(buffer);
    const assetMap = new Map<string, string>();
    await Promise.all(
      Object.keys(zip.files)
        .filter((n) => !n.toLowerCase().endsWith(".kml") && !zip.files[n].dir)
        .map(async (name) => {
          const blob = await zip.files[name].async("blob");
          const url = URL.createObjectURL(blob);
          createdBlobUrls.push(url);
          assetMap.set(name, url);
        }),
    );
    const kmlEntries = Object.keys(zip.files).filter((n) =>
      n.toLowerCase().endsWith(".kml"),
    );
    const rootKml =
      kmlEntries.find((n) => n.toLowerCase() === "doc.kml") ?? kmlEntries[0];
    if (!rootKml) throw new Error("No .kml found.");
    kmlText = await zip.files[rootKml].async("text");
    kmlText = kmlText.replace(/<href>([^<]+)<\/href>/gi, (_, raw) => {
      const path = raw.trim();
      const resolved =
        assetMap.get(path) ?? assetMap.get(path.split("/").pop() ?? "");
      return resolved ? `<href>${resolved}</href>` : `<href>${path}</href>`;
    });
  } else {
    kmlText = new TextDecoder("utf-8").decode(buffer);
  }

  return {
    kmlText,
    kmlBlob: new Blob([kmlText], {
      type: "application/vnd.google-earth.kml+xml",
    }),
    sourceUri,
    cleanup: () => createdBlobUrls.forEach((u) => URL.revokeObjectURL(u)),
  };
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

const placesStyle = new Style({
  fill: new Fill({ color: "rgba(239, 68, 68, 0.18)" }),
  stroke: new Stroke({ color: "rgba(239, 68, 68, 0.85)", width: 2 }),
  image: new CircleStyle({
    radius: 5,
    fill: new Fill({ color: "rgba(239, 68, 68, 0.85)" }),
    stroke: new Stroke({ color: "white", width: 1.5 }),
  }),
});

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
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
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
// Component
// ─────────────────────────────────────────────────────────────────────────────
export default function School2DViewer({
  school,
  buildings,
  placesOverlay,
  onClose,
  isEmbed = false,
  onSelectBuilding,
  initialBuildingId,
}: School2DViewerProps) {
  // ── Derive spatial URLs locally ───────────────────────────────────────────
  // 3D KMZ - baseline fallback
  const kmz3dUrl = school.kmzFilePath
    ? school.kmzFilePath.startsWith("/")
      ? school.kmzFilePath
      : `${FILE_SERVER_URL}/schools/${school.id}/kmz/${school.kmzFilePath}`
    : undefined;

  // 2D KMZ/KML - preferred for OpenLayers; fallback to 3D KMZ if not uploaded
  const kmzUrl = school.kmz2dFilePath
    ? school.kmz2dFilePath.startsWith("/")
      ? school.kmz2dFilePath
      : `${FILE_SERVER_URL}/schools/${school.id}/kmz_2d/${school.kmz2dFilePath}`
    : kmz3dUrl;

  const placesOverlayUrl = school.placesOverlayFilePath
    ? school.placesOverlayFilePath.startsWith("/")
      ? school.placesOverlayFilePath
      : `${FILE_SERVER_URL}/schools/${school.id}/places-overlay/${school.placesOverlayFilePath}`
    : undefined;

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
  const selectedFeatureRef = useRef<Feature | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Initialising map…");
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
  const [selectedFeatureName, setSelectedFeatureName] = useState<string | null>(
    null,
  );

  // ── Map initialisation ──────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const basemap = new TileLayer({
      source: new XYZ({
        url: "https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        attributions: "© OpenStreetMap contributors, © CARTO",
        maxZoom: 20,
      }),
    });

    const measureSource = measureSourceRef.current;
    const measureLayer = new VectorLayer({
      source: measureSource,
      style: measureStyle,
      zIndex: 50,
    });
    measureLayerRef.current = measureLayer;

    const map = new OLMap({
      target: containerRef.current,
      layers: [basemap, measureLayer],
      view: new View({
        center: fromLonLat([fallbackLocation.lng, fallbackLocation.lat]),
        zoom: 17,
        maxZoom: 22,
      }),
      controls: [],
    });

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
            layer !== geojsonLayerRef.current
          )
            return;
          const feat = f as Feature;
          const name = feat.get("name") as string | undefined;

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
      map.setTarget(undefined);
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load KML/KMZ ────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const loadKml = async (kmlText: string) => {
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
      const layer = new VectorLayer({ source, style: kmlStyle, zIndex: 10 });

      if (kmlLayerRef.current) map.removeLayer(kmlLayerRef.current);
      map.addLayer(layer);
      kmlLayerRef.current = layer;

      // Zoom to extent
      const extent = source.getExtent();
      if (extent && extent[0] !== Infinity) {
        map
          .getView()
          .fit(extent, {
            padding: [60, 60, 60, 60],
            duration: 600,
            maxZoom: 20,
          });
      }

      // Collect named features for navigator
      const named = parsed
        .filter((f) => f.get("name"))
        .map((f) => ({ name: f.get("name") as string, feature: f }));
      setFeatures(named);
      setIsLoading(false);
    };

    const run = async () => {
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
            await loadKml(unpacked.kmlText);
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
  }, [kmzUrl]);

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
        style: placesStyle,
        zIndex: 9,
        visible: showPlacesOverlay,
      });
      if (placesLayerRef.current) map.removeLayer(placesLayerRef.current);
      map.addLayer(layer);
      placesLayerRef.current = layer;
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
          style: placesStyle,
          zIndex: 9,
          visible: showPlacesOverlay,
        });
        if (placesLayerRef.current) map.removeLayer(placesLayerRef.current);
        map.addLayer(layer);
        placesLayerRef.current = layer;
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
    setSelectedFeatureName(feature.get("name") as string);
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
    <div
      className={cn(
        "relative overflow-hidden bg-[#0f1117]",
        isFullscreen
          ? "fixed inset-0 z-50"
          : isEmbed
            ? "w-full h-full"
            : "w-full h-screen",
      )}
    >
      {/* ── Map container ─────────────────────────────────────────────────── */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* ── Tooltip overlay (OL uses DOM element) ────────────────────────── */}
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute rounded-lg bg-black/80 px-2 py-1 text-xs font-bold text-amber-300 border border-amber-400/30 whitespace-nowrap"
        style={{ display: measureResult ? "block" : "none" }}
      >
        {measureResult}
      </div>

      {/* ── Loading overlay ───────────────────────────────────────────────── */}
      {isLoading && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-[#0f1117]/90 backdrop-blur-sm">
          <div className="flex items-center justify-center h-16 w-16 rounded-full bg-blue-500/10 border border-blue-500/20">
            <Globe className="h-8 w-8 text-blue-400 animate-pulse" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-xs font-black uppercase tracking-widest text-white/80">
              {loadingMessage}
            </p>
            <div className="flex items-center gap-1 justify-center">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-bounce"
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

          {/* Fullscreen */}
          {!isEmbed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl"
              onClick={() => setIsFullscreen((v) => !v)}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          )}

          <div className="h-px bg-border/20 mx-1" />

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
            className="h-9 w-9 rounded-xl"
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
        </Card>
      </div>

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

      {/* ── Selected feature popup ────────────────────────────────────────── */}
      {selectedFeatureName && (
        <div className="absolute bottom-12 left-1/2 z-30 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-2xl bg-black/75 backdrop-blur-xl border border-white/10 px-4 py-2 shadow-xl">
            <MapPin className="h-3.5 w-3.5 text-blue-400 shrink-0" />
            <span className="text-xs font-bold text-white">
              {selectedFeatureName}
            </span>
            <button
              onClick={() => {
                if (selectedFeatureRef.current) {
                  selectedFeatureRef.current.setStyle(undefined);
                  selectedFeatureRef.current = null;
                }
                setSelectedFeatureName(null);
              }}
              className="ml-1 text-muted-foreground hover:text-white transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
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
    </div>
  );
}
