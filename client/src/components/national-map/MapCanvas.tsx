import { useState } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./nationalMap.css";
import { basemapById, type BasemapId } from "../maps/schoolMap";
import { HOME_VIEW, type LatLng, type MapView } from "./geo";
import type { MapRegion } from "./region";
import type { OverlayId, PlottedSchool, ProvinceSummary, ToolMode, ViewRequest } from "./types";
import { DistrictLayer, LakeLayer, ProvinceLabels, ProvinceLayer, RwandaFocus } from "./layers/RegionLayers";
import { SchoolLayer } from "./layers/SchoolLayer";
import {
  CursorReadout,
  MeasureLayer,
  MeLayer,
  NearestLayer,
  ScaleBar,
  ToolClicks,
  ViewController,
} from "./layers/ToolLayers";

/** Custom panes so region art sits under the school pins and labels never eat clicks. */
function Panes() {
  const map = useMap();
  if (!map.getPane("nm-mask")) {
    map.createPane("nm-mask").style.zIndex = "350";
    const labels = map.createPane("nm-labels");
    labels.style.zIndex = "550";
    labels.style.pointerEvents = "none";
    map.createPane("nm-density").style.zIndex = "390";
  }
  return null;
}

function ZoomWatcher({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMapEvents({ zoomend: () => onZoom(map.getZoom()) });
  return null;
}

export interface MapCanvasProps {
  theme: "light" | "dark";
  basemap: BasemapId;
  overlays: Set<OverlayId>;
  region: MapRegion | null;
  points: PlottedSchool[];
  selectedId: string | null;
  hoverId: string | null;
  /** Province lit from the panel chips / search preview. */
  previewProvince: string | null;
  /** Priority band spotlighted from the legend (others fade). */
  focusBand: string | null;
  activeProvince: string;
  provinceSummaries: ProvinceSummary[];
  tool: ToolMode;
  measurePoints: LatLng[];
  nearestOrigin: LatLng | null;
  nearestTargets: LatLng[];
  me: { lat: number; lng: number; acc: number } | null;
  viewRequest: ViewRequest | null;
  initialView: MapView | null;
  /** Selected school on first load (when the URL has no view): centre on it once. */
  pendingFocus: LatLng | null;
  expectFocus: boolean;
  padding: [number, number, number, number];
  reduceMotion: boolean;
  cursorTarget: HTMLElement | null;
  onSelect: (p: PlottedSchool) => void;
  onHover: (id: string | null) => void;
  onProvinceClick: (name: string) => void;
  /** Schools per district name, and the selected district. */
  districtCounts: Record<string, number>;
  activeDistrict: string;
  onDistrictClick: (name: string) => void;
  onToolPoint: (p: LatLng) => void;
  onView: (v: string) => void;
  onBounds: (b: L.LatLngBounds, zoom: number) => void;
}

/** The Leaflet stage: basemap, Rwanda/province art, schools and tool layers. */
export function MapCanvas(props: MapCanvasProps) {
  const { theme, basemap, overlays, region } = props;
  const def = basemapById(basemap);
  const tone = def.tone?.(theme) ?? null;
  const imagery = basemap === "satellite";
  const ref = def.reference?.(theme) ?? null;
  const [zoom, setZoom] = useState(HOME_VIEW.zoom);

  return (
    <MapContainer
      center={[HOME_VIEW.lat, HOME_VIEW.lng]}
      zoom={HOME_VIEW.zoom}
      minZoom={6}
      maxZoom={18}
      zoomSnap={0.25}
      zoomDelta={1}
      wheelPxPerZoomLevel={90}
      className="absolute inset-0 h-full w-full"
      zoomControl={false}
      attributionControl={false}
      scrollWheelZoom
      keyboard
      worldCopyJump={false}
      maxBounds={[
        [-12, 20],
        [8, 40],
      ]}
    >
      <Panes />
      <ZoomWatcher onZoom={setZoom} />
      <TileLayer
        key={`${def.id}-${theme}-base`}
        url={def.base(theme)}
        maxZoom={18}
        maxNativeZoom={def.maxZoom}
        className={tone ? `scm-tiles--${tone}` : undefined}
      />
      {/* Our province labels replace the tiles' own region names at low zoom. */}
      {ref && !(overlays.has("labels") && zoom < 10) && <TileLayer key={`${def.id}-${theme}-ref`} url={ref} maxZoom={18} maxNativeZoom={def.maxZoom} className="nm-ref-tiles" />}

      {region && (
        <>
          <RwandaFocus region={region} theme={theme} imagery={imagery} dim={overlays.has("focus")} />
          {/* On imagery the real shoreline is visible; the drawn lake would only blur it. */}
          {overlays.has("lake") && !imagery && <LakeLayer region={region} theme={theme} />}
          <ProvinceLayer
            region={region}
            theme={theme}
            imagery={imagery}
            active={props.activeProvince}
            summaries={props.provinceSummaries}
            interactive={props.tool === "none" && overlays.has("provinces")}
            showBorders={overlays.has("provinces")}
            preview={props.previewProvince}
            onClick={props.onProvinceClick}
          />
          {overlays.has("districts") && (
            <DistrictLayer
              region={region}
              theme={theme}
              imagery={imagery}
              zoom={zoom}
              counts={props.districtCounts}
              active={props.activeDistrict}
              interactive={props.tool === "none"}
              onClick={props.onDistrictClick}
            />
          )}
          {overlays.has("labels") && (
            <ProvinceLabels
              region={region}
              summaries={props.provinceSummaries}
              active={props.activeProvince}
              zoom={zoom}
            />
          )}
        </>
      )}

      <SchoolLayer
        points={props.points}
        selectedId={props.selectedId}
        hoverId={props.hoverId}
        focusBand={props.focusBand}
        cluster={overlays.has("clusters")}
        density={overlays.has("density")}
        onSelect={props.onSelect}
        onHover={props.onHover}
      />

      <ToolClicks mode={props.tool} onPoint={props.onToolPoint} />
      <MeasureLayer mode={props.tool} points={props.measurePoints} />
      {props.tool === "nearest" && <NearestLayer origin={props.nearestOrigin} targets={props.nearestTargets} />}
      <MeLayer me={props.me} />
      <ScaleBar />
      <CursorReadout target={props.cursorTarget} />
      <ViewController
        request={props.viewRequest}
        initialView={props.initialView}
        pendingFocus={props.pendingFocus}
        expectFocus={props.expectFocus}
        padding={props.padding}
        reduceMotion={props.reduceMotion}
        onView={props.onView}
        onBounds={props.onBounds}
      />
    </MapContainer>
  );
}
