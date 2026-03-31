import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "../ui/button";
import {
  X,
  MapPin,
  Map as MapIcon,
  Satellite,
  Mountain,
  Navigation,
  Crosshair,
  Check,
  RotateCcw,
  Building2,
} from "lucide-react";

// ─── Constants ───────────────────────────────────────────────────────────────

const rwandaCenter: [number, number] = [-1.9403, 29.8739];

type MapView = "street" | "satellite" | "terrain";

const tileLayers: Record<
  MapView,
  { url: string; attribution: string; label: string; Icon: React.ElementType }
> = {
  street: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
    label: "Street",
    Icon: MapIcon,
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "&copy; Esri World Imagery",
    label: "Satellite",
    Icon: Satellite,
  },
  terrain: {
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenTopoMap contributors",
    label: "Terrain",
    Icon: Mountain,
  },
};

// ─── Custom pin icon ──────────────────────────────────────────────────────────

function makeBuildingPin(picking: boolean) {
  const primary = picking ? "#f59e0b" : "#6366f1";
  const ring = picking ? "#fef3c7" : "#e0e7ff";
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:32px;height:40px;filter:drop-shadow(0 4px 6px rgba(0,0,0,0.25))">
      <svg width="32" height="40" viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 0C7.163 0 0 7.163 0 16c0 11.5 16 24 16 24S32 27.5 32 16C32 7.163 24.837 0 16 0z" fill="${primary}"/>
        <circle cx="16" cy="16" r="9" fill="${ring}"/>
        <circle cx="16" cy="16" r="5" fill="${primary}"/>
      </svg>
    </div>`,
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -40],
  });
}

// ─── Map sub-components ───────────────────────────────────────────────────────

function PickClickHandler({
  pickMode,
  onPick,
}: {
  pickMode: boolean;
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (pickMode) onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function CursorController({ pickMode }: { pickMode: boolean }) {
  const map = useMap();
  useEffect(() => {
    map.getContainer().style.cursor = pickMode ? "crosshair" : "";
  }, [pickMode, map]);
  return null;
}

function FlyTo({
  lat,
  lng,
  zoom,
  trigger,
}: {
  lat: number;
  lng: number;
  zoom: number;
  trigger: number; // increment to force a fly
}) {
  const map = useMap();
  useEffect(() => {
    if (lat !== 0 && lng !== 0) {
      map.flyTo([lat, lng], zoom, { animate: true, duration: 0.7 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);
  return null;
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export interface BuildingGeoLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (lat: number, lng: number) => void;
  initialLat?: number | null;
  initialLng?: number | null;
  /** School's saved coordinates — used as default center when building has no location */
  schoolLat?: number | null;
  schoolLng?: number | null;
  buildingName?: string;
}

export function BuildingGeoLocationModal({
  isOpen,
  onClose,
  onSave,
  initialLat,
  initialLng,
  schoolLat,
  schoolLng,
  buildingName,
}: BuildingGeoLocationModalProps) {
  const [mapView, setMapView] = useState<MapView>("satellite");
  const [pickMode, setPickMode] = useState(false);
  const [pinLat, setPinLat] = useState<number | null>(null);
  const [pinLng, setPinLng] = useState<number | null>(null);
  const [flyTrigger, setFlyTrigger] = useState(0);

  // Decide the initial map center: building → school → Rwanda
  const getInitialCenter = useCallback((): [number, number] => {
    if (initialLat && initialLng) return [initialLat, initialLng];
    if (schoolLat && schoolLng) return [schoolLat, schoolLng];
    return rwandaCenter;
  }, [initialLat, initialLng, schoolLat, schoolLng]);

  const getInitialZoom = useCallback((): number => {
    if (initialLat && initialLng) return 18;
    if (schoolLat && schoolLng) return 17;
    return 9;
  }, [initialLat, initialLng, schoolLat, schoolLng]);

  // Sync draft pin when modal opens
  useEffect(() => {
    if (isOpen) {
      setPinLat(initialLat ?? null);
      setPinLng(initialLng ?? null);
      // No location yet → auto-enable pick mode
      setPickMode(!initialLat && !initialLng);
    }
  }, [isOpen, initialLat, initialLng]);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const handlePick = (lat: number, lng: number) => {
    setPinLat(parseFloat(lat.toFixed(7)));
    setPinLng(parseFloat(lng.toFixed(7)));
  };

  const handleFlyToSchool = () => {
    if (schoolLat && schoolLng) {
      setPinLat(null);
      setPinLng(null);
      setFlyTrigger((n) => n + 1);
    }
  };

  const handleSave = () => {
    if (pinLat !== null && pinLng !== null) {
      onSave(pinLat, pinLng);
      onClose();
    }
  };

  const initialCenter = getInitialCenter();
  const initialZoom = getInitialZoom();

  // For FlyTo after school button click
  const flyLat = schoolLat ?? rwandaCenter[0];
  const flyLng = schoolLng ?? rwandaCenter[1];

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="geo-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-70 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            key="geo-modal"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed inset-4 sm:inset-8 z-71 flex flex-col bg-background rounded-3xl border border-border overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/30 bg-background/95 backdrop-blur shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10">
                  <Building2 className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-foreground">
                    Building Location
                  </h3>
                  {buildingName && (
                    <p className="text-xs text-muted-foreground">{buildingName}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Tile switcher */}
                <div className="flex items-center gap-0.5 bg-muted/80 rounded-xl p-1">
                  {(Object.entries(tileLayers) as [MapView, typeof tileLayers.street][]).map(
                    ([key, { label, Icon }]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setMapView(key)}
                        title={label}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          mapView === key
                            ? "bg-background text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{label}</span>
                      </button>
                    ),
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex items-center justify-center w-8 h-8 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ── Map ── */}
            <div className="relative flex-1 overflow-hidden">
              <MapContainer
                center={initialCenter}
                zoom={initialZoom}
                style={{ height: "100%", width: "100%" }}
                className="z-0"
                zoomControl={false}
              >
                <TileLayer
                  key={mapView}
                  url={tileLayers[mapView].url}
                  attribution={tileLayers[mapView].attribution}
                />
                <PickClickHandler pickMode={pickMode} onPick={handlePick} />
                <CursorController pickMode={pickMode} />
                <FlyTo
                  lat={flyLat}
                  lng={flyLng}
                  zoom={17}
                  trigger={flyTrigger}
                />
                {pinLat !== null && pinLng !== null && (
                  <Marker
                    position={[pinLat, pinLng]}
                    icon={makeBuildingPin(pickMode)}
                    draggable
                    eventHandlers={{
                      dragend(e) {
                        const { lat, lng } = (e.target as L.Marker).getLatLng();
                        handlePick(lat, lng);
                      },
                    }}
                  />
                )}
              </MapContainer>

              {/* Floating toolbar — bottom-left */}
              <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-2">
                {/* Pick mode toggle */}
                <button
                  type="button"
                  onClick={() => setPickMode((v) => !v)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    pickMode
                      ? "bg-amber-500 text-white border-amber-400"
                      : "bg-background/95 text-foreground border-border hover:border-primary/40"
                  }`}
                  title={pickMode ? "Click anywhere on the map to move the pin" : "Enable pin placement"}
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  {pickMode ? "Click map to place pin" : "Change Pin"}
                </button>

                {/* Fly to school */}
                {(schoolLat || schoolLng) && (
                  <button
                    type="button"
                    onClick={handleFlyToSchool}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-background/95 text-foreground border border-border hover:border-primary/40 transition-all"
                    title="Center map on school location"
                  >
                    <Navigation className="w-3.5 h-3.5 text-primary" />
                    Go to School
                  </button>
                )}
              </div>

              {/* Coordinates pill — top-center */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
                {pinLat !== null && pinLng !== null ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/95 backdrop-blur border border-border text-xs font-mono text-foreground">
                    <MapPin className="w-3 h-3 text-primary shrink-0" />
                    {pinLat.toFixed(6)}, {pinLng.toFixed(6)}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/95 backdrop-blur border border-border text-xs text-muted-foreground">
                    <Crosshair className="w-3 h-3 animate-pulse" />
                    Click on the map to place pin
                  </div>
                )}
              </div>

              {/* Pick mode overlay hint */}
              {pickMode && pinLat === null && (
                <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2 px-6 py-4 rounded-2xl bg-background/80 backdrop-blur border border-border">
                    <Crosshair className="w-8 h-8 text-amber-500 animate-pulse" />
                    <p className="text-sm font-semibold text-foreground">Click anywhere to place the pin</p>
                    {(schoolLat || schoolLng) && (
                      <p className="text-xs text-muted-foreground">Centered on school location</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Footer ── */}
            <div className="flex items-center justify-between px-5 py-4 border-t border-border/20 bg-muted/10 shrink-0">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                {pinLat !== null ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-green-500" />
                    Location set — drag pin or click map to adjust
                  </>
                ) : (
                  <>
                    <MapPin className="w-3.5 h-3.5" />
                    No location set yet
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                {pinLat !== null && (
                  <button
                    type="button"
                    onClick={() => { setPinLat(null); setPinLng(null); setPickMode(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Clear
                  </button>
                )}
                <Button type="button" variant="outline" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSave}
                  disabled={pinLat === null || pinLng === null}
                >
                  <Check className="w-3.5 h-3.5 mr-1" />
                  Confirm Location
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
