import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import "ol/ol.css";
import Overlay from "ol/Overlay";
import VectorSource from "ol/source/Vector";
import { fromLonLat } from "ol/proj";
import { framePadding, pickFrame } from "./2dviewercomponents/frame";
import { createMapHudStore } from "./2dviewercomponents/map-hud-store";
import { RWANDA_CENTER, schoolPoint } from "../lib/school-location";
import { connectSocket } from "../lib/socket";
import { useSchoolsStore } from "../store/schoolsStore";
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
import { useSchoolReports } from "./2dviewercomponents/hooks/useSchoolReports";
import { MediaViewer } from "./2dviewercomponents/media/MediaViewer";
import { MediaGallery } from "./2dviewercomponents/media/MediaGallery";
import { collectMedia, collectReportMedia, type GalleryItem } from "./2dviewercomponents/media/media-utils";
import { useBuildingPanelAccess } from "./2dviewercomponents/hooks/useBuildingPanelAccess";
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
  type BuildingPanelTab,
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
import { buildingPayloadFields } from "../lib/buildingPayload";

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
      // The school's point, or the middle of Rwanda when it has none —
      // never 0,0 (see lib/school-location.ts).
      fallbackLocation: schoolPoint(school) ?? RWANDA_CENTER,
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

  // Deep link from the 3D viewer: ?view=map&building=<id>&lat=&lng= (WS5.6).
  const deepLink = useMemo(
    () => readViewerDeepLink(window.location.search),
    [],
  );
  const initialBuilding = initialBuildingId ?? deepLink.buildingId ?? undefined;

  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Initialising map…");
  const [loadingProgress, setLoadingProgress] = useState(0);
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
  // Cursor position + imagery loading: an external store, so mouse moves and
  // image decodes don't re-render this whole viewer (map-hud-store.ts).
  const [hud] = useState(() => createMapHudStore(fallbackLocation));
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
  >(() =>
    deepLink.view === "3d"
      ? "3d"
      : deepLink.view === "map" || deepLink.buildingId || initialBuildingId
        ? "map"
        : "dashboard",
  );
  /** Building the 3D tab selects and highlights when it opens. */
  const [focus3d, setFocus3d] = useState<string | null>(() =>
    deepLink.view === "3d" ? deepLink.buildingId : null,
  );

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSurveyModalOpen, setIsSurveyModalOpen] = useState(false);
  const [isMissingMapModalOpen, setIsMissingMapModalOpen] = useState(false);
  const [showReportIndicators, setShowReportIndicators] = useState(true);
  // Which tab the building panel opens on; `n` re-keys it on every open.
  const [panel, setPanel] = useState<{ tab: BuildingPanelTab; reportId: string | null; n: number }>(() => ({
    tab: deepLink.tab ?? "media",
    reportId: deepLink.reportId,
    n: 0,
  }));
  const [gallery, setGallery] = useState<{ buildingId: string | null } | null>(null);
  const [viewer, setViewer] = useState<{ items: GalleryItem[]; index: number } | null>(null);
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
  const {
    canCreateReport,
    canDecide: canDecideReport,
    canOpenReview,
  } = useBuildingPanelAccess();

  // Every report of this school: map badges, building list and panel share it.
  const schoolReports = useSchoolReports(school?.id);
  const openReportsOf = useCallback(
    (buildingId: string) => schoolReports.counts.get(String(buildingId))?.open ?? 0,
    [schoolReports.counts],
  );

  /** Open the building panel on a tab (always a fresh panel). */
  const showPanel = useCallback(
    (tab: BuildingPanelTab = "media", reportId: string | null = null) => {
      setIsBlockInspectorOpen(true);
      setPanel((p) => ({ tab, reportId, n: p.n + 1 }));
    },
    [],
  );
  /** For code that only opens/closes the panel (map clicks): opens on Media. */
  const openInspector = useCallback(
    (open: boolean) => (open ? showPanel("media") : setIsBlockInspectorOpen(false)),
    [showPanel],
  );
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
  // The location saved in this session wins over the (possibly stale) prop:
  // not every host passes onUpdateSchool back down.
  const [savedLonLat, setSavedLonLat] = useState<[number, number] | null>(null);
  const originalLonLat = useMemo<[number, number] | null>(() => {
    if (savedLonLat) return savedLonLat;
    const p = schoolPoint(school);
    return p ? [p.lng, p.lat] : null;
  }, [savedLonLat, school]);

  // The location can change elsewhere (a KMZ upload finishing, another
  // user): follow it live, and refresh the cached school list.
  useEffect(() => {
    if (!school?.id) return;
    let socket: ReturnType<typeof connectSocket> | null = null;
    try {
      socket = connectSocket();
      const room = `school:${school.id}`;
      socket.on("connect", () => socket?.emit("join", room));
      socket.on("school:updated", (p: { schoolId?: string; latitude?: number; longitude?: number }) => {
        if (p?.schoolId !== school.id) return;
        const pt = schoolPoint(p);
        if (pt) {
          setSavedLonLat([pt.lng, pt.lat]);
          useSchoolsStore.getState().invalidateAllSchools();
        }
      });
    } catch {
      /* sockets unavailable: the page still works */
    }
    return () => {
      try {
        socket?.emit("leave", `school:${school.id}`);
        socket?.disconnect();
      } catch {
        /* ignore */
      }
    };
  }, [school?.id]);
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

  // Prompt for missing map data only when the user is on the 2D map (not over
  // the dashboard), and only once per school — it used to reopen on every
  // parent update after being dismissed.
  const missingMapPromptedFor = useRef<string | null>(null);
  useEffect(() => {
    const hasMapData =
      school.kmz2dFilePath ||
      school.kmzFilePath ||
      school.geojsonContent ||
      tifFilePath ||
      school.tifFilePath;
    if (
      !hasMapData &&
      !isLoading &&
      activeTab === "map" &&
      missingMapPromptedFor.current !== school.id
    ) {
      missingMapPromptedFor.current = school.id;
      setIsMissingMapModalOpen(true);
    }
  }, [school, tifFilePath, isLoading, activeTab]);

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
    onPointer: hud.setPointer,
    setActiveBlock,
    setIsBlockInspectorOpen: openInspector,
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
    setIsTileLoading: hud.setTilesLoading,
    setDecodingCount: hud.setDecoding,
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
    schoolBuildings,
    counts: schoolReports.counts,
    showIndicators: showReportIndicators,
    onBuildingClick: useCallback(
      (buildingId: string) => {
        const b = schoolBuildings.find((sb) => String(sb.id) === buildingId);
        if (!b) return;
        setActiveBlock(b);
        showPanel("reporting");
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
      [schoolBuildings, showPanel],
    ),
  });

  /**
   * Frame the school compound (frame.ts): its boundary, site-map outline or
   * buildings, else its own point — clear of the header, the tool rail and
   * the bottom controls. Used on first load and by "Reset view".
   */
  const frameSchool = useCallback(
    (animate = true) => {
      const map = mapRef.current;
      const view = map?.getView();
      if (!map || !view) return;
      map.updateSize();
      const frame = pickFrame({
        boundaries: school.boundaries,
        kmlFeatures: kmlLayerRef.current?.getSource?.()?.getFeatures?.() ?? [],
        buildings: schoolBuildings.map((b) => ({
          lat: Number(b.geolocation?.latitude),
          lng: Number(b.geolocation?.longitude),
        })),
        point: originalLonLat,
        imagery: overlayExtentRef.current,
      });
      if (!frame) return;
      const duration = animate ? 700 : 0;
      const padding = framePadding(
        window.innerWidth,
        document.querySelector('nav[aria-label="Map tools"]')?.getBoundingClientRect(),
      );
      if ("extent" in frame) {
        view.fit(frame.extent, { padding, duration, maxZoom: 20 });
      } else {
        // A point: centre it in the clear area, not under the rail.
        const [top, right, bottom, left] = padding;
        const res = view.getResolutionForZoom(frame.zoom);
        const center = [
          frame.center[0] + ((right - left) / 2) * res,
          // Map y grows upwards: a clear area raised by the bottom bar moves the centre down.
          frame.center[1] + ((top - bottom) / 2) * res,
        ];
        if (animate) view.animate({ center, zoom: frame.zoom, duration });
        else {
          view.setZoom(frame.zoom);
          view.setCenter(center);
        }
      }
    },
    [mapRef, school.boundaries, schoolBuildings, originalLonLat],
  );
  const goHome = useCallback(() => frameSchool(true), [frameSchool]);

  // ── Media across buildings (gallery + fullscreen viewer) ────────────────
  // Building photos and photos attached to reports.
  const allMedia = useMemo(
    () => [...collectMedia(schoolBuildings), ...collectReportMedia(schoolReports.reports, schoolBuildings)],
    [schoolBuildings, schoolReports.reports],
  );

  /** Fullscreen viewer over every building's media, starting at one file. */
  const openMedia = useCallback(
    (buildingId: string, index: number) => {
      const start = allMedia.findIndex((m) => m.source === "building" && m.buildingId === buildingId && m.index === index);
      if (start >= 0) setViewer({ items: allMedia, index: start });
    },
    [allMedia],
  );

  /** Select a building, open its panel on a tab and fly to it. */
  const focusBuilding = useCallback(
    (buildingId: string, tab: BuildingPanelTab, reportId: string | null = null) => {
      const b = schoolBuildings.find((sb) => String(sb.id) === String(buildingId));
      if (!b) return;
      setActiveTab("map");
      setActiveBlock(b);
      showPanel(tab, reportId);
      if (b.geolocation?.latitude && b.geolocation?.longitude) {
        const coord = fromLonLat([Number(b.geolocation.longitude), Number(b.geolocation.latitude)]);
        blockOverlayRef.current?.setPosition(coord);
        mapRef.current?.getView().animate({ center: coord, zoom: 21, duration: 700 });
      }
    },
    [schoolBuildings, showPanel, mapRef],
  );

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
      setSavedLonLat([round(lng), round(lat)]);
      useSchoolsStore.getState().invalidateAllSchools();
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

  /** Open the 3D tab (same browser tab) with the selected building highlighted. */
  const handle3DView = useCallback(() => {
    setFocus3d(activeBlock?.id ? String(activeBlock.id) : null);
    // The 3D view has its own building panel.
    setIsBlockInspectorOpen(false);
    setActiveTab("3d");
  }, [activeBlock]);

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
        // Blank fields → null (not recorded), never 0 or a default.
        ...buildingPayloadFields(data),
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
        // Deep links can name a tab and a report (e.g. "On the map" from a review).
        showPanel(deepLink.tab ?? "media", deepLink.reportId);
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
  }, [initialBuilding, schoolBuildings, mapReady, deepLink, showPanel]);

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
        openInspector(!!b);
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
    [school.id, mapRef, openInspector],
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

  // First view: frame the school compound once the site map has loaded —
  // one framing, no competing fly-ins. Deep links to a building or a
  // coordinate frame themselves.
  const framedRef = useRef(false);

  // Whole-map loading (basemap, labels, overlays, vectors) for the HUD pill.
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    const start = () => hud.setMapLoading(true);
    const end = () => hud.setMapLoading(false);
    map.on("loadstart", start);
    map.on("loadend", end);
    return () => {
      map.un("loadstart", start);
      map.un("loadend", end);
      hud.setMapLoading(false);
    };
  }, [mapReady, mapRef, hud]);

  useEffect(() => {
    if (activeTab !== "map" || !mapReady || isLoading || framedRef.current) return;
    if (initialBuilding || (deepLink.lat != null && deepLink.lng != null)) {
      framedRef.current = true;
      return;
    }
    // A moment for the buildings request to land, so they can shape the frame.
    const t = setTimeout(() => {
      framedRef.current = true;
      frameSchool(false);
    }, 350);
    return () => clearTimeout(t);
  }, [activeTab, mapReady, isLoading, initialBuilding, deepLink, frameSchool]);

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
            className="flex items-center justify-center w-10 h-10 rounded-full bg-white/60 dark:bg-[hsl(224_40%_7%)]/60 backdrop-blur-2xl backdrop-saturate-150 ring-1 ring-white/40 dark:ring-white/10 text-slate-900 dark:text-white hover:bg-white/80 dark:hover:bg-white/10 transition-colors group active:scale-95"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" aria-hidden />
          </button>
          <div className="hidden lg:flex items-center gap-1.5 h-8 px-3 rounded-full bg-white/60 dark:bg-[hsl(224_40%_7%)]/60 backdrop-blur-2xl backdrop-saturate-150 ring-1 ring-white/40 dark:ring-white/10 max-w-45">
            <span className="text-[13px] font-medium text-slate-800 dark:text-white/80 truncate">
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
          <div className="flex items-center gap-0.5 bg-white/60 dark:bg-[hsl(224_40%_7%)]/60 backdrop-blur-2xl backdrop-saturate-150 ring-1 ring-white/40 dark:ring-white/10 rounded-full px-1 py-1">
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
                onClick={() => (id === "3d" ? handle3DView() : setActiveTab(id))}
                aria-label={label}
                aria-current={activeTab === id ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 px-3 sm:px-3.5 h-7 rounded-full text-[11px] font-medium transition-colors",
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
              showPanel("reporting");
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
            key={focus3d ?? "school"}
            schoolId={school.id}
            schoolName={school.name}
            focusBuildingId={focus3d}
            onClose={() => setActiveTab("map")}
            on2DView={(buildingId) =>
              buildingId ? focusBuilding(buildingId, "media") : setActiveTab("map")
            }
          />
        </div>
      )}

      {/* ── Details Panel ─────────────────────────────────────────────────── */}
      {activeTab === "details" && (
        <div className="absolute inset-0 z-40 bg-slate-50/95 dark:bg-gray-950/90 backdrop-blur-sm pointer-events-auto overflow-y-auto overflow-x-hidden custom-scrollbar">
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
        // Map loading only matters on the map tab; the dashboard and details
        // tabs have their own loading states.
        isLoading={(isLoading && activeTab === "map") || isSaving}
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
          counts={schoolReports.counts}
          canEdit={canCreateBlock}
          onGallery={() => setGallery({ buildingId: null })}
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
            showPanel("media");
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
          <div role="group" aria-label="Show on the map" className="flex items-center gap-0.5 rounded-full bg-white/60 p-1 ring-1 ring-white/40 backdrop-blur-xl backdrop-saturate-150 dark:bg-[hsl(224_40%_7%)]/60 dark:ring-white/10">
            {(
              [
                {
                  key: "reports",
                  label: "Reports",
                  icon: AlertTriangle,
                  active: showReportIndicators,
                  onToggle: () => setShowReportIndicators((v) => !v),
                  count: schoolReports.counts.size,
                },
                {
                  key: "buildings",
                  label: "Buildings",
                  icon: MapPin,
                  active: showBuildingAreas,
                  onToggle: () => setShowBuildingAreas((v) => !v),
                  count: 0,
                },
                {
                  key: "annotations",
                  label: "Notes",
                  icon: MapIcon,
                  active: showSiteAnnotations,
                  onToggle: () => setShowSiteAnnotations((v) => !v),
                  count: 0,
                },
              ] as const
            ).map(({ key, label, icon: Icon, active, onToggle, count }) => (
              <button
                key={key}
                type="button"
                onClick={onToggle}
                aria-label={active ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
                aria-pressed={active}
                className={cn(
                  "relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors active:scale-95",
                  active
                    ? "bg-primary/10 text-primary dark:bg-primary/20 dark:text-blue-200"
                    : "text-slate-400 hover:bg-slate-900/5 hover:text-slate-700 dark:text-white/35 dark:hover:bg-white/8 dark:hover:text-white/70",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="hidden sm:inline">{label}</span>
                {count > 0 && active && (
                  <span className="min-w-4 rounded-full bg-primary px-1 text-center text-[10px] leading-4 tabular-nums text-white">{count}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <MapToolbar
        onClose={undefined}
        showNavigator={showNavigator}
        setShowNavigator={setShowNavigator}
        showBuildingsList={showBuildingsList}
        setShowBuildingsList={setShowBuildingsList}
        openReports={schoolReports.counts.size}
        onGallery={() => setGallery({ buildingId: null })}
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
        onHome={goHome}
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
        hud={hud}
        isLoading={isLoading}
        infoFeature={infoFeature}
        onCloseInfo={() => setInfoFeature(null)}
        selectedBuilding={activeBlock}
        onOpen3D={handle3DView}
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
            showPanel("media");
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

      {/* Building panel — bottom sheet on phones, a card on the left on desktop */}
      {!pickerMode && activeTab === "map" && (
        <div
          className={cn(
            "fixed inset-x-0 bottom-0 z-70 transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] pointer-events-none",
            // Desktop: a card on the left, below the back button / school name.
            "md:absolute md:inset-y-0 md:left-0 md:right-auto md:bottom-auto md:w-[25rem] md:p-3 md:pt-[4.75rem]",
            isBlockInspectorOpen
              ? "translate-y-0 md:translate-x-0 opacity-100"
              : "translate-y-full md:translate-y-0 md:-translate-x-full opacity-0",
          )}
        >
          {activeBlock && (
            <div className="pointer-events-auto h-full">
              <BlockInspector
                key={`${activeBlock.id}:${panel.n}`}
                building={activeBlock}
                schoolId={school?.id || ""}
                initialTab={panel.tab}
                initialReportId={panel.reportId}
                reports={schoolReports.reports.filter((r) => String(r.buildingId) === String(activeBlock.id))}
                reportsLoaded={schoolReports.loaded}
                canEditMedia={canCreateBlock}
                canCreateReport={canCreateReport}
                canOpenReview={canOpenReview}
                canDecide={canDecideReport}
                onReportPatched={schoolReports.patch}
                onReportSubmitted={() => void schoolReports.reload()}
                onOpenMedia={(index) => openMedia(String(activeBlock.id), index)}
                onOpenGallery={() => setGallery({ buildingId: String(activeBlock.id) })}
                onClose={() => {
                  setIsBlockInspectorOpen(false);
                  setTimeout(() => setActiveBlock(null), 300);
                }}
                onEdit={
                  canCreateBlock
                    ? () => {
                        setDrawerBuilding(activeBlock);
                        setDrawerOpen(true);
                        setIsBlockInspectorOpen(false);
                      }
                    : undefined
                }
                onUpdateBuilding={async (b) => {
                  const before = schoolBuildings.find((old) => old.id === b.id) ?? activeBlock;
                  try {
                    const building = b as any;
                    // Update local state first for instant feedback
                    setActiveBlock(b);
                    setSchoolBuildings((prev) =>
                      prev.map((old) => (old.id === b.id ? b : old)),
                    );

                    // The panel only edits media. Send just that: a full DTO
                    // would turn unknown floors / year built into 0.
                    await api.patch(`/schools/buildings/${b.id}`, {
                      media: building.media || [],
                    });
                  } catch (error) {
                    console.error("Failed to persist building update:", error);
                    // Undo the optimistic change; the caller (media tab) shows the error.
                    if (before) {
                      setActiveBlock(before);
                      setSchoolBuildings((prev) => prev.map((old) => (old.id === b.id ? before : old)));
                    }
                    throw error;
                  }
                }}
                on3DView={handle3DView}
              />
            </div>
          )}
        </div>
      )}

      {gallery && (
        <MediaGallery
          items={allMedia}
          initialBuildingId={gallery.buildingId}
          openReports={openReportsOf}
          onOpen={(items, index) => setViewer({ items, index })}
          onClose={() => setGallery(null)}
          onOpenBuilding={(buildingId) => {
            setGallery(null);
            focusBuilding(buildingId, "media");
          }}
        />
      )}
      {viewer && (
        <MediaViewer
          items={viewer.items}
          index={viewer.index}
          onIndexChange={(index) => setViewer((v) => (v ? { ...v, index } : v))}
          onClose={() => setViewer(null)}
          openReports={openReportsOf}
          onBuildings={(buildingId) => {
            setViewer(null);
            setGallery(null);
            focusBuilding(buildingId, "media");
            setShowBuildingsList(true);
          }}
          onGallery={(buildingId) => {
            setViewer(null);
            setGallery({ buildingId });
          }}
          onReports={(buildingId, reportId) => {
            setViewer(null);
            setGallery(null);
            focusBuilding(buildingId, "reporting", reportId ?? null);
          }}
        />
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
          // Reload the saved school: passing the old object back kept the
          // previous location (and other fields) on screen.
          void api.get(`/schools/${school.id}`).then(({ data }) => {
            const pt = schoolPoint(data);
            if (pt) setSavedLonLat([pt.lng, pt.lat]);
            onUpdateSchool?.(data);
            useSchoolsStore.getState().invalidateAllSchools();
          });
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
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <AlertCircle className="w-5 h-5" aria-hidden />
            </div>
            <div>
              <h3 className="text-lg font-medium">No site map yet</h3>
              <p className="text-xs text-muted-foreground">Upload a KMZ to see the school in detail.</p>
            </div>
          </div>
        }
        maxWidth="max-w-md"
      >
        <div className="flex flex-col gap-2 py-4">
          <Button asChild className="rounded-full h-11 text-sm font-medium">
            <Link to={`/schools/${school.id}/kmz`}>Upload a KMZ</Link>
          </Button>
          <Button
            variant="ghost"
            onClick={() => setIsMissingMapModalOpen(false)}
            className="rounded-full h-11 text-sm text-muted-foreground hover:text-foreground"
          >
            Continue with the satellite map
          </Button>
        </div>
      </Modal>
    </div>
  );
}
