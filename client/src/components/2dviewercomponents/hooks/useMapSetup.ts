import { useEffect, useRef, useState } from "react";
import { Map as OLMap, View } from "ol";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorTileLayer from "ol/layer/VectorTile";
import XYZ from "ol/source/XYZ";
import VectorSource from "ol/source/Vector";
import { fromLonLat, toLonLat } from "ol/proj";
import { Feature } from "ol";
import { Style, Fill, Stroke } from "ol/style";
import GeoJSONFormat from "ol/format/GeoJSON";
import ScaleLine from "ol/control/ScaleLine";

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
  setCurrentLat: (lat: number) => void;
  setCurrentLng: (lng: number) => void;
  setActiveBlock: (block: any) => void;
  setIsBlockInspectorOpen: (open: boolean) => void;
  setSelectedFeatureName: (name: string | null) => void;
  setInfoFeature: (info: any) => void;
  getBasemapUrl: (style: string) => string;
  activeDrawRef: React.MutableRefObject<any>;
  blockOverlayRef: React.MutableRefObject<any>;
  measureSourceRef: React.MutableRefObject<any>;
  kmlLayerRef: React.MutableRefObject<any>;
  geojsonLayerRef: React.MutableRefObject<any>;
  placesLayerRef: React.MutableRefObject<any>;
}

export function useMapSetup({
  containerRef,
  fallbackLocation,
  onSelectBuilding,
  effectiveBuildings,
  setCurrentLat,
  setCurrentLng,
  setActiveBlock,
  setIsBlockInspectorOpen,
  setSelectedFeatureName,
  setInfoFeature,
  getBasemapUrl,
  activeDrawRef,
  blockOverlayRef,
  measureSourceRef,
  kmlLayerRef,
  geojsonLayerRef,
  placesLayerRef,
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
  const selectedFeatureRef = useRef<Feature | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const basemapSrc = new XYZ({
      url: getBasemapUrl("google"),
      attributions: "© Google, Esri, DigitalGlobe",
      maxZoom: 19,
      crossOrigin: "anonymous",
    });
    const basemap = new TileLayer({ source: basemapSrc, zIndex: 0 });
    basemapLayerRef.current = basemap;

    const blocksSource = new VectorSource();
    const blocksLayer = new VectorLayer({ source: blocksSource, style: blockStyle, zIndex: 50 });
    blocksLayerRef.current = blocksLayer;

    const annotationSource = new VectorSource();
    const annotationLayer = new VectorLayer({ source: annotationSource, style: annotationStyle, zIndex: 45 });
    annotationLayerRef.current = annotationLayer;

    const labelSrc = new XYZ({
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      maxZoom: 23,
      crossOrigin: "anonymous",
    });
    const labelLayer = new TileLayer({ source: labelSrc, zIndex: 1, opacity: 0.85 });
    basemapLabelLayerRef.current = labelLayer;

    const measureLayer = new VectorLayer({ source: measureSourceRef.current, style: measureStyle, zIndex: 50 });
    measureLayerRef.current = measureLayer;

    const map = new OLMap({
      target: containerRef.current,
      layers: [basemap, labelLayer, measureLayer, blocksLayer, annotationLayer],
      view: new View({
        center: fromLonLat([fallbackLocation.lng, fallbackLocation.lat]),
        zoom: 19,
        maxZoom: 25,
      }),
      controls: [],
    });

    // Sub-layers
    const ghostSource = new VectorSource({
      features: new GeoJSONFormat().readFeatures(rwandaBoundaries, { featureProjection: "EPSG:3857" }),
    });
    const ghostLayer = new VectorLayer({
      source: ghostSource,
      style: new Style({
        fill: new Fill({ color: "rgba(30, 41, 59, 0.05)" }),
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
        fill: new Fill({ color: "#f8fafc" }),
      }),
    });
    map.addLayer(offlineLayer);
    offlineLayerRef.current = offlineLayer;

    map.addControl(new ScaleLine({ units: "metric", minWidth: 100, bar: true, steps: 4, text: true }));

    // Interaction handlers
    map.on("pointermove", (evt: any) => {
      if (evt.dragging) return;
      const [lng, lat] = toLonLat(evt.coordinate);
      setCurrentLat(lat);
      setCurrentLng(lng);
      const pixel = map.getEventPixel(evt.originalEvent);
      const hit = map.hasFeatureAtPixel(pixel, {
        layerFilter: (l) =>
          l === kmlLayerRef.current ||
          l === geojsonLayerRef.current ||
          l === placesLayerRef.current ||
          l === blocksLayerRef.current,
      });
      map.getTargetElement().style.cursor = hit ? "pointer" : "";
    });

    map.on("singleclick", (evt: any) => {
      if (activeDrawRef.current) return;
      let found = false;
      map.forEachFeatureAtPixel(evt.pixel, (f: any, layer: any) => {
        if (found) return;
        if (layer === blocksLayerRef.current) {
          const building = f.get("buildingData");
          if (building) {
            setActiveBlock(building);
            setIsBlockInspectorOpen(true);
            if (blockOverlayRef.current) blockOverlayRef.current.setPosition(evt.coordinate);
            found = true;
          }
        }
        if (found) return;
        if (layer !== kmlLayerRef.current && layer !== geojsonLayerRef.current && layer !== annotationLayerRef.current) return;
        const feat = f as Feature;
        const name = getFeatureName(feat);
        const description = getFeatureDescription(feat);
        if (selectedFeatureRef.current && (selectedFeatureRef.current as any) !== feat) selectedFeatureRef.current.setStyle(undefined);
        feat.setStyle(kmlSelectedStyle);
        selectedFeatureRef.current = feat;
        setSelectedFeatureName(name ?? null);
        setInfoFeature(name ? { name, description } : null);
        if (name && onSelectBuilding) {
          const b = effectiveBuildings.find(
            (bg: any) =>
              bg.buildingName?.toLowerCase() === name.toLowerCase() ||
              bg.buildingCode?.toLowerCase() === name.toLowerCase()
          );
          if (b) onSelectBuilding(b);
        }
        found = true;
      }, { hitTolerance: 6 });

      if (!found) {
        if (selectedFeatureRef.current) {
          selectedFeatureRef.current.setStyle(undefined);
          selectedFeatureRef.current = null;
        }
        setSelectedFeatureName(null);
        setInfoFeature(null);
        setIsBlockInspectorOpen(false);
      }
    });

    mapRef.current = map;
    setMapReady(true);
    return () => {
      map.setTarget(undefined);
      mapRef.current = null;
      setMapReady(false);
    };
  }, [onSelectBuilding, effectiveBuildings, fallbackLocation.lat, fallbackLocation.lng]);

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
  };
}
