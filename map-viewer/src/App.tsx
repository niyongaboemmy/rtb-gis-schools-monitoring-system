import { useRef, useEffect, useState, useCallback, memo } from "react";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "meshoptimizer";
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from "three-mesh-bvh";

(THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree;
(THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// ─── Components to dramatically speed up text input without re-rendering the whole App ────────
const LocalInput = memo(({ value, onChangeValue, onEnter, onBlur, ...props }: any) => {
  const [val, setVal] = useState(value || "");
  useEffect(() => { setVal(value || ""); }, [value]);
  return (
    <input 
      value={val} 
      onChange={e => {
        setVal(e.target.value);
        if (onChangeValue) onChangeValue(e.target.value);
      }} 
      onBlur={(e) => onBlur?.(e, val)}
      onKeyDown={e => {
        if (e.key === "Enter" && onEnter) {
          e.preventDefault();
          onEnter(val);
        }
        props.onKeyDown?.(e);
      }}
      {...props} 
    />
  );
});

const LocalTextArea = memo(({ value, onChangeValue, onEnter, onBlur, ...props }: any) => {
  const [val, setVal] = useState(value || "");
  useEffect(() => { setVal(value || ""); }, [value]);
  return (
    <textarea 
      value={val} 
      onChange={e => {
        setVal(e.target.value);
        if (onChangeValue) onChangeValue(e.target.value);
      }} 
      onBlur={(e) => onBlur?.(e, val)}
      onKeyDown={e => {
        if (e.key === "Enter" && !e.shiftKey && onEnter) {
          e.preventDefault();
          onEnter(val);
        }
        props.onKeyDown?.(e);
      }}
      {...props} 
    />
  );
});

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
interface MediaItem { id: string; filename: string; url: string; title: string; type: "image" | "video"; }
interface Reply { id: string; text: string; author: string; timestamp: number; }
interface Comment { id: string; text: string; author: string; timestamp: number; replies: Reply[]; }
interface MediaPoint { id: string; point: MeasurePoint; title: string; addedBy: string; comment?: string; comments: Comment[]; items: MediaItem[]; }

// ─── Constants ────────────────────────────────────────────────────────────────

const LS_HOME_KEY = "glb_viewer_home_v1";
const LS_MODE_KEY = "glb_viewer_mode_v1";
const LS_MEASURES_KEY = "glb_viewer_measures_v1";
const LS_ANNOTATIONS_KEY = "glb_viewer_annotations_v1";
const LS_UNIT_KEY = "glb_viewer_unit_v1";
const LS_MEDIA_KEY = "glb_viewer_media_v1";

const MODE_LABELS: Record<RenderMode, string> = { unlit: "Unlit (Metashape-style)", lit: "Lit (PBR)", wireframe: "Wireframe" };
const UNIT_LABELS: Record<Unit, string> = { m: "Meters (m)", cm: "Centimeters (cm)", mm: "Millimeters (mm)", km: "Kilometers (km)", ft: "Feet (ft)", in: "Inches (in)" };
const UNIT_FACTOR: Record<Unit, number> = { m: 1, cm: 100, mm: 1000, km: 0.001, ft: 3.28084, in: 39.3701 };
const UNIT_SUFFIX: Record<Unit, string> = { m: "m", cm: "cm", mm: "mm", km: "km", ft: "ft", in: "in" };
const AREA_SUFFIX: Record<Unit, string> = { m: "m²", cm: "cm²", mm: "mm²", km: "km²", ft: "ft²", in: "in²" };

const MEASURE_COLORS = ["#3b82f6", "#2563eb", "#00d4aa", "#ffb347", "#7ec8e3", "#ff7f50"];
const ANNOT_COLORS = ["#00d4aa", "#2563eb", "#ffb347", "#7ec8e3", "#93c5fd", "#ffffff"];
const NAV_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "W", "A", "S", "D", "q", "e", "Q", "E", "r", "f", "R", "F", "Shift"]);
const SPEED_STEPS = [0.001, 0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(b: number) { if (!b) return "0 B"; const k = 1024, s = ["B", "KB", "MB", "GB"], i = Math.floor(Math.log(b) / Math.log(k)); return `${parseFloat((b / Math.pow(k, i)).toFixed(2))} ${s[i]}`; }
function formatTime(ms: number) { return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`; }
function nearestSpeedIdx(v: number) { return SPEED_STEPS.reduce((b, s, i) => Math.abs(s - v) < Math.abs(SPEED_STEPS[b] - v) ? i : b, Math.floor(SPEED_STEPS.length / 2)); }
function fmtSpeed(v: number) { if (v < 0.01) return v.toFixed(3); if (v < 0.1) return v.toFixed(2); if (v < 10) return v.toFixed(1); return v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0); }
function uid() { return Math.random().toString(36).slice(2, 9); }
function timeAgo(ts: number): string { const d = (Date.now() - ts) / 1000; if (d < 60) return "just now"; if (d < 3600) return `${Math.floor(d / 60)}m ago`; if (d < 86400) return `${Math.floor(d / 3600)}h ago`; return `${Math.floor(d / 86400)}d ago`; }

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

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(new Error("Failed to read file"));
    r.readAsDataURL(file);
  });
}

// ─── Shared DRACO loader (pre-warmed, reused across loads) ───────────────────
const sharedDracoLoader = new DRACOLoader();
sharedDracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.6/");
sharedDracoLoader.preload();

const _dummyRenderer = new THREE.WebGLRenderer();
const sharedKtx2Loader = new KTX2Loader();
sharedKtx2Loader.setTranscoderPath("https://www.gstatic.com/basis-universal/versioned/2021-04-15-basis/");
sharedKtx2Loader.detectSupport(_dummyRenderer);
_dummyRenderer.dispose();

// ─── Overlay canvas helpers ───────────────────────────────────────────────────

// Reusable vector — avoids GC pressure in per-frame projection calls
const _pv = new THREE.Vector3();

function project3Dto2D(pt: MeasurePoint, camera: THREE.Camera, w: number, h: number): [number, number] | null {
  _pv.set(pt.x, pt.y, pt.z);
  _pv.project(camera);
  if (_pv.z < -1 || _pv.z > 1) return null;
  return [(_pv.x * 0.5 + 0.5) * w, (-_pv.y * 0.5 + 0.5) * h];
}

// Inline proximity test — zero allocation, returns hit id or null
function hitMediaPoint(
  pts: MediaPoint[], camera: THREE.Camera,
  cx: number, cy: number, W: number, H: number
): string | null {
  for (const mp of pts) {
    _pv.set(mp.point.x, mp.point.y, mp.point.z);
    _pv.project(camera);
    if (_pv.z < -1 || _pv.z > 1) continue;
    const sx = (_pv.x * 0.5 + 0.5) * W;
    const sy = (-_pv.y * 0.5 + 0.5) * H;
    const dx = sx - cx, dy = sy - cy;
    if (dx * dx + dy * dy < 484) return mp.id; // radius 22px
  }
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

const FILE_SERVER = "/file-server";

export default function GLBViewer() {
  const params = new URLSearchParams(window.location.search);
  const schoolId = params.get("schoolId") ?? "";
  const schoolName = params.get("schoolName") ?? "";
  const viewerUser = params.get("viewerUser") ?? "Guest";

  const mountRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animFrameRef = useRef<number>(0);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const velocityRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const moveSpeedRef = useRef<number>(1);
  const cameraHomeRef = useRef<CameraHome | null>(null);
  const loadedFileNameRef = useRef<string>("");
  const origMatsRef = useRef<Map<THREE.Mesh, THREE.Material | THREE.Material[]>>(new Map());
  const unlitMatsRef = useRef<Map<THREE.Mesh, THREE.MeshBasicMaterial>>(new Map());
  const raycasterRef = useRef(new THREE.Raycaster());
  const clickDebounceRef = useRef(0);

  const hoverPtRef = useRef<MeasurePoint | null>(null);
  // Cached accurate raycast — precomputed on mousemove (throttled ~30fps) for zero-latency click placement
  const lastAccuratePtRef = useRef<MeasurePoint | null>(null);
  const lastRaycastTimeRef = useRef(0);
  // Camera history for back/forward navigation
  const camHistoryRef = useRef<CameraHome[]>([]);
  const camHistoryIdxRef = useRef<number>(-1);
  const pushCameraHistoryFnRef = useRef<() => void>(() => { });

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

  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleSave = useCallback(() => {
    if (!schoolId) return;
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    saveDebounceRef.current = setTimeout(() => {
      fetch(`${FILE_SERVER}/schools/${schoolId}/viewer-state`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          home: cameraHomeRef.current,
          annotations: annotationsRef.current,
          measures: measuresRef.current,
          mediaPoints: mediaPointsRef.current,
        }),
      }).catch(() => { });
    }, 800);
  }, [schoolId]);
  const [showMeasurePanel, setShowMeasurePanel] = useState(false);
  const [screenshotFlash, setScreenshotFlash] = useState(false);
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);
  const colorIdxRef = useRef(0);

  // Annotate modal state
  const [editAnnotId, setEditAnnotId] = useState<string | null>(null);
  const [annotInput, setAnnotInput] = useState("");
  const annotInputRef = useRef("");
  const [annotPendingPt, setAnnotPendingPt] = useState<MeasurePoint | null>(null);
  const [annotColor, setAnnotColor] = useState<string>(ANNOT_COLORS[0]);

  // Media points state
  const [mediaPoints, setMediaPoints] = useState<MediaPoint[]>(() => {
    const raw = loadJson<any[]>(LS_MEDIA_KEY, []);
    return raw.map(mp => ({
      ...mp,
      addedBy: mp.addedBy ?? "Unknown",
      comments: mp.comments ?? (mp.comment ? [{ id: uid(), text: mp.comment, author: "Unknown", timestamp: Date.now(), replies: [] }] : []),
    }));
  });
  const mediaPointsRef = useRef<MediaPoint[]>([]);
  useEffect(() => { mediaPointsRef.current = mediaPoints; }, [mediaPoints]);
  const addMediaModeRef = useRef(false);
  const measureModeRef = useRef<MeasureMode>(null);
  const showMediaModalRef = useRef(false);
  const viewerWrapperRef = useRef<HTMLDivElement>(null);
  const mediaHoverRef = useRef<string | null>(null);
  const [addMediaMode, setAddMediaMode] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [mediaModalPointId, setMediaModalPointId] = useState<string | null>(null);
  const [mediaModalTab, setMediaModalTab] = useState<"images" | "videos" | "comments" | "all">("images");
  const [mediaUploadLoading, setMediaUploadLoading] = useState(false);
  
  // Decoupled input states with refs to prevent massive App.tsx re-renders
  const [mediaEditTitle, setMediaEditTitle] = useState("");
  const mediaEditTitleRef = useRef("");
  const [mediaCommentInput, setMediaCommentInput] = useState("");
  const mediaCommentInputRef = useRef("");
  const [mediaItemTitleInput, setMediaItemTitleInput] = useState("");
  const mediaItemTitleInputRef = useRef("");
  const [lightboxItem, setLightboxItem] = useState<MediaItem | null>(null);
  const [camHistIdx, setCamHistIdx] = useState(-1);
  const [camHistLen, setCamHistLen] = useState(0);
  const [newCommentText, setNewCommentText] = useState("");
  const newCommentTextRef = useRef("");
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const replyTextsRef = useRef<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isAddingPoint, setIsAddingPoint] = useState(false);

  // Sync mode refs (used in event handlers to avoid stale closures + React re-renders)
  useEffect(() => { addMediaModeRef.current = addMediaMode; }, [addMediaMode]);
  useEffect(() => { measureModeRef.current = measureMode; }, [measureMode]);
  useEffect(() => { showMediaModalRef.current = showMediaModal; }, [showMediaModal]);

  // Persist (localStorage + server)
  useEffect(() => { saveJson(LS_MEASURES_KEY, measures); scheduleSave(); }, [measures, scheduleSave]);
  useEffect(() => { saveJson(LS_ANNOTATIONS_KEY, annotations); scheduleSave(); }, [annotations, scheduleSave]);
  useEffect(() => { saveJson(LS_UNIT_KEY, unit); }, [unit]);
  useEffect(() => { saveJson(LS_MEDIA_KEY, mediaPoints); scheduleSave(); }, [mediaPoints, scheduleSave]);

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
    // Poll until initThree() has run and populated refs (runs after React re-renders the viewer DOM)
    await new Promise<void>(resolve => {
      const poll = () => {
        if (sceneRef.current && cameraRef.current && controlsRef.current) resolve();
        else setTimeout(poll, 16);
      };
      setTimeout(poll, 0);
    });

    const scene = sceneRef.current!, camera = cameraRef.current!, controls = controlsRef.current!;
    const maxAniso = rendererRef.current?.capabilities.getMaxAnisotropy() ?? 16;
    if (modelRef.current) { scene.remove(modelRef.current); modelRef.current = null; }
    const model = gltf.scene;

    const upgradeTex = (tex: THREE.Texture | null) => {
      if (!tex) return; tex.anisotropy = maxAniso; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.needsUpdate = true;
    };
    model.traverse(child => {
      const mesh = child as THREE.Mesh; if (!mesh.isMesh) return;
      if (mesh.geometry && !(mesh.geometry as any).boundsTree) {
        (mesh.geometry as any).computeBoundsTree();
      }
      origMatsRef.current.set(mesh, mesh.material);
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m: any) => { ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "aoMap"].forEach(k => upgradeTex(m[k])); });
      const srcMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      const diffuseTex = (srcMat as any).map ?? null; if (diffuseTex) upgradeTex(diffuseTex);
      const unlitMat = new THREE.MeshBasicMaterial({ map: diffuseTex, vertexColors: (srcMat as any).vertexColors ?? false, side: (srcMat as any).side ?? THREE.FrontSide, transparent: (srcMat as any).transparent ?? false, opacity: (srcMat as any).opacity ?? 1, alphaTest: (srcMat as any).alphaTest ?? 0 });
      unlitMatsRef.current.set(mesh, unlitMat);
    });

    scene.add(model); modelRef.current = model;

    // ── Auto-correct: center X/Z, snap bottom to Y=0 ────────────────────────
    model.updateMatrixWorld(true);
    let box = new THREE.Box3().setFromObject(model);
    if (box.isEmpty()) box.set(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));

    const rawCenter = box.getCenter(new THREE.Vector3());
    model.position.set(-rawCenter.x, -box.min.y, -rawCenter.z);
    model.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(model);

    applyRenderMode(renderMode);

    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const center = box.getCenter(new THREE.Vector3());
    const halfDiag = box.getBoundingSphere(new THREE.Sphere()).radius;
    const fovRad = camera.fov * (Math.PI / 180);
    const distance = (halfDiag / Math.tan(fovRad / 2)) * 1.4;

    camera.near = distance * 0.0001; camera.far = distance * 100; camera.updateProjectionMatrix();

    let savedHome: CameraHome | null = null;
    try { const s = localStorage.getItem(getHomeKey(fileName)); if (s) savedHome = JSON.parse(s); } catch { }

    // Server-side state takes priority over localStorage
    if (schoolId) {
      try {
        const resp = await fetch(`${FILE_SERVER}/schools/${schoolId}/viewer-state`);
        if (resp.ok) {
          const serverState = await resp.json();
          if (serverState.home) savedHome = serverState.home;
          if (serverState.annotations?.length) setAnnotations(serverState.annotations);
          if (serverState.measures?.length) setMeasures(serverState.measures);
          if (serverState.mediaPoints?.length) setMediaPoints(serverState.mediaPoints.map((mp: any) => ({ ...mp, addedBy: mp.addedBy ?? "Unknown", comments: mp.comments ?? (mp.comment ? [{ id: uid(), text: mp.comment, author: "Unknown", timestamp: Date.now(), replies: [] }] : []) })));
        }
      } catch { }
    }

    if (savedHome) {
      camera.position.set(savedHome.position.x, savedHome.position.y, savedHome.position.z);
      camera.near = savedHome.near; camera.far = savedHome.far; camera.updateProjectionMatrix();
      controls.target.set(savedHome.target.x, savedHome.target.y, savedHome.target.z);
      cameraHomeRef.current = savedHome; setHomeSaved(true);
    } else {
      // Aerial top-down: camera above and to the side at ~45°
      const hp = new THREE.Vector3(distance * 0.6, distance * 0.8, distance * 0.6);
      camera.position.copy(hp); camera.lookAt(center); controls.target.copy(center);
      cameraHomeRef.current = { position: { x: hp.x, y: hp.y, z: hp.z }, target: { x: center.x, y: center.y, z: center.z }, near: camera.near, far: camera.far };
      setHomeSaved(false);
    }

    controls.minDistance = camera.near * 10; controls.maxDistance = camera.far; controls.update();
    // Seed the history with the initial view so Back is immediately available
    setTimeout(() => pushCameraHistoryFnRef.current(), 120);
    const autoSpeed = Math.max(0.001, maxDim * 0.003); moveSpeedRef.current = autoSpeed; setSpeedIdx(nearestSpeedIdx(autoSpeed));

    // Grid snapped to Y=0 (ground plane)
    const oldGrid = scene.children.find(c => c instanceof THREE.GridHelper); if (oldGrid) scene.remove(oldGrid);
    const gridSize = Math.max(size.x, size.z) * 3, divisions = Math.min(100, Math.max(10, Math.floor(gridSize / (maxDim * 0.1))));
    const newGrid = new THREE.GridHelper(gridSize, divisions, 0x0d1a3a, 0x0d1a3a);
    (newGrid.material as THREE.Material).opacity = 0.5; (newGrid.material as THREE.Material).transparent = true; newGrid.position.y = 0; scene.add(newGrid);

    let triangles = 0, meshCount = 0, textureCount = 0; const seen = new Set<THREE.Texture>();
    model.traverse(child => { const mesh = child as THREE.Mesh; if (!mesh.isMesh) return; meshCount++; const geo = mesh.geometry; triangles += geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3; const mats = Array.isArray(mesh.material) ? mesh.material as THREE.Material[] : [mesh.material as THREE.Material]; mats.forEach((m: any) => { ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap"].forEach(k => { if (m[k] && !seen.has(m[k])) { seen.add(m[k]); textureCount++; } }); }); });
    setStats({ fileName, fileSize, loadTime: Date.now() - startTime, triangles: Math.round(triangles), meshes: meshCount, textures: textureCount });
    setProgress(100); setProgressLabel("Done!");
  }, [renderMode, applyRenderMode, schoolId]);

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

    const drawLabel = (pt: MeasurePoint, text: string, color: string, offsetY = 0) => {
      const proj = project3Dto2D(pt, camera, W, H); if (!proj) return;
      const [x, y] = proj;
      const px = x + 10, py = y - 10 + offsetY;
      ctx.font = "bold 11px 'JetBrains Mono', monospace";
      const m = ctx.measureText(text);
      ctx.fillStyle = "rgba(6,11,26,0.82)";
      ctx.beginPath(); ctx.roundRect(px - 4, py - 13, m.width + 10, 18, 5); ctx.fill();
      ctx.fillStyle = color; ctx.fillText(text, px + 1, py);
    };

    // 1. Saved Measures (Filtered)
    if (visibility === "all" || visibility === "measures") {
      measures.forEach(m => {
        if (m.mode === "distance") {
          drawLine(m.points, m.color);
          m.points.forEach(p => drawDot(p, m.color, 5));
          if (m.points.length >= 2) drawLabel(m.points[m.points.length - 1], m.label, m.color, -22);
        } else {
          drawPolygon(m.points, m.color, true);
          m.points.forEach(p => drawDot(p, m.color, 4));
          if (m.points.length >= 2) drawLabel(m.points[0], m.label, m.color);
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
          if (measureMode === "area") {
            const all = [...livePts, hoverPt]; liveLabel = fmtArea(calcPolyArea(all), unit);
          } else {
            let currentDist = calcDistance(livePts);
            const dToHover = new THREE.Vector3(livePts[livePts.length - 1].x, livePts[livePts.length - 1].y, livePts[livePts.length - 1].z)
              .distanceTo(new THREE.Vector3(hoverPt.x, hoverPt.y, hoverPt.z));
            let total = currentDist + dToHover;
            if (measureMode === "perimeter" && livePts.length >= 2) {
              const dBackToStart = new THREE.Vector3(livePts[0].x, livePts[0].y, livePts[0].z).distanceTo(new THREE.Vector3(hoverPt.x, hoverPt.y, hoverPt.z));
              total += dBackToStart;
            }
            liveLabel = fmtDist(total, unit);
          }
          drawLabel(hoverPt, liveLabel, col, -22);
        }
      }
    }

    // 3. Annotations (Filtered)
    if (visibility === "all" || visibility === "annotations") {
      annotations.forEach(a => {
        drawDot(a.point, a.color, 7);
        const proj = project3Dto2D(a.point, camera, W, H); if (!proj) return;
        const [x, y] = proj;
        ctx.font = "bold 11px 'JetBrains Mono', monospace";
        const lines = a.text.split("\n");
        const maxW = Math.max(...lines.map(l => ctx.measureText(l).width));
        const bh = lines.length * 15 + 10;
        ctx.fillStyle = "rgba(6,11,26,0.88)";
        ctx.beginPath(); ctx.roundRect(x + 12, y - 16, maxW + 14, bh, 7); ctx.fill();
        ctx.strokeStyle = a.color; ctx.lineWidth = 1; ctx.setLineDash([]); ctx.stroke();
        ctx.fillStyle = a.color;
        lines.forEach((l, i) => ctx.fillText(l, x + 18, y - 4 + i * 15));
      });
    }

    // Draw the active annotation being placed
    if (annotPendingPt) drawDot(annotPendingPt, annotColor, 7);

    // 4. Media Points
    if (visibility === "all" || visibility === "annotations") {
      mediaPoints.forEach(mp => {
        const proj = project3Dto2D(mp.point, camera, W, H); if (!proj) return;
        const [x, y] = proj;
        // Glow ring
        ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(251,191,36,0.12)"; ctx.fill();
        // Circle
        ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2);
        ctx.fillStyle = addMediaMode ? "rgba(251,191,36,0.95)" : "rgba(251,191,36,0.82)";
        ctx.fill();
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.setLineDash([]); ctx.stroke();
        // Icon
        ctx.font = "11px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("📸", x, y);
        ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
        // Label
        const lbl = `${mp.title || "Media"}${mp.items.length ? ` (${mp.items.length})` : ""}`;
        drawLabel(mp.point, lbl, "#fbbf24", -26);
      });
    }

  }, [measures, measureMode, unit, annotations, annotPendingPt, visibility, annotColor, mediaPoints, addMediaMode]);

  const drawOverlayRef = useRef<() => void>(() => { });
  useEffect(() => { drawOverlayRef.current = drawOverlay; }, [drawOverlay]);

  // ── Three.js init ───────────────────────────────────────────────────────────
  const initThree = useCallback(() => {
    if (!mountRef.current) return;
    const w = mountRef.current.clientWidth, h = mountRef.current.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, precision: "highp", powerPreference: "high-performance", preserveDrawingBuffer: true });
    renderer.setSize(w, h); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 3));
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = false;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0a0a0f); sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.001, 1_000_000); camera.position.set(0, 2, 5); cameraRef.current = camera;
    scene.add(new THREE.AmbientLight(0xffffff, 1.0));
    const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(5, 10, 7); scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.5); fill.position.set(-5, 3, -5); scene.add(fill);
    const grid = new THREE.GridHelper(40, 40, 0x1a1a2e, 0x1a1a2e);
    (grid.material as THREE.Material).opacity = 0.4; (grid.material as THREE.Material).transparent = true; scene.add(grid);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.06; controls.minDistance = 0.001; controls.maxDistance = 1_000_000;
    controlsRef.current = controls;

    // Camera history — push snapshot 300ms after orbit/pan/zoom ends
    const histDebounce = { t: null as ReturnType<typeof setTimeout> | null };
    controls.addEventListener("end", () => {
      if (histDebounce.t) clearTimeout(histDebounce.t);
      histDebounce.t = setTimeout(() => pushCameraHistoryFnRef.current(), 300);
    });

    const _vDir = new THREE.Vector3(), _right = new THREE.Vector3(), _forward = new THREE.Vector3(), _wu = new THREE.Vector3(0, 1, 0);

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const keys = keysRef.current;

      if (keys.size > 0 && !measureMode) {
        camera.getWorldDirection(_forward);
        _forward.y = 0; _forward.normalize();
        _right.crossVectors(_forward, _wu).normalize();
        _vDir.set(0, 0, 0);

        const sp = moveSpeedRef.current * (keys.has("Shift") ? 0.32 : 0.08);
        if (keys.has("ArrowUp") || keys.has("w") || keys.has("W")) _vDir.addScaledVector(_forward, sp);
        if (keys.has("ArrowDown") || keys.has("s") || keys.has("S")) _vDir.addScaledVector(_forward, -sp);
        if (keys.has("ArrowLeft") || keys.has("a") || keys.has("A")) _vDir.addScaledVector(_right, -sp);
        if (keys.has("ArrowRight") || keys.has("d") || keys.has("D")) _vDir.addScaledVector(_right, sp);
        if (keys.has("e") || keys.has("E")) _vDir.addScaledVector(_wu, sp);
        if (keys.has("q") || keys.has("Q") || keys.has("f") || keys.has("F")) _vDir.addScaledVector(_wu, -sp);

        velocityRef.current.add(_vDir);
      }

      velocityRef.current.multiplyScalar(0.85);

      if (velocityRef.current.lengthSq() > 0.000001) {
        camera.position.add(velocityRef.current);
        controls.target.add(velocityRef.current);
      }

      controls.update();
      renderer.render(scene, camera);
      if (overlayRef.current) drawOverlayRef.current();
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current) return;
      const nw = mountRef.current.clientWidth, nh = mountRef.current.clientHeight;
      camera.aspect = nw / nh; camera.updateProjectionMatrix(); renderer.setSize(nw, nh);
      if (overlayRef.current) { overlayRef.current.width = nw; overlayRef.current.height = nh; }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (phase !== "viewing") return;
    const cleanup = initThree();
    return () => {
      cleanup?.(); cancelAnimationFrame(animFrameRef.current); rendererRef.current?.dispose();
      if (mountRef.current && rendererRef.current?.domElement.parentNode === mountRef.current)
        mountRef.current.removeChild(rendererRef.current.domElement);
    };
  }, [phase, initThree]);

  useEffect(() => {
    if (phase !== "viewing") return;
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
    const movStopDebounce = { t: null as ReturnType<typeof setTimeout> | null };
    const onDown = (e: KeyboardEvent) => {
      // Space = immediate full stop
      if (e.key === " ") { e.preventDefault(); if (!measureMode) { velocityRef.current.set(0, 0, 0); keysRef.current.clear(); } return; }
      if (!NAV_KEYS.has(e.key)) return;
      if (measureMode) return;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) e.preventDefault();
      keysRef.current.add(e.key);
    };
    const onUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key);
      // Push camera history 400ms after all movement keys released
      if (NAV_KEYS.has(e.key) && keysRef.current.size === 0) {
        if (movStopDebounce.t) clearTimeout(movStopDebounce.t);
        movStopDebounce.t = setTimeout(() => pushCameraHistoryFnRef.current(), 400);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setPendingPts([]); setMeasureMode(null); hoverPtRef.current = null; setAnnotPendingPt(null); setAddMediaMode(false); setShowMediaModal(false); setLightboxItem(null); }
      if (e.key === "Enter" && measureMode && pendingPts.length >= 2) finalizeMeasure();
    };
    window.addEventListener("keydown", onDown); window.addEventListener("keyup", onUp); window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); window.removeEventListener("keydown", onEsc);
      keysRef.current.clear(); velocityRef.current.set(0, 0, 0);
      if (movStopDebounce.t) clearTimeout(movStopDebounce.t);
    };
  }, [phase, measureMode, pendingPts, finalizeMeasure]);

  useEffect(() => {
    if (!controlsRef.current) return;
    controlsRef.current.enabled = !measureMode;
    if (measureMode) velocityRef.current.set(0, 0, 0);
  }, [measureMode]);

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

  const handleOverlayMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!measureMode) { hoverPtRef.current = null; return; }
    hoverPtRef.current = getFastHoverRaycastPt(e);
    // Throttled accurate mesh raycast so annotation click is instant (zero latency on click)
    if (measureMode === "annotate") {
      const now = performance.now();
      if (now - lastRaycastTimeRef.current > 33) {
        lastRaycastTimeRef.current = now;
        const canvas = overlayRef.current; const camera = cameraRef.current; const model = modelRef.current;
        if (canvas && camera && model) {
          const rect = canvas.getBoundingClientRect();
          const mouse = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
          raycasterRef.current.setFromCamera(mouse, camera);
          const hits = raycasterRef.current.intersectObject(model, true);
          if (hits.length) {
            lastAccuratePtRef.current = { x: hits[0].point.x, y: hits[0].point.y, z: hits[0].point.z };
          } else {
            const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
            const p = camera.position.clone().add(dir.multiplyScalar(10));
            lastAccuratePtRef.current = { x: p.x, y: p.y, z: p.z };
          }
        }
      }
    }
  }, [measureMode, getFastHoverRaycastPt]);

  const handleOverlayClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Always stop propagation — wrapper's handleViewerClick must NOT also fire for canvas clicks
    e.stopPropagation();

    if (addMediaMode) {
      // Debounce: ignore clicks within 400ms of the last one (prevents double-fire from StrictMode / fast taps)
      const now = Date.now();
      if (now - clickDebounceRef.current < 400) return;
      if (isAddingPoint) return; // Prevent multiple points from a single click event

      const canvas = overlayRef.current; const camera = cameraRef.current;
      if (!canvas || !camera) return;

      // Hit-test existing markers first
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
      const hitId = hitMediaPoint(mediaPointsRef.current, camera, cx, cy, canvas.width, canvas.height);
      if (hitId) {
        const mp = mediaPointsRef.current.find(m => m.id === hitId); if (!mp) return;
        setMediaModalPointId(mp.id); setMediaEditTitle(mp.title);
        setMediaModalTab("images"); setShowMediaModal(true);
        return;
      }

      if (showMediaModalRef.current) return; // modal already open — don't create another point
      showMediaModalRef.current = true; // Lock immediately to prevent race conditions & double-creation

      clickDebounceRef.current = now;
      // Use pre-computed cached raycast pt for zero-latency placement
      const cached = lastAccuratePtRef.current; lastAccuratePtRef.current = null;
      setIsAddingPoint(true); // Set flag
      const pt = cached ?? (() => {
        const model = modelRef.current; if (!model) return null;
        const mouse = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
        raycasterRef.current.setFromCamera(mouse, camera);
        const hits = raycasterRef.current.intersectObject(model, true);
        if (hits.length) return { x: hits[0].point.x, y: hits[0].point.y, z: hits[0].point.z } as MeasurePoint;
        const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
        const p = camera.position.clone().add(dir.multiplyScalar(10));
        return { x: p.x, y: p.y, z: p.z } as MeasurePoint;
      })();
      if (!pt) return;

      const newId = uid();
      setMediaPoints(prev => [...prev, { id: newId, point: pt, title: "", addedBy: viewerUser, comments: [], items: [] }]);
      setMediaModalPointId(newId); setMediaEditTitle(""); setMediaModalTab("images"); setShowMediaModal(true);
      // Reset flag after modal logic is complete
      setTimeout(() => {
        setIsAddingPoint(false);
      }, 100);
    }

    if (!measureMode) return;

    if (measureMode === "annotate") {
      const pt = lastAccuratePtRef.current ?? getAccurateRaycastPt(e);
      lastAccuratePtRef.current = null;
      if (!pt) return;
      setAnnotPendingPt(pt); setAnnotInput(""); setEditAnnotId(null); setAnnotColor(ANNOT_COLORS[0]);
      return;
    }

    const pt = hoverPtRef.current; if (!pt) return;
    const prev = pendingPtsRef.current;
    if (prev.length > 0) {
      const last = prev[prev.length - 1];
      if (new THREE.Vector3(last.x, last.y, last.z).distanceTo(new THREE.Vector3(pt.x, pt.y, pt.z)) < 0.000001) return;
    }
    const next = [...prev, pt];
    pendingPtsRef.current = next;
    setPendingPts(next);
  }, [addMediaMode, measureMode, getAccurateRaycastPt, viewerUser]);

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
      fetch(`${FILE_SERVER}/schools/${schoolId}/viewer-state`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ home, annotations: annotationsRef.current, measures: measuresRef.current }),
      }).catch(() => { });
    }

    setHomeSaved(true); setSaveFlash(true); setTimeout(() => setSaveFlash(false), 1200);
  }, [schoolId]);

  // ── Camera history ───────────────────────────────────────────────────────────
  const pushCameraHistory = useCallback(() => {
    const cam = cameraRef.current; const ctrl = controlsRef.current; if (!cam || !ctrl) return;
    const entry: CameraHome = { position: { x: cam.position.x, y: cam.position.y, z: cam.position.z }, target: { x: ctrl.target.x, y: ctrl.target.y, z: ctrl.target.z }, near: cam.near, far: cam.far };
    const hist = camHistoryRef.current.slice(0, camHistoryIdxRef.current + 1);
    hist.push(entry);
    if (hist.length > 50) hist.shift();
    camHistoryRef.current = hist;
    const newIdx = hist.length - 1;
    camHistoryIdxRef.current = newIdx;
    setCamHistIdx(newIdx); setCamHistLen(hist.length);
  }, []);
  useEffect(() => { pushCameraHistoryFnRef.current = pushCameraHistory; }, [pushCameraHistory]);

  const goBack = useCallback(() => {
    const idx = camHistoryIdxRef.current - 1; if (idx < 0) return;
    const entry = camHistoryRef.current[idx];
    const cam = cameraRef.current; const ctrl = controlsRef.current; if (!cam || !ctrl || !entry) return;
    cam.position.set(entry.position.x, entry.position.y, entry.position.z);
    cam.near = entry.near; cam.far = entry.far; cam.updateProjectionMatrix();
    ctrl.target.set(entry.target.x, entry.target.y, entry.target.z); ctrl.update();
    velocityRef.current.set(0, 0, 0);
    camHistoryIdxRef.current = idx; setCamHistIdx(idx);
  }, []);

  const goForward = useCallback(() => {
    const idx = camHistoryIdxRef.current + 1; if (idx >= camHistoryRef.current.length) return;
    const entry = camHistoryRef.current[idx];
    const cam = cameraRef.current; const ctrl = controlsRef.current; if (!cam || !ctrl || !entry) return;
    cam.position.set(entry.position.x, entry.position.y, entry.position.z);
    cam.near = entry.near; cam.far = entry.far; cam.updateProjectionMatrix();
    ctrl.target.set(entry.target.x, entry.target.y, entry.target.z); ctrl.update();
    velocityRef.current.set(0, 0, 0);
    camHistoryIdxRef.current = idx; setCamHistIdx(idx);
  }, []);

  const speedUp = useCallback(() => { setSpeedIdx(p => { const n = Math.min(p + 1, SPEED_STEPS.length - 1); moveSpeedRef.current = SPEED_STEPS[n]; return n; }); }, []);
  const speedDown = useCallback(() => { setSpeedIdx(p => { const n = Math.max(p - 1, 0); moveSpeedRef.current = SPEED_STEPS[n]; return n; }); }, []);

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
      const loader = new GLTFLoader(); 
      loader.setDRACOLoader(sharedDracoLoader);
      loader.setKTX2Loader(sharedKtx2Loader);
      loader.setMeshoptDecoder(MeshoptDecoder);
      const gltf = await new Promise<GLTF>((resolve, reject) => { loader.parse(arrayBuffer, "", g => resolve(g), (e: ErrorEvent) => reject(e)); });
      await finalizeGLTF(gltf, file.name, file.size, startTime);
    } catch (err: any) { setError(err?.message || "Failed to load model"); setPhase("idle"); }
  }, [finalizeGLTF]);

  const loadGLBFromURL = useCallback(async (url: string, fileName: string) => {
    setError(null); setPhase("loading"); setProgress(0); setProgressLabel("Loading model…");
    origMatsRef.current.clear(); unlitMatsRef.current.clear();
    velocityRef.current.set(0, 0, 0);
    loadedFileNameRef.current = fileName;
    const startTime = Date.now();
    let fileSize = 0;
    try {
      const loader = new GLTFLoader(); 
      loader.setDRACOLoader(sharedDracoLoader);
      loader.setKTX2Loader(sharedKtx2Loader);
      loader.setMeshoptDecoder(MeshoptDecoder);
      const gltf = await new Promise<GLTF>((resolve, reject) => {
        loader.load(
          url,
          resolve,
          (event) => {
            if (event.lengthComputable) {
              fileSize = event.total;
              setProgress(Math.round(event.loaded / event.total * 85));
              setProgressLabel(`${formatBytes(event.loaded)} / ${formatBytes(event.total)}`);
            }
          },
          (err) => reject(err instanceof Error ? err : new Error(String(err)))
        );
      });
      await finalizeGLTF(gltf, fileName, fileSize, startTime);
    } catch (err: any) { setError(err?.message || "Failed to load model"); setPhase("idle"); }
  }, [finalizeGLTF]);

  // Auto-load from file-server when schoolId is in URL
  useEffect(() => {
    if (!schoolId) return;
    fetch(`${FILE_SERVER}/schools/${schoolId}/3d`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error("No 3D model found for this school")))
      .then(data => loadGLBFromURL(`${FILE_SERVER}${data.url}`, data.filename))
      .catch(err => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFile = useCallback((file: File) => { if (!file.name.toLowerCase().endsWith(".glb")) { setError("Only .glb files are supported."); return; } loadGLB(file); }, [loadGLB]);
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) handleFile(f); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); };

  // ── Annotation dialog ────────────────────────────────────────────────────────
  const submitAnnotation = () => {
    const text = annotInputRef.current;
    if (!text.trim()) { setAnnotPendingPt(null); return; }
    if (editAnnotId) {
      setAnnotations(prev => prev.map(a => a.id === editAnnotId ? { ...a, text, color: annotColor } : a));
      setEditAnnotId(null);
    } else if (annotPendingPt) {
      setAnnotations(prev => [...prev, { id: uid(), point: annotPendingPt, text, color: annotColor }]);
    }
    setAnnotPendingPt(null); 
    setAnnotInput(""); annotInputRef.current = "";
  };

  // ── Viewer-wrapper hover (zero-allocation, direct DOM cursor — no React re-render) ──
  const handleViewerMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (measureModeRef.current || !viewerWrapperRef.current) return;
    const camera = cameraRef.current; const overlay = overlayRef.current;
    if (!camera || !overlay) return;

    // Hit-test existing media point markers
    const pts = mediaPointsRef.current;
    if (pts.length) {
      const rect = overlay.getBoundingClientRect();
      const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
      const found = hitMediaPoint(pts, camera, cx, cy, overlay.width, overlay.height);
      if (found !== mediaHoverRef.current) {
        mediaHoverRef.current = found;
        viewerWrapperRef.current.style.cursor = found ? "pointer" : (addMediaModeRef.current ? "crosshair" : "");
      }
    } else if (mediaHoverRef.current) {
      mediaHoverRef.current = null;
      viewerWrapperRef.current.style.cursor = addMediaModeRef.current ? "crosshair" : "";
    }

    // Throttled accurate mesh raycast — precomputes click destination so placement is instant
    if (addMediaModeRef.current) {
      const now = performance.now();
      if (now - lastRaycastTimeRef.current > 33) {
        lastRaycastTimeRef.current = now;
        const model = modelRef.current;
        if (model) {
          const rect = overlay.getBoundingClientRect();
          const mouse = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
          raycasterRef.current.setFromCamera(mouse, camera);
          const hits = raycasterRef.current.intersectObject(model, true);
          if (hits.length) {
            lastAccuratePtRef.current = { x: hits[0].point.x, y: hits[0].point.y, z: hits[0].point.z };
          } else {
            const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
            const p = camera.position.clone().add(dir.multiplyScalar(10));
            lastAccuratePtRef.current = { x: p.x, y: p.y, z: p.z };
          }
        }
      }
    }
  }, []);

  // ── Viewer-wrapper click: only fires when overlay canvas is non-interactive (pointer-events:none)
  //    i.e. when NOT in measureMode AND NOT in addMediaMode
  const handleViewerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (measureModeRef.current || addMediaModeRef.current) return;
    const camera = cameraRef.current; const overlay = overlayRef.current;
    if (!camera || !overlay) return;
    const rect = overlay.getBoundingClientRect();
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    const hitId = hitMediaPoint(mediaPointsRef.current, camera, cx, cy, overlay.width, overlay.height);
    if (!hitId) return;
    const mp = mediaPointsRef.current.find(m => m.id === hitId); if (!mp) return;
    setMediaModalPointId(mp.id); 
    setMediaEditTitle(mp.title); mediaEditTitleRef.current = mp.title;
    setMediaCommentInput(mp.comment || ""); mediaCommentInputRef.current = mp.comment || "";
    setMediaModalTab("images"); setShowMediaModal(true);
  }, []);

  // ── Media helpers ─────────────────────────────────────────────────────────────
  const downloadItem = useCallback((item: MediaItem) => {
    const a = document.createElement("a");
    a.href = item.url; a.download = item.filename; a.click();
  }, []);

  const openMediaPoint = useCallback((mp: MediaPoint) => {
    setMediaModalPointId(mp.id);
    setMediaEditTitle(mp.title); mediaEditTitleRef.current = mp.title;
    setMediaCommentInput(mp.comment || ""); mediaCommentInputRef.current = mp.comment || "";
    setMediaModalTab("images");
    setShowMediaModal(true);
  }, []);
  const uploadMediaFile = useCallback(async (file: File, itemTitle: string, pointId: string) => {
    const type: "image" | "video" = file.type.startsWith("video/") ? "video" : "image";
    setMediaUploadLoading(true); setUploadError(null);
    try {
      let url: string;
      if (schoolId) {
        const form = new FormData();
        form.append("file", file);
        const resp = await fetch(`${FILE_SERVER}/schools/${schoolId}/media`, { method: "POST", body: form });
        if (resp.ok) {
          const data = await resp.json();
          url = data.url.startsWith("http") ? data.url : `${FILE_SERVER}${data.url.startsWith('/') ? '' : '/'}${data.url}`;
        } else {
          const errText = await resp.text().catch(() => "");
          setUploadError(`Server error (${resp.status})${errText ? ": " + errText.slice(0, 80) : ""} — saved locally instead`);
          url = await readFileAsDataURL(file);
        }
      } else {
        url = await readFileAsDataURL(file);
      }
      const item: MediaItem = { id: uid(), filename: file.name, url, title: itemTitle.trim() || file.name, type };
      setMediaPoints(prev => prev.map(mp => mp.id === pointId ? { ...mp, items: [...mp.items, item] } : mp));
    } catch (err: any) {
      setUploadError(`Upload failed: ${err?.message ?? "Unknown error"} — saved locally instead`);
      try { const url = await readFileAsDataURL(file); const item: MediaItem = { id: uid(), filename: file.name, url, title: itemTitle.trim() || file.name, type }; setMediaPoints(prev => prev.map(mp => mp.id === pointId ? { ...mp, items: [...mp.items, item] } : mp)); } catch { }
    }
    setMediaUploadLoading(false); setMediaItemTitleInput("");
  }, [schoolId]);

  const submitComment = useCallback((pointId: string) => {
    if (!newCommentText.trim()) return;
    const newComment: Comment = {
      id: uid(),
      text: newCommentText.trim(),
      author: viewerUser,
      timestamp: Date.now(),
      replies: []
    };
    setMediaPoints(prev => prev.map(mp => mp.id === pointId ? { ...mp, comments: [...mp.comments, newComment] } : mp));
    setNewCommentText("");
  }, [newCommentText, viewerUser]);

  const submitReply = useCallback((pointId: string, commentId: string) => {
    const text = replyTexts[commentId];
    if (!text || !text.trim()) return;
    const newReply: Reply = {
      id: uid(),
      text: text.trim(),
      author: viewerUser,
      timestamp: Date.now()
    };
    setMediaPoints(prev => prev.map(mp => {
      if (mp.id !== pointId) return mp;
      return {
        ...mp,
        comments: mp.comments.map(c => c.id === commentId ? { ...c, replies: [...(c.replies || []), newReply] } : c)
      };
    }));
    setReplyTexts(prev => ({ ...prev, [commentId]: "" }));
    setReplyingTo(null);
  }, [replyTexts, viewerUser]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body,#root{width:100%;height:100%;overflow:hidden}
        body{background:#060b1a}
        .glb-root{width:100vw;height:100vh;background:#060b1a;display:flex;flex-direction:column;font-family:'Inter',sans-serif;color:#e8e8f0;overflow:hidden}
        .header{display:flex;align-items:center;justify-content:space-between;padding:14px 24px;border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(6,11,26,0.95);backdrop-filter:blur(12px);z-index:10;flex-shrink:0}
        .logo{display:flex;align-items:center;gap:10px;font-size:17px;font-weight:800;letter-spacing:-0.5px}
        .logo-icon{width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,#3b82f6,#2563eb);display:flex;align-items:center;justify-content:center;font-size:14px}
        .badge{font-family:'JetBrains Mono',monospace;font-size:10px;padding:3px 8px;background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.35);border-radius:20px;color:#60a5fa;letter-spacing:0.5px}
        .drop-zone{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;padding:40px;position:relative;overflow:hidden}
        .drop-zone::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 60% 40% at 50% 50%,rgba(59,130,246,0.08) 0%,transparent 70%),radial-gradient(ellipse 40% 30% at 20% 80%,rgba(37,99,235,0.05) 0%,transparent 60%);pointer-events:none}
        .drop-target{width:100%;max-width:520px;aspect-ratio:4/3;border:2px dashed rgba(59,130,246,0.35);border-radius:20px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;cursor:pointer;transition:all .25s ease;background:rgba(59,130,246,0.03);position:relative;overflow:hidden}
        .drop-target.dragging{border-color:rgba(59,130,246,0.8);background:rgba(59,130,246,0.08);transform:scale(1.01)}
        .drop-icon{width:72px;height:72px;border-radius:18px;background:linear-gradient(135deg,rgba(59,130,246,0.2),rgba(37,99,235,0.1));border:1px solid rgba(59,130,246,0.3);display:flex;align-items:center;justify-content:center;font-size:30px;transition:transform .25s ease}
        .drop-target:hover .drop-icon,.drop-target.dragging .drop-icon{transform:scale(1.1) translateY(-4px)}
        .drop-title{font-size:20px;font-weight:700;letter-spacing:-0.5px;text-align:center}
        .drop-sub{font-size:12px;color:rgba(232,232,240,0.45);text-align:center;font-family:'JetBrains Mono',monospace;line-height:1.7}
        .upload-btn{padding:11px 26px;border-radius:10px;border:none;background:linear-gradient(135deg,#3b82f6,#60a5fa);color:#fff;font-family:'Inter',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:all .2s ease}
        .upload-btn:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(59,130,246,0.4)}
        .info-row{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
        .info-card{padding:12px 18px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);text-align:center}
        .info-card-value{font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:500;color:#60a5fa}
        .info-card-label{font-size:10px;color:rgba(232,232,240,0.4);margin-top:3px;letter-spacing:0.5px;text-transform:uppercase}
        .error-bar{margin:0 24px;padding:10px 16px;border-radius:10px;background:rgba(255,71,71,0.08);border:1px solid rgba(255,71,71,0.25);color:#ff7070;font-size:12px;font-family:'JetBrains Mono',monospace;display:flex;align-items:center;gap:8px}
        .loading-overlay{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;padding:40px;position:relative}
        .loading-overlay::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 50% 40% at 50% 50%,rgba(59,130,246,0.1) 0%,transparent 70%);pointer-events:none}
        .spinner-ring{width:72px;height:72px;border-radius:50%;border:3px solid rgba(59,130,246,0.15);border-top:3px solid #3b82f6;border-right:3px solid #2563eb;animation:spin 1s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .loading-pct{font-size:44px;font-weight:800;letter-spacing:-2px;background:linear-gradient(135deg,#3b82f6,#2563eb);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .progress-track{width:300px;height:3px;background:rgba(255,255,255,0.07);border-radius:4px;overflow:hidden}
        .progress-fill{height:100%;background:linear-gradient(90deg,#3b82f6,#2563eb);border-radius:4px;transition:width .3s ease}
        .progress-label{font-family:'JetBrains Mono',monospace;font-size:11px;color:rgba(232,232,240,0.45);letter-spacing:0.3px}
        .viewer-wrapper{flex:1;position:relative;overflow:hidden}
        .viewer-canvas{width:100%;height:100%;position:absolute;inset:0}
        .viewer-canvas canvas{display:block}
        .overlay-canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:5}
        .overlay-canvas.interactive{pointer-events:all;cursor:crosshair}
        .toolbar{position:absolute;top:16px;left:16px;display:flex;flex-direction:column;gap:8px;z-index:20}
        .tb-group{display:flex;flex-direction:column;gap:3px;background:rgba(6,11,26,0.88);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.09);border-radius:12px;padding:5px}
        .tb-btn{width:36px;height:36px;border-radius:8px;border:none;background:transparent;color:rgba(232,232,240,0.6);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .18s ease;font-size:15px;position:relative;flex-shrink:0;user-select:none}
        .tb-btn:hover{background:rgba(59,130,246,0.18);color:#93c5fd}
        .tb-btn.active{background:rgba(59,130,246,0.3);color:#93c5fd}
        .tb-btn.flash{background:rgba(50,220,120,0.25);color:#60e8a0}
        .tb-btn.danger:hover{background:rgba(255,71,71,0.18);color:#ff9090}
        .tb-btn:active{transform:scale(0.9)}
        .tb-btn:disabled{opacity:0.25;cursor:default;transform:none}
        .tb-divider{height:1px;background:rgba(255,255,255,0.07);margin:2px 4px}
        .tb-btn[data-tip]:hover::after{content:attr(data-tip);position:absolute;left:calc(100% + 10px);top:50%;transform:translateY(-50%);white-space:nowrap;background:rgba(6,11,26,0.97);border:1px solid rgba(255,255,255,0.1);border-radius:7px;padding:5px 10px;font-family:'JetBrains Mono',monospace;font-size:10px;color:#e8e8f0;letter-spacing:0.3px;pointer-events:none;z-index:100}
        .speed-group{display:flex;flex-direction:column;gap:0;background:rgba(6,11,26,0.88);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.09);border-radius:12px;padding:5px;align-items:center}
        .speed-label{font-family:'JetBrains Mono',monospace;font-size:9px;color:rgba(232,232,240,0.35);text-transform:uppercase;letter-spacing:0.8px;padding:2px 0 3px;text-align:center;width:100%}
        .speed-val{font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:600;color:#60a5fa;padding:3px 0;text-align:center;min-width:36px;letter-spacing:-0.3px}
        .speed-track{width:26px;height:3px;background:rgba(255,255,255,0.07);border-radius:3px;overflow:hidden;margin:1px 0 3px}
        .speed-fill{height:100%;background:linear-gradient(90deg,#3b82f6,#2563eb);border-radius:3px;transition:width .15s ease}
        .mode-panel{position:absolute;top:16px;right:16px;display:flex;flex-direction:column;gap:4px;z-index:20}
        .mode-label-hdr{font-family:'JetBrains Mono',monospace;font-size:9px;color:rgba(232,232,240,0.3);text-transform:uppercase;letter-spacing:1px;padding:0 4px 2px;text-align:right}
        .mode-btn{padding:7px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);background:rgba(6,11,26,0.88);backdrop-filter:blur(16px);color:rgba(232,232,240,0.45);font-family:'JetBrains Mono',monospace;font-size:10px;cursor:pointer;transition:all .18s ease;text-align:left;display:flex;align-items:center;gap:7px;white-space:nowrap}
        .mode-btn:hover{background:rgba(59,130,246,0.12);color:#93c5fd;border-color:rgba(59,130,246,0.3)}
        .mode-btn.active{background:rgba(59,130,246,0.2);color:#93c5fd;border-color:rgba(59,130,246,0.5)}
        .mode-dot{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,0.15);flex-shrink:0}
        .mode-btn.active .mode-dot{background:#60a5fa}
        .mode-tag{font-size:8px;padding:1px 5px;border-radius:4px;background:rgba(50,220,120,0.15);border:1px solid rgba(50,220,120,0.3);color:#60e8a0;margin-left:auto}
        .stats-panel{position:absolute;bottom:16px;left:16px;background:rgba(6,11,26,0.88);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.09);border-radius:14px;padding:12px 16px;display:flex;gap:16px;align-items:center;z-index:20}
        .stat-item{display:flex;flex-direction:column;gap:2px}
        .stat-val{font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:500;color:#60a5fa}
        .stat-lbl{font-size:9px;color:rgba(232,232,240,0.35);text-transform:uppercase;letter-spacing:0.6px}
        .stat-div{width:1px;height:26px;background:rgba(255,255,255,0.07);flex-shrink:0}
        .home-toast{position:absolute;bottom:80px;left:16px;background:rgba(50,200,100,0.12);border:1px solid rgba(50,200,100,0.3);border-radius:8px;padding:7px 12px;font-family:'JetBrains Mono',monospace;font-size:10px;color:#60e8a0;z-index:30;pointer-events:none;animation:toastIn .2s ease,toastOut .3s ease .9s forwards}
        .screenshot-toast{position:absolute;bottom:80px;right:16px;background:rgba(50,150,255,0.12);border:1px solid rgba(50,150,255,0.3);border-radius:8px;padding:7px 12px;font-family:'JetBrains Mono',monospace;font-size:10px;color:#70b8ff;z-index:30;pointer-events:none;animation:toastIn .2s ease,toastOut .3s ease 1.1s forwards}
        @keyframes toastIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @keyframes toastOut{to{opacity:0;transform:translateY(-4px)}}

        /* Measure toolbar */
        .meas-toolbar{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:6px;background:rgba(6,11,26,0.92);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:8px 12px;z-index:25;transition:all .25s ease}
        .meas-toolbar.active-mode{border-color:rgba(59,130,246,0.5);box-shadow:0 0 0 1px rgba(59,130,246,0.2),0 8px 32px rgba(0,0,0,0.5)}
        .meas-btn{height:34px;padding:0 14px;border-radius:9px;border:1px solid transparent;background:transparent;color:rgba(232,232,240,0.5);font-family:'JetBrains Mono',monospace;font-size:10px;cursor:pointer;transition:all .18s ease;display:flex;align-items:center;gap:6px;white-space:nowrap;font-weight:500}
        .meas-btn:hover{background:rgba(59,130,246,0.12);color:#93c5fd;border-color:rgba(59,130,246,0.25)}
        .meas-btn.active{background:rgba(59,130,246,0.22);color:#93c5fd;border-color:rgba(59,130,246,0.5)}
        .meas-btn.annotate-btn.active{background:rgba(0,212,170,0.15);color:#00d4aa;border-color:rgba(0,212,170,0.4)}
        .meas-divider{width:1px;height:22px;background:rgba(255,255,255,0.08);margin:0 2px}
        .meas-hint{font-family:'JetBrains Mono',monospace;font-size:9px;color:rgba(59,130,246,0.7);padding:0 4px;white-space:nowrap}

        /* Unit dropdown */
        .unit-wrap{position:relative}
        .unit-btn{height:34px;padding:0 10px;border-radius:9px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:rgba(232,232,240,0.65);font-family:'JetBrains Mono',monospace;font-size:10px;cursor:pointer;display:flex;align-items:center;gap:5px;white-space:nowrap;transition:all .18s ease}
        .unit-btn:hover{background:rgba(59,130,246,0.1);border-color:rgba(59,130,246,0.3);color:#93c5fd}
        .unit-dropdown{position:absolute;bottom:calc(100% + 6px);left:0;min-width:170px;background:#0d1429;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:5px;box-shadow:0 16px 48px rgba(0,0,0,0.7);z-index:100;animation:dropUp .15s ease}
        @keyframes dropUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        .unit-opt{width:100%;padding:8px 12px;border-radius:7px;border:none;background:transparent;color:rgba(232,232,240,0.55);font-family:'JetBrains Mono',monospace;font-size:10px;cursor:pointer;text-align:left;transition:all .15s ease;display:flex;justify-content:space-between;align-items:center}
        .unit-opt:hover{background:rgba(59,130,246,0.12);color:#93c5fd}
        .unit-opt.selected{color:#60a5fa;background:rgba(59,130,246,0.1)}
        .unit-opt .check{color:#60a5fa;font-size:12px}

        /* Measure panel (right drawer) */
        .meas-panel{position:absolute;right:16px;top:80px;bottom:80px;width:280px;background:rgba(6,11,26,0.94);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.09);border-radius:16px;z-index:20;display:flex;flex-direction:column;overflow:hidden;animation:panelIn .2s ease}
        @keyframes panelIn{from{opacity:0;transform:translateX(10px)}to{opacity:1;transform:none}}
        .mp-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 12px;border-bottom:1px solid rgba(255,255,255,0.07);flex-shrink:0}
        .mp-title{font-size:12px;font-weight:700;letter-spacing:-0.2px;display:flex;align-items:center;gap:8px}
        .mp-count{font-family:'JetBrains Mono',monospace;font-size:9px;padding:2px 7px;background:rgba(59,130,246,0.15);border-radius:20px;color:#60a5fa}
        .mp-clear{padding:4px 9px;border-radius:7px;border:none;background:rgba(255,71,71,0.08);color:rgba(255,112,112,0.7);font-family:'JetBrains Mono',monospace;font-size:9px;cursor:pointer;transition:all .15s}
        .mp-clear:hover{background:rgba(255,71,71,0.18);color:#ff7070}
        .mp-list{flex:1;overflow-y:auto;padding:8px}
        .mp-list::-webkit-scrollbar{width:4px}
        .mp-list::-webkit-scrollbar-track{background:transparent}
        .mp-list::-webkit-scrollbar-thumb{background:rgba(59,130,246,0.3);border-radius:2px}
        .mp-item{padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.06);margin-bottom:6px;background:rgba(255,255,255,0.02);transition:background .15s}
        .mp-item:hover{background:rgba(255,255,255,0.04)}
        .mp-item-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px}
        .mp-item-type{font-family:'JetBrains Mono',monospace;font-size:8px;text-transform:uppercase;letter-spacing:1px;padding:2px 7px;border-radius:20px}
        .mp-item-del{width:20px;height:20px;border-radius:5px;border:none;background:transparent;color:rgba(255,112,112,0.4);font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s}
        .mp-item-del:hover{background:rgba(255,71,71,0.15);color:#ff7070}
        .mp-item-val{font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:600;color:#e8e8f0;letter-spacing:-0.5px}
        .mp-item-pts{font-family:'JetBrains Mono',monospace;font-size:9px;color:rgba(232,232,240,0.3);margin-top:2px}
        .mp-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px;color:rgba(232,232,240,0.2);font-family:'JetBrains Mono',monospace;font-size:11px;text-align:center;padding:20px}
        .mp-empty-icon{font-size:28px;opacity:0.3}

        /* 🚀 Fast Annot dialog + Color Picker */
        .annot-dialog{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:#0d1429;border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:20px;width:300px;z-index:60;box-shadow:0 32px 80px rgba(0,0,0,0.8);animation:popIn .05s ease-out forwards}
        @keyframes popIn{from{transform:translate(-50%,-45%) scale(0.95);opacity:0}to{transform:translate(-50%,-50%) scale(1);opacity:1}}
        .ad-title{font-size:13px;font-weight:700;margin-bottom:14px;display:flex;align-items:center;gap:8px}
        .ad-colors{display:flex;gap:8px;margin-bottom:12px;}
        .ad-color-btn{width:22px;height:22px;border-radius:50%;border:2px solid transparent;cursor:pointer;transition:transform 0.15s;}
        .ad-color-btn:hover{transform:scale(1.15);}
        .ad-color-btn.active{border-color:#ffffff;box-shadow:0 0 0 2px rgba(255,255,255,0.2);}
        .ad-textarea{width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:9px;padding:10px;font-family:'JetBrains Mono',monospace;font-size:11px;resize:vertical;min-height:70px;outline:none;transition:border .15s;line-height:1.6}
        .ad-textarea:focus{border-color:rgba(59,130,246,0.5)}
        .ad-row{display:flex;gap:8px;margin-top:12px;justify-content:flex-end}
        .ad-cancel{padding:7px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:transparent;color:rgba(232,232,240,0.5);font-family:'JetBrains Mono',monospace;font-size:10px;cursor:pointer;transition:all .15s}
        .ad-cancel:hover{background:rgba(255,255,255,0.06)}
        .ad-save{padding:7px 18px;border-radius:8px;border:none;background:linear-gradient(135deg,#3b82f6,#60a5fa);color:#fff;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:600;cursor:pointer;transition:all .15s}
        .ad-save:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(59,130,246,0.4)}

        /* Help */
        .help-backdrop{position:absolute;inset:0;z-index:50;background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;animation:bfadeIn .18s ease}
        @keyframes bfadeIn{from{opacity:0}to{opacity:1}}
        .help-panel{width:580px;max-width:94vw;max-height:90vh;overflow-y:auto;background:#0d1429;border:1px solid rgba(255,255,255,0.1);border-radius:20px;box-shadow:0 40px 100px rgba(0,0,0,0.8);animation:bslideUp .22s ease}
        .help-header{display:flex;align-items:center;justify-content:space-between;padding:18px 22px 16px;border-bottom:1px solid rgba(255,255,255,0.07);position:sticky;top:0;background:#0d1429;z-index:1;border-radius:20px 20px 0 0}
        .help-title{font-size:15px;font-weight:800;letter-spacing:-0.3px;display:flex;align-items:center;gap:10px}
        .help-title-icon{width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#3b82f6,#2563eb);display:flex;align-items:center;justify-content:center;font-size:13px}
        .help-close{width:28px;height:28px;border-radius:7px;border:none;background:rgba(255,255,255,0.06);color:rgba(232,232,240,0.6);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;transition:all .15s}
        .help-close:hover{background:rgba(255,71,120,0.2);color:#ff7090}
        .help-body{padding:18px 22px 24px;display:flex;flex-direction:column;gap:20px}
        .help-section{display:flex;flex-direction:column;gap:8px}
        .help-section-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:rgba(232,232,240,0.3);padding:0 2px}
        .help-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px}
        .help-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.025);transition:background .15s}
        .help-row:hover{background:rgba(59,130,246,0.07)}
        .help-keys{display:flex;gap:3px;flex-shrink:0;flex-wrap:wrap;max-width:130px}
        .kbd{display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:20px;padding:0 5px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.14);border-bottom:2px solid rgba(255,255,255,0.2);border-radius:5px;font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:600;color:#93c5fd;white-space:nowrap;line-height:1}
        .help-desc{font-size:11px;color:rgba(232,232,240,0.5);line-height:1.4;flex:1}
        .help-divider{height:1px;background:rgba(255,255,255,0.05)}
        .help-tip{padding:12px 14px;border-radius:10px;background:rgba(59,130,246,0.07);border:1px solid rgba(59,130,246,0.2);font-family:'JetBrains Mono',monospace;font-size:10px;color:rgba(157,122,255,0.8);line-height:1.8}
        .callout{padding:12px 14px;border-radius:10px;background:rgba(50,200,100,0.06);border:1px solid rgba(50,200,100,0.2);font-family:'JetBrains Mono',monospace;font-size:10px;color:rgba(96,232,160,0.9);line-height:1.9}

        /* ── Media modal ─────────────────────────────────────────────────── */
        .media-link-btn{display:flex;align-items:center;gap:6px;padding:5px 12px;border-radius:20px;border:1px solid rgba(251,191,36,0.4);background:rgba(251,191,36,0.08);color:#fbbf24;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:600;cursor:pointer;transition:background .12s,border-color .12s,transform .12s;white-space:nowrap}
        .media-link-btn:hover{background:rgba(251,191,36,0.18);border-color:rgba(251,191,36,0.65);transform:translateY(-1px)}
        .media-link-count{font-size:9px;padding:1px 6px;background:rgba(251,191,36,0.22);border-radius:10px}
        /* Backdrop: always in DOM, GPU-composited opacity toggle, zero backdrop-filter */
        .media-backdrop{position:absolute;inset:0;z-index:70;background:rgba(0,0,0,0.78);display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity 0.06s linear;will-change:opacity}
        .media-backdrop.open{opacity:1;pointer-events:all}
        .media-modal{width:720px;max-width:96vw;max-height:88vh;background:#0d1429;border:1px solid rgba(255,255,255,0.11);border-radius:20px;box-shadow:0 24px 80px rgba(0,0,0,0.9);display:flex;flex-direction:column;overflow:hidden;transform:scale(0.97) translateY(5px);opacity:0;transition:transform 0.08s ease-out,opacity 0.06s linear;will-change:transform,opacity}
        .media-backdrop.open .media-modal{transform:none;opacity:1}
        .mm-header{display:flex;align-items:center;justify-content:space-between;padding:18px 22px 14px;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0;gap:16px}
        .mm-title-wrap{display:flex;flex-direction:column;gap:4px;flex:1;min-width:0}
        .mm-title-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:rgba(251,191,36,0.6)}
        .mm-title-input{font-size:15px;font-weight:700;letter-spacing:-0.4px;background:transparent;border:none;outline:none;color:#e8e8f0;width:100%;padding:2px 0;border-bottom:1px solid rgba(255,255,255,0.07);transition:border-color .12s}
        .mm-title-input:focus{border-bottom-color:rgba(251,191,36,0.6)}
        .mm-title-input::placeholder{color:rgba(232,232,240,0.28)}
        .mm-comment-field{width:100%;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:7px;padding:7px 10px;font-family:'JetBrains Mono',monospace;font-size:10px;color:rgba(232,232,240,0.7);resize:none;outline:none;transition:border .1s;line-height:1.5;margin-top:6px}
        .mm-comment-field:focus{border-color:rgba(251,191,36,0.4)}
        .mm-comment-field::placeholder{color:rgba(232,232,240,0.22)}
        .mm-close{width:30px;height:30px;border-radius:8px;border:none;background:rgba(255,255,255,0.06);color:rgba(232,232,240,0.6);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;transition:background .1s,color .1s;flex-shrink:0}
        .mm-close:hover{background:rgba(255,71,120,0.2);color:#ff7090}
        .mm-tabs{display:flex;padding:0 22px;border-bottom:1px solid rgba(255,255,255,0.07);flex-shrink:0;background:rgba(0,0,0,0.1)}
        .mm-tab{padding:11px 16px;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:600;color:rgba(232,232,240,0.38);cursor:pointer;border:none;background:transparent;border-bottom:2px solid transparent;transition:color .1s,border-color .1s;white-space:nowrap;display:flex;align-items:center;gap:6px;margin-bottom:-1px}
        .mm-tab:hover{color:rgba(232,232,240,0.72)}
        .mm-tab.active{color:#93c5fd;border-bottom-color:#3b82f6}
        .mm-tab.tab-all.active{color:#fbbf24;border-bottom-color:#fbbf24}
        .mm-body{flex:1;overflow-y:auto;padding:20px 22px;display:flex;flex-direction:column;gap:16px;min-height:0}
        .mm-body::-webkit-scrollbar{width:4px}
        .mm-body::-webkit-scrollbar-track{background:transparent}
        .mm-body::-webkit-scrollbar-thumb{background:rgba(59,130,246,0.3);border-radius:2px}
        .mm-upload{border:2px dashed rgba(59,130,246,0.2);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:10px;background:rgba(59,130,246,0.02);transition:border-color .12s,background .12s}
        .mm-upload:hover{border-color:rgba(59,130,246,0.45);background:rgba(59,130,246,0.05)}
        .mm-upload-row{display:flex;gap:10px;align-items:center}
        .mm-title-field{flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);border-radius:8px;padding:8px 12px;font-family:'JetBrains Mono',monospace;font-size:10px;color:#e8e8f0;outline:none;transition:border .12s}
        .mm-title-field:focus{border-color:rgba(59,130,246,0.5)}
        .mm-title-field::placeholder{color:rgba(232,232,240,0.28)}
        .mm-upload-btn{height:34px;padding:0 16px;border-radius:9px;border:none;background:linear-gradient(135deg,#3b82f6,#60a5fa);color:#fff;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;cursor:pointer;transition:transform .1s,box-shadow .1s;white-space:nowrap}
        .mm-upload-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 4px 16px rgba(59,130,246,0.35)}
        .mm-upload-btn:disabled{opacity:0.5;cursor:default}
        .mm-hint{font-family:'JetBrains Mono',monospace;font-size:9px;color:rgba(232,232,240,0.28)}
        .mm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:12px}
        .mm-card{border-radius:12px;border:1px solid rgba(255,255,255,0.07);overflow:hidden;background:rgba(255,255,255,0.02);position:relative;transition:border-color .1s,background .1s}
        .mm-card:hover{border-color:rgba(59,130,246,0.3);background:rgba(255,255,255,0.04)}
        .mm-card img{width:100%;aspect-ratio:4/3;object-fit:cover;background:rgba(255,255,255,0.03);display:block;cursor:zoom-in;transition:opacity .08s}
        .mm-card img:hover{opacity:0.85}
        .mm-card video{width:100%;aspect-ratio:4/3;display:block;background:#060b1a}
        .mm-card-info{padding:8px 10px}
        .mm-card-title{font-family:'JetBrains Mono',monospace;font-size:9px;color:rgba(232,232,240,0.65);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .mm-card-del{position:absolute;top:6px;right:6px;width:22px;height:22px;border-radius:6px;border:none;background:rgba(6,11,26,0.8);color:rgba(255,112,112,0.65);font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .08s,color .08s,opacity .08s;opacity:0}
        .mm-card:hover .mm-card-del{opacity:1}
        .mm-card-del:hover{background:rgba(255,71,71,0.28);color:#ff7070}
        .mm-card-expand{position:absolute;top:6px;left:6px;width:22px;height:22px;border-radius:6px;border:none;background:rgba(6,11,26,0.8);color:rgba(255,255,255,0.55);font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .08s,color .08s,opacity .08s;opacity:0}
        .mm-card:hover .mm-card-expand{opacity:1}
        .mm-card-expand:hover{background:rgba(59,130,246,0.55);color:#fff}
        .mm-card-dl{position:absolute;bottom:36px;right:6px;width:22px;height:22px;border-radius:6px;border:none;background:rgba(6,11,26,0.8);color:rgba(255,255,255,0.55);font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .08s,color .08s,opacity .08s;opacity:0}
        .mm-card:hover .mm-card-dl{opacity:1}
        .mm-card-dl:hover{background:rgba(50,200,100,0.5);color:#fff}
        .mm-point-comment{font-family:'JetBrains Mono',monospace;font-size:9px;color:rgba(232,232,240,0.45);font-style:italic;padding:0 2px 6px;line-height:1.5}
        .mm-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:48px 20px;color:rgba(232,232,240,0.2);font-family:'JetBrains Mono',monospace;font-size:11px;text-align:center}
        .mm-empty-icon{font-size:34px;opacity:0.3}
        .mm-point-section{display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:14px;border:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.015)}
        .mm-point-header{display:flex;align-items:center;gap:10px}
        .mm-point-dot{width:10px;height:10px;border-radius:50%;background:#fbbf24;flex-shrink:0}
        .mm-point-name{font-size:12px;font-weight:700;color:#fbbf24;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .mm-point-cnt{font-family:'JetBrains Mono',monospace;font-size:9px;padding:2px 7px;background:rgba(251,191,36,0.1);border-radius:20px;color:rgba(251,191,36,0.65)}
        .mm-open-btn{padding:3px 10px;border-radius:7px;border:1px solid rgba(251,191,36,0.25);background:transparent;color:rgba(251,191,36,0.65);font-family:'JetBrains Mono',monospace;font-size:9px;cursor:pointer;transition:background .1s,color .1s;white-space:nowrap}
        .mm-open-btn:hover{background:rgba(251,191,36,0.1);color:#fbbf24}
        .mm-del-pt{padding:3px 8px;border-radius:7px;border:1px solid rgba(255,71,71,0.2);background:transparent;color:rgba(255,112,112,0.5);font-family:'JetBrains Mono',monospace;font-size:9px;cursor:pointer;transition:background .1s,color .1s}
        .mm-del-pt:hover{background:rgba(255,71,71,0.12);color:#ff7070}
        /* ── Lightbox ──────────────────────────────────────────────────────── */
        .lightbox{position:absolute;inset:0;z-index:90;background:rgba(0,0,0,0.96);display:flex;align-items:center;justify-content:center;cursor:zoom-out;opacity:0;pointer-events:none;transition:opacity 0.07s linear;will-change:opacity}
        .lightbox.open{opacity:1;pointer-events:all}
        .lightbox-media-wrap{display:flex;align-items:center;justify-content:center;max-width:95vw;max-height:94vh;transform:scale(0.95);transition:transform 0.08s ease-out;will-change:transform}
        .lightbox.open .lightbox-media-wrap{transform:scale(1)}
        .lightbox img{max-width:95vw;max-height:92vh;object-fit:contain;border-radius:6px;box-shadow:0 0 100px rgba(0,0,0,0.7);display:block;cursor:default}
        .lightbox video{max-width:95vw;max-height:92vh;border-radius:6px;box-shadow:0 0 100px rgba(0,0,0,0.7);display:block}
        .lightbox-close{position:absolute;top:16px;right:16px;width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.85);font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .1s,transform .1s}
        .lightbox-close:hover{background:rgba(255,71,120,0.38);transform:scale(1.1)}
        .lightbox-caption{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);font-family:'JetBrains Mono',monospace;font-size:11px;color:rgba(255,255,255,0.5);background:rgba(0,0,0,0.55);padding:5px 14px;border-radius:20px;white-space:nowrap;max-width:80vw;overflow:hidden;text-overflow:ellipsis;pointer-events:none}
        .lightbox-dl{position:absolute;top:16px;right:64px;width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.85);font-size:17px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .1s,transform .1s}
        .lightbox-dl:hover{background:rgba(50,200,100,0.38);transform:scale(1.1)}
      `}</style>

      <title>{schoolName ? `${schoolName} · 3D Viewer — RTB GIS` : "RTB GIS · 3D Viewer"}</title>

      <div className="glb-root">
        <header className="header">
          <div className="logo">
            <div className="logo-icon">⬡</div>
            <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.4px" }}>
                {schoolName || "RTB GIS · 3D Viewer"}
              </span>
              {schoolName && (
                <span style={{ fontSize: 9, fontWeight: 500, opacity: 0.4, letterSpacing: "1.2px", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase" }}>
                  Rwanda TVEt Board · 3D Photogrammetry Viewer
                </span>
              )}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {stats && progress === 100 && (
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "rgba(232,232,240,0.3)", letterSpacing: "0.3px" }}>
                {stats.triangles.toLocaleString()}▲ · {stats.meshes}⬡ · {stats.textures}◈
              </span>
            )}
            {mediaPoints.length > 0 && (
              <button className="media-link-btn"
                onClick={() => { setMediaModalTab("all"); setMediaModalPointId(null); setShowMediaModal(true); }}>
                📸 Media <span className="media-link-count">{mediaPoints.reduce((n, mp) => n + mp.items.length, 0)}</span>
              </button>
            )}
            <span className="badge">Measure · Annotate · Screenshot</span>
          </div>
        </header>

        {error && <div className="error-bar"><span>⚠</span> {error}</div>}

        {phase === "idle" && (
          <div className="drop-zone">
            <label className={`drop-target${isDragging ? " dragging" : ""}`}
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)} onDrop={handleDrop} htmlFor="glb-input">
              <input id="glb-input" type="file" accept=".glb" style={{ display: "none" }} onChange={handleInputChange} />
              <div className="drop-icon">⬡</div>
              <div className="drop-title">{schoolName ? `No 3D model found for ${schoolName}` : "Drop your .glb model here"}</div>
              <div className="drop-sub">{schoolName ? "Upload a GLB file to view the 3D model for this school" : "Measure distances · Areas · Perimeters"}<br />{schoolName ? "" : "Annotations · Screenshot · Unlit photogrammetry"}</div>
              <button className="upload-btn" type="button" onClick={e => { e.preventDefault(); document.getElementById("glb-input")?.click() }}>Choose File</button>
            </label>
            <div className="info-row">
              {[{ value: "2 GB+", label: "Max File Size" }, { value: "GLB", label: "Format" }, { value: "WebGL 2", label: "Renderer" }, { value: "Measure", label: "Tools" }].map(c => (
                <div className="info-card" key={c.label}><div className="info-card-value">{c.value}</div><div className="info-card-label">{c.label}</div></div>
              ))}
            </div>
          </div>
        )}

        {phase === "loading" && (
          <div className="loading-overlay">
            <div className="spinner-ring" />
            <div className="loading-pct">{progress}%</div>
            <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
            <div className="progress-label">{progressLabel}</div>
          </div>
        )}

        {phase === "viewing" && (
          <div className="viewer-wrapper" ref={viewerWrapperRef}
            onMouseMove={handleViewerMouseMove}
            onClick={handleViewerClick}>
            {progress < 100 && (
              <div style={{ position: "absolute", inset: 0, zIndex: 5, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, background: "rgba(6,11,26,0.78)", backdropFilter: "blur(6px)" }}>
                <div className="spinner-ring" />
                <div className="loading-pct">{progress}%</div>
                <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
                <div className="progress-label">{progressLabel}</div>
              </div>
            )}

            <div ref={mountRef} className="viewer-canvas" />

            <canvas ref={overlayRef} className={`overlay-canvas${(measureMode || addMediaMode) ? "  interactive" : ""}`}
              style={{ cursor: addMediaMode ? "crosshair" : undefined }}
              onMouseMove={handleOverlayMouseMove}
              onClick={handleOverlayClick}
              onDoubleClick={handleOverlayDoubleClick}
              onContextMenu={handleOverlayContextMenu} />

            {/* Left toolbar */}
            <div className="toolbar">
              <div className="tb-group">
                <button className="tb-btn" data-tip="Reset to home" onClick={handleResetCamera}>⊙</button>
                <button className={`tb-btn${saveFlash ? " flash" : ""}`}
                  data-tip={homeSaved ? "Update auto-home position" : "Save view as auto-home"} onClick={handleSaveHome} style={{ fontSize: 13 }}>
                  {saveFlash ? "✓" : homeSaved ? "🏠" : "📍"}
                </button>
                <div className="tb-divider" />
                <button className="tb-btn" data-tip="Back (camera history)" onClick={goBack}
                  disabled={camHistIdx <= 0} style={{ fontSize: 16, fontWeight: 700 }}>‹</button>
                <button className="tb-btn" data-tip="Forward (camera history)" onClick={goForward}
                  disabled={camHistIdx >= camHistLen - 1} style={{ fontSize: 16, fontWeight: 700 }}>›</button>
              </div>

              <div className="speed-group">
                <div className="speed-label">speed</div>
                <button className="tb-btn" data-tip="Speed up" onClick={speedUp} disabled={speedIdx >= SPEED_STEPS.length - 1} style={{ fontSize: 18, fontWeight: 700 }}>＋</button>
                <div className="speed-val">{fmtSpeed(SPEED_STEPS[speedIdx])}</div>
                <div className="speed-track"><div className="speed-fill" style={{ width: `${(speedIdx / (SPEED_STEPS.length - 1)) * 100}%` }} /></div>
                <button className="tb-btn" data-tip="Speed down" onClick={speedDown} disabled={speedIdx <= 0} style={{ fontSize: 18, fontWeight: 700 }}>−</button>
              </div>

              <div className="tb-group">
                <button className={`tb-btn${showMeasurePanel ? " active" : ""}`} data-tip="Measurements panel"
                  onClick={() => setShowMeasurePanel(v => !v)} style={{ fontSize: 13 }}>📐</button>
                <button className={`tb-btn${screenshotFlash ? " flash" : ""}`} data-tip="Screenshot & download"
                  onClick={handleScreenshot} style={{ fontSize: 13 }}>{screenshotFlash ? "✓" : "📷"}</button>
                <div className="tb-divider" />
                <button className={`tb-btn${addMediaMode ? " active" : ""}`}
                  data-tip={addMediaMode ? "Exit media mode (Esc)" : "Add / view media points"}
                  style={{ fontSize: 13, color: addMediaMode ? "#fbbf24" : undefined }}
                  onClick={() => { setAddMediaMode(v => !v); if (!addMediaMode) { setMeasureMode(null); setPendingPts([]); } }}>
                  📸
                  {mediaPoints.length > 0 && (
                    <span style={{ position: "absolute", top: 2, right: 2, width: 14, height: 14, borderRadius: "50%", background: "#fbbf24", color: "#000", fontSize: 8, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono',monospace" }}>
                      {mediaPoints.length}
                    </span>
                  )}
                </button>
                <button className={`tb-btn${showHelp ? " active" : ""}`} data-tip="Keyboard shortcuts"
                  onClick={() => setShowHelp(v => !v)}>?</button>
              </div>
            </div>

            {/* Right — render mode */}
            {progress === 100 && (
              <div className="mode-panel">
                <div className="mode-label-hdr">Render mode</div>
                {(["unlit", "lit", "wireframe"] as RenderMode[]).map(m => (
                  <button key={m} className={`mode-btn${renderMode === m ? " active" : ""}`} onClick={() => setRenderMode(m)}>
                    <span className="mode-dot" />{MODE_LABELS[m]}{m === "unlit" && <span className="mode-tag">recommended</span>}
                  </button>
                ))}
              </div>
            )}

            {/* Media mode hint bar */}
            {addMediaMode && progress === 100 && (
              <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.4)", borderRadius: 12, padding: "8px 18px", display: "flex", alignItems: "center", gap: 10, zIndex: 25, backdropFilter: "blur(16px)" }}>
                <span style={{ fontSize: 13 }}>📸</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "#fbbf24", fontWeight: 600 }}>
                  Media Mode — Click to place a point · Click existing point to view/add media
                </span>
                <button style={{ padding: "3px 10px", borderRadius: 7, border: "1px solid rgba(251,191,36,0.35)", background: "transparent", color: "rgba(251,191,36,0.7)", fontFamily: "'JetBrains Mono',monospace", fontSize: 9, cursor: "pointer" }}
                  onClick={() => setAddMediaMode(false)}>✕ Exit</button>
              </div>
            )}

            {/* Bottom measure toolbar */}
            {progress === 100 && (
              <div className={`meas-toolbar${measureMode ? " active-mode" : ""}`}>
                {/* Unit selector */}
                <div className="unit-wrap">
                  <button className="unit-btn" onClick={() => setShowUnitDropdown(v => !v)}>
                    📏 {UNIT_SUFFIX[unit]} ▾
                  </button>
                  {showUnitDropdown && (
                    <div className="unit-dropdown">
                      {(Object.keys(UNIT_LABELS) as Unit[]).map(u => (
                        <button key={u} className={`unit-opt${unit === u ? " selected" : ""}`}
                          onClick={() => { setUnit(u); setShowUnitDropdown(false); }}>
                          <span>{UNIT_LABELS[u]}</span>
                          {unit === u && <span className="check">✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="meas-divider" />

                <button className={`meas-btn${measureMode === "distance" ? " active" : ""}`}
                  onClick={() => toggleMode("distance")}>
                  📏 Distance
                </button>
                <button className={`meas-btn${measureMode === "area" ? " active" : ""}`}
                  onClick={() => toggleMode("area")}>
                  ⬛ Area
                </button>
                <button className={`meas-btn${measureMode === "perimeter" ? " active" : ""}`}
                  onClick={() => toggleMode("perimeter")}>
                  🔲 Perimeter
                </button>
                <button className={`meas-btn annotate-btn${measureMode === "annotate" ? " active" : ""}`}
                  onClick={() => toggleMode("annotate")}>
                  🏷 Annotate
                </button>
                <button className={`meas-btn${addMediaMode ? " active" : ""}`}
                  style={{ color: addMediaMode ? "#fbbf24" : undefined, borderColor: addMediaMode ? "rgba(251,191,36,0.5)" : undefined, background: addMediaMode ? "rgba(251,191,36,0.15)" : undefined }}
                  onClick={() => { setAddMediaMode(v => !v); if (addMediaMode) return; setMeasureMode(null); setPendingPts([]); }}>
                  📸 Media{mediaPoints.length > 0 ? ` (${mediaPoints.length})` : ""}
                </button>

                {/* 👁️ Smart Visibility Toggles */}
                {(measures.length > 0 || annotations.length > 0) && (
                  <>
                    <div className="meas-divider" />
                    <button className="meas-btn" style={{ fontWeight: 600, color: visibility === "clear" ? "#ff7070" : "rgba(232,232,240,0.65)" }}
                      onClick={cycleVisibility}>
                      {visibility === "all" && "👁️ View All"}
                      {visibility === "annotations" && "🏷️ Annots Only"}
                      {visibility === "measures" && "📏 Meas Only"}
                      {visibility === "clear" && "🚫 Clear View"}
                    </button>
                  </>
                )}

                {measureMode && pendingPts.length >= 2 && measureMode !== "annotate" && (
                  <>
                    <div className="meas-divider" />
                    <button className="meas-btn active" style={{ background: "rgba(50,200,100,0.15)", borderColor: "rgba(50,200,100,0.4)", color: "#60e8a0" }}
                      onClick={finalizeMeasure}>✓ Done ({pendingPts.length} pts)</button>
                  </>
                )}
                {measureMode && (
                  <>
                    <div className="meas-divider" />
                    <span className="meas-hint">
                      {measureMode === "distance" && `Click points → Right-click to finish`}
                      {measureMode === "area" && `Click points → Right-click to finish`}
                      {measureMode === "perimeter" && `Click points → Right-click to finish`}
                      {measureMode === "annotate" && "Click on model to place note"}
                    </span>
                    <div className="meas-divider" />
                    <button className="meas-btn" style={{ color: "rgba(255,112,112,0.7)" }}
                      onClick={() => { setMeasureMode(null); setPendingPts([]); hoverPtRef.current = null; }}>✕ Cancel</button>
                  </>
                )}
              </div>
            )}

            {/* Measurements panel */}
            {showMeasurePanel && (
              <div className="meas-panel">
                <div className="mp-header">
                  <div className="mp-title">
                    📐 Measurements
                    <span className="mp-count">{measures.length + annotations.length}</span>
                  </div>
                  <button className="mp-clear" onClick={clearAllMeasurements}>Delete all</button>
                </div>
                <div className="mp-list">
                  {measures.length === 0 && annotations.length === 0 && (
                    <div className="mp-empty">
                      <div className="mp-empty-icon">📐</div>
                      <div>No measurements yet.<br />Use the toolbar below to start.</div>
                    </div>
                  )}
                  {measures.map(m => (
                    <div className="mp-item" key={m.id}>
                      <div className="mp-item-head">
                        <span className="mp-item-type" style={{ background: `${m.color}22`, color: m.color, border: `1px solid ${m.color}44` }}>
                          {m.mode}
                        </span>
                        <button className="mp-item-del" onClick={() => setMeasures(prev => prev.filter(x => x.id !== m.id))}>✕</button>
                      </div>
                      <div className="mp-item-val">{m.label}</div>
                      <div className="mp-item-pts">{m.points.length} point{m.points.length !== 1 ? "s" : ""}</div>
                    </div>
                  ))}
                  {annotations.map(a => (
                    <div className="mp-item" key={a.id}>
                      <div className="mp-item-head">
                        <span className="mp-item-type" style={{ background: "rgba(0,212,170,0.1)", color: "#00d4aa", border: "1px solid rgba(0,212,170,0.3)" }}>
                          note
                        </span>
                        <button className="mp-item-del" onClick={() => setAnnotations(prev => prev.filter(x => x.id !== a.id))}>✕</button>
                      </div>
                      <div className="mp-item-val" style={{ fontSize: 11, color: a.color, cursor: "pointer" }}
                        onClick={() => { setEditAnnotId(a.id); setAnnotInput(a.text); setAnnotPendingPt(a.point); setAnnotColor(a.color); }}>
                        {a.text.slice(0, 40)}{a.text.length > 40 ? "…" : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Annotation input dialog with Color Picker */}
            {(annotPendingPt || editAnnotId) && (
              <div className="annot-dialog">
                <div className="ad-title">🏷 {editAnnotId ? "Edit annotation" : "Add annotation"}</div>

                <div className="ad-colors">
                  {ANNOT_COLORS.map(c => (
                    <button key={c} className={`ad-color-btn ${annotColor === c ? 'active' : ''}`} style={{ background: c }} onClick={() => setAnnotColor(c)} />
                  ))}
                </div>

                <LocalTextArea className="ad-textarea" placeholder="Type your note…" value={annotInput} autoFocus
                  style={{ color: annotColor }}
                  onChangeValue={(v: string) => { setAnnotInput(v); annotInputRef.current = v; }}
                  onKeyDown={(e: any) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitAnnotation(); } if (e.key === "Escape") { setAnnotPendingPt(null); setEditAnnotId(null); } }} />
                <div className="ad-row">
                  <button className="ad-cancel" onClick={() => { setAnnotPendingPt(null); setEditAnnotId(null); }}>Cancel</button>
                  <button className="ad-save" onClick={submitAnnotation}>Save</button>
                </div>
              </div>
            )}

            {/* ── Media Modal — always mounted, CSS class toggle = instant open ── */}
            {(() => {
              const closeModal = () => {
                if (mediaModalPointId) {
                  const mp = mediaPoints.find(m => m.id === mediaModalPointId);
                  // Optimistically remove the point if canceled without adding any data
                  if (mp && !mp.title.trim() && mp.items.length === 0 && mp.comments.length === 0) {
                    setMediaPoints(prev => prev.filter(m => m.id !== mediaModalPointId));
                  }
                }
                setIsAddingPoint(false); // Reset flag when modal closes
                setShowMediaModal(false);
              };
              const savePointMeta = (id: string, title: string, comment: string) =>
                setMediaPoints(prev => prev.map(mp => mp.id === id ? { ...mp, title, comment } : mp));
              return (
                <div className={`media-backdrop${showMediaModal ? " open" : ""}`} onClick={closeModal}>
                  <div className="media-modal" onClick={e => e.stopPropagation()}>
                    <div className="mm-header">
                      {mediaModalPointId ? (
                        <div className="mm-title-wrap">
                          <div className="mm-title-label">
                            📍 Point {(() => { const mp = mediaPoints.find(m => m.id === mediaModalPointId); return mp ? <span style={{ textTransform: 'none', marginLeft: '6px', color: 'rgba(232,232,240,0.5)' }}>— Added by: {mp.addedBy}</span> : null; })()}
                          </div>
                          <LocalInput className="mm-title-input" placeholder="Point title…"
                            value={mediaEditTitle}
                            autoFocus
                            onChangeValue={(v: string) => { setMediaEditTitle(v); mediaEditTitleRef.current = v; }}
                            onBlur={() => savePointMeta(mediaModalPointId, mediaEditTitleRef.current, mediaCommentInputRef.current)}
                            onKeyDown={(e: any) => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") { e.stopPropagation(); closeModal(); } }} />
                          <LocalTextArea className="mm-comment-field" placeholder="Add a comment or description…" rows={2}
                            value={mediaCommentInput}
                            onChangeValue={(v: string) => { setMediaCommentInput(v); mediaCommentInputRef.current = v; }}
                            onBlur={() => savePointMeta(mediaModalPointId, mediaEditTitleRef.current, mediaCommentInputRef.current)}
                            onKeyDown={(e: any) => e.stopPropagation()} />
                        </div>
                      ) : (
                        <div className="mm-title-wrap">
                          <div className="mm-title-label">📸 Gallery</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: "#e8e8f0" }}>All Media Points</div>
                        </div>
                      )}
                      <button className="mm-close" onClick={closeModal}>✕</button>
                    </div>

                    <div className="mm-tabs">
                      {mediaModalPointId && <>
                        <button className={`mm-tab${mediaModalTab === "images" ? " active" : ""}`} onClick={() => setMediaModalTab("images")}>
                          📷 Images{(() => { const n = mediaPoints.find(m => m.id === mediaModalPointId)?.items.filter(i => i.type === "image").length ?? 0; return n ? ` (${n})` : ""; })()}
                        </button>
                        <button className={`mm-tab${mediaModalTab === "videos" ? " active" : ""}`} onClick={() => setMediaModalTab("videos")}>
                          🎬 Videos{(() => { const n = mediaPoints.find(m => m.id === mediaModalPointId)?.items.filter(i => i.type === "video").length ?? 0; return n ? ` (${n})` : ""; })()}
                        </button>
                        <button className={`mm-tab${mediaModalTab === "comments" ? " active" : ""}`} onClick={() => setMediaModalTab("comments")}>
                          💬 Comments{(() => { const n = mediaPoints.find(m => m.id === mediaModalPointId)?.comments.length ?? 0; return n ? ` (${n})` : ""; })()}
                        </button>
                        <button className={`mm-tab${mediaModalTab === "comments" ? " active" : ""}`} onClick={() => setMediaModalTab("comments")}>
                          💬 Comments{(() => { const n = mediaPoints.find(m => m.id === mediaModalPointId)?.comments.length ?? 0; return n ? ` (${n})` : ""; })()}
                        </button>
                      </>}
                      <button className={`mm-tab tab-all${mediaModalTab === "all" ? " active" : ""}`} onClick={() => setMediaModalTab("all")}>
                        🗂 All Points{mediaPoints.length ? ` (${mediaPoints.length})` : ""}
                      </button>
                    </div>

                    <div className="mm-body">
                      {mediaModalPointId && (mediaModalTab === "images" || mediaModalTab === "videos") && (() => {
                        const mp = mediaPoints.find(m => m.id === mediaModalPointId);
                        if (!mp) return null;
                        const isImg = mediaModalTab === "images";
                        const items = mp.items.filter(i => i.type === (isImg ? "image" : "video"));
                        return <>
                          <div className="mm-upload">
                            {uploadError && <div className="mm-upload-error">⚠️ {uploadError}</div>}
                            <div className="mm-upload-row">
                              <LocalInput className="mm-title-field" placeholder={`Title for this ${isImg ? "image" : "video"}…`}
                                value={mediaItemTitleInput} onChangeValue={(v: string) => { setMediaItemTitleInput(v); mediaItemTitleInputRef.current = v; }}
                                onKeyDown={(e: any) => e.stopPropagation()} />
                              <label className="mm-upload-btn" style={{ cursor: mediaUploadLoading ? "default" : "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                                {mediaUploadLoading ? "⏳ Uploading…" : `＋ ${isImg ? "Image" : "Video"}`}
                                <input type="file" accept={isImg ? "image/*" : "video/*"} style={{ display: "none" }}
                                  disabled={mediaUploadLoading}
                                  onChange={async e => { const file = e.target.files?.[0]; if (!file) return; await uploadMediaFile(file, mediaItemTitleInputRef.current, mp.id); setMediaItemTitleInput(""); mediaItemTitleInputRef.current = ""; e.target.value = ""; }} />
                              </label>
                            </div>
                            <div className="mm-hint">{isImg ? "JPEG · PNG · WebP · GIF" : "MP4 · WebM · MOV"} · Title optional</div>
                          </div>
                          {items.length === 0
                            ? <div className="mm-empty"><div className="mm-empty-icon">{isImg ? "🖼️" : "🎬"}</div><div>No {mediaModalTab} added yet.<br />Upload one above.</div></div>
                            : <div className="mm-grid">
                              {items.map(item => (
                                <div className="mm-card" key={item.id}>
                                  {item.type === "image" && (
                                    <a href={item.url} target="_blank" rel="noopener noreferrer" title="View full size" onClick={(e) => { e.preventDefault(); setLightboxItem(item); }}>
                                      <img src={item.url} alt={item.title} decoding="async" loading="lazy" style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                                    </a>
                                  )}
                                  {item.type !== "image" && (
                                    <video src={item.url} controls preload="metadata" onClick={(e) => e.stopPropagation()} />
                                  )}
                                  <div className="mm-card-info"><div className="mm-card-title" title={item.title}>{item.title}</div></div>
                                  <button className="mm-card-expand" title="Fullscreen" onClick={() => setLightboxItem(item)}>⤢</button>
                                  <button className="mm-card-dl" title="Download" onClick={() => downloadItem(item)}>↓</button>
                                  <button className="mm-card-del" onClick={() => setMediaPoints(prev => prev.map(m => m.id === mp.id ? { ...m, items: m.items.filter(i => i.id !== item.id) } : m))}>✕</button>
                                </div>
                              ))}
                            </div>
                          }
                        </>;
                      })()}

                      {mediaModalPointId && mediaModalTab === "comments" && (() => {
                        const mp = mediaPoints.find(m => m.id === mediaModalPointId);
                        if (!mp) return null;
                        return (
                          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            {mp.comments.map(c => (
                              <div key={c.id} style={{ padding: "12px", borderRadius: "12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                                  <span style={{ fontSize: "11px", fontWeight: "bold", color: "#60a5fa" }}>{c.author}</span>
                                  <span style={{ fontSize: "9px", color: "rgba(232,232,240,0.4)" }}>{timeAgo(c.timestamp)}</span>
                                </div>
                                <div style={{ fontSize: "11px", color: "#e8e8f0", marginBottom: "8px", lineHeight: "1.5" }}>{c.text}</div>

                                <div style={{ paddingLeft: "12px", borderLeft: "2px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column", gap: "8px" }}>
                                  {c.replies?.map(r => (
                                    <div key={r.id} style={{ padding: "8px", borderRadius: "8px", background: "rgba(255,255,255,0.02)" }}>
                                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                                        <span style={{ fontSize: "10px", fontWeight: "bold", color: "#60e8a0" }}>{r.author}</span>
                                        <span style={{ fontSize: "8px", color: "rgba(232,232,240,0.4)" }}>{timeAgo(r.timestamp)}</span>
                                      </div>
                                      <div style={{ fontSize: "10px", color: "rgba(232,232,240,0.8)" }}>{r.text}</div>
                                    </div>
                                  ))}

                                  {replyingTo === c.id ? (
                                    <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                                      <LocalInput className="mm-title-field" placeholder="Write a reply..." autoFocus
                                        value={replyTexts[c.id] || ""} onChangeValue={(v: string) => { setReplyTexts(prev => ({ ...prev, [c.id]: v })); replyTextsRef.current[c.id] = v; }}
                                        onKeyDown={(e: any) => { if (e.key === "Enter") submitReply(mp.id, c.id); }} />
                                      <button style={{ padding: "4px 10px", background: "rgba(59,130,246,0.2)", color: "#60a5fa", borderRadius: "6px", fontSize: "9px", fontWeight: "bold", border: "none", cursor: "pointer" }} onClick={() => submitReply(mp.id, c.id)}>Reply</button>
                                      <button style={{ padding: "4px 10px", background: "rgba(255,255,255,0.05)", color: "rgba(232,232,240,0.5)", borderRadius: "6px", fontSize: "9px", border: "none", cursor: "pointer" }} onClick={() => setReplyingTo(null)}>Cancel</button>
                                    </div>
                                  ) : (
                                    <button style={{ fontSize: "9px", color: "rgba(232,232,240,0.5)", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", alignSelf: "flex-start", padding: "4px 0" }} onClick={() => setReplyingTo(c.id)}>↳ Reply</button>
                                  )}
                                </div>
                              </div>
                            ))}
                            <div style={{ display: "flex", gap: "8px", marginTop: "8px", paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                              <LocalInput className="mm-title-field" placeholder="Add a new comment..."
                                        value={newCommentText} onChangeValue={(v: string) => { setNewCommentText(v); newCommentTextRef.current = v; }}
                                        onKeyDown={(e: any) => { if (e.key === "Enter") submitComment(mp.id); }} />
                              <button style={{ padding: "0 16px", background: "linear-gradient(135deg, #3b82f6, #60a5fa)", color: "#fff", borderRadius: "8px", fontSize: "10px", fontWeight: "bold", border: "none", cursor: "pointer" }} onClick={() => submitComment(mp.id)}>Post</button>
                            </div>
                          </div>
                        );
                      })()}

                      {mediaModalTab === "all" && (
                        mediaPoints.length === 0
                          ? <div className="mm-empty"><div className="mm-empty-icon">📍</div><div>No media points yet.<br />Click <strong>📸 Media</strong> in the toolbar below, then click the model to place a point.</div></div>
                          : mediaPoints.map(mp => (
                            <div className="mm-point-section" key={mp.id}>
                              <div className="mm-point-header">
                                <div className="mm-point-dot" />
                                <div className="mm-point-name">{mp.title || "(Untitled point)"}</div>
                                <div className="mm-point-cnt">{mp.items.length} item{mp.items.length !== 1 ? "s" : ""}</div>
                                <button className="mm-open-btn" onClick={() => openMediaPoint(mp)}>Open →</button>
                                <button className="mm-del-pt" onClick={() => { if (window.confirm("Are you sure you want to delete this media point?")) { setMediaPoints(prev => prev.filter(m => m.id !== mp.id)); if (mediaModalPointId === mp.id) closeModal(); } }}>Delete</button>
                              </div>
                              {mp.comment && <div className="mm-point-comment">{mp.comment}</div>}
                              {mp.items.length > 0 && (
                                <div className="mm-grid">
                                  {mp.items.map(item => (
                                    <div className="mm-card" key={item.id}>
                                      {item.type === "image" && (
                                        <img src={item.url} alt={item.title || ""} decoding="async" loading="lazy" onClick={() => setLightboxItem(item)} />
                                      )}
                                      {item.type !== "image" && (
                                        <video src={item.url} controls preload="metadata" onClick={e => e.stopPropagation()} />
                                      )}
                                      <div className="mm-card-info"><div className="mm-card-title" title={item.title}>{item.title}</div></div>
                                      <button className="mm-card-expand" title="Fullscreen" onClick={() => setLightboxItem(item)}>⤢</button>
                                      <button className="mm-card-dl" title="Download" onClick={() => downloadItem(item)}>↓</button>
                                    </div>))}
                                  {mp.items.length > 3 && <div className="mm-more-items" onClick={() => openMediaPoint(mp)}>+{mp.items.length - 3} more</div>}
                                </div>
                              )}
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── Confirmation Modal ────────────────────────────────────────── */}
            {confirmDeleteId && (
              <div className="confirm-backdrop" onClick={() => setConfirmDeleteId(null)}>
                <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
                  <h4>Confirm Deletion</h4>
                  <p>Are you sure you want to permanently delete this media point? This action cannot be undone.</p>
                  <div className="confirm-actions">
                    <button onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                    <button className="danger" onClick={() => {
                      const pointId = confirmDeleteId;
                      setMediaPoints(prev => prev.filter(m => m.id !== pointId));
                      if (mediaModalPointId === pointId) { setMediaModalPointId(null); setShowMediaModal(false); }
                      setConfirmDeleteId(null);
                    }}>Delete</button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Lightbox — GPU-composited, zero React re-render on toggle ── */}
            <div className={`lightbox${lightboxItem ? " open" : ""}`} onClick={() => setLightboxItem(null)}>
              {lightboxItem && (
                <div className="lightbox-media-wrap" onClick={(e) => e.stopPropagation()}>
                  {lightboxItem.type === "image" && (
                    <img src={lightboxItem.url} alt={lightboxItem.title || ""} decoding="async" />
                  )}
                  {lightboxItem.type !== "image" && (
                    <video src={lightboxItem.url} controls autoPlay onClick={(e) => e.stopPropagation()} />
                  )}
                </div>
              )}
              <button className="lightbox-close" onClick={() => setLightboxItem(null)}>✕</button>
              {lightboxItem && (
                <button className="lightbox-dl" onClick={() => downloadItem(lightboxItem)} title="Download">↓</button>
              )}
              {lightboxItem?.title && (
                <div className="lightbox-caption">{lightboxItem.title}</div>
              )}
            </div>

            {saveFlash && <div className="home-toast">📍 Auto-Home position saved for this map</div>}
            {screenshotFlash && <div className="screenshot-toast">📷 High-Res Screenshot saved!</div>}

            {stats && progress === 100 && !showMeasurePanel && (
              <div className="stats-panel">
                {[
                  { val: stats.fileName.length > 16 ? stats.fileName.slice(0, 14) + "…" : stats.fileName, lbl: "File" },
                  { val: formatBytes(stats.fileSize), lbl: "Size" },
                  { val: formatTime(stats.loadTime), lbl: "Load time" },
                  { val: stats.triangles.toLocaleString(), lbl: "Triangles" },
                  { val: stats.meshes.toString(), lbl: "Meshes" },
                  { val: stats.textures.toString(), lbl: "Textures" },
                ].map((s, i, arr) => (
                  <span key={s.lbl} style={{ display: "contents" }}>
                    <div className="stat-item"><div className="stat-val">{s.val}</div><div className="stat-lbl">{s.lbl}</div></div>
                    {i < arr.length - 1 && <div className="stat-div" />}
                  </span>
                ))}
              </div>
            )}

            {showHelp && (
              <div className="help-backdrop" onClick={() => setShowHelp(false)}>
                <div className="help-panel" onClick={e => e.stopPropagation()}>
                  <div className="help-header">
                    <div className="help-title"><div className="help-title-icon">?</div>Controls &amp; Shortcuts</div>
                    <button className="help-close" onClick={() => setShowHelp(false)}>✕</button>
                  </div>
                  <div className="help-body">
                    <div className="callout">
                      ✅  <strong>Unlit mode = Metashape-accurate colours</strong><br />
                      Photogrammetry textures have real-world lighting baked in. Unlit mode skips PBR shading → raw captured colour.
                    </div>
                    <div className="help-section">
                      <div className="help-section-label">🖱 Mouse</div>
                      <div className="help-grid">
                        {[{ keys: ["Left drag"], desc: "Orbit" }, { keys: ["Right drag"], desc: "Pan" }, { keys: ["Scroll"], desc: "Zoom" }, { keys: ["Middle drag"], desc: "Pan (alt)" }].map(r => (
                          <div className="help-row" key={r.desc}><div className="help-keys">{r.keys.map(k => <span className="kbd" key={k}>{k}</span>)}</div><div className="help-desc">{r.desc}</div></div>
                        ))}
                      </div>
                    </div>
                    <div className="help-divider" />
                    <div className="help-section">
                      <div className="help-section-label">⌨️ Fly navigation</div>
                      <div className="help-grid">
                        {[{ keys: ["W", "↑"], desc: "Walk forward" }, { keys: ["S", "↓"], desc: "Walk backward" }, { keys: ["A", "←"], desc: "Strafe left" }, { keys: ["D", "→"], desc: "Strafe right" }, { keys: ["E"], desc: "Fly up" }, { keys: ["Q", "F"], desc: "Fly down" }, { keys: ["Shift"], desc: "4× speed boost (hold)" }, { keys: ["Space"], desc: "Immediate stop" }, { keys: ["‹ btn"], desc: "Camera history back" }, { keys: ["› btn"], desc: "Camera history forward" }].map(r => (
                          <div className="help-row" key={r.desc}><div className="help-keys">{r.keys.map(k => <span className="kbd" key={k}>{k}</span>)}</div><div className="help-desc">{r.desc}</div></div>
                        ))}
                      </div>
                    </div>
                    <div className="help-divider" />
                    <div className="help-section">
                      <div className="help-section-label">📐 Measuring</div>
                      <div className="help-grid">
                        {[{ keys: ["Click"], desc: "Place measurement point" }, { keys: ["Right-click"], desc: "Finish/Complete measurement" }, { keys: ["Esc"], desc: "Cancel current measurement" }, { keys: ["👁️ btn"], desc: "Cycle UI view visibility" }, { keys: ["📷 btn"], desc: "Screenshot + download PNG" }, { keys: ["📐 btn"], desc: "Open measurements panel" }].map(r => (
                          <div className="help-row" key={r.desc}><div className="help-keys">{r.keys.map(k => <span className="kbd" key={k}>{k}</span>)}</div><div className="help-desc">{r.desc}</div></div>
                        ))}
                      </div>
                    </div>
                    <div className="help-tip">
                      🔍 All measurements persist in your browser across sessions.<br />
                      📍 <strong>Smart Auto-Home:</strong> When you save your home view, it's bound to that specific file name. Dropping the same map later instantly snaps to your saved angle.<br />
                      📷 Screenshot composites the 3D view + all overlays into one High-Res PNG.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}