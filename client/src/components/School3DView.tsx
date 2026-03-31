import { useRef, useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { api, FILE_SERVER_URL } from "../lib/api";

import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from "three-mesh-bvh";

// Sub-components
import ViewerUIHeader from "./3dviewercomponents/ViewerUIHeader";
import ViewerLoadingScreens from "./3dviewercomponents/ViewerLoadingScreens";
import ViewerControlToolbar from "./3dviewercomponents/ViewerControlToolbar";
import ViewerRenderModePanel from "./3dviewercomponents/ViewerRenderModePanel";
import ViewerMeasureToolbar from "./3dviewercomponents/ViewerMeasureToolbar";
import ViewerMeasurePanel from "./3dviewercomponents/ViewerMeasurePanel";
import ViewerStatsFooter from "./3dviewercomponents/ViewerStatsFooter";
import { AnnotationPickerModal } from "./2dviewercomponents/AnnotationPickerModal";
import { BuildingsListPanel } from "./2dviewercomponents/BuildingsListPanel";
import type { BuildingData } from "./school-form-steps/BuildingsStep";
import ViewerHelpModal from "./3dviewercomponents/ViewerHelpModal";
import ViewerMainCanvas from "./3dviewercomponents/ViewerMainCanvas";
import ViewerBuildingPanel from "./3dviewercomponents/ViewerBuildingPanel";
import { ViewerAddBuildingModal } from "./3dviewercomponents/ViewerAddBuildingModal";

// Styles
import "./School3DView.css";

// ─── Setup BVH ──────────────────────────────────────────────────────────────
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

// ─── Types ────────────────────────────────────────────────────────────────────

interface LoadStats { fileName: string; fileSize: number; loadTime: number; triangles: number; meshes: number; textures: number; }
interface CameraHome { position: { x: number; y: number; z: number }; target: { x: number; y: number; z: number }; near: number; far: number; }

type RenderMode = "unlit" | "lit" | "wireframe";
type MeasureMode = "distance" | "area" | "perimeter" | "annotate" | null;
type VisibilityMode = "all" | "annotations" | "measures" | "clear";
type Unit = "m" | "cm" | "mm" | "km" | "ft" | "in";

interface MeasurePoint { x: number; y: number; z: number; }
interface MeasureLine { id: string; points: MeasurePoint[]; mode: "distance" | "area" | "perimeter"; result: number; unit: Unit; label: string; color: string; }
interface Annotation { id: string; point: MeasurePoint; text: string; color: string; }

// ─── Constants ────────────────────────────────────────────────────────────────

const LS_HOME_KEY = "glb_viewer_home_v1";
const LS_MODE_KEY = "glb_viewer_mode_v1";
const LS_MEASURES_KEY = "glb_viewer_measures_v1";
const LS_ANNOTATIONS_KEY = "glb_viewer_annotations_v1";
const LS_UNIT_KEY = "glb_viewer_unit_v1";

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
const UNIT_LABELS: Record<Unit, string> = { m: "Meters (m)", cm: "Centimeters (cm)", mm: "Millimeters (mm)", km: "Kilometers (km)", ft: "Feet (ft)", in: "Inches (in)" };
const UNIT_FACTOR: Record<Unit, number> = { m: 1, cm: 100, mm: 1000, km: 0.001, ft: 3.28084, in: 39.3701 };
const UNIT_SUFFIX: Record<Unit, string> = { m: "m", cm: "cm", mm: "mm", km: "km", ft: "ft", in: "in" };
const AREA_SUFFIX: Record<Unit, string> = { m: "m²", cm: "cm²", mm: "mm²", km: "km²", ft: "ft²", in: "in²" };

const MEASURE_COLORS = ["#3b82f6", "#2563eb", "#00d4aa", "#ffb347", "#7ec8e3", "#ff7f50"];
const ANNOT_COLORS = ["#00d4aa", "#2563eb", "#ffb347", "#7ec8e3", "#93c5fd", "#ffffff"];
const NAV_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "W", "A", "S", "D", "q", "e", "Q", "E", "r", "f", "R", "F", " "]);
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

function convertDist(meters: number, unit: Unit) { return meters * UNIT_FACTOR[unit]; }
function fmtDist(meters: number, unit: Unit) { return `${convertDist(meters, unit).toFixed(3)} ${UNIT_SUFFIX[unit]}`; }
function fmtArea(sqMeters: number, unit: Unit) { return `${(sqMeters * UNIT_FACTOR[unit] * UNIT_FACTOR[unit]).toFixed(3)} ${AREA_SUFFIX[unit]}`; }

function calcPolyArea(pts: MeasurePoint[]): number {
  if (pts.length < 3) return 0;
  const n = new THREE.Vector3();
  const vpts = pts.map(p => new THREE.Vector3(p.x, p.y, p.z));
  for (let i = 0; i < vpts.length; i++) {
    const a = vpts[i], b = vpts[(i + 1) % vpts.length], c = vpts[(i + 2) % vpts.length];
    const ab = b.clone().sub(a), ac = c.clone().sub(a);
    n.add(new THREE.Vector3().crossVectors(ab, ac));
  }
  n.normalize(); let area = 0;
  for (let i = 0; i < vpts.length; i++) { const a = vpts[i], b = vpts[(i + 1) % vpts.length]; area += a.clone().cross(b).dot(n); }
  return Math.abs(area) / 2;
}

function calcPerimeter(pts: MeasurePoint[]): number {
  let total = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; total += new THREE.Vector3(a.x, a.y, a.z).distanceTo(new THREE.Vector3(b.x, b.y, b.z)); }
  return total;
}

function calcDistance(pts: MeasurePoint[]): number {
  if (pts.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) { total += new THREE.Vector3(pts[i].x, pts[i].y, pts[i].z).distanceTo(new THREE.Vector3(pts[i + 1].x, pts[i + 1].y, pts[i + 1].z)); }
  return total;
}

function loadJson<T>(key: string, def: T): T { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def; } catch { return def; } }
function saveJson(key: string, val: unknown) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { } }
function getHomeKey(fileName: string) { return `glb_home_${fileName.replace(/[^a-zA-Z0-9]/g, "_")}`; }

// ─── Shared DRACO loader (pre-warmed, reused across loads) ───────────────────
const sharedDracoLoader = new DRACOLoader();
sharedDracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.6/");
sharedDracoLoader.preload();

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
    const seg = new THREE.Vector3(pts[i].x, pts[i].y, pts[i].z).distanceTo(new THREE.Vector3(pts[i + 1].x, pts[i + 1].y, pts[i + 1].z));
    if (walked + seg >= half) {
      const t = seg > 0 ? (half - walked) / seg : 0;
      return { x: pts[i].x + t * (pts[i + 1].x - pts[i].x), y: pts[i].y + t * (pts[i + 1].y - pts[i].y), z: pts[i].z + t * (pts[i + 1].z - pts[i].z) };
    }
    walked += seg;
  }
  return pts[pts.length - 1];
}

/** Centroid of a polygon — keeps the label inside the shape from any angle. */
function centroidOf(pts: MeasurePoint[]): MeasurePoint {
  return { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length, z: pts.reduce((s, p) => s + p.z, 0) / pts.length };
}

/**
 * Creates a PointsMaterial whose texture is a per-color circle matching the canvas drawDot style.
 * sizeAttenuation:false keeps dots at a fixed pixel size — no per-frame scale update needed.
 */
function createMeasureDotMaterial(color: string): THREE.PointsMaterial {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const sz = 32 * dpr;
  const canvas = document.createElement("canvas");
  canvas.width = sz; canvas.height = sz;
  const ctx = canvas.getContext("2d")!;
  const c = sz / 2;
  const r = parseInt(color.slice(1, 3), 16), g = parseInt(color.slice(3, 5), 16), b = parseInt(color.slice(5, 7), 16);
  ctx.clearRect(0, 0, sz, sz);
  // Outer shadow ring
  ctx.beginPath(); ctx.arc(c, c, c - 1, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.30)"; ctx.fill();
  // Colored fill
  ctx.beginPath(); ctx.arc(c, c, c - 4 * dpr, 0, Math.PI * 2);
  ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.fill();
  // White ring
  ctx.beginPath(); ctx.arc(c, c, c - 4 * dpr, 0, Math.PI * 2);
  ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2.5 * dpr; ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  return new THREE.PointsMaterial({
    map: texture, size: 10, sizeAttenuation: false,
    transparent: true, alphaTest: 0.05,
    depthTest: false, depthWrite: false,
  });
}

/**
 * Creates a THREE.Sprite whose texture is a canvas-rendered pill label.
 * The sprite is placed in world space and auto-billboards toward the camera.
 * Scale is updated each frame by the animate loop to maintain ~TARGET_PX screen height.
 */
function createLabelSprite(text: string, color: string): THREE.Sprite {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const fontSize = 20;
  const padX = 10, padY = 6;

  // Measure text width on a throw-away canvas
  const probe = document.createElement("canvas").getContext("2d")!;
  probe.font = `bold ${fontSize}px 'JetBrains Mono', monospace`;
  const tw = probe.measureText(text).width;

  const logW = Math.ceil(tw + padX * 2);
  const logH = Math.ceil(fontSize + padY * 2);
  const canvas = document.createElement("canvas");
  canvas.width = logW * dpr;
  canvas.height = logH * dpr;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  // Parse hex color once
  const r = parseInt(color.slice(1, 3), 16), g = parseInt(color.slice(3, 5), 16), b = parseInt(color.slice(5, 7), 16);

  // Dark glassmorphic background
  ctx.fillStyle = "rgba(6,11,26,0.90)";
  ctx.beginPath(); ctx.roundRect(0, 0, logW, logH, 5); ctx.fill();

  // Colored border
  ctx.strokeStyle = `rgba(${r},${g},${b},0.9)`; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(1, 1, logW - 2, logH - 2, 4); ctx.stroke();

  // Text
  ctx.font = `bold ${fontSize}px 'JetBrains Mono', monospace`;
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, logW / 2, logH / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,   // always render on top of geometry
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  // Store canvas aspect ratio so the animate loop can set width proportionally
  sprite.userData.aspect = canvas.width / canvas.height;
  return sprite;
}

// ─── Overlay canvas helpers ───────────────────────────────────────────────────

function project3Dto2D(pt: MeasurePoint, camera: THREE.PerspectiveCamera, w: number, h: number): [number, number] | null {
  // Camera matrices are already updated by the renderer each frame — no need to call
  // updateMatrixWorld/updateProjectionMatrix here (they were redundant per-point per-frame).
  const v = new THREE.Vector3(pt.x, pt.y, pt.z).project(camera);
  if (v.z < -1 || v.z > 1) return null;
  return [(v.x * 0.5 + 0.5) * w, (-v.y * 0.5 + 0.5) * h];
}

// ─── Component ────────────────────────────────────────────────────────────────


interface School3DViewProps {
  schoolId: string;
  schoolName: string;
  onClose: () => void;
}

export default function School3DView({ schoolId: propSchoolId, schoolName: propSchoolName, onClose }: School3DViewProps) {
  const { id: routeId } = useParams<{ id: string }>();
  const schoolId = propSchoolId || routeId || "";
  const schoolName = propSchoolName || "";

  const mountRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animFrameRef = useRef<number>(0);
  const modelRef = useRef<THREE.Object3D | null>(null);
  /** Group that holds all measurement label sprites — children are keyed by measure id via userData.measureId */
  const labelGroupRef = useRef<THREE.Group | null>(null);
  /** Group that holds THREE.Points for saved measurement endpoint dots — always visible, never hidden during interaction */
  const measureGroupRef = useRef<THREE.Group | null>(null);
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
  const raycasterRef = useRef(new THREE.Raycaster());
  // Bounding-box center in scene space after rotation+centering.
  // scene(0,0) = bbox center, NOT school GPS — this offset corrects the geo projection.
  const modelRawCenterRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });

  const hoverPtRef = useRef<MeasurePoint | null>(null);

  const [phase, setPhase] = useState<"idle" | "loading" | "viewing">("idle");
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<LoadStats | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(7);
  const [homeSaved, setHomeSaved] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);
  const [renderMode, setRenderMode] = useState<RenderMode>(() => loadJson(LS_MODE_KEY, "unlit") as RenderMode);

  // DB overlay visibility & building selection
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null);
  const [showBuildingsList, setShowBuildingsList] = useState(false);
  const [showAddBuildingModal, setShowAddBuildingModal] = useState(false);
  /** User-placed 3D pins for buildings: buildingId → 3D world point */
  const [buildingPins, setBuildingPins] = useState<Record<string, MeasurePoint>>({});
  const buildingPinsRef = useRef<Record<string, MeasurePoint>>({});
  useEffect(() => { buildingPinsRef.current = buildingPins; }, [buildingPins]);
  /** When set, next model click places a pin for this building id */
  const [pinBuildingId, setPinBuildingId] = useState<string | null>(null);
  const pinBuildingIdRef = useRef<string | null>(null);
  useEffect(() => { pinBuildingIdRef.current = pinBuildingId; }, [pinBuildingId]);

  const [annotPickerOpen, setAnnotPickerOpen] = useState(false);

  const [dbSchool, setDbSchool] = useState<any>(null);
  const [dbBuildings, setDbBuildings] = useState<any[]>([]);
  const [dbMarkers, setDbMarkers] = useState<any[]>([]);
  const [isModelReady, setIsModelReady] = useState(false);
  // Measurement state
  const [measureMode, setMeasureMode] = useState<MeasureMode>(null);
  const [visibility, setVisibility] = useState<VisibilityMode>("all");
  const [unit, setUnit] = useState<Unit>(() => loadJson(LS_UNIT_KEY, "m") as Unit);
  const [measures, setMeasures] = useState<MeasureLine[]>(() => loadJson(LS_MEASURES_KEY, []));
  const [annotations, setAnnotations] = useState<Annotation[]>(() => loadJson(LS_ANNOTATIONS_KEY, []));
  const [pendingPts, setPendingPts] = useState<MeasurePoint[]>([]);
  const pendingPtsRef = useRef<MeasurePoint[]>([]);
  useEffect(() => { pendingPtsRef.current = pendingPts; }, [pendingPts]);

  const annotationsRef = useRef<Annotation[]>([]);
  const measuresRef = useRef<MeasureLine[]>([]);
  useEffect(() => { annotationsRef.current = annotations; }, [annotations]);
  useEffect(() => { measuresRef.current = measures; }, [measures]);

  // Refs for building-selection handler (avoids stale closures)
  const dbMarkersRef = useRef<any[]>([]);
  const dbBuildingsRef = useRef<any[]>([]);
  const measureModeRef = useRef<MeasureMode>(null);
  useEffect(() => { dbMarkersRef.current = dbMarkers; }, [dbMarkers]);
  useEffect(() => { dbBuildingsRef.current = dbBuildings; }, [dbBuildings]);
  useEffect(() => { measureModeRef.current = measureMode; }, [measureMode]);

  const viewerStatePrefetchRef = useRef<Promise<any> | null>(null);
  // Promise that resolves the moment initThree() finishes setting sceneRef/cameraRef/controlsRef
  const threeInitResolveRef = useRef<(() => void) | null>(null);
  const threeInitPromiseRef = useRef<Promise<void>>(new Promise(() => {}));
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleSave = useCallback(() => {
    if (!schoolId) return;
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    saveDebounceRef.current = setTimeout(() => {
      fetch(`${FILE_SERVER_URL}/schools/${schoolId}/viewer-state`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          home: cameraHomeRef.current,
          annotations: annotationsRef.current,
          measures: measuresRef.current,
          buildingPins: buildingPinsRef.current,
        }),
      }).catch(() => { });
    }, 800);
  }, [schoolId]);
  const [showMeasurePanel, setShowMeasurePanel] = useState(false);
  const [screenshotFlash, setScreenshotFlash] = useState(false);
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);
  const colorIdxRef = useRef(0);

  // Annotate modal state
  const [annotPendingPt, setAnnotPendingPt] = useState<MeasurePoint | null>(null);
  const [annotColor] = useState<string>(ANNOT_COLORS[0]);

  // Persist (localStorage + server)
  useEffect(() => { saveJson(LS_MEASURES_KEY, measures); scheduleSave(); }, [measures, scheduleSave]);
  useEffect(() => { saveJson(LS_ANNOTATIONS_KEY, annotations); scheduleSave(); }, [annotations, scheduleSave]);
  useEffect(() => { saveJson(LS_UNIT_KEY, unit); }, [unit]);
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

  // ── Finalize loaded GLTF: auto-correct orientation, fit camera ──────────────
  const finalizeGLTF = useCallback(async (
    gltf: GLTF,
    fileName: string,
    fileSize: number,
    startTime: number
  ) => {
    setProgress(90); setProgressLabel("Building scene…"); setPhase("viewing");

    // Wait for initThree() to populate sceneRef / cameraRef / controlsRef.
    // initThree() starts eagerly on phase="loading", so by the time the GLB finishes
    // downloading it is usually already done — this await is a no-op in the fast path.
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
      unlitMatsRef.current.set(mesh, unlitMat);
      bvhMeshes.push(mesh);
    });

    // Add model immediately so it is visible — BVH is computed in background after render
    scene.add(model); modelRef.current = model;

    // Defer BVH computation: yield every 5 meshes so the renderer stays responsive
    ;(async () => {
      for (let i = 0; i < bvhMeshes.length; i++) {
        bvhMeshes[i].geometry.computeBoundsTree();
        if (i % 5 === 4) await new Promise(r => setTimeout(r, 0));
      }
    })();

    // ── Auto-correct Orientation: detect if map is Z-up (appearing vertical) ─────
    model.updateMatrixWorld(true);
    let box = new THREE.Box3();
    model.traverse(c => { if ((c as THREE.Mesh).isMesh) box.expandByObject(c); });
    let size = box.getSize(new THREE.Vector3());

    // If the model is much taller (Y) than it is deep (Z), it's likely a vertical map
    // that should be horizontal. Map objects are typically wide in X,Z.
    if (size.y > size.z * 1.5 && size.x > size.z * 0.5) {
      console.log("Detecting vertical map orientation, rotating by -90° around X axis...");
      model.rotation.x = -Math.PI / 2;
      model.updateMatrixWorld(true);
      box.setFromObject(model);
      size = box.getSize(new THREE.Vector3());
    }

    // ── Auto-correct: strict grounding at (0,0,0) ──────────────────────────
    const rawCenter = box.getCenter(new THREE.Vector3());
    // Store bbox center so geo-projection can correct for it:
    // scene(0,0) = bbox center ≠ school GPS — annotations must subtract this offset.
    modelRawCenterRef.current = { x: rawCenter.x, z: rawCenter.z };
    // Positioning at exactly 0,0,0 with local offset correction
    model.position.set(-rawCenter.x, -box.min.y, -rawCenter.z);
    model.updateMatrixWorld(true);
    // Refresh box for camera fitting and stats
    box.setFromObject(model);

    applyRenderMode(renderMode);

    if (rendererRef.current) {
      // Pre-compile to avoid stutter on first frame
      rendererRef.current.compile(scene, camera);
    }

    size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const center = box.getCenter(new THREE.Vector3());
    const halfDiag = box.getBoundingSphere(new THREE.Sphere()).radius;
    const fovRad = camera.fov * (Math.PI / 180);
    const distance = (halfDiag / Math.tan(fovRad / 2)) * 1.1;

    camera.near = distance * 0.0001; camera.far = distance * 100; camera.updateProjectionMatrix();

    let savedHome: CameraHome | null = null;
    try { const s = localStorage.getItem(getHomeKey(fileName)); if (s) savedHome = JSON.parse(s); } catch { }

    // Server-side state takes priority over localStorage.
    // Use the prefetch that was kicked off in parallel with the GLB download (if available).
    if (schoolId) {
      try {
        const serverState = viewerStatePrefetchRef.current
          ? await viewerStatePrefetchRef.current
          : await fetch(`${FILE_SERVER_URL}/schools/${schoolId}/viewer-state`).then(r => r.ok ? r.json() : null).catch(() => null);
        if (serverState?.home) savedHome = serverState.home;
        if (serverState?.annotations?.length) setAnnotations(serverState.annotations);
        if (serverState?.measures?.length) setMeasures(serverState.measures);
        if (serverState?.buildingPins && Object.keys(serverState.buildingPins).length)
          setBuildingPins(serverState.buildingPins);
      } catch { }
    }

    if (savedHome) {
      camera.position.set(savedHome.position.x, savedHome.position.y, savedHome.position.z);
      camera.near = savedHome.near; camera.far = savedHome.far; camera.updateProjectionMatrix();
      controls.target.set(savedHome.target.x, savedHome.target.y, savedHome.target.z);
      cameraHomeRef.current = savedHome; setHomeSaved(true);
    } else {
      // cinematic landing animation logic starts here
      const hp = new THREE.Vector3(distance * 0.8, distance * 1.2, distance * 0.8);
      const startPos = hp.clone().add(new THREE.Vector3(0, distance * 2, distance));
      camera.position.copy(startPos);
      camera.lookAt(center);
      controls.target.copy(center);

      // smooth glide to home
      cameraHomeRef.current = { position: { x: hp.x, y: hp.y, z: hp.z }, target: { x: center.x, y: center.y, z: center.z }, near: camera.near, far: camera.far };
      setHomeSaved(false);

      // trigger cinematic glide
      const glideStartTime = Date.now();
      const glideDur = 2500;
      const step = () => {
        const elapsed = Date.now() - glideStartTime;
        const t = Math.min(1, elapsed / glideDur);
        const ease = 1 - Math.pow(1 - t, 4); // OutQuart
        camera.position.lerpVectors(startPos, hp, ease);
        controls.update();
        if (t < 1) requestAnimationFrame(step);
      };
      step();
    }

    controls.minDistance = camera.near * 10; controls.maxDistance = camera.far; controls.update();
    const autoSpeed = Math.max(0.001, maxDim * 0.003); moveSpeedRef.current = autoSpeed; setSpeedIdx(nearestSpeedIdx(autoSpeed));

    // Grid snapped to Y=0 (ground plane)
    const oldGrid = scene.children.find(c => c instanceof THREE.GridHelper); if (oldGrid) scene.remove(oldGrid);
    const gridSize = Math.max(size.x, size.z) * 3, divisions = Math.min(100, Math.max(10, Math.floor(gridSize / (maxDim * 0.1))));
    const newGrid = new THREE.GridHelper(gridSize, divisions, 0x0d1a3a, 0x0d1a3a);
    (newGrid.material as THREE.Material).opacity = 0.5; (newGrid.material as THREE.Material).transparent = true; newGrid.position.y = 0; scene.add(newGrid);

    let triangles = 0, meshCount = 0, textureCount = 0; const seen = new Set<THREE.Texture>();
    model.traverse(child => { const mesh = child as THREE.Mesh; if (!mesh.isMesh) return; meshCount++; const geo = mesh.geometry; triangles += geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3; const mats = Array.isArray(mesh.material) ? mesh.material as THREE.Material[] : [mesh.material as THREE.Material]; mats.forEach((m: any) => { ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap"].forEach(k => { if (m[k] && !seen.has(m[k])) { seen.add(m[k]); textureCount++; } }); }); });
    setStats({ fileName, fileSize, loadTime: Date.now() - startTime, triangles: Math.round(triangles), meshes: meshCount, textures: textureCount });

    setIsModelReady(true);
    setProgress(100); setProgressLabel("Done!");
  }, [renderMode, applyRenderMode, schoolId]);

  // ── Pre-fetch School Data (Parallel to GLB loading) ─────────────────────────
  useEffect(() => {
    if (!schoolId) return;
    api.get(`/schools/${schoolId}`)
      .then(res => setDbSchool(res.data))
      .catch(e => console.error("Failed to pre-fetch school", e));
    api.get(`/schools/${schoolId}/buildings`)
      .then(res => setDbBuildings((res.data || []).map(normalizeBuilding)))
      .catch(e => console.error("Failed to pre-fetch buildings", e));
  }, [schoolId]);

  // ── Sync DB Markers and Ground Snapping (Non-Blocking Batch Processing) ──────
  useEffect(() => {
    const model = modelRef.current;
    if (!dbSchool || !model || !isModelReady || phase !== "viewing") {
      setDbMarkers([]); return;
    }
    const latCenter = Number(dbSchool.latitude), lonCenter = Number(dbSchool.longitude);
    if (!latCenter || !lonCenter) { setDbMarkers([]); return; }


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
  }, [dbSchool, dbBuildings, phase, isModelReady]);

  const toggleMode = useCallback((mode: MeasureMode) => {
    setMeasureMode(prev => {
      const isNew = prev !== mode;
      if (isNew && mode !== "annotate") setShowMeasurePanel(true);
      return isNew ? mode : null;
    });
    setVisibility("all");
    setPendingPts([]); hoverPtRef.current = null; setAnnotPendingPt(null);
  }, []);

  const cycleVisibility = useCallback(() => {
    setVisibility(prev => {
      if (prev === "all") return "annotations";
      if (prev === "annotations") return "measures";
      if (prev === "measures") return "clear";
      return "all";
    });
  }, []);

  const clearAllMeasurements = useCallback(() => {
    setMeasures([]);
    setAnnotations([]);
    setPendingPts([]);
    hoverPtRef.current = null;
    setAnnotPendingPt(null);
  }, []);

  // ── Overlay draw ────────────────────────────────────────────────────────────
  const drawOverlay = useCallback(() => {
    const canvas = overlayRef.current; const camera = cameraRef.current;
    if (!canvas || !camera) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const drawLine = (pts: MeasurePoint[], color: string, dashed = false) => {
      if (pts.length < 2) return;
      ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 2;
      if (dashed) ctx.setLineDash([6, 4]); else ctx.setLineDash([]);
      let started = false;
      for (let i = 0; i < pts.length; i++) {
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
      for (let i = 0; i < pts.length; i++) {
        const proj = project3Dto2D(pts[i], camera, W, H);
        if (!proj) continue;
        if (!started) { ctx.moveTo(proj[0], proj[1]); started = true; firstProj = proj; }
        else { ctx.lineTo(proj[0], proj[1]); }
      }
      if (close && firstProj && started) ctx.lineTo(firstProj[0], firstProj[1]);
      const hex = color.replace("#", ""); const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
      ctx.fillStyle = `rgba(${r},${g},${b},0.08)`; ctx.fill();
      if (started) ctx.stroke();
    };

    const drawDot = (pt: MeasurePoint, color: string, r = 6) => {
      const proj = project3Dto2D(pt, camera, W, H); if (!proj) return;
      const [x, y] = proj;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.5; ctx.setLineDash([]); ctx.stroke();

      // High-contrast shadow ring to make the dot pop on light backgrounds
      ctx.beginPath(); ctx.arc(x, y, r + 1.5, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 1; ctx.stroke();
    };

    // ── drawLabel for the live (in-progress) measurement only ─────────────────
    // Saved-measure labels are THREE.Sprite objects managed by the sprite-sync
    // useEffect — they live in the scene graph and auto-billboard with the camera.
    const drawLabel = (pt: MeasurePoint, text: string, color: string) => {
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

    // 1. Saved Measures — lines only on canvas; dots are THREE.Points in the scene (measureGroupRef),
    //    labels are THREE.Sprite in the scene (labelGroupRef). Both stay pixel-perfect through any
    //    camera transformation without canvas projection math.
    if (visibility === "all" || visibility === "measures") {
      measures.forEach(m => {
        if (m.mode === "distance") {
          drawLine(m.points, m.color);
        } else {
          drawPolygon(m.points, m.color, true);
        }
      });
    }

    // 2. Pending Live Points (Always show if active)
    const hoverPt = hoverPtRef.current;
    const col = MEASURE_COLORS[colorIdxRef.current % MEASURE_COLORS.length];

    if (measureMode && measureMode !== "annotate") {
      if (hoverPt) drawDot(hoverPt, col, 4);

      // Use ref so the animation loop always draws the LATEST points without waiting for React re-render
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
          if (measureMode !== "distance" && livePts.length >= 2) {
            drawLine([livePts[0], hoverPt], col, true);
          }
        }

        livePts.forEach(p => drawDot(p, col, 5));

        if (hoverPt) {
          let liveLabel = "";
          let liveLabelAnchor: MeasurePoint;
          if (measureMode === "area") {
            const all = [...livePts, hoverPt];
            liveLabel = fmtArea(calcPolyArea(all), unit);
            liveLabelAnchor = centroidOf(all);
          } else {
            const allPts = [...livePts, hoverPt];
            let currentDist = calcDistance(livePts);
            const dToHover = new THREE.Vector3(livePts[livePts.length - 1].x, livePts[livePts.length - 1].y, livePts[livePts.length - 1].z)
              .distanceTo(new THREE.Vector3(hoverPt.x, hoverPt.y, hoverPt.z));
            let total = currentDist + dToHover;
            if (measureMode === "perimeter" && livePts.length >= 2) {
              const dBackToStart = new THREE.Vector3(livePts[0].x, livePts[0].y, livePts[0].z).distanceTo(new THREE.Vector3(hoverPt.x, hoverPt.y, hoverPt.z));
              total += dBackToStart;
            }
            liveLabel = fmtDist(total, unit);
            // Anchor the live label at the midpoint of the in-progress line
            liveLabelAnchor = midpointAlongPolyline(allPts);
          }
          drawLabel(liveLabelAnchor!, liveLabel, col);
        }
      }
    }

    // ── User-placed building pins ──────────────────────────────────────────────
    const dbPulse = Math.sin(Date.now() / 250) * 0.4 + 1.2;
    const pins = buildingPinsRef.current;
    Object.entries(pins).forEach(([bId, pt]) => {
      const building = dbBuildings.find((b: any) => b.id === bId);
      if (!building) return;
      const p = project3Dto2D(pt, camera, W, H);
      if (!p) return;
      const [px, py] = p;
      const dist = camera.position.distanceTo(new THREE.Vector3(pt.x, pt.y, pt.z));
      const scale = Math.max(0.4, Math.min(1.2, 50 / dist));
      const isSelected = selectedBuilding?.id === bId;

      // Outer glow
      ctx.beginPath(); ctx.arc(px, py, 11 * dbPulse * scale, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? "rgba(251,191,36,0.35)" : "rgba(251,191,36,0.18)"; ctx.fill();

      // Pin dot
      ctx.beginPath(); ctx.arc(px, py, 7 * scale, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? "#fbbf24" : "#f59e0b"; ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2 * scale; ctx.setLineDash([]); ctx.stroke();

      // Building name label
      if (!interactingRef.current) {
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
      }
    });

    if (visibility === "clear") return;
    if (visibility === "all" || visibility === "annotations") {
      annotations.forEach(a => {
        drawDot(a.point, a.color, 7);
        // Skip label text pills during any camera movement — dot stays visible for context
        if (interactingRef.current) return;
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

    // Draw the active annotation being placed
    if (annotPendingPt) drawDot(annotPendingPt, annotColor, 7);

  }, [measures, measureMode, unit, annotations, annotPendingPt, visibility, annotColor, selectedBuilding, buildingPins, dbBuildings]);

  const drawOverlayRef = useRef<() => void>(() => { });
  useEffect(() => { drawOverlayRef.current = drawOverlay; }, [drawOverlay]);

  // ── Three.js init ───────────────────────────────────────────────────────────
  const initThree = useCallback(() => {
    if (!mountRef.current) return;
    const w = mountRef.current.clientWidth, h = mountRef.current.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, precision: "highp", powerPreference: "high-performance", preserveDrawingBuffer: true });
    renderer.setSize(w, h); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = false;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0a0a0f); sceneRef.current = scene;
    const labelGroup = new THREE.Group(); labelGroup.renderOrder = 999; scene.add(labelGroup); labelGroupRef.current = labelGroup;
    const measureGroup = new THREE.Group(); measureGroup.renderOrder = 998; scene.add(measureGroup); measureGroupRef.current = measureGroup;
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.001, 1_000_000); camera.position.set(0, 2, 5); cameraRef.current = camera;
    scene.add(new THREE.AmbientLight(0xffffff, 1.0));
    const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(5, 10, 7); scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.5); fill.position.set(-5, 3, -5); scene.add(fill);
    const grid = new THREE.GridHelper(40, 40, 0x1a1a2e, 0x1a1a2e);
    (grid.material as THREE.Material).opacity = 0.4; (grid.material as THREE.Material).transparent = true; scene.add(grid);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.06; controls.minDistance = 0.001; controls.maxDistance = 1_000_000;
    controlsRef.current = controls;

    const _vDir = new THREE.Vector3(), _right = new THREE.Vector3(), _forward = new THREE.Vector3(), _wu = new THREE.Vector3(0, 1, 0);

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const keys = keysRef.current;

      if (keys.size > 0 && !measureMode) {
        camera.getWorldDirection(_forward);
        _forward.y = 0; _forward.normalize();
        _right.crossVectors(_forward, _wu).normalize();
        _vDir.set(0, 0, 0);

        const sp = moveSpeedRef.current * 0.08;
        if (keys.has("ArrowUp") || keys.has("w") || keys.has("W")) _vDir.addScaledVector(_forward, sp);
        if (keys.has("ArrowDown") || keys.has("s") || keys.has("S")) _vDir.addScaledVector(_forward, -sp);
        if (keys.has("ArrowLeft") || keys.has("a") || keys.has("A")) _vDir.addScaledVector(_right, -sp);
        if (keys.has("ArrowRight") || keys.has("d") || keys.has("D")) _vDir.addScaledVector(_right, sp);
        if (keys.has("e") || keys.has("E") || keys.has(" ")) _vDir.addScaledVector(_wu, sp);
        if (keys.has("q") || keys.has("Q") || keys.has("f") || keys.has("F")) _vDir.addScaledVector(_wu, -sp);

        velocityRef.current.add(_vDir);
      }

      velocityRef.current.multiplyScalar(0.85);

      if (velocityRef.current.lengthSq() > 0.000001) {
        camera.position.add(velocityRef.current);
        controls.target.add(velocityRef.current);
      }

      controls.update();

      // ── Detect any camera movement (mouse orbit, keyboard, programmatic) ──────
      // Using position delta instead of OrbitControls events so keyboard navigation
      // and programmatic moves (setView, resetCamera) are also covered.
      if (camera.position.distanceToSquared(_prevCamPosRef.current) > 1e-14) {
        _prevCamPosRef.current.copy(camera.position);
        if (!interactingRef.current) {
          interactingRef.current = true;
          if (labelGroupRef.current) labelGroupRef.current.visible = false;
        }
        // Restart 150 ms debounce — labels reappear only after camera fully settles
        if (showLabelsTimerRef.current) clearTimeout(showLabelsTimerRef.current);
        showLabelsTimerRef.current = setTimeout(() => {
          interactingRef.current = false;
          if (labelGroupRef.current) labelGroupRef.current.visible = true;
          showLabelsTimerRef.current = null;
        }, 150);
      }

      // ── Scale label sprites BEFORE rendering (only when visible, saves work during interaction) ──
      if (labelGroupRef.current?.visible && labelGroupRef.current.children.length > 0) {
        const vFOV = THREE.MathUtils.degToRad(camera.fov);
        const viewH = mountRef.current?.clientHeight ?? 600;
        const halfTan = Math.tan(vFOV / 2);
        const targetPx = 32;
        const wPos = new THREE.Vector3(); // reuse single allocation
        for (const obj of labelGroupRef.current.children) {
          obj.getWorldPosition(wPos);
          const dist = camera.position.distanceTo(wPos);
          if (dist < 0.0001) continue;
          const worldH = 2 * dist * halfTan * (targetPx / viewH);
          const aspect = (obj as THREE.Sprite).userData.aspect ?? 3;
          obj.scale.set(worldH * aspect, worldH, 1);
        }
      }

      renderer.render(scene, camera);
      if (overlayRef.current) drawOverlayRef.current();
    };
    animate();

    // Signal to finalizeGLTF that sceneRef / cameraRef / controlsRef are ready
    threeInitResolveRef.current?.();
    threeInitResolveRef.current = null;

    const handleResize = () => {
      if (!mountRef.current) return;
      const nw = mountRef.current.clientWidth, nh = mountRef.current.clientHeight;
      camera.aspect = nw / nh; camera.updateProjectionMatrix(); renderer.setSize(nw, nh);
      if (overlayRef.current) { overlayRef.current.width = nw; overlayRef.current.height = nh; }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
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

  // Full Three.js teardown on component unmount only
  useEffect(() => () => {
    threeResizeCleanupRef.current?.();
    cancelAnimationFrame(animFrameRef.current);
    // Dispose all label sprites
    labelGroupRef.current?.children.forEach(obj => {
      const mat = (obj as THREE.Sprite).material as THREE.SpriteMaterial;
      mat.map?.dispose(); mat.dispose();
    });
    // Dispose all measurement dot geometry + materials
    measureGroupRef.current?.children.forEach(obj => {
      const pts = obj as THREE.Points;
      pts.geometry?.dispose();
      const mat = pts.material as THREE.PointsMaterial;
      mat.map?.dispose(); mat.dispose();
    });
    rendererRef.current?.dispose();
    if (mountRef.current && rendererRef.current?.domElement.parentNode === mountRef.current)
      mountRef.current.removeChild(rendererRef.current.domElement);
  }, []);

  // ── Sync measurement scene objects whenever measures/visibility change ────────
  // • measureGroup  → THREE.Points for endpoint dots (always visible, depthTest off)
  // • labelGroup    → THREE.Sprite for text labels (hidden during camera interaction)
  useEffect(() => {
    const labelGroup = labelGroupRef.current;
    const measureGroup = measureGroupRef.current;
    if (!labelGroup || !measureGroup) return;

    // Dispose and remove all existing label sprites
    while (labelGroup.children.length > 0) {
      const s = labelGroup.children[0] as THREE.Sprite;
      const mat = s.material as THREE.SpriteMaterial;
      mat.map?.dispose(); mat.dispose();
      labelGroup.remove(s);
    }

    // Dispose and remove all existing dot Points
    while (measureGroup.children.length > 0) {
      const pts = measureGroup.children[0] as THREE.Points;
      pts.geometry?.dispose();
      const mat = pts.material as THREE.PointsMaterial;
      mat.map?.dispose(); mat.dispose();
      measureGroup.remove(pts);
    }

    const show = visibility !== "clear" && visibility !== "annotations";
    if (!show) return;

    measures.forEach(m => {
      if (m.points.length < 2) return;

      // ── Endpoint dots as THREE.Points ──────────────────────────────────────
      // sizeAttenuation:false → constant 10px on screen regardless of camera distance.
      // depthTest:false       → always renders on top of model geometry.
      // No per-frame scale update needed — they stay pixel-perfect through any transformation.
      const pts3d = m.points.map(p => new THREE.Vector3(p.x, p.y, p.z));
      const dotGeo = new THREE.BufferGeometry().setFromPoints(pts3d);
      measureGroup.add(new THREE.Points(dotGeo, createMeasureDotMaterial(m.color)));

      // ── Label sprite ───────────────────────────────────────────────────────
      const anchor = (m.mode === "distance" || m.mode === "perimeter")
        ? midpointAlongPolyline(m.points)
        : centroidOf(m.points);
      const sprite = createLabelSprite(m.label, m.color);
      sprite.position.set(anchor.x, anchor.y, anchor.z);
      sprite.renderOrder = 999;
      sprite.userData.measureId = m.id;
      sprite.scale.set(0.3, 0.1, 1);
      labelGroup.add(sprite);
    });
  }, [measures, visibility]);

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

  // Keys & Finalization
  const finalizeMeasure = useCallback(() => {
    if (!pendingPts.length || measureMode === "annotate") return;
    if (pendingPts.length < 2) { setPendingPts([]); hoverPtRef.current = null; return; }

    const col = MEASURE_COLORS[colorIdxRef.current % MEASURE_COLORS.length]; colorIdxRef.current++;
    let result = 0; let label = "";
    if (measureMode === "distance") { result = calcDistance(pendingPts); label = fmtDist(result, unit); }
    else if (measureMode === "area") { result = calcPolyArea(pendingPts); label = fmtArea(result, unit); }
    else if (measureMode === "perimeter") { result = calcPerimeter(pendingPts); label = fmtDist(result, unit); }

    const m: MeasureLine = { id: uid(), points: [...pendingPts], mode: measureMode!, result, unit, label, color: col };
    setMeasures(prev => [...prev, m]);
    setPendingPts([]); hoverPtRef.current = null;
  }, [pendingPts, measureMode, unit]);

  useEffect(() => {
    if (phase !== "viewing") return;
    const onDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT")) return;
      if (!NAV_KEYS.has(e.key)) return;
      if (measureMode) return;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
      keysRef.current.add(e.key);
    };
    const onUp = (e: KeyboardEvent) => { keysRef.current.delete(e.key); };
    const onEsc = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT")) return;
      if (e.key === "Escape") { setPendingPts([]); setMeasureMode(null); hoverPtRef.current = null; setAnnotPendingPt(null); }
      if (e.key === "Enter" && measureMode && pendingPts.length >= 2) finalizeMeasure();
    };
    window.addEventListener("keydown", onDown); window.addEventListener("keyup", onUp); window.addEventListener("keydown", onEsc);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); window.removeEventListener("keydown", onEsc); keysRef.current.clear(); velocityRef.current.set(0, 0, 0); };
  }, [phase, measureMode, pendingPts, finalizeMeasure]);

  useEffect(() => {
    if (!controlsRef.current) return;
    const shouldDisable = !!measureMode || !!pinBuildingId;
    controlsRef.current.enabled = !shouldDisable;
    if (shouldDisable) velocityRef.current.set(0, 0, 0);
  }, [measureMode, pinBuildingId]);

  // ── Building selection: click on Three.js canvas when no measure mode active ─
  useEffect(() => {
    if (phase !== "viewing") return;
    const renderer = rendererRef.current;
    if (!renderer) return;

    let pointerStart = { x: 0, y: 0 };

    const onPointerDown = (e: PointerEvent) => {
      pointerStart = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      if (measureModeRef.current) return;
      const dx = e.clientX - pointerStart.x;
      const dy = e.clientY - pointerStart.y;
      if (Math.sqrt(dx * dx + dy * dy) > 5) return; // was a drag

      const camera = cameraRef.current;
      const canvas = overlayRef.current;
      if (!camera || !canvas) return;

      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const W = rect.width;
      const H = rect.height;

      let nearest: any = null;
      let nearestDist = 30; // px click radius

      // Hit-test against user-placed building pins only
      Object.entries(buildingPinsRef.current).forEach(([bId, pt]) => {
        const proj = project3Dto2D(pt, camera, W, H);
        if (!proj) return;
        const d = Math.sqrt((proj[0] - mx) ** 2 + (proj[1] - my) ** 2);
        if (d < nearestDist) { nearestDist = d; nearest = bId; }
      });

      if (nearest) {
        const building = dbBuildingsRef.current.find((b: any) => b.id === nearest);
        setSelectedBuilding(building || null);
      } else {
        setSelectedBuilding(null);
      }
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    return () => {
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
    };
  }, [phase]);

  // ── Raycasting ──────────────────────────────────────────────────────────────

  const getAccurateRaycastPt = useCallback((e: React.MouseEvent<HTMLCanvasElement>): MeasurePoint | null => {
    const canvas = overlayRef.current; const camera = cameraRef.current; const model = modelRef.current;
    if (!canvas || !camera || !model) return null;

    const rect = canvas.getBoundingClientRect();
    const mouse = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);

    raycasterRef.current.setFromCamera(mouse, camera);
    const hits = raycasterRef.current.intersectObject(model, true);

    if (!hits.length) {
      const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
      const p = camera.position.clone().add(dir.multiplyScalar(10));
      return { x: p.x, y: p.y, z: p.z };
    }
    return { x: hits[0].point.x, y: hits[0].point.y, z: hits[0].point.z };
  }, []);

  const getFastHoverRaycastPt = useCallback((e: React.MouseEvent<HTMLCanvasElement>): MeasurePoint | null => {
    const canvas = overlayRef.current; const camera = cameraRef.current;
    if (!canvas || !camera) return null;

    const rect = canvas.getBoundingClientRect();
    const mouse = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);

    raycasterRef.current.setFromCamera(mouse, camera);

    const plane = new THREE.Plane(); const camDir = new THREE.Vector3(); camera.getWorldDirection(camDir);
    let referencePt = new THREE.Vector3();

    // Use ref so this always has the latest points without stale closure issues
    const pts = pendingPtsRef.current;
    if (pts.length > 0) {
      const last = pts[pts.length - 1]; referencePt.set(last.x, last.y, last.z);
    } else if (controlsRef.current) {
      referencePt.copy(controlsRef.current.target);
    }

    plane.setFromNormalAndCoplanarPoint(camDir.multiplyScalar(-1), referencePt);
    const target = new THREE.Vector3(); const hit = raycasterRef.current.ray.intersectPlane(plane, target);
    if (hit) return { x: target.x, y: target.y, z: target.z };
    return null;
  }, []);

  // ── Mouse Events ─────────────────────────────────────────────────────────────

  const raycastThrottleRef = useRef<number>(0);
  const handleOverlayMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!measureMode) { hoverPtRef.current = null; return; }
    // Throttled raycasting: only calculate every ~32ms (30fps) for hover
    const now = Date.now();
    if (now - raycastThrottleRef.current < 32) return;
    raycastThrottleRef.current = now;
    hoverPtRef.current = getFastHoverRaycastPt(e);
  }, [measureMode, getFastHoverRaycastPt]);

  const handleOverlayClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Pin-placement mode: clicking the model registers immediately and saves the current camera
    if (pinBuildingIdRef.current && !measureModeRef.current) {
      const pt = getAccurateRaycastPt(e);
      if (!pt) return;
      
      const buildingId = pinBuildingIdRef.current;
      setPinBuildingId(null);

      const cam = cameraRef.current;
      const ctrl = controlsRef.current;
      let camHome: CameraHome | undefined;
      if (cam && ctrl) {
        camHome = {
          position: { x: cam.position.x, y: cam.position.y, z: cam.position.z },
          target: { x: ctrl.target.x, y: ctrl.target.y, z: ctrl.target.z },
          near: cam.near,
          far: cam.far
        };
      }

      setBuildingPins(prev => ({ 
        ...prev, 
        [buildingId]: {
          x: pt.x, y: pt.y, z: pt.z,
          camera: camHome
        }
      }));
      return;
    }

    if (!measureMode) return;

    if (measureMode === "annotate") {
      const pt = getAccurateRaycastPt(e); if (!pt) return;
      setAnnotPendingPt(pt);
      setAnnotPickerOpen(true);
      return;
    }

    // For measurements: use the already-computed hover position — instant, no mesh raycast latency
    const pt = hoverPtRef.current; if (!pt) return;

    const prev = pendingPtsRef.current;
    if (prev.length > 0) {
      const last = prev[prev.length - 1];
      const dist = new THREE.Vector3(last.x, last.y, last.z).distanceTo(new THREE.Vector3(pt.x, pt.y, pt.z));
      if (dist < 0.000001) return;
    }
    const next = [...prev, pt];
    // Update ref immediately so animation loop draws the point THIS frame
    pendingPtsRef.current = next;
    setPendingPts(next);
  }, [measureMode, getAccurateRaycastPt]);

  const handleOverlayDoubleClick = useCallback(() => {
    if (!measureMode || measureMode === "annotate") return;
    if (pendingPts.length >= 2) finalizeMeasure();
  }, [measureMode, pendingPts, finalizeMeasure]);

  const handleOverlayContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!measureMode) return;
    if (pendingPts.length >= 2) finalizeMeasure();
    else { setMeasureMode(null); setPendingPts([]); hoverPtRef.current = null; setAnnotPendingPt(null); }
  }, [measureMode, pendingPts, finalizeMeasure]);

  // ── Camera & Actions ─────────────────────────────────────────────────────────
  const handleResetCamera = useCallback(() => {
    const cam = cameraRef.current, ctrl = controlsRef.current; if (!cam || !ctrl) return;

    let home = cameraHomeRef.current;
    if (loadedFileNameRef.current) {
      try { const s = localStorage.getItem(getHomeKey(loadedFileNameRef.current)); if (s) home = JSON.parse(s); } catch { }
    }

    if (!home) return;
    cam.position.set(home.position.x, home.position.y, home.position.z);
    cam.near = home.near; cam.far = home.far; cam.updateProjectionMatrix();
    ctrl.target.set(home.target.x, home.target.y, home.target.z); ctrl.update();
    velocityRef.current.set(0, 0, 0);
  }, []);

  const handleSaveHome = useCallback(() => {
    const cam = cameraRef.current, ctrl = controlsRef.current; if (!cam || !ctrl) return;
    const home: CameraHome = { position: { x: cam.position.x, y: cam.position.y, z: cam.position.z }, target: { x: ctrl.target.x, y: ctrl.target.y, z: ctrl.target.z }, near: cam.near, far: cam.far };
    cameraHomeRef.current = home;

    saveJson(LS_HOME_KEY, home);
    if (loadedFileNameRef.current) saveJson(getHomeKey(loadedFileNameRef.current), home);

    if (schoolId) {
      fetch(`${FILE_SERVER_URL}/schools/${schoolId}/viewer-state`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ home, annotations: annotationsRef.current, measures: measuresRef.current, buildingPins: buildingPinsRef.current }),
      }).catch(() => { });
    }

    setHomeSaved(true); setSaveFlash(true); setTimeout(() => setSaveFlash(false), 1200);
  }, [schoolId]);

  const speedUp = useCallback(() => { setSpeedIdx(p => { const n = Math.min(p + 1, SPEED_STEPS.length - 1); moveSpeedRef.current = SPEED_STEPS[n]; return n; }); }, []);
  const speedDown = useCallback(() => { setSpeedIdx(p => { const n = Math.max(p - 1, 0); moveSpeedRef.current = SPEED_STEPS[n]; return n; }); }, []);

  const toggleOrientation = useCallback(() => {
    const model = modelRef.current; if (!model) return;
    // Rotate model by 90 degrees around X to flip between Y-up and Z-up
    model.rotation.x -= Math.PI / 2;
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.set(-center.x, -box.min.y, -center.z);
    model.updateMatrixWorld(true);
    // Update camera to view the new orientation
    handleResetCamera();
  }, [handleResetCamera]);

  const setView = useCallback((dir: "top" | "front" | "back" | "left" | "right") => {
    const model = modelRef.current; if (!model) return;
    const cam = cameraRef.current, ctrl = controlsRef.current; if (!cam || !ctrl) return;

    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    // closer zoom factor (1.2 instead of 1.6)
    const dist = maxDim * 1.2;

    // Reset velocity so it doesn't continue gliding
    velocityRef.current.set(0, 0, 0);

    const pos = center.clone();
    switch (dir) {
      case "top": pos.y += dist; break;
      case "front": pos.z += dist; break;
      case "back": pos.z -= dist; break;
      case "left": pos.x -= dist; break;
      case "right": pos.x += dist; break;
    }

    cam.position.copy(pos);
    cam.lookAt(center);
    ctrl.target.copy(center);
    ctrl.update();
  }, []);

  const handleScreenshot = useCallback(() => {
    const renderer = rendererRef.current; const overlayCanvas = overlayRef.current;
    if (!renderer || !overlayCanvas) return;

    renderer.render(sceneRef.current!, cameraRef.current!);
    drawOverlayRef.current();

    const glCanvas = renderer.domElement;
    const out = document.createElement("canvas");
    out.width = glCanvas.width; out.height = glCanvas.height;

    const ctx = out.getContext("2d"); if (!ctx) return;
    ctx.drawImage(glCanvas, 0, 0);
    ctx.drawImage(overlayCanvas, 0, 0, out.width, out.height);

    const url = out.toDataURL("image/png");
    const slug = schoolName ? schoolName.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") : "rtb_3d_viewer";
    const a = document.createElement("a"); a.href = url; a.download = `${slug}_${new Date().toISOString().slice(0, 10)}.png`; a.click();
    setScreenshotFlash(true); setTimeout(() => setScreenshotFlash(false), 1400);
  }, []);

  // ── Load GLB ────────────────────────────────────────────────────────────────
  const loadGLB = useCallback(async (file: File) => {
    setError(null); setPhase("loading"); setProgress(0); setProgressLabel("Reading file…");
    origMatsRef.current.clear(); unlitMatsRef.current.clear();
    velocityRef.current.set(0, 0, 0);
    loadedFileNameRef.current = file.name;
    threeInitPromiseRef.current = new Promise<void>(resolve => { threeInitResolveRef.current = resolve; });
    const startTime = Date.now();
    try {
      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onprogress = e => { if (e.lengthComputable) { setProgress(Math.round(e.loaded / e.total * 75)); setProgressLabel(`Reading… ${formatBytes(e.loaded)} / ${formatBytes(e.total)}`); } };
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(new Error("File read failed"));
        reader.readAsArrayBuffer(file);
      });
      setProgress(78); setProgressLabel("Parsing GLB…");
      const loader = new GLTFLoader(); loader.setDRACOLoader(sharedDracoLoader);
      const gltf = await new Promise<GLTF>((resolve, reject) => { loader.parse(arrayBuffer, "", g => resolve(g), (e: ErrorEvent) => reject(e)); });
      await finalizeGLTF(gltf, file.name, file.size, startTime);
    } catch (err: any) { setError(err?.message || "Failed to load model"); setPhase("idle"); }
  }, [finalizeGLTF]);

  const loadGLBFromURL = useCallback(async (url: string, fileName: string) => {
    setError(null); setPhase("loading"); setProgress(0); setProgressLabel("Loading model…");
    origMatsRef.current.clear(); unlitMatsRef.current.clear();
    velocityRef.current.set(0, 0, 0);
    loadedFileNameRef.current = fileName;
    threeInitPromiseRef.current = new Promise<void>(resolve => { threeInitResolveRef.current = resolve; });
    const startTime = Date.now();
    let fileSize = 0;
    try {
      let arrayBuffer: ArrayBuffer;
      const cache = await caches.open("glb-cache-v1");
      let response = await cache.match(url);
      
      if (response) {
        arrayBuffer = await response.arrayBuffer();
        fileSize = arrayBuffer.byteLength;
        setProgress(85);
        setProgressLabel("Loaded from cache...");
      } else {
        response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch model");
        
        const contentLength = response.headers.get("content-length");
        const total = contentLength ? parseInt(contentLength, 10) : 0;
        fileSize = total;

        if (response.body && total > 0) {
          const reader = response.body.getReader();
          const chunks = [];
          let received = 0;
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              chunks.push(value);
              received += value.length;
              setProgress(Math.round((received / total) * 85));
              setProgressLabel(`${formatBytes(received)} / ${formatBytes(total)}`);
            }
          }
          
          const allChunks = new Uint8Array(received);
          let position = 0;
          for (const chunk of chunks) {
            allChunks.set(chunk, position);
            position += chunk.length;
          }
          arrayBuffer = allChunks.buffer;
        } else {
          arrayBuffer = await response.arrayBuffer();
          fileSize = arrayBuffer.byteLength;
          setProgress(85);
          setProgressLabel(`${formatBytes(fileSize)} / ${formatBytes(fileSize)}`);
        }
        cache.put(url, new Response(arrayBuffer));
      }

      setProgressLabel("Parsing GLB…");
      const loader = new GLTFLoader(); loader.setDRACOLoader(sharedDracoLoader);
      const gltf = await new Promise<GLTF>((resolve, reject) => {
        loader.parse(arrayBuffer, "", resolve, reject);
      });
      await finalizeGLTF(gltf, fileName, fileSize, startTime);
    } catch (err: any) { setError(err?.message || "Failed to load model"); setPhase("idle"); }
  }, [finalizeGLTF]);

  // Auto-load from file-server when schoolId is in URL.
  // Viewer-state is pre-fetched in parallel so it's ready by the time the GLB finishes parsing.
  useEffect(() => {
    if (!schoolId) return;
    viewerStatePrefetchRef.current = fetch(`${FILE_SERVER_URL}/schools/${schoolId}/viewer-state`)
      .then(r => r.ok ? r.json() : null)
      .catch(() => null);
    fetch(`${FILE_SERVER_URL}/schools/${schoolId}/3d`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error("No 3D model found for this school")))
      .then(data => loadGLBFromURL(`${FILE_SERVER_URL}${data.url}`, data.filename))
      .catch(err => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  const handleFile = useCallback((file: File) => { if (!file.name.toLowerCase().endsWith(".glb")) { setError("Only .glb files are supported."); return; } loadGLB(file); }, [loadGLB]);
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) handleFile(f); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); };

  // ── Annotation: place directly in 3D viewer ────────────────────────────────
  const submit3DAnnotation = useCallback((iconType: string, title: string, _description: string, mapColor: string) => {
    const pt = annotPendingPt;
    const buildingId = pinBuildingIdRef.current;
    setAnnotPickerOpen(false);
    setAnnotPendingPt(null);
    setMeasureMode(null);
    if (buildingId) setPinBuildingId(null);

    if (!pt) return;
    const emoji = ICON_EMOJI_MAP[iconType] || "";
    const label = [emoji, title].filter(Boolean).join(" ") || "Note";
    const a: Annotation = { id: uid(), point: pt, text: label, color: mapColor || ANNOT_COLORS[colorIdxRef.current % ANNOT_COLORS.length] };
    colorIdxRef.current++;
    setAnnotations(prev => [...prev, a]);

    // If this was a building pin placement, store the pin and fly to it
    if (buildingId) {
      setBuildingPins(prev => ({ ...prev, [buildingId]: pt }));
      const cam = cameraRef.current, ctrl = controlsRef.current;
      if (cam && ctrl) {
        const target = new THREE.Vector3(pt.x, pt.y, pt.z);
        const startPos = cam.position.clone(), startTarget = ctrl.target.clone();
        const dist = cam.position.distanceTo(ctrl.target);
        const flyDist = Math.max(3, dist * 0.2);
        const endPos = target.clone().add(new THREE.Vector3(flyDist * 0.3, flyDist * 0.7, flyDist * 0.5));
        const t0 = Date.now();
        const step = () => {
          const t = Math.min(1, (Date.now() - t0) / 900);
          const e = 1 - Math.pow(1 - t, 3);
          cam.position.lerpVectors(startPos, endPos, e);
          ctrl.target.lerpVectors(startTarget, target, e);
          ctrl.update();
          if (t < 1) requestAnimationFrame(step);
        };
        step();
      }
    }
  }, [annotPendingPt]);

  const cancelAnnotation = useCallback(() => {
    setAnnotPickerOpen(false);
    setAnnotPendingPt(null);
    setPinBuildingId(null);
  }, []);

  // ── Fly camera to a 3D world point ───────────────────────────────────────────
  const flyToPoint = useCallback((pt: MeasurePoint) => {
    const cam = cameraRef.current, ctrl = controlsRef.current;
    if (!cam || !ctrl) return;
    const target = new THREE.Vector3(pt.x, pt.y, pt.z);
    const startPos = cam.position.clone(), startTarget = ctrl.target.clone();
    const currentDist = cam.position.distanceTo(ctrl.target);
    const flyDist = Math.max(5, currentDist * 0.25);
    const endPos = target.clone().add(new THREE.Vector3(flyDist * 0.4, flyDist * 0.8, flyDist * 0.6));
    const t0 = Date.now();
    const step = () => {
      const t = Math.min(1, (Date.now() - t0) / 1000);
      const ease = 1 - Math.pow(1 - t, 3);
      cam.position.lerpVectors(startPos, endPos, ease);
      ctrl.target.lerpVectors(startTarget, target, ease);
      ctrl.update();
      if (t < 1) requestAnimationFrame(step);
    };
    step();
  }, []);

  // ── Add building via API ─────────────────────────────────────────────────────
  const handleAddBuilding = useCallback(async (data: any) => {
    const res = await api.post(`/schools/${schoolId}/buildings`, data);
    const newBuilding = normalizeBuilding(res.data);
    setDbBuildings(prev => [...prev, newBuilding]);
    setShowAddBuildingModal(false);
    // Auto-select the new building and enter pin mode
    setSelectedBuilding(newBuilding);
    setPinBuildingId(newBuilding.id);
    setShowBuildingsList(true);
  }, [schoolId]);

  // ── Delete building via API ───────────────────────────────────────────────────
  const handleDeleteBuilding = useCallback(async (id: string) => {
    await api.delete(`/schools/buildings/${id}`);
    setDbBuildings(prev => prev.filter((b: any) => b.id !== id));
    setBuildingPins(prev => { const next = { ...prev }; delete next[id]; return next; });
    if (selectedBuilding?.id === id) setSelectedBuilding(null);
  }, [selectedBuilding]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="glb-root">
      <ViewerUIHeader
        schoolName={schoolName}
        stats={stats}
        progress={progress}
        onClose={onClose}
      />

      {error && <div className="error-bar"><span>⚠</span> {error}</div>}

      {phase === "idle" && (
        <ViewerLoadingScreens
          phase={phase}
          progress={progress}
          progressLabel={progressLabel}
          isDragging={isDragging}
          schoolName={schoolName}
          setIsDragging={setIsDragging}
          handleDrop={handleDrop}
          handleInputChange={handleInputChange}
        />
      )}

      {/* viewer-wrapper stays mounted from "loading" onwards so the Three.js canvas
          is in the DOM and initThree can run in parallel with the GLB download.
          ViewerMainCanvas has its own loading overlay (progress < 100) that covers
          the scene during download. */}
      {phase !== "idle" && (
        <div className="viewer-wrapper">
          <ViewerMainCanvas
            ref={mountRef}
            overlayRef={overlayRef}
            progress={progress}
            progressLabel={progressLabel}
            measureMode={measureMode}
            isPinMode={!!pinBuildingId}
            handleOverlayMouseMove={handleOverlayMouseMove}
            handleOverlayClick={handleOverlayClick}
            handleOverlayDoubleClick={handleOverlayDoubleClick}
            handleOverlayContextMenu={handleOverlayContextMenu}
          />

          {phase === "viewing" && (
            <>
              {!selectedBuilding && (
                <ViewerControlToolbar
                  handleResetCamera={handleResetCamera}
                  saveFlash={saveFlash}
                  homeSaved={homeSaved}
                  speedSteps={SPEED_STEPS}
                  handleSaveHome={handleSaveHome}
                  toggleOrientation={toggleOrientation}
                  setView={setView}
                  speedIdx={speedIdx}
                  speedUp={speedUp}
                  speedDown={speedDown}
                  showMeasurePanel={showMeasurePanel}
                  setShowMeasurePanel={setShowMeasurePanel}
                  screenshotFlash={screenshotFlash}
                  handleScreenshot={handleScreenshot}
                  showHelp={showHelp}
                  setShowHelp={setShowHelp}
                  showBuildingsList={showBuildingsList}
                  setShowBuildingsList={setShowBuildingsList}
                  buildingsCount={dbBuildings.length}
                />
              )}

              {!selectedBuilding && (
                <ViewerRenderModePanel
                  modeLabels={MODE_LABELS}
                  renderMode={renderMode}
                  setRenderMode={setRenderMode}
                />
              )}

              <ViewerMeasureToolbar
                measureMode={measureMode}
                showUnitDropdown={showUnitDropdown}
                setShowUnitDropdown={setShowUnitDropdown}
                unit={unit}
                setUnit={setUnit}
                toggleMode={toggleMode}
                measuresCount={measures.length}
                annotationsCount={annotations.length}
                visibility={visibility}
                cycleVisibility={cycleVisibility}
                pendingPtsCount={pendingPts.length}
                finalizeMeasure={finalizeMeasure}
                setMeasureMode={setMeasureMode}
                setPendingPts={setPendingPts}
                unitLabels={UNIT_LABELS}
                unitSuffix={UNIT_SUFFIX}
                buildingMarkersCount={dbMarkers.filter(m => m.type === "block").length}
              />

              {showMeasurePanel && (
                <ViewerMeasurePanel
                  measures={measures}
                  annotations={annotations}
                  clearAllMeasurements={clearAllMeasurements}
                  setMeasures={setMeasures}
                  setAnnotations={setAnnotations}
                />
              )}

              {selectedBuilding && (
                <ViewerBuildingPanel
                  building={selectedBuilding}
                  onClose={() => setSelectedBuilding(null)}
                />
              )}

              {pinBuildingId && (
                <div style={{
                  position: "absolute", bottom: 48, left: "50%", transform: "translateX(-50%)",
                  background: "rgba(6,11,26,0.92)", border: "1px solid rgba(251,191,36,0.5)",
                  borderRadius: 10, padding: "10px 18px", color: "#fcd34d", fontSize: 12,
                  fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.3px",
                  display: "flex", alignItems: "center", gap: 10, zIndex: 40, pointerEvents: "auto",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
                }}>
                  <span style={{ fontSize: 16 }}>📍</span>
                  <span>
                    Click on the 3D model to pin <em style={{ fontStyle: "normal", color: "#fef3c7" }}>
                      {dbBuildings.find((b: any) => b.id === pinBuildingId)?.buildingName || "building"}
                    </em>
                  </span>
                  <button onClick={() => setPinBuildingId(null)} style={{
                    marginLeft: 8, background: "rgba(255,255,255,0.08)", border: "none",
                    color: "#fcd34d", cursor: "pointer", fontSize: 14, padding: "2px 6px", borderRadius: 5,
                  }}>✕</button>
                </div>
              )}

              {showBuildingsList && (
                <BuildingsListPanel
                  buildings={dbBuildings as BuildingData[]}
                  selectedId={selectedBuilding?.id}
                  onClose={() => setShowBuildingsList(false)}
                  onDelete={handleDeleteBuilding}
                  onAdd={() => setShowAddBuildingModal(true)}
                  onSelect={(b) => {
                    setSelectedBuilding(b);
                    const pin = buildingPinsRef.current[b.id] as any;
                    if (pin) {
                      // Fly to existing recorded pin position
                      if (pin.camera) {
                        const cam = cameraRef.current, ctrl = controlsRef.current;
                        if (cam && ctrl) {
                          const target = new THREE.Vector3(pin.camera.target.x, pin.camera.target.y, pin.camera.target.z);
                          const endPos = new THREE.Vector3(pin.camera.position.x, pin.camera.position.y, pin.camera.position.z);
                          const startPos = cam.position.clone(), startTarget = ctrl.target.clone();
                          const t0 = Date.now();
                          const step = () => {
                            const t = Math.min(1, (Date.now() - t0) / 1000);
                            const ease = 1 - Math.pow(1 - t, 3);
                            cam.position.lerpVectors(startPos, endPos, ease);
                            ctrl.target.lerpVectors(startTarget, target, ease);
                            cam.near = pin.camera.near; cam.far = pin.camera.far; cam.updateProjectionMatrix();
                            ctrl.update();
                            if (t < 1) requestAnimationFrame(step);
                          };
                          step();
                        }
                      } else {
                        flyToPoint(pin);
                      }
                    } else {
                      // Enter pin-placement mode: next model click records this building's 3D location
                      setPinBuildingId(b.id);
                    }
                    if (window.innerWidth < 768) setShowBuildingsList(false);
                  }}
                />
              )}

              <AnnotationPickerModal
                open={annotPickerOpen}
                annotationType="point"
                initialTitle={pinBuildingId
                  ? (dbBuildings.find((b: any) => b.id === pinBuildingId)?.buildingName || "")
                  : ""}
                onConfirm={submit3DAnnotation}
                onCancel={cancelAnnotation}
              />

              <ViewerStatsFooter
                stats={stats}
                showMeasurePanel={showMeasurePanel}
                formatBytes={formatBytes}
                formatTime={formatTime}
              />

              {showHelp && (
                <ViewerHelpModal
                  setShowHelp={setShowHelp}
                />
              )}

              {showAddBuildingModal && (
                <ViewerAddBuildingModal
                  onAdd={handleAddBuilding}
                  onCancel={() => setShowAddBuildingModal(false)}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}