import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import "ol/ol.css";
import Overlay from "ol/Overlay";
import VectorSource from "ol/source/Vector";
import { fromLonLat, toLonLat } from "ol/proj";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  AlertCircle,
  MapPin,
  X,
  ArrowLeft,
  LayoutDashboard,
  Map as MapIcon,
  FileText,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";

import { BlockInspector } from "./BlockInspector";
import { SchoolDetailsPanel } from "./2dviewercomponents/SchoolDetailsPanel";
import SchoolDecisionDashboard from "../pages/SchoolDecisionDashboard";
import { SchoolForm } from "./SchoolForm";
import { FacilitySurveyForm } from "./FacilitySurveyForm";
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
import { LayerManager } from "./2dviewercomponents/LayerManager";
import { BuildingsListPanel } from "./2dviewercomponents/BuildingsListPanel";
import {
  AnnotationPickerModal,
  ANNOTATION_ICONS,
} from "./2dviewercomponents/AnnotationPickerModal";

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
  pickerMode = false,
  onPickerSelect,
  onUpdateSchool,
}: School2DViewerProps) {
  // ── Derived State & URLs ──────────────────────────────────────────────────
  const buildUrl = useCallback(
    (path: string | undefined, subfolder: string) => {
      if (!path) return undefined;
      if (path.startsWith("http") || path.startsWith("blob:")) return path;
      const clean = path
        .replace(/^\/?(?:files\/|public\/uploads\/)+/i, "")
        .replace(/^\/+/, "");
      if (clean.includes("/")) return `${FILE_SERVER_URL}/${clean}`;
      return `${FILE_SERVER_URL}/schools/${school.id}/${subfolder}/${clean}`;
    },
    [school.id],
  );

  const {
    kmzUrl,
    tifUrl,
    placesOverlayUrl,
    fallbackLocation,
    effectiveBuildings,
    effectivePlacesOverlay,
    geojson,
  } = useMemo(
    () => ({
      kmzUrl: buildUrl(school.kmz2dFilePath || school.kmzFilePath, "kmz_2d"),
      tifUrl: buildUrl(tifFilePath || school.tifFilePath, "tif"),
      placesOverlayUrl: buildUrl(
        school.placesOverlayFilePath,
        "places-overlay",
      ),
      fallbackLocation: {
        lat: Number(school.latitude) || 0,
        lng: Number(school.longitude) || 0,
      },
      effectiveBuildings: buildings ?? school.buildings ?? [],
      effectivePlacesOverlay: placesOverlay ?? school.placesOverlayData,
      geojson: school.geojsonContent,
    }),
    [school, buildings, placesOverlay, buildUrl, tifFilePath],
  );

  // ── Refs & Basic State ─────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement | null>(null);
  const kmlLayerRef = useRef<any>(null);
  const geojsonLayerRef = useRef<any>(null);
  const placesLayerRef = useRef<any>(null);
  const blockOverlayRef = useRef<Overlay | null>(null);
  const blockOverlayElementRef = useRef<HTMLDivElement | null>(null);
  const measureSourceRef = useRef(new VectorSource());
  const tooltipOverlayRef = useRef<Overlay | null>(null);
  const groundOverlayLayersRef = useRef<any[]>([]);
  const overlayExtentRef = useRef<[number, number, number, number] | null>(
    null,
  );
  const mapSelectedFeatureRef = useRef<any>(null);
  const loadingStartTimeRef = useRef<number>(Date.now());
  /** Shared drawing-state flag between useMapSetup click guard & useMapInteractions */
  const isDrawingRef = useRef<boolean>(false);

  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Initialising map…");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isTileLoading, setIsTileLoading] = useState(false);
  const [decodingCount, setDecodingCount] = useState(0);
  const [measurementMode, setMeasurementMode] = useState<
    "none" | "distance" | "area"
  >("none");
  const [measureResult, setMeasureResult] = useState<string | null>(null);
  const [showPlacesOverlay, setShowPlacesOverlay] = useState(false);
  const [showBuildingsList, setShowBuildingsList] = useState(false);
  const [showNavigator, setShowNavigator] = useState(false);
  const [showBasicInfo, setShowBasicInfo] = useState(false);
  const [showOpacitySlider, setShowOpacitySlider] = useState(false);
  const [kmzOpacity, setKmzOpacity] = useState(1);
  const [visuals, setVisuals] = useState({
    brightness: 1,
    contrast: 1,
    saturation: 1,
  });
  const [activeTool, setActiveTool] = useState<any>("none");
  const [currentLat, setCurrentLat] = useState(fallbackLocation.lat);
  const [currentLng, setCurrentLng] = useState(fallbackLocation.lng);
  const [features, setFeatures] = useState<any[]>([]);
  const [selectedFeatureName, setSelectedFeatureName] = useState<string | null>(
    null,
  );
  const [infoFeature, setInfoFeature] = useState<any>(null);
  const [basemapStyle, setBasemapStyle] = useState<any>("google");

  const [activeBlock, setActiveBlock] = useState<BuildingData | null>(null);
  const [isBlockInspectorOpen, setIsBlockInspectorOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerBuilding, setDrawerBuilding] = useState<BuildingData | null>(
    null,
  );
  const [schoolBuildings, setSchoolBuildings] =
    useState<BuildingData[]>(effectiveBuildings);
  const [availableFacilities, setAvailableFacilities] = useState<any[]>([]);
  const [facilitiesLoading, setFacilitiesLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [siteAnnotations, setSiteAnnotations] = useState<any[]>(
    school.siteAnnotations || [],
  );
  const [pendingAnnotation, setPendingAnnotation] = useState<any>(null);
  const [annotationTooltip, setAnnotationTooltip] = useState<{
    ann: any;
    x: number;
    y: number;
  } | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "warning" | null;
  }>({ message: "", type: null });

  // Picker mode: selected building before confirming
  const [pickerSelected, setPickerSelected] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"dashboard" | "map" | "details">(
    "dashboard",
  );

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSurveyModalOpen, setIsSurveyModalOpen] = useState(false);
  const [isMissingMapModalOpen, setIsMissingMapModalOpen] = useState(false);

  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const showToast = useCallback(
    (message: string, type: "success" | "warning") => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      setToast({ message, type });
      toastTimeoutRef.current = setTimeout(
        () => setToast({ message: "", type: null }),
        5000,
      );
    },
    [],
  );

  useEffect(() => {
    // Check if map is missing
    const hasMapData =
      school.kmz2dFilePath ||
      school.kmzFilePath ||
      school.geojsonContent ||
      tifFilePath ||
      school.tifFilePath;
    if (!hasMapData && !isLoading) {
      setIsMissingMapModalOpen(true);
    }
  }, [school, tifFilePath, isLoading]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  // Fetch facilities for the building form
  useEffect(() => {
    setFacilitiesLoading(true);
    api
      .get("/schools/facilities")
      .then((res) => setAvailableFacilities(res.data))
      .catch((err) => console.error("Failed to fetch facilities", err))
      .finally(() => setFacilitiesLoading(false));
  }, []);

  // ── Basemap URL Helper ────────────────────────────────────────────────────
  const getBasemapUrl = useCallback((style: string) => {
    const urls: any = {
      satellite:
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      dark: "https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      street: "https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      nsdi: "https://geodata.rw/geoserver/gwc/service/wmts?layer=rwanda:orto_2008&style=&tilematrixset=EPSG:900913&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/png&TileMatrix=EPSG:900913:{z}&TileCol={x}&TileRow={y}",
      google: "https://mt{0-3}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
    };
    return urls[style] || urls.google;
  }, []);

  // ── Hooks ──────────────────────────────────────────────────────────────────
  const {
    mapRef,
    mapReady,
    basemapLayerRef,
    basemapLabelLayerRef,
    blocksLayerRef,
    annotationLayerRef,
    ghostLayerRef,
    hoverLayerRef,
    selectedLayerRef,
  } = useMapSetup({
    containerRef,
    fallbackLocation,
    onSelectBuilding,
    effectiveBuildings,
    setCurrentLat,
    setCurrentLng,
    setActiveBlock,
    setIsBlockInspectorOpen,
    setSelectedFeatureName,
    setInfoFeature,
    getBasemapUrl,
    isDrawingRef,
    blockOverlayRef,
    measureSourceRef,
    kmlLayerRef,
    geojsonLayerRef,
    placesLayerRef,
    pickerMode,
    onPickerSelect: (building: any) => {
      setPickerSelected(building);
    },
    onAnnotationHover: (ann, x, y) => {
      setAnnotationTooltip(ann ? { ann, x, y } : null);
    },
  });

  useKmzLoader({
    mapRef,
    mapReady,
    kmzUrl,
    tifUrl,
    schoolId: school.id,
    kmzOpacity,
    visuals,
    setIsLoading,
    setLoadingMessage,
    setLoadingProgress,
    setIsTileLoading,
    setDecodingCount,
    setFeatures,
    kmlLayerRef,
    groundOverlayLayersRef,
    overlayExtentRef,
  });

  // Sync places overlay visibility
  useEffect(() => {
    if (placesLayerRef.current) {
      placesLayerRef.current.setVisible(showPlacesOverlay);
    }
  }, [showPlacesOverlay]);

  const handleSaveSiteAnnotation = useCallback(
    async (payload: any) => {
      setIsSaving(true);
      try {
        // Ensure we hit the backend with the correct prefix and authorized instance
        const res = await api.post(
          `/schools/${school.id}/kmz/2d/site-annotations`,
          payload,
        );
        if (res.data) {
          setSiteAnnotations((prev) => {
            const next = [...prev, res.data];
            if (onUpdateSchool) onUpdateSchool({ siteAnnotations: next });
            return next;
          });
          showToast("Annotation added successfully.", "success");
        }
      } catch (err: any) {
        console.error("Failed to add site annotation", err);
        if (err.response?.status === 401) {
          showToast(
            "Your session has expired. Please refresh the page.",
            "warning",
          );
        } else {
          showToast("Failed to add site annotation.", "warning");
        }
      } finally {
        setIsSaving(false);
      }
    },
    [school.id, onUpdateSchool, showToast],
  );

  const handleDeleteAnnotation = useCallback(
    async (annId: string) => {
      if (!confirm("Are you sure you want to delete this annotation?")) return;
      try {
        await api.delete(
          `/schools/${school.id}/kmz/2d/site-annotations/${annId}`,
        );
        setSiteAnnotations((prev) => {
          const next = prev.filter((a) => a.id !== annId);
          if (onUpdateSchool) onUpdateSchool({ siteAnnotations: next });
          return next;
        });
        showToast("Annotation removed.", "success");
      } catch (err) {
        console.error("Failed to delete annotation", err);
        showToast("Failed to delete annotation.", "warning");
      }
    },
    [school.id, onUpdateSchool, showToast],
  );

  useMapInteractions({
    mapRef,
    mapReady,
    activeTool,
    setActiveTool,
    measurementMode,
    setMeasurementMode,
    setMeasureResult,
    tooltipOverlayRef,
    measureSourceRef,
    activeBlock,
    handleSaveBuilding: async (d) => handleSaveBuilding(d),
    handleSaveSiteAnnotation,
    onAnnotationReady: (pending) => setPendingAnnotation(pending),
    setDrawerBuilding,
    setDrawerOpen,
    hoverLayerRef,
    selectedLayerRef,
    blocksLayerRef,
    kmlLayerRef,
    geojsonLayerRef,
    placesLayerRef,
    annotationLayerRef,
    isDrawingRef,
  });

  const { setBuildings: setHookBuildings } = useSpatialDataSync({
    mapRef,
    mapReady,
    schoolId: school.id,
    blocksLayerRef,
    annotationLayerRef,
    effectivePlacesOverlay,
    placesOverlayUrl,
    showPlacesOverlay,
    placesLayerRef,
    geojson,
    geojsonLayerRef,
    onBuildingsLoaded: useCallback(
      (b: BuildingData[]) => setSchoolBuildings(b),
      [setSchoolBuildings],
    ),
    siteAnnotations,
  });

  const { flyToFeature, exportPng } = useMapMethods({
    mapRef,
    selectedFeatureRef: mapSelectedFeatureRef,
    setSelectedFeatureName,
  });

  // ── Callbacks ─────────────────────────────────────────────────────────────
  const switchBasemap = useCallback(
    (style: any) => {
      setBasemapStyle(style);
      const layer = basemapLayerRef.current;
      if (layer) {
        if (style !== "ghost" && style !== "offline") {
          layer.setVisible(true);
          const url = getBasemapUrl(style);
          const source = layer.getSource();
          if (source) {
            source.setUrl(url);
            source.refresh();
          }
        } else {
          layer.setVisible(false);
        }
      }
      ghostLayerRef.current?.setVisible(
        style === "ghost" || style === "offline",
      );
      basemapLabelLayerRef.current?.setVisible(
        style === "satellite" || style === "nsdi",
      );
    },
    [getBasemapUrl, basemapLayerRef, ghostLayerRef, basemapLabelLayerRef],
  );

  const handle3DView = useCallback(() => {
    const params = new URLSearchParams();
    if (school?.id) params.set("schoolId", school.id);
    if (school?.name) params.set("schoolName", school.name);
    if (activeBlock?.id) params.set("buildingId", activeBlock.id);
    window.open(`http://localhost:5175?${params.toString()}`, "_blank");
  }, [school, activeBlock]);

  const handleSaveBuilding = async (data: BuildingData) => {
    try {
      setIsSaving(true);
      setSaveError(null);

      const isNew = typeof data.id === "string" && data.id.startsWith("new-");
      const method = isNew ? "post" : "patch";
      const url = isNew
        ? `/schools/${school.id}/buildings`
        : `/schools/buildings/${data.id}`;

      const payload = {
        name: data.buildingName,
        code: data.buildingCode,
        function: data.buildingFunction,
        floors: parseInt(String(data.buildingFloors)) || 0,
        area: parseFloat(String(data.buildingArea)) || 0,
        yearBuilt: parseInt(String(data.buildingYearBuilt)) || 0,
        condition: data.buildingCondition,
        roofCondition: data.buildingRoofCondition,
        structuralScore: parseFloat(String(data.buildingStructuralScore)) || 0,
        notes: data.buildingNotes || "",
        latitude: data.geolocation.latitude,
        longitude: data.geolocation.longitude,
        annotations: (data.annotations || []).filter(
          (a): a is NonNullable<typeof a> =>
            a !== null && typeof a === "object" && !Array.isArray(a),
        ),
        media: data.media || [],
        facilities: (data.facilities || []).map((f) => ({
          facility_id: f.facility_id,
          facility_name: f.facility_name,
          number_of_rooms: parseInt(String(f.number_of_rooms)) || 0,
        })),
      };

      const response = await api[method](url, payload);
      if (response.data) {
        const saved = response.data;
        const mappedSaved: BuildingData = {
          ...saved,
          buildingName:
            saved.name || saved.buildingName || saved.buildingCode || "",
          buildingCode: saved.buildingCode || saved.code || "",
          buildingFunction: saved.function || saved.buildingFunction || "",
          buildingFloors: String(saved.floors || saved.buildingFloors || ""),
          buildingArea: String(
            saved.areaSquareMeters || saved.area || saved.buildingArea || "",
          ),
          buildingYearBuilt: String(
            saved.yearBuilt || saved.buildingYearBuilt || "",
          ),
          buildingCondition: saved.condition || saved.buildingCondition,
          buildingRoofCondition:
            saved.roofCondition || saved.buildingRoofCondition,
          buildingStructuralScore: String(saved.structuralScore || ""),
          buildingNotes: saved.notes || "",
          geolocation: {
            latitude:
              saved.centroidLat !== undefined
                ? parseFloat(String(saved.centroidLat))
                : saved.geolocation?.latitude,
            longitude:
              saved.centroidLng !== undefined
                ? parseFloat(String(saved.centroidLng))
                : saved.geolocation?.longitude,
          },
          facilities: saved.facilities || [],
          annotations: saved.annotations || data.annotations || [],
          media: saved.media || data.media || [],
        };

        const nextBuildings = isNew
          ? [...schoolBuildings, mappedSaved]
          : schoolBuildings.map((bg) =>
              bg.id === mappedSaved.id ? mappedSaved : bg,
            );

        setSchoolBuildings(nextBuildings);
        setHookBuildings(nextBuildings);

        if (activeBlock?.id === data.id || isNew) setActiveBlock(mappedSaved);
        setDrawerOpen(false);
        showToast(
          `Building "${mappedSaved.buildingName}" saved successfully.`,
          "success",
        );
        if (onUpdateSchool) onUpdateSchool({ buildings: nextBuildings });
      }
    } catch (err: any) {
      console.error("Failed to save building", err);
      const msg = err.response?.data?.message;
      const errorMsg = Array.isArray(msg)
        ? msg.join(", ")
        : msg || "An unexpected error occurred while saving the building.";
      setSaveError(errorMsg);
      showToast("Failed to save building.", "warning");
    } finally {
      setIsSaving(false);
    }
  };
  const handleDeleteBuilding = async (id: string) => {
    try {
      await api.delete(`/schools/buildings/${id}`);
      setSchoolBuildings((prev) => prev.filter((b) => b.id !== id));
      setHookBuildings((prev) => prev.filter((b) => b.id !== id));
      if (activeBlock?.id === id) {
        setIsBlockInspectorOpen(false);
        setActiveBlock(null);
      }
      showToast("Building deleted successfully.", "success");
    } catch (err: any) {
      console.error("Failed to delete building", err);
      showToast("Failed to delete building. Check logs.", "warning");
    }
  };

  const handleSaveMeasurement = async () => {
    if (!measureResult) return;
    try {
      const features = measureSourceRef.current.getFeatures();
      if (features.length === 0) return;

      const feat = features[0];
      const geom = feat.getGeometry();
      if (!geom) return;

      const typeMap: any = {
        LineString: "line",
        Polygon: "polygon",
        Point: "point",
      };
      const type = typeMap[geom.getType()] || "point";

      let coords = (geom as any).getCoordinates();
      if (type === "point") coords = toLonLat(coords);
      else if (type === "line") coords = coords.map((c: any) => toLonLat(c));
      else if (type === "polygon")
        coords = coords[0].map((c: any) => toLonLat(c));

      const payload = {
        id: `meas-${Date.now()}`,
        type,
        label: measureResult,
        coordinates: coords,
        areaSquareMeters: pendingAnnotation?.areaSquareMeters,
        lengthMeters: pendingAnnotation?.lengthMeters,
        style: { color: measurementMode === "area" ? "#fbbf24" : "#10b981" },
      };

      const res = await api.post(
        `/schools/${school.id}/kmz/2d/site-annotations`,
        payload,
      );
      if (res.data) {
        setSiteAnnotations((prev: any[]) => [...prev, res.data]);
        showToast("Measurement saved to map!", "success");
      }

      measureSourceRef.current.clear();
      setMeasureResult(null);
      setMeasurementMode("none");
    } catch (err) {
      console.error("Failed to save measurement", err);
      showToast("Failed to save measurement.", "warning");
    }
  };

  // ── Overlay (runs once map is ready) ─────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    if (blockOverlayElementRef.current && !blockOverlayRef.current) {
      const over = new Overlay({
        element: blockOverlayElementRef.current,
        autoPan: { animation: { duration: 250 } },
        positioning: "bottom-center",
        offset: [0, -10],
      });
      map.addOverlay(over);
      blockOverlayRef.current = over;
    }

    return () => {
      if (blockOverlayRef.current) {
        map.removeOverlay(blockOverlayRef.current);
        blockOverlayRef.current = null;
      }
    };
  }, [mapReady]);

  useEffect(() => {
    if (!initialBuildingId || schoolBuildings.length === 0 || !mapReady) return;
    const b = schoolBuildings.find((sb) => sb.id === initialBuildingId);
    if (b && b.geolocation?.latitude && b.geolocation?.longitude) {
      setTimeout(() => {
        setActiveBlock(b);
        setIsBlockInspectorOpen(true);
        const coord = fromLonLat([
          Number(b.geolocation.longitude),
          Number(b.geolocation.latitude),
        ]);
        blockOverlayRef.current?.setPosition(coord);
        mapRef.current
          ?.getView()
          .animate({ center: coord, zoom: 21, duration: 800 });
      }, 1000);
    }
  }, [initialBuildingId, schoolBuildings, mapReady]);

  const renderToast = () => (
    <AnimatePresence>
      {toast.type && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
          className={cn(
            "fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl shadow-2xl backdrop-blur-xl border flex items-center gap-3",
            toast.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
              : "bg-amber-500/10 border-amber-500/20 text-amber-500",
          )}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span className="text-[10px] font-black uppercase tracking-widest leading-none">
            {toast.message}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#0f1117] w-full h-full">
      {renderToast()}

      {/* ── Back button + school name (top-left, hidden in picker mode) ──── */}
      {!pickerMode && (
        <div className="absolute top-3 left-3 z-50 flex items-center gap-2 pointer-events-auto">
          {onClose && (
            <button
              onClick={onClose}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-card/10 backdrop-blur-2xl border border-white/5 text-white hover:text-white hover:bg-white/10 transition-all group shadow-2xl"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            </button>
          )}
          <div className="flex items-center gap-1.5 h-8 px-3 rounded-full bg-card/20 backdrop-blur-2xl border border-white/10 shadow-2xl max-w-45">
            <span className="text-[13px] font-bold text-white/60 truncate">
              {school.name}
            </span>
            {school.code && (
              <span className="text-[10px] font-mono text-white/25 shrink-0 hidden sm:block">
                {school.code}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Floating pill tabs (top-center, hidden in picker mode) ────────── */}
      {!pickerMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
          <div className="flex items-center gap-0.5 bg-card/50 backdrop-blur-2xl border border-white/5 rounded-full px-1 py-1 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
            {(
              [
                { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
                { id: "map", icon: MapIcon, label: "2D Map" },
                { id: "details", icon: FileText, label: "Details" },
              ] as const
            ).map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 h-7 rounded-full text-[10px] font-bold tracking-wide transition-all",
                  activeTab === id
                    ? "bg-primary text-white shadow-lg shadow-primary/20"
                    : "text-white/80 hover:text-white hover:bg-white/5",
                )}
              >
                <Icon className="w-3 h-3 shrink-0" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Dashboard Overlay ─────────────────────────────────────────────── */}
      {activeTab === "dashboard" && (
        <div className="absolute inset-0 z-40 bg-gray-950/90 backdrop-blur-sm pointer-events-auto overflow-y-auto custom-scrollbar">
          <SchoolDecisionDashboard
            id={school.id}
            standalone={false}
            onUpdateSchool={onUpdateSchool}
          />
        </div>
      )}

      {/* ── Details Panel ─────────────────────────────────────────────────── */}
      {activeTab === "details" && (
        <div className="absolute inset-0 z-40 bg-gray-950/80 backdrop-blur-sm pointer-events-auto overflow-y-auto custom-scrollbar">
          <SchoolDetailsPanel
            school={school}
            onEditProfile={() => setIsEditModalOpen(true)}
            onUpdateSurvey={() => setIsSurveyModalOpen(true)}
          />
        </div>
      )}

      {/* Annotation Picker Modal */}
      <AnnotationPickerModal
        open={!!pendingAnnotation}
        annotationType={pendingAnnotation?.type}
        initialDescription={pendingAnnotation?.initialDescription}
        onCancel={() => setPendingAnnotation(null)}
        onConfirm={(iconType, title, description, mapColor) => {
          if (!pendingAnnotation) return;
          const finalAnn = {
            ...pendingAnnotation,
            icon: iconType,
            title,
            description,
            label: title,
            content: title,
            iconType,
            style: { color: mapColor, iconType },
            createdAt: new Date().toISOString(),
          };
          delete finalAnn.initialDescription;

          if (pendingAnnotation.activeBlock) {
            const updated = {
              ...pendingAnnotation.activeBlock,
              annotations: [
                ...(pendingAnnotation.activeBlock.annotations || []),
                finalAnn,
              ],
            };
            handleSaveBuilding(updated);
          } else {
            handleSaveSiteAnnotation(finalAnn);
          }
          setPendingAnnotation(null);
        }}
      />

      {/* Annotation Hover Tooltip */}
      <AnimatePresence>
        {annotationTooltip &&
          (() => {
            const ann = annotationTooltip.ann;
            const iconType =
              ann.icon || ann.iconType || ann.style?.iconType || "pin";
            const iconDef =
              ANNOTATION_ICONS.find((ic) => ic.id === iconType) ||
              ANNOTATION_ICONS[0];
            const IconComp = iconDef.icon;
            return (
              <motion.div
                key="ann-tooltip"
                initial={{ opacity: 0, scale: 0.92, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.88 }}
                transition={{ duration: 0.15 }}
                className="absolute z-100 pointer-events-none"
                style={{
                  left: annotationTooltip.x + 14,
                  top: annotationTooltip.y - 10,
                }}
              >
                <div className="max-w-[220px] bg-[#0f1117]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] px-3 py-2.5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "p-1 rounded-lg border shrink-0",
                        iconDef.bg,
                        iconDef.border,
                      )}
                    >
                      <IconComp className={cn("w-3 h-3", iconDef.color)} />
                    </div>
                    <p className="text-[10px] font-black text-white uppercase tracking-wider leading-none truncate">
                      {ann.title || ann.label}
                    </p>
                  </div>
                  {ann.description && (
                    <p className="text-[9px] text-white/50 font-medium leading-snug">
                      {ann.description}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })()}
      </AnimatePresence>

      <div ref={containerRef} className="absolute inset-0" />

      <LoadingOverlay
        isLoading={isLoading || isSaving}
        loadingProgress={isSaving ? 100 : loadingProgress}
        loadingMessage={isSaving ? "Saving changes to map..." : loadingMessage}
        loadingStartTime={loadingStartTimeRef.current}
      />

      {/* ── Picker Mode Banner ───────────────────────────────────────────── */}
      {pickerMode && (
        <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-3 md:px-6 py-2 md:py-3 bg-primary/90 backdrop-blur-md border-b border-white/10 shadow-lg transition-all">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center animate-pulse shrink-0">
              <MapPin className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-white/60">
                Picker Mode
              </p>
              <p className="text-[11px] md:text-sm font-bold text-white truncate">
                {pickerSelected
                  ? pickerSelected.buildingName || "Building selected"
                  : "Click map feature…"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            {pickerSelected && (
              <button
                onClick={() => {
                  if (onPickerSelect) onPickerSelect(pickerSelected);
                  if (onClose) onClose();
                }}
                className="px-3 md:px-4 py-1.5 md:py-2 rounded-xl bg-white text-primary font-black text-[9px] md:text-xs uppercase tracking-widest hover:bg-white/90 transition-all shadow-lg shrink-0"
              >
                ✓ Confirm
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 md:p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-white shrink-0"
                title="Cancel"
              >
                <X className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {showBuildingsList && (
        <BuildingsListPanel
          buildings={schoolBuildings}
          onClose={() => setShowBuildingsList(false)}
          onDelete={async (id) => await handleDeleteBuilding(id)}
          selectedId={activeBlock?.id}
          onAdd={() => {
            setActiveTool("create_block");
            // On mobile, close the list to show the drawing surface
            if (window.innerWidth < 768) setShowBuildingsList(false);
          }}
          onSelect={(b) => {
            setActiveBlock(b);
            setIsBlockInspectorOpen(true);
            // On mobile, close the list to show the inspector cleanly
            if (window.innerWidth < 768) setShowBuildingsList(false);

            if (b.geolocation?.latitude && b.geolocation?.longitude) {
              const coord = fromLonLat([
                Number(b.geolocation.longitude),
                Number(b.geolocation.latitude),
              ]);
              blockOverlayRef.current?.setPosition(coord);
              mapRef.current
                ?.getView()
                .animate({ center: coord, zoom: 21, duration: 800 });
            }
          }}
        />
      )}

      <MapToolbar
        onClose={undefined}
        showNavigator={showNavigator}
        setShowNavigator={setShowNavigator}
        showBuildingsList={showBuildingsList}
        setShowBuildingsList={setShowBuildingsList}
        showOpacitySlider={showOpacitySlider}
        setShowOpacitySlider={setShowOpacitySlider}
        basemapStyle={basemapStyle}
        switchBasemap={switchBasemap}
        measurementMode={measurementMode}
        setMeasurementMode={setMeasurementMode}
        clearMeasurements={() => measureSourceRef.current.clear()}
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        onZoomIn={() =>
          mapRef.current
            ?.getView()
            .animate({ zoom: (mapRef.current.getView().getZoom() ?? 19) + 1 })
        }
        onZoomOut={() =>
          mapRef.current
            ?.getView()
            .animate({ zoom: (mapRef.current.getView().getZoom() ?? 19) - 1 })
        }
        onHome={() =>
          mapRef.current?.getView().animate({
            center: fromLonLat([fallbackLocation.lng, fallbackLocation.lat]),
            zoom: 19,
          })
        }
        onFitExtent={() =>
          overlayExtentRef.current &&
          mapRef.current
            ?.getView()
            .fit(overlayExtentRef.current, { padding: [60, 60, 60, 60] })
        }
        onExportPng={exportPng}
        on3DView={handle3DView}
        showBasicInfo={showBasicInfo}
        setShowBasicInfo={setShowBasicInfo}
        kmzOpacity={kmzOpacity}
        setKmzOpacity={setKmzOpacity}
        visuals={visuals}
        setVisuals={setVisuals}
        showPlacesOverlay={showPlacesOverlay}
        setShowPlacesOverlay={setShowPlacesOverlay}
      />

      <MapHud
        school={school}
        setShowBasicInfo={setShowBasicInfo}
        isTileLoading={isTileLoading}
        decodingCount={decodingCount}
        isLoading={isLoading}
        currentLat={currentLat}
        currentLng={currentLng}
        measurementMode={measurementMode}
        measureResult={measureResult}
        infoFeature={infoFeature}
        onCloseInfo={() => setInfoFeature(null)}
        onSaveMeasurement={handleSaveMeasurement}
      />

      {showNavigator && (
        <LayerManager
          onClose={() => setShowNavigator(false)}
          schoolBuildings={schoolBuildings}
          siteAnnotations={siteAnnotations}
          onDeleteAnnotation={handleDeleteAnnotation}
          onSelectBuilding={(b) => {
            setActiveBlock(b);
            setIsBlockInspectorOpen(true);
            // On mobile, close the GIS panel to show the block inspector
            if (window.innerWidth < 768) setShowNavigator(false);

            if (b.geolocation?.longitude && b.geolocation?.latitude) {
              const coord = fromLonLat([
                Number(b.geolocation.longitude),
                Number(b.geolocation.latitude),
              ]);
              blockOverlayRef.current?.setPosition(coord);
              mapRef.current
                ?.getView()
                .animate({ center: coord, zoom: 21, duration: 800 });
            }
          }}
          onFlyToAnnotation={(ann) => {
            const coords = ann.coordinates;
            if (coords && coords.length >= 2) {
              const lon =
                typeof coords[0] === "number" ? coords[0] : coords[0][0];
              const lat =
                typeof coords[1] === "number" ? coords[1] : coords[0][1];
              const coord = fromLonLat([Number(lon), Number(lat)]);
              mapRef.current
                ?.getView()
                .animate({ center: coord, zoom: 20, duration: 800 });
            }
          }}
        />
      )}

      {/* Legacy Navigator — fallback if features are present */}
      {showNavigator && features.length > 0 && false && (
        <MapNavigator
          features={features}
          selectedFeatureName={selectedFeatureName}
          onFlyTo={flyToFeature}
          onClose={() => setShowNavigator(false)}
        />
      )}

      {showBasicInfo && (
        <BasicInfoModal
          school={school}
          onClose={() => setShowBasicInfo(false)}
        />
      )}

      {/* Block Inspector Overlay — Responsive Bottom Sheet on Mobile / Sidebar on Desktop */}
      {!pickerMode && (
        <div
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] pointer-events-none", // Mobile bottom sheet
            "md:absolute md:inset-y-0 md:right-0 md:bottom-auto md:w-[500px] md:z-40", // Desktop sidebar (Right side)
            isBlockInspectorOpen
              ? "translate-y-0 md:translate-x-0 opacity-100"
              : "translate-y-full md:translate-x-full opacity-0",
          )}
        >
          {activeBlock && (
            <div className="pointer-events-auto">
              <BlockInspector
                building={activeBlock}
                schoolId={school?.id || ""}
                onClose={() => {
                  setIsBlockInspectorOpen(false);
                  setTimeout(() => setActiveBlock(null), 300);
                }}
                onEdit={() => {
                  setDrawerBuilding(activeBlock);
                  setDrawerOpen(true);
                  setIsBlockInspectorOpen(false);
                }}
                onUpdateBuilding={async (b) => {
                  try {
                    const building = b as any;
                    // Update local state first for instant feedback
                    setActiveBlock(b);
                    setSchoolBuildings((prev) =>
                      prev.map((old) => (old.id === b.id ? b : old)),
                    );

                    // Map frontend BuildingData -> backend BuildingDto
                    // Note: Use keys from BuildingDto.ts
                    const dto = {
                      name: building.buildingName || building.name,
                      code: building.buildingCode || building.code,
                      function: building.buildingFunction || building.function,
                      floors:
                        Number(building.buildingFloors || building.floors) || 0,
                      area:
                        Number(
                          building.buildingArea ||
                            building.area ||
                            building.areaSquareMeters,
                        ) || 0,
                      yearBuilt:
                        Number(
                          building.buildingYearBuilt || building.yearBuilt,
                        ) || 0,
                      condition:
                        building.buildingCondition || building.condition,
                      roofCondition:
                        building.buildingRoofCondition ||
                        building.roofCondition,
                      structuralScore:
                        Number(
                          building.buildingStructuralScore ||
                            building.structuralScore,
                        ) || 0,
                      notes: building.buildingNotes || building.notes,
                      latitude:
                        building.geolocation?.latitude ?? building.centroidLat,
                      longitude:
                        building.geolocation?.longitude ?? building.centroidLng,
                      annotations: building.annotations || [],
                      media: building.media || [],
                    };

                    // Persist to backend with mapped DTO
                    await api.patch(`/schools/buildings/${b.id}`, dto);
                  } catch (error) {
                    console.error("Failed to persist building update:", error);
                  }
                }}
                onAddAnnotation={() => setActiveTool("annotate_point")}
                onUploadMedia={() => {}}
                on3DView={() => {
                  const params = new URLSearchParams();
                  if (school?.id) params.set("schoolId", school.id);
                  if (school?.name) params.set("schoolName", school.name);
                  if (activeBlock?.id) params.set("buildingId", activeBlock.id);
                  window.open(
                    `http://localhost:5175?${params.toString()}`,
                    "_blank",
                  );
                }}
              />
            </div>
          )}
        </div>
      )}

      {!pickerMode && (
        <BuildingFormDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          building={drawerBuilding}
          buildingIndex={schoolBuildings.findIndex(
            (b) => String(b.id) === String(drawerBuilding?.id),
          )}
          onSave={handleSaveBuilding}
          availableFacilities={availableFacilities}
          facilitiesLoading={facilitiesLoading}
          isSaving={isSaving}
          errorMessage={saveError}
          schoolLat={fallbackLocation.lat}
          schoolLng={fallbackLocation.lng}
        />
      )}

      {/* ── Global School Management Modals ───────────────────────────────── */}
      <SchoolForm
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={() => {
          setIsEditModalOpen(false);
          if (onUpdateSchool) onUpdateSchool(school);
        }}
        mode="edit"
        schoolId={school.id}
        initialData={school}
      />

      {isSurveyModalOpen && (
        <FacilitySurveyForm
          schoolId={school.id}
          schoolName={school.name || ""}
          isOpen={isSurveyModalOpen}
          onClose={() => setIsSurveyModalOpen(false)}
        />
      )}

      {/* ── Missing Map Data Prompt ─────────────────────────────────────── */}
      <Modal
        isOpen={isMissingMapModalOpen}
        onClose={() => setIsMissingMapModalOpen(false)}
        title={
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black italic">
                Spatial Intelligence Missing
              </h3>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                Digital Twin Synchronisation Required
              </p>
            </div>
          </div>
        }
        maxWidth="max-w-md"
      >
        <div className="space-y-6 py-4">
          <div className="p-6 rounded-[32px] bg-white/5 border border-white/5 space-y-4 text-center">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-2 border border-white/10 shadow-inner">
              <MapIcon className="w-8 h-8 text-amber-500/40" />
            </div>
            <p className="text-xs font-bold text-white/60 leading-relaxed italic">
              This institution does not yet have high-resolution drone imagery
              or spatial boundary data synchronized.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <Button
                asChild
                className="rounded-full bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-[10px] h-11"
              >
                <Link to={`/schools/${school.id}/kmz`}>
                  Upload KMZ Spatial Data
                </Link>
              </Button>
              <Button
                variant="ghost"
                onClick={() => setIsMissingMapModalOpen(false)}
                className="rounded-full font-black uppercase tracking-widest text-[10px] h-11 opacity-40 hover:opacity-100"
              >
                Continue with Base Imagery
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
