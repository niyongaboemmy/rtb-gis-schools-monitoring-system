import { useRef, useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { api, FILE_SERVER_URL } from "../lib/api";
import { X } from "lucide-react";

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
function fmtSpeed(v: number) { if (v < 0.01) return v.toFixed(3); if (v < 0.1) return v.toFixed(2); if (v < 10) return v.toFixed(1); return v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0); }
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

  const [dbSchool, setDbSchool] = useState<any>(null);
  const [dbBuildings, setDbBuildings] = useState<any[]>([]);
  const [dbMarkers, setDbMarkers] = useState<any[]>([]);
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
  const [editAnnotId, setEditAnnotId] = useState<string | null>(null);
  const [annotInput, setAnnotInput] = useState("");
  const [annotPendingPt, setAnnotPendingPt] = useState<MeasurePoint | null>(null);
  const [annotColor, setAnnotColor] = useState<string>(ANNOT_COLORS[0]);

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
    // initThree() runs in a useEffect triggered by the phase="viewing" state change above;
    // threeInitPromiseRef was resolved by initThree() once all refs are set.
    await threeInitPromiseRef.current;

    const scene = sceneRef.current!, camera = cameraRef.current!, controls = controlsRef.current!;
    const maxAniso = rendererRef.current?.capabilities.getMaxAnisotropy() ?? 16;
    if (modelRef.current) { scene.remove(modelRef.current); modelRef.current = null; }
    const model = gltf.scene;

    const upgradeTex = (tex: THREE.Texture | null) => {
      if (!tex) return; tex.anisotropy = maxAniso; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.needsUpdate = true;
    };
    model.traverse(child => {
      const mesh = child as THREE.Mesh; if (!mesh.isMesh) return;
      origMatsRef.current.set(mesh, mesh.material);
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m: any) => { ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "aoMap"].forEach(k => upgradeTex(m[k])); });
      const srcMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      const diffuseTex = (srcMat as any).map ?? null; if (diffuseTex) upgradeTex(diffuseTex);
      const unlitMat = new THREE.MeshBasicMaterial({ map: diffuseTex, vertexColors: (srcMat as any).vertexColors ?? false, side: (srcMat as any).side ?? THREE.FrontSide, transparent: (srcMat as any).transparent ?? false, opacity: (srcMat as any).opacity ?? 1, alphaTest: (srcMat as any).alphaTest ?? 0 });
      unlitMatsRef.current.set(mesh, unlitMat);
    });

    scene.add(model); modelRef.current = model;

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
    // Positioning at exactly 0,0,0 with local offset correction
    model.position.set(-rawCenter.x, -box.min.y, -rawCenter.z);
    model.updateMatrixWorld(true);
    // Refresh box for camera fitting and stats
    box.setFromObject(model);

    applyRenderMode(renderMode);

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

    // Fetch school (includes siteAnnotations) + buildings in parallel
    if (schoolId) {
      Promise.all([
        api.get(`/schools/${schoolId}`),
        api.get(`/schools/${schoolId}/buildings`),
      ]).then(([schoolRes, buildingsRes]) => {
        setDbSchool(schoolRes.data);
        setDbBuildings(buildingsRes.data);
      }).catch(e => console.error("Failed to fetch school data", e));
    }

    setProgress(100); setProgressLabel("Done!");
  }, [renderMode, applyRenderMode, schoolId]);

  // Sync DB Markers and Ground Snapping (Hierarchical: Site-wide + Blocks + Internal)
  useEffect(() => {
    const model = modelRef.current;
    if (!dbSchool || !model) { setDbMarkers([]); return; }
    const latCenter = Number(dbSchool.latitude), lonCenter = Number(dbSchool.longitude);
    if (!latCenter || !lonCenter) { setDbMarkers([]); return; }

    const latFactor = 111320, lonFactor = 111320 * Math.cos(latCenter * Math.PI / 180);
    const results: any[] = [], raycaster = new THREE.Raycaster();

    const process = (lat: number, lon: number, label: string, type: "site" | "block" | "internal", id: string) => {
      const dx = (lon - lonCenter) * lonFactor, dz = -(lat - latCenter) * latFactor;
      raycaster.set(new THREE.Vector3(dx, 1000, dz), new THREE.Vector3(0, -1, 0));
      const intersects = raycaster.intersectObject(model, true);
      const y = intersects.length > 0 ? intersects[0].point.y : 0.5;
      results.push({ id, x: dx, y, z: dz, label, type });
    };

    // 1. Site-wide Annotations (Emerald)
    (dbSchool.siteAnnotations || []).forEach((a: any) => {
      if (a.coordinates && a.type === "point") {
        const [alon, alat] = a.coordinates;
        process(alat, alon, a.title || a.label || "Site Item", "site", a.id);
      }
    });

    // 2. Buildings Blocks (Blue)
    (dbBuildings || []).forEach((b: any) => {
      const lat = Number(b.latitude || b.centroidLat), lon = Number(b.longitude || b.centroidLng);
      if (lat && lon) {
        process(lat, lon, b.name || b.code || "Block", "block", b.id);

        // 3. Internal Building Annotations (Violet)
        (b.annotations || []).forEach((ba: any) => {
          const blat = Number(ba.latitude || ba.lat || (ba.coordinates?.[1]));
          const blon = Number(ba.longitude || ba.lng || (ba.coordinates?.[0]));
          if (blat && blon) {
            process(blat, blon, ba.label || ba.content || "Space", "internal", ba.id);
          }
        });
      }
    });

    setDbMarkers(results);
  }, [dbSchool, dbBuildings]);

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
    const dbPulse = Math.sin(Date.now() / 250) * 0.4 + 1.2; // Pulsing 0.8 to 1.6
    dbMarkers.forEach(m => {
      const p = project3Dto2D(new THREE.Vector3(m.x, m.y, m.z), camera, W, H);
      if (!p) return;
      const [ex, ey] = p;

      // Color Coding
      let baseCol = "#3b82f6"; let glowCol = "rgba(59,130,246,0.2)";
      if (m.type === "site") { baseCol = "#10b981"; glowCol = "rgba(16,185,129,0.2)"; }
      else if (m.type === "internal") { baseCol = "#a855f7"; glowCol = "rgba(168,85,247,0.3)"; }

      // Pulse Glow
      ctx.beginPath(); ctx.arc(ex, ey, 8 * dbPulse, 0, Math.PI * 2);
      ctx.fillStyle = glowCol; ctx.fill();

      // Main Outer Ring
      ctx.beginPath(); ctx.arc(ex, ey, 6, 0, Math.PI * 2);
      ctx.fillStyle = baseCol; ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.setLineDash([]); ctx.stroke();

      // High-contrast Label
      ctx.font = "bold 9px 'JetBrains Mono', monospace";
      ctx.fillStyle = "#fff"; ctx.textAlign = "center";
      ctx.shadowBlur = 6; ctx.shadowColor = "rgba(0,0,0,1)";
      ctx.fillText(m.label, ex, ey - 10);
      ctx.shadowBlur = 0;
    });

    if (visibility === "none") return;
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

  }, [measures, measureMode, unit, annotations, annotPendingPt, visibility, annotColor]);

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
      // Annotations still use the accurate mesh raycast for surface-precise placement
      const pt = getAccurateRaycastPt(e); if (!pt) return;
      setAnnotPendingPt(pt); setAnnotInput(""); setEditAnnotId(null); setAnnotColor(ANNOT_COLORS[0]);
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
      const loader = new GLTFLoader(); loader.setDRACOLoader(sharedDracoLoader);
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

  // ── Annotation dialog ────────────────────────────────────────────────────────
  const submitAnnotation = () => {
    if (!annotInput.trim()) { setAnnotPendingPt(null); return; }
    if (editAnnotId) {
      setAnnotations(prev => prev.map(a => a.id === editAnnotId ? { ...a, text: annotInput, color: annotColor } : a));
      setEditAnnotId(null);
    } else if (annotPendingPt) {
      setAnnotations(prev => [...prev, { id: uid(), point: annotPendingPt, text: annotInput, color: annotColor }]);
    }
    setAnnotPendingPt(null); setAnnotInput("");
  };

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
        .toolbar{position:absolute;top:20px;left:20px;display:flex;flex-direction:column;gap:12px;z-index:20}
        .tb-group{display:flex;flex-direction:column;gap:4px;background:rgba(6,11,26,0.65);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:6px;box-shadow:0 8px 32px rgba(0,0,0,0.4)}
        .tb-btn{width:38px;height:38px;border-radius:10px;border:none;background:transparent;color:rgba(232,232,240,0.6);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .2s cubic-bezier(0.4,0,0.2,1);font-size:16px;position:relative;flex-shrink:0;user-select:none}
        .tb-btn:hover{background:rgba(255,255,255,0.06);color:#fff;transform:scale(1.05)}
        .tb-btn.active{background:linear-gradient(135deg,rgba(59,130,246,0.3),rgba(37,99,235,0.4));color:#fff;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.1)}
        .tb-btn.flash{background:rgba(50,220,120,0.25);color:#60e8a0}
        .tb-btn.danger:hover{background:rgba(255,71,71,0.18);color:#ff9090}
        .tb-btn:active{transform:scale(0.95)}
        .tb-divider{height:1px;background:rgba(255,255,255,0.08);margin:4px 6px}
        .tb-btn[data-tip]:hover::after{content:attr(data-tip);position:absolute;left:calc(100% + 10px);top:50%;transform:translateY(-50%);white-space:nowrap;background:rgba(6,11,26,0.97);border:1px solid rgba(255,255,255,0.1);border-radius:7px;padding:5px 10px;font-family:'JetBrains Mono',monospace;font-size:10px;color:#e8e8f0;letter-spacing:0.3px;pointer-events:none;z-index:100}
        .speed-group{display:flex;flex-direction:column;gap:0;background:rgba(6,11,26,0.88);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.09);border-radius:12px;padding:5px;align-items:center}
        .speed-label{font-family:'JetBrains Mono',monospace;font-size:9px;color:rgba(232,232,240,0.35);text-transform:uppercase;letter-spacing:0.8px;padding:2px 0 3px;text-align:center;width:100%}
        .speed-val{font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:600;color:#60a5fa;padding:3px 0;text-align:center;min-width:36px;letter-spacing:-0.3px}
        .speed-track{width:26px;height:3px;background:rgba(255,255,255,0.07);border-radius:3px;overflow:hidden;margin:1px 0 3px}
        .speed-fill{height:100%;background:linear-gradient(90deg,#3b82f6,#2563eb);border-radius:3px;transition:width .15s ease}
        .mode-panel{position:absolute;top:20px;right:20px;display:flex;flex-direction:column;gap:6px;z-index:20}
        .mode-label-hdr{font-family:'Inter',sans-serif;font-size:10px;font-weight:700;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1.5px;padding:0 8px 4px;text-align:right}
        .mode-btn{padding:9px 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.08);background:rgba(6,11,26,0.65);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);color:rgba(232,232,240,0.45);font-family:'JetBrains Mono',monospace;font-size:11px;cursor:pointer;transition:all .2s ease;text-align:left;display:flex;align-items:center;gap:10px;white-space:nowrap;box-shadow:0 4px 16px rgba(0,0,0,0.2)}
        .mode-btn:hover{background:rgba(255,255,255,0.06);color:#fff;border-color:rgba(255,255,255,0.15)}
        .mode-btn.active{background:rgba(59,130,246,0.15);color:#fff;border-color:rgba(59,130,246,0.4);font-weight:600}
        .mode-dot{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,0.1);flex-shrink:0;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.1)}
        .mode-btn.active .mode-dot{background:#3b82f6;box-shadow:0 0 10px rgba(59,130,246,0.8)}
        .mode-tag{font-size:9px;padding:2px 7px;border-radius:6px;background:rgba(50,220,120,0.1);border:1px solid rgba(50,220,120,0.25);color:#60e8a0;margin-left:auto;font-weight:600;letter-spacing:0.3px}
        .stats-panel{position:absolute;bottom:20px;left:20px;background:rgba(6,11,26,0.65);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:14px 20px;display:flex;gap:20px;align-items:center;z-index:20;box-shadow:0 8px 32px rgba(0,0,0,0.4)}
        .stat-item{display:flex;flex-direction:column;gap:3px}
        .stat-val{font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;color:#60a5fa;letter-spacing:-0.4px}
        .stat-lbl{font-size:9px;font-weight:600;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px}
        .stat-div{width:1px;height:24px;background:rgba(255,255,255,0.08);flex-shrink:0}
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
        .annot-dialog{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(13,20,41,0.85);backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.12);border-radius:20px;padding:24px;width:320px;z-index:60;box-shadow:0 32px 80px rgba(0,0,0,0.8);animation:popIn .05s ease-out forwards}
        @keyframes popIn{from{transform:translate(-50%,-45%) scale(0.95);opacity:0}to{transform:translate(-50%,-50%) scale(1);opacity:1}}
        .ad-title{font-size:14px;font-weight:800;margin-bottom:18px;display:flex;align-items:center;gap:10px;letter-spacing:-0.2px}
        .ad-colors{display:flex;gap:10px;margin-bottom:16px;}
        .ad-color-btn{width:24px;height:24px;border-radius:50%;border:2px solid transparent;cursor:pointer;transition:all 0.2s cubic-bezier(0.4,0,0.2,1);box-shadow:0 4px 12px rgba(0,0,0,0.3)}
        .ad-color-btn:hover{transform:scale(1.25);z-index:1}
        .ad-color-btn.active{border-color:#ffffff;transform:scale(1.1);box-shadow:0 0 0 4px rgba(255,255,255,0.1)}
        .ad-textarea{width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:14px;font-family:'JetBrains Mono',monospace;font-size:12px;resize:vertical;min-height:90px;outline:none;transition:all .2s;line-height:1.6;color:#fff}
        .ad-textarea:focus{border-color:rgba(59,130,246,0.5);background:rgba(255,255,255,0.08)}
        .ad-row{display:flex;gap:10px;margin-top:20px;justify-content:flex-end}
        .ad-cancel{padding:9px 18px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:transparent;color:rgba(232,232,240,0.5);font-family:'Inter',sans-serif;font-size:11px;font-weight:600;cursor:pointer;transition:all .15s}
        .ad-cancel:hover{background:rgba(255,255,255,0.06);color:#fff}
        .ad-save{padding:9px 24px;border-radius:10px;border:none;background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;font-family:'Inter',sans-serif;font-size:11px;font-weight:700;cursor:pointer;transition:all .2s;box-shadow:0 4px 12px rgba(37,99,235,0.3)}
        .ad-save:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(37,99,235,0.5)}

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
                  Rwanda TVET Board · 3D Photogrammetry Viewer
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
            <span className="badge">Measure · Annotate · Screenshot</span>
            <button 
              onClick={() => {
                if (onClose) onClose();
                else window.close();
              }}
              style={{ padding: "6px 12px", borderRadius: "8px", border: "1px solid rgba(255,100,100,0.3)", background: "rgba(255,70,70,0.1)", color: "#ff6060", fontSize: "10px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
            >
              <X size={12} /> EXIT EXPLORER
            </button>
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
          <div className="viewer-wrapper">
            {progress < 100 && (
              <div style={{ position: "absolute", inset: 0, zIndex: 5, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, background: "rgba(6,11,26,0.78)", backdropFilter: "blur(6px)" }}>
                <div className="spinner-ring" />
                <div className="loading-pct">{progress}%</div>
                <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
                <div className="progress-label">{progressLabel}</div>
              </div>
            )}

            <div ref={mountRef} className="viewer-canvas" />

            <canvas ref={overlayRef} className={`overlay-canvas${measureMode ? "  interactive" : ""}`}
              onMouseMove={handleOverlayMouseMove}
              onClick={handleOverlayClick}
              onDoubleClick={handleOverlayDoubleClick}
              onContextMenu={handleOverlayContextMenu} />

            {/* Left toolbar */}
            <div className="toolbar">
              <div className="tb-group">
                <button className="tb-btn" data-tip="Reset to current home" onClick={handleResetCamera}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                </button>
                <button className={`tb-btn${saveFlash ? " flash" : ""}`}
                  data-tip={homeSaved ? "Update auto-home position" : "Save view as auto-home"} onClick={handleSaveHome}>
                  {saveFlash ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                  ) : homeSaved ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                  )}
                </button>
                <button className="tb-btn" data-tip="Rotate axis (Flip)" onClick={toggleOrientation}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 21l-4-4 4-4" /><path d="M3 17h18a2 2 0 0 0 2-2v-2" /><path d="M17 3l4 4-4 4" /><path d="M21 7H3a2 2 0 0 0-2 2v2" /></svg>
                </button>
                <div className="tb-divider" />
                <button className="tb-btn" data-tip="Top View" onClick={() => setView("top")} style={{ fontSize: 9, fontWeight: 800 }}>TOP</button>
                <div style={{ display: "flex", gap: 2 }}>
                  <button className="tb-btn" data-tip="Front" onClick={() => setView("front")} style={{ fontSize: 8, fontWeight: 800, width: 28 }}>FRT</button>
                  <button className="tb-btn" data-tip="Back" onClick={() => setView("back")} style={{ fontSize: 8, fontWeight: 800, width: 28 }}>BCK</button>
                </div>
                <div style={{ display: "flex", gap: 2 }}>
                  <button className="tb-btn" data-tip="Left" onClick={() => setView("left")} style={{ fontSize: 8, fontWeight: 800, width: 28 }}>LFT</button>
                  <button className="tb-btn" data-tip="Right" onClick={() => setView("right")} style={{ fontSize: 8, fontWeight: 800, width: 28 }}>RGT</button>
                </div>
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
                  onClick={() => setShowMeasurePanel(v => !v)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19.07 4.93-1.41 1.41" /><path d="m15.53 8.47-1.41 1.41" /><path d="M12 12 5 19" /><path d="m11.3 7.8 1.4-1.4" /><path d="m14.8 11.3 1.4-1.4" /><path d="m7.8 11.3 1.4-1.4" /><path d="m11.3 14.8 1.4-1.4" /><path d="m8.5 7.1 7.1 7.1" /><rect width="20" height="20" x="2" y="2" rx="2" /></svg>
                </button>
                <button className={`tb-btn${screenshotFlash ? " flash" : ""}`} data-tip="Screenshot & download"
                  onClick={handleScreenshot}>
                  {screenshotFlash ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></svg>
                  )}
                </button>
                <div className="tb-divider" />
                <button className={`tb-btn${showHelp ? " active" : ""}`} data-tip="Keyboard shortcuts"
                  onClick={() => setShowHelp(v => !v)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                </button>
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

                <textarea className="ad-textarea" placeholder="Type your note…" value={annotInput} autoFocus
                  style={{ color: annotColor }}
                  onChange={e => setAnnotInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitAnnotation(); } if (e.key === "Escape") { setAnnotPendingPt(null); setEditAnnotId(null); } }} />
                <div className="ad-row">
                  <button className="ad-cancel" onClick={() => { setAnnotPendingPt(null); setEditAnnotId(null); }}>Cancel</button>
                  <button className="ad-save" onClick={submitAnnotation}>Save</button>
                </div>
              </div>
            )}

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
                        {[{ keys: ["W", "↑"], desc: "Walk Forward" }, { keys: ["S", "↓"], desc: "Walk Backward" }, { keys: ["A", "←"], desc: "Strafe left" }, { keys: ["D", "→"], desc: "Strafe right" }, { keys: ["E", "Space"], desc: "Fly up" }, { keys: ["Q", "F"], desc: "Fly down" }].map(r => (
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