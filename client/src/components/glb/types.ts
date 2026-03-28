export type ToolMode = "none" | "distance" | "area" | "annotate";

export interface Annotation {
  id: string;
  label: string;
  color: string;
  position: { x: number; y: number; z: number };
  createdAt: string;
}

export interface HomePosition {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
}

export const ANNOTATION_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#f97316",
];
