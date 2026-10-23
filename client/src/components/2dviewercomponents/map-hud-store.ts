import { useSyncExternalStore } from "react";

/**
 * Fast-changing map state — the cursor position and how much imagery is
 * still loading — kept OUT of School2DViewer's React state. Writing it there
 * re-rendered the whole 2,000-line viewer on every mouse move and every image
 * decode. Only the small HUD pieces subscribe, and notifications are batched
 * to one per animation frame.
 */
export interface MapHudState {
  lat: number;
  lng: number;
  /** Map tiles of the site map are still being fetched. */
  tilesLoading: boolean;
  /** Images being downloaded/decoded right now. */
  decoding: number;
}

export interface MapHudStore {
  get: () => MapHudState;
  subscribe: (fn: () => void) => () => void;
  setPointer: (lat: number, lng: number) => void;
  setTilesLoading: (v: boolean) => void;
  setDecoding: (n: number) => void;
}

const raf: (cb: () => void) => unknown =
  typeof requestAnimationFrame === "function" ? requestAnimationFrame : (cb) => setTimeout(cb, 16);

export function createMapHudStore(initial: Pick<MapHudState, "lat" | "lng">): MapHudStore {
  let state: MapHudState = { ...initial, tilesLoading: false, decoding: 0 };
  const listeners = new Set<() => void>();
  let scheduled = false;

  const notify = () => {
    if (scheduled) return;
    scheduled = true;
    raf(() => {
      scheduled = false;
      listeners.forEach((l) => l());
    });
  };
  const patch = (next: Partial<MapHudState>) => {
    let changed = false;
    for (const k of Object.keys(next) as (keyof MapHudState)[]) {
      if (state[k] !== next[k]) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    state = { ...state, ...next };
    notify();
  };

  return {
    get: () => state,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    setPointer: (lat, lng) => patch({ lat, lng }),
    setTilesLoading: (v) => patch({ tilesLoading: v }),
    setDecoding: (n) => patch({ decoding: Math.max(0, n) }),
  };
}

/** Subscribe to one value of the store (re-renders only when it changes). */
export function useMapHud<T>(store: MapHudStore, select: (s: MapHudState) => T): T {
  return useSyncExternalStore(store.subscribe, () => select(store.get()), () => select(store.get()));
}
