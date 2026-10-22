import { useCallback, useEffect, useRef } from "react";
import OLMap from "ol/Map";
import Draw from "ol/interaction/Draw";
import Snap from "ol/interaction/Snap";
import {
  areaOf3857,
  lengthOf3857,
  perimeterOf3857,
} from "../../../lib/measure/geodesic";
import { validatePolygon } from "../../../lib/measure/geometry3d";
import { wgs84ToEnu } from "../../../lib/geo-bridge";
import { accuracyLabel, isTypingTarget } from "../../../lib/viewer-tools";
import { LineString, Polygon, Point as OLPoint } from "ol/geom";
import { toLonLat } from "ol/proj";
import {
  measureStyle,
  blockStyle,
  annotationStyle,
  selectionStyle,
  formatLength,
  formatArea,
} from "../MapUtils";
import type { BuildingData } from "../../school-form-steps/BuildingsStep";

interface UseMapInteractionsProps {
  mapRef: React.MutableRefObject<OLMap | null>;
  mapReady: boolean;
  activeTool: string;
  setActiveTool: (tool: any) => void;
  measurementMode: "none" | "distance" | "area" | "perimeter";
  setMeasurementMode: React.Dispatch<
    React.SetStateAction<"none" | "distance" | "area" | "perimeter">
  >;
  /** Number of placed points while sketching (drives undo / finish UI). */
  onSketchPoints?: (n: number) => void;
  setMeasureResult: (res: string | null) => void;
  tooltipOverlayRef: React.MutableRefObject<any>;
  measureSourceRef: React.MutableRefObject<any>;
  activeBlock: BuildingData | null;
  handleSaveBuilding: (data: BuildingData) => Promise<void>;
  handleSaveSiteAnnotation: (payload: any) => Promise<void>;
  onAnnotationReady: (pending: any) => void;
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
  setMeasurementMode,
  setMeasureResult,
  tooltipOverlayRef,
  measureSourceRef,
  activeBlock,
  handleSaveBuilding: _handleSaveBuilding,
  handleSaveSiteAnnotation: _handleSaveSiteAnnotation,
  onAnnotationReady,
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
  onSketchPoints,
}: UseMapInteractionsProps) {
  const activeDrawRef = useRef<Draw | null>(null);
  const snapRef = useRef<Snap | null>(null);

  // ── Unified Measurement & Drawing Logic ────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (activeDrawRef.current) map.removeInteraction(activeDrawRef.current);
    if (snapRef.current) map.removeInteraction(snapRef.current);

    const isMeasurement = measurementMode !== "none";
    const isAnnotation =
      activeTool !== "none" &&
      activeTool !== "select" &&
      activeTool !== "create_block" &&
      activeTool !== "set_location";
    const isCreatingBlock = activeTool === "create_block";

    if (!isMeasurement && !isAnnotation && !isCreatingBlock) return;

    // ── Determine Geometry Type ──────────────────────────────────────────────
    let type: "Point" | "LineString" | "Polygon" = "Point";
    if (measurementMode === "distance" || activeTool === "annotate_line")
      type = "LineString";
    if (
      measurementMode === "area" ||
      measurementMode === "perimeter" ||
      activeTool === "annotate_poly" ||
      isCreatingBlock
    )
      type = "Polygon";
    if (activeTool === "annotate_point" || activeTool === "annotate_text")
      type = "Point";

    // ── Interaction Setup ───────────────────────────────────────────────────
    const source = isMeasurement ? measureSourceRef.current : undefined;
    const draw = new Draw({
      source,
      type,
      style:
        isCreatingBlock || isMeasurement
          ? measureStyle
          : type === "Point"
            ? blockStyle
            : annotationStyle,
    });

    const snap = new Snap({
      source: blocksLayerRef.current?.getSource() || undefined,
      pixelTolerance: 12,
    });

    map.addInteraction(draw);
    map.addInteraction(snap);
    activeDrawRef.current = draw;
    snapRef.current = snap;

    let sketch: any = null;

    const pointerMoveHandler = () => {
      if (!sketch) return;
      const geom = sketch.getGeometry();
      let output = "";
      let coord: any;
      if (geom instanceof LineString) {
        output = formatLength(lengthOf3857(geom));
        coord = geom.getLastCoordinate();
        onSketchPoints?.(Math.max(0, geom.getCoordinates().length - 1));
      } else if (geom instanceof Polygon) {
        output =
          measurementMode === "perimeter"
            ? formatLength(perimeterOf3857(geom))
            : formatArea(areaOf3857(geom));
        coord = geom.getInteriorPoint().getCoordinates();
        onSketchPoints?.(Math.max(0, (geom.getCoordinates()[0]?.length ?? 2) - 2));
      }

      // Update HUD if it's a measurement or block creation
      if (isMeasurement || isCreatingBlock) {
        setMeasureResult(output);
      }
      // Tooltip carries the stated (provisional) accuracy (WS6.5).
      const accuracy = isMeasurement && output ? accuracyLabel("2d") : "";

      // Update Tooltip for Measurements or Area/Path Annotations
      const needsTooltip =
        isMeasurement ||
        activeTool === "annotate_line" ||
        activeTool === "annotate_poly" ||
        isCreatingBlock;
      if (needsTooltip && tooltipOverlayRef.current) {
        tooltipOverlayRef.current.setPosition(coord);
        const element = tooltipOverlayRef.current.getElement();
        if (element) {
          // Built from text nodes, never innerHTML.
          element.textContent = output;
          if (accuracy) {
            const note = document.createElement("span");
            note.style.opacity = ".7";
            note.textContent = ` ${accuracy}`;
            element.appendChild(note);
          }
          element.style.display = "block";
        }
      }
    };

    draw.on("drawstart", (evt) => {
      if (isMeasurement) source.clear();
      sketch = evt.feature;
      isDrawingRef.current = true;
      map.on("pointermove", pointerMoveHandler);
    });

    draw.on("drawend", (evt) => {
      const geom = evt.feature.getGeometry();
      sketch = null;
      isDrawingRef.current = false;
      map.un("pointermove", pointerMoveHandler);

      if (tooltipOverlayRef.current) {
        tooltipOverlayRef.current.setPosition(undefined);
      }

      if (!geom) return;
      const rawCoords = (geom as any).getCoordinates();

      let lat = 0,
        lng = 0;
      let annoCoords: number[] = [];
      let footprintCoords: number[] = [];
      let initialDescription = "";
      let areaSquareMeters = 0;
      let lengthMeters = 0;
      let perimeterMeters = 0;
      let warning: string | null = null;

      if (geom instanceof OLPoint) {
        const [lon, la] = toLonLat(rawCoords);
        lng = lon;
        lat = la;
        annoCoords = [lon, la];
      } else if (geom instanceof LineString) {
        const first = toLonLat(rawCoords[0]);
        lng = first[0];
        lat = first[1];
        annoCoords = rawCoords.map((c: any) => toLonLat(c)).flat();
        lengthMeters = lengthOf3857(geom);
        initialDescription = `Length: ${formatLength(lengthMeters)}`;
      } else if (geom instanceof Polygon) {
        const interior = geom.getInteriorPoint().getCoordinates();
        const interiorLonLat = toLonLat(interior);
        lng = interiorLonLat[0];
        lat = interiorLonLat[1];
        footprintCoords = rawCoords[0].map((c: any) => toLonLat(c)).flat();
        annoCoords = footprintCoords;
        areaSquareMeters = areaOf3857(geom);
        perimeterMeters = perimeterOf3857(geom);
        initialDescription =
          measurementMode === "perimeter"
            ? `Perimeter: ${formatLength(perimeterMeters)}`
            : `Area: ${formatArea(areaSquareMeters)}`;
        // Same validity rules as 3D: warn on a self-crossing outline.
        const ring: number[][] = rawCoords[0].map((c: number[]) => toLonLat(c));
        if (ring.length > 3) {
          const o = { lng: ring[0][0], lat: ring[0][1], alt: 0 };
          const v = validatePolygon(
            ring.slice(0, -1).map((p) => {
              const e = wgs84ToEnu({ lng: p[0], lat: p[1], alt: 0 }, o);
              return { x: e.e, y: 0, z: -e.n };
            }),
          );
          warning = v.message;
        }
      }

      // ── Finish Logic ────────────────────────────────────────────────────────
      if (isMeasurement) {
        setMeasureResult(null);
        onSketchPoints?.(0);
        onAnnotationReady({
          id: `meas-${Date.now()}`,
          measureKind: `measure_${measurementMode}`,
          type: measurementMode === "distance" ? "line" : "polygon",
          coordinates: annoCoords,
          activeBlock: null,
          initialDescription,
          title:
            measurementMode === "distance"
              ? "Distance"
              : measurementMode === "perimeter"
                ? "Perimeter"
                : "Area",
          areaSquareMeters,
          lengthMeters: measurementMode === "perimeter" ? perimeterMeters : lengthMeters,
          perimeterMeters,
          warning,
        });
        setMeasurementMode("none");
      } else if (isCreatingBlock) {
        setMeasureResult(null);
        const areaRaw = areaSquareMeters.toFixed(1);

        const newBuilding: BuildingData = {
          id: `new-${Date.now()}`,
          buildingName: "",
          buildingCode: "",
          buildingFunction: "",
          // Only the drawn footprint area is measured; the rest is blank
          // until the surveyor records it (no fabricated "new, perfect" block).
          buildingFloors: "",
          buildingArea: areaRaw,
          buildingYearBuilt: "",
          buildingCondition: "",
          buildingRoofCondition: "",
          buildingStructuralScore: "",
          buildingNotes: "",
          facilities: [],
          geolocation: { latitude: lat, longitude: lng },
          annotations:
            footprintCoords.length > 0
              ? [
                  {
                    id: `footprint-${Date.now()}`,
                    type: "polygon",
                    content: "Footprint",
                    coordinates: footprintCoords,
                    isFootprint: true,
                    areaSquareMeters: parseFloat(areaRaw),
                    style: {
                      color: "#6366f1",
                      fill: "rgba(99, 102, 241, 0.25)",
                      strokeWidth: 3,
                    },
                    createdAt: new Date().toISOString(),
                  },
                ]
              : [],
          media: [],
        };
        setDrawerBuilding(newBuilding);
        setDrawerOpen(true);
        setActiveTool("select");
      } else if (isAnnotation) {
        let annType = activeTool.split("_")[1];
        if (annType === "poly") annType = "polygon";
        onAnnotationReady({
          id: `ann-${Date.now()}`,
          type: annType as any,
          coordinates: annoCoords,
          footprintCoords,
          activeBlock,
          initialDescription,
          areaSquareMeters,
          lengthMeters,
        });
        setActiveTool("select");
      }
    });

    return () => {
      map.removeInteraction(draw);
      map.removeInteraction(snap);
      map.un("pointermove", pointerMoveHandler);
      activeDrawRef.current = null;
      snapRef.current = null;
      isDrawingRef.current = false;
    };
  }, [measurementMode, activeTool, mapReady, activeBlock]);

  // ── Shared drawing controls: undo / finish / cancel (WS4.3) ──────────────
  const undoLastPoint = useCallback(() => {
    activeDrawRef.current?.removeLastPoint();
  }, []);
  const finishDrawing = useCallback(() => {
    activeDrawRef.current?.finishDrawing();
  }, []);
  const cancelDrawing = useCallback(() => {
    activeDrawRef.current?.abortDrawing();
    tooltipOverlayRef.current?.setPosition(undefined);
    setMeasureResult(null);
    onSketchPoints?.(0);
    if (measurementMode !== "none") {
      measureSourceRef.current?.clear();
      setMeasurementMode("none");
    } else if (activeTool !== "none" && activeTool !== "select") {
      setActiveTool("none");
    }
  }, [measurementMode, activeTool, setMeasurementMode, setActiveTool, setMeasureResult, onSketchPoints, tooltipOverlayRef, measureSourceRef]);

  // Keyboard: Backspace / Ctrl+Z undo, Enter finish, Esc cancel.
  useEffect(() => {
    if (measurementMode === "none" && (activeTool === "none" || activeTool === "select")) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.key === "Escape") {
        e.preventDefault();
        cancelDrawing();
      } else if (e.key === "Backspace" || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z")) {
        if (!activeDrawRef.current) return;
        e.preventDefault();
        undoLastPoint();
      } else if (e.key === "Enter") {
        if (!activeDrawRef.current) return;
        e.preventDefault();
        finishDrawing();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [measurementMode, activeTool, cancelDrawing, undoLastPoint, finishDrawing]);

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

      map.forEachFeatureAtPixel(
        pixel,
        (feature: any, layer: any) => {
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
            return true;
          }
        },
        { hitTolerance: 10 },
      );
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
          clone.setStyle(selectionStyle);
          selectedSource.addFeature(clone);
        }
      });
    };

    findAndAdd(blocksLayerRef);
    findAndAdd(annotationLayerRef);
  }, [activeBlock, blocksLayerRef, annotationLayerRef, selectedLayerRef]);

  return { activeDrawRef, undoLastPoint, finishDrawing, cancelDrawing };
}
