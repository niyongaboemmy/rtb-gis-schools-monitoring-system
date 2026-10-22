import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { api, apiErrorMessage, FILE_SERVER_URL } from "../lib/api";
import { useAuthorization } from "../hooks/useAuthorization";
import { Permission } from "../lib/permissions";

import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from "three-mesh-bvh";

// Sub-components
import ViewerLoadingScreens from "./3dviewercomponents/ViewerLoadingScreens";
import { ViewerRightToolbar } from "./3dviewercomponents/ViewerRightToolbar";
import { ViewerCameraNav } from "./3dviewercomponents/ViewerCameraNav";
import ViewerMeasurePanel from "./3dviewercomponents/ViewerMeasurePanel";
import ViewerStatsFooter from "./3dviewercomponents/ViewerStatsFooter";
import { ViewerMovementControls } from "./3dviewercomponents/ViewerMovementControls";
import { AnnotationPickerModal } from "./2dviewercomponents/AnnotationPickerModal";
import { BuildingsListPanel } from "./2dviewercomponents/BuildingsListPanel";
import { BlockInspector } from "./BlockInspector";
import { BuildingFormDrawer, type AvailableFacility } from "./school-form-steps/BuildingFormDrawer";
import type { BuildingData } from "./school-form-steps/BuildingsStep";
import ViewerHelpModal from "./3dviewercomponents/ViewerHelpModal";
import ViewerMainCanvas from "./3dviewercomponents/ViewerMainCanvas";
import ActiveToolBanner from "./3dviewercomponents/ActiveToolBanner";
import ModelScaleBanner from "./3dviewercomponents/ModelScaleBanner";
import type { MeasurementRow } from "./3dviewercomponents/MeasurementListPanel";
import {
  annotationToFeature,
  computeMeasure,
  featuresToScene,
  measureToFeature,
  type Annotation,
  type MeasureLine,
  type MeasurePoint,
  type SceneFrame,
} from "./3dviewercomponents/siteFeatures3d";
import { useToast } from "./ui/toast";
import { useSiteFeatures } from "../lib/measure/useSiteFeatures";
import { downloadSiteFeaturesCsv } from "../lib/measure/site-features";
import { measurePolygon, measureValue } from "../lib/measure/geometry3d";
import { isValidOrigin, wgs84ToModel, modelToWgs84, type GeoOrigin } from "../lib/geo-bridge";
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
  type BuildingPanelTab,
  type DisplayUnit,
  type ViewerToolId,
} from "../lib/viewer-tools";
import { useSchoolReports } from "./2dviewercomponents/hooks/useSchoolReports";
import { schoolPoint } from "../lib/school-location";
import { useBuildingPanelAccess } from "./2dviewercomponents/hooks/useBuildingPanelAccess";
import { MediaViewer } from "./2dviewercomponents/media/MediaViewer";
import { MediaGallery } from "./2dviewercomponents/media/MediaGallery";
import { collectMedia, collectReportMedia, type GalleryItem } from "./2dviewercomponents/media/media-utils";

// Styles
import "./School3DView.css";
import { buildingPayloadFields } from "../lib/buildingPayload";

// ─── GLB browser cache ──────────────────────────────────────────────────────
// The Cache API keeps a downloaded optimized GLB across tab reloads / sessions
// so re-opening the 3D tab is instant with zero network. Keyed by
// schoolId + a server version tag (`modelOptimizedAt` from the kmz/status
// endpoint) — NOT the file-server URL, which never changes across
// re-optimisations (server.js is root-owned, can't add a `?v=`). So a
// re-optimise on the server produces a new tag → cache miss → fresh download,
// and the stale entry is evicted.
//
// Entirely best-effort: non-secure context, private windows, quota limits, or a
// browser with the API disabled all just fall through to the network.
const GLB_CACHE = "glb-models-v2";
const GLB_CACHE_MAX_BYTES = 600 * 1_048_576; // don't cache a giant raw export
const GLB_CACHE_MAX_ENTRIES = 5; // LRU — keep the 5 most-recently-viewed schools

// Ask the browser to keep this origin's storage across disk-pressure evictions.
try {
  void navigator.storage?.persist?.();
} catch {
  /* not supported — ignore */
}

const glbCacheKey = (schoolId: string, versionTag: string) =>
  `https://glb-cache.local/${encodeURIComponent(schoolId)}?v=${encodeURIComponent(
    versionTag,
  )}`;

async function readGlbCache(
  schoolId: string,
  versionTag: string,
): Promise<ArrayBuffer | null> {
  try {
    if (typeof caches === "undefined") return null;
    const cache = await caches.open(GLB_CACHE);
    const hit = await cache.match(glbCacheKey(schoolId, versionTag));
    return hit ? await hit.arrayBuffer() : null;
  } catch {
    return null;
  }
}

async function writeGlbCache(
  schoolId: string,
  versionTag: string,
  buf: ArrayBuffer,
): Promise<void> {
  try {
    if (typeof caches === "undefined" || buf.byteLength > GLB_CACHE_MAX_BYTES) {
      return;
    }
    // One-time migration off the old (broken, URL-keyed) cache.
    void caches.delete("glb-models-v1");

    const cache = await caches.open(GLB_CACHE);
    const key = glbCacheKey(schoolId, versionTag);
    const schoolPath = `/${encodeURIComponent(schoolId)}`;

    await cache.put(
      key,
      new Response(buf, {
        headers: {
          "Content-Type": "model/gltf-binary",
          "X-Cached-At": String(Date.now()),
        },
      }),
    );

    // Drop any older version of *this* school, then LRU-trim the whole store.
    const entries: { url: string; at: number }[] = [];
    for (const req of await cache.keys()) {
      const u = new URL(req.url);
      if (u.pathname === schoolPath && req.url !== key) {
        await cache.delete(req);
        continue;
      }
      const res = await cache.match(req);
      entries.push({
        url: req.url,
        at: Number(res?.headers.get("X-Cached-At")) || 0,
      });
    }
    entries.sort((a, b) => a.at - b.at); // oldest first
    for (const e of entries.slice(0, Math.max(0, entries.length - GLB_CACHE_MAX_ENTRIES))) {
      await cache.delete(e.url);
    }
  } catch {
    /* quota / unsupported — ignore */
  }
}

// ─── Setup BVH ──────────────────────────────────────────────────────────────
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

// ─── Types ────────────────────────────────────────────────────────────────────

interface LoadStats { fileName: string; fileSize: number; loadTime: number; triangles: number; meshes: number; textures: number; }
interface CameraHome { position: { x: number; y: number; z: number }; target: { x: number; y: number; z: number }; near: number; far: number; }

type RenderMode = "unlit" | "lit" | "wireframe";
type MeasureMode = "distance" | "area" | "perimeter" | "height" | "annotate" | null;
type VisibilityMode = "all" | "annotations" | "measures" | "clear";

/** Measure mode ↔ shared tool id (lib/viewer-tools). */
const MODE_TOOL: Record<Exclude<MeasureMode, null>, ViewerToolId> = {
  distance: "measure_distance",
  area: "measure_area",
  perimeter: "measure_perimeter",
  height: "measure_height",
  annotate: "annotate",
};
const TOOL_MODE: Partial<Record<ViewerToolId, Exclude<MeasureMode, null>>> = {
  measure_distance: "distance",
  measure_area: "area",
  measure_perimeter: "perimeter",
  measure_height: "height",
  annotate: "annotate",
};

// ─── Constants ────────────────────────────────────────────────────────────────

const LS_HOME_KEY = "glb_viewer_home_v1";
const LS_MODE_KEY = "glb_viewer_mode_v1";
/** Legacy global keys — leaked measures/annotations across schools (C2). */
const LEGACY_MEASURES_KEY = "glb_viewer_measures_v1";
const LEGACY_ANNOTATIONS_KEY = "glb_viewer_annotations_v1";
/** Per-school browser caches from before site_features — removed on open
 *  (viewer data now lives only on the server; WS5 acceptance). */
const measuresKey = (schoolId: string) => `glb_viewer_measures_v2:${schoolId}`;
const annotationsKey = (schoolId: string) => `glb_viewer_annotations_v2:${schoolId}`;
const LEGACY_UNIT_KEY = "glb_viewer_unit_v1";

/** Normalizes a raw API building record to match the BuildingData client interface */
function normalizeBuilding(b: any): any {
  return {
    ...b,
    buildingName: b.buildingName || b.name || "",
    buildingCode: b.buildingCode || b.code || "",
    buildingFunction: b.buildingFunction || b.function || "",
    buildingFloors: b.buildingFloors || (b.floors != null ? String(b.floors) : ""),
    buildingArea: b.buildingArea || (b.areaSquareMeters != null ? String(b.areaSquareMeters) : ""),
    buildingYearBuilt: b.buildingYearBuilt || (b.yearBuilt != null ? String(b.yearBuilt) : ""),
    buildingCondition: b.buildingCondition || b.condition || "",
    buildingRoofCondition: b.buildingRoofCondition || b.roofCondition || "",
    buildingStructuralScore: b.buildingStructuralScore || (b.structuralScore != null ? String(b.structuralScore) : ""),
    buildingNotes: b.buildingNotes || b.notes || "",
    geolocation: b.geolocation || {
      latitude: b.latitude || b.centroidLat || null,
      longitude: b.longitude || b.centroidLng || null,
    },
  };
}

const MODE_LABELS: Record<RenderMode, string> = { unlit: "Unlit (Metashape-style)", lit: "Lit (PBR)", wireframe: "Wireframe" };

const MEASURE_COLORS = ["#3b82f6", "#2563eb", "#00d4aa", "#ffb347", "#7ec8e3", "#ff7f50"];
const ANNOT_COLORS = ["#00d4aa", "#2563eb", "#ffb347", "#7ec8e3", "#93c5fd", "#ffffff"];
const ICON_EMOJI_MAP: Record<string, string> = {
  pin: "📍", warning: "⚠️", info: "ℹ️", danger: "🚨",
  construction: "🚧", flag: "🚩", maintenance: "🔧", poi: "⭐",
  inspection: "🔍", water: "💧", power: "⚡", green: "🌳",
  facility: "🏫", path: "👣", parking: "🅿️",
};
const SPEED_STEPS = [0.001, 0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(b: number) { if (!b) return "0 B"; const k = 1024, s = ["B", "KB", "MB", "GB"], i = Math.floor(Math.log(b) / Math.log(k)); return `${parseFloat((b / Math.pow(k, i)).toFixed(2))} ${s[i]}`; }
function formatTime(ms: number) { return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`; }
function nearestSpeedIdx(v: number) { return SPEED_STEPS.reduce((b, s, i) => Math.abs(s - v) < Math.abs(SPEED_STEPS[b] - v) ? i : b, Math.floor(SPEED_STEPS.length / 2)); }
function uid() { return Math.random().toString(36).slice(2, 9); }

/** Formatted value of a 3D measurement (honest precision, WS6.5). */
function fmtMeasure(mode: MeasureLine["mode"], value: number, unit: DisplayUnit) {
  return mode === "area" ? formatMeasureArea(value, "3d", unit) : formatMeasureLength(value, "3d", unit);
}

function loadJson<T>(key: string, def: T): T { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def; } catch { return def; } }
function saveJson(key: string, val: unknown) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { } }

interface ViewerState {
  home: CameraHome | null;
  buildingPins: Record<string, MeasurePoint>;
  /** Legacy only — read once for the import into site_features. */
  annotations?: unknown[];
  measures?: unknown[];
}

const isEmptyViewerState = (s: Partial<ViewerState> | null | undefined) =>
  !s || (!s.home && !s.annotations?.length && !s.measures?.length &&
    !Object.keys(s.buildingPins ?? {}).length);

/**
 * Reads the school's viewer state (camera home + building pins) from the API.
 * The first time a school is opened after the move off the file-server, its
 * old `viewer-state.json` is read once and, if the user may save, copied into
 * the API — home/pins into viewer-state, measures/notes into site_features via
 * `importFeatures`.
 */
async function loadViewerState(
  schoolId: string,
  canSave: boolean,
  importFeatures?: (measures: unknown[], annotations: unknown[]) => Promise<void>,
): Promise<ViewerState | null> {
  const { data } = await api.get(`/schools/${schoolId}/viewer-state`);
  if (data?.exists) return data;

  const legacy: Partial<ViewerState> | null = await fetch(`${FILE_SERVER_URL}/schools/${schoolId}/viewer-state`)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  if (isEmptyViewerState(legacy)) return data ?? null;

  const imported: ViewerState = {
    home: legacy?.home ?? null,
    buildingPins: legacy?.buildingPins ?? {},
  };
  if (canSave) {
    await api.put(`/schools/${schoolId}/viewer-state`, imported).catch(() => { });
    if (importFeatures && (legacy?.measures?.length || legacy?.annotations?.length)) {
      await importFeatures(legacy?.measures ?? [], legacy?.annotations ?? []).catch(() => { });
    }
  }
  return imported;
}
/**
 * Per-model localStorage key for the saved camera home. The `sig` (rounded
 * model dimensions) is part of the key so a home saved for a previous build of
 * the same file — e.g. before the GLB was reprojected from lon/lat° to metres,
 * or re-optimised at a different scale — is simply never read, and the viewer
 * falls back to the computed default framing instead of opening flipped.
 */
function getHomeKey(fileName: string, sig = "") {
  const base = `glb_home_${fileName.replace(/[^a-zA-Z0-9]/g, "_")}`;
  return sig ? `${base}__${sig}` : base;
}

// ─── Shared DRACO loader (pre-warmed, reused across loads) ───────────────────
const sharedDracoLoader = new DRACOLoader();
sharedDracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.6/");
sharedDracoLoader.preload();

/** Wires DRACO + Meshopt decoders onto a GLTFLoader. Optimized school models
 *  ship as EXT_meshopt_compression + KHR_mesh_quantization + EXT_texture_webp. */
function makeGLTFLoader(): GLTFLoader {
  const loader = new GLTFLoader();
  loader.setDRACOLoader(sharedDracoLoader);
  loader.setMeshoptDecoder(MeshoptDecoder);
  return loader;
}

// ─── 3D label helpers (module-level so drawOverlay + sprite sync can share) ──

/** True midpoint along a polyline by arc-length, so the label sits at the middle of the line. */
function midpointAlongPolyline(pts: MeasurePoint[]): MeasurePoint {
  if (pts.length === 1) return pts[0];
  if (pts.length === 2) return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2, z: (pts[0].z + pts[1].z) / 2 };
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++)
    total += new THREE.Vector3(pts[i].x, pts[i].y, pts[i].z).distanceTo(new THREE.Vector3(pts[i + 1].x, pts[i + 1].y, pts[i + 1].z));
  const half = total / 2;
  let walked = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i], p2 = pts[i + 1];
    const seg = Math.hypot(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z);
    if (walked + seg >= half) {
      const t = seg > 0 ? (half - walked) / seg : 0;
      return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y), z: p1.z + t * (p2.z - p1.z) };
    }
    walked += seg;
  }
  return pts[pts.length - 1];
}

/** Centroid of a polygon — keeps the label inside the shape from any angle. */
function centroidOf(pts: MeasurePoint[]): MeasurePoint {
  return { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length, z: pts.reduce((s, p) => s + p.z, 0) / pts.length };
}

// ─── Overlay canvas helpers ───────────────────────────────────────────────────

function project3Dto2D(pt: MeasurePoint, camera: THREE.PerspectiveCamera, w: number, h: number): [number, number] | null {
  const v = new THREE.Vector3(pt.x, pt.y, pt.z).project(camera);
  if (v.z < -1 || v.z > 1) return null;
  return [(v.x * 0.5 + 0.5) * w, (-v.y * 0.5 + 0.5) * h];
}

// ─── Component ────────────────────────────────────────────────────────────────


interface School3DViewProps {
  schoolId: string;
  schoolName: string;
  onClose: () => void;
  /** Select, highlight and fly to this building once the model is ready. */
  focusBuildingId?: string | null;
  /** Embedded in the school viewer: "2D map" switches its tab instead of navigating. */
  on2DView?: (buildingId: string | null) => void;
}

export default function School3DView({ schoolId: propSchoolId, schoolName: propSchoolName, onClose, focusBuildingId, on2DView }: School3DViewProps) {
  const navigate = useNavigate();
  const { id: routeId } = useParams<{ id: string }>();
  const schoolId = propSchoolId || routeId || "";
  const schoolName = propSchoolName || "";
  const { hasPermission, user } = useAuthorization();
  const notify = useToast();
  const canSaveViewerState = hasPermission(Permission.SAVE_SITE_FEATURES);
  const canMeasure = hasPermission(Permission.USE_MEASURE_TOOLS);
  const canEditAnyFeature = hasPermission(Permission.EDIT_SITE_ANNOTATIONS);
  const canExport = hasPermission(Permission.EXPORT_VIEWER_DATA);
  const canSaveViewerStateRef = useRef(canSaveViewerState);
  useEffect(() => { canSaveViewerStateRef.current = canSaveViewerState; }, [canSaveViewerState]);
  /** Saves stay off until the server state has loaded, so a stale local
   *  cache can never overwrite what is stored for this school. */
  const viewerStateLoadedRef = useRef(false);

  // Cleanup of browser-stored viewer data: the legacy global keys (C2) and
  // the per-school caches — measures/notes now live only in site_features.
  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_MEASURES_KEY);
      localStorage.removeItem(LEGACY_ANNOTATIONS_KEY);
      localStorage.removeItem(LEGACY_UNIT_KEY);
      if (schoolId) {
        localStorage.removeItem(measuresKey(schoolId));
        localStorage.removeItem(annotationsKey(schoolId));
      }
    } catch { /* ignore */ }
  }, [schoolId]);

  const mountRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const occlusionRaycasterRef = useRef<THREE.Raycaster>(
    Object.assign(new THREE.Raycaster(), { firstHitOnly: true }),
  );
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animFrameRef = useRef<number>(0);
  /** Wall-clock ms of the last rendered frame — a watchdog restarts the loop
   *  if it ever stalls (e.g. a stray cancelAnimationFrame or a thrown frame). */
  const lastFrameAtRef = useRef<number>(0);
  const restartLoopRef = useRef<(() => void) | null>(null);
  const keyLoopWatchdogRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  /** True while the camera is moving — labels are hidden to prevent visual glitches */
  const interactingRef = useRef(false);
  /** Debounce timer: shows labels 150 ms after camera stops */
  const showLabelsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Previous camera position — used to detect any movement (mouse orbit, keyboard, programmatic) */
  const _prevCamPosRef = useRef(new THREE.Vector3(Infinity, 0, 0));
  const keysRef = useRef<Set<string>>(new Set());
  const velocityRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const moveSpeedRef = useRef<number>(1);
  const cameraHomeRef = useRef<CameraHome | null>(null);
  const loadedFileNameRef = useRef<string>("");
  const origMatsRef = useRef<Map<THREE.Mesh, THREE.Material | THREE.Material[]>>(new Map());
  const unlitMatsRef = useRef<Map<THREE.Mesh, THREE.MeshBasicMaterial>>(new Map());
  const raycasterRef = useRef(
    Object.assign(new THREE.Raycaster(), { firstHitOnly: true }),
  );
  const modelRawCenterRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });
  /** Rounded model dimensions "WxHxD" — namespaces the saved camera home so a
   *  home from a previous build of the same file is never applied. */
  const modelSigRef = useRef<string>("");
  /** Model bounding box (world space), padded — the orbit pivot is clamped to
   *  this so wheel-zoom-to-cursor can't drift the camera off into the void. */
  const modelBoundsRef = useRef<THREE.Box3 | null>(null);
  /** Closest allowed camera-to-target distance — also enforced on WASD/d-pad
   *  fly movement, which bypasses OrbitControls' own minDistance. */
  const minZoomRef = useRef<number>(0);

  const hoverPtRef = useRef<MeasurePoint | null>(null);

  const [phase, setPhase] = useState<"idle" | "loading" | "viewing">("idle");
  // True from the moment the 3D tab opens until we've *decided* what to show
  // (viewer, "preparing on server", or the upload drop-zone). Guards against the
  // upload form flashing in the gap between discovery and the first byte.
  const [discovering, setDiscovering] = useState(true);
  // Only true once discovery has confirmed this school has NO model at all —
  // the only case where the upload drop-zone should appear.
  const [noModel, setNoModel] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Non-null while the server is still producing the optimized (web-sized) GLB
  // for this school — we hold off auto-downloading the raw multi-GB export
  // (which times out and crashes the tab) and poll until it's ready.
  const [modelPrep, setModelPrep] = useState<
    null | { bytes: number | null; error: string | null }
  >(null);
  const loadAnywayRef = useRef(false);
  const pendingModelRef = useRef<{ url: string; fileName: string } | null>(null);
  const prepPollRef = useRef<number | null>(null);
  // Set from GET /kmz/status — drives the persistent model cache key.
  const cacheMetaRef = useRef<{
    schoolId: string;
    versionTag: string;
    optimized: boolean | null;
  } | null>(null);
  const [stats, setStats] = useState<LoadStats | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [availableFacilities, setAvailableFacilities] = useState<AvailableFacility[]>([]);
  const [facilitiesLoading, setFacilitiesLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerBuilding, setDrawerBuilding] = useState<BuildingData | null>(null);

  useEffect(() => {
    setFacilitiesLoading(true);
    api.get("/schools/facilities")
      .then(res => setAvailableFacilities(res.data))
      .catch(err => console.error("Failed to fetch facilities", err))
      .finally(() => setFacilitiesLoading(false));
  }, []);
  const [showHelp, setShowHelp] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(7);

  const [saveFlash, setSaveFlash] = useState(false);
  const [renderMode, setRenderMode] = useState<RenderMode>(() => loadJson(LS_MODE_KEY, "unlit") as RenderMode);

  const [selectedBuilding, setSelectedBuilding] = useState<any>(null);
  const [showBuildingsList, setShowBuildingsList] = useState(false);
  const [buildingPins, setBuildingPins] = useState<Record<string, MeasurePoint>>({});
  const buildingPinsRef = useRef<Record<string, MeasurePoint>>({});
  useEffect(() => { buildingPinsRef.current = buildingPins; }, [buildingPins]);
  const [pinBuildingId, setPinBuildingId] = useState<string | null>(null);
  const pinBuildingIdRef = useRef<string | null>(null);
  useEffect(() => { pinBuildingIdRef.current = pinBuildingId; }, [pinBuildingId]);

  const [annotPickerOpen, setAnnotPickerOpen] = useState(false);
  const [isSprinting, setIsSprinting] = useState(false);
  const isSprintingRef = useRef(false);
  useEffect(() => { isSprintingRef.current = isSprinting; }, [isSprinting]);

  const [dbSchool, setDbSchool] = useState<any>(null);
  const [dbBuildings, setDbBuildings] = useState<any[]>([]);
  // Building panel, reports and media (shared with the 2D map).
  const panelAccess = useBuildingPanelAccess();
  const schoolReports = useSchoolReports(schoolId);
  const openReportsOf = useCallback((id: string) => schoolReports.counts.get(String(id))?.open ?? 0, [schoolReports.counts]);
  // A tab request applies only to the building it was made for.
  const [panel, setPanel] = useState<{ tab: BuildingPanelTab; n: number; buildingId: string | null }>({ tab: "media", n: 0, buildingId: null });
  const [gallery, setGallery] = useState<{ buildingId: string | null } | null>(null);
  const [mediaViewer, setMediaViewer] = useState<{ items: GalleryItem[]; index: number } | null>(null);
  const allMedia = useMemo(
    () => [...collectMedia(dbBuildings), ...collectReportMedia(schoolReports.reports, dbBuildings)],
    [dbBuildings, schoolReports.reports],
  );
  const [dbMarkers, setDbMarkers] = useState<any[]>([]);
  const [isModelReady, setIsModelReady] = useState(false);
  const [measureMode, setMeasureMode] = useState<MeasureMode>(null);
  const [visibility, setVisibility] = useState<VisibilityMode>("all");
  // Display unit is a per-user UI preference (key includes the user id).
  const [unit, setUnitState] = useState<DisplayUnit>(() => loadDisplayUnit(user?.id));
  const setUnit = useCallback((u: DisplayUnit) => { setUnitState(u); saveDisplayUnit(user?.id, u); }, [user?.id]);

  // Saved measurements / notes come from site_features (both viewers, live);
  // measurements by users who can't save stay local and are marked "Not saved".
  const siteFeatures = useSiteFeatures(schoolId);
  const [tempMeasures, setTempMeasures] = useState<MeasureLine[]>([]);
  const [tempAnnotations, setTempAnnotations] = useState<Annotation[]>([]);
  /** Model georeference + scale from GET kmz/status (WS5.3 / WS6.4). */
  const [modelGeo, setModelGeo] = useState<{
    origin: GeoOrigin | null;
    scale: number;
    scaleFactor: number | null;
    scaleWarning: string | null;
  }>({ origin: null, scale: 1, scaleFactor: null, scaleWarning: null });
  /** Bumped whenever the model's scene transform changes (load / flip). */
  const [frameVersion, setFrameVersion] = useState(0);
  const [pendingPts, setPendingPts] = useState<MeasurePoint[]>([]);
  const pendingPtsRef = useRef<MeasurePoint[]>([]);
  useEffect(() => { pendingPtsRef.current = pendingPts; }, [pendingPts]);

  /** True once every mesh has its BVH — draping raycasts are cheap from then on. */
  const bvhReadyRef = useRef(false);

  /** Model (GLB) frame ↔ scene, via the model's current world matrix. */
  const getSceneFrame = useCallback((): SceneFrame | null => {
    const model = modelRef.current;
    if (!model) return null;
    model.updateMatrixWorld(true);
    const m = model.matrixWorld.clone();
    const inv = m.clone().invert();
    const v = new THREE.Vector3();
    const down = new THREE.Vector3(0, -1, 0);
    return {
      toScene: (p) => { v.set(p.x, p.y, p.z).applyMatrix4(m); return { x: v.x, y: v.y, z: v.z }; },
      toModel: (p) => { v.set(p.x, p.y, p.z).applyMatrix4(inv); return { x: v.x, y: v.y, z: v.z }; },
      drapeY: (x, z) => {
        if (!bvhReadyRef.current) return null;
        const top = (modelBoundsRef.current?.max.y ?? 1000) + 10;
        raycasterRef.current.set(new THREE.Vector3(x, top, z), down);
        const hit = raycasterRef.current.intersectObject(model, true)[0];
        return hit ? hit.point.y : null;
      },
    };
  }, []);

  /** Georeference origin: the model's own (from the optimizer), else the
   *  school point — approximate, flagged on anything saved with it. */
  const effectiveOrigin = useMemo(() => {
    if (modelGeo.origin) return { origin: modelGeo.origin, approximate: false };
    const p = schoolPoint(dbSchool);
    const o = { lat: p?.lat ?? NaN, lng: p?.lng ?? NaN, alt: 0 };
    return p && isValidOrigin(o) ? { origin: o as GeoOrigin, approximate: true } : { origin: null, approximate: true };
  }, [modelGeo.origin, dbSchool]);
  const effectiveOriginRef = useRef(effectiveOrigin);
  useEffect(() => { effectiveOriginRef.current = effectiveOrigin; }, [effectiveOrigin]);
  const modelScaleRef = useRef(1);
  useEffect(() => { modelScaleRef.current = modelGeo.scale; }, [modelGeo.scale]);

  // Saved features (from either viewer) in scene coordinates; 2D ones draped.
  const serverScene = useMemo(() => {
    const frame = isModelReady ? getSceneFrame() : null;
    if (!frame) return { measures: [] as MeasureLine[], annotations: [] as Annotation[] };
    return featuresToScene(siteFeatures.features, effectiveOrigin.origin, frame, modelGeo.scale);
    // frameVersion: recompute after a flip / once the BVH allows draping.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteFeatures.features, effectiveOrigin, modelGeo.scale, isModelReady, frameVersion, getSceneFrame]);
  const measures = useMemo(() => [...serverScene.measures, ...tempMeasures], [serverScene.measures, tempMeasures]);
  const annotations = useMemo(() => [...serverScene.annotations, ...tempAnnotations], [serverScene.annotations, tempAnnotations]);

  const dbMarkersRef = useRef<any[]>([]);
  const dbBuildingsRef = useRef<any[]>([]);
  const measureModeRef = useRef<MeasureMode>(null);
  useEffect(() => { dbMarkersRef.current = dbMarkers; }, [dbMarkers]);
  useEffect(() => { dbBuildingsRef.current = dbBuildings; }, [dbBuildings]);
  useEffect(() => { measureModeRef.current = measureMode; }, [measureMode]);

  const threeInitResolveRef = useRef<(() => void) | null>(null);
  const threeInitPromiseRef = useRef<Promise<void>>(new Promise(() => {}));
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleSave = useCallback(() => {
    if (!schoolId || !viewerStateLoadedRef.current || !canSaveViewerStateRef.current) return;
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    saveDebounceRef.current = setTimeout(() => {
      api.put(`/schools/${schoolId}/viewer-state`, {
        home: cameraHomeRef.current,
        buildingPins: buildingPinsRef.current,
      }).catch(() => { });
    }, 800);
  }, [schoolId]);
  const [showMeasurePanel, setShowMeasurePanel] = useState(false);
  const [screenshotFlash, setScreenshotFlash] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const isDraggingMapRef = useRef(false);
  const colorIdxRef = useRef(0);

  const [annotPendingPt, setAnnotPendingPt] = useState<MeasurePoint | null>(null);
  const [annotColor] = useState<string>(ANNOT_COLORS[0]);

  useEffect(() => { scheduleSave(); }, [buildingPins, scheduleSave]);

  const applyRenderMode = useCallback((mode: RenderMode) => {
    const model = modelRef.current; if (!model) return;
    model.traverse((child) => {
      const mesh = child as THREE.Mesh; if (!mesh.isMesh) return;
      if (mode === "wireframe") mesh.material = new THREE.MeshBasicMaterial({ color: 0x7755ff, wireframe: true });
      else if (mode === "unlit") { const u = unlitMatsRef.current.get(mesh); if (u) mesh.material = u; }
      else { const o = origMatsRef.current.get(mesh); if (o) mesh.material = o; }
    });
  }, []);

  useEffect(() => {
    if (phase === "viewing" && modelRef.current) { applyRenderMode(renderMode); saveJson(LS_MODE_KEY, renderMode); }
  }, [renderMode, phase, applyRenderMode]);

  /** One-time import of a school's old file-server measures/notes (scene
   *  coordinates of that era ≈ model frame) into site_features. */
  const createFeature = siteFeatures.create;
  const importLegacyFeatures = useCallback(async (legacyMeasures: unknown[], legacyNotes: unknown[]) => {
    const { origin, approximate } = effectiveOriginRef.current;
    const frame = getSceneFrame();
    if (!origin || !frame) return;
    const scale = modelScaleRef.current;
    for (const raw of legacyMeasures) {
      const x = raw as { points?: MeasurePoint[]; mode?: string; color?: string };
      const mode = (["distance", "area", "perimeter", "height"].includes(String(x?.mode)) ? x.mode : "distance") as MeasureLine["mode"];
      const pts = Array.isArray(x?.points) ? x.points.filter((p) => [p?.x, p?.y, p?.z].every(Number.isFinite)) : [];
      if (pts.length < 2) continue;
      const v = computeMeasure(mode, pts, scale);
      await createFeature(measureToFeature({ mode, points: pts, result: v.result, surface: v.surface, name: null, color: x.color ?? "#3b82f6" }, origin, frame, approximate));
    }
    for (const raw of legacyNotes) {
      const a = raw as { point?: MeasurePoint; text?: string; color?: string };
      if (!a?.point || ![a.point.x, a.point.y, a.point.z].every(Number.isFinite)) continue;
      await createFeature(annotationToFeature({ point: a.point, text: a.text || "Note", color: a.color ?? "#00d4aa" }, origin, frame, approximate));
    }
  }, [createFeature, getSceneFrame]);

  const finalizeGLTF = useCallback(async (
    gltf: GLTF,
    fileName: string,
    fileSize: number,
    startTime: number
  ) => {
    setProgress(90); setProgressLabel("Building scene…"); setPhase("viewing");
    if (!sceneRef.current) await threeInitPromiseRef.current;

    const scene = sceneRef.current!, camera = cameraRef.current!, controls = controlsRef.current!;
    const maxAniso = rendererRef.current?.capabilities.getMaxAnisotropy() ?? 16;
    if (modelRef.current) { scene.remove(modelRef.current); modelRef.current = null; setIsModelReady(false); }
    const model = gltf.scene;

    const upgradeTex = (tex: THREE.Texture | null) => {
      if (!tex) return; tex.anisotropy = maxAniso; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.needsUpdate = true;
    };
    const bvhMeshes: THREE.Mesh[] = [];
    model.traverse(child => {
      const mesh = child as THREE.Mesh; if (!mesh.isMesh) return;
      origMatsRef.current.set(mesh, mesh.material);
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m: any) => { ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "aoMap"].forEach(k => upgradeTex(m[k])); });
      const srcMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      const diffuseTex = (srcMat as any).map ?? null; if (diffuseTex) upgradeTex(diffuseTex);
      const unlitMat = new THREE.MeshBasicMaterial({ map: diffuseTex, vertexColors: (srcMat as any).vertexColors ?? false, side: (srcMat as any).side ?? THREE.FrontSide, transparent: (srcMat as any).transparent ?? false, opacity: (srcMat as any).opacity ?? 1, alphaTest: (srcMat as any).alphaTest ?? 0 });
      // Web-decimated photogrammetry has thin near-coplanar folds along curbs /
      // hedges / roof edges; polygon offset stops them shimmering (Z-fighting).
      unlitMat.polygonOffset = true;
      unlitMat.polygonOffsetFactor = 1;
      unlitMat.polygonOffsetUnits = 1;
      unlitMatsRef.current.set(mesh, unlitMat);
      bvhMeshes.push(mesh);
    });

    scene.add(model); modelRef.current = model;
    bvhReadyRef.current = false;
    ;(async () => {
      for (let i = 0; i < bvhMeshes.length; i++) {
        bvhMeshes[i].geometry.computeBoundsTree();
        if (i % 5 === 4) await new Promise(r => setTimeout(r, 0));
      }
      bvhReadyRef.current = true;
      setFrameVersion(v => v + 1); // re-drape 2D features on the surface
    })();

    model.updateMatrixWorld(true);
    let box = new THREE.Box3();
    model.traverse(c => { if ((c as THREE.Mesh).isMesh) box.expandByObject(c); });
    let size = box.getSize(new THREE.Vector3());

    if (size.y > size.z * 1.5 && size.x > size.z * 0.5) {
      model.rotation.x = -Math.PI / 2;
      model.updateMatrixWorld(true);
      box.setFromObject(model);
      size = box.getSize(new THREE.Vector3());
    }

    const rawCenter = box.getCenter(new THREE.Vector3());
    modelRawCenterRef.current = { x: rawCenter.x, z: rawCenter.z };
    model.position.set(-rawCenter.x, -box.min.y, -rawCenter.z);
    model.updateMatrixWorld(true);
    box.setFromObject(model);

    applyRenderMode(renderMode);
    if (rendererRef.current) rendererRef.current.compile(scene, camera);

    size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const boxCenter = box.getCenter(new THREE.Vector3());
    // A hilly site has a tall bounding box, so its geometric centre floats in
    // mid-air. Drop a ray straight down through it to land the orbit pivot on
    // the actual ground/roofs — otherwise zooming in flies into empty sky.
    const center = boxCenter.clone();
    try {
      raycasterRef.current.set(
        new THREE.Vector3(boxCenter.x, box.max.y + maxDim, boxCenter.z),
        new THREE.Vector3(0, -1, 0),
      );
      const groundHit = raycasterRef.current.intersectObject(model, true)[0];
      if (groundHit) center.copy(groundHit.point);
    } catch { /* fall back to box centre */ }
    const halfDiag = box.getBoundingSphere(new THREE.Sphere()).radius;
    const fovRad = camera.fov * (Math.PI / 180);
    const distance = (halfDiag / Math.tan(fovRad / 2)) * 1.1;

    camera.near = distance * 0.0001; camera.far = distance * 100; camera.updateProjectionMatrix();

    // Signature ties a saved camera home to this exact build of the model.
    const modelSig = `${Math.round(size.x)}x${Math.round(size.y)}x${Math.round(size.z)}`;
    modelSigRef.current = modelSig;

    let savedHome: CameraHome | null = null;
    try { const s = localStorage.getItem(getHomeKey(fileName, modelSig)); if (s) savedHome = JSON.parse(s); } catch { }
    // One-time cleanup of any legacy un-versioned home for this file.
    try { localStorage.removeItem(getHomeKey(fileName)); } catch { /* ignore */ }

    if (schoolId) {
      try {
        const serverState = await loadViewerState(schoolId, canSaveViewerStateRef.current, importLegacyFeatures);
        if (serverState) {
          if (serverState.home) savedHome = serverState.home;
          if (serverState.buildingPins && Object.keys(serverState.buildingPins).length)
            setBuildingPins(serverState.buildingPins);
        }
      } catch { /* offline: keep the per-school local cache */ }
      viewerStateLoadedRef.current = true;
    }

    // Reject a saved home that clearly belongs to an older version of this
    // model (e.g. saved before the GLB was reprojected from lon/lat° to metres,
    // or before it was re-optimised at a different scale). Otherwise the viewer
    // opens pointing at empty space / from a flipped angle.
    if (savedHome) {
      const okNum = (v: { x: number; y: number; z: number }) =>
        v && [v.x, v.y, v.z].every((n) => Number.isFinite(n));
      const tgt = okNum(savedHome.target)
        ? new THREE.Vector3(savedHome.target.x, savedHome.target.y, savedHome.target.z)
        : null;
      const pos = okNum(savedHome.position)
        ? new THREE.Vector3(savedHome.position.x, savedHome.position.y, savedHome.position.z)
        : null;
      const stale =
        !tgt || !pos ||
        tgt.distanceTo(center) > halfDiag * 2.5 ||      // looking away from the model
        pos.distanceTo(center) > distance * 12 ||       // parked absurdly far out
        pos.distanceTo(center) < halfDiag * 0.02;       // clipped inside the mesh
      if (stale) {
        savedHome = null;
        try { localStorage.removeItem(getHomeKey(fileName, modelSig)); } catch { /* ignore */ }
      }
    }

    if (savedHome) {
      camera.position.set(savedHome.position.x, savedHome.position.y, savedHome.position.z);
      // Always use freshly-computed clip planes — a stored near/far can be scaled
      // to a previous (e.g. pre-reprojection) bounding box.
      camera.near = distance * 0.0001; camera.far = distance * 100; camera.updateProjectionMatrix();
      controls.target.set(savedHome.target.x, savedHome.target.y, savedHome.target.z);
      cameraHomeRef.current = { ...savedHome, near: camera.near, far: camera.far };
    } else {
      // Frame the site's footprint (it's a flat slab, so the bounding sphere
      // over-zooms), viewed from a ~52° elevation 3/4 angle so roofs and walls
      // both read.
      const footprint = Math.max(size.x, size.z);
      const framed = (footprint / 2 / Math.tan(fovRad / 2)) * 1.35;
      const hp = new THREE.Vector3(0.62, 0.78, 0.62).normalize().multiplyScalar(framed).add(center);
      const startPos = hp.clone().add(new THREE.Vector3(0, framed * 1.4, framed * 0.7));
      camera.position.copy(startPos);
      camera.lookAt(center);
      controls.target.copy(center);
      cameraHomeRef.current = { position: { x: hp.x, y: hp.y, z: hp.z }, target: { x: center.x, y: center.y, z: center.z }, near: camera.near, far: camera.far };
      const glideStartTime = Date.now();
      const glideDur = 2500;
      const step = () => {
        const elapsed = Date.now() - glideStartTime;
        const t = Math.min(1, elapsed / glideDur);
        const ease = 1 - Math.pow(1 - t, 4);
        camera.position.lerpVectors(startPos, hp, ease);
        controls.update(); if (t < 1) requestAnimationFrame(step);
      };
      step();
    }

    // Keep the orbit pivot on (or just around) the model so wheel zoom-to-cursor
    // can't fling the camera into empty space.
    modelBoundsRef.current = box.clone().expandByScalar(maxDim * 0.15);

    // Clamp how close the orbit can dolly in. A web-decimated photogrammetry
    // mesh (~1–3 % of the source triangles) plus a single site-wide texture
    // atlas only holds up to roughly this range — closer just shows facet
    // stepping and texel smear, so stop the zoom there.
    const minZoom = Math.max(camera.near * 20, maxDim * 0.035);
    controls.minDistance = minZoom;
    controls.maxDistance = Math.min(camera.far, maxDim * 8);
    minZoomRef.current = minZoom;
    controls.update();
    const autoSpeed = Math.max(0.001, maxDim * 0.003); moveSpeedRef.current = autoSpeed; setSpeedIdx(nearestSpeedIdx(autoSpeed));

    const oldGrid = scene.children.find(c => c instanceof THREE.GridHelper); if (oldGrid) scene.remove(oldGrid);
    const gridSize = Math.max(size.x, size.z) * 3, divisions = Math.min(100, Math.max(10, Math.floor(gridSize / (maxDim * 0.1))));
    const newGrid = new THREE.GridHelper(gridSize, divisions, 0x0d1a3a, 0x0d1a3a);
    (newGrid.material as THREE.Material).opacity = 0.5; (newGrid.material as THREE.Material).transparent = true; newGrid.position.y = 0; scene.add(newGrid);

    let triangles = 0, meshCount = 0, textureCount = 0; const seen = new Set<THREE.Texture>();
    model.traverse(child => { const mesh = child as THREE.Mesh; if (!mesh.isMesh) return; meshCount++; const geo = mesh.geometry; triangles += geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3; const mats = Array.isArray(mesh.material) ? mesh.material as THREE.Material[] : [mesh.material as THREE.Material]; mats.forEach((m: any) => { ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap"].forEach(k => { if (m[k] && !seen.has(m[k])) { seen.add(m[k]); textureCount++; } }); }); });
    setStats({ fileName, fileSize, loadTime: Date.now() - startTime, triangles: Math.round(triangles), meshes: meshCount, textures: textureCount });

    setIsModelReady(true);
    setProgress(100); setProgressLabel("Done!");
    setFrameVersion(v => v + 1);
  }, [renderMode, applyRenderMode, schoolId, importLegacyFeatures]);

  const loadGLB = useCallback(async (file: File) => {
    setError(null); setPhase("loading"); setProgress(0); setProgressLabel("Reading file…");
    origMatsRef.current.clear(); unlitMatsRef.current.clear();
    loadedFileNameRef.current = file.name;
    threeInitPromiseRef.current = new Promise<void>(resolve => { threeInitResolveRef.current = resolve; });
    const startTime = Date.now();
    try {
      const arrayBuffer = await file.arrayBuffer();
      setProgress(78); setProgressLabel("Parsing GLB…");
      const loader = makeGLTFLoader();
      const gltf = await new Promise<GLTF>((res, rej) => loader.parse(arrayBuffer, "", res, rej));
      await finalizeGLTF(gltf, file.name, file.size, startTime);
    } catch (err: any) { setError(err?.message || "Failed to load model"); setPhase("idle"); }
  }, [finalizeGLTF]);

  const loadGLBFromURL = useCallback(async (url: string, fileName: string) => {
    setError(null); setPhase("loading"); setProgress(0); setProgressLabel("Connecting…");
    origMatsRef.current.clear(); unlitMatsRef.current.clear();
    loadedFileNameRef.current = fileName;
    threeInitPromiseRef.current = new Promise<void>(resolve => { threeInitResolveRef.current = resolve; });
    const startTime = Date.now();
    try {
      // `no-cache` = always revalidate with the file-server (cheap 304 via ETag
      // when unchanged). The served model keeps the same filename across
      // re-optimisations, and the file-server sends `max-age=604800`, so a plain
      // GET would keep serving a week-old copy — e.g. the raw pre-optimised GLB.
      const resp = await fetch(url, { cache: "no-cache" });
      if (!resp.ok) throw new Error(`Model download failed (HTTP ${resp.status})`);

      // Stream the body so the user sees real download progress. A large
      // photogrammetry GLB can be hundreds of MB; fetch().arrayBuffer() would
      // otherwise sit at 0% for minutes and look frozen.
      const total = Number(resp.headers.get("Content-Length")) || 0;
      const mb = (b: number) => (b / 1_048_576).toFixed(0);
      const eta = (secs: number) => {
        if (!isFinite(secs) || secs <= 0) return "";
        if (secs < 60) return `~${Math.ceil(secs)}s left`;
        return `~${Math.ceil(secs / 60)} min left`;
      };
      let arrayBuffer: ArrayBuffer;

      if (resp.body && total > 0) {
        // Write each chunk straight into one pre-allocated buffer. Keeping a
        // chunks[] array *and* building a second merged copy doubled peak RAM —
        // enough to OOM-crash the tab ("Aw, Snap!") on a large model.
        const merged = new Uint8Array(total);
        const reader = resp.body.getReader();
        let received = 0;
        let lastPaint = 0;
        const dlStart = Date.now();
        for (; ;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (received + value.length > total) {
            throw new Error("Model stream is larger than declared — aborting");
          }
          merged.set(value, received);
          received += value.length;
          const now = Date.now();
          if (now - lastPaint > 150) {
            lastPaint = now;
            // Download spans 0–75% of the bar; parse/build take the rest.
            setProgress(Math.min(75, Math.round((received / total) * 75)));
            const elapsed = (now - dlStart) / 1000;
            const speed = received / Math.max(elapsed, 0.001); // bytes/s
            const remain = eta((total - received) / speed);
            setProgressLabel(
              `Downloading model — ${mb(received)} / ${mb(total)} MB` +
              (remain ? ` · ${remain}` : ""),
            );
          }
        }
        arrayBuffer = received === total ? merged.buffer : merged.buffer.slice(0, received);
      } else {
        setProgressLabel("Downloading model…");
        arrayBuffer = await resp.arrayBuffer();
      }

      setProgress(80); setProgressLabel("Preparing 3D scene — almost there…");
      const loader = makeGLTFLoader();
      const gltf = await new Promise<GLTF>((res, rej) => loader.parse(arrayBuffer, "", res, rej));
      await finalizeGLTF(gltf, fileName, arrayBuffer.byteLength, startTime);

      // Persist the web-sized build for instant re-opens — but only a real
      // optimized model, never a raw multi-GB export the user force-loaded.
      const meta = cacheMetaRef.current;
      if (meta && meta.optimized !== false) {
        void writeGlbCache(meta.schoolId, meta.versionTag, arrayBuffer);
      }
    } catch (err: any) { setError(err?.message || "Failed to fetch model"); setPhase("idle"); }
  }, [finalizeGLTF]);

  // Parse a GLB we already have in memory (a cache hit) — no network, no
  // download progress. Mirrors loadGLB's File path.
  const loadGLBFromBuffer = useCallback(async (buf: ArrayBuffer, fileName: string) => {
    setError(null); setPhase("loading"); setProgress(0); setProgressLabel("Loading saved model…");
    origMatsRef.current.clear(); unlitMatsRef.current.clear();
    loadedFileNameRef.current = fileName;
    threeInitPromiseRef.current = new Promise<void>(resolve => { threeInitResolveRef.current = resolve; });
    const startTime = Date.now();
    try {
      setProgress(78); setProgressLabel("Parsing GLB…");
      const loader = makeGLTFLoader();
      const gltf = await new Promise<GLTF>((res, rej) => loader.parse(buf, "", res, rej));
      await finalizeGLTF(gltf, fileName, buf.byteLength, startTime);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load saved model");
      setPhase("idle");
    }
  }, [finalizeGLTF]);

  // Gate the download: serve from the persistent cache when we have this exact
  // build; else, if the server is still producing the optimized GLB, show a
  // "preparing" state and poll every 15 s instead of pulling the raw multi-GB
  // export (which times out and crashes the tab). `Load anyway` and an
  // unreachable status endpoint both fall through to a normal network load.
  const maybeLoad = useCallback(async (finalUrl: string, fileName: string) => {
    pendingModelRef.current = { url: finalUrl, fileName };

    let st: {
      modelOptimized?: boolean | null;
      modelBytes?: number | null;
      modelOptimizeError?: string | null;
      modelOptimizedAt?: string | null;
      modelScaleFactor?: number | null;
      modelScaleWarning?: string | null;
      modelOrigin?: { lat: number; lng: number; alt: number } | null;
    } | null = null;
    try {
      st = (await api.get(`/schools/${schoolId}/kmz/status`)).data;
    } catch { /* status unavailable — proceed without cache/gate */ }

    // Georeference + scale check for measurements and 2D↔3D sync.
    const sf = Number(st?.modelScaleFactor);
    setModelGeo({
      origin: isValidOrigin(st?.modelOrigin ?? null) ? (st!.modelOrigin as GeoOrigin) : null,
      scale: Number.isFinite(sf) && sf > 0 ? sf : 1,
      scaleFactor: Number.isFinite(sf) && sf > 0 ? sf : null,
      scaleWarning: st?.modelScaleWarning ?? null,
    });

    const versionTag =
      st?.modelOptimizedAt ||
      (st?.modelBytes != null ? String(st.modelBytes) : "") ||
      "unversioned";
    cacheMetaRef.current = {
      schoolId: schoolId as string,
      versionTag,
      optimized: st?.modelOptimized ?? null,
    };

    // Cache-first: a hit is this exact build (version tag matched) — use it even
    // while the server reports the served file is still raw, since we already
    // have a good optimized copy from a previous visit.
    const cached = await readGlbCache(schoolId as string, versionTag);
    if (cached) {
      setModelPrep(null);
      setDiscovering(false);
      void loadGLBFromBuffer(cached, fileName);
      return;
    }

    if (!loadAnywayRef.current && st && st.modelOptimized === false) {
      setModelPrep({ bytes: st.modelBytes ?? null, error: st.modelOptimizeError ?? null });
      setDiscovering(false);
      if (prepPollRef.current == null) {
        prepPollRef.current = window.setInterval(async () => {
          try {
            const { data: s2 } = await api.get(`/schools/${schoolId}/kmz/status`);
            if (!s2 || s2.modelOptimized !== false) {
              if (prepPollRef.current != null) { clearInterval(prepPollRef.current); prepPollRef.current = null; }
              setModelPrep(null);
              cacheMetaRef.current = {
                schoolId: schoolId as string,
                versionTag: s2?.modelOptimizedAt || (s2?.modelBytes != null ? String(s2.modelBytes) : "") || "unversioned",
                optimized: s2?.modelOptimized ?? null,
              };
              loadGLBFromURL(finalUrl, fileName);
            } else {
              setModelPrep({ bytes: s2.modelBytes ?? null, error: s2.modelOptimizeError ?? null });
            }
          } catch { /* keep polling */ }
        }, 15_000);
      }
      return;
    }

    setModelPrep(null);
    setDiscovering(false);
    loadGLBFromURL(finalUrl, fileName);
  }, [schoolId, loadGLBFromURL, loadGLBFromBuffer]);

  const loadModelAnyway = useCallback(() => {
    loadAnywayRef.current = true;
    if (prepPollRef.current != null) { clearInterval(prepPollRef.current); prepPollRef.current = null; }
    setModelPrep(null);
    const p = pendingModelRef.current;
    if (p) loadGLBFromURL(p.url, p.fileName);
  }, [loadGLBFromURL]);

  useEffect(() => () => {
    if (prepPollRef.current != null) clearInterval(prepPollRef.current);
  }, []);

  useEffect(() => {
    if (!schoolId) return;
    api.get(`/schools/${schoolId}`)
      .then(res => setDbSchool(res.data))
      .catch(e => console.error("Failed to pre-fetch school", e));
    api.get(`/schools/${schoolId}/buildings`)
      .then(res => setDbBuildings((res.data || []).map(normalizeBuilding)))
      .catch(e => console.error("Failed to pre-fetch buildings", e));
  }, [schoolId]);

  // Discover + load the school's GLB exactly once per schoolId. Without the ref
  // guard, a failed load resets `phase` to "idle", which re-triggers this effect
  // and hammers the endpoint in an infinite retry loop.
  const discoveryForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!schoolId || phase !== "idle") return;
    if (discoveryForRef.current === schoolId) return;
    discoveryForRef.current = schoolId;
    setDiscovering(true);
    setNoModel(false);
    fetch(`${FILE_SERVER_URL}/schools/${schoolId}/3d`)
      .then(res => res.ok ? res.json() : Promise.reject("Model not found"))
      .then(data => {
        if (data?.url) {
          // The stored filename may contain spaces/unicode — encode each path
          // segment, but keep any `?v=…` cache-busting query intact.
          const [rawPath, query] = String(data.url).split("?");
          const safePath = rawPath.split("/").map(encodeURIComponent).join("/");
          const finalUrl =
            `${FILE_SERVER_URL}${safePath}` + (query ? `?${query}` : "");
          // maybeLoad owns `discovering` from here — it clears it once it has
          // decided (cache hit → load, server still optimising → prep gate,
          // ready → download). Until then the loading indicator stays up.
          void maybeLoad(finalUrl, data.filename || "model.glb");
        } else {
          setDiscovering(false);
          setNoModel(true);
        }
      })
      .catch(e => {
        console.error("Discovery failed", e);
        setDiscovering(false);
        setNoModel(true);
      });
  }, [schoolId, phase, maybeLoad]);

  useEffect(() => {
    const model = modelRef.current;
    if (!dbSchool || !model || !isModelReady || phase !== "viewing") {
      setDbMarkers([]); return;
    }
    // Same reference as measurements and fly-to: the model's own origin,
    // else the school's point (lib/school-location.ts).
    const origin = effectiveOrigin.origin;
    if (!origin) { setDbMarkers([]); return; }
    const latCenter = origin.lat, lonCenter = origin.lng;


    const latFactor = 111320, lonFactor = 111320 * Math.cos(latCenter * Math.PI / 180);
    const { x: rcX, z: rcZ } = modelRawCenterRef.current;

    const markers: any[] = [];
    for (const b of (dbBuildings || [])) {
      const lat = Number(b.latitude || b.centroidLat), lon = Number(b.longitude || b.centroidLng);
      if (!lat || !lon) continue;
      const x = (lon - lonCenter) * lonFactor - rcX;
      const z = -(lat - latCenter) * latFactor - rcZ;
      markers.push({ id: b.id, x, y: 0.5, z, label: b.name || b.code || "Block", type: "block" });
    }
    setDbMarkers(markers);

    return () => {};
  }, [dbSchool, dbBuildings, phase, isModelReady, effectiveOrigin]);

  const toggleMode = useCallback((mode: MeasureMode) => {
    setMeasureMode(prev => {
      const isNew = prev !== mode;
      // Desktop only — on a phone the list would cover the model being measured.
      if (isNew && mode !== "annotate" && window.innerWidth >= 768) setShowMeasurePanel(true);
      return isNew ? mode : null;
    });
    setVisibility("all");
    setPendingPts([]); hoverPtRef.current = null; setAnnotPendingPt(null);
  }, []);

  /** Toolbar / shortcut entry point — tools without permission do nothing. */
  const selectTool = useCallback((id: ViewerToolId) => {
    if (!canUseTool(id, hasPermission)) return;
    if (id === "navigate") {
      setMeasureMode(null); setPendingPts([]); hoverPtRef.current = null; setAnnotPendingPt(null); setPinBuildingId(null);
      return;
    }
    const mode = TOOL_MODE[id];
    if (mode) toggleMode(mode);
  }, [hasPermission, toggleMode]);

  const cancelTool = useCallback(() => {
    setMeasureMode(null); setPendingPts([]); hoverPtRef.current = null;
    setAnnotPendingPt(null); setPinBuildingId(null);
  }, []);

  const undoLastPoint = useCallback(() => {
    setPendingPts(prev => { const next = prev.slice(0, -1); pendingPtsRef.current = next; return next; });
  }, []);

  /** Saved items: own, or any with EDIT_SITE_ANNOTATIONS. Temporary: always. */
  const canChangeItem = useCallback(
    (it: { saved: boolean; createdBy?: string | null }) =>
      !it.saved || (canSaveViewerState && (canEditAnyFeature || (!!user?.id && it.createdBy === user.id))),
    [canSaveViewerState, canEditAnyFeature, user?.id],
  );

  const removeFeature = siteFeatures.remove;
  const updateFeature = siteFeatures.update;

  const deleteItem = useCallback(async (id: string) => {
    if (tempMeasures.some(m => m.id === id)) { setTempMeasures(p => p.filter(m => m.id !== id)); return; }
    if (tempAnnotations.some(a => a.id === id)) { setTempAnnotations(p => p.filter(a => a.id !== id)); return; }
    const measure = serverScene.measures.find(m => m.id === id);
    const label = measure
      ? (measure.name ? `Measurement "${measure.name}"` : "Measurement")
      : `Note "${serverScene.annotations.find(a => a.id === id)?.text || "Untitled"}"`;
    try {
      await removeFeature(id);
      notify.success(`${label} deleted`);
    } catch (err) {
      notify.error(apiErrorMessage(err, "Could not delete it. You may only delete your own measurements."));
    }
  }, [tempMeasures, tempAnnotations, removeFeature, notify, serverScene]);

  const renameItem = useCallback(async (id: string, name: string) => {
    if (tempMeasures.some(m => m.id === id)) { setTempMeasures(p => p.map(m => m.id === id ? { ...m, name } : m)); return; }
    if (tempAnnotations.some(a => a.id === id)) { setTempAnnotations(p => p.map(a => a.id === id ? { ...a, text: name } : a)); return; }
    try {
      await updateFeature(id, { label: name });
      notify.success(`Renamed to "${name}"`);
    } catch (err) {
      notify.error(apiErrorMessage(err, "Could not rename it."));
    }
  }, [tempMeasures, tempAnnotations, updateFeature, notify]);

  const exportCsv = useCallback(async () => {
    try {
      const slug = schoolName ? schoolName.replace(/[^a-zA-Z0-9]+/g, "_") : schoolId;
      await downloadSiteFeaturesCsv(schoolId, `${slug}_site_features.csv`);
      notify.success("Site features exported as CSV");
    } catch (err) {
      notify.error(apiErrorMessage(err, "Export failed. Please try again."));
    }
  }, [schoolId, schoolName, notify]);

  const cycleVisibility = useCallback(() => {
    setVisibility(prev => {
      if (prev === "all") return "annotations";
      if (prev === "annotations") return "measures";
      if (prev === "measures") return "clear";
      return "all";
    });
  }, []);

  /** Clears temporary items and every saved item the user may delete
   *  (the list panel asks for confirmation first). */
  const clearAllMeasurements = useCallback(async () => {
    setTempMeasures([]);
    setTempAnnotations([]);
    setPendingPts([]);
    hoverPtRef.current = null;
    setAnnotPendingPt(null);
    const deletable = [...serverScene.measures, ...serverScene.annotations].filter(canChangeItem);
    const results = await Promise.allSettled(deletable.map(it => removeFeature(it.id)));
    const failed = results.filter(r => r.status === "rejected").length;
    if (failed) notify.error(`${failed} item(s) could not be deleted.`);
    else notify.success("Measurements cleared");
  }, [serverScene, canChangeItem, removeFeature, notify]);

  const drawOverlay = useCallback(() => {
    const canvas = overlayRef.current; const camera = cameraRef.current;
    if (!canvas || !camera) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const model = modelRef.current;
    const raycaster = occlusionRaycasterRef.current;
    const _vOri = new THREE.Vector3(), _vDir = new THREE.Vector3();

    const isOccluded = (pt: MeasurePoint) => {
      if (!model) return false;
      const target = new THREE.Vector3(pt.x, pt.y, pt.z);
      _vOri.copy(camera.position);
      _vDir.subVectors(target, _vOri).normalize();
      raycaster.set(_vOri, _vDir);
      const hits = raycaster.intersectObject(model, true);
      if (hits.length > 0) {
        const distToHit = hits[0].distance;
        const distToPoint = camera.position.distanceTo(target);
        if (distToHit < distToPoint - 0.01) return true;
      }
      return false;
    };

    const drawLine = (pts: MeasurePoint[], color: string, dashed = false) => {
      if (pts.length < 2) return;
      ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 2;
      if (dashed) ctx.setLineDash([6, 4]); else ctx.setLineDash([]);
      let started = false;
      for (let i = 0; i < pts.length; i++) {
        if (isOccluded(pts[i])) { started = false; continue; }
        const proj = project3Dto2D(pts[i], camera, W, H);
        if (!proj) { started = false; continue; }
        if (!started) { ctx.moveTo(proj[0], proj[1]); started = true; }
        else { ctx.lineTo(proj[0], proj[1]); }
      }
      ctx.stroke();
    };

    const drawPolygon = (pts: MeasurePoint[], color: string, close = true) => {
      if (pts.length < 2) return;
      ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash([]);
      let started = false; let firstProj: [number, number] | null = null;
      let allVisible = true;
      for (let i = 0; i < pts.length; i++) {
        const visible = !isOccluded(pts[i]);
        if (!visible) allVisible = false;
        const proj = project3Dto2D(pts[i], camera, W, H);
        if (!proj || !visible) { started = false; continue; }
        if (!started) { ctx.moveTo(proj[0], proj[1]); started = true; if (i === 0) firstProj = proj; }
        else { ctx.lineTo(proj[0], proj[1]); }
      }
      if (close && firstProj && started && allVisible) ctx.lineTo(firstProj[0], firstProj[1]);
      
      if (allVisible) {
        const hex = color.replace("#", ""); 
        const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
        ctx.fillStyle = `rgba(${r},${g},${b},0.08)`; ctx.fill();
      }
      if (started) ctx.stroke();
    };

    const drawDot = (pt: MeasurePoint, color: string, r = 6) => {
      if (isOccluded(pt)) return;
      const proj = project3Dto2D(pt, camera, W, H); if (!proj) return;
      const [x, y] = proj;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.5; ctx.setLineDash([]); ctx.stroke();

      ctx.beginPath(); ctx.arc(x, y, r + 1.5, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 1; ctx.stroke();
    };

    const drawLabel = (pt: MeasurePoint, text: string, color: string) => {
      if (isOccluded(pt)) return;
      const proj = project3Dto2D(pt, camera, W, H); if (!proj) return;
      const [x, y] = proj;
      const camDist = camera.position.distanceTo(new THREE.Vector3(pt.x, pt.y, pt.z));
      const scale = Math.max(0.65, Math.min(1.5, 30 / Math.max(camDist, 0.001)));
      const fontSize = Math.round(11 * scale);
      ctx.font = `bold ${fontSize}px 'JetBrains Mono', monospace`;
      const tw = ctx.measureText(text).width;
      const padX = 6 * scale, padY = 3 * scale;
      const bw = tw + padX * 2, bh = fontSize + padY * 2;
      const bx = x - bw / 2, by = y - bh - 14 * scale;
      ctx.fillStyle = "rgba(6,11,26,0.88)";
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 4 * scale); ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 1 * scale; ctx.setLineDash([]); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, by + bh); ctx.lineTo(x, y - 6 * scale);
      ctx.strokeStyle = color + "88"; ctx.lineWidth = 1 * scale; ctx.setLineDash([3 * scale, 3 * scale]); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = color; ctx.textAlign = "center";
      ctx.fillText(text, x, by + bh - padY);
      ctx.textAlign = "left";
    };

    if (visibility === "all" || visibility === "measures") {
      measures.forEach(m => {
        if (m.mode === "distance" || m.mode === "height") {
          drawLine(m.points, m.color, !m.saved);
        } else {
          drawPolygon(m.points, m.color, true);
        }

        m.points.forEach(p => drawDot(p, m.color, 5));

        const anchor = (m.mode === "distance" || m.mode === "perimeter" || m.mode === "height")
          ? midpointAlongPolyline(m.points)
          : centroidOf(m.points);
        const text = `${m.name ? `${m.name}: ` : ""}${fmtMeasure(m.mode, m.result, unit)}${m.saved ? "" : " · not saved"}`;
        drawLabel(anchor, text, m.color);
      });
    }

    const hoverPt = hoverPtRef.current;
    const col = MEASURE_COLORS[colorIdxRef.current % MEASURE_COLORS.length];

    if (measureMode && measureMode !== "annotate") {
      if (hoverPt) drawDot(hoverPt, col, 4);

      const livePts = pendingPtsRef.current;
      if (livePts.length > 0) {
        if (livePts.length >= 2) drawLine(livePts, col, false);

        if (measureMode === "area") {
          const all = hoverPt ? [...livePts, hoverPt] : livePts;
          drawPolygon(all, col, false);
        }

        if (hoverPt) {
          const lastPt = livePts[livePts.length - 1];
          drawLine([lastPt, hoverPt], col, true);
          if (measureMode !== "distance" && measureMode !== "height" && livePts.length >= 2) {
            drawLine([livePts[0], hoverPt], col, true);
          }
        }

        livePts.forEach(p => drawDot(p, col, 5));

        if (hoverPt) {
          // Live value through the one 3D maths module (plan area for areas).
          const all = [...livePts, hoverPt];
          const scale = modelScaleRef.current;
          const liveMode = measureMode as MeasureLine["mode"];
          const liveValue = liveMode === "area"
            ? measurePolygon(all, scale).planArea
            : measureValue(liveMode, all, { scale });
          const liveLabel = fmtMeasure(liveMode, liveValue, unit);
          const liveLabelAnchor: MeasurePoint = liveMode === "area" ? centroidOf(all) : midpointAlongPolyline(all);
          drawLabel(liveLabelAnchor!, liveLabel, col);
        }
      }
    }

    const dbPulse = Math.sin(Date.now() / 250) * 0.4 + 1.2;
    const pins = buildingPinsRef.current;
    Object.entries(pins).forEach(([bId, pt]) => {
      const building = dbBuildings.find((b: any) => b.id === bId);
      if (!building || isOccluded(pt as any)) return;
      const p = project3Dto2D(pt as any, camera, W, H);
      if (!p) return;
      const [px, py] = p;
      const dist = camera.position.distanceTo(new THREE.Vector3(pt.x, pt.y, pt.z));
      const scale = Math.max(0.4, Math.min(1.2, 50 / dist));
      const isSelected = selectedBuilding?.id === bId;

      ctx.beginPath(); ctx.arc(px, py, 11 * dbPulse * scale, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? "rgba(251,191,36,0.35)" : "rgba(251,191,36,0.18)"; ctx.fill();

      ctx.beginPath(); ctx.arc(px, py, 7 * scale, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? "#fbbf24" : "#f59e0b"; ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2 * scale; ctx.setLineDash([]); ctx.stroke();

      const label = building.buildingName || building.name || "Block";
      ctx.font = `bold ${Math.round(11 * scale)}px 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif`;
      const tw = ctx.measureText(label).width;
      const padX = 6 * scale, bh = 18 * scale, bw = tw + padX * 2;
      const bx = px - bw / 2, by = py - 20 * scale - bh;

      ctx.fillStyle = "rgba(15,10,5,0.88)";
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 5 * scale); ctx.fill();
      ctx.strokeStyle = isSelected ? "rgba(251,191,36,0.6)" : "rgba(251,191,36,0.3)";
      ctx.lineWidth = 1 * scale; ctx.stroke();

      ctx.shadowBlur = 6; ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.fillStyle = isSelected ? "#fef3c7" : "#fcd34d"; ctx.textAlign = "center";
      ctx.fillText(label, px, by + bh / 2 + 4 * scale);
      ctx.shadowBlur = 0;
    });

    if (visibility === "clear") return;
    if (visibility === "all" || visibility === "annotations") {
      annotations.forEach(a => {
        if (isOccluded(a.point)) return;
        drawDot(a.point, a.color, 7);
        const proj = project3Dto2D(a.point, camera, W, H); if (!proj) return;
        const [x, y] = proj;

        ctx.font = "bold 13px 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";
        const labelText = a.text.split("\n")[0];
        const textW = ctx.measureText(labelText).width;
        const padX = 7, padY = 3, bh = 22, bw = textW + padX * 2;
        const bx = x - bw / 2, by = y - 30 - bh;

        const hr = parseInt(a.color.slice(1, 3), 16), hg = parseInt(a.color.slice(3, 5), 16), hb = parseInt(a.color.slice(5, 7), 16);
        ctx.fillStyle = `rgba(${hr},${hg},${hb},0.85)`;
        ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 10); ctx.fill();
        ctx.strokeStyle = `rgba(${hr},${hg},${hb},0.4)`; ctx.lineWidth = 1; ctx.setLineDash([]); ctx.stroke();

        ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.lineTo(x, by + bh);
        ctx.strokeStyle = `rgba(${hr},${hg},${hb},0.5)`; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.stroke();
        ctx.setLineDash([]);

        ctx.shadowBlur = 6; ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.fillStyle = "#fff"; ctx.textAlign = "center";
        ctx.fillText(labelText, x, by + padY + 13);
        ctx.shadowBlur = 0; ctx.textAlign = "left";
      });
    }

    if (annotPendingPt) drawDot(annotPendingPt, annotColor, 7);

  }, [measures, measureMode, unit, annotations, annotPendingPt, visibility, annotColor, selectedBuilding, buildingPins, dbBuildings]);

  const drawOverlayRef = useRef<() => void>(() => { });
  useEffect(() => { drawOverlayRef.current = drawOverlay; }, [drawOverlay]);

  // ── Three.js init ───────────────────────────────────────────────────────────
  const initThree = useCallback(() => {
    if (!mountRef.current) return;
    const w = mountRef.current.clientWidth, h = mountRef.current.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, precision: "highp", powerPreference: "high-performance", preserveDrawingBuffer: true, logarithmicDepthBuffer: true });
    renderer.setSize(w, h); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    
    if (rendererRef.current) {
      rendererRef.current.dispose();
      if (mountRef.current && rendererRef.current.domElement.parentNode === mountRef.current)
        mountRef.current.removeChild(rendererRef.current.domElement);
    }
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);

    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0a0a0f); sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.001, 1_000_000); camera.position.set(0, 2, 5); cameraRef.current = camera;
    scene.add(new THREE.AmbientLight(0xffffff, 1.0));
    const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(5, 10, 7); scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.5); fill.position.set(-5, 3, -5); scene.add(fill);
    const grid = new THREE.GridHelper(40, 40, 0x1a1a2e, 0x1a1a2e);
    (grid.material as THREE.Material).opacity = 0.4; (grid.material as THREE.Material).transparent = true; scene.add(grid);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.001;
    controls.maxDistance = 1_000_000;
    controls.rotateSpeed = 0.85;
    controls.zoomSpeed = 1.1;
    controls.panSpeed = 0.9;
    controls.zoomToCursor = false;         // dolly toward the orbit pivot — predictable, never drifts off-model
    controls.screenSpacePanning = true;    // right-drag pans parallel to the screen
    controls.keyPanSpeed = 24;
    controls.maxPolarAngle = Math.PI - 0.02; // don't let the orbit flip under the ground
    renderer.domElement.style.touchAction = "none";
    controlsRef.current = controls;

    const _vDir = new THREE.Vector3(), _right = new THREE.Vector3(), _forward = new THREE.Vector3(), _wu = new THREE.Vector3(0, 1, 0);

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      lastFrameAtRef.current = performance.now();
      const keys = keysRef.current;

      if (keys.size > 0 && !measureModeRef.current) {
        camera.getWorldDirection(_forward);
        _forward.y = 0; _forward.normalize();
        _right.crossVectors(_forward, _wu).normalize();
        _vDir.set(0, 0, 0);

        const sp = moveSpeedRef.current * 0.08 * (isSprintingRef.current ? 2.5 : 1);
        if (keys.has("ArrowUp") || keys.has("w") || keys.has("W")) _vDir.addScaledVector(_forward, sp);
        if (keys.has("ArrowDown") || keys.has("s") || keys.has("S")) _vDir.addScaledVector(_forward, -sp);
        if (keys.has("ArrowLeft") || keys.has("a") || keys.has("A")) _vDir.addScaledVector(_right, -sp);
        if (keys.has("ArrowRight") || keys.has("d") || keys.has("D")) _vDir.addScaledVector(_right, sp);
        if (keys.has("e") || keys.has("E") || keys.has(" ")) _vDir.addScaledVector(_wu, sp);
        if (keys.has("q") || keys.has("Q") || keys.has("f") || keys.has("F")) _vDir.addScaledVector(_wu, -sp);

        if (keys.has("rotateLeft")) controls.rotateLeft(0.03 * (isSprintingRef.current ? 2.5 : 1.0));
        if (keys.has("rotateRight")) controls.rotateLeft(-0.03 * (isSprintingRef.current ? 2.5 : 1.0));

        velocityRef.current.add(_vDir);
      }

      velocityRef.current.multiplyScalar(0.85);

      if (velocityRef.current.lengthSq() > 0.000001) {
        camera.position.add(velocityRef.current);
        controls.target.add(velocityRef.current);
      }

      controls.update();

      // Keep the orbit pivot inside the padded model box — zoomToCursor can
      // otherwise walk `controls.target` off the model until the view is empty.
      const mb = modelBoundsRef.current;
      if (mb && !measureModeRef.current) {
        const tx = Math.min(Math.max(controls.target.x, mb.min.x), mb.max.x);
        const ty = Math.min(Math.max(controls.target.y, mb.min.y), mb.max.y);
        const tz = Math.min(Math.max(controls.target.z, mb.min.z), mb.max.z);
        if (tx !== controls.target.x || ty !== controls.target.y || tz !== controls.target.z) {
          camera.position.x += tx - controls.target.x;
          camera.position.y += ty - controls.target.y;
          camera.position.z += tz - controls.target.z;
          controls.target.set(tx, ty, tz);
        }
      }

      // Enforce the min-zoom on fly movement too (OrbitControls only clamps its
      // own dolly). Push the camera back out along the view ray if it crept in.
      const mz = minZoomRef.current;
      if (mz > 0) {
        const d = camera.position.distanceTo(controls.target);
        if (d < mz && d > 1e-4) {
          camera.position.sub(controls.target).multiplyScalar(mz / d).add(controls.target);
        }
      }

      if (camera.position.distanceToSquared(_prevCamPosRef.current) > 1e-14) {
        _prevCamPosRef.current.copy(camera.position);
        interactingRef.current = true;
        if (showLabelsTimerRef.current) clearTimeout(showLabelsTimerRef.current);
        showLabelsTimerRef.current = setTimeout(() => {
          interactingRef.current = false;
          showLabelsTimerRef.current = null;
        }, 150);
      }

      renderer.render(scene, camera);
      if (overlayRef.current) drawOverlayRef.current();
    };

    // Expose a safe restart so the watchdog (or a future teardown regression)
    // can revive the loop instead of leaving a frozen viewer.
    restartLoopRef.current = () => {
      cancelAnimationFrame(animFrameRef.current);
      animate();
    };
    animate();

    if (keyLoopWatchdogRef.current) clearInterval(keyLoopWatchdogRef.current);
    keyLoopWatchdogRef.current = setInterval(() => {
      if (
        rendererRef.current &&
        document.visibilityState === "visible" &&
        performance.now() - lastFrameAtRef.current > 1500
      ) {
        restartLoopRef.current?.();
      }
    }, 2000);

    // Signal to finalizeGLTF that sceneRef / cameraRef / controlsRef are ready
    threeInitResolveRef.current?.();
    threeInitResolveRef.current = null;

    const handleResize = () => {
      if (!mountRef.current) return;
      const nw = mountRef.current.clientWidth, nh = mountRef.current.clientHeight;
      if (nw === 0 || nh === 0) return;
      camera.aspect = nw / nh; camera.updateProjectionMatrix(); renderer.setSize(nw, nh);
      if (overlayRef.current) { overlayRef.current.width = nw; overlayRef.current.height = nh; }
    };
    window.addEventListener("resize", handleResize);
    // Also react to container-only size changes (side panels, inspector docks…).
    const ro = new ResizeObserver(handleResize);
    ro.observe(mountRef.current);
    return () => {
      window.removeEventListener("resize", handleResize);
      ro.disconnect();
      if (keyLoopWatchdogRef.current) clearInterval(keyLoopWatchdogRef.current);
    };
  }, []);

  // ── Eagerly start Three.js as soon as the canvas div is in the DOM (loading phase).
  // A ref guard prevents re-init on the loading→viewing transition.
  const threeStartedRef = useRef(false);
  const threeResizeCleanupRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    if (phase === "idle") return;              // canvas not in DOM yet
    if (threeStartedRef.current) return;       // already running
    threeStartedRef.current = true;
    threeResizeCleanupRef.current = initThree() ?? undefined;
  }, [phase, initThree]);

  // Full Three.js teardown — MUST be unmount-only. With deps here, adding a
  // measurement or toggling visibility used to run this cleanup, which cancels
  // the render loop; with damping on, the camera then never updates again and
  // the whole viewer looks frozen (no orbit / zoom / pan).
  useEffect(() => () => {
    threeResizeCleanupRef.current?.();
    cancelAnimationFrame(animFrameRef.current);
    if (keyLoopWatchdogRef.current) clearInterval(keyLoopWatchdogRef.current);
  }, []);

  // Keyboard fly-navigation (WASD / arrows to move, Q·E to drop/rise, Shift to
  // sprint). Without this the keys were read by the render loop but nothing
  // ever populated the set, so only the on-screen d-pad worked.
  useEffect(() => {
    if (phase === "idle") return;
    // Keys the render loop understands (it matches raw e.key: "w", "ArrowUp", " ", …).
    const NAV_KEYS = new Set([
      "w", "a", "s", "d", "q", "e", "f", " ",
      "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
    ]);
    const keyOf = (e: KeyboardEvent) =>
      e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const isTyping = (el: EventTarget | null) => {
      const n = el as HTMLElement | null;
      if (!n) return false;
      return (
        n.tagName === "INPUT" ||
        n.tagName === "TEXTAREA" ||
        n.tagName === "SELECT" ||
        n.isContentEditable
      );
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.key === "Shift") setIsSprinting(true);
      const k = keyOf(e);
      if (!NAV_KEYS.has(k)) return;
      e.preventDefault();
      keysRef.current.add(k);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") setIsSprinting(false);
      keysRef.current.delete(keyOf(e));
    };
    const clearAll = () => {
      keysRef.current.clear();
      setIsSprinting(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clearAll);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearAll);
      clearAll();
    };
  }, [phase, setIsSprinting]);

  // Overlay canvas sizing — runs whenever the canvas becomes visible
  useEffect(() => {
    if (phase === "idle") return;
    const resize = () => {
      const el = overlayRef.current; if (!el || !mountRef.current) return;
      el.width = mountRef.current.clientWidth; el.height = mountRef.current.clientHeight;
    };
    resize(); window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [phase]);

  // ── Keys & Finalization
  const finalizeMeasure = useCallback((ptsOverride?: MeasurePoint[]) => {
    const pts = ptsOverride ?? pendingPtsRef.current;
    if (!pts.length || !measureMode || measureMode === "annotate") return;
    if (pts.length < 2) { setPendingPts([]); hoverPtRef.current = null; return; }
    const mode = measureMode as MeasureLine["mode"];

    const v = computeMeasure(mode, pts, modelScaleRef.current);
    if (mode === "area") {
      const validity = measurePolygon(pts).validity;
      if (validity.issue === "too-few-points" || validity.issue === "collinear") {
        notify.warning(validity.message ?? "That shape has no area.");
        return; // keep the points so the user can add more / undo
      }
      if (validity.issue === "self-intersecting") notify.warning(validity.message ?? "The outline crosses itself.");
    }

    const col = MEASURE_COLORS[colorIdxRef.current % MEASURE_COLORS.length]; colorIdxRef.current++;
    const m: MeasureLine = {
      id: `tmp-${uid()}`, points: [...pts], mode, result: v.result, surface: v.surface, warning: v.warning,
      name: null, color: col, saved: false, source: "3d", createdByName: user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : null,
      createdAt: new Date().toISOString(),
    };
    setPendingPts([]);
    pendingPtsRef.current = [];
    hoverPtRef.current = null;

    const { origin, approximate } = effectiveOriginRef.current;
    const frame = getSceneFrame();
    if (canSaveViewerStateRef.current && origin && frame) {
      // Saved for everyone; the list refreshes live in both viewers.
      createFeature(measureToFeature(m, origin, frame, approximate)).then(() => {
        notify.success("Measurement saved");
      }, () => {
        notify.error("Could not save the measurement — kept on this screen only.");
        setTempMeasures(prev => [...prev, m]);
      });
    } else {
      setTempMeasures(prev => [...prev, m]);
    }
  }, [measureMode, notify, user, getSceneFrame, createFeature]);

  // ── Interaction Logic ────────────────────────────────────────────────────────
  const getAccurateRaycastPt = useCallback((e: React.MouseEvent<HTMLDivElement>): MeasurePoint | null => {
    if (!overlayRef.current || !cameraRef.current || !modelRef.current) return null;
    const rect = overlayRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycasterRef.current.setFromCamera(mouse, cameraRef.current);
    const hits = raycasterRef.current.intersectObject(modelRef.current, true);
    if (hits.length > 0) return { x: hits[0].point.x, y: hits[0].point.y, z: hits[0].point.z };
    return null;
  }, []);

  const getFastHoverRaycastPt = useCallback((e: React.MouseEvent<HTMLDivElement>): MeasurePoint | null => {
    const canvas = overlayRef.current, camera = cameraRef.current, model = modelRef.current;
    if (!canvas || !camera) return null;
    const rect = canvas.getBoundingClientRect();
    const mouse = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycasterRef.current.setFromCamera(mouse, camera);
    if (model) {
      const hits = raycasterRef.current.intersectObject(model, true);
      if (hits.length > 0) return { x: hits[0].point.x, y: hits[0].point.y, z: hits[0].point.z };
    }
    const plane = new THREE.Plane(), camDir = new THREE.Vector3(); camera.getWorldDirection(camDir);
    let referencePt = new THREE.Vector3();
    const pts = pendingPtsRef.current;
    if (pts.length > 0) { const last = pts[pts.length - 1]; referencePt.set(last.x, last.y, last.z); }
    else if (controlsRef.current) { referencePt.copy(controlsRef.current.target); }
    plane.setFromNormalAndCoplanarPoint(camDir.multiplyScalar(-1), referencePt);
    const target = new THREE.Vector3(), hit = raycasterRef.current.ray.intersectPlane(plane, target);
    return hit ? { x: target.x, y: target.y, z: target.z } : null;
  }, []);

  const handleOverlayMouseDown = (e: React.MouseEvent) => {
    mousePosRef.current = { x: e.clientX, y: e.clientY };
    isDraggingMapRef.current = false;
  };

  const raycastThrottleRef = useRef<number>(0);
  const handleOverlayMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const dist = Math.hypot(e.clientX - mousePosRef.current.x, e.clientY - mousePosRef.current.y);
    if (dist > 5) isDraggingMapRef.current = true;
    if (!measureMode && !pinBuildingId) { hoverPtRef.current = null; return; }
    const now = Date.now();
    if (now - raycastThrottleRef.current < 28) return; // ~35fps
    raycastThrottleRef.current = now;
    const pt = getFastHoverRaycastPt(e); if (!pt) { hoverPtRef.current = null; return; }
    hoverPtRef.current = pt;
    if ((measureMode as string) === "annotate") setAnnotPendingPt(pt);
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingMapRef.current) return;
    if (e.button !== 0) return;
    const ptAccurate = getAccurateRaycastPt(e);

    // 1. Pin mode placement
    if (pinBuildingIdRef.current && !measureMode) {
      if (!ptAccurate) return;
      const bId = pinBuildingIdRef.current; setPinBuildingId(null);
      const cam = cameraRef.current, ctrl = controlsRef.current;
      let camHome: CameraHome | undefined;
      if (cam && ctrl) camHome = { position: { ...cam.position }, target: { ...ctrl.target }, near: cam.near, far: cam.far };
      setBuildingPins(prev => ({ ...prev, [bId]: { ...ptAccurate, camera: camHome } }));
      notify.success(`Pin placed for "${dbBuildingsRef.current.find(b => b.id === bId)?.buildingName || "building"}"`);
      return;
    }

    // 2. Selection mode (click on markers/pins)
    if (!measureMode) {
      const W = mountRef.current?.clientWidth || 0, H = mountRef.current?.clientHeight || 0;
      const hit = Object.entries(buildingPinsRef.current).find(([_, pt]) => {
        const proj = project3Dto2D(pt, cameraRef.current!, W, H); if (!proj) return false;
        return Math.hypot(proj[0] - e.clientX, proj[1] - e.clientY) < 25;
      });
      if (hit) {
        const b = dbBuildingsRef.current.find(bg => bg.id === hit[0]);
        if (b) setSelectedBuilding(b);
      } else if (selectedBuilding) {
        setSelectedBuilding(null);
      }
      return;
    }

    // 3. Annotation placement
    if ((measureMode as string) === "annotate") {
      if (!ptAccurate) return;
      setAnnotPendingPt(ptAccurate); setAnnotPickerOpen(true);
      return;
    }

    // 4. Distance / Area measurements
    const pt = hoverPtRef.current; if (!pt) return;
    const prev = pendingPtsRef.current;
    if (prev.length > 0 && new THREE.Vector3(prev[prev.length - 1].x, prev[prev.length - 1].y, prev[prev.length - 1].z).distanceTo(new THREE.Vector3(pt.x, pt.y, pt.z)) < 0.001) return;
    const next = [...prev, pt]; pendingPtsRef.current = next; setPendingPts(next);
    // Height needs exactly two points: base, then top.
    if (measureMode === "height" && next.length === 2) finalizeMeasure(next);
  };

  const handleOverlayContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (measureMode && measureMode !== "annotate" && pendingPts.length >= 2) finalizeMeasure();
    else if (measureMode) { setMeasureMode(null); setPendingPts([]); hoverPtRef.current = null; setAnnotPendingPt(null); }
  };

  const handleOverlayDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (measureMode) {
      if ((measureMode as string) !== "annotate" && pendingPts.length >= 2) finalizeMeasure();
      return;
    }
    // Not measuring → "focus here": smoothly recentre the orbit pivot on the
    // double-clicked surface point and dolly ~35% closer. Standard 3D/GIS UX.
    const pt = getAccurateRaycastPt(e);
    const cam = cameraRef.current, ctrl = controlsRef.current;
    if (!pt || !cam || !ctrl) return;
    const endTarget = new THREE.Vector3(pt.x, pt.y, pt.z);
    const startTarget = ctrl.target.clone();
    const startPos = cam.position.clone();
    const endPos = startPos.clone().lerp(endTarget, 0.35);
    velocityRef.current.set(0, 0, 0);
    const t0 = performance.now();
    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / 450);
      const k = 1 - Math.pow(1 - t, 3);
      ctrl.target.lerpVectors(startTarget, endTarget, k);
      cam.position.lerpVectors(startPos, endPos, k);
      ctrl.update();
      if (t < 1) requestAnimationFrame(step);
    };
    step();
  };

  // ── Camera Actions ──────────────────────────────────────────────────────────
  const handleResetCamera = useCallback(() => {
    const cam = cameraRef.current, ctrl = controlsRef.current; if (!cam || !ctrl) return;
    let home = cameraHomeRef.current;
    if (loadedFileNameRef.current) {
      try { const s = localStorage.getItem(getHomeKey(loadedFileNameRef.current, modelSigRef.current)); if (s) home = JSON.parse(s); } catch { }
    }
    if (!home) return;
    cam.position.copy(new THREE.Vector3(home.position.x, home.position.y, home.position.z));
    cam.near = home.near; cam.far = home.far; cam.updateProjectionMatrix();
    ctrl.target.copy(new THREE.Vector3(home.target.x, home.target.y, home.target.z)); ctrl.update();
    velocityRef.current.set(0, 0, 0);
  }, []);

  const handleSaveHome = useCallback(() => {
    const cam = cameraRef.current, ctrl = controlsRef.current; if (!cam || !ctrl) return;
    const home: CameraHome = { position: { ...cam.position }, target: { ...ctrl.target }, near: cam.near, far: cam.far };
    cameraHomeRef.current = home; saveJson(LS_HOME_KEY, home);
    if (loadedFileNameRef.current) saveJson(getHomeKey(loadedFileNameRef.current, modelSigRef.current), home);
    scheduleSave(); setSaveFlash(true); setTimeout(() => setSaveFlash(false), 1200);
    notify.success("Home view saved");
  }, [scheduleSave, notify]);

  const speedUp = useCallback(() => { setSpeedIdx(p => { const n = Math.min(p + 1, SPEED_STEPS.length - 1); moveSpeedRef.current = SPEED_STEPS[n]; return n; }); }, []);
  const speedDown = useCallback(() => { setSpeedIdx(p => { const n = Math.max(p - 1, 0); moveSpeedRef.current = SPEED_STEPS[n]; return n; }); }, []);

  const toggleOrientation = useCallback(() => {
    const model = modelRef.current; if (!model) return;
    model.rotation.x -= Math.PI / 2; model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model), center = box.getCenter(new THREE.Vector3());
    model.position.set(-center.x, -box.min.y, -center.z); model.updateMatrixWorld(true);
    setFrameVersion(v => v + 1); // saved features follow the model
    handleResetCamera();
  }, [handleResetCamera]);

  const setView = useCallback((dir: "top" | "front" | "back" | "left" | "right") => {
    const model = modelRef.current; if (!model) return;
    const cam = cameraRef.current, ctrl = controlsRef.current; if (!cam || !ctrl) return;
    const box = new THREE.Box3().setFromObject(model), center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    const dist = Math.max(size.x, size.y, size.z) * 1.25; velocityRef.current.set(0, 0, 0);
    const pos = center.clone(); 
    if (dir === "top") pos.y += dist; if (dir === "front") pos.z += dist; if (dir === "back") pos.z -= dist; if (dir === "left") pos.x -= dist; if (dir === "right") pos.x += dist;
    cam.position.copy(pos); cam.lookAt(center); ctrl.target.copy(center); ctrl.update();
  }, []);

  const handleScreenshot = useCallback(() => {
    const renderer = rendererRef.current, overlay = overlayRef.current; if (!renderer || !overlay) return;
    renderer.render(sceneRef.current!, cameraRef.current!); drawOverlayRef.current();
    const out = document.createElement("canvas"); out.width = renderer.domElement.width; out.height = renderer.domElement.height;
    const ctx = out.getContext("2d"); if (!ctx) return;
    ctx.drawImage(renderer.domElement, 0, 0); ctx.drawImage(overlay, 0, 0, out.width, out.height);
    const slug = schoolName ? schoolName.replace(/[^a-zA-Z0-9]+/g, "_") : "rtb_3d_viewer";
    try {
      const link = document.createElement("a"); link.href = out.toDataURL("image/png"); link.download = `${slug}_3d.png`; link.click();
    } catch (err) {
      console.error("Screenshot failed:", err);
      notify.error("Could not save the screenshot.");
      return;
    }
    setScreenshotFlash(true); setTimeout(() => setScreenshotFlash(false), 1200);
    notify.success("Screenshot saved");
  }, [schoolName, notify]);

  // ── Asset Loading ───────────────────────────────────────────────────────────
  // ── Asset Loading ───────────────────────────────────────────────────────────
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) loadGLB(f); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) loadGLB(f); };

  // ── Annotations ─────────────────────────────────────────────────────────────
  const submit3DAnnotation = useCallback((iconType: string, title: string, _description: string, mapColor: string) => {
    if (!annotPendingPt) return;
    const emoji = ICON_EMOJI_MAP[iconType] || "";
    const label = [emoji, title].filter(Boolean).join(" ") || "Note";
    const a: Annotation = {
      id: `tmp-${uid()}`, point: annotPendingPt, text: label,
      color: mapColor || ANNOT_COLORS[colorIdxRef.current++ % ANNOT_COLORS.length],
      saved: false, source: "3d", createdAt: new Date().toISOString(),
    };
    const { origin, approximate } = effectiveOriginRef.current;
    const frame = getSceneFrame();
    if (canSaveViewerStateRef.current && origin && frame) {
      createFeature(annotationToFeature(a, origin, frame, approximate)).then(() => {
        notify.success(`Note "${title || "Note"}" saved`);
      }, () => {
        notify.error("Could not save the note — kept on this screen only.");
        setTempAnnotations(prev => [...prev, a]);
      });
    } else {
      setTempAnnotations(prev => [...prev, a]);
    }
    setAnnotPickerOpen(false); setAnnotPendingPt(null); setMeasureMode(null);
  }, [annotPendingPt, getSceneFrame, createFeature, notify]);

  const cancelAnnotation = () => { setAnnotPickerOpen(false); setAnnotPendingPt(null); setPinBuildingId(null); };
  const flyToPoint = useCallback((pt: MeasurePoint & { camera?: CameraHome }) => {
    const cam = cameraRef.current, ctrl = controlsRef.current; if (!cam || !ctrl) return;
    const target = new THREE.Vector3(pt.x, pt.y, pt.z);
    const startPos = cam.position.clone(), startTarget = ctrl.target.clone();
    let endPos: THREE.Vector3;
    if (pt.camera) {
      endPos = new THREE.Vector3(pt.camera.position.x, pt.camera.position.y, pt.camera.position.z);
    } else {
      endPos = target.clone().add(new THREE.Vector3(2, 5, 3));
    }
    const t0 = Date.now();
    const step = () => {
      const t = Math.min(1, (Date.now() - t0) / 1000), e = 1 - Math.pow(1 - t, 3);
      cam.position.lerpVectors(startPos, endPos, e); ctrl.target.lerpVectors(startTarget, target, e);
      if (pt.camera) { cam.near = pt.camera.near; cam.far = pt.camera.far; cam.updateProjectionMatrix(); }
      ctrl.update(); if (t < 1) requestAnimationFrame(step);
    };
    step();
  }, []);

  // ── Shortcuts, selection sync, measurement list (WS4 / WS5.6) ──────────────

  /** Fly to a lat/lng on the model (bridge → scene, draped on the surface). */
  const flyToLatLng = useCallback((lat: number, lng: number) => {
    const { origin } = effectiveOriginRef.current;
    const frame = getSceneFrame();
    if (!origin || !frame || !Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    const p = frame.toScene(wgs84ToModel({ lat, lng, alt: origin.alt }, origin));
    const y = frame.drapeY?.(p.x, p.z);
    if (y != null) p.y = y;
    flyToPoint(p);
    return true;
  }, [getSceneFrame, flyToPoint]);

  /** Select a building and fly to its pin, else to its recorded coordinate. */
  type GeoBuilding = { id: string; latitude?: unknown; longitude?: unknown; centroidLat?: unknown; centroidLng?: unknown; geolocation?: { latitude?: unknown; longitude?: unknown } };
  const focusBuilding = useCallback((b: GeoBuilding | null | undefined, fallback?: { lat: number | null; lng: number | null }) => {
    if (!b) return;
    setSelectedBuilding(b);
    const pin = buildingPinsRef.current[b.id] as (MeasurePoint & { camera?: CameraHome }) | undefined;
    if (pin) { flyToPoint(pin); return; }
    const lat = Number(b.geolocation?.latitude ?? b.latitude ?? b.centroidLat ?? fallback?.lat);
    const lng = Number(b.geolocation?.longitude ?? b.longitude ?? b.centroidLng ?? fallback?.lng);
    flyToLatLng(lat, lng);
  }, [flyToPoint, flyToLatLng]);

  // Deep link from the 2D map: ?building=<id>&lat=&lng= — select + fly once.
  const deepLinkDoneRef = useRef(false);
  useEffect(() => {
    if (deepLinkDoneRef.current || !isModelReady) return;
    const fromUrl = readViewerDeepLink(window.location.search);
    // A building handed over by the 2D map wins over the URL.
    const link = focusBuildingId ? { ...fromUrl, buildingId: focusBuildingId } : fromUrl;
    if (!link.buildingId && link.lat == null) { deepLinkDoneRef.current = true; return; }
    if (link.buildingId && !dbBuildings.length) return; // wait for buildings
    deepLinkDoneRef.current = true;
    const b = link.buildingId ? dbBuildings.find(x => x.id === link.buildingId) : null;
    if (b) focusBuilding(b, link);
    else if (link.lat != null && link.lng != null) flyToLatLng(link.lat, link.lng);
  }, [isModelReady, dbBuildings, focusBuilding, flyToLatLng, focusBuildingId]);

  // Selection sync with an open 2D map tab (same browser).
  const remoteSelectionRef = useRef(false);
  const firstSelectionRef = useRef(true);
  useEffect(() => {
    if (firstSelectionRef.current) { firstSelectionRef.current = false; return; }
    if (remoteSelectionRef.current) { remoteSelectionRef.current = false; return; }
    if (schoolId) broadcastSelection({ schoolId, buildingId: selectedBuilding?.id ?? null, from: "3d" });
  }, [selectedBuilding?.id, schoolId]);
  useEffect(() => {
    if (!schoolId) return;
    return onSelection(schoolId, "3d", (buildingId) => {
      remoteSelectionRef.current = true;
      if (!buildingId) { setSelectedBuilding(null); return; }
      const b = dbBuildingsRef.current.find(x => x.id === buildingId);
      if (b) focusBuilding(b); else remoteSelectionRef.current = false;
    });
  }, [schoolId, focusBuilding]);

  const open2DView = useCallback(() => {
    const b = selectedBuilding;
    if (on2DView) { on2DView(b?.id ?? null); return; }
    const lat = Number(b?.geolocation?.latitude ?? b?.latitude);
    const lng = Number(b?.geolocation?.longitude ?? b?.longitude);
    let ll: { lat: number | null; lng: number | null } = { lat: Number.isFinite(lat) && lat ? lat : null, lng: Number.isFinite(lng) && lng ? lng : null };
    // No building coordinate → send the camera target, converted to WGS84.
    if (ll.lat == null && controlsRef.current && effectiveOriginRef.current.origin) {
      const frame = getSceneFrame();
      if (frame) {
        const g = modelToWgs84(frame.toModel(controlsRef.current.target), effectiveOriginRef.current.origin);
        ll = { lat: Number(g.lat.toFixed(7)), lng: Number(g.lng.toFixed(7)) };
      }
    }
    navigate(viewerLink("2d", schoolId, { buildingId: b?.id ?? null, ...ll }));
  }, [selectedBuilding, schoolId, getSceneFrame, on2DView, navigate]);

  // Keyboard: tool shortcuts, Esc cancel, Backspace / Ctrl+Z undo, Enter finish, ? help.
  useEffect(() => {
    if (phase !== "viewing") return;
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || annotPickerOpen || drawerOpen) return;
      const mode = measureModeRef.current;
      if (e.key === "Escape") {
        if (mode || pinBuildingIdRef.current) { e.preventDefault(); cancelTool(); }
        return;
      }
      if (mode && mode !== "annotate") {
        if (e.key === "Backspace" || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z")) { e.preventDefault(); undoLastPoint(); return; }
        if (e.key === "Enter") { e.preventDefault(); finalizeMeasure(); return; }
      }
      if (e.key === "?") { setShowHelp(v => !v); return; }
      const tool = toolForKey(e, "3d");
      if (tool) { e.preventDefault(); selectTool(tool); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, annotPickerOpen, drawerOpen, cancelTool, undoLastPoint, finalizeMeasure, selectTool]);

  const measureRows = useMemo<MeasurementRow[]>(() => {
    const fmt = (m: MeasureLine) =>
      m.mode === "area" ? formatMeasureArea(m.result, m.source, unit) : formatMeasureLength(m.result, m.source, unit);
    const kindName: Record<MeasureLine["mode"], string> = { distance: "Distance", area: "Area", perimeter: "Perimeter", height: "Height" };
    return [
      ...measures.map((m): MeasurementRow => ({
        id: m.id,
        name: m.name || kindName[m.mode],
        kind: `measure_${m.mode}` as MeasurementRow["kind"],
        value: m.mode === "area" ? `${fmt(m)} plan` : fmt(m),
        secondary: m.mode === "area" && m.surface != null ? `Surface (sloped): ${formatMeasureArea(m.surface, "3d", unit)}` : null,
        warning: m.warning,
        source: m.source,
        createdByName: m.createdByName,
        createdAt: m.createdAt,
        saved: m.saved,
        canEdit: canChangeItem(m),
        canDelete: canChangeItem(m),
        color: m.color,
      })),
      ...annotations.map((a): MeasurementRow => ({
        id: a.id, name: a.text, kind: "note", value: "", source: a.source,
        createdByName: a.createdByName, createdAt: a.createdAt, saved: a.saved,
        canEdit: canChangeItem(a), canDelete: canChangeItem(a), color: a.color,
      })),
    ];
  }, [measures, annotations, unit, canChangeItem]);

  const flyToItem = useCallback((id: string) => {
    const m = measures.find(x => x.id === id);
    if (m) { flyToPoint(m.mode === "area" ? centroidOf(m.points) : midpointAlongPolyline(m.points)); return; }
    const a = annotations.find(x => x.id === id);
    if (a) flyToPoint(a.point);
  }, [measures, annotations, flyToPoint]);

  // ── API Operations ──────────────────────────────────────────────────────────
  /** `quiet`: the caller (e.g. the media tab) reports the outcome itself, so
   *  skip the toast and re-throw failures. */
  const handleUpdateBuilding = async (data: BuildingData, { quiet = false } = {}) => {
    try {
      setIsSaving(true); setSaveError(null);
      const isNew = typeof data.id === "string" && data.id.startsWith("new-");
      const method = isNew ? "post" : "patch";
      const url = isNew ? `/schools/${schoolId}/buildings` : `/schools/buildings/${data.id}`;

      // Map to backend schema (Same as 2D view)
      const payload = {
        // Blank fields → null (not recorded), never 0 or a default.
        ...buildingPayloadFields(data),
        latitude: data.geolocation.latitude, longitude: data.geolocation.longitude,
        annotations: (data.annotations || []).filter((a: any) => a !== null && typeof a === "object" && !Array.isArray(a)),
        media: data.media || [],
        facilities: (data.facilities || []).map((f: any) => ({
          facility_id: f.facility_id, facility_name: f.facility_name, number_of_rooms: parseInt(String(f.number_of_rooms)) || 0
        }))
      };

      const resp = await api[method](url, payload);
      const updated = normalizeBuilding(resp.data);
      if (isNew) {
        setDbBuildings(prev => [...prev, updated]);
        setPinBuildingId(updated.id);
      } else {
        setDbBuildings(prev => prev.map(b => b.id === updated.id ? updated : b));
      }
      if (selectedBuilding?.id === updated.id || isNew) setSelectedBuilding(updated);
      setDrawerOpen(false);
      if (!quiet) {
        const name = updated.buildingName || data.buildingName || "Building";
        notify.success(isNew ? `Building "${name}" added` : `Building "${name}" saved`);
      }
    } catch (err: any) {
      if (quiet) throw err;
      // Shown inline in the error bar / drawer.
      setSaveError(apiErrorMessage(err, "Operation failed"));
    }
    finally { setIsSaving(false); }
  };

  /** The building panel only edits media: send just that list. */
  const saveBuildingMedia = async (b: BuildingData) => {
    const { data } = await api.patch(`/schools/buildings/${b.id}`, { media: b.media || [] });
    const updated = normalizeBuilding(data);
    setDbBuildings((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    setSelectedBuilding((cur: { id?: string } | null) => (cur?.id === updated.id ? updated : cur));
  };

  // BuildingsListPanel (the only caller) already asks for confirmation.
  const handleDeleteBuilding = async (id: string) => {
    const name = dbBuildings.find(b => b.id === id)?.buildingName || "Building";
    try {
      await api.delete(`/schools/buildings/${id}`);
      setDbBuildings(prev => prev.filter(b => b.id !== id));
      setBuildingPins(prev => { const n = { ...prev }; delete n[id]; return n; });
      if (selectedBuilding?.id === id) setSelectedBuilding(null);
      notify.success(`Building "${name}" deleted`);
    } catch (e) {
      console.error(e);
      notify.error(apiErrorMessage(e, "Could not delete the building."));
    }
  };

  return (
    <div className="glb-root">
      {(error || saveError) && <div className="error-bar"><span>⚠</span> {error || saveError}</div>}
      {isSaving && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-primary/20 backdrop-blur-md border border-primary/30 rounded-full text-[10px] font-black text-primary uppercase tracking-[0.2em] animate-pulse">
          Saving Changes...
        </div>
      )}
      {phase === "idle" && discovering && !modelPrep && (
        <div className="loading-overlay">
          <div className="spinner-ring" />
          <div className="progress-label">Loading 3D model…</div>
        </div>
      )}
      {phase === "idle" && modelPrep && (
        <div className="loading-overlay">
          <div className="spinner-ring" />
          <div className="progress-label">Preparing an optimized 3D model on the server…</div>
          <div style={{ opacity: 0.7, fontSize: 12, marginTop: 10, maxWidth: 440, textAlign: "center", lineHeight: 1.6 }}>
            This runs in the background — you can leave this page and come back.
            {modelPrep.bytes ? ` The raw model is ${(modelPrep.bytes / 1_048_576).toFixed(0)} MB.` : ""}
            {modelPrep.error ? ` Last attempt: ${modelPrep.error}.` : ""}
          </div>
          <button
            onClick={loadModelAnyway}
            style={{ marginTop: 16, padding: "8px 16px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", borderRadius: 999, border: "1px solid rgba(255,255,255,0.25)", background: "transparent", color: "inherit" }}
          >
            Load raw model anyway (large, may be slow)
          </button>
        </div>
      )}
      {phase === "idle" && noModel && !discovering && !modelPrep && (
        <ViewerLoadingScreens phase={phase} progress={progress} progressLabel={progressLabel} isDragging={isDragging} schoolName={schoolName} setIsDragging={setIsDragging} handleDrop={handleDrop} handleInputChange={handleInputChange} />
      )}
      {phase !== "idle" && (
        <div className="viewer-wrapper">
          <ViewerMainCanvas
            ref={mountRef} overlayRef={overlayRef} progress={progress} progressLabel={progressLabel}
            measureMode={measureMode} isPinMode={!!pinBuildingId}
            onMouseDown={handleOverlayMouseDown}
            handleOverlayMouseMove={handleOverlayMouseMove}
            handleOverlayClick={handleOverlayClick}
            handleOverlayDoubleClick={handleOverlayDoubleClick}
            handleOverlayContextMenu={handleOverlayContextMenu}
          />
          {phase === "viewing" && (
            <>
              <ViewerCameraNav setView={setView} />
              <ViewerRightToolbar
                onClose={onClose} showHelp={showHelp} setShowHelp={setShowHelp}
                showBuildingsList={showBuildingsList} setShowBuildingsList={setShowBuildingsList}
                buildingsCount={dbBuildings.length} renderMode={renderMode} setRenderMode={setRenderMode}
                modeLabels={MODE_LABELS} speedIdx={speedIdx} speedSteps={SPEED_STEPS} speedUp={speedUp} speedDown={speedDown}
                activeTool={measureMode ? MODE_TOOL[measureMode] : "navigate"} onSelectTool={selectTool}
                showMeasurePanel={showMeasurePanel} setShowMeasurePanel={setShowMeasurePanel} measureCount={measureRows.length}
                visibility={visibility} cycleVisibility={cycleVisibility}
                handleScreenshot={handleScreenshot} screenshotFlash={screenshotFlash}
                handleResetCamera={handleResetCamera} handleSaveHome={handleSaveHome} saveFlash={saveFlash} toggleOrientation={toggleOrientation}
                on2DView={schoolId ? open2DView : undefined}
              />
              {measureMode && (
                <ActiveToolBanner
                  tool={MODE_TOOL[measureMode]}
                  pointCount={pendingPts.length}
                  liveValue={(() => {
                    if (measureMode === "annotate" || pendingPts.length < 2) return null;
                    const mode = measureMode as MeasureLine["mode"];
                    return fmtMeasure(mode, computeMeasure(mode, pendingPts, modelGeo.scale).result, unit);
                  })()}
                  accuracy={accuracyLabel("3d")}
                  warning={measureMode === "area" && pendingPts.length >= 4 ? measurePolygon(pendingPts).validity.message : null}
                  notSaved={measureMode !== "annotate" && canMeasure && !canSaveViewerState}
                  onUndo={measureMode !== "annotate" ? undoLastPoint : undefined}
                  onFinish={measureMode !== "annotate" && measureMode !== "height" ? () => finalizeMeasure() : undefined}
                  onCancel={cancelTool}
                />
              )}
              {modelGeo.scaleWarning && <ModelScaleBanner warning={modelGeo.scaleWarning} factor={modelGeo.scaleFactor} />}
              {showMeasurePanel && (
                <ViewerMeasurePanel
                  rows={measureRows}
                  unit={unit}
                  onUnitChange={setUnit}
                  onFlyTo={flyToItem}
                  onRename={renameItem}
                  onDelete={deleteItem}
                  onClearAll={clearAllMeasurements}
                  onExport={canExport ? exportCsv : undefined}
                  onClose={() => setShowMeasurePanel(false)}
                />
              )}
              {selectedBuilding && (
                <div className="inspector-dock">
                  <div className="inspector-container">
                    <BlockInspector
                      key={`${selectedBuilding.id}:${panel.n}`}
                      building={selectedBuilding as BuildingData} schoolId={schoolId}
                      initialTab={panel.buildingId === String(selectedBuilding.id) ? panel.tab : "media"}
                      onClose={() => setSelectedBuilding(null)} onUpdateBuilding={saveBuildingMedia}
                      onEdit={panelAccess.canEditBuildings ? () => { setDrawerBuilding(selectedBuilding); setDrawerOpen(true); } : undefined}
                      reports={schoolReports.reports.filter((r) => String(r.buildingId) === String(selectedBuilding.id))}
                      reportsLoaded={schoolReports.loaded}
                      canEditMedia={panelAccess.canEditBuildings}
                      canCreateReport={panelAccess.canCreateReport}
                      canOpenReview={panelAccess.canOpenReview}
                      canDecide={panelAccess.canDecide}
                      onReportPatched={schoolReports.patch}
                      onReportSubmitted={() => void schoolReports.reload()}
                      onOpenMedia={(index) => {
                        const start = allMedia.findIndex((m) => m.source === "building" && m.buildingId === String(selectedBuilding.id) && m.index === index);
                        if (start >= 0) setMediaViewer({ items: allMedia, index: start });
                      }}
                      onOpenGallery={() => setGallery({ buildingId: String(selectedBuilding.id) })}
                    />
                  </div>
                </div>
              )}
              {gallery && (
                <MediaGallery
                  items={allMedia}
                  initialBuildingId={gallery.buildingId}
                  openReports={openReportsOf}
                  onOpen={(items, index) => setMediaViewer({ items, index })}
                  onClose={() => setGallery(null)}
                />
              )}
              {mediaViewer && (
                <MediaViewer
                  items={mediaViewer.items}
                  index={mediaViewer.index}
                  onIndexChange={(index) => setMediaViewer((v) => (v ? { ...v, index } : v))}
                  onClose={() => setMediaViewer(null)}
                  openReports={openReportsOf}
                  onBuildings={(id) => {
                    setMediaViewer(null);
                    setGallery(null);
                    const b = dbBuildings.find((x) => String(x.id) === id);
                    if (b) { setPanel((p) => ({ tab: "media", n: p.n + 1, buildingId: id })); setSelectedBuilding(b); }
                    setShowBuildingsList(true);
                  }}
                  onGallery={(id) => { setMediaViewer(null); setGallery({ buildingId: id }); }}
                  onReports={(id) => {
                    setMediaViewer(null);
                    setGallery(null);
                    const b = dbBuildings.find((x) => String(x.id) === id);
                    if (b) { setPanel((p) => ({ tab: "reporting", n: p.n + 1, buildingId: id })); setSelectedBuilding(b); }
                  }}
                />
              )}
              {pinBuildingId && (
                <div className="pin-indicator">
                  <span>📍</span> Click model to pin <em>{dbBuildings.find(b => b.id === pinBuildingId)?.buildingName || "building"}</em>
                  <button type="button" onClick={() => setPinBuildingId(null)} aria-label="Cancel pin placement">✕</button>
                </div>
              )}
              {showBuildingsList && (
                <BuildingsListPanel
                  buildings={dbBuildings} selectedId={selectedBuilding?.id} onClose={() => setShowBuildingsList(false)}
                  counts={schoolReports.counts} canEdit={panelAccess.canEditBuildings} onGallery={() => setGallery({ buildingId: null })}
                  onDelete={handleDeleteBuilding} onAdd={() => {
                    const newB: BuildingData = {
                      id: `new-${Date.now()}`, buildingName: "", buildingCode: "", buildingFunction: "",
                      // Blank = not recorded; the surveyor fills in what was assessed.
                      buildingFloors: "", buildingArea: "", buildingYearBuilt: "",
                      buildingCondition: "", buildingRoofCondition: "", buildingStructuralScore: "",
                      buildingNotes: "", geolocation: { latitude: 0, longitude: 0 },
                      facilities: [], annotations: [], media: []
                    };
                    setDrawerBuilding(newB);
                    setDrawerOpen(true);
                  }}
                  onSelect={(b) => {
                    setSelectedBuilding(b);
                    const pin = buildingPinsRef.current[b.id] as any;
                    if (pin) flyToPoint(pin); else setPinBuildingId(b.id);
                    if (window.innerWidth < 768) setShowBuildingsList(false);
                  }}
                />
              )}
              <AnnotationPickerModal open={annotPickerOpen} annotationType="point" initialTitle={pinBuildingId ? (dbBuildings.find(b => b.id === pinBuildingId)?.buildingName || "") : ""} onConfirm={submit3DAnnotation} onCancel={cancelAnnotation} />
              <ViewerStatsFooter stats={stats} showMeasurePanel={showMeasurePanel} formatBytes={formatBytes} formatTime={formatTime} />
              {showHelp && <ViewerHelpModal setShowHelp={setShowHelp} viewer="3d" />}
              <ViewerMovementControls 
                keysRef={keysRef} 
                isSprinting={isSprinting} 
                setIsSprinting={setIsSprinting} 
              />
              <BuildingFormDrawer
                isOpen={drawerOpen} building={drawerBuilding} buildingIndex={drawerBuilding?.id.startsWith("new-") ? -1 : 0}
                onSave={(b) => handleUpdateBuilding(b)} onClose={() => setDrawerOpen(false)}
                availableFacilities={availableFacilities} facilitiesLoading={facilitiesLoading}
                isSaving={isSaving} errorMessage={saveError}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}