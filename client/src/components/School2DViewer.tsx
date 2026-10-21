import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import "ol/ol.css";
import Overlay from "ol/Overlay";
import VectorSource from "ol/source/Vector";
import { fromLonLat } from "ol/proj";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  MapPin,
  X,
  ArrowLeft,
  LayoutDashboard,
  Map as MapIcon,
  FileText,
  AlertTriangle,
  Box,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useGoBack } from "../hooks/useGoBack";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";

import { BlockInspector } from "./BlockInspector";
import { SchoolDetailsPanel } from "./2dviewercomponents/SchoolDetailsPanel";
import SchoolDecisionDashboard from "../pages/SchoolDecisionDashboard";
import { SchoolForm } from "./SchoolForm";
import { FacilitySurveyForm } from "./FacilitySurveyForm";
import { BuildingFormDrawer } from "./school-form-steps/BuildingFormDrawer";
import School3DView from "./School3DView";
import type { BuildingData } from "./school-form-steps/BuildingsStep";
import { api, apiErrorMessage, FILE_SERVER_URL } from "../lib/api";
import { DeleteConfirmationModal } from "./ui/delete-confirmation-modal";
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
import { useReportIndicators } from "./2dviewercomponents/hooks/useReportIndicators";
import { useSchoolLocationEditor } from "./2dviewercomponents/hooks/useSchoolLocationEditor";
import { SchoolLocationEditorPanel } from "./2dviewercomponents/SchoolLocationEditorPanel";
import { useToast } from "./ui/toast";
import { useAuthorization } from "../hooks/useAuthorization";
import { Permission } from "../lib/permissions";
import { useSiteFeatures } from "../lib/measure/useSiteFeatures";
import {
  KIND_LABELS,
  downloadSiteFeaturesCsv,
  featureCentroid,
  featureTo2dAnnotation,
  formatFeatureValue,
  geometryFromShape,
  isMeasureKind,
  type SiteFeatureKind,
} from "../lib/measure/site-features";
import {
  accuracyLabel,
  broadcastSelection,
  canUseTool,
  formatMeasureArea,
  formatMeasureLength,
  isTypingTarget,
  loadDisplayUnit,
  onSelection,
  readViewerDeepLink,
  saveDisplayUnit,
  toolForKey,
  viewerLink,
  type DisplayUnit,
  type ViewerToolId,
} from "../lib/viewer-tools";
import MeasurementListPanel, {
  type MeasurementRow,
} from "./3dviewercomponents/MeasurementListPanel";
import ActiveToolBanner from "./3dviewercomponents/ActiveToolBanner";
import ViewerHelpModal from "./3dviewercomponents/ViewerHelpModal";

/** A measurement made by a user who can't save — local, marked "Not saved". */
interface TempMeasurement {
  id: string;
  kind: SiteFeatureKind;
  type: "line" | "polygon";
  coordinates: number[];
  value: number;
  title: string;
  createdAt: string;
}

const MODE_TOOL_2D = {
  distance: "measure_distance",
  area: "measure_area",
  perimeter: "measure_perimeter",
} as const;

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

  // Always give the viewer a way out. Prefer the host's onClose; otherwise step
  // back through browser history so the user lands where they came from
  // (Dashboard, National Map, a deep link, …) rather than a fixed route.
  const goBack = useGoBack(school?.id ? `/schools/${school.id}` : "/schools");
  const handleClose = useCallback(() => {
    if (onClose) return onClose();
    goBack();
  }, [onClose, goBack]);

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
  const mapTabAnimatedRef = useRef(false);

  // Deep link from the 3D viewer: ?view=map&building=<id>&lat=&lng= (WS5.6).
  const deepLink = useMemo(
    () => readViewerDeepLink(window.location.search),
    [],
  );
  const initialBuilding = initialBuildingId ?? deepLink.buildingId ?? undefined;

  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Initialising map…");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isTileLoading, setIsTileLoading] = useState(false);
  const [decodingCount, setDecodingCount] = useState(0);
  const [measurementMode, setMeasurementMode] = useState<
    "none" | "distance" | "area" | "perimeter"
  >("none");
  const [sketchPoints, setSketchPoints] = useState(0);
  const [showMeasureList, setShowMeasureList] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [tempMeasurements, setTempMeasurements] = useState<TempMeasurement[]>(
    [],
  );
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
  // Site features (WS5.2): measurements / notes from BOTH viewers, live.
  const siteFeatures = useSiteFeatures(school.id);
  const [pendingAnnotation, setPendingAnnotation] = useState<any>(null);
  const [annotationTooltip, setAnnotationTooltip] = useState<{
    ann: any;
    x: number;
    y: number;
  } | null>(null);
  /** Site feature waiting for the delete confirmation modal. */
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isDeletingFeature, setIsDeletingFeature] = useState(false);

  // Picker mode: selected building before confirming
  const [pickerSelected, setPickerSelected] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "map" | "3d" | "details"
  >(() => (deepLink.view === "map" || deepLink.buildingId ? "map" : "dashboard"));

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSurveyModalOpen, setIsSurveyModalOpen] = useState(false);
  const [isMissingMapModalOpen, setIsMissingMapModalOpen] = useState(false);
  const [showReportIndicators, setShowReportIndicators] = useState(true);
  const [reportRefreshKey, setReportRefreshKey] = useState(0);
  const [blockInspectorInitialTab, setBlockInspectorInitialTab] = useState<
    "details" | "media" | "reporting"
  >("details");
  const [showBuildingAreas, setShowBuildingAreas] = useState(true);
  const [showSiteAnnotations, setShowSiteAnnotations] = useState(true);
  const [hiddenAnnotationGroups, setHiddenAnnotationGroups] = useState<
    Set<string>
  >(new Set());

  // ── School location editor (drag-a-pin to update lat/lng) ─────────────────
  const notify = useToast();
  const { isAuthorized, hasPermission, user } = useAuthorization();
  const canSetLocation =
    isAuthorized(Permission.EDIT_SCHOOL_LOCATION) ||
    isAuthorized(Permission.MANAGE_SCHOOLS);
  const canMeasure = hasPermission(Permission.USE_MEASURE_TOOLS);
  const canSaveFeatures = hasPermission(Permission.SAVE_SITE_FEATURES);
  const canEditAnyFeature = hasPermission(Permission.EDIT_SITE_ANNOTATIONS);
  const canExport = hasPermission(Permission.EXPORT_VIEWER_DATA);
  const canCreateBlock =
    hasPermission(Permission.EDIT_SCHOOL_BUILDINGS) ||
    hasPermission(Permission.MANAGE_SCHOOLS);
  const [unit, setUnitState] = useState<DisplayUnit>(() =>
    loadDisplayUnit(user?.id),
  );
  const setUnit = useCallback(
    (u: DisplayUnit) => {
      setUnitState(u);
      saveDisplayUnit(user?.id, u);
    },
    [user?.id],
  );

  // What the map layer renders: saved features (2D + 3D, already WGS84) and
  // this session's unsaved measurements.
  const siteAnnotations = useMemo(
    () => [
      ...siteFeatures.features.map(featureTo2dAnnotation),
      ...tempMeasurements.map((t) => ({
        id: t.id,
        type: t.type,
        coordinates: t.coordinates,
        label: `${t.title} (not saved)`,
        title: t.title,
        icon: "measure",
        iconType: "measure",
        style: { color: "#f59e0b", iconType: "measure" },
        areaSquareMeters: t.kind === "measure_area" ? t.value : undefined,
        lengthMeters: t.kind !== "measure_area" ? t.value : undefined,
        createdAt: t.createdAt,
      })),
    ],
    [siteFeatures.features, tempMeasurements],
  );
  const canChangeFeature = useCallback(
    (createdBy: string | null) =>
      canSaveFeatures &&
      (canEditAnyFeature || (!!user?.id && createdBy === user.id)),
    [canSaveFeatures, canEditAnyFeature, user?.id],
  );
  const locationEditActive = activeTool === "set_location";
  const originalLonLat = useMemo<[number, number] | null>(
    () =>
      Number(school.latitude) && Number(school.longitude)
        ? [Number(school.longitude), Number(school.latitude)]
        : null,
    [school.latitude, school.longitude],
  );
  const [locationDraft, setLocationDraft] = useState<[number, number] | null>(
    null,
  );
  const [savingLocation, setSavingLocation] = useState(false);

  const showToast = useCallback(
    (message: string, type: "success" | "warning") => {
      if (type === "success") notify.success(message);
      else notify.error(message);
    },
    [notify],
  );

  const handleToggleAnnotationGroup = useCallback((iconType: string) => {
    setHiddenAnnotationGroups((prev) => {
      const next = new Set(prev);
      if (next.has(iconType)) next.delete(iconType);
      else next.add(iconType);
      return next;
    });
  }, []);

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

  /** Saves a 2D note or measurement as a site feature (both viewers see it). */
  const handleSaveSiteAnnotation = useCallback(
    async (payload: any) => {
      const kind: SiteFeatureKind = payload.measureKind || "note";
      const geometry = geometryFromShape(
        payload.type,
        (payload.coordinates || []).map(Number),
      );
      if (!geometry) {
        notify.error("That shape has no usable coordinates.");
        return;
      }
      const value =
        kind === "measure_area"
          ? payload.areaSquareMeters
          : kind === "measure_perimeter"
            ? payload.perimeterMeters
            : kind === "measure_distance"
              ? payload.lengthMeters
              : null;
      const color =
        typeof payload.style?.color === "string" &&
        /^#[0-9a-f]{3,8}$/i.test(payload.style.color)
          ? payload.style.color
          : null;
      setIsSaving(true);
      try {
        await siteFeatures.create({
          kind,
          source: "2d",
          geometry,
          value: Number.isFinite(value) ? Number(value.toFixed(2)) : null,
          unit: isMeasureKind(kind) ? (kind === "measure_area" ? "m2" : "m") : null,
          label: (payload.title || payload.label || "").slice(0, 200) || null,
          description: payload.description?.slice(0, 2000) || null,
          color,
          properties: {
            icon: payload.icon || payload.iconType || undefined,
          },
        });
        showToast(
          isMeasureKind(kind) ? "Measurement saved" : "Annotation added",
          "success",
        );
      } catch (err: any) {
        console.error("Failed to save site feature", err);
        showToast(
          err.response?.status === 401
            ? "Your session has expired. Please refresh the page."
            : apiErrorMessage(
                err,
                isMeasureKind(kind)
                  ? "Could not save the measurement."
                  : "Could not save the annotation.",
              ),
          "warning",
        );
      } finally {
        setIsSaving(false);
      }
    },
    [siteFeatures, showToast, notify],
  );

  const handleDeleteAnnotation = useCallback(
    async (annId: string) => {
      if (tempMeasurements.some((t) => t.id === annId)) {
        setTempMeasurements((prev) => prev.filter((t) => t.id !== annId));
        return;
      }
      setPendingDeleteId(annId);
    },
    [tempMeasurements],
  );

  const confirmDeleteAnnotation = useCallback(async () => {
    if (!pendingDeleteId) return;
    const feature = siteFeatures.features.find((f) => f.id === pendingDeleteId);
    const name = feature?.label || (feature ? KIND_LABELS[feature.kind] : "Item");
    setIsDeletingFeature(true);
    try {
      await siteFeatures.remove(pendingDeleteId);
      showToast(`"${name}" deleted`, "success");
      setPendingDeleteId(null);
    } catch (err) {
      console.error("Failed to delete site feature", err);
      showToast(
        apiErrorMessage(err, "Could not delete it. You can only delete items you created."),
        "warning",
      );
    } finally {
      setIsDeletingFeature(false);
    }
  }, [pendingDeleteId, siteFeatures, showToast]);

  /** Measurement finished on the map: name it and save, or keep it local. */
  const handleAnnotationReady = useCallback(
    (pending: any) => {
      if (pending.warning) notify.warning(pending.warning);
      if (pending.measureKind && !canSaveFeatures) {
        const value =
          pending.measureKind === "measure_area"
            ? pending.areaSquareMeters
            : pending.lengthMeters;
        setTempMeasurements((prev) => [
          ...prev,
          {
            id: `tmp-${Date.now()}`,
            kind: pending.measureKind,
            type: pending.type,
            coordinates: pending.coordinates,
            value,
            title: pending.title,
            createdAt: new Date().toISOString(),
          },
        ]);
        measureSourceRef.current.clear();
        setShowMeasureList(true);
        return;
      }
      setPendingAnnotation(pending);
    },
    [canSaveFeatures, notify],
  );

  const drawing = useMapInteractions({
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
    onAnnotationReady: handleAnnotationReady,
    onSketchPoints: setSketchPoints,
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
    hiddenAnnotationGroups,
    showBuildingAreas,
    showSiteAnnotations,
  });

  const { flyToFeature, exportPng } = useMapMethods({
    mapRef,
    selectedFeatureRef: mapSelectedFeatureRef,
    setSelectedFeatureName,
  });

  useReportIndicators({
    mapRef,
    mapReady,
    schoolId: school.id,
    schoolBuildings,
    showIndicators: showReportIndicators,
    refreshKey: reportRefreshKey,
    onBuildingClick: useCallback(
      (buildingId: string) => {
        const b = schoolBuildings.find((sb) => sb.id === buildingId);
        if (!b) return;
        setActiveBlock(b);
        setIsBlockInspectorOpen(true);
        setBlockInspectorInitialTab("reporting");
        if (b.geolocation?.latitude && b.geolocation?.longitude) {
          const coord = fromLonLat([
            Number(b.geolocation.longitude),
            Number(b.geolocation.latitude),
          ]);
          blockOverlayRef.current?.setPosition(coord);
          mapRef.current
            ?.getView()
            .animate({ center: coord, zoom: 21, duration: 600 });
        }
      },
      [schoolBuildings],
    ),
  });

  useSchoolLocationEditor({
    mapRef,
    mapReady,
    active: locationEditActive && canSetLocation,
    initialLonLat: originalLonLat,
    onChange: setLocationDraft,
    isDrawingRef,
  });

  // Reset the draft whenever the tool is closed.
  useEffect(() => {
    if (!locationEditActive) {
      setLocationDraft(null);
      setSavingLocation(false);
    }
  }, [locationEditActive]);

  // Block non-permitted users from entering the tool at all.
  useEffect(() => {
    if (locationEditActive && !canSetLocation) {
      setActiveTool("none");
      notify.error("You don't have permission to change the school location.");
    }
  }, [locationEditActive, canSetLocation, notify]);

  const handleSaveLocation = useCallback(async () => {
    if (!locationDraft) return;
    const [lng, lat] = locationDraft;
    setSavingLocation(true);
    try {
      const round = (n: number) => Number(n.toFixed(7));
      await api.patch(`/schools/${school.id}`, {
        latitude: round(lat),
        longitude: round(lng),
      });
      onUpdateSchool?.({ latitude: round(lat), longitude: round(lng) });
      notify.success("School location updated.");
      setActiveTool("none");
      mapRef.current?.getView().animate({
        center: fromLonLat([lng, lat]),
        duration: 500,
      });
    } catch (err) {
      console.error("Failed to update school location", err);
      const message = (
        err as { response?: { data?: { message?: string | string[] } } }
      ).response?.data?.message;
      notify.error(
        Array.isArray(message)
          ? message.join("\n")
          : message || "Please try again.",
        { title: "Failed to update location" },
      );
    } finally {
      setSavingLocation(false);
    }
  }, [locationDraft, school.id, onUpdateSchool, notify, mapRef]);

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
    if (!school?.id) return;
    const lat = Number(activeBlock?.geolocation?.latitude);
    const lng = Number(activeBlock?.geolocation?.longitude);
    window.open(
      viewerLink("3d", school.id, {
        schoolName: school?.name,
        buildingId: activeBlock?.id ?? null,
        lat: Number.isFinite(lat) && lat ? lat : null,
        lng: Number.isFinite(lng) && lng ? lng : null,
      }),
      "_blank",
    );
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
        if (isNew) setDrawerBuilding(null);
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
      showToast(apiErrorMessage(err, "Could not save the building."), "warning");
    } finally {
      setIsSaving(false);
    }
  };
  const handleDeleteBuilding = async (id: string) => {
    const deletedName =
      schoolBuildings.find((b) => b.id === id)?.buildingName || "Building";
    try {
      await api.delete(`/schools/buildings/${id}`);
      setSchoolBuildings((prev) => prev.filter((b) => b.id !== id));
      setHookBuildings((prev) => prev.filter((b) => b.id !== id));
      if (activeBlock?.id === id) {
        setIsBlockInspectorOpen(false);
        setActiveBlock(null);
      }
      showToast(`Building "${deletedName}" deleted`, "success");
    } catch (err: any) {
      console.error("Failed to delete building", err);
      showToast(apiErrorMessage(err, "Could not delete the building."), "warning");
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
    if (!initialBuilding || schoolBuildings.length === 0 || !mapReady) return;
    const b = schoolBuildings.find((sb) => sb.id === initialBuilding);
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
  }, [initialBuilding, schoolBuildings, mapReady]);

  // Deep link with only a coordinate (e.g. the 3D camera target).
  useEffect(() => {
    if (!mapReady || initialBuilding || deepLink.lat == null || deepLink.lng == null) return;
    const t = setTimeout(() => {
      mapRef.current?.getView().animate({
        center: fromLonLat([deepLink.lng as number, deepLink.lat as number]),
        zoom: 20,
        duration: 800,
      });
    }, 1000);
    return () => clearTimeout(t);
  }, [mapReady, initialBuilding, deepLink, mapRef]);

  // ── Selection sync with an open 3D viewer tab (WS5.6) ────────────────────
  const remoteSelectionRef = useRef(false);
  const firstSelectionRef = useRef(true);
  useEffect(() => {
    if (firstSelectionRef.current) {
      firstSelectionRef.current = false;
      return;
    }
    if (remoteSelectionRef.current) {
      remoteSelectionRef.current = false;
      return;
    }
    broadcastSelection({
      schoolId: school.id,
      buildingId: activeBlock?.id ?? null,
      from: "2d",
    });
  }, [activeBlock?.id, school.id]);
  const schoolBuildingsRef = useRef(schoolBuildings);
  useEffect(() => {
    schoolBuildingsRef.current = schoolBuildings;
  }, [schoolBuildings]);
  useEffect(
    () =>
      onSelection(school.id, "2d", (buildingId) => {
        const b = buildingId
          ? schoolBuildingsRef.current.find((x) => x.id === buildingId)
          : null;
        if (!b && buildingId) return;
        remoteSelectionRef.current = true;
        setActiveBlock(b ?? null);
        setIsBlockInspectorOpen(!!b);
        if (b?.geolocation?.latitude && b?.geolocation?.longitude) {
          const coord = fromLonLat([
            Number(b.geolocation.longitude),
            Number(b.geolocation.latitude),
          ]);
          blockOverlayRef.current?.setPosition(coord);
          mapRef.current
            ?.getView()
            .animate({ center: coord, zoom: 21, duration: 600 });
        }
      }),
    [school.id, mapRef],
  );

  // ── Measuring: shortcuts + list (WS4) ───────────────────────────────────
  const selectTool2D = useCallback(
    (id: ViewerToolId) => {
      if (!canUseTool(id, hasPermission)) return;
      if (id === "navigate") {
        setMeasurementMode("none");
        setActiveTool("none");
        measureSourceRef.current.clear();
        return;
      }
      if (id === "annotate") {
        setMeasurementMode("none");
        setActiveTool("annotate_point");
        return;
      }
      const mode = (
        { measure_distance: "distance", measure_area: "area", measure_perimeter: "perimeter" } as const
      )[id as "measure_distance" | "measure_area" | "measure_perimeter"];
      if (!mode) return;
      setActiveTool("none");
      measureSourceRef.current.clear();
      setMeasurementMode((prev) => (prev === mode ? "none" : mode));
    },
    [hasPermission],
  );

  useEffect(() => {
    if (activeTab !== "map" || pickerMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || pendingAnnotation || drawerOpen) return;
      if (e.key === "?") {
        setShowHelp((v) => !v);
        return;
      }
      const tool = toolForKey(e, "2d");
      if (tool) {
        e.preventDefault();
        selectTool2D(tool);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeTab, pickerMode, pendingAnnotation, drawerOpen, selectTool2D]);

  const measureRows = useMemo<MeasurementRow[]>(
    () => [
      ...siteFeatures.features.map((f): MeasurementRow => {
        const can = canChangeFeature(f.createdBy);
        return {
          id: f.id,
          name: f.label || KIND_LABELS[f.kind],
          kind: f.kind,
          value: formatFeatureValue(f, unit),
          secondary:
            f.kind === "measure_area" &&
            typeof f.properties?.surfaceArea === "number"
              ? `Surface (sloped, 3D): ${formatMeasureArea(f.properties.surfaceArea, "3d", unit)}`
              : null,
          source: f.source,
          createdByName: f.createdByName,
          createdAt: f.createdAt,
          saved: true,
          canEdit: can,
          canDelete: can,
          color: f.color,
        };
      }),
      ...tempMeasurements.map(
        (t): MeasurementRow => ({
          id: t.id,
          name: t.title,
          kind: t.kind,
          value:
            t.kind === "measure_area"
              ? formatMeasureArea(t.value, "2d", unit)
              : formatMeasureLength(t.value, "2d", unit),
          source: "2d",
          createdAt: t.createdAt,
          saved: false,
          canEdit: true,
          canDelete: true,
          color: "#f59e0b",
        }),
      ),
    ],
    [siteFeatures.features, tempMeasurements, unit, canChangeFeature],
  );

  const flyToFeatureId = useCallback(
    (id: string) => {
      const f = siteFeatures.features.find((x) => x.id === id);
      let c: [number, number] | null = f ? featureCentroid(f) : null;
      if (!c) {
        const t = tempMeasurements.find((x) => x.id === id);
        if (t && t.coordinates.length >= 2) c = [t.coordinates[0], t.coordinates[1]];
      }
      if (!c) return;
      setActiveTab("map");
      mapRef.current
        ?.getView()
        .animate({ center: fromLonLat(c), zoom: 20, duration: 800 });
    },
    [siteFeatures.features, tempMeasurements, mapRef],
  );

  const renameFeature = useCallback(
    async (id: string, name: string) => {
      if (tempMeasurements.some((t) => t.id === id)) {
        setTempMeasurements((prev) =>
          prev.map((t) => (t.id === id ? { ...t, title: name } : t)),
        );
        return;
      }
      try {
        await siteFeatures.update(id, { label: name });
        notify.success(`Renamed to "${name}"`);
      } catch (err) {
        notify.error(apiErrorMessage(err, "Could not rename it."));
      }
    },
    [siteFeatures, tempMeasurements, notify],
  );

  const deleteFeatureNoConfirm = useCallback(
    async (id: string) => {
      if (tempMeasurements.some((t) => t.id === id)) {
        setTempMeasurements((prev) => prev.filter((t) => t.id !== id));
        return;
      }
      const feature = siteFeatures.features.find((f) => f.id === id);
      try {
        await siteFeatures.remove(id);
        notify.success(
          `"${feature?.label || (feature ? KIND_LABELS[feature.kind] : "Item")}" deleted`,
        );
      } catch (err) {
        notify.error(
          apiErrorMessage(err, "Could not delete it. You can only delete items you created."),
        );
      }
    },
    [siteFeatures, tempMeasurements, notify],
  );

  const clearAllFeatures = useCallback(async () => {
    setTempMeasurements([]);
    const deletable = siteFeatures.features.filter((f) =>
      canChangeFeature(f.createdBy),
    );
    const res = await Promise.allSettled(
      deletable.map((f) => siteFeatures.remove(f.id)),
    );
    const failed = res.filter((r) => r.status === "rejected").length;
    if (failed) notify.error(`${failed} item(s) could not be deleted.`);
    else notify.success("Measurements cleared");
  }, [siteFeatures, canChangeFeature, notify]);

  const exportFeaturesCsv = useCallback(async () => {
    try {
      const slug = (school.name || school.id).replace(/[^a-zA-Z0-9]+/g, "_");
      await downloadSiteFeaturesCsv(school.id, `${slug}_site_features.csv`);
      notify.success("Site features exported as CSV");
    } catch (err) {
      notify.error(apiErrorMessage(err, "Export failed. Please try again."));
    }
  }, [school.id, school.name, notify]);

  // Animated fly-to on first reveal of the map tab: recenter on the school's
  // current coordinate (falls back to the existing view centre when unset).
  useEffect(() => {
    if (activeTab !== "map" || !mapReady) return;
    if (mapTabAnimatedRef.current) return;
    mapTabAnimatedRef.current = true;

    const view = mapRef.current?.getView();
    if (!view) return;

    // When a KMZ/GeoTIFF/KML overlay is present the loader has already fitted
    // the view to where the map is actually drawn — re-fit to that same extent
    // so the school stays centred regardless of any in-flight animation.
    if (overlayExtentRef.current) {
      view.fit(overlayExtentRef.current, {
        padding: [80, 80, 120, 80],
        duration: 800,
        maxZoom: 20,
      });
      return;
    }

    // Otherwise recenter on the school's own coordinate.
    const target = originalLonLat ? fromLonLat(originalLonLat) : view.getCenter();

    view.setZoom(15);
    setTimeout(() => {
      view.animate({
        ...(target ? { center: target } : {}),
        zoom: 19,
        duration: 1000,
        easing: (t: number) => 1 - Math.pow(1 - t, 3),
      });
    }, 80);
  }, [activeTab, mapReady, originalLonLat]);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-50 dark:bg-[#0f1117] w-full h-full">
      <DeleteConfirmationModal
        isOpen={!!pendingDeleteId}
        onClose={() => !isDeletingFeature && setPendingDeleteId(null)}
        onConfirm={confirmDeleteAnnotation}
        isLoading={isDeletingFeature}
        title="Delete this item?"
        description="It will be removed for everyone viewing this school."
        confirmLabel="Delete"
      />

      {/* ── Back button + school name (top-left, hidden in picker mode) ──── */}
      {!pickerMode && (
        <div className="absolute top-3 left-3 z-[45] flex items-center gap-2 pointer-events-auto">
          <button
            onClick={handleClose}
            aria-label="Back to school"
            className="flex items-center justify-center w-10 h-10 rounded-full bg-white dark:bg-card/10 dark:hover:bg-blue-600 border border-slate-200 dark:border-white/6 text-slate-900 dark:text-white hover:bg-slate-50 transition-all group active:scale-95 shadow-none"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" aria-hidden />
          </button>
          <div className="hidden lg:flex items-center gap-1.5 h-8 px-3 rounded-full bg-white/40 dark:bg-card/20 backdrop-blur-2xl border border-slate-200 dark:border-white/6 max-w-45">
            <span className="text-[13px] font-bold text-slate-600 dark:text-white/60 truncate">
              {school.name}
            </span>
            {school.code && (
              <span className="text-[10px] font-mono text-slate-400 dark:text-white/25 shrink-0 hidden sm:block">
                {school.code}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Floating pill tabs (top-center, hidden in picker mode) ────────── */}
      {!pickerMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
          <div className="flex items-center gap-0.5 bg-white/60 dark:bg-card/50 backdrop-blur-2xl border border-slate-200 dark:border-white/4 rounded-full px-1 py-1">
            {(
              [
                { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
                { id: "details", icon: FileText, label: "Details" },
                { id: "map", icon: MapIcon, label: "2D Map" },
                { id: "3d", icon: Box, label: "3D Map" },
              ] as const
            ).map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                aria-label={label}
                className={cn(
                  "flex items-center gap-1.5 px-3 sm:px-3.5 h-7 rounded-full text-[10px] font-bold tracking-wide transition-all",
                  activeTab === id
                    ? "bg-primary text-white"
                    : "text-slate-600 dark:text-white/80 hover:text-primary dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5",
                )}
              >
                <Icon className="w-3 h-3 shrink-0" aria-hidden />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Dashboard Overlay ─────────────────────────────────────────────── */}
      {activeTab === "dashboard" && (
        <div className="absolute inset-0 z-40 bg-slate-50/95 dark:bg-gray-950/90 backdrop-blur-sm pointer-events-auto overflow-y-auto overflow-x-hidden custom-scrollbar">
          <SchoolDecisionDashboard
            id={school.id}
            standalone={false}
            onUpdateSchool={onUpdateSchool}
            onBuildingClick={(building) => {
              const b = schoolBuildings.find((sb) => sb.id === building.id);
              if (!b) return;
              setActiveTab("map");
              setActiveBlock(b);
              setIsBlockInspectorOpen(true);
              setBlockInspectorInitialTab("reporting");
              if (b.geolocation?.latitude && b.geolocation?.longitude) {
                setTimeout(() => {
                  const coord = fromLonLat([
                    Number(b.geolocation.longitude),
                    Number(b.geolocation.latitude),
                  ]);
                  blockOverlayRef.current?.setPosition(coord);
                  mapRef.current
                    ?.getView()
                    .animate({ center: coord, zoom: 21, duration: 800 });
                }, 300);
              }
            }}
          />
        </div>
      )}

      {/* ── 3D View Panel ─────────────────────────────────────────────────── */}
      {activeTab === "3d" && (
        <div className="absolute inset-0 z-40 bg-slate-50/95 dark:bg-gray-950/90 backdrop-blur-sm pointer-events-auto overflow-hidden">
          <School3DView
            schoolId={school.id}
            schoolName={school.name}
            onClose={() => setActiveTab("map")}
          />
        </div>
      )}

      {/* ── Details Panel ─────────────────────────────────────────────────── */}
      {activeTab === "details" && (
        <div className="absolute inset-0 z-40 bg-slate-50/95 dark:bg-gray-950/80 backdrop-blur-sm pointer-events-auto overflow-y-auto overflow-x-hidden custom-scrollbar">
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
                <div className="max-w-55 bg-white/90 dark:bg-[#0f1117]/95 backdrop-blur-xl border border-slate-200 dark:border-white/6 rounded-2xl px-3 py-2.5 space-y-1.5">
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
                    <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-wider leading-none truncate">
                      {ann.title || ann.label}
                    </p>
                  </div>
                  {ann.description && (
                    <p className="text-[9px] text-slate-500 dark:text-white/50 font-medium leading-snug">
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
        <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-3 md:px-6 py-2 md:py-3 bg-primary/90 backdrop-blur-md border-b border-white/6 transition-all">
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
                className="px-3 md:px-4 py-1.5 md:py-2 rounded-xl bg-white text-primary font-black text-[9px] md:text-xs uppercase tracking-widest hover:bg-white/90 transition-all border border-slate-200 dark:border-transparent shrink-0"
              >
                ✓ Confirm
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 md:p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-white shrink-0"
                aria-label="Cancel building selection"
              >
                <X className="w-3.5 h-3.5 md:w-4 md:h-4" aria-hidden />
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

      {/* ── Layer Visibility Toggle Bar ───────────────────────────────────── */}
      {!pickerMode && activeTab === "map" && (
        <div
          className={cn(
            "absolute bottom-32 md:bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto",
            // Phones: the buildings / GIS panels open as bottom sheets under this bar.
            (showBuildingsList || showNavigator) && "hidden md:block",
          )}
        >
          <div className="flex items-center gap-1 px-1.5 py-1.5 rounded-full bg-white/80 dark:bg-[#0f1117]/80 backdrop-blur-xl border border-slate-200 dark:border-white/6 shadow-lg">
            {(
              [
                {
                  key: "reports",
                  label: "Report Alerts",
                  icon: AlertTriangle,
                  active: showReportIndicators,
                  onToggle: () => setShowReportIndicators((v) => !v),
                  activeClass:
                    "bg-rose-500/15 border-rose-500/30 text-rose-500",
                },
                {
                  key: "buildings",
                  label: "Building Areas",
                  icon: MapPin,
                  active: showBuildingAreas,
                  onToggle: () => setShowBuildingAreas((v) => !v),
                  activeClass:
                    "bg-blue-500/15 border-blue-500/20 text-blue-500",
                },
                {
                  key: "annotations",
                  label: "Annotations",
                  icon: MapIcon,
                  active: showSiteAnnotations,
                  onToggle: () => setShowSiteAnnotations((v) => !v),
                  activeClass:
                    "bg-emerald-500/15 border-emerald-500/30 text-emerald-500",
                },
              ] as const
            ).map(
              ({ key, label, icon: Icon, active, onToggle, activeClass }) => (
                <button
                  key={key}
                  onClick={onToggle}
                  aria-label={active ? `Hide ${label}` : `Show ${label}`}
                  aria-pressed={active}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-medium transition-all active:scale-95",
                    active
                      ? activeClass
                      : "border-transparent text-slate-400 dark:text-white/30 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-600 dark:hover:text-white/50",
                  )}
                >
                  <Icon className="w-3 h-3 shrink-0" aria-hidden />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ),
            )}
          </div>
        </div>
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
        canSetLocation={canSetLocation}
        canMeasure={canMeasure}
        canAnnotate={canSaveFeatures}
        canCreateBlock={canCreateBlock}
        showMeasureList={showMeasureList}
        setShowMeasureList={setShowMeasureList}
        measureCount={measureRows.length}
        onHelp={() => setShowHelp(true)}
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

      {locationEditActive && canSetLocation && (
        <SchoolLocationEditorPanel
          draft={locationDraft}
          original={originalLonLat}
          saving={savingLocation}
          onSave={handleSaveLocation}
          onCancel={() => setActiveTool("none")}
        />
      )}

      <MapHud
        school={school}
        setShowBasicInfo={setShowBasicInfo}
        isTileLoading={isTileLoading}
        decodingCount={decodingCount}
        isLoading={isLoading}
        currentLat={currentLat}
        currentLng={currentLng}
        infoFeature={infoFeature}
        onCloseInfo={() => setInfoFeature(null)}
        selectedBuilding={activeBlock}
      />

      {activeTab === "map" && measurementMode !== "none" && (
        <ActiveToolBanner
          tool={MODE_TOOL_2D[measurementMode]}
          liveValue={measureResult}
          accuracy={accuracyLabel("2d")}
          notSaved={!canSaveFeatures}
          pointCount={sketchPoints}
          onUndo={drawing.undoLastPoint}
          onFinish={drawing.finishDrawing}
          onCancel={drawing.cancelDrawing}
        />
      )}

      {showMeasureList && activeTab === "map" && (
        <MeasurementListPanel
          rows={measureRows}
          unit={unit}
          onUnitChange={setUnit}
          onFlyTo={flyToFeatureId}
          onRename={renameFeature}
          onDelete={deleteFeatureNoConfirm}
          onClearAll={clearAllFeatures}
          onExport={canExport ? exportFeaturesCsv : undefined}
          onClose={() => setShowMeasureList(false)}
          footnote={`2D accuracy ${accuracyLabel("2d")} · areas are plan (flat) area on the WGS84 ellipsoid.`}
        />
      )}

      {showHelp && <ViewerHelpModal setShowHelp={setShowHelp} viewer="2d" />}

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
          hiddenAnnotationGroups={hiddenAnnotationGroups}
          onToggleAnnotationGroup={handleToggleAnnotationGroup}
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
            "fixed inset-x-0 bottom-0 z-70 transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] pointer-events-none", // Mobile bottom sheet
            "md:absolute md:inset-y-0 md:right-0 md:bottom-auto md:w-125 md:z-70", // Desktop sidebar (Right side)
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
                initialTab={blockInspectorInitialTab}
                onClose={() => {
                  setIsBlockInspectorOpen(false);
                  setBlockInspectorInitialTab("details");
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
                    // Let the caller (media tab) report the failure.
                    throw error;
                  }
                }}
                onReportStatusChange={() => setReportRefreshKey((k) => k + 1)}
                onAddAnnotation={() => setActiveTool("annotate_point")}
                onUploadMedia={() => {}}
                on3DView={handle3DView}
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
          <div className="p-6 rounded-4xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/4 space-y-4 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center mx-auto mb-2 border border-slate-200 dark:border-white/6">
              <MapIcon className="w-8 h-8 text-amber-500/40" />
            </div>
            <p className="text-xs font-bold text-slate-600 dark:text-white/60 leading-relaxed italic">
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
                className="rounded-full font-black uppercase tracking-widest text-[10px] h-11 text-slate-400 dark:text-white opacity-60 hover:opacity-100"
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
