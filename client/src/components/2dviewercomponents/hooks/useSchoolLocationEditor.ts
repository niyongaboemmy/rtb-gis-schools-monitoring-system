import { useEffect, useRef } from "react";
import type Map from "ol/Map";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import Translate from "ol/interaction/Translate";
import Collection from "ol/Collection";
import { fromLonLat, toLonLat } from "ol/proj";
import { Style, Icon } from "ol/style";

/** Teardrop pin SVG (data URI) used for the draggable school-location marker. */
const PIN_SVG =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="52" viewBox="0 0 40 52">
      <defs><filter id="s" x="-40%" y="-20%" width="180%" height="160%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.45"/></filter></defs>
      <path filter="url(#s)" d="M20 2C11 2 4 9 4 18c0 11 16 30 16 30s16-19 16-30C36 9 29 2 20 2z"
        fill="#e11d48" stroke="#fff" stroke-width="2.5"/>
      <circle cx="20" cy="18" r="6" fill="#fff"/>
    </svg>`,
  );

interface Options {
  mapRef: React.MutableRefObject<Map | null>;
  mapReady: boolean;
  /** Whether the "set school location" tool is currently active. */
  active: boolean;
  /** Starting position [lng, lat]; null → drop the pin at the current map centre. */
  initialLonLat: [number, number] | null;
  /** Fires with [lng, lat] whenever the pin is placed or dragged. */
  onChange: (lonLat: [number, number]) => void;
  /**
   * Shared flag that suppresses the viewer's feature-select / draw handlers
   * while the pin tool owns map clicks.
   */
  isDrawingRef: React.MutableRefObject<boolean>;
}

/**
 * Adds a single draggable marker to the map while `active`. The marker can be
 * dragged, or repositioned by clicking anywhere on the map. Every move reports
 * the new [lng, lat] through `onChange` — persisting it is the caller's job.
 */
export function useSchoolLocationEditor({
  mapRef,
  mapReady,
  active,
  initialLonLat,
  onChange,
  isDrawingRef,
}: Options) {
  const onChangeRef = useRef(onChange);
  const initialRef = useRef(initialLonLat);

  useEffect(() => {
    onChangeRef.current = onChange;
    initialRef.current = initialLonLat;
  });

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !active) return;

    const start =
      initialRef.current ??
      (toLonLat(map.getView().getCenter() ?? [0, 0]) as [number, number]);

    const feature = new Feature({ geometry: new Point(fromLonLat(start)) });
    const source = new VectorSource({ features: [feature] });
    const layer = new VectorLayer({
      source,
      zIndex: 9999,
      style: new Style({
        image: new Icon({
          src: PIN_SVG,
          anchor: [0.5, 1],
          scale: 1,
        }),
      }),
    });
    map.addLayer(layer);

    const translate = new Translate({ features: new Collection([feature]) });
    map.addInteraction(translate);

    const emit = () => {
      const geom = feature.getGeometry();
      if (!geom) return;
      const [lng, lat] = toLonLat(geom.getCoordinates()) as [number, number];
      onChangeRef.current([lng, lat]);
    };

    translate.on("translateend", emit);

    const onClick = (evt: { coordinate: number[] }) => {
      feature.setGeometry(new Point(evt.coordinate));
      emit();
    };
    map.on("singleclick", onClick);

    // Nudge cursor + suppress the viewer's own click handlers.
    const prevDrawing = isDrawingRef.current;
    isDrawingRef.current = true;
    const target = map.getTargetElement();
    if (target) target.style.cursor = "crosshair";

    // Report the seed position so the panel shows coordinates immediately.
    onChangeRef.current(start);

    return () => {
      translate.un("translateend", emit);
      map.un("singleclick", onClick);
      map.removeInteraction(translate);
      map.removeLayer(layer);
      source.dispose();
      isDrawingRef.current = prevDrawing;
      if (target) target.style.cursor = "";
    };
  }, [mapRef, mapReady, active, isDrawingRef]);
}
