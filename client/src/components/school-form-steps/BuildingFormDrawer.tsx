import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Input } from "../ui/input";
import { RichDropdown } from "../ui/rich-dropdown";
import type { DropdownOption } from "../ui/rich-dropdown";
import { Button } from "../ui/button";
import type {
  BuildingData,
  FacilityItem,
  BuildingGeoLocation,
} from "./BuildingsStep";
import { BuildingGeoLocationModal } from "./BuildingGeoLocationModal";
import {
  X,
  Building2,
  Hash,
  Layers,
  Maximize2,
  Calendar,
  AlertTriangle,
  Home,
  FileText,
  Plus,
  Trash2,
  MapPin,
  DoorOpen,
  Loader2,
  Pencil,
  Navigation,
} from "lucide-react";

export interface AvailableFacility {
  id: string;
  facilityId: string;
  title: string;
  items: { id: string; label: string; tags: string[] }[];
}

const buildingConditionOptions: DropdownOption[] = [
  { label: "Good", value: "good" },
  { label: "Fair", value: "fair" },
  { label: "Poor", value: "poor" },
  { label: "Critical", value: "critical" },
];

const roofConditionOptions: DropdownOption[] = [
  { label: "Good", value: "good" },
  { label: "Fair", value: "fair" },
  { label: "Poor", value: "poor" },
  { label: "Critical", value: "critical" },
];

const createEmptyFacility = (): FacilityItem => ({
  facility_id: "",
  facility_name: "",
  number_of_rooms: 1,
});

// ── Mini-map helpers ──────────────────────────────────────────────────────────

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })
  ._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const miniPinIcon = L.divIcon({
  className: "",
  html: `<div style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3))">
    <svg width="20" height="26" viewBox="0 0 20 26" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 0C4.477 0 0 4.477 0 10c0 7.5 10 16 10 16S20 17.5 20 10C20 4.477 15.523 0 10 0z" fill="#6366f1"/>
      <circle cx="10" cy="10" r="4.5" fill="white"/>
      <circle cx="10" cy="10" r="2.5" fill="#6366f1"/>
    </svg>
  </div>`,
  iconSize: [20, 26],
  iconAnchor: [10, 26],
});

function MiniMapUpdater({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom(), { animate: false });
  }, [lat, lng, map]);
  return null;
}

interface MiniMapPreviewProps {
  lat: number | null;
  lng: number | null;
  onOpen: () => void;
}

function MiniMapPreview({
  lat: rawLat,
  lng: rawLng,
  onOpen,
}: MiniMapPreviewProps) {
  const rwandaCenter: [number, number] = [-1.9403, 29.8739];
  // lat/lng may arrive as strings from the DB — always normalise to number
  const lat =
    rawLat !== null && rawLat !== undefined ? parseFloat(String(rawLat)) : null;
  const lng =
    rawLng !== null && rawLng !== undefined ? parseFloat(String(rawLng)) : null;
  const hasLocation =
    lat !== null && !isNaN(lat) && lng !== null && !isNaN(lng);
  const center: [number, number] = hasLocation ? [lat!, lng!] : rwandaCenter;

  if (!hasLocation) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="w-full h-32 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/40 hover:border-primary/40 hover:bg-primary/3 transition-all group"
      >
        <div className="p-2 rounded-lg bg-muted group-hover:bg-primary/10 transition-colors">
          <Navigation className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
        <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
          Set building location
        </span>
      </button>
    );
  }

  return (
    <div
      className="relative rounded-xl overflow-hidden border border-border/30 h-36 group cursor-pointer"
      onClick={onOpen}
    >
      <MapContainer
        center={center}
        zoom={17}
        style={{ height: "100%", width: "100%" }}
        className="z-0"
        zoomControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        keyboard={false}
        attributionControl={false}
      >
        <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
        <MiniMapUpdater lat={lat!} lng={lng!} />
        <Marker position={[lat!, lng!]} icon={miniPinIcon} />
      </MapContainer>

      <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-all">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/95 border border-border/20 text-xs font-medium text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
          <Pencil className="w-3 h-3" />
          Change location
        </div>
      </div>

      {/* Coordinates pill */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background/90 backdrop-blur border border-border/30 shadow text-xs font-mono text-foreground whitespace-nowrap">
        <MapPin className="w-2.5 h-2.5 text-primary shrink-0" />
        {lat!.toFixed(5)}, {lng!.toFixed(5)}
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface BuildingFormDrawerProps {
  isOpen: boolean;
  building: BuildingData | null;
  buildingIndex: number;
  onSave: (data: BuildingData) => void;
  onClose: () => void;
  availableFacilities?: AvailableFacility[];
  facilitiesLoading?: boolean;
  isSaving?: boolean;
  errorMessage?: string | null;
  /** School's coordinates for auto-centering the geo modal */
  schoolLat?: number | null;
  schoolLng?: number | null;
}

// ── Main drawer ───────────────────────────────────────────────────────────────

export function BuildingFormDrawer({
  isOpen,
  building,
  buildingIndex,
  onSave,
  onClose,
  availableFacilities,
  facilitiesLoading,
  isSaving,
  errorMessage,
  schoolLat,
  schoolLng,
}: BuildingFormDrawerProps) {
  const [draft, setDraft] = useState<BuildingData | null>(null);
  const [geoModalOpen, setGeoModalOpen] = useState(false);

  // Sync draft whenever the drawer opens or building changes
  useEffect(() => {
    if (isOpen && building) {
      setDraft({
        ...building,
        facilities: building.facilities ? [...building.facilities] : [],
      });
    } else if (!isOpen) {
      // Clear draft after a short delay to allow exit animation to finish smoothly
      const timer = setTimeout(() => setDraft(null), 1000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, building]);

  // Synchronous sync during render to prevent blank frame on first open
  if (isOpen && building && !draft) {
    setDraft({
      ...building,
      facilities: building.facilities ? [...building.facilities] : [],
    });
  }

  // Escape key — only when geo modal is not open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !geoModalOpen) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose, geoModalOpen]);

  // Auto-calculate structural score
  useEffect(() => {
    if (!draft) return;
    const scoreMap: Record<string, number> = {
      good: 100,
      fair: 75,
      poor: 50,
      critical: 25,
    };

    const bScore = scoreMap[draft.buildingCondition] || 0;
    const rScore = scoreMap[draft.buildingRoofCondition] || 0;

    if (bScore > 0 && rScore > 0) {
      const average = (bScore + rScore) / 2;
      const currentScore = parseFloat(draft.buildingStructuralScore) || 0;
      if (Math.abs(currentScore - average) > 0.01) {
        setDraft((prev) =>
          prev
            ? { ...prev, buildingStructuralScore: average.toString() }
            : prev,
        );
      }
    }
  }, [draft?.buildingCondition, draft?.buildingRoofCondition]);

  // Remove the early return null to allow AnimatePresence and Portal stability
  // if (!draft) return null;

  const set = (
    field: keyof BuildingData,
    value: string | FacilityItem[] | BuildingGeoLocation,
  ) => setDraft((prev) => (prev ? { ...prev, [field]: value } : prev));

  // Facilities
  const addFacility = () => {
    if (!draft) return;
    set("facilities", [...draft.facilities, createEmptyFacility()]);
  };

  const selectFacility = (i: number, facilityId: string) => {
    if (!draft) return;
    const found = (availableFacilities || []).find(
      (f) => f.facilityId === facilityId,
    );
    set(
      "facilities",
      draft.facilities.map((f, idx) =>
        idx === i
          ? {
              ...f,
              facility_id: found?.facilityId ?? "",
              facility_name: found?.title ?? "",
            }
          : f,
      ),
    );
  };

  const setRooms = (i: number, raw: string) => {
    if (!draft) return;
    set(
      "facilities",
      draft.facilities.map((f, idx) =>
        idx === i ? { ...f, number_of_rooms: parseInt(raw) || 1 } : f,
      ),
    );
  };

  const removeFacility = (i: number) => {
    if (!draft) return;
    set(
      "facilities",
      draft.facilities.filter((_, idx) => idx !== i),
    );
  };

  const facilityOptions: DropdownOption[] = (availableFacilities || []).map(
    (af) => ({
      value: af.facilityId,
      label: af.title,
    }),
  );

  const handleGeoSave = (lat: number, lng: number) => {
    setDraft((prev) =>
      prev ? { ...prev, geolocation: { latitude: lat, longitude: lng } } : prev,
    );
  };

  const isNew = buildingIndex === -1;

  return createPortal(
    <>
      <AnimatePresence>
        {isOpen && draft && (
          <>
            {/* Backdrop */}
            <motion.div
              key="drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-9998"
              onClick={onClose}
            />

            {/* Floating Drawer Panel */}
            <motion.div
              key="drawer-panel"
              initial={{ x: "-100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "-100%", opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 220 }}
              className="fixed left-6 top-6 bottom-6 z-9999 w-full max-w-[380px] bg-background/90 backdrop-blur-3xl border border-white/10 flex flex-col rounded-[32px] overflow-hidden pointer-events-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-primary border border-primary/20 text-white">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white leading-tight">
                      {isNew ? "New Block" : `Edit Block`}
                    </h3>
                    {!isNew && draft.buildingName && (
                      <p className="text-[9px] font-black uppercase tracking-widest text-white/30 truncate max-w-[150px]">
                        {draft.buildingName}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-full text-white/20 hover:text-white hover:bg-white/10 transition-all active:scale-90 group"
                >
                  <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                {errorMessage && (
                  <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-start gap-2.5 animate-in fade-in slide-in-from-top-2 mb-4">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="font-bold uppercase tracking-wider mb-0.5">
                        Validation Error
                      </p>
                      <p className="opacity-90">{errorMessage}</p>
                    </div>
                  </div>
                )}

                {/* 1 — Location + Identity */}
                <section className="space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Location &amp; Identity
                  </p>

                  {/* Mini-map */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <MapPin className="w-3 h-3" />
                        Building Location
                      </label>
                      {draft.geolocation.latitude !== null && (
                        <button
                          type="button"
                          onClick={() => setGeoModalOpen(true)}
                          className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                        >
                          <Pencil className="w-3 h-3" />
                          Change
                        </button>
                      )}
                    </div>
                    <MiniMapPreview
                      lat={draft.geolocation.latitude}
                      lng={draft.geolocation.longitude}
                      onOpen={() => setGeoModalOpen(true)}
                    />
                  </div>

                  {/* Name + Code + Function + Year */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        <Building2 className="w-3 h-3 text-muted-foreground" />
                        Name <span className="text-destructive">*</span>
                      </label>
                      <Input
                        placeholder="e.g. Main Building"
                        value={draft.buildingName}
                        onChange={(e) => set("buildingName", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        <Hash className="w-3 h-3 text-muted-foreground" />
                        Code
                      </label>
                      <Input
                        placeholder="e.g. BLD-001"
                        value={draft.buildingCode}
                        onChange={(e) => set("buildingCode", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        <Home className="w-3 h-3 text-muted-foreground" />
                        Function
                      </label>
                      <Input
                        placeholder="e.g. Classroom, Admin"
                        value={draft.buildingFunction}
                        onChange={(e) =>
                          set("buildingFunction", e.target.value)
                        }
                      />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-muted-foreground" />
                        Year Built
                      </label>
                      <Input
                        type="number"
                        min="1900"
                        max="2030"
                        placeholder="e.g. 2015"
                        value={draft.buildingYearBuilt}
                        onChange={(e) =>
                          set("buildingYearBuilt", e.target.value)
                        }
                      />
                    </div>
                  </div>
                </section>

                {/* 2 — Physical Details */}
                <section className="space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Physical Details
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        <Layers className="w-3 h-3 text-muted-foreground" />
                        Floors
                      </label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="e.g. 2"
                        value={draft.buildingFloors}
                        onChange={(e) => set("buildingFloors", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        <Maximize2 className="w-3 h-3 text-primary" />
                        Total Footprint Area (m²)
                      </label>
                      <Input
                        placeholder="e.g. 500"
                        value={draft.buildingArea}
                        onChange={(e) => set("buildingArea", e.target.value)}
                      />
                    </div>
                  </div>
                </section>

                {/* 3 — Facilities */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Facilities
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addFacility}
                      disabled={facilitiesLoading}
                      className="h-7 px-2.5 text-xs rounded-lg border-dashed"
                    >
                      {facilitiesLoading ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Plus className="w-3 h-3 mr-1" />
                      )}
                      Add
                    </Button>
                  </div>

                  {draft.facilities.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 rounded-xl border border-dashed border-border/40 text-center gap-2">
                      <DoorOpen className="w-6 h-6 text-muted-foreground/40" />
                      <p className="text-xs text-muted-foreground">
                        No facilities added yet
                      </p>
                      <button
                        type="button"
                        onClick={addFacility}
                        className="text-xs text-primary hover:underline"
                      >
                        Add one
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-[1fr_90px_32px] gap-2 px-1">
                        <span className="text-xs font-medium text-muted-foreground">
                          Facility
                        </span>
                        <span className="text-xs font-medium text-muted-foreground">
                          Rooms
                        </span>
                        <span />
                      </div>
                      {draft.facilities.map((f, i) => (
                        <div
                          key={i}
                          className="grid grid-cols-[1fr_90px_32px] gap-2 items-center"
                        >
                          <RichDropdown
                            options={facilityOptions}
                            value={f.facility_id}
                            onChange={(val) => selectFacility(i, val)}
                            placeholder="Select…"
                          />
                          <Input
                            type="number"
                            min="1"
                            placeholder="1"
                            value={f.number_of_rooms}
                            onChange={(e) => setRooms(i, e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={() => removeFacility(i)}
                            className="flex items-center justify-center w-8 h-8 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* 4 — Condition */}
                <section className="space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Condition
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3 text-muted-foreground" />
                        Building Condition
                      </label>
                      <RichDropdown
                        options={buildingConditionOptions}
                        value={draft.buildingCondition}
                        onChange={(val) => set("buildingCondition", val)}
                        placeholder="Select..."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3 text-muted-foreground" />
                        Roof Condition
                      </label>
                      <RichDropdown
                        options={roofConditionOptions}
                        value={draft.buildingRoofCondition}
                        onChange={(val) => set("buildingRoofCondition", val)}
                        placeholder="Select..."
                      />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-sm font-medium text-foreground flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Hash className="w-3 h-3 text-muted-foreground" />
                          Structural Score (0–100)
                        </div>
                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-md uppercase tracking-tight">
                          Auto-calculated
                        </span>
                      </label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        readOnly
                        placeholder="Calculated..."
                        value={draft.buildingStructuralScore}
                        className="bg-muted/30 font-bold text-primary border-primary/20"
                      />
                    </div>
                  </div>
                </section>

                {/* Notes */}
                <section className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Notes
                  </p>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      <FileText className="w-3 h-3 text-muted-foreground" />
                      Additional Notes
                    </label>
                    <textarea
                      placeholder="Any additional information..."
                      value={draft.buildingNotes}
                      onChange={(e) => set("buildingNotes", e.target.value)}
                      className="w-full min-h-20 rounded-xl border border-border/30 bg-background/80 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                    />
                  </div>
                </section>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border/20 bg-muted/10 shrink-0">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => onSave(draft)}
                  disabled={!draft.buildingName.trim() || isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : isNew ? (
                    "Add Building"
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Geo location modal — rendered separately so it sits above the drawer */}
      {draft && (
        <BuildingGeoLocationModal
          isOpen={geoModalOpen}
          onClose={() => setGeoModalOpen(false)}
          onSave={handleGeoSave}
          initialLat={draft.geolocation.latitude}
          initialLng={draft.geolocation.longitude}
          schoolLat={schoolLat}
          schoolLng={schoolLng}
          buildingName={draft.buildingName || undefined}
        />
      )}
    </>,
    document.body,
  );
}
