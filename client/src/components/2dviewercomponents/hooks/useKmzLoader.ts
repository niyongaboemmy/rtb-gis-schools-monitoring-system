import { useEffect, useRef } from "react";
import OLMap from "ol/Map";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import KML from "ol/format/KML";
import DataTile from "ol/source/DataTile";
import TileLayer from "ol/layer/Tile";
import WebGLTileLayer from "ol/layer/WebGLTile";
import GeoTIFFSource from "ol/source/GeoTIFF";
import XYZ from "ol/source/XYZ";
import { unByKey } from "ol/Observable";
import type { EventsKey } from "ol/events";
import TileGrid from "ol/tilegrid/TileGrid";
import { transformExtent } from "ol/proj";
import { createXYZ } from "ol/tilegrid";
import { getIntersection, isEmpty as isExtentEmpty } from "ol/extent";
import Feature from "ol/Feature";

import {
  kmlStyle,
  getFeatureName,
} from "../MapUtils";
import type { GroundOverlayData } from "../MapUtils";
import { api, FILE_SERVER_URL } from "../../../lib/api";

// Resolve a /files/... relative path to the full file server URL
const resolveFileUrl = (url: string): string => {
  if (!url) return url;
  if (url.startsWith("http") || url.startsWith("blob:")) return url;
  const clean = url.replace(/^\/?files\//i, "");
  return `${FILE_SERVER_URL}/${clean}`;
};

/** The site map's tile pyramid built by the server (overlay-pyramid.ts). */
export interface SiteMapPyramid {
  status: "ready";
  url: string;
  maxZoom: number;
  /** Metres per pixel at maxZoom (EPSG:3857). */
  resolution: number;
  /** Top-left of the tile grid, EPSG:3857. */
  origin: [number, number];
  extent: [number, number, number, number];
}

/** The site map's full-detail tiles (server overlay-tiles.ts): standard XYZ grid. */
export interface SiteMapTiles {
  status: "ready";
  url: string;
  minZoom: number;
  maxZoom: number;
  /** The drone photos' own detail (ground cm per pixel). */
  sourceCmPerPx?: number;
  /** EPSG:3857 */
  extent: [number, number, number, number];
}

interface ManifestBundle {
  kmlText: string;
  overlays: GroundOverlayData[];
  pyramid: SiteMapPyramid | null;
  tiles: SiteMapTiles | null;
}

/** Manifest + site-map KML, fetched together (in parallel with map setup). */
async function fetchManifestBundle(schoolId: string, signal?: AbortSignal): Promise<ManifestBundle | null> {
  const res = await api.get(`/schools/${schoolId}/kmz/2d/manifest`, { signal });
  const m = res.data?.manifest;
  if (!m?.kmlUrls?.length) return null;
  const kmlText = await (await fetch(resolveFileUrl(m.kmlUrls[0]), { signal })).text();
  const overlays = (m.groundOverlays || []).map((ov: GroundOverlayData) => ({ ...ov, imageUrl: resolveFileUrl(ov.imageUrl) }));
  const p = m.pyramid;
  const pyramid: SiteMapPyramid | null =
    p?.status === "ready" && p.url && Number.isFinite(p.resolution) && Array.isArray(p.origin)
      ? { ...p, url: resolveFileUrl(p.url) }
      : null;
  const t = m.tiles;
  const tiles: SiteMapTiles | null =
    t?.status === "ready" && t.url && Number.isFinite(t.maxZoom) && Number.isFinite(t.minZoom) && Array.isArray(t.extent)
      ? { ...t, url: resolveFileUrl(t.url) }
      : null;
  return { kmlText, overlays, pyramid, tiles };
}

/**
 * Grid for the full-detail tiles (standard XYZ, 256 px files). On a 2x screen
 * it is declared with 128 px tiles: OpenLayers then asks for the next level
 * down and draws each 256 px file into 128 CSS px — one file pixel per screen
 * pixel, instead of stretching (it picks levels from CSS pixels).
 */
export function siteTilesGrid(maxZoom: number, pixelRatio: number) {
  return createXYZ({ maxZoom, tileSize: pixelRatio > 1 ? 128 : 256 });
}

/** Levels drawn past the deepest tiles, by enlarging them here (see enlargeTile). */
export const OVERZOOM_LEVELS = 2;

/**
 * For a tile deeper than the deepest file level: the file tile it lies in and
 * the square of it (in its 256 px) to enlarge. Null for a real file tile.
 */
export function overzoomSource(z: number, x: number, y: number, maxZoom: number) {
  if (z <= maxZoom) return null;
  const dz = z - maxZoom;
  const n = 2 ** dz;
  const size = 256 / n;
  return { z: maxZoom, x: Math.floor(x / n), y: Math.floor(y / n), sx: (x % n) * size, sy: (y % n) * size, size };
}

/**
 * Unsharp mask (3 × 3 box blur, `amount` of the difference added back): keeps
 * edges crisp when a tile is enlarged. Cosmetic only — no detail is added.
 */
export function unsharp(data: Uint8ClampedArray, w: number, h: number, amount = 0.6) {
  const src = new Uint8ClampedArray(data);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++)
      for (let c = 0; c < 3; c++) {
        const i = (y * w + x) * 4 + c;
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sum += src[i + (dy * w + dx) * 4];
        data[i] = src[i] + amount * (src[i] - sum / 9);
      }
  return data;
}

/** Decoded file tiles reused by their enlarged children (≤ 16 per tile at 2 levels). */
const enlargeCache = new Map<string, Promise<ImageBitmap | null>>();

/** The deeper-than-files tile `src` describes (`<file url>#oz`), enlarged with the browser's best resampling. */
async function enlargeTile(fileUrl: string, crop: { sx: number; sy: number; size: number }): Promise<HTMLCanvasElement | null> {
  let base = enlargeCache.get(fileUrl);
  if (!base) {
    base = fetch(fileUrl)
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => (b ? createImageBitmap(b) : null))
      .catch(() => null);
    enlargeCache.set(fileUrl, base);
    if (enlargeCache.size > 64) enlargeCache.delete(enlargeCache.keys().next().value as string);
  }
  const bmp = await base;
  if (!bmp) return null;
  const big = await createImageBitmap(bmp, crop.sx, crop.sy, crop.size, crop.size, { resizeWidth: 256, resizeHeight: 256, resizeQuality: "high" });
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(big, 0, 0);
  big.close();
  const img = ctx.getImageData(0, 0, 256, 256);
  unsharp(img.data, 256, 256);
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/**
 * Is the view zoomed in past the photos' own detail? One screen pixel
 * (device pixels, so retina counts) then covers less ground than one photo
 * pixel: zooming further only enlarges pixels. 10% slack against flicker.
 */
export function isPastFullDetail(o: {
  viewResolution: number;
  pixelRatio: number;
  sourceCmPerPx: number;
  centerY: number;
}): boolean {
  const lat = Math.atan(Math.sinh(o.centerY / 6378137));
  const screenCm = (o.viewResolution / o.pixelRatio) * Math.cos(lat) * 100;
  return screenCm < o.sourceCmPerPx * 0.9;
}

/** View zoom from which the full-detail tiles cover the site (one less on 2x screens). */
export const siteTilesMinViewZoom = (minZoom: number, pixelRatio: number) => minZoom - (pixelRatio > 1 ? 1 : 0);

/**
 * Photos worth loading over the pyramid when zoomed in: only those that can
 * be finer than it (a photo up to 1024 px across `pyramidRes`-sized pixels),
 * coarse first so the sharpest are drawn on top.
 */
export function detailPhotos<T extends { ext: number[] }>(photos: T[], pyramidRes: number, maxPhotoPx = 1024): T[] {
  const area = (e: number[]) => (e[2] - e[0]) * (e[3] - e[1]);
  return photos.filter(({ ext }) => ext[2] - ext[0] <= pyramidRes * maxPhotoPx).sort((a, b) => area(b.ext) - area(a.ext));
}

/** Tile grid matching libvips' "google" layout: image pinned top-left of a 256·2^maxZoom square. */
export function pyramidTileGrid(p: Pick<SiteMapPyramid, "maxZoom" | "resolution" | "origin">): TileGrid {
  const resolutions = Array.from({ length: p.maxZoom + 1 }, (_, z) => p.resolution * 2 ** (p.maxZoom - z));
  const side = 256 * resolutions[0];
  const [ox, oy] = p.origin;
  return new TileGrid({ origin: [ox, oy], resolutions, tileSize: 256, extent: [ox, oy - side, ox + side, oy] });
}

/**
 * WebGL tile style with the "image look" sliders. The values must be declared
 * under `variables` (passing them as layer properties threw "Missing variables
 * in style" and the layer never drew). 1 = unchanged on the sliders, 0 here.
 */
const imageStyle = (v: { brightness: number; contrast: number; saturation: number }) => ({
  variables: { brightness: v.brightness - 1, contrast: v.contrast - 1, saturation: v.saturation - 1 },
  brightness: ["var", "brightness"],
  contrast: ["var", "contrast"],
  saturation: ["var", "saturation"],
});

interface UseKmzLoaderProps {
  mapRef: React.MutableRefObject<OLMap | null>;
  mapReady: boolean;
  kmzUrl?: string;
  tifUrl?: string;
  schoolId: string;
  kmzOpacity: number;
  visuals: { brightness: number; contrast: number; saturation: number };
  setIsLoading: (loading: boolean) => void;
  setLoadingMessage: (msg: string) => void;
  setLoadingProgress: (prog: number) => void;
  setIsTileLoading: (loading: boolean) => void;
  setDecodingCount: (count: number) => void;
  /** Zoomed past the photos' own detail (for the "Full detail" hint). */
  setPastFullDetail?: (past: boolean) => void;
  setFeatures: (features: any[]) => void;
  kmlLayerRef: React.MutableRefObject<VectorLayer | null>;
  groundOverlayLayersRef: React.MutableRefObject<any[]>;
  overlayExtentRef: React.MutableRefObject<[number, number, number, number] | null>;
}

export function useKmzLoader({
  mapRef,
  mapReady,
  kmzUrl,
  tifUrl,
  schoolId,
  kmzOpacity,
  visuals,
  setIsLoading,
  setLoadingMessage,
  setLoadingProgress,
  setIsTileLoading,
  setDecodingCount,
  setPastFullDetail,
  setFeatures,
  kmlLayerRef,
  groundOverlayLayersRef,
  overlayExtentRef,
}: UseKmzLoaderProps) {
  const bitmapsRef = useRef<Map<string, ImageBitmap>>(new Map());
  const thumbsRef = useRef<Map<string, ImageBitmap>>(new Map());
  const pendingDecodesRef = useRef<Map<string, Promise<void>>>(new Map());
  const kmlTextRef = useRef<string | null>(null);
  const finalOverlaysRef = useRef<GroundOverlayData[]>([]);
  const loadedKmzRef = useRef<string | null>(null);
  const lastSchoolIdRef = useRef<string | null>(null);
  const cleanupKmzRef = useRef<(() => void) | null>(null);
  const pyramidRef = useRef<SiteMapPyramid | null>(null);
  const tilesRef = useRef<SiteMapTiles | null>(null);
  const detailListenerRef = useRef<EventsKey[] | null>(null);
  const visualsRef = useRef(visuals);
  const prefetchRef = useRef<{ key: string; promise: Promise<ManifestBundle | null> } | null>(null);

  // Start the manifest + KML download as soon as the viewer mounts, not
  // after the map is ready (they used to load one after the other, last).
  useEffect(() => {
    if (!kmzUrl || !schoolId) return;
    const key = `${schoolId}|${kmzUrl}`;
    if (prefetchRef.current?.key === key) return;
    const promise = fetchManifestBundle(schoolId).catch(() => null);
    prefetchRef.current = { key, promise };
  }, [kmzUrl, schoolId]);

  useEffect(() => {
    // Wait until the map has been initialized
    const map = mapRef.current;
    if (!map || !mapReady) return;

    let ignore = false;
    const abortController = new AbortController();

    const loadGroundOverlays = async (overlays: GroundOverlayData[], assetBlobs?: Map<string, Blob>) => {
      groundOverlayLayersRef.current.forEach((l) => map.removeLayer(l));
      groundOverlayLayersRef.current = [];
      if (detailListenerRef.current) unByKey(detailListenerRef.current);
      detailListenerRef.current = null;
      setPastFullDetail?.(false);
      const pyramid = pyramidRef.current;
      const tiles = tilesRef.current;
      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      if (overlays.length === 0 && !pyramid && !tiles) return null;

      const sorted = [...overlays].sort((a, b) => a.drawOrder - b.drawOrder);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      
      const overlayBounds = sorted.map((ov) => {
        const ext = transformExtent([ov.west, ov.south, ov.east, ov.north], "EPSG:4326", "EPSG:3857") as [number, number, number, number];
        if (ext[0] < minX) minX = ext[0];
        if (ext[1] < minY) minY = ext[1];
        if (ext[2] > maxX) maxX = ext[2];
        if (ext[3] > maxY) maxY = ext[3];
        return { ov, ext };
      });

      if (minX === Infinity && (tiles || pyramid)) [minX, minY, maxX, maxY] = (tiles ?? pyramid)!.extent;
      const globalExtent: [number, number, number, number] = [minX, minY, maxX, maxY];

      /** A plain canvas tile layer for server-built photo tiles: loading
       *  indicator + the "image look" sliders as a canvas filter (lighter than
       *  WebGL for photos: no extra GL context). */
      const addPhotoTiles = (source: XYZ, opts: { extent: number[]; zIndex: number; minZoom?: number; maxZoom?: number }) => {
        let pending = 0;
        const track = (d: number) => {
          pending = Math.max(0, pending + d);
          setIsTileLoading(pending > 0);
        };
        source.on("tileloadstart", () => track(1));
        source.on("tileloadend", () => track(-1));
        source.on("tileloaderror", () => track(-1));
        const lyr = new TileLayer({ source, opacity: kmzOpacity, preload: 1, ...opts });
        lyr.on("prerender", (e) => {
          const ctx = e.context as CanvasRenderingContext2D | undefined;
          // Past the deepest tiles OpenLayers enlarges them: use the
          // browser's best resampling rather than plain bilinear.
          if (ctx) ctx.imageSmoothingQuality = "high";
          const v = visualsRef.current;
          if (ctx && (v.brightness !== 1 || v.contrast !== 1 || v.saturation !== 1)) {
            ctx.filter = `brightness(${v.brightness}) contrast(${v.contrast}) saturate(${v.saturation})`;
          }
        });
        lyr.on("postrender", (e) => {
          const ctx = e.context as CanvasRenderingContext2D | undefined;
          if (ctx) ctx.filter = "none";
        });
        map.addLayer(lyr);
        groundOverlayLayersRef.current.push(lyr);
      };
      const tilesFrom = tiles ? siteTilesMinViewZoom(tiles.minZoom, dpr) : null;

      // 0a. Full-detail tiles at the drone photos' own resolution (server
      //     overlay-tiles.ts): only the tiles on screen, any zoom. Missing
      //     deep tiles fall back to the level above (OpenLayers interim tiles).
      if (tiles) {
        const fileUrl = (z: number, x: number, y: number) =>
          tiles.url.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
        addPhotoTiles(
          new XYZ({
            // Two levels past the deepest files are drawn here by enlarging
            // them (sharper than the map's own bilinear stretch).
            tileGrid: siteTilesGrid(tiles.maxZoom + OVERZOOM_LEVELS, dpr),
            tileUrlFunction: ([z, x, y]) => {
              const o = overzoomSource(z, x, y, tiles.maxZoom);
              return o ? `${fileUrl(o.z, o.x, o.y)}#oz=${o.sx},${o.sy},${o.size}` : fileUrl(z, x, y);
            },
            tileLoadFunction: (tile, src) => {
              const m = /#oz=(\d+(?:\.\d+)?),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)$/.exec(src);
              const imageTile = tile as unknown as { getImage: () => HTMLImageElement; setImage: (c: HTMLCanvasElement) => void; setState: (s: number) => void };
              if (!m) {
                imageTile.getImage().src = src;
                return;
              }
              void enlargeTile(src.slice(0, src.indexOf("#oz=")), { sx: +m[1], sy: +m[2], size: +m[3] }).then((canvas) => {
                if (canvas) imageTile.setImage(canvas);
                else imageTile.setState(3); // TileState.ERROR: keep the level above
              });
            },
            projection: "EPSG:3857",
            crossOrigin: "anonymous",
            interpolate: true,
            transition: 200,
            zDirection: -1,
          }),
          { extent: tiles.extent, zIndex: 6, minZoom: tilesFrom! - 0.001 },
        );
        // "Full detail" hint: zoomed past what the photos hold.
        const sourceCm = Number(tiles.sourceCmPerPx);
        if (setPastFullDetail && Number.isFinite(sourceCm) && sourceCm > 0) {
          const view = map.getView();
          const check = () => {
            const res = view.getResolution();
            const c = view.getCenter();
            const inside = !!c && c[0] >= tiles.extent[0] && c[0] <= tiles.extent[2] && c[1] >= tiles.extent[1] && c[1] <= tiles.extent[3];
            setPastFullDetail(
              !!res && !!c && inside && isPastFullDetail({ viewResolution: res, pixelRatio: dpr, sourceCmPerPx: sourceCm, centerY: c[1] }),
            );
          };
          detailListenerRef.current = view.on(["change:resolution", "change:center"], check);
          check();
        }
      }

      // 0b. The overview pyramid of all drone photos (8192 px): only below the
      //     full-detail tiles when those exist; otherwise everywhere, with the
      //     original photos added as a detail layer when zoomed in (below).
      if (pyramid) {
        addPhotoTiles(
          new XYZ({
            url: pyramid.url,
            tileGrid: pyramidTileGrid(pyramid),
            projection: "EPSG:3857",
            crossOrigin: "anonymous",
            interpolate: true,
            transition: 200,
          }),
          { extent: pyramid.extent, zIndex: 5, ...(tilesFrom != null ? { maxZoom: tilesFrom } : {}) },
        );
      }

      type BoundTuple = { ov: GroundOverlayData; ext: [number, number, number, number] };
      const photoBounds = overlayBounds.filter(({ ov }) => !ov.isTiled && !ov.imageUrl.toLowerCase().match(/\.tiff?$/i));
      // With a pyramid, the original photos come back only as a DETAIL layer
      // for zooms past the pyramid's resolution (its 8192 px canvas holds
      // 4–8× less detail than the drone photos).
      // With full-detail tiles, nothing is stitched in the browser.
      const standardBounds: BoundTuple[] = tiles
        ? []
        : pyramid
          ? detailPhotos(photoBounds, pyramid.resolution)
          : photoBounds;
      const tiledBounds: BoundTuple[] = overlayBounds.filter(({ ov }) => ov.isTiled);
      const tifBounds: BoundTuple[] = overlayBounds.filter(({ ov }) => !ov.isTiled && ov.imageUrl.toLowerCase().match(/\.tiff?$/i));

      // 1. Tiled GeoTIFF Overlays (WebGL)
      for (const { ov, ext } of tifBounds) {
        const lyr = new WebGLTileLayer({
          source: new GeoTIFFSource({ sources: [{ url: ov.imageUrl }] }),
          zIndex: 6,
          opacity: kmzOpacity,
          extent: ext,
        });
        map.addLayer(lyr);
        groundOverlayLayersRef.current.push(lyr);
      }

      // 2. Pre-processed WebGL XYZ Tile Hierarchies (WebGL)
      for (const { ov, ext } of tiledBounds) {
        // Large single images tiled by the server (libvips "google" layout:
        // {z}/{y}/{x}, image pinned top-left of a 256·2^maxZoom square).
        // Newer uploads carry the pixel size, giving an exact grid; older
        // ones asked for {z}/{x}/{y} (transposed) and are corrected here.
        const maxZ = ov.maxZoom || 6;
        const tg = ov.width
          ? pyramidTileGrid({ maxZoom: maxZ, resolution: (ext[2] - ext[0]) / ov.width, origin: [ext[0], ext[3]] })
          : pyramidTileGrid({ maxZoom: maxZ, resolution: (ext[2] - ext[0]) / (256 * 2 ** maxZ), origin: [ext[0], ext[3]] });
        const tiledUrl = ov.imageUrl.replace("{x}/{y}", "{y}/{x}");

        const lyr = new WebGLTileLayer({
          source: new XYZ({
            url: tiledUrl,
            tileGrid: tg,
            projection: "EPSG:3857",
            crossOrigin: "anonymous",
            interpolate: true
          }) as any,
          extent: ext,
          zIndex: 6,
          opacity: kmzOpacity,
          // One lower level under the sharp tiles is enough for a smooth zoom.
          preload: 1,
          style: imageStyle(visuals),
        });
        map.addLayer(lyr);
        groundOverlayLayersRef.current.push(lyr);
      }

      if (standardBounds.length === 0) return globalExtent;

      const bitmaps = bitmapsRef.current;
      const thumbs = thumbsRef.current;
      const pendingDecodes = pendingDecodesRef.current;
      const tileGrid = createXYZ({ maxZoom: 25, tileSize: 256 });
      
      let activeDecodes = 0;
      const decodeQueue: (() => void)[] = [];

      // The detail layer starts hidden (zoomed out); the pyramid reports loading.
      if (!pyramid) setIsTileLoading(true);

      // Draw tiles at the screen's real pixel density (OpenLayers picks the
      // level from CSS pixels, so 256 px tiles were stretched 2x on retina
      // screens), and always take the finer level between two zooms.
      const TILE_PX = (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1) > 1 ? 512 : 256;
      const source = new DataTile({
        tileGrid,
        tileSize: TILE_PX,
        zDirection: -1,
        interpolate: true,
        loader: async (z, x, y) => {
          if (!tileGrid) return new OffscreenCanvas(TILE_PX, TILE_PX).transferToImageBitmap();
          const te = (tileGrid as any).getTileCoordExtent([z, x, y]);
          if (!te) return new OffscreenCanvas(TILE_PX, TILE_PX).transferToImageBitmap();
          
          const resolution = te[2] - te[0];
          
          // Step 1: Find all strictly intersecting bounds for STANDARD layers only
          // Optimization: Pre-filter by extent if many overlays exist
          const intersectingBounds = standardBounds.filter(({ ext }) => {
            if (te[0] > ext[2] || te[2] < ext[0] || te[1] > ext[3] || te[3] < ext[1]) return false;
            const ix = getIntersection(te, ext);
            return ix && !isExtentEmpty(ix);
          });

          // Step 2: Dynamic Level Of Detail (LOD)
          let minPixW = 5;
          if (intersectingBounds.length > 300) minPixW = 128;
          else if (intersectingBounds.length > 100) minPixW = 64;
          else if (intersectingBounds.length > 30) minPixW = 32;

          const visibleBounds = intersectingBounds.filter(({ ext }) => {
            const extWd = ext[2] - ext[0];
            const pixW = (extWd / resolution) * TILE_PX;
            return pixW >= minPixW;
          });

          if (visibleBounds.length === 0) {
            return new OffscreenCanvas(TILE_PX, TILE_PX).transferToImageBitmap();
          }

          const canv = new OffscreenCanvas(TILE_PX, TILE_PX);
          const ctx = canv.getContext("2d")!;
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";

          // 2. Fetch required images concurrently (with zero-CPU semaphore throttling)
          const loadPromises = visibleBounds.map(async ({ ov }) => {
            let existing = bitmaps.get(ov.imageUrl);
            if (existing) return;
            
            let pending = pendingDecodes.get(ov.imageUrl);
            if (!pending) {
              pending = (async () => {
                if (activeDecodes >= 6) await new Promise<void>((r) => decodeQueue.push(r));
                if (ignore) return;
                
                activeDecodes++;
                setDecodingCount(activeDecodes);
                try {
                  const blob = assetBlobs?.get(ov.imageUrl) || await (await fetch(ov.imageUrl, { signal: abortController.signal })).blob();
                  if (ignore) return;
                  const bm = await createImageBitmap(blob);
                  bitmaps.set(ov.imageUrl, bm);
                  
                  if (bm.width > 2048 || bm.height > 2048) {
                    const scale = 1024 / Math.max(bm.width, bm.height);
                    const tbm = await createImageBitmap(bm, { resizeWidth: Math.round(bm.width * scale), resizeHeight: Math.round(bm.height * scale), resizeQuality: "high" });
                    thumbs.set(ov.imageUrl, tbm);
                  }
                } catch (e) {
                  console.error(`Failed to decode tile ${ov.imageUrl}`, e);
                } finally {
                  activeDecodes = Math.max(0, activeDecodes - 1);
                  setDecodingCount(activeDecodes);
                  if (decodeQueue.length > 0) decodeQueue.shift()!();
                }
              })();
              pendingDecodes.set(ov.imageUrl, pending);
            }
            await pending;
          });

          await Promise.all(loadPromises);

          // 3. Draw intersecting images onto tile canvas in drawing order
          for (const { ov, ext } of visibleBounds) {
            const existing = bitmaps.get(ov.imageUrl);
            if (!existing) continue;
            // Detail layer: a photo no sharper than the pyramid adds nothing.
            if (pyramid && (ext[2] - ext[0]) / existing.width >= pyramid.resolution * 0.95) continue;

            const thumb = thumbs.get(ov.imageUrl);
            const ix = getIntersection(te, ext);
            if (!ix || isExtentEmpty(ix)) continue;

            const [extW, extS, extE, extN] = ext;
            const extWd = extE - extW;
            const extHt = extN - extS;

            const [ixW, ixS, ixE, ixN] = ix;
            const [tW, tS, tE, tN] = te;
            const tileWd = tE - tW;
            const tileHt = tN - tS;
            
            const dstX = ((ixW - tW) / tileWd) * TILE_PX;
            const dstY = ((tN - ixN) / tileHt) * TILE_PX;
            const dstW = ((ixE - ixW) / tileWd) * TILE_PX;
            const dstH = ((ixN - ixS) / tileHt) * TILE_PX;
            
            const fullSrcW = ((ixE - ixW) / extWd) * existing.width;
            const chosenBm = (thumb && fullSrcW > dstW * 4) ? thumb : existing;
            
            const srcX = ((ixW - extW) / extWd) * chosenBm.width;
            const srcY = ((extN - ixN) / extHt) * chosenBm.height;
            const srcW = ((ixE - ixW) / extWd) * chosenBm.width;
            const srcH = ((ixN - ixS) / extHt) * chosenBm.height;
            
            ctx.drawImage(chosenBm, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH);
          }

          return canv.transferToImageBitmap();
        },
      });

      const mainLayer = new TileLayer({
        source,
        // Over the pyramid, and only once zoomed in past its detail — in
        // screen pixels (on a 2x screen the pyramid is stretched one level
        // earlier, so the photos take over one level earlier).
        zIndex: pyramid ? 6 : 5,
        opacity: kmzOpacity,
        extent: globalExtent,
        ...(pyramid ? { maxResolution: pyramid.resolution * (TILE_PX / 256) } : {}),
      });
      
      if (pyramid) {
        // Sharp photos load as you zoom in: show it in the loading indicator.
        let pending = 0;
        const track = (d: number) => {
          pending = Math.max(0, pending + d);
          setIsTileLoading(pending > 0);
        };
        source.on("tileloadstart", () => track(1));
        source.on("tileloadend", () => track(-1));
        source.on("tileloaderror", () => track(-1));
      }
      map.addLayer(mainLayer);
      groundOverlayLayersRef.current.push(mainLayer);

      map.once("rendercomplete", () => setIsTileLoading(false));

      return minX !== Infinity ? globalExtent : null;
    };

    const loadKml = async (kmlT: string, grounds?: GroundOverlayData[], blobs?: Map<string, Blob>) => {
      const kmlFormat = new KML({ extractStyles: false });
      let parsed: Feature[];
      try {
        parsed = kmlFormat.readFeatures(kmlT, { featureProjection: "EPSG:3857", dataProjection: "EPSG:4326" }) as Feature[];
      } catch {
        parsed = [];
      }
      const source = new VectorSource({ features: parsed });
      const layer = new VectorLayer({ source, style: kmlStyle, zIndex: 30 });
      if (kmlLayerRef.current) map.removeLayer(kmlLayerRef.current);
      map.addLayer(layer);
      kmlLayerRef.current = layer;

      const overlayExt = (grounds && grounds.length > 0) ? await loadGroundOverlays(grounds, blobs) : null;
      const sourceExt = source.getExtent();
      const hasArea = (e: [number, number, number, number] | null) =>
        !!e && e[0] !== Infinity && e[2] > e[0] && e[3] > e[1];
      const validSourceExt = hasArea(sourceExt as [number, number, number, number])
        ? (sourceExt as [number, number, number, number])
        : null;

      // Frame the view on where the KML is actually mapped (the school boundary
      // / buildings) so the school sits centred rather than off-screen when the
      // drone imagery covers a larger area. Fall back to the imagery extent when
      // the KML carries no polygons/lines (e.g. a single marker point).
      const fitExt = validSourceExt || overlayExt;

      // The viewer frames the school once everything is loaded (frame.ts);
      // zooming here too made the first view jump between two framings.
      if (fitExt) overlayExtentRef.current = fitExt;
      if (!ignore) {
        setFeatures(parsed.map((f) => ({ name: getFeatureName(f) || "Unnamed", feature: f })).filter((f) => f.name !== "Unnamed"));
        setIsLoading(false);
      }
    };

    const run = async () => {
      if (ignore) return;
      if (kmzUrl && schoolId) {
        try {
          if (schoolId === lastSchoolIdRef.current && kmzUrl === loadedKmzRef.current && kmlTextRef.current) {
            await loadKml(kmlTextRef.current, finalOverlaysRef.current, undefined);
            setIsLoading(false);
            return;
          }

          setLoadingProgress(5);
          
          // The manifest + KML were requested when the viewer mounted.
          setLoadingMessage("Loading the site map…");
          const key = `${schoolId}|${kmzUrl}`;
          const bundle = await (prefetchRef.current?.key === key
            ? prefetchRef.current.promise
            : fetchManifestBundle(schoolId, abortController.signal).catch(() => null));
          if (ignore) return;
          if (!bundle) {
            console.error("No manifest found! The backend must process the KMZ first. Please re-upload.");
            setLoadingMessage("Cannot load map. Please re-upload the map asset.");
            setIsLoading(false);
            return;
          }
          const overlays = bundle.overlays;
          const kmlText = bundle.kmlText;
          pyramidRef.current = bundle.pyramid;
          tilesRef.current = bundle.tiles;
          setLoadingProgress(50);
          cleanupKmzRef.current = null;

          kmlTextRef.current = kmlText;
          finalOverlaysRef.current = overlays;
          loadedKmzRef.current = kmzUrl;
          lastSchoolIdRef.current = schoolId;

          setLoadingProgress(90);
          await loadKml(kmlText, overlays, undefined);
          setLoadingProgress(100);
        } catch (err) {
          console.error("KML load failed", err);
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    };
    run();
    return () => {
      ignore = true;
      abortController.abort();
      if (detailListenerRef.current) unByKey(detailListenerRef.current);
      detailListenerRef.current = null;
    };
  // mapReady is the state trigger that fires once the map is mounted
  }, [mapReady, kmzUrl, tifUrl, schoolId]);

  useEffect(() => {
    visualsRef.current = visuals;
    groundOverlayLayersRef.current.forEach(layer => {
      layer.setOpacity(kmzOpacity);
      if (!(layer instanceof WebGLTileLayer)) layer.changed(); // canvas filter
      if (layer instanceof WebGLTileLayer) {
        (layer as any).updateStyleVariables({
          brightness: visuals.brightness - 1,
          contrast: visuals.contrast - 1,
          saturation: visuals.saturation - 1
        });
      }
    });
  }, [kmzOpacity, visuals]);

  return { kmlTextRef, finalOverlaysRef, cleanupKmzRef };
}
