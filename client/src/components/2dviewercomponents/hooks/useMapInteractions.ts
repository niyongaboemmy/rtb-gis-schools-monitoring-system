import { useEffect, useRef } from "react";
import OLMap from "ol/Map";
import Draw from "ol/interaction/Draw";
import Snap from "ol/interaction/Snap";
import { getLength, getArea } from "ol/sphere";
import { LineString, Polygon, Point as OLPoint } from "ol/geom";
import { toLonLat } from "ol/proj";
import {
  measureStyle,
  blockStyle,
  annotationStyle,
  formatLength,
  formatArea,
} from "../MapUtils";
import type { BuildingData } from "../../school-form-steps/BuildingsStep";

interface UseMapInteractionsProps {
  mapRef: React.MutableRefObject<OLMap | null>;
  mapReady: boolean;
  activeTool: string;
  setActiveTool: (tool: any) => void;
  measurementMode: "none" | "distance" | "area";
  setMeasureResult: (res: string | null) => void;
  tooltipOverlayRef: React.MutableRefObject<any>;
  measureSourceRef: React.MutableRefObject<any>;
  activeBlock: BuildingData | null;
  handleSaveBuilding: (data: BuildingData) => Promise<void>;
  setDrawerBuilding: (data: BuildingData) => void;
  setDrawerOpen: (open: boolean) => void;
  hoverLayerRef: React.MutableRefObject<any>;
  selectedLayerRef: React.MutableRefObject<any>;
  blocksLayerRef: React.MutableRefObject<any>;
  kmlLayerRef: React.MutableRefObject<any>;
  geojsonLayerRef: React.MutableRefObject<any>;
  placesLayerRef: React.MutableRefObject<any>;
  annotationLayerRef: React.MutableRefObject<any>;
  isDrawingRef: React.MutableRefObject<boolean>;
}

export function useMapInteractions({
  mapRef,
  mapReady,
  activeTool,
  setActiveTool,
  measurementMode,
  setMeasureResult,
  tooltipOverlayRef,
  measureSourceRef,
  activeBlock,
  handleSaveBuilding,
  setDrawerBuilding,
  setDrawerOpen,
  hoverLayerRef,
  selectedLayerRef,
  blocksLayerRef,
  kmlLayerRef,
  geojsonLayerRef,
  placesLayerRef,
  annotationLayerRef,
  isDrawingRef,
}: UseMapInteractionsProps) {
  const activeDrawRef = useRef<Draw | null>(null);
  const snapRef = useRef<Snap | null>(null);

  // ── Measurement Logic ──────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (activeDrawRef.current) map.removeInteraction(activeDrawRef.current);
    if (measurementMode === "none") return;

    const source = measureSourceRef.current;
    const draw = new Draw({
      source,
      type: measurementMode === "distance" ? "LineString" : "Polygon",
      style: measureStyle,
    });
    activeDrawRef.current = draw;
    map.addInteraction(draw);

    // Snapping Setup
    const snap = new Snap({ 
      source: blocksLayerRef.current?.getSource() || undefined,
      pixelTolerance: 12 
    });
    map.addInteraction(snap);
    snapRef.current = snap;

    let sketch: any = null;
    draw.on("drawstart", (evt) => {
      source.clear();
      sketch = evt.feature;
      isDrawingRef.current = true;
    });

    const pointerMoveHandler = () => {
      if (!sketch) return;
      const geom = sketch.getGeometry();
      let output = "";
      let coord: any;
      if (geom instanceof LineString) {
        output = formatLength(getLength(geom));
        coord = geom.getLastCoordinate();
      } else if (geom instanceof Polygon) {
        output = formatArea(getArea(geom));
        coord = geom.getInteriorPoint().getCoordinates();
      }
      setMeasureResult(output);
      if (tooltipOverlayRef.current) tooltipOverlayRef.current.setPosition(coord);
    };

    map.on("pointermove", pointerMoveHandler);
    draw.on("drawend", () => {
      sketch = null;
      isDrawingRef.current = false;
      map.un("pointermove", pointerMoveHandler);
    });

    return () => {
      map.removeInteraction(draw);
      map.removeInteraction(snap);
      map.un("pointermove", pointerMoveHandler);
      isDrawingRef.current = false;
    };
  }, [measurementMode, mapReady]);

  // ── Hover Highlighting ─────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !hoverLayerRef.current) return;

    const hoverSource = hoverLayerRef.current.getSource();
    if (!hoverSource) return;

    const onHover = (evt: any) => {
      if (evt.dragging || activeDrawRef.current) return;
      
      const pixel = map.getEventPixel(evt.originalEvent);
      hoverSource.clear();

      map.forEachFeatureAtPixel(pixel, (feature: any, layer: any) => {
        if (
          layer === blocksLayerRef.current ||
          layer === annotationLayerRef.current ||
          layer === kmlLayerRef.current ||
          layer === geojsonLayerRef.current ||
          layer === placesLayerRef.current
        ) {
          const clone = (feature as any).clone();
          clone.setStyle(null);
          hoverSource.addFeature(clone);
          return true; // Stop after first highlightable feature
        }
      }, { hitTolerance: 10 });
    };

    map.on("pointermove", onHover);
    return () => {
      map.un("pointermove", onHover);
      hoverSource.clear();
    };
  }, [mapReady, activeTool, measurementMode]);

  // ── Active Block Highlighting ──────────────────────────────────────────────
  useEffect(() => {
    if (!selectedLayerRef.current) return;
    const selectedSource = selectedLayerRef.current.getSource();
    if (!selectedSource) return;

    selectedSource.clear();
    
    if (!activeBlock) return;

    const findAndAdd = (layerRef: React.MutableRefObject<any>) => {
      const src = layerRef.current?.getSource();
      if (!src) return;
      src.getFeatures().forEach((f: any) => {
        const b = f.get("buildingData");
        if (b && b.id === activeBlock.id) {
          const clone = f.clone();
          clone.setStyle(null);
          selectedSource.addFeature(clone);
        }
      });
    };

    findAndAdd(blocksLayerRef);
    findAndAdd(annotationLayerRef);
  }, [activeBlock, blocksLayerRef, annotationLayerRef, selectedLayerRef]);

  // ── Interaction: Create Block / Annotate ──────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || activeTool === "none" || activeTool === "select") return;

    let type: "Point" | "LineString" | "Polygon" = "Point";
    if (activeTool === "annotate_line") type = "LineString";
    if (activeTool === "annotate_poly" || activeTool === "create_block") type = "Polygon";
    if (activeTool === "annotate_text") type = "Point";

    const draw = new Draw({
      type,
      style: activeTool === "create_block" ? measureStyle : (type === "Point" ? blockStyle : annotationStyle),
    });

    const snap = new Snap({ 
      source: blocksLayerRef.current?.getSource() || undefined,
      pixelTolerance: 12 
    });
    
    map.addInteraction(draw);
    map.addInteraction(snap);
    activeDrawRef.current = draw;

    let sketch: any = null;
    draw.on("drawstart", (evt) => {
      sketch = evt.feature;
      isDrawingRef.current = true;
    });

    const pointerMoveHandler = () => {
      if (!sketch || activeTool !== "create_block") return;
      const geom = sketch.getGeometry();
      if (geom instanceof Polygon) {
        const output = formatArea(getArea(geom));
        const coord = geom.getInteriorPoint().getCoordinates();
        setMeasureResult(output);
        if (tooltipOverlayRef.current) tooltipOverlayRef.current.setPosition(coord);
      }
    };

    if (activeTool === "create_block") {
      map.on("pointermove", pointerMoveHandler);
    }

    draw.on("drawend", (evt) => {
      sketch = null;
      isDrawingRef.current = false;
      if (activeTool === "create_block") {
        map.un("pointermove", pointerMoveHandler);
        setMeasureResult(null);
      }
      const geom = evt.feature.getGeometry();
      if (!geom) return;
      const rawCoords = (geom as any).getCoordinates();

      let lat: number, lng: number;
      let annoCoords: number[] = [];
      let footprintCoords: number[] = [];

      if (geom instanceof OLPoint) {
        const [lon, la] = toLonLat(rawCoords);
        lng = lon; lat = la;
        annoCoords = [lon, la];
      } else if (geom instanceof LineString) {
        const first = toLonLat(rawCoords[0]);
        lng = first[0]; lat = first[1];
        annoCoords = rawCoords.map((c: any) => toLonLat(c)).flat();
      } else if (geom instanceof Polygon) {
        const interior = geom.getInteriorPoint().getCoordinates();
        const interiorLonLat = toLonLat(interior);
        lng = interiorLonLat[0]; lat = interiorLonLat[1];
        footprintCoords = rawCoords[0].map((c: any) => toLonLat(c)).flat();
      } else {
        const first = toLonLat(Array.isArray(rawCoords[0]) ? (Array.isArray(rawCoords[0][0]) ? rawCoords[0][0] : rawCoords[0]) : rawCoords);
        lng = first[0]; lat = first[1];
        annoCoords = rawCoords;
      }

      if (activeTool === "create_block") {
        let areaRaw = "";
        if (geom instanceof Polygon) {
          areaRaw = getArea(geom).toFixed(1);
        }

        const newBuilding: BuildingData = {
          id: `new-${Date.now()}`,
          buildingName: "",
          buildingCode: "",
          buildingFunction: "",
          buildingFloors: "1",
          buildingArea: areaRaw,
          buildingYearBuilt: new Date().getFullYear().toString(),
          buildingCondition: "good",
          buildingRoofCondition: "good",
          buildingStructuralScore: "100",
          buildingNotes: "",
          facilities: [],
          geolocation: { latitude: lat, longitude: lng },
          annotations: footprintCoords.length > 0 ? [{
            id: `footprint-${Date.now()}`,
            type: "polygon",
            content: "Footprint",
            coordinates: footprintCoords,
            isFootprint: true,
            areaSquareMeters: parseFloat(areaRaw),
            style: { 
              color: "#6366f1", 
              fill: "rgba(99, 102, 241, 0.2)",
              strokeWidth: 3 
            },
            createdAt: new Date().toISOString()
          }] : [],
          media: [],
        };
        setDrawerBuilding(newBuilding);
        setDrawerOpen(true);
      } else if (activeTool.startsWith("annotate")) {
        const annType = activeTool.split("_")[1];
        if (activeBlock) {
          const newAnn = {
            id: `ann-${Date.now()}`,
            type: annType as any,
            content: annType === "text" ? "Label" : "New annotation",
            coordinates: annoCoords,
            style: annType === "text" ? { fontSize: 12, color: "#ffffff" } : {},
            createdAt: new Date().toISOString(),
          };
          const updated = { ...activeBlock, annotations: [...(activeBlock.annotations || []), newAnn] };
          handleSaveBuilding(updated);
        }
      }
      setActiveTool("select");
    });

    return () => {
      map.removeInteraction(draw);
      map.removeInteraction(snap);
      activeDrawRef.current = null;
      isDrawingRef.current = false;
    };
  }, [activeTool, activeBlock, mapReady]);

  return { activeDrawRef };
}
