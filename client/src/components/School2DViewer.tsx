import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import "ol/ol.css";
import Overlay from "ol/Overlay";
import VectorSource from "ol/source/Vector";
import { fromLonLat } from "ol/proj";

import { BlockInspector } from "./BlockInspector";
import { BuildingFormDrawer } from "./school-form-steps/BuildingFormDrawer";
import type { BuildingData } from "./school-form-steps/BuildingsStep";
import { api, FILE_SERVER_URL } from "../lib/api";
import { cn } from "../lib/utils";

// Subcomponents
import { LoadingOverlay } from "./2dviewercomponents/LoadingOverlay";
import { MapToolbar } from "./2dviewercomponents/MapToolbar";
import { MapHud } from "./2dviewercomponents/MapHud";
import { BasicInfoModal } from "./2dviewercomponents/BasicInfoModal";
import { MapNavigator } from "./2dviewercomponents/MapNavigator";

// Hooks
import { useMapSetup } from "./2dviewercomponents/hooks/useMapSetup";
import { useKmzLoader } from "./2dviewercomponents/hooks/useKmzLoader";
import { useMapInteractions } from "./2dviewercomponents/hooks/useMapInteractions";
import { useSpatialDataSync } from "./2dviewercomponents/hooks/useSpatialDataSync";
import { useMapMethods } from "./2dviewercomponents/hooks/useMapMethods";

// Utils
import type { School2DViewerProps } from "./2dviewercomponents/MapUtils";

export default function School2DViewer({
  school,
  buildings,
  placesOverlay,
  onClose,
  onSelectBuilding,
  initialBuildingId,
  tifFilePath,
}: School2DViewerProps) {
  // ── Derived State & URLs ──────────────────────────────────────────────────
  const buildUrl = useCallback((path: string | undefined, subfolder: string) => {
    if (!path) return undefined;
    if (path.startsWith("http") || path.startsWith("blob:")) return path;
    const clean = path.replace(/^\/?(?:files\/|public\/uploads\/)+/i, "").replace(/^\/+/, "");
    if (clean.includes("/")) return `${FILE_SERVER_URL}/${clean}`;
    return `${FILE_SERVER_URL}/schools/${school.id}/${subfolder}/${clean}`;
  }, [school.id]);

  const { kmzUrl, tifUrl, placesOverlayUrl, fallbackLocation, effectiveBuildings, effectivePlacesOverlay, geojson } = useMemo(() => ({
    kmzUrl: buildUrl(school.kmz2dFilePath || school.kmzFilePath, "kmz_2d"),
    tifUrl: buildUrl(tifFilePath || school.tifFilePath, "tif"),
    placesOverlayUrl: buildUrl(school.placesOverlayFilePath, "places-overlay"),
    fallbackLocation: { lat: Number(school.latitude) || 0, lng: Number(school.longitude) || 0 },
    effectiveBuildings: buildings ?? school.buildings ?? [],
    effectivePlacesOverlay: placesOverlay ?? school.placesOverlayData,
    geojson: school.geojsonContent,
  }), [school, buildings, placesOverlay, buildUrl, tifFilePath]);

  // ── Refs & Basic State ─────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement | null>(null);
  const kmlLayerRef = useRef<any>(null);
  const geojsonLayerRef = useRef<any>(null);
  const placesLayerRef = useRef<any>(null);
  const blockOverlayRef = useRef<Overlay | null>(null);
  const measureSourceRef = useRef(new VectorSource());
  const tooltipOverlayRef = useRef<Overlay | null>(null);
  const groundOverlayLayersRef = useRef<any[]>([]);
  const overlayExtentRef = useRef<[number, number, number, number] | null>(null);
  const mapInternalDrawRef = useRef<any>(null);
  const mapSelectedFeatureRef = useRef<any>(null);
  const loadingStartTimeRef = useRef<number>(Date.now());

  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Initialising map…");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isTileLoading, setIsTileLoading] = useState(false);
  const [decodingCount, setDecodingCount] = useState(0);
  const [measurementMode, setMeasurementMode] = useState<"none" | "distance" | "area">("none");
  const [measureResult, setMeasureResult] = useState<string | null>(null);
  const [showPlacesOverlay, setShowPlacesOverlay] = useState(true);
  const [showNavigator, setShowNavigator] = useState(false);
  const [showBasicInfo, setShowBasicInfo] = useState(false);
  const [showOpacitySlider, setShowOpacitySlider] = useState(false);
  const [kmzOpacity, setKmzOpacity] = useState(1);
  const [activeTool, setActiveTool] = useState<any>("none");
  const [currentLat, setCurrentLat] = useState(fallbackLocation.lat);
  const [currentLng, setCurrentLng] = useState(fallbackLocation.lng);
  const [features, setFeatures] = useState<any[]>([]);
  const [selectedFeatureName, setSelectedFeatureName] = useState<string | null>(null);
  const [infoFeature, setInfoFeature] = useState<any>(null);
  const [basemapStyle, setBasemapStyle] = useState<any>("google");

  const [activeBlock, setActiveBlock] = useState<BuildingData | null>(null);
  const [isBlockInspectorOpen, setIsBlockInspectorOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerBuilding, setDrawerBuilding] = useState<BuildingData | null>(null);
  const [schoolBuildings, setSchoolBuildings] = useState<BuildingData[]>(effectiveBuildings);

  // ── Basemap URL Helper ────────────────────────────────────────────────────
  const getBasemapUrl = useCallback((style: string) => {
    const urls: any = {
      satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      dark: "https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      street: "https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      nsdi: "https://geodata.rw/geoserver/gwc/service/wmts?layer=rwanda:orto_2008&style=&tilematrixset=EPSG:900913&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/png&TileMatrix=EPSG:900913:{z}&TileCol={x}&TileRow={y}",
      google: "https://mt{0-3}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
    };
    return urls[style] || urls.google;
  }, []);

  // ── Hooks ──────────────────────────────────────────────────────────────────
  const { mapRef, mapReady, basemapLayerRef, basemapLabelLayerRef, blocksLayerRef, annotationLayerRef, ghostLayerRef } = useMapSetup({
    containerRef, fallbackLocation, onSelectBuilding, effectiveBuildings, setCurrentLat, setCurrentLng,
    setActiveBlock, setIsBlockInspectorOpen, setSelectedFeatureName, setInfoFeature, getBasemapUrl,
    activeDrawRef: mapInternalDrawRef, blockOverlayRef, measureSourceRef, kmlLayerRef, geojsonLayerRef, placesLayerRef
  });

  const { bitmapsRef } = useKmzLoader({
    mapRef, mapReady, kmzUrl, tifUrl, schoolId: school.id, kmzOpacity,
    setIsLoading, setLoadingMessage, setLoadingProgress, setIsTileLoading, setDecodingCount, setFeatures,
    kmlLayerRef, groundOverlayLayersRef, overlayExtentRef
  });

  useMapInteractions({
    mapRef, mapReady, activeTool, setActiveTool, measurementMode, setMeasureResult,
    tooltipOverlayRef, measureSourceRef, activeBlock,
    handleSaveBuilding: async (d) => handleSaveBuilding(d), setDrawerBuilding, setDrawerOpen
  });

  useSpatialDataSync({
    mapRef, mapReady, schoolBuildings, blocksLayerRef, annotationLayerRef,
    effectivePlacesOverlay, placesOverlayUrl, showPlacesOverlay, placesLayerRef,
    geojson, geojsonLayerRef
  });

  const { flyToFeature, exportPng } = useMapMethods({
    mapRef, selectedFeatureRef: mapSelectedFeatureRef, setSelectedFeatureName
  });

  // ── Callbacks ─────────────────────────────────────────────────────────────
  const switchBasemap = useCallback((style: any) => {
    setBasemapStyle(style);
    const layer = basemapLayerRef.current;
    if (layer) {
      if (style !== "ghost" && style !== "offline") {
        layer.setVisible(true);
        const url = getBasemapUrl(style);
        const source: any = layer.getSource();
        source.setUrl(url); source.refresh();
      } else layer.setVisible(false);
    }
    ghostLayerRef.current?.setVisible(style === "ghost" || style === "offline");
    basemapLabelLayerRef.current?.setVisible(style === "satellite" || style === "nsdi");
  }, [getBasemapUrl, basemapLayerRef, ghostLayerRef, basemapLabelLayerRef]);

  const handleSaveBuilding = async (data: BuildingData) => {
    try {
      const isNew = data.id.startsWith("new-");
      const method = isNew ? "post" : "put";
      const url = isNew ? `/schools/${school.id}/buildings` : `/schools/${school.id}/buildings/${data.id}`;
      const response = await api[method](url, data);
      if (response.data) {
        const saved = response.data;
        setSchoolBuildings(prev => isNew ? [...prev, saved] : prev.map(bg => bg.id === saved.id ? saved : bg));
        if (activeBlock?.id === data.id || isNew) setActiveBlock(saved);
        setDrawerOpen(false);
      }
    } catch (err) { console.error("Failed to save building", err); }
  };

  // ── Overlay (runs once map is ready) ─────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    const inspectorEl = document.getElementById("block-inspector-container");
    if (inspectorEl && !blockOverlayRef.current) {
      const over = new Overlay({ element: inspectorEl, autoPan: { animation: { duration: 250 } }, positioning: "bottom-center", offset: [0, -10] });
      map.addOverlay(over); blockOverlayRef.current = over;
    }
  }, [mapReady]);

  useEffect(() => {
    if (!initialBuildingId || schoolBuildings.length === 0 || !mapReady) return;
    const b = schoolBuildings.find(sb => sb.id === initialBuildingId);
    if (b && b.geolocation?.latitude && b.geolocation?.longitude) {
      setTimeout(() => {
        setActiveBlock(b); setIsBlockInspectorOpen(true);
        const coord = fromLonLat([Number(b.geolocation.longitude), Number(b.geolocation.latitude)]);
        blockOverlayRef.current?.setPosition(coord);
        mapRef.current?.getView().animate({ center: coord, zoom: 21, duration: 800 });
      }, 1000);
    }
  }, [initialBuildingId, schoolBuildings, mapReady]);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#0f1117] w-full h-full">
      <div ref={containerRef} className="absolute inset-0" />
      
      <LoadingOverlay isLoading={isLoading} isTileLoading={isTileLoading} decodingCount={decodingCount} loadingProgress={loadingProgress} loadingMessage={loadingMessage} loadingStartTime={loadingStartTimeRef.current} activeBitmapCount={bitmapsRef.current.size} />
      
      <MapToolbar onClose={onClose} showNavigator={showNavigator} setShowNavigator={setShowNavigator} showPlacesOverlay={showPlacesOverlay} setShowPlacesOverlay={setShowPlacesOverlay} showOpacitySlider={showOpacitySlider} setShowOpacitySlider={setShowOpacitySlider} basemapStyle={basemapStyle} switchBasemap={switchBasemap} measurementMode={measurementMode} setMeasurementMode={setMeasurementMode} clearMeasurements={() => measureSourceRef.current.clear()} activeTool={activeTool} setActiveTool={setActiveTool} onZoomIn={() => mapRef.current?.getView().animate({ zoom: (mapRef.current.getView().getZoom() ?? 19) + 1 })} onZoomOut={() => mapRef.current?.getView().animate({ zoom: (mapRef.current.getView().getZoom() ?? 19) - 1 })} onHome={() => mapRef.current?.getView().animate({ center: fromLonLat([fallbackLocation.lng, fallbackLocation.lat]), zoom: 19 })} onFitExtent={() => overlayExtentRef.current && mapRef.current?.getView().fit(overlayExtentRef.current, { padding: [60,60,60,60] })} onExportPng={exportPng} showBasicInfo={showBasicInfo} setShowBasicInfo={setShowBasicInfo} kmzOpacity={kmzOpacity} setKmzOpacity={setKmzOpacity} />
      
      <MapHud school={school} setShowBasicInfo={setShowBasicInfo} isTileLoading={isTileLoading} isLoading={isLoading} currentLat={currentLat} currentLng={currentLng} measurementMode={measurementMode} measureResult={measureResult} infoFeature={infoFeature} onCloseInfo={() => setInfoFeature(null)} />
      
      {showNavigator && <MapNavigator features={features} selectedFeatureName={selectedFeatureName} onFlyTo={flyToFeature} onClose={() => setShowNavigator(false)} />}
      
      {showBasicInfo && <BasicInfoModal school={school} onClose={() => setShowBasicInfo(false)} />}

      <div id="block-inspector-container" className={cn("z-40 transition-opacity", isBlockInspectorOpen ? "opacity-100" : "opacity-0 pointer-events-none")}>
        {activeBlock && <BlockInspector building={activeBlock} onClose={() => setIsBlockInspectorOpen(false)} onEdit={() => { setDrawerBuilding(activeBlock); setDrawerOpen(true); setIsBlockInspectorOpen(false); }} onUpdateBuilding={async (b) => { setActiveBlock(b); setSchoolBuildings(prev => prev.map(old => old.id === b.id ? b : old)); }} onAddAnnotation={() => setActiveTool("annotate_point")} onUploadMedia={() => {}} />}
      </div>

      <BuildingFormDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        building={drawerBuilding}
        buildingIndex={-1}
        onSave={handleSaveBuilding}
        availableFacilities={[]}
        schoolLat={fallbackLocation.lat}
        schoolLng={fallbackLocation.lng}
      />
    </div>
  );
}
