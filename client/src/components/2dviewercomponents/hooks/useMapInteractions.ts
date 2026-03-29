import { useEffect, useRef } from "react";
import OLMap from "ol/Map";
import Draw from "ol/interaction/Draw";
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
}: UseMapInteractionsProps) {
  const activeDrawRef = useRef<Draw | null>(null);

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

    let sketch: any = null;
    draw.on("drawstart", (evt) => {
      source.clear();
      sketch = evt.feature;
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
      map.un("pointermove", pointerMoveHandler);
    });

    return () => {
      map.removeInteraction(draw);
      map.un("pointermove", pointerMoveHandler);
    };
  }, [measurementMode, mapReady]);

  // ── Interaction: Create Block / Annotate ──────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || activeTool === "none" || activeTool === "select") return;

    let type: "Point" | "LineString" | "Polygon" = "Point";
    if (activeTool === "annotate_line") type = "LineString";
    if (activeTool === "annotate_poly") type = "Polygon";

    const draw = new Draw({
      type,
      style: type === "Point" ? blockStyle : annotationStyle,
    });

    draw.on("drawend", (evt) => {
      const geom = evt.feature.getGeometry();
      if (!geom) return;
      const rawCoords = (geom as any).getCoordinates();

      let lat: number, lng: number;
      let annoCoords: number[] = [];

      if (geom instanceof OLPoint) {
        const [lon, la] = toLonLat(rawCoords);
        lng = lon; lat = la;
        annoCoords = [lon, la];
      } else if (geom instanceof LineString) {
        const first = toLonLat(rawCoords[0]);
        lng = first[0]; lat = first[1];
        annoCoords = rawCoords.map((c: any) => toLonLat(c)).flat();
      } else if (geom instanceof Polygon) {
        const first = toLonLat(rawCoords[0][0]);
        lng = first[0]; lat = first[1];
        annoCoords = rawCoords[0].map((c: any) => toLonLat(c)).flat();
      } else {
        const first = toLonLat(Array.isArray(rawCoords[0]) ? (Array.isArray(rawCoords[0][0]) ? rawCoords[0][0] : rawCoords[0]) : rawCoords);
        lng = first[0]; lat = first[1];
        annoCoords = rawCoords;
      }

      if (activeTool === "create_block") {
        const newBuilding: BuildingData = {
          id: `new-${Date.now()}`,
          buildingName: "",
          buildingCode: "",
          buildingFunction: "",
          buildingFloors: "1",
          buildingArea: "",
          buildingYearBuilt: new Date().getFullYear().toString(),
          buildingCondition: "good",
          buildingRoofCondition: "good",
          buildingStructuralScore: "100",
          buildingNotes: "",
          facilities: [],
          geolocation: { latitude: lat, longitude: lng },
          annotations: [],
          media: [],
        };
        setDrawerBuilding(newBuilding);
        setDrawerOpen(true);
      } else if (activeTool.startsWith("annotate")) {
        if (activeBlock) {
          const newAnn = {
            id: `ann-${Date.now()}`,
            type: activeTool.split("_")[1] as any,
            content: "New annotation",
            coordinates: annoCoords,
            style: {},
            createdAt: new Date().toISOString(),
          };
          const updated = { ...activeBlock, annotations: [...(activeBlock.annotations || []), newAnn] };
          handleSaveBuilding(updated);
        }
      }
      setActiveTool("select");
    });

    map.addInteraction(draw);
    activeDrawRef.current = draw;
    return () => {
      map.removeInteraction(draw);
      activeDrawRef.current = null;
    };
  }, [activeTool, activeBlock, mapReady]);

  return { activeDrawRef };
}
