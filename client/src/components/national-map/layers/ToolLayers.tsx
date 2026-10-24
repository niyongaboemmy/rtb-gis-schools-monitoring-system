import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Circle,
  CircleMarker,
  Marker,
  Polygon,
  Polyline,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { cumulativeLengths, formatCoord, HOME_VIEW, parseView, serializeView, type LatLng, type MapView } from "../geo";
import { formatLength } from "../../../lib/format";
import type { ToolMode, ViewRequest } from "../types";

const vertexIcon = L.divIcon({ className: "nm-vertex", html: "<span></span>", iconSize: [12, 12], iconAnchor: [6, 6] });
const originIcon = L.divIcon({ className: "nm-vertex nm-origin", html: "<span></span>", iconSize: [14, 14], iconAnchor: [7, 7] });

/** Routes map clicks to the active tool; crosshair cursor while one is on. */
export function ToolClicks({ mode, onPoint }: { mode: ToolMode; onPoint: (p: LatLng) => void }) {
  const map = useMap();
  useEffect(() => {
    if (mode === "none") return;
    const el = map.getContainer();
    el.style.cursor = "crosshair";
    map.doubleClickZoom.disable();
    return () => {
      el.style.cursor = "";
      map.doubleClickZoom.enable();
    };
  }, [mode, map]);
  useMapEvents({
    click: (e) => {
      if (mode !== "none") onPoint([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

/** Distance path or area polygon with running labels at each vertex. */
export function MeasureLayer({ mode, points }: { mode: ToolMode; points: LatLng[] }) {
  const cumulative = useMemo(() => cumulativeLengths(points), [points]);
  if (!points.length || (mode !== "distance" && mode !== "area")) return null;
  const style = { color: "#0ea5e9", weight: 2.5, dashArray: "4 7", opacity: 0.95 };
  return (
    <>
      {mode === "area" && points.length >= 3 ? (
        <Polygon positions={points} pathOptions={{ ...style, fillColor: "#38bdf8", fillOpacity: 0.16 }} interactive={false} />
      ) : (
        <Polyline positions={points} pathOptions={style} interactive={false} />
      )}
      {points.map((p, i) => (
        <Marker key={`${p[0]},${p[1]},${i}`} position={p} icon={vertexIcon} interactive={false} keyboard={false}>
          {mode === "distance" && (
            <Tooltip permanent direction="top" offset={[0, -8]} className="scm-tip scm-tip--measure">
              {i === 0 ? "Start" : formatLength(cumulative[i])}
            </Tooltip>
          )}
        </Marker>
      ))}
    </>
  );
}

/** Origin pin with dashed spokes to the nearest schools. */
export function NearestLayer({ origin, targets }: { origin: LatLng | null; targets: LatLng[] }) {
  if (!origin) return null;
  return (
    <>
      {targets.map((t, i) => (
        <Polyline
          key={`${t[0]},${t[1]},${i}`}
          positions={[origin, t]}
          interactive={false}
          pathOptions={{ color: "#8b5cf6", weight: 1.8, dashArray: "3 6", opacity: 0.85 - i * 0.1 }}
        />
      ))}
      <Marker position={origin} icon={originIcon} interactive={false} keyboard={false} />
    </>
  );
}

export function MeLayer({ me }: { me: { lat: number; lng: number; acc: number } | null }) {
  if (!me) return null;
  return (
    <>
      <Circle center={[me.lat, me.lng]} radius={me.acc} interactive={false} pathOptions={{ stroke: false, fillColor: "#3b82f6", fillOpacity: 0.12 }} />
      <CircleMarker center={[me.lat, me.lng]} radius={7} pathOptions={{ color: "#fff", weight: 2.5, fillColor: "#3b82f6", fillOpacity: 1 }}>
        <Tooltip className="scm-tip" direction="top">
          You are here
        </Tooltip>
      </CircleMarker>
    </>
  );
}

/** Live cursor coordinates, portalled into a HUD slot. */
export function CursorReadout({ target }: { target: HTMLElement | null }) {
  const [ll, setLl] = useState<L.LatLng | null>(null);
  useMapEvents({
    mousemove: (e) => setLl(e.latlng),
    mouseout: () => setLl(null),
  });
  if (!target) return null;
  return createPortal(ll ? <span>{formatCoord(ll.lat, ll.lng)}</span> : null, target);
}

/**
 * Two-way camera sync. Applies one-shot view requests (fly / bounds / home
 * / zoom), reports every settled view (for the URL) and bounds, and on mount
 * restores the URL view or opens on the home view.
 */
export function ViewController({
  request,
  initialView,
  pendingFocus,
  expectFocus,
  padding,
  reduceMotion,
  onView,
  onBounds,
}: {
  request: ViewRequest | null;
  initialView: MapView | null;
  pendingFocus: LatLng | null;
  /** A school focus is still coming (schools loading) — don't frame Rwanda yet. */
  expectFocus: boolean;
  /** [top, right, bottom, left] px kept clear for floating UI. */
  padding: [number, number, number, number];
  reduceMotion: boolean;
  onView: (v: string) => void;
  onBounds: (b: L.LatLngBounds, zoom: number) => void;
}) {
  const map = useMap();
  const done = useRef(0);
  const framed = useRef(false);
  const padRef = useRef(padding);
  const cbRef = useRef({ onView, onBounds });
  useEffect(() => {
    padRef.current = padding;
    cbRef.current = { onView, onBounds };
  });

  const opts = () => {
    const [t, r, b, l] = padRef.current;
    return { paddingTopLeft: L.point(l, t), paddingBottomRight: L.point(r, b) };
  };

  // Initial camera: the URL view; else a shared ?school= link centres on
  // that school once it loads; else the home view.
  useEffect(() => {
    if (framed.current) return;
    if (initialView) {
      framed.current = true;
      map.setView([initialView.lat, initialView.lng], initialView.zoom, { animate: false });
    } else if (pendingFocus) {
      framed.current = true;
      map.setView(pendingFocus, 14, { animate: false });
    } else if (!expectFocus) {
      framed.current = true;
      map.setView([HOME_VIEW.lat, HOME_VIEW.lng], HOME_VIEW.zoom, { animate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, pendingFocus, expectFocus]);

  // Back/forward: the URL's `v` string changed and isn't the camera's own
  // last write. Keyed on the string so unrelated URL patches (filters,
  // selection) never snap the camera back mid-flight.
  const viewKey = initialView ? serializeView(initialView) : null;
  const written = useRef<string | null>(null);
  useEffect(() => {
    const v = parseView(viewKey);
    if (!v || viewKey === written.current) return;
    const c = map.getCenter();
    if (serializeView({ lat: c.lat, lng: c.lng, zoom: map.getZoom() }) === viewKey) return;
    map.setView([v.lat, v.lng], v.zoom, { animate: !reduceMotion });
  }, [viewKey, map, reduceMotion]);

  useEffect(() => {
    if (!request || request.nonce === done.current) return;
    done.current = request.nonce;
    const animate = !reduceMotion;
    const duration = 0.9;
    switch (request.kind) {
      case "fly": {
        // Centre the target in the area left clear by the floating UI.
        const [t, r, b, l] = request.pad ?? padRef.current;
        const pt = map.project(request.center, request.zoom).add(L.point((r - l) / 2, (b - t) / 2));
        const center = map.unproject(pt, request.zoom);
        if (animate) map.flyTo(center, request.zoom, { duration });
        else map.setView(center, request.zoom, { animate: false });
        break;
      }
      case "bounds":
        map[animate ? "flyToBounds" : "fitBounds"](request.bounds, {
          ...opts(),
          maxZoom: request.maxZoom ?? 13,
          ...(animate ? { duration } : { animate: false }),
        });
        break;
      case "rwanda":
        if (animate) map.flyTo([HOME_VIEW.lat, HOME_VIEW.lng], HOME_VIEW.zoom, { duration });
        else map.setView([HOME_VIEW.lat, HOME_VIEW.lng], HOME_VIEW.zoom, { animate: false });
        break;
      case "zoom":
        if (request.delta > 0) map.zoomIn();
        else map.zoomOut();
        break;
    }
  }, [request, map, reduceMotion]);

  useMapEvents({
    moveend: () => {
      const c = map.getCenter();
      written.current = serializeView({ lat: c.lat, lng: c.lng, zoom: map.getZoom() });
      cbRef.current.onView(written.current);
      cbRef.current.onBounds(map.getBounds(), map.getZoom());
    },
  });
  useEffect(() => {
    cbRef.current.onBounds(map.getBounds(), map.getZoom());
    const ro = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);

  return null;
}

/** Native Leaflet scale bar. */
export function ScaleBar() {
  const map = useMap();
  useEffect(() => {
    const ctrl = L.control.scale({ position: "bottomright", imperial: false, maxWidth: 110 });
    ctrl.addTo(map);
    return () => {
      ctrl.remove();
    };
  }, [map]);
  return null;
}
