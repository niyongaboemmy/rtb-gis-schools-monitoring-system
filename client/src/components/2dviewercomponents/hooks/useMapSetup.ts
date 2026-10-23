import { useEffect, useRef, useState } from "react";
import { Map as OLMap, View } from "ol";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorTileLayer from "ol/layer/VectorTile";
import XYZ from "ol/source/XYZ";
import VectorSource from "ol/source/Vector";
import { fromLonLat, toLonLat } from "ol/proj";
import { Feature } from "ol";
import { Fill, Stroke, Style } from "ol/style";
import GeoJSONFormat from "ol/format/GeoJSON";
import ScaleLine from "ol/control/ScaleLine";
import WebGLTileLayer from "ol/layer/WebGLTile";

import {
  blockStyle,
  annotationStyle,
  kmlSelectedStyle,
  measureStyle,
  getFeatureName,
  getFeatureDescription,
} from "../MapUtils";

import rwandaBoundaries from "../../../assets/maps/rwanda-boundaries.json";

interface UseMapSetupProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  fallbackLocation: { lat: number; lng: number };
  onSelectBuilding?: (building: any) => void;
  effectiveBuildings: any[];
  /** Cursor position for the HUD (an external store, not React state). */
  onPointer: (lat: number, lng: number) => void;
  setActiveBlock: (block: any) => void;
  setIsBlockInspectorOpen: (open: boolean) => void;
  setSelectedFeatureName: (name: string | null) => void;
  setInfoFeature: (info: any) => void;
  getBasemapUrl: (style: string) => string;
  isDrawingRef: React.MutableRefObject<boolean>;
  blockOverlayRef: React.MutableRefObject<any>;
  measureSourceRef: React.MutableRefObject<any>;
  kmlLayerRef: React.MutableRefObject<any>;
  geojsonLayerRef: React.MutableRefObject<any>;
  placesLayerRef: React.MutableRefObject<any>;
  pickerMode?: boolean;
  onPickerSelect?: (building: any) => void;
  onAnnotationHover?: (ann: any | null, x: number, y: number) => void;
}

export function useMapSetup({
  containerRef,
  fallbackLocation,
  onSelectBuilding,
  effectiveBuildings,
  onPointer,
  setActiveBlock,
  setIsBlockInspectorOpen,
  setSelectedFeatureName,
  setInfoFeature,
  getBasemapUrl,
  isDrawingRef,
  blockOverlayRef,
  measureSourceRef,
  kmlLayerRef,
  geojsonLayerRef,
  placesLayerRef,
  onAnnotationHover,
}: UseMapSetupProps) {
  const mapRef = useRef<OLMap | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const basemapLayerRef = useRef<TileLayer<XYZ> | null>(null);
  const basemapLabelLayerRef = useRef<TileLayer<XYZ> | null>(null);
  const blocksLayerRef = useRef<VectorLayer | null>(null);
  const annotationLayerRef = useRef<VectorLayer | null>(null);
  const measureLayerRef = useRef<VectorLayer | null>(null);
  const ghostLayerRef = useRef<VectorLayer | null>(null);
  const offlineLayerRef = useRef<VectorTileLayer | null>(null);
  const hoverLayerRef = useRef<VectorLayer | null>(null);
  const selectedLayerRef = useRef<VectorLayer | null>(null);
  const selectedFeatureRef = useRef<Feature | null>(null);

  // ── Sync Refs for Handlers (prevents map re-init on prop change) ──────────
  const effectiveBuildingsRef = useRef(effectiveBuildings);
  const onSelectBuildingRef = useRef(onSelectBuilding);
  const onAnnotationHoverRef = useRef(onAnnotationHover);

  effectiveBuildingsRef.current = effectiveBuildings;
  onSelectBuildingRef.current = onSelectBuilding;
  onAnnotationHoverRef.current = onAnnotationHover;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // ── Basemap ─────────────────────────────────────────────────────────────
    const basemapSrc = new XYZ({
      url: getBasemapUrl("google"),
      attributions: "© Google, Esri, DigitalGlobe",
      maxZoom: 19,
      crossOrigin: "anonymous",
    });
    const basemap = new WebGLTileLayer({
      source: basemapSrc as any,
      zIndex: 0,
    });
    basemapLayerRef.current = basemap as any;

    // ── Vectors ──────────────────────────────────────────────────────────────
    const blocksSource = new VectorSource();
    const blocksLayer = new VectorLayer({
      source: blocksSource,
      style: blockStyle,
      zIndex: 50,
    });
    blocksLayerRef.current = blocksLayer;

    const annotationSource = new VectorSource();
    const annotationLayer = new VectorLayer({
      source: annotationSource,
      style: annotationStyle,
      zIndex: 1000,
    });
    annotationLayerRef.current = annotationLayer;

    const hoverSource = new VectorSource();
    const hoverLayer = new VectorLayer({
      source: hoverSource,
      zIndex: 60,
      style: new Style({
        fill: new Fill({ color: "rgba(0, 0, 0, 0)" }),
        stroke: new Stroke({ color: "#3b82f6", width: 3 }),
      }),
    });
    hoverLayerRef.current = hoverLayer;

    const selectedSource = new VectorSource();
    const selectedLayer = new VectorLayer({
      source: selectedSource,
      zIndex: 55,
      style: new Style({
        fill: new Fill({ color: "rgba(59, 130, 246, 0.4)" }), // Blue light opacity shade
        stroke: new Stroke({ color: "#3b82f6", width: 4 }), // Blue highlight
      }),
    });
    selectedLayerRef.current = selectedLayer;

    const labelSrc = new XYZ({
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      maxZoom: 23,
      crossOrigin: "anonymous",
    });
    const labelLayer = new WebGLTileLayer({
      source: labelSrc as any,
      zIndex: 1,
      opacity: 0.85,
    });
    basemapLabelLayerRef.current = labelLayer as any;

    const measureLayer = new VectorLayer({
      source: measureSourceRef.current,
      style: measureStyle,
      zIndex: 50,
    });
    measureLayerRef.current = measureLayer;

    const map = new OLMap({
      target: containerRef.current,
      layers: [
        basemap,
        labelLayer,
        measureLayer,
        blocksLayer,
        annotationLayer,
        hoverLayer,
        selectedLayer,
      ],
      view: new View({
        center: fromLonLat([fallbackLocation.lng, fallbackLocation.lat]),
        zoom: 19,
        maxZoom: 25,
        constrainResolution: false,
        multiWorld: true,
      }),
      controls: [],
    });

    // Sub-layers
    const ghostSource = new VectorSource({
      features: new GeoJSONFormat().readFeatures(rwandaBoundaries, {
        featureProjection: "EPSG:3857",
      }),
    });
    const ghostLayer = new VectorLayer({
      source: ghostSource,
      style: new Style({
        fill: new Fill({ color: "rgba(0, 0, 0, 0)" }),
        stroke: new Stroke({ color: "rgba(148, 163, 184, 0.5)", width: 1 }),
      }),
      visible: false,
      zIndex: -1,
    });
    map.addLayer(ghostLayer);
    ghostLayerRef.current = ghostLayer;

    const offlineLayer = new VectorTileLayer({
      visible: false,
      zIndex: -1,
      style: new Style({
        stroke: new Stroke({ color: "#e2e8f0", width: 1 }),
        fill: new Fill({ color: "rgba(0, 0, 0, 0)" }),
      }),
    });
    map.addLayer(offlineLayer);
    offlineLayerRef.current = offlineLayer;

    map.addControl(
      new ScaleLine({
        units: "metric",
        minWidth: 100,
        bar: true,
        steps: 4,
        text: true,
      }),
    );

    // Interaction handlers
    // Hover: at most one hit-test per animation frame (the latest position),
    // and the hover outline is rebuilt only when the feature changes.
    let hoverFrame = 0;
    let lastPixel: number[] | null = null;
    let hovered: any = null;
    let tooltipAnn: unknown = null;
    const runHover = () => {
      hoverFrame = 0;
      if (!lastPixel) return;
      const feature = map.forEachFeatureAtPixel(lastPixel, (f) => f, {
        layerFilter: (l) =>
          l === kmlLayerRef.current ||
          l === geojsonLayerRef.current ||
          l === placesLayerRef.current ||
          l === blocksLayerRef.current ||
          l === annotationLayerRef.current,
        hitTolerance: 6,
      });

      if (feature !== hovered) {
        hovered = feature ?? null;
        hoverSource.clear();
        if (feature) {
          const clone = (feature as any).clone();
          clone.setStyle(null);
          hoverSource.addFeature(clone);
        }
        map.getTargetElement().style.cursor = feature ? "pointer" : "";
      }

      // Note tooltip: tell the viewer only when the hovered note changes
      // (calling it every frame re-rendered the whole viewer).
      const ann = feature?.get("isSiteAnnotation") ? feature.get("annotationData") : null;
      const tip = ann?.description ? ann : null;
      if (tip !== tooltipAnn) {
        tooltipAnn = tip;
        onAnnotationHoverRef.current?.(tip, tip ? lastPixel[0] : 0, tip ? lastPixel[1] : 0);
      }
    };

    map.on("pointermove", (evt: any) => {
      if (evt.dragging) return;
      const [lng, lat] = toLonLat(evt.coordinate);
      onPointer(lat, lng);
      lastPixel = map.getEventPixel(evt.originalEvent);
      if (!hoverFrame) hoverFrame = requestAnimationFrame(runHover);
    });

    map.on("singleclick", (evt: any) => {
      if (isDrawingRef.current) return;
      let found = false;
      map.forEachFeatureAtPixel(
        evt.pixel,
        (f: any, layer: any) => {
          if (found) return;
          if (
            layer === blocksLayerRef.current ||
            layer === annotationLayerRef.current ||
            layer === hoverLayerRef.current
          ) {
            const building = f.get("buildingData");
            if (building) {
              setActiveBlock(building);
              setIsBlockInspectorOpen(true);
              if (blockOverlayRef.current)
                blockOverlayRef.current.setPosition(evt.coordinate);
              found = true;
            }
          }
          if (found) return;
          if (
            layer !== kmlLayerRef.current &&
            layer !== geojsonLayerRef.current &&
            layer !== annotationLayerRef.current
          )
            return;
          const feat = f as Feature;
          const name = getFeatureName(feat);
          const description = getFeatureDescription(feat);
          if (
            selectedFeatureRef.current &&
            (selectedFeatureRef.current as any) !== feat
          )
            selectedFeatureRef.current.setStyle(undefined);
          feat.setStyle(kmlSelectedStyle);
          selectedFeatureRef.current = feat;
          setSelectedFeatureName(name ?? null);
          setInfoFeature(name ? { name, description } : null);
          if (name && onSelectBuildingRef.current) {
            const b = effectiveBuildingsRef.current.find(
              (bg: any) =>
                bg.buildingName?.toLowerCase() === name.toLowerCase() ||
                bg.buildingCode?.toLowerCase() === name.toLowerCase(),
            );
            if (b) onSelectBuildingRef.current(b);
          }
          found = true;
        },
        { hitTolerance: 10 },
      );

      if (!found) {
        if (selectedFeatureRef.current) {
          selectedFeatureRef.current.setStyle(undefined);
          selectedFeatureRef.current = null;
        }
        setSelectedFeatureName(null);
        setInfoFeature(null);
        setIsBlockInspectorOpen(false);
        setActiveBlock(null);
      }
    });

    mapRef.current = map;
    setMapReady(true);
    // Test hook (dev builds, or localStorage rtb-viewer-debug = 1), like the
    // 3D viewer's: lets scripts set an exact zoom/centre.
    const debug = (() => {
      try {
        return import.meta.env.DEV || localStorage.getItem("rtb-viewer-debug") === "1";
      } catch {
        return import.meta.env.DEV;
      }
    })();
    if (debug) (window as unknown as { __rtbMap?: OLMap }).__rtbMap = map;
    return () => {
      if (debug) delete (window as unknown as { __rtbMap?: OLMap }).__rtbMap;
      map.setTarget(undefined);
      mapRef.current = null;
      setMapReady(false);
    };
  }, [
    // This effect should only run once on container mount.
    // We use refs for actual listeners to avoid re-triggering.
    onPointer,
    setActiveBlock,
    setIsBlockInspectorOpen,
    setSelectedFeatureName,
    setInfoFeature,
    getBasemapUrl,
    isDrawingRef,
    blockOverlayRef,
    measureSourceRef,
    kmlLayerRef,
    geojsonLayerRef,
    placesLayerRef,
  ]);

  return {
    mapRef,
    mapReady,
    basemapLayerRef,
    basemapLabelLayerRef,
    blocksLayerRef,
    annotationLayerRef,
    ghostLayerRef,
    offlineLayerRef,
    measureLayerRef,
    hoverLayerRef,
    selectedLayerRef,
  };
}
