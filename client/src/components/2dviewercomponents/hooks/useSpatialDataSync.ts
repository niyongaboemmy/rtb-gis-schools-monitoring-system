import { useEffect } from "react";
import OLMap from "ol/Map";
import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import Feature from "ol/Feature";
import { Point as OLPoint, LineString, Polygon } from "ol/geom";
import { fromLonLat } from "ol/proj";
import KML from "ol/format/KML";
import GeoJSONFormat from "ol/format/GeoJSON";
import {
  annotationStyle,
  placesStyleFunction,
  geojsonStyle,
} from "../MapUtils";
import type { BuildingData } from "../../school-form-steps/BuildingsStep";

interface UseSpatialDataSyncProps {
  mapRef: React.MutableRefObject<OLMap | null>;
  mapReady: boolean;
  schoolBuildings: BuildingData[];
  blocksLayerRef: React.MutableRefObject<VectorLayer | null>;
  annotationLayerRef: React.MutableRefObject<VectorLayer | null>;
  effectivePlacesOverlay?: any;
  placesOverlayUrl?: string;
  showPlacesOverlay: boolean;
  placesLayerRef: React.MutableRefObject<VectorLayer | null>;
  geojson?: any;
  geojsonLayerRef: React.MutableRefObject<VectorLayer | null>;
}

export function useSpatialDataSync({
  mapRef,
  mapReady,
  schoolBuildings,
  blocksLayerRef,
  annotationLayerRef,
  effectivePlacesOverlay,
  placesOverlayUrl,
  showPlacesOverlay,
  placesLayerRef,
  geojson,
  geojsonLayerRef,
}: UseSpatialDataSyncProps) {

  // ── Sync Building Pins & Annotations ──────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    const bSrc = blocksLayerRef.current?.getSource();
    const aSrc = annotationLayerRef.current?.getSource();
    if (!bSrc || !aSrc) return;

    bSrc.clear();
    aSrc.clear();

    schoolBuildings.forEach((b) => {
      // Pins
      if (b.geolocation?.latitude && b.geolocation?.longitude) {
        const feat = new Feature({
          geometry: new OLPoint(fromLonLat([Number(b.geolocation.longitude), Number(b.geolocation.latitude)]))
        });
        feat.set("buildingData", b);
        bSrc.addFeature(feat);
      }

      // Annotations
      if (b.annotations && b.annotations.length > 0) {
        b.annotations.forEach((ann) => {
          if (!ann.coordinates || ann.coordinates.length === 0) return;

          let feat: Feature | null = null;
          const pts = ann.coordinates;

          if (ann.type === "point") {
            feat = new Feature({ geometry: new OLPoint(fromLonLat([Number(pts[0]), Number(pts[1])])) });
          } else if (ann.type === "line") {
            const linePts = [];
            for (let i = 0; i < pts.length; i += 2) linePts.push(fromLonLat([Number(pts[i]), Number(pts[i + 1])]));
            feat = new Feature({ geometry: new LineString(linePts) });
          } else if (ann.type === "polygon") {
            const polyPts = [];
            for (let i = 0; i < pts.length; i += 2) polyPts.push(fromLonLat([Number(pts[i]), Number(pts[i + 1])]));
            feat = new Feature({ geometry: new Polygon([polyPts]) });
          }

          if (feat) {
            feat.set("annotationData", ann);
            feat.set("buildingName", b.buildingName);
            feat.setStyle(annotationStyle);
            aSrc.addFeature(feat);
          }
        });
      }
    });
  }, [schoolBuildings, mapReady]);

  // ── Load Places Overlay ──────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const loadPlaces = async (kmlText: string) => {
      const kmlFormat = new KML({ extractStyles: true });
      let parsed: Feature[];
      try {
        parsed = kmlFormat.readFeatures(kmlText, {
          featureProjection: "EPSG:3857",
          dataProjection: "EPSG:4326",
        }) as Feature[];
      } catch {
        parsed = [];
      }

      const source = new VectorSource({ features: parsed });
      const layer = new VectorLayer({
        source,
        style: placesStyleFunction as any,
        zIndex: 40,
        visible: showPlacesOverlay,
      });
      if (placesLayerRef.current) map.removeLayer(placesLayerRef.current);
      map.addLayer(layer);
      placesLayerRef.current = layer;
    };

    if (effectivePlacesOverlay?.features || effectivePlacesOverlay?.type === "FeatureCollection") {
      try {
        const gjFormat = new GeoJSONFormat();
        const parsed = gjFormat.readFeatures(effectivePlacesOverlay, {
          featureProjection: "EPSG:3857",
          dataProjection: "EPSG:4326",
        }) as Feature[];
        const source = new VectorSource({ features: parsed });
        const layer = new VectorLayer({
          source,
          style: placesStyleFunction,
          zIndex: 40,
          visible: showPlacesOverlay,
        });
        if (placesLayerRef.current) map.removeLayer(placesLayerRef.current);
        map.addLayer(layer);
        placesLayerRef.current = layer;
      } catch (err) {
        console.error("[useSpatialDataSync] Places overlay GeoJSON failed", err);
      }
      return;
    }

    if (placesOverlayUrl) {
      fetch(placesOverlayUrl)
        .then((r) => r.text())
        .then(loadPlaces)
        .catch((err) =>
          console.error("[useSpatialDataSync] Places overlay fetch failed", err),
        );
    }
  }, [effectivePlacesOverlay, placesOverlayUrl, showPlacesOverlay, mapReady]);

  // ── Load GeoJSON ─────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !geojson) return;

    try {
      const gjFormat = new GeoJSONFormat();
      const parsed = gjFormat.readFeatures(geojson, {
        featureProjection: "EPSG:3857",
        dataProjection: "EPSG:4326",
      }) as Feature[];

      const source = new VectorSource({ features: parsed });
      const layer = new VectorLayer({ source, style: geojsonStyle, zIndex: 8 });

      if (geojsonLayerRef.current) map.removeLayer(geojsonLayerRef.current);
      map.addLayer(layer);
      geojsonLayerRef.current = layer;
    } catch (err) {
      console.error("[useSpatialDataSync] GeoJSON load failed", err);
    }
  }, [geojson, mapReady]);
}
