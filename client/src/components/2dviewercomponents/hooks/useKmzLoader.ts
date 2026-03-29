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
import { api } from "../../../lib/api";

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

  useEffect(() => {
    // Wait until the map has been initialized
    const map = mapRef.current;
    if (!map || !mapReady) return;

    let ignore = false;
    const abortController = new AbortController();

    const loadGroundOverlays = async (overlays: GroundOverlayData[], assetBlobs?: Map<string, Blob>) => {
      groundOverlayLayersRef.current.forEach((l) => map.removeLayer(l));
      groundOverlayLayersRef.current = [];
      if (overlays.length === 0) return null;

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

      const globalExtent: [number, number, number, number] = [minX, minY, maxX, maxY];

      type BoundTuple = { ov: GroundOverlayData; ext: [number, number, number, number] };
      const standardBounds: BoundTuple[] = overlayBounds.filter(({ ov }) => !ov.isTiled && !ov.imageUrl.toLowerCase().match(/\.tiff?$/i));
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
        const extWd = ext[2] - ext[0];
        const maxRes = extWd / 256;
        const maxZ = ov.maxZoom || 6;
        const resolutions = new Array(maxZ + 1);
        for (let z = 0; z <= maxZ; ++z) resolutions[z] = maxRes / Math.pow(2, z);

        const tg = new TileGrid({
          extent: ext,
          resolutions,
          tileSize: [256, 256]
        });

        const lyr = new WebGLTileLayer({
          source: new XYZ({
            url: ov.imageUrl,
            tileGrid: tg,
            projection: "EPSG:3857",
            crossOrigin: "anonymous",
            interpolate: true
          }) as any,
          extent: ext,
          zIndex: 6,
          opacity: kmzOpacity,
          preload: Infinity,
          style: {
            brightness: ["var", "brightness"],
            contrast: ["var", "contrast"],
            saturation: ["var", "saturation"]
          },
          properties: {
            brightness: visuals.brightness,
            contrast: visuals.contrast,
            saturation: visuals.saturation
          }
        });
        map.addLayer(lyr);
        groundOverlayLayersRef.current.push(lyr);
      }

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
          const intersectingBounds = standardBounds.filter(({ ext }) => {
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
      const kmlFormat = new KML({ extractStyles: true });
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
      const validSourceExt = (sourceExt && sourceExt[0] !== Infinity) ? (sourceExt as [number, number, number, number]) : null;
      const fitExt = overlayExt || validSourceExt;

      if (fitExt && !overlayExtentRef.current) {
        overlayExtentRef.current = fitExt;
        const view = map.getView();
        if (!ignore && view) {
          view.fit(fitExt, { padding: [60, 60, 60, 60], duration: 600 });
        }
      }
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
          
          // PHASE 1: Try to fetch the pre-computed manifest from the backend
          setLoadingMessage("Fetching spatial manifest…");
          let manifestOverlays: GroundOverlayData[] = [];
          let manifestKmlText = "";
          let useManifest = false;
          
          try {
            const manifestRes = await api.get(`/schools/${schoolId}/kmz/2d/manifest`, {
              signal: abortController.signal
            });
            const manifestData = manifestRes.data?.manifest;
            
            if (manifestData && manifestData.kmlUrls && manifestData.kmlUrls.length > 0) {
              setLoadingMessage("Loading server-processed map data…");
              const kmlRes = await fetch(manifestData.kmlUrls[0], { signal: abortController.signal });
              manifestKmlText = await kmlRes.text();
              manifestOverlays = manifestData.groundOverlays || [];
              useManifest = true;
            }
          } catch (mErr) {
            console.warn("Failed to load map manifest, falling back to client-side extraction", mErr);
          }

          if (ignore) return;

          // PHASE 2: Apply the manifest map data
          let overlays: GroundOverlayData[];
          let kmlText: string;

          if (useManifest) {
            overlays = manifestOverlays;
            kmlText = manifestKmlText;
            setLoadingProgress(50);
            cleanupKmzRef.current = null;
          } else {
            console.error("No manifest found! The backend must process the KMZ first. Please re-upload.");
            setLoadingMessage("Cannot load map. Please re-upload the map asset.");
            setIsLoading(false);
            return;
          }

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
    groundOverlayLayersRef.current.forEach(layer => {
      layer.setOpacity(kmzOpacity);
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
