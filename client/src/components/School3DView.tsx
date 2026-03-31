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
import ViewerHelpModal from "./3dviewercomponents/ViewerHelpModal";
import ViewerMainCanvas from "./3dviewercomponents/ViewerMainCanvas";
import ViewerBuildingPanel from "./3dviewercomponents/ViewerBuildingPanel";

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

const MODE_LABELS: Record<RenderMode, string> = { unlit: "Unlit (Metashape-style)", lit: "Lit (PBR)", wireframe: "Wireframe" };
const UNIT_LABELS: Record<Unit, string> = { m: "Meters (m)", cm: "Centimeters (cm)", mm: "Millimeters (mm)", km: "Kilometers (km)", ft: "Feet (ft)", in: "Inches (in)" };
const UNIT_FACTOR: Record<Unit, number> = { m: 1, cm: 100, mm: 1000, km: 0.001, ft: 3.28084, in: 39.3701 };
const UNIT_SUFFIX: Record<Unit, string> = { m: "m", cm: "cm", mm: "mm", km: "km", ft: "ft", in: "in" };
const AREA_SUFFIX: Record<Unit, string> = { m: "m²", cm: "cm²", mm: "mm²", km: "km²", ft: "ft²", in: "in²" };

const MEASURE_COLORS = ["#3b82f6", "#2563eb", "#00d4aa", "#ffb347", "#7ec8e3", "#ff7f50"];
const ANNOT_COLORS = ["#00d4aa", "#2563eb", "#ffb347", "#7ec8e3", "#93c5fd", "#ffffff"];
const NAV_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "W", "A", "S", "D", "q", "e", "Q", "E", "r", "f", "R", "F", " "]);
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

// ─── Overlay canvas helpers ───────────────────────────────────────────────────

function project3Dto2D(pt: MeasurePoint, camera: THREE.PerspectiveCamera, w: number, h: number): [number, number] | null {
  const v = new THREE.Vector3(pt.x, pt.y, pt.z);
  // Ensure the camera matrix is up to date before projection
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  v.project(camera);
  // WebGL standard check: if z > 1, the point is behind the camera
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

  // Loading state for annotations/markers
  const [isProcessingMarkers, setIsProcessingMarkers] = useState(false);

  // DB overlay visibility & building selection
  const [showDbAnnotations, setShowDbAnnotations] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null);

  // DB-backed site annotations (same data as 2D viewer)
  const [siteAnnotations, setSiteAnnotations] = useState<any[]>([]);
  const [annotPickerOpen, setAnnotPickerOpen] = useState(false);

  const [dbSchool, setDbSchool] = useState<any>(null);
  const [dbBuildings, setDbBuildings] = useState<any[]>([]);
  const [dbMarkers, setDbMarkers] = useState<any[]>([]);
  const [isModelReady, setIsModelReady] = useState(false);
  // Projected 3D paths for site annotation lines/polygons
  const [dbSiteShapes, setDbSiteShapes] = useState<Array<{ id: string; type: 'line' | 'polygon'; pts: MeasurePoint[]; label: string; color: string }>>([]);
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

  // Sync siteAnnotations from dbSchool (same source as 2D viewer)
  useEffect(() => {
    if (dbSchool?.siteAnnotations) setSiteAnnotations(dbSchool.siteAnnotations);
  }, [dbSchool]);

  // ── Pre-fetch School Data (Parallel to GLB loading) ─────────────────────────
  useEffect(() => {
    if (!schoolId) return;
    api.get(`/schools/${schoolId}`)
      .then(res => setDbSchool(res.data))
      .catch(e => console.error("Failed to pre-fetch school", e));
    api.get(`/schools/${schoolId}/buildings`)
      .then(res => setDbBuildings(res.data))
      .catch(e => console.error("Failed to pre-fetch buildings", e));
  }, [schoolId]);

  // ── Sync DB Markers and Ground Snapping (Non-Blocking Batch Processing) ──────
  useEffect(() => {
    const model = modelRef.current;
    if (!dbSchool || !model || !isModelReady || phase !== "viewing") {
      setDbMarkers([]); setDbSiteShapes([]); return;
    }
    const latCenter = Number(dbSchool.latitude), lonCenter = Number(dbSchool.longitude);
    if (!latCenter || !lonCenter) { setDbMarkers([]); setDbSiteShapes([]); return; }


    const latFactor = 111320, lonFactor = 111320 * Math.cos(latCenter * Math.PI / 180);
    const raycaster = new THREE.Raycaster();
    raycaster.firstHitOnly = true; // Optimization from three-mesh-bvh

    const markers: any[] = [];
    const shapes: typeof dbSiteShapes = [];
    const { x: rcX, z: rcZ } = modelRawCenterRef.current;

    const toXZ = (lon: number, lat: number) => ({
      x: (lon - lonCenter) * lonFactor - rcX,
      z: -(lat - latCenter) * latFactor - rcZ,
    });

    const groundY = (x: number, z: number, offset = 0.15): number => {
      raycaster.set(new THREE.Vector3(x, 2000, z), new THREE.Vector3(0, -1, 0));
      const hits = raycaster.intersectObject(model, true);
      return hits.length > 0 ? hits[0].point.y + offset : 0.5;
    };

    const addMarker = (lat: number, lon: number, label: string, type: "site" | "block" | "internal", id: string, color?: string) => {
      const { x, z } = toXZ(lon, lat);
      markers.push({ id, x, y: groundY(x, z), z, label, type, color });
    };

    setIsProcessingMarkers(true);
    let isCancelled = false;

    const processBatch = async () => {
      try {
        const siteAnns = siteAnnotations;
        const buildingData = dbBuildings || [];
        console.log(`[3DViewer] Syncing markers: ${siteAnns.length} site, ${buildingData.length} buildings`);

        // 1. Process site annotations
        for (const a of siteAnns) {
          if (isCancelled) return;
          if (!a.coordinates?.length) continue;
          const label = a.label || a.title || a.description || "Site";
          const color = a.style?.color || (a.type === 'polygon' ? '#fbbf24' : '#10b981');

          if (a.type === "point" || a.type === "text") {
            const coords = Array.isArray(a.coordinates[0]) ? a.coordinates[0] : a.coordinates;
            addMarker(coords[1], coords[0], label, "site", a.id, color);
          } else if (a.type === "line" || a.type === "polygon") {
            const pts: MeasurePoint[] = [];
            const raw = a.coordinates;
            const isNested = Array.isArray(raw[0]);

            for (let i = 0; i < (isNested ? raw.length : raw.length - 1); i += (isNested ? 1 : 2)) {
              const lon = isNested ? raw[i][0] : raw[i];
              const lat = isNested ? raw[i][1] : raw[i+1];
              const { x, z } = toXZ(lon, lat);
              pts.push({ x, y: groundY(x, z, a.type === 'line' ? 0.08 : 0.05), z });
              
              if (i % 50 === 0) { await new Promise(r => setTimeout(r, 0)); if (isCancelled) return; }
            }

            if (pts.length >= (a.type === 'line' ? 2 : 3)) {
              shapes.push({ id: a.id, type: a.type as 'line' | 'polygon', pts, label, color });
              const midIndex = Math.floor(pts.length / 2);
              const cx = a.type === 'polygon' ? pts.reduce((s, p) => s + p.x, 0) / pts.length : pts[midIndex].x;
              const cz = a.type === 'polygon' ? pts.reduce((s, p) => s + p.z, 0) / pts.length : pts[midIndex].z;
              const cy = a.type === 'polygon' ? groundY(cx, cz, 1.2) : pts[midIndex].y + 0.5;
              markers.push({ id: `${a.id}-lbl`, x: cx, y: cy, z: cz, label, type: "site", color });
            }
          }
        }

        // 2. Process buildings
        for (const b of buildingData) {
          if (isCancelled) return;
          const lat = Number(b.latitude || b.centroidLat), lon = Number(b.longitude || b.centroidLng);
          if (lat && lon) {
            addMarker(lat, lon, b.name || b.code || "Block", "block", b.id);
            for (const ba of (b.annotations || [])) {
              if (isCancelled) return;
              if (!ba.coordinates?.length) continue;
              const label = ba.label || ba.title || ba.content || "Space";
              const color = ba.style?.color || "#a855f7";

              if (ba.type === "point" || !ba.type || ba.type === "text") {
                const coords = Array.isArray(ba.coordinates[0]) ? ba.coordinates[0] : ba.coordinates;
                addMarker(coords[1], coords[0], label, "internal", ba.id, color);
              } else if (ba.type === "line" || ba.type === "polygon") {
                const pts: MeasurePoint[] = [];
                const raw = ba.coordinates;
                const isNested = Array.isArray(raw[0]);
                for (let i = 0; i < (isNested ? raw.length : raw.length - 1); i += (isNested ? 1 : 2)) {
                  const ln = isNested ? raw[i][0] : raw[i];
                  const lt = isNested ? raw[i][1] : raw[i+1];
                  const { x, z } = toXZ(ln, lt);
                  pts.push({ x, y: groundY(x, z, ba.type === 'line' ? 0.1 : 0.05), z });
                  if (i % 50 === 0) { await new Promise(r => setTimeout(r, 0)); if (isCancelled) return; }
                }
                if (pts.length >= (ba.type === 'line' ? 2 : 3)) {
                  shapes.push({ id: ba.id, type: ba.type as 'line' | 'polygon', pts, label, color });
                  const midIdx = Math.floor(pts.length / 2);
                  const bcx = ba.type === 'polygon' ? pts.reduce((s, p) => s + p.x, 0) / pts.length : pts[midIdx].x;
                  const bcz = ba.type === 'polygon' ? pts.reduce((s, p) => s + p.z, 0) / pts.length : pts[midIdx].z;
                  const bcy = ba.type === 'polygon' ? groundY(bcx, bcz, 1.2) : pts[midIdx].y + 0.5;
                  markers.push({ id: `${ba.id}-lbl`, x: bcx, y: bcy, z: bcz, label, type: "internal", color });
                }
              }
            }
          }
        }

        if (!isCancelled) {
          console.log(`[3DViewer] Mapping finished. Markers: ${markers.length}, Shapes: ${shapes.length}`);
          setDbMarkers(markers);
          setDbSiteShapes(shapes);
        }
      } catch (err) {
        console.error("[3DViewer] Error in annotation processing:", err);
      } finally {
        if (!isCancelled) setIsProcessingMarkers(false);
      }
    };

    processBatch();
    return () => { isCancelled = true; };
  }, [dbSchool, dbBuildings, phase, isModelReady, siteAnnotations]);

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

    // ─── DB Markers ───────────
    const dbPulse = Math.sin(Date.now() / 250) * 0.4 + 1.2;
    dbMarkers.forEach(m => {
      // Building "block" markers are always shown; site/internal only when showDbAnnotations
      if (m.type !== "block" && !showDbAnnotations) return;

      const p = project3Dto2D(new THREE.Vector3(m.x, m.y, m.z), camera, W, H);
      if (!p) return;
      const [ex, ey] = p;

      // Distance scaling: smaller markers in the distance
      const dist = camera.position.distanceTo(new THREE.Vector3(m.x, m.y, m.z));
      const scale = Math.max(0.4, Math.min(1.2, 50 / dist));

      // Color Coding
      let baseCol = m.color || "#3b82f6"; 
      let glowCol = baseCol.replace(")", ",0.2)").replace("rgb", "rgba");
      if (baseCol.startsWith("#")) {
        const r = parseInt(baseCol.slice(1, 3), 16), g = parseInt(baseCol.slice(3, 5), 16), b = parseInt(baseCol.slice(5, 7), 16);
        glowCol = `rgba(${r},${g},${b},0.3)`;
      }

      if (m.type === "site") { if (!m.color) baseCol = "#10b981"; }
      else if (m.type === "internal") { baseCol = "#a855f7"; }

      // Pulse Glow
      ctx.beginPath(); ctx.arc(ex, ey, 10 * dbPulse * scale, 0, Math.PI * 2);
      ctx.fillStyle = glowCol; ctx.fill();

      // Main Outer Ring
      ctx.beginPath(); ctx.arc(ex, ey, 7 * scale, 0, Math.PI * 2);
      ctx.fillStyle = baseCol; ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2 * scale; ctx.stroke();

      // Selected building highlight ring
      if (m.type === "block" && selectedBuilding && (selectedBuilding.id === m.id || selectedBuilding.label === m.label)) {
        ctx.beginPath(); ctx.arc(ex, ey, 13 * scale, 0, Math.PI * 2);
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5 * scale; ctx.setLineDash([4, 3]); ctx.stroke();
        ctx.setLineDash([]);
      }

      // Premium Glassmorphic Label
      ctx.font = `bold ${Math.round(10 * scale)}px 'Inter', system-ui, sans-serif`;
      const mText = m.label;
      const textWidth = ctx.measureText(mText).width;
      const padX = 8 * scale;
      const bw = textWidth + padX * 2, bh = 18 * scale;
      const bx = ex - bw / 2, by = ey - 22 * scale - bh;

      // Background with blur effect (mocked via low opacity + semi-opaque border)
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 6 * scale); ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)"; ctx.lineWidth = 1; ctx.stroke();

      // Shadow
      ctx.shadowBlur = 10; ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.fillStyle = "#fff"; ctx.textAlign = "center";
      ctx.fillText(mText, ex, by + bh/2 + 4 * scale);
      ctx.shadowBlur = 0;
    });

    if (visibility === "clear") return;
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

    // ─── Site annotation shapes (lines & polygons) — only when annotations layer is on ───
    if (showDbAnnotations) {
      dbSiteShapes.forEach(shape => {
        if (shape.pts.length < 2) return;
        const projPts = shape.pts.map(p => project3Dto2D(p, camera, W, H));
        if (projPts.every(p => !p)) return;

        const baseCol = shape.color || "#10b981";
        ctx.beginPath(); ctx.setLineDash([]);
        ctx.strokeStyle = baseCol; ctx.lineWidth = 3;

        // Convert hex to rgba for fill
        let fillCol = "rgba(16, 185, 129, 0.15)";
        if (baseCol.startsWith("#")) {
          const r = parseInt(baseCol.slice(1, 3), 16), g = parseInt(baseCol.slice(3, 5), 16), b = parseInt(baseCol.slice(5, 7), 16);
          fillCol = `rgba(${r}, ${g}, ${b}, 0.2)`;
        }

        ctx.fillStyle = fillCol;

        let started = false;
        projPts.forEach(p => {
          if (!p) { started = false; return; }
          if (!started) { ctx.moveTo(p[0], p[1]); started = true; }
          else ctx.lineTo(p[0], p[1]);
        });

        if (shape.type === "polygon") {
          const first = projPts.find(p => !!p);
          if (first && started) ctx.lineTo(first[0], first[1]);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.stroke();
        }
      });
    }

    // Draw the active annotation being placed
    if (annotPendingPt) drawDot(annotPendingPt, annotColor, 7);

  }, [measures, measureMode, unit, annotations, annotPendingPt, visibility, annotColor, dbSiteShapes, dbMarkers, showDbAnnotations, selectedBuilding]);

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
    rendererRef.current?.dispose();
    if (mountRef.current && rendererRef.current?.domElement.parentNode === mountRef.current)
      mountRef.current.removeChild(rendererRef.current.domElement);
  }, []);

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
      if (!NAV_KEYS.has(e.key)) return;
      if (measureMode) return;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
      keysRef.current.add(e.key);
    };
    const onUp = (e: KeyboardEvent) => { keysRef.current.delete(e.key); };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setPendingPts([]); setMeasureMode(null); hoverPtRef.current = null; setAnnotPendingPt(null); }
      if (e.key === "Enter" && measureMode && pendingPts.length >= 2) finalizeMeasure();
    };
    window.addEventListener("keydown", onDown); window.addEventListener("keyup", onUp); window.addEventListener("keydown", onEsc);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); window.removeEventListener("keydown", onEsc); keysRef.current.clear(); velocityRef.current.set(0, 0, 0); };
  }, [phase, measureMode, pendingPts, finalizeMeasure]);

  useEffect(() => {
    if (!controlsRef.current) return;
    controlsRef.current.enabled = !measureMode;
    if (measureMode) velocityRef.current.set(0, 0, 0);
  }, [measureMode]);

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

      dbMarkersRef.current.forEach((m: any) => {
        if (m.type !== "block") return;
        const proj = project3Dto2D({ x: m.x, y: m.y, z: m.z }, camera, W, H);
        if (!proj) return;
        const d = Math.sqrt((proj[0] - mx) ** 2 + (proj[1] - my) ** 2);
        if (d < nearestDist) { nearestDist = d; nearest = m; }
      });

      if (nearest) {
        const building = dbBuildingsRef.current.find((b: any) => b.id === nearest.id);
        setSelectedBuilding(building || nearest);
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
        body: JSON.stringify({ home, annotations: annotationsRef.current, measures: measuresRef.current }),
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

  // ── Annotation: save to DB (same API as 2D viewer) ───────────────────────────
  const submit3DAnnotation = useCallback(async (iconType: string, title: string, description: string, mapColor: string) => {
    const pt = annotPendingPt;
    setAnnotPickerOpen(false);
    setAnnotPendingPt(null);
    setMeasureMode(null);

    if (!pt || !schoolId || !dbSchool) return;
    const latCenter = Number(dbSchool.latitude);
    const lonCenter = Number(dbSchool.longitude);
    if (!latCenter || !lonCenter) return;

    // Convert 3D world position → GPS coordinates (inverse of toXZ in processing effect)
    const latFactor = 111320;
    const lonFactor = 111320 * Math.cos(latCenter * Math.PI / 180);
    const { x: rcX, z: rcZ } = modelRawCenterRef.current;
    const lon = (pt.x + rcX) / lonFactor + lonCenter;
    const lat = -(pt.z + rcZ) / latFactor + latCenter;

    const payload = {
      id: `site-${Date.now()}`,
      type: "point",
      coordinates: [lon, lat],
      title: title || iconType,
      label: title || iconType,
      description,
      style: { color: mapColor, iconType },
    };

    try {
      const res = await api.post(`/schools/${schoolId}/kmz/2d/site-annotations`, payload);
      if (res.data) {
        setSiteAnnotations(prev => [...prev, res.data]);
        setShowDbAnnotations(true); // make newly placed annotation visible immediately
      }
    } catch (err) {
      console.error("[3DViewer] Failed to save annotation:", err);
    }
  }, [annotPendingPt, schoolId, dbSchool]);

  const cancelAnnotation = useCallback(() => {
    setAnnotPickerOpen(false);
    setAnnotPendingPt(null);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="glb-root">
      <ViewerUIHeader 
        schoolName={schoolName}
        stats={stats}
        progress={progress}
        isProcessingMarkers={isProcessingMarkers}
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
            handleOverlayMouseMove={handleOverlayMouseMove}
            handleOverlayClick={handleOverlayClick}
            handleOverlayDoubleClick={handleOverlayDoubleClick}
            handleOverlayContextMenu={handleOverlayContextMenu}
          />

          {phase === "viewing" && (
            <>
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
              />

              <ViewerRenderModePanel
                modeLabels={MODE_LABELS}
                renderMode={renderMode}
                setRenderMode={setRenderMode}
              />

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
                showDbAnnotations={showDbAnnotations}
                setShowDbAnnotations={setShowDbAnnotations}
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

              <AnnotationPickerModal
                open={annotPickerOpen}
                annotationType="point"
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
            </>
          )}
        </div>
      )}
    </div>
  );
}