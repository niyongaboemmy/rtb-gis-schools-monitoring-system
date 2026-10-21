import type { School } from "../../store/schoolsStore";
import type { LatLng } from "./geo";

/** A school with parsed coordinates (only schools that can be drawn). */
export interface PlottedSchool {
  school: School;
  lat: number;
  lng: number;
  /** Score as a number, null when not assessed. */
  score: number | null;
  priority: string;
}

export type SortKey = "priority" | "score-asc" | "score-desc" | "name";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "priority", label: "Priority first" },
  { value: "score-asc", label: "Lowest score" },
  { value: "score-desc", label: "Highest score" },
  { value: "name", label: "Name A–Z" },
];

export type OverlayId = "provinces" | "districts" | "labels" | "lake" | "focus" | "clusters" | "density";

export const DEFAULT_OVERLAYS: OverlayId[] = ["provinces", "districts", "labels", "lake", "focus"];

export const OVERLAY_META: Record<OverlayId, { label: string; hint: string }> = {
  provinces: { label: "Province boundaries", hint: "Hover and click a province" },
  districts: { label: "District boundaries", hint: "Shown when zoomed in; hover and click a district" },
  labels: { label: "Province names", hint: "Labels at each province centre" },
  lake: { label: "Lake Kivu", hint: "Highlights the western lake shore" },
  focus: { label: "Rwanda focus", hint: "Dims the neighbouring countries" },
  clusters: { label: "Group nearby schools", hint: "Clusters at low zoom" },
  density: { label: "School density", hint: "Soft glow where schools concentrate" },
};

export type ToolMode = "none" | "distance" | "area" | "nearest";

/** One-shot camera instruction from the page to the map. */
export type ViewRequest =
  | { kind: "fly"; center: LatLng; zoom: number; nonce: number; pad?: [number, number, number, number] }
  | { kind: "bounds"; bounds: [LatLng, LatLng]; maxZoom?: number; nonce: number }
  | { kind: "rwanda"; nonce: number }
  | { kind: "zoom"; delta: 1 | -1; nonce: number };

export interface ProvinceSummary {
  province: string;
  total: number;
  avgScore: number | null;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export type Breakpoint = "phone" | "tablet" | "desktop";

/** A view request before it gets its nonce (distributes over the union). */
export type ViewRequestInput = ViewRequest extends infer R ? (R extends ViewRequest ? Omit<R, "nonce"> : never) : never;
