import React, { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { BuildingData } from "./BuildingsStep";
import {
  X,
  Building2,
  Hash,
  Layers,
  Maximize2,
  Calendar,
  MapPin,
  DoorOpen,
  FileText,
  Copy,
  Check,
  Pencil,
  ShieldAlert,
  Home,
  Activity,
  AlignLeft,
} from "lucide-react";

// ── Marker icon ────────────────────────────────────────────────────────────────

const detailPin = L.divIcon({
  className: "",
  html: `<div style="filter:drop-shadow(0 4px 8px rgba(99,102,241,0.5))">
    <svg width="30" height="38" viewBox="0 0 30 38" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="pg" cx="40%" cy="30%">
          <stop offset="0%" stop-color="#818cf8"/>
          <stop offset="100%" stop-color="#4f46e5"/>
        </radialGradient>
      </defs>
      <path d="M15 0C6.716 0 0 6.716 0 15c0 11.25 15 23 15 23S30 26.25 30 15C30 6.716 23.284 0 15 0z" fill="url(#pg)"/>
      <circle cx="15" cy="15" r="6.5" fill="white" opacity="0.95"/>
      <circle cx="15" cy="15" r="3.5" fill="#4f46e5"/>
    </svg>
  </div>`,
  iconSize: [30, 38],
  iconAnchor: [15, 38],
});

// ── Config maps ────────────────────────────────────────────────────────────────

const conditionCfg: Record<string, { label: string; accent: string; ring: string; text: string; pct: number }> = {
  good:     { label: "Good",     accent: "#22c55e", ring: "rgba(34,197,94,0.2)",   text: "text-green-600 dark:text-green-400",   pct: 100 },
  fair:     { label: "Fair",     accent: "#eab308", ring: "rgba(234,179,8,0.2)",   text: "text-yellow-600 dark:text-yellow-400", pct: 66  },
  poor:     { label: "Poor",     accent: "#f97316", ring: "rgba(249,115,22,0.2)",  text: "text-orange-600 dark:text-orange-400", pct: 33  },
  critical: { label: "Critical", accent: "#ef4444", ring: "rgba(239,68,68,0.2)",   text: "text-red-600 dark:text-red-400",       pct: 10  },
};

const roofCfg: Record<string, { label: string; accent: string; ring: string; text: string; pct: number }> = {
  good:         { label: "Good",         accent: "#22c55e", ring: "rgba(34,197,94,0.2)",  text: "text-green-600 dark:text-green-400",   pct: 100 },
  needs_repair: { label: "Needs Repair", accent: "#eab308", ring: "rgba(234,179,8,0.2)",  text: "text-yellow-600 dark:text-yellow-400", pct: 50  },
  damaged:      { label: "Damaged",      accent: "#ef4444", ring: "rgba(239,68,68,0.2)",  text: "text-red-600 dark:text-red-400",       pct: 15  },
};

// ── SVG condition ring ─────────────────────────────────────────────────────────

interface ConditionRingProps {
  label: string;
  sublabel: string;
  accent: string;
  ringBg: string;
  textClass: string;
  pct: number;
  icon: React.ElementType;
}

function ConditionRing({ label, sublabel, accent, ringBg, textClass, pct, icon: Icon }: ConditionRingProps) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-border/20 bg-muted/30 flex-1">
      <div className="relative w-16 h-16">
        <svg viewBox="0 0 72 72" className="w-16 h-16 -rotate-90">
          <circle cx="36" cy="36" r={r} fill="none" stroke={ringBg} strokeWidth="6" />
          <motion.circle
            cx="36" cy="36" r={r} fill="none" stroke={accent} strokeWidth="6"
            strokeLinecap="round" strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ - dash }}
            transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon className={`w-5 h-5 ${textClass}`} />
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className={`text-sm font-bold ${textClass}`}>{sublabel}</p>
      </div>
    </div>
  );
}

// ── Stat chip ──────────────────────────────────────────────────────────────────

function StatChip({ icon: Icon, label, value, delay = 0 }: {
  icon: React.ElementType; label: string; value: string | number; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="flex flex-col gap-1.5 items-center justify-center p-3 rounded-2xl bg-background border border-border/25"
    >
      <div className="flex items-center gap-1 text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[10px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <span className="text-base font-bold text-foreground leading-none">{value}</span>
    </motion.div>
  );
}

// ── Copy button ────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" onClick={() => {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true); setTimeout(() => setCopied(false), 1800);
      });
    }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0">
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// ── Section heading ────────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2 before:flex-1 before:h-px before:bg-border/30 after:flex-1 after:h-px after:bg-border/30">
      <span className="shrink-0">{children}</span>
    </p>
  );
}

// ── Detail row ─────────────────────────────────────────────────────────────────

function DetailRow({ icon: Icon, label, value }: {
  icon: React.ElementType; label: string; value: string | number;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/10 last:border-0">
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="w-3.5 h-3.5 shrink-0" />
        {label}
      </span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface BuildingDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  building: BuildingData | null;
  buildingIndex: number;
  onEdit?: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function BuildingDetailsModal({
  isOpen, onClose, building, buildingIndex, onEdit,
}: BuildingDetailsModalProps) {
  if (!building) return null;

  const cond = conditionCfg[building.buildingCondition] ?? conditionCfg.fair;
  const roof = roofCfg[building.buildingRoofCondition] ?? roofCfg.good;

  // lat/lng come as decimal strings from the DB — always parse to number
  const lat = building.geolocation.latitude !== null && building.geolocation.latitude !== undefined
    ? parseFloat(String(building.geolocation.latitude)) : null;
  const lng = building.geolocation.longitude !== null && building.geolocation.longitude !== undefined
    ? parseFloat(String(building.geolocation.longitude)) : null;
  const hasGeo = lat !== null && !isNaN(lat) && lng !== null && !isNaN(lng);

  const totalRooms = building.facilities.reduce((s, f) => s + (f.number_of_rooms || 0), 0);
  const age = building.buildingYearBuilt
    ? new Date().getFullYear() - parseInt(building.buildingYearBuilt) : null;
  const score = building.buildingStructuralScore
    ? parseInt(building.buildingStructuralScore) : null;
  const scoreColor = score === null ? "#6b7280"
    : score >= 75 ? "#22c55e" : score >= 50 ? "#eab308" : score >= 25 ? "#f97316" : "#ef4444";
  const coordsText = hasGeo ? `${lat!.toFixed(6)}, ${lng!.toFixed(6)}` : "";

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="bdm-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-70 bg-black/60 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            key="bdm-modal"
            initial={{ opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 24 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-71 mx-auto w-full max-w-2xl bg-background rounded-3xl border border-border/50 overflow-hidden flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Hero map (bigger: h-72) ── */}
            <div className="relative h-72 shrink-0 overflow-hidden">
              {hasGeo ? (
                <>
                  <MapContainer
                    center={[lat!, lng!]}
                    zoom={19}
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
                    <Marker position={[lat!, lng!]} icon={detailPin} />
                  </MapContainer>
                  <div className="absolute inset-0 bg-linear-to-t from-background via-background/20 to-transparent z-10 pointer-events-none" />
                </>
              ) : (
                <div className="h-full bg-linear-to-br from-indigo-600/20 via-violet-600/10 to-background flex items-center justify-center relative">
                  <Building2 className="w-24 h-24 text-indigo-500/20" />
                  <div className="absolute inset-0 opacity-[0.04]" style={{
                    backgroundImage: "linear-gradient(#6366f1 1px,transparent 1px),linear-gradient(90deg,#6366f1 1px,transparent 1px)",
                    backgroundSize: "32px 32px",
                  }} />
                </div>
              )}

              {/* Control pills */}
              <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
                {onEdit && (
                  <button type="button" onClick={onEdit}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/90 backdrop-blur border border-border/50 text-xs font-semibold text-foreground hover:bg-background transition-all">
                    <Pencil className="w-3 h-3" />Edit
                  </button>
                )}
                <button type="button" onClick={onClose}
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-background/90 backdrop-blur border border-border/50 text-muted-foreground hover:text-foreground transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Condition badge (bottom-left) */}
              <div className="absolute bottom-3 left-4 z-20">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold backdrop-blur border shadow"
                  style={{ color: cond.accent, background: cond.ring, borderColor: cond.accent + "40" }}>
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: cond.accent }} />
                  {cond.label} Condition
                </span>
              </div>

              {/* Name + code overlay (bottom-right) */}
              <div className="absolute bottom-3 right-4 z-20 text-right">
                <h2 className="text-base font-bold text-foreground drop-shadow leading-tight">
                  {building.buildingName || `Building #${buildingIndex + 1}`}
                </h2>
                {building.buildingCode && (
                  <span className="text-[11px] font-mono text-muted-foreground bg-background/70 px-1.5 py-0.5 rounded backdrop-blur">
                    {building.buildingCode}
                  </span>
                )}
              </div>
            </div>

            {/* ── Identity chips ── */}
            <div className="px-6 pt-4 pb-1 border-b border-border/15">
              <div className="flex items-center gap-2 flex-wrap">
                {building.buildingFunction && (
                  <span className="flex items-center gap-1.5 text-xs bg-muted px-2.5 py-1 rounded-full text-foreground font-medium">
                    <Home className="w-3 h-3 text-muted-foreground" />{building.buildingFunction}
                  </span>
                )}
                {building.buildingYearBuilt && (
                  <span className="flex items-center gap-1.5 text-xs bg-muted px-2.5 py-1 rounded-full text-foreground font-medium">
                    <Calendar className="w-3 h-3 text-muted-foreground" />
                    Built {building.buildingYearBuilt}
                    {age !== null && <span className="text-muted-foreground ml-1">({age}y)</span>}
                  </span>
                )}
                {hasGeo && (
                  <span className="flex items-center gap-1.5 text-xs bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2.5 py-1 rounded-full font-medium border border-indigo-500/20">
                    <MapPin className="w-3 h-3" />Geolocated
                  </span>
                )}
              </div>
            </div>

            {/* ── Scrollable body ── */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

              {/* Physical stats grid */}
              <div className="grid grid-cols-4 gap-2">
                <StatChip icon={Layers}   label="Floors" value={building.buildingFloors || "—"} delay={0} />
                <StatChip icon={DoorOpen} label="Rooms"  value={totalRooms > 0 ? totalRooms : "—"} delay={0.05} />
                <StatChip icon={Maximize2} label="Area"  value={building.buildingArea ? `${building.buildingArea}m²` : "—"} delay={0.1} />
                <StatChip icon={Activity} label="Score"  value={score !== null ? `${score}/100` : "—"} delay={0.15} />
              </div>

              {/* All registered details */}
              <div className="space-y-3">
                <SectionHeading>Building Details</SectionHeading>
                <div className="rounded-2xl border border-border/20 bg-muted/20 px-4">
                  {building.buildingName && (
                    <DetailRow icon={Building2} label="Name" value={building.buildingName} />
                  )}
                  {building.buildingCode && (
                    <DetailRow icon={Hash} label="Code" value={building.buildingCode} />
                  )}
                  {building.buildingFunction && (
                    <DetailRow icon={Home} label="Function" value={building.buildingFunction} />
                  )}
                  {building.buildingYearBuilt && (
                    <DetailRow icon={Calendar} label="Year Built"
                      value={`${building.buildingYearBuilt}${age !== null ? ` (${age} years old)` : ""}`} />
                  )}
                  {building.buildingFloors && (
                    <DetailRow icon={Layers} label="Floors" value={building.buildingFloors} />
                  )}
                  {building.buildingArea && (
                    <DetailRow icon={Maximize2} label="Area" value={`${building.buildingArea} m²`} />
                  )}
                  {score !== null && (
                    <DetailRow icon={Activity} label="Structural Score" value={`${score} / 100`} />
                  )}
                </div>
              </div>

              {/* Structural score bar */}
              {score !== null && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Activity className="w-3 h-3" />Structural Integrity
                    </span>
                    <span className="font-bold" style={{ color: scoreColor }}>{score}/100</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${score}%` }}
                      transition={{ duration: 1, delay: 0.25, ease: "easeOut" }}
                      className="h-full rounded-full" style={{ background: scoreColor }}
                    />
                  </div>
                </div>
              )}

              {/* Condition assessment */}
              <div className="space-y-3">
                <SectionHeading>Condition Assessment</SectionHeading>
                <div className="flex gap-3">
                  <ConditionRing label="Building" sublabel={cond.label} accent={cond.accent}
                    ringBg={cond.ring} textClass={cond.text} pct={cond.pct} icon={ShieldAlert} />
                  <ConditionRing label="Roof" sublabel={roof.label} accent={roof.accent}
                    ringBg={roof.ring} textClass={roof.text} pct={roof.pct} icon={Hash} />
                </div>
              </div>

              {/* Facilities */}
              {building.facilities.length > 0 && (
                <div className="space-y-3">
                  <SectionHeading>Facilities ({building.facilities.length} · {totalRooms} rooms total)</SectionHeading>
                  <div className="rounded-2xl border border-border/25 overflow-hidden divide-y divide-border/15">
                    {building.facilities.map((f, i) => (
                      <motion.div key={i}
                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: 0.05 * i }}
                        className="flex items-center justify-between px-4 py-3 bg-card hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">{i + 1}</div>
                          <span className="text-sm font-medium text-foreground">{f.facility_name || "Unnamed facility"}</span>
                        </div>
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-xl font-medium">
                          <DoorOpen className="w-3 h-3" />
                          {f.number_of_rooms} {f.number_of_rooms === 1 ? "room" : "rooms"}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Geolocation */}
              {hasGeo && (
                <div className="space-y-3">
                  <SectionHeading>Geolocation</SectionHeading>
                  <div className="flex items-center gap-3 p-4 rounded-2xl border border-border/25 bg-linear-to-r from-indigo-500/5 to-violet-500/5">
                    <div className="p-2.5 rounded-xl bg-indigo-500/10 shrink-0">
                      <MapPin className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground mb-0.5">Coordinates</p>
                      <p className="text-sm font-mono text-foreground font-semibold truncate">
                        <span className="text-muted-foreground text-xs">Lat </span>{lat!.toFixed(6)}
                        <span className="mx-2 text-muted-foreground">·</span>
                        <span className="text-muted-foreground text-xs">Lng </span>{lng!.toFixed(6)}
                      </p>
                    </div>
                    <CopyButton text={coordsText} />
                  </div>
                </div>
              )}

              {/* Notes */}
              {building.buildingNotes && (
                <div className="space-y-3">
                  <SectionHeading>Notes</SectionHeading>
                  <div className="flex gap-3 p-4 rounded-2xl bg-muted/30 border border-border/20">
                    <AlignLeft className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-sm text-foreground leading-relaxed">{building.buildingNotes}</p>
                  </div>
                </div>
              )}

              {/* No notes / no facilities placeholder */}
              {building.facilities.length === 0 && !building.buildingNotes && (
                <div className="flex flex-col items-center justify-center py-4 gap-1">
                  <FileText className="w-5 h-5 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">No facilities or notes recorded</p>
                </div>
              )}

              <div className="h-2" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
