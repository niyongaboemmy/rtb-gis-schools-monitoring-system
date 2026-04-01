import { useEffect, useState, useRef } from "react";
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
  blockStyle,
  siteAnnotationStyle,
} from "../MapUtils";
import type { BuildingData } from "../../school-form-steps/BuildingsStep";
import { api } from "../../../lib/api";

interface UseSpatialDataSyncProps {
  mapRef: React.MutableRefObject<OLMap | null>;
  mapReady: boolean;
  schoolId: string;
  blocksLayerRef: React.MutableRefObject<VectorLayer | null>;
  annotationLayerRef: React.MutableRefObject<VectorLayer | null>;
  effectivePlacesOverlay?: any;
  placesOverlayUrl?: string;
  showPlacesOverlay: boolean;
  placesLayerRef: React.MutableRefObject<VectorLayer | null>;
  geojson?: any;
  geojsonLayerRef: React.MutableRefObject<VectorLayer | null>;
  onBuildingsLoaded?: (buildings: BuildingData[]) => void;
  siteAnnotations?: any[];
  hiddenAnnotationGroups?: Set<string>;
  showBuildingAreas?: boolean;
  showSiteAnnotations?: boolean;
}

export function useSpatialDataSync({
  mapRef,
  mapReady,
  schoolId,
  blocksLayerRef,
  annotationLayerRef,
  effectivePlacesOverlay,
  placesOverlayUrl,
  showPlacesOverlay,
  placesLayerRef,
  geojson,
  geojsonLayerRef,
  onBuildingsLoaded,
  siteAnnotations = [],
  hiddenAnnotationGroups,
  showBuildingAreas = true,
  showSiteAnnotations = true,
}: UseSpatialDataSyncProps) {
  const [buildings, setBuildings] = useState<BuildingData[]>([]);

  // ── Fetch All Buildings for School (Once) ──────────────────────────────
  const buildingsFetchedIdRef = useRef<string | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !schoolId) return;
    
    // Only fetch if school ID changed or we haven't fetched yet
    if (buildingsFetchedIdRef.current === schoolId) return;

    const fetchAll = async () => {
      try {
        const response = await api.get(`/schools/${schoolId}/buildings`);
        const allBuildings = response.data.map((b: any) => ({
          ...b,
          id: b.id,
          buildingName: b.name || "",
          buildingCode: b.buildingCode || "",
          buildingFunction: b.function || "",
          buildingFloors: b.floors?.toString() || "",
          buildingArea: b.areaSquareMeters?.toString() || "",
          buildingYearBuilt: b.yearBuilt?.toString() || "",
          buildingCondition: b.condition || "fair",
          buildingRoofCondition: b.roofCondition || "good",
          buildingStructuralScore: b.structuralScore?.toString() || "",
          buildingNotes: b.notes || "",
          facilities: b.facilities || [],
          geolocation: {
            latitude: b.centroidLat,
            longitude: b.centroidLng,
          },
          annotations: b.annotations || [],
          media: b.media || [],
        }));

        setBuildings(allBuildings);
        buildingsFetchedIdRef.current = schoolId;
        onBuildingsLoaded?.(allBuildings);
      } catch (err) {
        console.error("Failed to fetch all buildings for school", err);
      }
    };

    fetchAll();
  }, [mapReady, schoolId, onBuildingsLoaded]);

  // ── Sync Building Pins & Annotations ──────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    const bSrc = blocksLayerRef.current?.getSource();
    const aSrc = annotationLayerRef.current?.getSource();
    if (!bSrc || !aSrc) return;

    bSrc.clear();
    aSrc.clear();

    buildings.forEach((b: BuildingData) => {
      // Skip entire building (pins + annotations) when building areas are hidden
      if (!showBuildingAreas) return;

      // Pins
      if (b.geolocation?.latitude && b.geolocation?.longitude) {
        const hasFootprint = (b.annotations || []).some(
          (ann: any) => ann && ann.isFootprint,
        );
        const feat = new Feature({
          geometry: new OLPoint(
            fromLonLat([
              Number(b.geolocation.longitude),
              Number(b.geolocation.latitude),
            ]),
          ),
        });
        feat.set("buildingData", b);
        if (hasFootprint) {
          feat.set("hideLabel", true);
        }
        bSrc.addFeature(feat);
      }

      // Annotations (footprints + drawn shapes)
      const validAnnotations = (b.annotations || []).filter(
        (ann: any) =>
          ann &&
          typeof ann === "object" &&
          !Array.isArray(ann) &&
          ann.coordinates,
      );

      validAnnotations.forEach((ann: any) => {
        const rawPts = ann.coordinates;
        if (!rawPts || rawPts.length === 0) return;

        let pairs: [number, number][];
        if (Array.isArray(rawPts[0])) {
          pairs = rawPts.map(
            (c: any) => [Number(c[0]), Number(c[1])] as [number, number],
          );
        } else {
          pairs = [];
          for (let i = 0; i + 1 < rawPts.length; i += 2) {
            pairs.push([Number(rawPts[i]), Number(rawPts[i + 1])]);
          }
        }

        if (pairs.length === 0) return;

        let feat: Feature | null = null;

        if (ann.type === "point") {
          feat = new Feature({ geometry: new OLPoint(fromLonLat(pairs[0])) });
        } else if (ann.type === "line") {
          feat = new Feature({
            geometry: new LineString(pairs.map((p) => fromLonLat(p))),
          });
        } else if (ann.type === "polygon") {
          feat = new Feature({
            geometry: new Polygon([pairs.map((p) => fromLonLat(p))]),
          });
        }

        if (feat) {
          feat.set("annotationData", ann);
          feat.set("buildingData", b);
          feat.set("buildingName", b.buildingName);
          feat.set("buildingArea", b.buildingArea || ann.areaSquareMeters);
          if (ann.isFootprint) {
            feat.setStyle((f: any) => blockStyle(f));
          } else {
            feat.setStyle(annotationStyle);
          }
          aSrc.addFeature(feat);
        }
      });
    });

    // ── Render Site-Level Annotations (not tied to any building) ─────────
    if (!showSiteAnnotations) return;
    siteAnnotations.forEach((ann: any) => {
      if (!ann?.coordinates) {
        return;
      }

      // Skip annotations whose icon type is hidden
      const iconType = ann.icon || ann.iconType || ann.style?.iconType || "pin";
      if (hiddenAnnotationGroups?.has(iconType)) return;
      const rawPts = ann.coordinates;
      if (!rawPts || rawPts.length === 0) return;

      let pairs: [number, number][];
      if (Array.isArray(rawPts[0])) {
        pairs = rawPts.map(
          (c: any) => [Number(c[0]), Number(c[1])] as [number, number],
        );
      } else {
        pairs = [];
        for (let i = 0; i + 1 < rawPts.length; i += 2) {
          pairs.push([Number(rawPts[i]), Number(rawPts[i + 1])]);
        }
      }
      if (pairs.length === 0) return;

      let siteFeat: Feature | null = null;
      if (ann.type === "text" || ann.type === "point") {
        siteFeat = new Feature({ geometry: new OLPoint(fromLonLat(pairs[0])) });
      } else if (ann.type === "line" || ann.type === "linestring") {
        siteFeat = new Feature({
          geometry: new LineString(pairs.map((p) => fromLonLat(p))),
        });
      } else if (ann.type === "polygon" || ann.type === "poly") {
        siteFeat = new Feature({
            geometry: new Polygon([pairs.map((p) => fromLonLat(p))]),
        });
      }

      if (siteFeat) {
        siteFeat.set("isSiteAnnotation", true);
        siteFeat.set("annotationData", ann);
        siteFeat.set("siteLabel", ann.label || ann.content || "");
        siteFeat.set("areaSquareMeters", ann.areaSquareMeters);
        siteFeat.set("lengthMeters", ann.lengthMeters);
        siteFeat.setStyle((f: any) => siteAnnotationStyle(f));
        aSrc.addFeature(siteFeat);
      }
    });
  }, [
    buildings,
    siteAnnotations,
    hiddenAnnotationGroups,
    showBuildingAreas,
    showSiteAnnotations,
    mapReady,
    blocksLayerRef,
    annotationLayerRef,
  ]);

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

    if (
      effectivePlacesOverlay?.features ||
      effectivePlacesOverlay?.type === "FeatureCollection"
    ) {
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
        console.error(
          "[useSpatialDataSync] Places overlay GeoJSON failed",
          err,
        );
      }
      return;
    }

    if (placesOverlayUrl) {
      fetch(placesOverlayUrl)
        .then((r) => r.text())
        .then(loadPlaces)
        .catch((err) =>
          console.error(
            "[useSpatialDataSync] Places overlay fetch failed",
            err,
          ),
        );
    }
  }, [
    effectivePlacesOverlay,
    placesOverlayUrl,
    showPlacesOverlay,
    mapReady,
    mapRef,
    placesLayerRef,
  ]);

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
  }, [geojson, mapReady, mapRef, geojsonLayerRef]);

  return { buildings, setBuildings };
}
