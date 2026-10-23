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

interface ManifestBundle {
  kmlText: string;
  overlays: GroundOverlayData[];
  pyramid: SiteMapPyramid | null;
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
  return { kmlText, overlays, pyramid };
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
      const pyramid = pyramidRef.current;
      if (overlays.length === 0 && !pyramid) return null;

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

      if (pyramid && minX === Infinity) [minX, minY, maxX, maxY] = pyramid.extent;
      const globalExtent: [number, number, number, number] = [minX, minY, maxX, maxY];

      // 0. The server-built pyramid of all drone photos: only on-screen tiles
      //    are fetched, already sized for the zoom. Replaces the in-browser
      //    compositor below for those photos.
      if (pyramid) {
        const source = new XYZ({
          url: pyramid.url,
          tileGrid: pyramidTileGrid(pyramid),
          projection: "EPSG:3857",
          crossOrigin: "anonymous",
          interpolate: true,
          transition: 200,
        });
        let pending = 0;
        const track = (d: number) => {
          pending = Math.max(0, pending + d);
          setIsTileLoading(pending > 0);
        };
        source.on("tileloadstart", () => track(1));
        source.on("tileloadend", () => track(-1));
        source.on("tileloaderror", () => track(-1));
        // A plain canvas tile layer: lighter than WebGL for photo tiles (no
        // extra GL context). The "image look" sliders become a canvas filter.
        const lyr = new TileLayer({
          source,
          extent: pyramid.extent,
          zIndex: 5,
          opacity: kmzOpacity,
          preload: 1,
        });
        lyr.on("prerender", (e) => {
          const ctx = e.context as CanvasRenderingContext2D | undefined;
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
      }

      type BoundTuple = { ov: GroundOverlayData; ext: [number, number, number, number] };
      // Photos already in the pyramid are not composited again here.
      const standardBounds: BoundTuple[] = pyramid
        ? []
        : overlayBounds.filter(({ ov }) => !ov.isTiled && !ov.imageUrl.toLowerCase().match(/\.tiff?$/i));
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

      setIsTileLoading(true);

      const source = new DataTile({
        tileGrid,
        tileSize: 256,
        interpolate: true,
        loader: async (z, x, y) => {
          if (!tileGrid) return new OffscreenCanvas(256, 256).transferToImageBitmap();
          const te = (tileGrid as any).getTileCoordExtent([z, x, y]);
          if (!te) return new OffscreenCanvas(256, 256).transferToImageBitmap();
          
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
            const pixW = (extWd / resolution) * 256;
            return pixW >= minPixW;
          });

          if (visibleBounds.length === 0) {
            return new OffscreenCanvas(256, 256).transferToImageBitmap();
          }

          const canv = new OffscreenCanvas(256, 256);
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
            
            const dstX = ((ixW - tW) / tileWd) * 256;
            const dstY = ((tN - ixN) / tileHt) * 256;
            const dstW = ((ixE - ixW) / tileWd) * 256;
            const dstH = ((ixN - ixS) / tileHt) * 256;
            
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
        zIndex: 5, 
        opacity: kmzOpacity, 
        extent: globalExtent 
      });
      
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
