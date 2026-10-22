/**
 * ONE tool vocabulary for the 2D map and the 3D model viewer (WS4.1).
 *
 * Both toolbars, both active-tool banners and the help modal are built from
 * this table, so a tool has the same name, icon, shortcut and permission in
 * both viewers.
 */
import type { LucideIcon } from "lucide-react";
import {
  MousePointer2,
  Ruler,
  Square,
  Hexagon,
  MoveVertical,
  MessageSquare,
  MapPin,
  FileDown,
  MapPinned,
  Layers,
} from "lucide-react";
import { Permission, type PermissionType } from "./permissions";
import { formatArea, formatLength, type MeasureSource } from "./format";

export type ViewerToolId =
  | "navigate"
  | "measure_distance"
  | "measure_area"
  | "measure_perimeter"
  | "measure_height"
  | "annotate"
  | "pin"
  | "export"
  | "set_location"
  | "overlays";

export type ViewerKind = "2d" | "3d";

export interface ViewerToolDef {
  id: ViewerToolId;
  label: string;
  icon: LucideIcon;
  /** Single key, matched case-insensitively. */
  shortcut: string | null;
  cursor: "default" | "crosshair" | "copy";
  /** Text of the active-tool banner. */
  help: string;
  /** Short step list for the help modal. */
  steps: string[];
  /** null = everyone who can open the viewer. */
  permission: PermissionType | null;
  viewers: ViewerKind[];
}

const MEASURE_HELP_TAIL = "double-click or Enter to finish, Backspace to undo a point, Esc to cancel.";

export const VIEWER_TOOLS: Record<ViewerToolId, ViewerToolDef> = {
  navigate: {
    id: "navigate",
    label: "Navigate",
    icon: MousePointer2,
    shortcut: "v",
    cursor: "default",
    help: "Navigate: drag to move the view, scroll to zoom, click a building to select it.",
    steps: ["Drag to move (2D) or orbit (3D).", "Scroll or pinch to zoom.", "Click a building to select it."],
    permission: null,
    viewers: ["2d", "3d"],
  },
  measure_distance: {
    id: "measure_distance",
    label: "Distance",
    icon: Ruler,
    shortcut: "1",
    cursor: "crosshair",
    help: `Measuring distance: click to add points, ${MEASURE_HELP_TAIL}`,
    steps: ["Click the start point.", "Click each corner along the path.", "Double-click or press Enter to finish."],
    permission: Permission.USE_MEASURE_TOOLS,
    viewers: ["2d", "3d"],
  },
  measure_area: {
    id: "measure_area",
    label: "Area",
    icon: Square,
    shortcut: "2",
    cursor: "crosshair",
    help: `Measuring area: click each corner, ${MEASURE_HELP_TAIL}`,
    steps: [
      "Click each corner of the shape (at least 3).",
      "Double-click or press Enter to close it.",
      "Plan area (flat, comparable to the map) is shown first; in 3D the sloped surface area is shown too.",
    ],
    permission: Permission.USE_MEASURE_TOOLS,
    viewers: ["2d", "3d"],
  },
  measure_perimeter: {
    id: "measure_perimeter",
    label: "Perimeter",
    icon: Hexagon,
    shortcut: "3",
    cursor: "crosshair",
    help: `Measuring perimeter: click each corner, ${MEASURE_HELP_TAIL}`,
    steps: ["Click each corner of the outline.", "Double-click or press Enter — the outline is closed for you."],
    permission: Permission.USE_MEASURE_TOOLS,
    viewers: ["2d", "3d"],
  },
  measure_height: {
    id: "measure_height",
    label: "Height",
    icon: MoveVertical,
    shortcut: "4",
    cursor: "crosshair",
    help: "Measuring height: click the base, then the top. Esc to cancel.",
    steps: ["Click the base (e.g. the ground at a wall).", "Click the top (e.g. the roof edge).", "The vertical difference is shown."],
    permission: Permission.USE_MEASURE_TOOLS,
    viewers: ["3d"],
  },
  annotate: {
    id: "annotate",
    label: "Note",
    icon: MessageSquare,
    shortcut: "n",
    cursor: "copy",
    help: "Adding a note: click where the note belongs, then type it. Esc to cancel.",
    steps: ["Click a spot on the map or model.", "Pick an icon, type a title, save."],
    permission: Permission.SAVE_SITE_FEATURES,
    viewers: ["2d", "3d"],
  },
  pin: {
    id: "pin",
    label: "Pin building",
    icon: MapPin,
    shortcut: "p",
    cursor: "crosshair",
    help: "Pinning a building: click the building on the model. Esc to cancel.",
    steps: ["Choose a building in the buildings list.", "Click it on the model to pin it."],
    permission: Permission.SAVE_SITE_FEATURES,
    viewers: ["3d"],
  },
  export: {
    id: "export",
    label: "Export CSV",
    icon: FileDown,
    shortcut: null,
    cursor: "default",
    help: "Download every saved measurement and note as a CSV file.",
    steps: ["Open the measurements list.", "Choose Export CSV."],
    permission: Permission.EXPORT_VIEWER_DATA,
    viewers: ["2d", "3d"],
  },
  set_location: {
    id: "set_location",
    label: "Set school location",
    icon: MapPinned,
    shortcut: null,
    cursor: "crosshair",
    help: "Setting the school location: drag the pin or click the map, then Save. Esc to cancel.",
    steps: ["Drag the pin to the school's main gate or centre.", "Choose Save."],
    permission: Permission.EDIT_SCHOOL_LOCATION,
    viewers: ["2d"],
  },
  overlays: {
    id: "overlays",
    label: "Overlays",
    icon: Layers,
    shortcut: null,
    cursor: "default",
    help: "Add or remove map overlays.",
    steps: ["Open the layers panel.", "Upload or remove an overlay."],
    permission: Permission.EDIT_SITE_ANNOTATIONS,
    viewers: ["2d"],
  },
};

export const MEASURE_TOOL_IDS = [
  "measure_distance",
  "measure_area",
  "measure_perimeter",
  "measure_height",
] as const;
export type MeasureToolId = (typeof MEASURE_TOOL_IDS)[number];

export function isMeasureTool(id: string | null | undefined): id is MeasureToolId {
  return !!id && (MEASURE_TOOL_IDS as readonly string[]).includes(id);
}

/** Tools for one viewer the user may use — the rest are hidden, not disabled. */
export function toolsFor(
  viewer: ViewerKind,
  hasPermission: (p: PermissionType) => boolean,
  ids: ViewerToolId[] = Object.keys(VIEWER_TOOLS) as ViewerToolId[],
): ViewerToolDef[] {
  return ids
    .map((id) => VIEWER_TOOLS[id])
    .filter((t) => t.viewers.includes(viewer) && (!t.permission || hasPermission(t.permission)));
}

export function canUseTool(id: ViewerToolId, hasPermission: (p: PermissionType) => boolean): boolean {
  const t = VIEWER_TOOLS[id];
  return !t.permission || hasPermission(t.permission);
}

/** Shortcut hint for tooltips, e.g. "Distance (1)". */
export function toolTitle(t: ViewerToolDef): string {
  return t.shortcut ? `${t.label} (${t.shortcut.toUpperCase()})` : t.label;
}

/** Interactions shared by both viewers, for the help modal and banners. */
export const COMMON_SHORTCUTS: { keys: string[]; desc: string }[] = [
  { keys: ["Click"], desc: "Add a point" },
  { keys: ["Double-click", "Enter"], desc: "Finish the measurement" },
  { keys: ["Backspace", "Ctrl+Z"], desc: "Undo the last point" },
  { keys: ["Esc"], desc: "Cancel the current tool" },
];

/** Key → tool for a keydown, ignoring typing in inputs and modifier chords. */
export function toolForKey(e: KeyboardEvent, viewer: ViewerKind): ViewerToolId | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  const el = e.target as HTMLElement | null;
  if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) {
    return null;
  }
  const k = e.key.toLowerCase();
  const hit = (Object.values(VIEWER_TOOLS) as ViewerToolDef[]).find(
    (t) => t.shortcut === k && t.viewers.includes(viewer),
  );
  return hit?.id ?? null;
}

export function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
}

// ── Accuracy (WS6.5) ────────────────────────────────────────────────────────

/**
 * Stated accuracy per viewer. PROVISIONAL: placeholders until the WS6 field
 * test (docs/MEASUREMENT_PRECISION_REPORT.md) replaces them with measured RMSE.
 */
export const MEASUREMENT_ACCURACY: Record<MeasureSource, { meters: number; provisional: boolean; note: string }> = {
  "2d": { meters: 0.5, provisional: true, note: "TBC — WS6 field test" },
  "3d": { meters: 0.1, provisional: true, note: "TBC — WS6 field test" },
};

/** "±0.5 m (provisional)" */
export function accuracyLabel(source: MeasureSource): string {
  const a = MEASUREMENT_ACCURACY[source];
  return `±${a.meters.toFixed(source === "3d" ? 2 : 1)} m${a.provisional ? " (provisional)" : ""}`;
}

// ── Units ───────────────────────────────────────────────────────────────────

/** "m" = metric with automatic km / ha (format.ts). */
export type DisplayUnit = "m" | "km" | "ft";
export const DISPLAY_UNITS: { id: DisplayUnit; label: string }[] = [
  { id: "m", label: "Metres (m)" },
  { id: "km", label: "Kilometres (km)" },
  { id: "ft", label: "Feet (ft)" },
];

const FT_PER_M = 3.28084;
const fmt = (v: number, d: number) =>
  new Intl.NumberFormat("en-RW", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);

/**
 * Length in the chosen unit, never finer than the source supports
 * (2D 0.1 m, 3D 0.01 m): ft uses 0 / 1 decimals (0.3 m / 3 cm), km 3 (1 m).
 */
export function formatMeasureLength(meters: number, source: MeasureSource, unit: DisplayUnit = "m"): string {
  if (!Number.isFinite(meters)) return "—";
  if (unit === "km") return `${fmt(meters / 1000, 3)} km`;
  if (unit === "ft") return `${fmt(meters * FT_PER_M, source === "3d" ? 1 : 0)} ft`;
  return formatLength(meters, source);
}

export function formatMeasureArea(sqMeters: number, source: MeasureSource, unit: DisplayUnit = "m"): string {
  if (!Number.isFinite(sqMeters)) return "—";
  if (unit === "km") return `${fmt(sqMeters / 1e6, 4)} km²`;
  if (unit === "ft") return `${fmt(sqMeters * FT_PER_M * FT_PER_M, 0)} ft²`;
  return formatArea(sqMeters, source);
}

const unitKey = (userId: string | null | undefined) => `rtb_viewer_unit_v1:${userId || "anon"}`;

export function loadDisplayUnit(userId: string | null | undefined): DisplayUnit {
  try {
    const v = localStorage.getItem(unitKey(userId));
    if (v === "m" || v === "km" || v === "ft") return v;
  } catch {
    /* storage unavailable */
  }
  return "m";
}

export function saveDisplayUnit(userId: string | null | undefined, unit: DisplayUnit): void {
  try {
    localStorage.setItem(unitKey(userId), unit);
  } catch {
    /* storage unavailable */
  }
}

// ── Cross-viewer selection sync (WS5.6) ────────────────────────────────────

export interface ViewerSelectionMessage {
  schoolId: string;
  buildingId: string | null;
  from: ViewerKind;
}

const CHANNEL = "rtb-viewer-selection";

/** Broadcast a building selection to other open viewer tabs (same browser). */
export function broadcastSelection(msg: ViewerSelectionMessage): void {
  try {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(CHANNEL);
    ch.postMessage(msg);
    ch.close();
  } catch {
    /* unsupported */
  }
}

/** Subscribe to selections from the other viewer. Returns an unsubscribe. */
export function onSelection(
  schoolId: string,
  self: ViewerKind,
  cb: (buildingId: string | null) => void,
): () => void {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const ch = new BroadcastChannel(CHANNEL);
  ch.onmessage = (ev: MessageEvent<ViewerSelectionMessage>) => {
    const m = ev.data;
    if (m && m.schoolId === schoolId && m.from !== self) cb(m.buildingId);
  };
  return () => ch.close();
}

/** Deep links into the school viewer (2D map or 3D tab), carrying the selected building. */
export function viewerLink(
  target: ViewerKind,
  schoolId: string,
  opts: {
    buildingId?: string | null;
    lat?: number | null;
    lng?: number | null;
    schoolName?: string;
    /** 2D map only: open the building panel on this tab. */
    tab?: BuildingPanelTab;
    /** 2D map only: open this report in the building panel. */
    reportId?: string | null;
  } = {},
): string {
  const p = new URLSearchParams();
  if (opts.buildingId) p.set("building", opts.buildingId);
  if (opts.lat != null && Number.isFinite(opts.lat)) p.set("lat", String(opts.lat));
  if (opts.lng != null && Number.isFinite(opts.lng)) p.set("lng", String(opts.lng));
  // 3D opens the school viewer on its 3D tab (same browser tab), with the
  // building selected there.
  if (target === "3d") {
    p.set("view", "3d");
    return `/schools/${schoolId}/3dview?${p.toString()}`;
  }
  p.set("view", "map");
  if (opts.tab) p.set("tab", opts.tab);
  if (opts.reportId) p.set("report", opts.reportId);
  return `/schools/${schoolId}/3dview?${p.toString()}`;
}

/** Tabs of the building panel on the 2D map. */
export type BuildingPanelTab = "details" | "media" | "reporting";

export interface ViewerDeepLink {
  buildingId: string | null;
  lat: number | null;
  lng: number | null;
  view: string | null;
  tab: BuildingPanelTab | null;
  reportId: string | null;
}

export function readViewerDeepLink(search: string): ViewerDeepLink {
  const p = new URLSearchParams(search);
  const num = (k: string) => {
    const raw = p.get(k);
    if (raw == null || raw === "") return null;
    const v = Number(raw);
    return Number.isFinite(v) ? v : null;
  };
  return {
    // `buildingId` is the older parameter name — still honoured.
    buildingId: p.get("building") || p.get("buildingId"),
    lat: num("lat"),
    lng: num("lng"),
    view: p.get("view"),
    tab: (["details", "media", "reporting"] as const).find((t) => t === p.get("tab")) ?? (p.get("report") ? "reporting" : null),
    reportId: p.get("report"),
  };
}
