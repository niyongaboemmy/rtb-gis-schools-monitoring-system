import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { api } from "../lib/api";
import type {
  ToolMode,
  Annotation,
  HomePosition,
} from "../components/glb/types";
import { ViewerToolbar } from "../components/glb/ViewerToolbar";
import { MeasurementHUD } from "../components/glb/MeasurementHUD";
import { AnnotationLabel } from "../components/glb/AnnotationLabel";
import {
  NewAnnotationDialog,
  EditAnnotationDialog,
} from "../components/glb/AnnotationDialog";
import { SettingsPanel } from "../components/glb/SettingsPanel";
import { HelpPanel } from "../components/glb/HelpPanel";
import { LoadingOverlay } from "../components/glb/LoadingOverlay";

// ─── Pure helpers (module-level, no allocations on hot path) ─────────────────

const _projVec = new THREE.Vector3();
const _annWorld = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();

function project3Dto2D(
  world: THREE.Vector3,
  camera: THREE.PerspectiveCamera,
  W: number,
  H: number,
): [number, number] | null {
  _projVec.copy(world).project(camera);
  if (_projVec.z < -1 || _projVec.z > 1) return null;
  return [(_projVec.x * 0.5 + 0.5) * W, (-_projVec.y * 0.5 + 0.5) * H];
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function polygonArea(pts: THREE.Vector3[]) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i].x * pts[j].z - pts[j].x * pts[i].z;
  }
  return Math.abs(a) / 2;
}
function polygonPerimeter(pts: THREE.Vector3[]) {
  let p = 0;
  for (let i = 0; i < pts.length; i++)
    p += pts[i].distanceTo(pts[(i + 1) % pts.length]);
  return p;
}
function uid() {
  return Math.random().toString(36).slice(2, 10);
}
function fmtLen(m: number, unit: "m" | "cm") {
  if (unit === "cm") return `${(m * 100).toFixed(1)} cm`;
  return m >= 1000 ? `${(m / 1000).toFixed(3)} km` : `${m.toFixed(2)} m`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function GlbViewer() {
  const { id } = useParams<{ id: string }>();

  // ── Three.js refs ────────────────────────────────────────────────────────
  const mountRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null); // ← key: raycast target
  const rafRef = useRef<number>(0);
  const raycasterRef = useRef(new THREE.Raycaster());
  const keysRef = useRef<Record<string, boolean>>({});
  const frameRef = useRef(0);
  const annDomRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const drawOverlayRef = useRef<() => void>(() => {});
  const lastHoverMs = useRef(0); // ← throttle hover raycast

  // ── App state ────────────────────────────────────────────────────────────
  const [school, setSchool] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Tool & measurement
  const [toolMode, setToolMode] = useState<ToolMode>("none");
  const toolModeRef = useRef<ToolMode>("none");
  const [measurePoints, setMeasurePoints] = useState<THREE.Vector3[]>([]);
  const measurePointsRef = useRef<THREE.Vector3[]>([]);
  const [measureUnit, setMeasureUnit] = useState<"m" | "cm">("m");
  const measureUnitRef = useRef<"m" | "cm">("m");
  const hoverRef = useRef<THREE.Vector3 | null>(null);

  // Home position
  const [homePosition, setHomePosition] = useState<HomePosition | null>(null);
  const [savingHome, setSavingHome] = useState(false);
  const [homeSaved, setHomeSaved] = useState(false);

  // Annotations
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const annotationsRef = useRef<Annotation[]>([]);
  const [annotationColor, setAnnotationColor] = useState("#3b82f6");
  const [pendingAnnotation, setPendingAnnotation] = useState<{
    world: THREE.Vector3;
    screen: { x: number; y: number };
  } | null>(null);
  const pendingAnnotationRef = useRef<{
    world: THREE.Vector3;
    screen: { x: number; y: number };
  } | null>(null);
  const [annotationLabel, setAnnotationLabel] = useState("");
  const [savingAnnotations, setSavingAnnotations] = useState(false);
  const [editingAnnotation, setEditingAnnotation] = useState<string | null>(
    null,
  );
  const [editLabel, setEditLabel] = useState("");

  // Movement & settings
  const movementPausedRef = useRef(false);
  const [movementPaused, setMovementPaused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [gridVisible, setGridVisible] = useState(true);
  const [fogEnabled, setFogEnabled] = useState(true);

  // ── Keep refs in sync with state ─────────────────────────────────────────
  useEffect(() => {
    toolModeRef.current = toolMode;
  }, [toolMode]);
  useEffect(() => {
    measurePointsRef.current = measurePoints;
  }, [measurePoints]);
  useEffect(() => {
    measureUnitRef.current = measureUnit;
  }, [measureUnit]);
  useEffect(() => {
    annotationsRef.current = annotations;
  }, [annotations]);
  useEffect(() => {
    pendingAnnotationRef.current = pendingAnnotation;
  }, [pendingAnnotation]);

  // ── Derived measurement values ───────────────────────────────────────────
  const distance =
    measurePoints.length >= 2
      ? measurePoints[0].distanceTo(measurePoints[1])
      : null;
  const area = measurePoints.length >= 3 ? polygonArea(measurePoints) : null;
  const perimeter =
    measurePoints.length >= 3 ? polygonPerimeter(measurePoints) : null;

  // ── Canvas overlay — drawn every frame via drawOverlayRef ────────────────
  // All 2D drawing happens here: measure dots, lines, labels, annotation pins.
  // Using refs throughout so the closure never goes stale.
  const drawOverlay = useCallback(() => {
    const canvas = overlayRef.current;
    const camera = cameraRef.current as THREE.PerspectiveCamera | null;
    if (!canvas || !camera) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width,
      H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const drawDot = (pt: THREE.Vector3, color: string, r = 6) => {
      const p = project3Dto2D(pt, camera, W, H);
      if (!p) return;
      ctx.beginPath();
      ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p[0], p[1], r + 1.5, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 1;
      ctx.stroke();
    };

    const drawLine = (pts: THREE.Vector3[], color: string, dashed = false) => {
      if (pts.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      dashed ? ctx.setLineDash([6, 4]) : ctx.setLineDash([]);
      let started = false;
      for (const pt of pts) {
        const p = project3Dto2D(pt, camera, W, H);
        if (!p) {
          started = false;
          continue;
        }
        started
          ? ctx.lineTo(p[0], p[1])
          : (ctx.moveTo(p[0], p[1]), (started = true));
      }
      ctx.stroke();
    };

    const drawLabel = (pt: THREE.Vector3, text: string, color: string) => {
      const p = project3Dto2D(pt, camera, W, H);
      if (!p) return;
      const px = p[0] + 10,
        py = p[1] - 10;
      ctx.font = "bold 12px system-ui,sans-serif";
      const tw = ctx.measureText(text).width;
      ctx.fillStyle = "rgba(0,0,0,0.85)";
      roundRect(ctx, px - 4, py - 13, tw + 18, 22, 5);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(text, px + 1, py);
    };

    const pts = measurePointsRef.current;
    const mode = toolModeRef.current;
    const unit = measureUnitRef.current;

    // Measurement visuals
    if (mode !== "none" && pts.length > 0) {
      if (pts.length >= 2) drawLine(pts, "#60a5fa");
      if (mode === "area" && pts.length >= 3)
        drawLine([pts[pts.length - 1], pts[0]], "#60a5fa", true);
      pts.forEach((pt, i) => drawDot(pt, i === 0 ? "#10b981" : "#ffd700"));
      // Segment labels
      for (let i = 0; i < pts.length - 1; i++) {
        drawLabel(
          pts[i].clone().lerp(pts[i + 1], 0.5),
          fmtLen(pts[i].distanceTo(pts[i + 1]), unit),
          "#ffd700",
        );
      }
      if (mode === "area" && pts.length >= 3) {
        drawLabel(
          pts[pts.length - 1].clone().lerp(pts[0], 0.5),
          fmtLen(pts[pts.length - 1].distanceTo(pts[0]), unit),
          "#ffd700",
        );
      }
      // Hover preview
      const hover = hoverRef.current;
      if (hover) {
        drawLine([pts[pts.length - 1], hover], "#93c5fd", true);
        drawDot(hover, "#fff", 4);
        drawLabel(
          hover,
          fmtLen(pts[pts.length - 1].distanceTo(hover), unit),
          "#93c5fd",
        );
      }
    } else if (mode !== "none") {
      const hover = hoverRef.current;
      if (hover) drawDot(hover, "#fff", 4);
    }

    // Annotation pin dots
    annotationsRef.current.forEach((ann) => {
      _annWorld.set(ann.position.x, ann.position.y, ann.position.z);
      drawDot(_annWorld, ann.color, 7);
    });

    // Pending annotation placement dot
    const pa = pendingAnnotationRef.current;
    if (pa) drawDot(pa.world, "#60a5fa", 7);
  }, []);

  useEffect(() => {
    drawOverlayRef.current = drawOverlay;
  }, [drawOverlay]);

  // ── Three.js viewer init ─────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;

    api
      .get(`/schools/${id}`)
      .then((res) => {
        const s = res.data;
        setSchool(s);
        if (s.glb3dHomePosition) setHomePosition(s.glb3dHomePosition);
        if (s.glb3dAnnotations?.length) setAnnotations(s.glb3dAnnotations);

        const building = s.buildings?.find((b: any) =>
          b.modelPath?.toLowerCase().endsWith(".glb"),
        );
        if (!building?.modelPath) {
          setError("No 3D GLB model found for this school.");
          setLoading(false);
          return;
        }
        initViewer(building.modelPath as string, s.glb3dHomePosition ?? null);
      })
      .catch(() => {
        setError("Failed to load school data.");
        setLoading(false);
      });

    return () => {
      cancelAnimationFrame(rafRef.current);
      rendererRef.current?.dispose();
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  function initViewer(glbUrl: string, savedHome: HomePosition | null) {
    const mount = mountRef.current!;
    const W = mount.clientWidth,
      H = mount.clientHeight;

    // ── Overlay canvas — size it immediately so frame-0 drawing is correct ──
    const oc = overlayRef.current;
    if (oc) {
      oc.width = W;
      oc.height = H;
    }

    // ── Renderer ────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      logarithmicDepthBuffer: true,
    });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = false;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ── Scene ────────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f1117);
    scene.fog = new THREE.FogExp2(0x0f1117, 0.002);
    sceneRef.current = scene;

    const grid = new THREE.GridHelper(200, 80, 0x223355, 0x1a2a3a);
    grid.name = "grid";
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.5;
    scene.add(grid);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const sun = new THREE.DirectionalLight(0xffeedd, 2.5);
    sun.position.set(50, 100, 50);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xaaccff, 0.8);
    fill.position.set(-30, 20, -30);
    scene.add(fill);
    scene.add(new THREE.HemisphereLight(0x87ceeb, 0x3a5f3a, 0.5));

    // ── Camera & controls ────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(55, W / H, 0.01, 5000);
    camera.position.set(0, 30, 80);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.screenSpacePanning = false;
    controls.minDistance = 0.5;
    controls.maxDistance = 2000;
    controls.maxPolarAngle = Math.PI / 2 + 0.15;
    controls.zoomSpeed = 1.2;
    controlsRef.current = controls;

    // ── GLB loader ───────────────────────────────────────────────────────────
    const loader = new GLTFLoader();
    loader.load(
      glbUrl,
      (gltf) => {
        const model = gltf.scene;

        // Z-up → Y-up, scale to ~80-unit footprint, center, snap to ground
        model.rotation.x = -Math.PI / 2;
        model.updateMatrixWorld(true);

        const b1 = new THREE.Box3().setFromObject(model);
        const s1 = b1.getSize(new THREE.Vector3());
        const footprint = Math.max(s1.x, s1.z);
        if (footprint > 0) {
          model.scale.setScalar(80 / footprint);
          model.updateMatrixWorld(true);
        }

        const b2 = new THREE.Box3().setFromObject(model);
        const c2 = b2.getCenter(new THREE.Vector3());
        model.position.x -= c2.x;
        model.position.z -= c2.z;
        model.updateMatrixWorld(true);

        scene.add(model);
        model.updateMatrixWorld(true);
        modelRef.current = model; // ← store for raycasting

        const groundBox = new THREE.Box3().setFromObject(model);
        model.position.y -= groundBox.min.y; // snap to Y=0
        model.updateMatrixWorld(true);

        // Reposition grid to model bottom
        grid.position.y = 0;

        const b3 = new THREE.Box3().setFromObject(model);
        const center = b3.getCenter(new THREE.Vector3());
        const size = b3.getSize(new THREE.Vector3());
        const maxExtent = Math.max(size.x, size.z);

        if (savedHome) {
          camera.position.set(
            savedHome.position.x,
            savedHome.position.y,
            savedHome.position.z,
          );
          controls.target.set(
            savedHome.target.x,
            savedHome.target.y,
            savedHome.target.z,
          );
        } else {
          const dist = maxExtent * 1.1;
          const elev = dist * Math.tan(THREE.MathUtils.degToRad(38));
          camera.position.set(center.x, center.y + elev, center.z + dist);
          controls.target.set(center.x, center.y + size.y * 0.15, center.z);
        }
        controls.update();
        setLoading(false);
      },
      (xhr) => {
        if (xhr.total)
          setLoadProgress(Math.round((xhr.loaded / xhr.total) * 100));
      },
      (err) => {
        console.error(err);
        setError("Failed to load 3D model.");
        setLoading(false);
      },
    );

    // ── Keyboard ─────────────────────────────────────────────────────────────
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        const next = !movementPausedRef.current;
        movementPausedRef.current = next;
        setMovementPaused(next);
        if (next) keysRef.current = {};
        return;
      }
      keysRef.current[e.code] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // ── Resize ───────────────────────────────────────────────────────────────
    const onResize = () => {
      const nW = mount.clientWidth,
        nH = mount.clientHeight;
      camera.aspect = nW / nH;
      camera.updateProjectionMatrix();
      renderer.setSize(nW, nH);
      const overlay = overlayRef.current;
      if (overlay) {
        overlay.width = nW;
        overlay.height = nH;
      }
    };
    window.addEventListener("resize", onResize);

    // ── Animate loop ─────────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    function animate() {
      rafRef.current = requestAnimationFrame(animate);
      applyKeyboard(clock.getDelta());
      controls.update();
      renderer.render(scene, camera);
      drawOverlayRef.current(); // canvas overlay every frame

      // Reproject annotation DOM labels every 3 frames
      frameRef.current++;
      if (frameRef.current % 3 === 0) {
        const cW = mount.clientWidth,
          cH = mount.clientHeight;
        annotationsRef.current.forEach((ann) => {
          const el = annDomRefs.current[ann.id];
          if (!el) return;
          _annWorld.set(ann.position.x, ann.position.y, ann.position.z);
          _projVec.copy(_annWorld).project(camera);
          const behind = _projVec.z < -1 || _projVec.z > 1;
          el.style.display = behind ? "none" : "block";
          el.style.left = `${(_projVec.x * 0.5 + 0.5) * cW}px`;
          el.style.top = `${(-_projVec.y * 0.5 + 0.5) * cH + 44}px`;
        });
      }
    }
    animate();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (mount.contains(renderer.domElement))
        mount.removeChild(renderer.domElement);
    };
  }

  // ── Keyboard movement (inside animate, called with delta) ────────────────
  function applyKeyboard(delta: number) {
    const camera = cameraRef.current,
      controls = controlsRef.current;
    if (!camera || !controls || movementPausedRef.current) return;
    const keys = keysRef.current;
    const speed = 20 * delta;
    let dx = 0,
      dz = 0,
      dy = 0;
    if (keys["KeyW"] || keys["ArrowUp"]) dz = speed;
    if (keys["KeyS"] || keys["ArrowDown"]) dz = -speed;
    if (keys["KeyA"] || keys["ArrowLeft"]) dx = -speed;
    if (keys["KeyD"] || keys["ArrowRight"]) dx = speed;
    if (keys["KeyQ"] || keys["PageUp"]) dy = speed;
    if (keys["KeyE"] || keys["PageDown"]) dy = -speed;
    if (!dx && !dz && !dy) return;
    camera.getWorldDirection(_fwd);
    _fwd.y = 0;
    _fwd.normalize();
    _right.crossVectors(_fwd, camera.up).normalize();
    camera.position.addScaledVector(_fwd, dz).addScaledVector(_right, dx);
    camera.position.y += dy;
    controls.target.addScaledVector(_fwd, dz).addScaledVector(_right, dx);
    controls.target.y += dy;
  }

  // ── Raycast helpers ──────────────────────────────────────────────────────
  // Raycast only against the loaded model — not the whole scene.
  function getModelHit(clientX: number, clientY: number) {
    const model = modelRef.current,
      camera = cameraRef.current,
      renderer = rendererRef.current;
    if (!model || !camera || !renderer) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycasterRef.current.setFromCamera(mouse, camera);
    const hits = raycasterRef.current.intersectObject(model, true);
    return hits.length ? hits[0] : null;
  }

  // ── Mouse move — throttled hover preview ─────────────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const mode = toolModeRef.current;
    if (mode === "none" || mode === "annotate") {
      hoverRef.current = null;
      return;
    }
    const now = performance.now();
    if (now - lastHoverMs.current < 33) return; // ~30 fps throttle
    lastHoverMs.current = now;
    const hit = getModelHit(e.clientX, e.clientY);
    hoverRef.current = hit ? hit.point.clone() : null;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Canvas click ─────────────────────────────────────────────────────────
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const mode = toolModeRef.current;
    if (mode === "none") return;
    const hit = getModelHit(e.clientX, e.clientY);
    if (!hit) return;

    if (mode === "distance") {
      setMeasurePoints((prev) =>
        prev.length >= 2 ? [hit.point.clone()] : [...prev, hit.point.clone()],
      );
    } else if (mode === "area") {
      setMeasurePoints((prev) => [...prev, hit.point.clone()]);
    } else if (mode === "annotate") {
      const renderer = rendererRef.current!;
      const rect = renderer.domElement.getBoundingClientRect();
      setPendingAnnotation({
        world: hit.point.clone(),
        screen: { x: e.clientX - rect.left, y: e.clientY - rect.top },
      });
      setAnnotationLabel("");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Annotation actions ───────────────────────────────────────────────────
  const saveAnnotations = useCallback(
    async (updated: Annotation[]) => {
      if (!id) return;
      setSavingAnnotations(true);
      try {
        await api.patch(`/schools/${id}`, { glb3dAnnotations: updated });
      } finally {
        setSavingAnnotations(false);
      }
    },
    [id],
  );

  const confirmAnnotation = useCallback(() => {
    if (!pendingAnnotation || !annotationLabel.trim()) return;
    const ann: Annotation = {
      id: uid(),
      label: annotationLabel.trim(),
      color: annotationColor,
      position: {
        x: pendingAnnotation.world.x,
        y: pendingAnnotation.world.y,
        z: pendingAnnotation.world.z,
      },
      createdAt: new Date().toISOString(),
    };
    const updated = [...annotationsRef.current, ann];
    setAnnotations(updated);
    saveAnnotations(updated);
    setPendingAnnotation(null);
    setAnnotationLabel("");
  }, [pendingAnnotation, annotationLabel, annotationColor, saveAnnotations]);

  const deleteAnnotation = useCallback(
    (annId: string) => {
      const updated = annotationsRef.current.filter((a) => a.id !== annId);
      setAnnotations(updated);
      saveAnnotations(updated);
    },
    [saveAnnotations],
  );

  const confirmEdit = useCallback(() => {
    if (!editingAnnotation || !editLabel.trim()) return;
    const updated = annotationsRef.current.map((a) =>
      a.id === editingAnnotation ? { ...a, label: editLabel.trim() } : a,
    );
    setAnnotations(updated);
    saveAnnotations(updated);
    setEditingAnnotation(null);
    setEditLabel("");
  }, [editingAnnotation, editLabel, saveAnnotations]);

  // ── Home position ────────────────────────────────────────────────────────
  const saveHomePosition = useCallback(async () => {
    const camera = cameraRef.current,
      controls = controlsRef.current;
    if (!camera || !controls || !id) return;
    setSavingHome(true);
    const home: HomePosition = {
      position: {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
      },
      target: {
        x: controls.target.x,
        y: controls.target.y,
        z: controls.target.z,
      },
    };
    try {
      await api.patch(`/schools/${id}`, { glb3dHomePosition: home });
      setHomePosition(home);
      setHomeSaved(true);
      setTimeout(() => setHomeSaved(false), 2500);
    } finally {
      setSavingHome(false);
    }
  }, [id]);

  const goHome = useCallback((home: HomePosition) => {
    const camera = cameraRef.current,
      controls = controlsRef.current;
    if (!camera || !controls) return;
    const cam = camera,
      ctrl = controls;
    const startPos = cam.position.clone(),
      startTarget = ctrl.target.clone();
    const endPos = new THREE.Vector3(
      home.position.x,
      home.position.y,
      home.position.z,
    );
    const endTarget = new THREE.Vector3(
      home.target.x,
      home.target.y,
      home.target.z,
    );
    let t = 0;
    const clock = new THREE.Clock();
    function tick() {
      t += clock.getDelta() / 1.2;
      if (t >= 1) {
        cam.position.copy(endPos);
        ctrl.target.copy(endTarget);
        ctrl.update();
        rendererRef.current?.render(sceneRef.current!, cam);
        return;
      }
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      cam.position.lerpVectors(startPos, endPos, ease);
      ctrl.target.lerpVectors(startTarget, endTarget, ease);
      ctrl.update();
      rendererRef.current?.render(sceneRef.current!, cam);
      requestAnimationFrame(tick);
    }
    tick();
  }, []);

  // ── Screenshot ───────────────────────────────────────────────────────────
  const takeScreenshot = useCallback(() => {
    const r = rendererRef.current;
    if (!r) return;
    r.render(sceneRef.current!, cameraRef.current!);
    r.domElement.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${school?.name || "school"}_3d.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }, [school]);

  // ── Scene toggles ─────────────────────────────────────────────────────────
  const toggleGrid = (v: boolean) => {
    const g = sceneRef.current?.getObjectByName("grid");
    if (g) g.visible = v;
    setGridVisible(v);
  };
  const toggleFog = (v: boolean) => {
    if (!sceneRef.current) return;
    sceneRef.current.fog = v ? new THREE.FogExp2(0x0f1117, 0.002) : null;
    setFogEnabled(v);
  };

  const setTool = (t: ToolMode) => {
    setToolMode(t);
    setMeasurePoints([]);
    hoverRef.current = null;
    setPendingAnnotation(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 bg-[#0f1117] flex flex-col"
      style={{ fontFamily: "system-ui, sans-serif" }}
    >
      <ViewerToolbar
        school={school}
        toolMode={toolMode}
        onSetTool={setTool}
        annotationColor={annotationColor}
        onSetAnnotationColor={setAnnotationColor}
        homePosition={homePosition}
        onGoHome={() => homePosition && goHome(homePosition)}
        savingHome={savingHome}
        homeSaved={homeSaved}
        onSaveHome={saveHomePosition}
        onScreenshot={takeScreenshot}
        showSettings={showSettings}
        onToggleSettings={() => setShowSettings((v) => !v)}
        showHelp={showHelp}
        onToggleHelp={() => setShowHelp((v) => !v)}
        movementPaused={movementPaused}
        annotationCount={annotations.length}
      />

      {/* Three.js mount */}
      <div
        ref={mountRef}
        className="absolute inset-0 top-11"
        style={{ cursor: toolMode !== "none" ? "crosshair" : "grab" }}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => {
          hoverRef.current = null;
        }}
      />

      {/* 2D canvas overlay — dots, lines, labels, annotation pins */}
      <canvas
        ref={overlayRef}
        className="absolute pointer-events-none"
        style={{
          inset: 0,
          top: 44,
          width: "100%",
          height: "calc(100% - 44px)",
          zIndex: 18,
        }}
      />

      {/* Annotation DOM labels (positioned imperatively in rAF) */}
      {annotations.map((ann) => (
        <AnnotationLabel
          key={ann.id}
          ann={ann}
          ref={(el) => {
            annDomRefs.current[ann.id] = el;
          }}
          onEdit={() => {
            setEditingAnnotation(ann.id);
            setEditLabel(ann.label);
          }}
          onDelete={() => deleteAnnotation(ann.id)}
        />
      ))}

      {pendingAnnotation && (
        <NewAnnotationDialog
          screen={pendingAnnotation.screen}
          label={annotationLabel}
          color={annotationColor}
          onLabelChange={setAnnotationLabel}
          onColorChange={setAnnotationColor}
          onConfirm={confirmAnnotation}
          onCancel={() => setPendingAnnotation(null)}
        />
      )}

      {editingAnnotation && (
        <EditAnnotationDialog
          label={editLabel}
          onLabelChange={setEditLabel}
          onConfirm={confirmEdit}
          onCancel={() => setEditingAnnotation(null)}
        />
      )}

      <MeasurementHUD
        distance={distance}
        area={area}
        perimeter={perimeter}
        unit={measureUnit}
        onSetUnit={setMeasureUnit}
        onClear={() => setMeasurePoints([])}
      />

      {toolMode !== "none" && !pendingAnnotation && (
        <div
          className="absolute top-14 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-xl text-xs pointer-events-none"
          style={{
            background: "rgba(59,130,246,0.2)",
            color: "#93c5fd",
            border: "1px solid rgba(59,130,246,0.3)",
            backdropFilter: "blur(8px)",
          }}
        >
          {toolMode === "distance" &&
            "Click two points on the model to measure distance"}
          {toolMode === "area" && "Click 3+ points for area — Clear when done"}
          {toolMode === "annotate" &&
            "Click a point on the model to place an annotation"}
        </div>
      )}

      {showSettings && (
        <SettingsPanel
          gridVisible={gridVisible}
          onToggleGrid={toggleGrid}
          fogEnabled={fogEnabled}
          onToggleFog={toggleFog}
          unit={measureUnit}
          onSetUnit={setMeasureUnit}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}

      {savingAnnotations && (
        <div
          className="absolute bottom-12 right-4 z-20 px-3 py-1.5 rounded-lg text-xs"
          style={{
            background: "rgba(0,0,0,0.7)",
            color: "rgba(255,255,255,0.5)",
            backdropFilter: "blur(8px)",
          }}
        >
          Saving…
        </div>
      )}

      {/* Status bar */}
      <div
        className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-between px-5 py-2"
        style={{
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(8px)",
          borderTop: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <span
          style={{
            color: "rgba(255,255,255,0.3)",
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          {school?.district && `${school.district} · ${school.province}`}
        </span>
        <div
          className="flex items-center gap-3"
          style={{ color: "rgba(255,255,255,0.2)", fontSize: 10 }}
        >
          <span>WASD — Move</span>
          <span>QE — Up/Down</span>
          <span>Space — Pause</span>
          <span>Scroll — Zoom</span>
        </div>
      </div>

      <LoadingOverlay
        school={school}
        loading={loading}
        loadProgress={loadProgress}
        error={error}
      />
    </div>
  );
}
