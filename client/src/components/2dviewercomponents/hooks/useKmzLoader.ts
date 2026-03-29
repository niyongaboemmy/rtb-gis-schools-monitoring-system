import { useEffect, useRef } from "react";
import OLMap from "ol/Map";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import KML from "ol/format/KML";
import DataTile from "ol/source/DataTile";
import TileLayer from "ol/layer/Tile";
import WebGLTileLayer from "ol/layer/WebGLTile";
import GeoTIFFSource from "ol/source/GeoTIFF";
import { transformExtent } from "ol/proj";
import { createXYZ } from "ol/tilegrid";
import { getIntersection, isEmpty as isExtentEmpty } from "ol/extent";
import Feature from "ol/Feature";

import {
  kmlStyle,
  getFeatureName,
  unpackKmzFile,
  parseGroundOverlaysFromKml,
} from "../MapUtils";
import type { GroundOverlayData } from "../MapUtils";

interface UseKmzLoaderProps {
  mapRef: React.MutableRefObject<OLMap | null>;
  mapReady: boolean;
  kmzUrl?: string;
  tifUrl?: string;
  schoolId: string;
  kmzOpacity: number;
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
      for (const ov of sorted) {
        const ext = transformExtent([ov.west, ov.south, ov.east, ov.north], "EPSG:4326", "EPSG:3857");
        if (ext[0] < minX) minX = ext[0];
        if (ext[1] < minY) minY = ext[1];
        if (ext[2] > maxX) maxX = ext[2];
        if (ext[3] > maxY) maxY = ext[3];
      }

      const bitmaps = bitmapsRef.current;
      const thumbs = thumbsRef.current;
      const pendingDecodes = pendingDecodesRef.current;
      const tileGrid = createXYZ({ maxZoom: 25, tileSize: 256 });
      let activeDecodes = 0;

      const loadLevels = async () => {
        setIsTileLoading(true);
        const groupedByLevel = new Map<number, GroundOverlayData[]>();
        for (const ov of sorted) {
          if (!groupedByLevel.has(ov.drawOrder)) groupedByLevel.set(ov.drawOrder, []);
          groupedByLevel.get(ov.drawOrder)!.push(ov);
        }
        const levels = Array.from(groupedByLevel.keys()).sort((a, b) => a - b);

        for (const level of levels) {
          const batch = groupedByLevel.get(level) ?? [];
          for (const ov of batch) {
            const ovExt = transformExtent([ov.west, ov.south, ov.east, ov.north], "EPSG:4326", "EPSG:3857") as [number, number, number, number];
            const isTif = ov.imageUrl.toLowerCase().endsWith(".tif") || ov.imageUrl.toLowerCase().endsWith(".tiff");

            if (isTif) {
              const lyr = new WebGLTileLayer({ source: new GeoTIFFSource({ sources: [{ url: ov.imageUrl }] }), zIndex: 5 + level, opacity: kmzOpacity, extent: ovExt });
              map.addLayer(lyr);
              groundOverlayLayersRef.current.push(lyr);
              continue;
            }

            const [extW, extS, extE, extN] = ovExt;
            const extWd = extE - extW;
            const extHt = extN - extS;

            const source = new DataTile({
              tileGrid,
              tileSize: 256,
              interpolate: true,
              loader: async (z, x, y) => {
                if (!tileGrid) return new OffscreenCanvas(256, 256).transferToImageBitmap();
                const te = (tileGrid as any).getTileCoordExtent([z, x, y]);
                if (!te) return new OffscreenCanvas(256, 256).transferToImageBitmap();
                const resolution = te[2] - te[0];
                const pixW = (extWd / resolution) * 256;
                const ix = getIntersection(te, ovExt);
                if (!ix || isExtentEmpty(ix) || pixW < 4) {
                  return new OffscreenCanvas(256, 256).transferToImageBitmap();
                }

                const createT = (bm: ImageBitmap, tbm?: ImageBitmap | null) => {
                  const [ixW, ixS, ixE, ixN] = ix;
                  const [tW, tS, tE, tN] = te;
                  const tileWd = tE - tW;
                  const tileHt = tN - tS;
                  const dstX = ((ixW - tW) / tileWd) * 256;
                  const dstY = ((tN - ixN) / tileHt) * 256;
                  const dstW = ((ixE - ixW) / tileWd) * 256;
                  const dstH = ((ixN - ixS) / tileHt) * 256;
                  const fullSrcW = ((ixE - ixW) / extWd) * bm.width;
                  const chosenBm = (tbm && fullSrcW > dstW * 4) ? tbm : bm;
                  const srcX = ((ixW - extW) / extWd) * chosenBm.width;
                  const srcY = ((extN - ixN) / extHt) * chosenBm.height;
                  const srcW = ((ixE - ixW) / extWd) * chosenBm.width;
                  const srcH = ((ixN - ixS) / extHt) * chosenBm.height;
                  const canv = new OffscreenCanvas(256, 256);
                  const ctx = canv.getContext("2d")!;
                  ctx.imageSmoothingEnabled = true;
                  ctx.imageSmoothingQuality = "high";
                  ctx.drawImage(chosenBm, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH);
                  return canv.transferToImageBitmap();
                };

                let existing = bitmaps.get(ov.imageUrl);
                if (existing) return createT(existing, thumbs.get(ov.imageUrl));

                let pending = pendingDecodes.get(ov.imageUrl);
                if (!pending) {
                  pending = (async () => {
                    try {
                      while (activeDecodes >= 8 && !ignore) await new Promise((r) => setTimeout(r, 50));
                      if (ignore) return;
                      activeDecodes++;
                      setDecodingCount(activeDecodes);
                      const blob = assetBlobs?.get(ov.imageUrl) || await (await fetch(ov.imageUrl, { signal: abortController.signal })).blob();
                      if (ignore) return;
                      const bm = await createImageBitmap(blob);
                      bitmaps.set(ov.imageUrl, bm);
                      if (bm.width > 2048 || bm.height > 2048) {
                        const scale = 1024 / Math.max(bm.width, bm.height);
                        const tbm = await createImageBitmap(bm, { resizeWidth: Math.round(bm.width * scale), resizeHeight: Math.round(bm.height * scale), resizeQuality: "high" });
                        thumbs.set(ov.imageUrl, tbm);
                      }
                    } finally {
                      activeDecodes = Math.max(0, activeDecodes - 1);
                      setDecodingCount(activeDecodes);
                    }
                  })();
                  pendingDecodes.set(ov.imageUrl, pending);
                }
                await pending;
                existing = bitmaps.get(ov.imageUrl);
                return existing ? createT(existing, thumbs.get(ov.imageUrl)) : new OffscreenCanvas(256, 256).transferToImageBitmap();
              },
            });
            const lyr = new TileLayer({ source, zIndex: 5 + level, opacity: kmzOpacity, extent: ovExt });
            map.addLayer(lyr);
            groundOverlayLayersRef.current.push(lyr);
          }
          await new Promise((r) => requestAnimationFrame(() => r(0)));
        }
        map.once("rendercomplete", () => setIsTileLoading(false));
      };
      void loadLevels();
      return minX !== Infinity ? ([minX, minY, maxX, maxY] as [number, number, number, number]) : null;
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
      if (kmzUrl) {
        try {
          if (schoolId === lastSchoolIdRef.current && kmzUrl === loadedKmzRef.current && kmlTextRef.current) {
            await loadKml(kmlTextRef.current, finalOverlaysRef.current, undefined);
            setIsLoading(false);
            return;
          }

          setLoadingProgress(5);
          setLoadingMessage("Fetching spatial data archive…");
          const res = await fetch(kmzUrl, { signal: abortController.signal });
          const blob = await res.blob();
          if (ignore) return;
          setLoadingMessage("Unpacking drone imagery locally…");
          const unpacked = await unpackKmzFile(new File([blob], "data.kmz"));
          if (ignore) {
            unpacked.cleanup();
            return;
          }
          const overlays: GroundOverlayData[] = [];
          for (const t of unpacked.allKmlTexts.values()) overlays.push(...parseGroundOverlaysFromKml(t));

          kmlTextRef.current = unpacked.kmlText;
          finalOverlaysRef.current = overlays;
          loadedKmzRef.current = kmzUrl;
          lastSchoolIdRef.current = schoolId;

          setLoadingProgress(90);
          await loadKml(unpacked.kmlText, overlays, unpacked.assetBlobs);
          cleanupKmzRef.current = unpacked.cleanup;
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

  return { bitmapsRef, thumbsRef, kmlTextRef, finalOverlaysRef, cleanupKmzRef };
}
