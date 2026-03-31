/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo } from "react";
import {
  MapPin,
  User,
  Users,
  GraduationCap,
  Activity,
  BookOpen,
  LandPlot,
  CheckCircle2,
  AlertCircle,
  MinusCircle,
  Building2,
  Phone,
  Pencil,
  ClipboardCheck,
  Globe,
  Mail,
  Calendar,
  Layers,
  Clock,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { rwandaLocation } from "@devrw/rwanda-location";
import { api } from "../../lib/api";

interface SchoolDetailsPanelProps {
  school: any;
  onEditProfile?: () => void;
  onUpdateSurvey?: () => void;
}

type ComplianceLevel = "compliant" | "partial" | "non_compliant";

interface FacilityItem {
  id: string;
  label: string;
  tags: string[];
}

interface Facility {
  facilityId: string;
  title: string;
  items: FacilityItem[];
}

interface SurveyItem {
  id: string;
  facilityId: string;
  itemId: string;
  compliance: ComplianceLevel;
  notes?: string;
  inspectedBy?: string;
  inspectedAt?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const val = (v: any, suffix = "") =>
  v !== null && v !== undefined && v !== "" ? `${v}${suffix}` : "—";

const statusColors: Record<string, string> = {
  active: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  inactive: "bg-red-500/15 text-red-400 border-red-500/25",
  under_renovation: "bg-amber-500/15 text-amber-400 border-amber-500/25",
};

const priorityColors: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/25",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/25",
  medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  low: "bg-blue-500/15 text-blue-400 border-blue-500/25",
};

const kmzStatusColors: Record<string, string> = {
  completed: "bg-blue-500/15 text-blue-400 border-blue-900/20",
  failed: "bg-red-500/15 text-red-400 border-red-500/20",
  processing: "bg-blue-500/15 text-blue-400 border-blue-900/20",
  pending: "bg-white/5 text-white/20 border-gray-500/30",
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  iconColor = "text-white/40",
  title,
  children,
  className,
  headerAddon,
}: {
  icon: React.ElementType;
  iconColor?: string;
  title: string;
  children: React.ReactNode;
  className?: string;
  headerAddon?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative rounded-3xl overflow-hidden transition-all duration-500 group bg-gray-950/20 hover:bg-gray-950",
        className,
      )}
    >
      {/* Professional Gradient Border & Background */}
      <div className="absolute inset-0 bg-linear-to-b from-gray-500/10 to-blue-500/0 p-px opacity-20 group-hover:opacity-40 transition-opacity">
        <div className="w-full h-full bg-gray-900/60 backdrop-blur-3xl rounded-[calc(1.5rem-1px)]" />
      </div>

      <div className="relative z-10 p-6 flex flex-col gap-6">
        <div className="flex items-center justify-between pb-4 border-b border-gray-500/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/5 border border-gray-500/20 group-hover:bg-primary/10 group-hover:border-primary/20 transition-all duration-300 shadow-inner">
              <Icon className={cn("w-4 h-4 shrink-0", iconColor)} />
            </div>
            <span className="text-base font-bold tracking-wide text-white group-hover:text-white/70 transition-colors antialiased">
              {title}
            </span>
          </div>
          {headerAddon}
        </div>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}

function KV({
  label,
  value,
  className,
  labelClassName,
  valueClassName,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span
        className={cn(
          "text-[10px] text-white/40 font-normal tracking-wide leading-none",
          labelClassName,
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "text-[14px] text-white/90 font-medium leading-relaxed wrap-break-word min-w-0 antialiased tracking-tight",
          valueClassName,
        )}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}

function RegistryGrid({
  children,
  cols = 2,
  gap = "gap-y-6 gap-x-8",
}: {
  children: React.ReactNode;
  cols?: number;
  gap?: string;
}) {
  return (
    <div
      className={cn(
        "grid",
        gap,
        cols === 2
          ? "grid-cols-2"
          : cols === 3
            ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
            : "grid-cols-1",
      )}
    >
      {children}
    </div>
  );
}

function ComplianceBadge({ compliance }: { compliance: ComplianceLevel }) {
  const configs = {
    compliant: {
      icon: CheckCircle2,
      text: "Compliant",
      color: "text-blue-400 bg-blue-500/10 border-blue-900/20",
    },
    partial: {
      icon: MinusCircle,
      text: "Partial",
      color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    },
    non_compliant: {
      icon: AlertCircle,
      text: "Non-compliant",
      color: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    },
  };
  const config = configs[compliance] || configs.non_compliant;
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-normal tracking-wide shrink-0",
        config.color,
      )}
    >
      <Icon className="w-3 h-3" />
      {config.text}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export const SchoolDetailsPanel: React.FC<SchoolDetailsPanelProps> = ({
  school: s,
  onEditProfile,
  onUpdateSurvey,
}) => {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [surveyData, setSurveyData] = useState<SurveyItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRegistryData = async () => {
      try {
        setLoading(true);
        const [facRes, surRes] = await Promise.all([
          api.get("/schools/facilities"),
          api.get(`/schools/${s.id}/survey`),
        ]);
        setFacilities(facRes.data);
        setSurveyData(surRes.data);
      } catch (err) {
        console.error("Failed to load Registry/Survey data:", err);
      } finally {
        setLoading(false);
      }
    };
    if (s.id) loadRegistryData();
  }, [s.id]);

  const surveySummary = useMemo(() => {
    if (!surveyData.length) return null;
    const stats = { compliant: 0, partial: 0, non_compliant: 0 };
    surveyData.forEach((item) => {
      if (item.compliance in stats) {
        stats[item.compliance as keyof typeof stats]++;
      } else {
        stats.non_compliant++;
      }
    });
    return stats;
  }, [surveyData]);

  // ── Location Resolution ──────────────────────────────────────────────────
  const getProvinceName = () => {
    if (!s.province) return null;
    if (isNaN(Number(s.province))) return s.province;
    return (
      rwandaLocation.getProvinces().find((p) => p.code === Number(s.province))
        ?.name || s.province
    );
  };

  const getDistrictName = () => {
    if (!s.district) return null;
    if (isNaN(Number(s.district))) return s.district;
    const pCode = Number(s.province);
    if (!pCode) return s.district;
    return (
      rwandaLocation
        .getDistricts(pCode)
        .find((d) => d.code === Number(s.district))?.name || s.district
    );
  };

  const getSectorName = () => {
    if (!s.sector) return null;
    if (isNaN(Number(s.sector))) return s.sector;
    const dCode = Number(s.district);
    if (!dCode) return s.sector;
    return (
      rwandaLocation.getSectors(dCode).find((sec) => sec.code === s.sector)
        ?.name || s.sector
    );
  };

  const getCellName = () => {
    if (!s.cell) return null;
    if (isNaN(Number(s.cell))) return s.cell;
    const secCode = s.sector;
    if (!secCode) return s.cell;
    return (
      rwandaLocation.getCells(secCode).find((c) => c.code === Number(s.cell))
        ?.name || s.cell
    );
  };

  const provinceName = getProvinceName();
  const districtName = getDistrictName();
  const sectorName = getSectorName();
  const cellName = getCellName();

  return (
    <div className="h-full flex flex-col w-full  backdrop-blur-3xl overflow-hidden">
      {/* ── Registry Hero Header ─────────────────────────────────────────── */}
      <div className="container mx-auto flex-none relative overflow-hidden pt-10 bg-none flex items-center">
        {/* Background Atmosphere */}
        <div className="absolute inset-0 z-0">
          {s.thumbnailUrl ? (
            <img
              src={s.thumbnailUrl}
              alt={s.name}
              className="w-full h-full object-cover blur-3xl opacity-20 scale-110"
            />
          ) : (
            <div className="w-full h-full bg-linear-to-br from-primary/10 to-transparent blur-3xl opacity-30" />
          )}
          {/* <div className="absolute inset-0 bg-linear-to-b from-black/90 via-black/40 to-[#0a0c10]" /> */}
        </div>

        <div className="relative z-10 w-full mx-auto px-6 sm:px-10 py-6 sm:py-8 flex flex-col md:flex-row items-center md:items-end gap-6 sm:gap-10">
          {/* Registry Identity */}
          <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left gap-5">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5">
              {s.status && (
                <span
                  className={cn(
                    "text-[10px] font-normal tracking-wide px-3.5 py-1.5 rounded-xl border-2 shadow-2xl bg-white/5",
                    statusColors[s.status] ??
                      "text-white/50 border-gray-500/30",
                  )}
                >
                  {s.status.replace(/_/g, " ").toLowerCase()}
                </span>
              )}
              {s.priorityLevel && (
                <span
                  className={cn(
                    "text-[10px] font-normal tracking-wide px-3.5 py-1.5 rounded-xl border-2 shadow-2xl bg-white/5",
                    priorityColors[s.priorityLevel] ??
                      "text-white/50 border-gray-500/30",
                  )}
                >
                  Priority: {s.priorityLevel.toLowerCase()}
                </span>
              )}
              {s.type && (
                <span className="text-[10px] font-normal tracking-wide px-3.5 py-1.5 rounded-xl bg-primary/10 text-primary/80 border-2 border-primary/20 shadow-2xl">
                  {s.type.toLowerCase()} school
                </span>
              )}
            </div>

            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-medium text-white leading-none tracking-tight antialiased drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                {s.name}
              </h1>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-white/30">
                <p className="text-sm font-mono font-medium tracking-wide text-white/50">
                  Registry id: {s.code}
                </p>
                {s.establishedYear && (
                  <>
                    <span className="h-1 w-1 rounded-full bg-white/20" />
                    <p className="text-[11px] font-normal tracking-wide text-white/40">
                      Established {s.establishedYear}
                    </p>
                  </>
                )}
                <span className="h-1 w-1 rounded-full bg-white/20" />
                <div className="flex items-center gap-1.5 text-[10px] font-normal tracking-wide text-white/30">
                  <Clock className="w-3.5 h-3.5 opacity-50" />
                  Synced{" "}
                  {s.updatedAt
                    ? new Date(s.updatedAt).toLocaleDateString()
                    : "Never"}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 md:mb-1">
            <button
              onClick={onEditProfile}
              className="group relative flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/40 transition-all duration-500 shadow-2xl hover:shadow-blue-500/10 overflow-hidden backdrop-blur-xl"
            >
              <div className="absolute inset-0 bg-linear-to-r from-blue-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative flex items-center gap-2.5">
                <Pencil className="w-3.5 h-3.5 text-blue-400 group-hover:scale-110 transition-transform duration-300" />
                <span className="text-[11px] font-bold text-white/70 group-hover:text-white transition-colors tracking-wider uppercase antialiased">
                  Edit Profile
                </span>
              </div>
            </button>

            <button
              onClick={onUpdateSurvey}
              className="group relative flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-500/40 transition-all duration-500 shadow-2xl hover:shadow-cyan-500/10 overflow-hidden backdrop-blur-xl"
            >
              <div className="absolute inset-0 bg-linear-to-r from-cyan-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative flex items-center gap-2.5">
                <ClipboardCheck className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform duration-300" />
                <span className="text-[11px] font-bold text-white/70 group-hover:text-white transition-colors tracking-wider uppercase antialiased">
                  Survey Update
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* ── Registry Information Canvas ─────────────────────────────────────────── */}
      <div className="container mx-auto flex-1 overflow-y-auto px-4 sm:px-8 py-4 sm:py-6 custom-scrollbar">
        <div className="container mx-auto space-y-8 pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8">
            {/* 1. Administrative Identity */}
            <Section
              icon={MapPin}
              iconColor="text-blue-400"
              title="Geographical & Administrative Identity"
            >
              <div className="space-y-8">
                <RegistryGrid cols={2}>
                  <KV label="Province" value={val(provinceName)} />
                  <KV label="District" value={val(districtName)} />
                  <KV label="Sector" value={val(sectorName)} />
                  <KV label="Cell" value={val(cellName)} />
                  <KV label="Village Registry" value={s.village} />
                  <KV label="Physical Address" value={s.address} />
                </RegistryGrid>

                <div className="p-6 rounded-2xl bg-white/3 border border-blue-900/20 space-y-4 shadow-inner">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Activity className="w-3.5 h-3.5 text-blue-400/60" />
                      <span className="text-[10px] font-normal text-white/50 tracking-wide">
                        Geospatial registry
                      </span>
                    </div>
                    <div
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[12px] font-normal tracking-wide",
                        kmzStatusColors[s.kmzStatus ?? "pending"],
                      )}
                    >
                      <Layers className="w-2.5 h-2.5" />
                      {s.kmzStatus ?? "unknown"}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                    <KV
                      label="Latitude"
                      value={s.latitude ? Number(s.latitude).toFixed(7) : "—"}
                    />
                    <KV
                      label="Longitude"
                      value={s.longitude ? Number(s.longitude).toFixed(7) : "—"}
                    />
                    <KV label="Elevation (H)" value={val(s.elevation, " m")} />
                  </div>
                </div>
              </div>
            </Section>

            {/* 2. Governance & Contacts */}
            <Section
              icon={User}
              iconColor="text-purple-400"
              title="Governance & Institutional Connectivity"
            >
              <div className="space-y-8">
                {s.headTeacher && (
                  <div className="p-3 rounded-3xl bg-white/5 border border-blue-900/20 flex items-center gap-6 group/head hover:bg-white/8 transition-all duration-300 shadow-lg">
                    <div className="p-2 rounded-2xl bg-white/5 flex items-center justify-center text-primary border border-gray-500/30 shadow-xl group-hover/head:scale-105 transition-transform shrink-0">
                      <User className="w-7 h-7" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-normal text-white/50 tracking-wide">
                        Legal representative
                      </p>
                      <p className="text-base font-medium text-white/80 leading-none group-hover/head:text-white transition-colors">
                        {s.headTeacher}
                      </p>
                    </div>
                  </div>
                )}
                <RegistryGrid cols={1} gap="gap-y-8">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    <KV
                      label="Institutional Phone"
                      value={
                        <a
                          href={`tel:${s.phone}`}
                          className="flex items-center gap-2 hover:text-primary transition-colors"
                        >
                          <Phone className="w-3 h-3 text-white/20" />
                          {s.phone}
                        </a>
                      }
                    />
                    <KV
                      label="Institutional Email"
                      value={
                        <a
                          href={`mailto:${s.email}`}
                          className="flex items-center gap-2 hover:text-primary transition-colors"
                        >
                          <Mail className="w-3 h-3 text-white/20" />
                          <span className="truncate">{s.email}</span>
                        </a>
                      }
                    />
                  </div>
                  <KV
                    label="Official digital presence"
                    value={
                      <div className="flex items-center gap-2">
                        <Globe className="w-3 h-3 text-white/40" />
                        <span className="truncate text-primary/80 font-medium">
                          {s.website || "Registry link pending"}
                        </span>
                      </div>
                    }
                  />
                </RegistryGrid>
              </div>
            </Section>

            {/* 3. Physical Land Assets */}
            <Section
              icon={LandPlot}
              iconColor="text-orange-400"
              title="Physical Land Registry"
            >
              <div className="space-y-8">
                <RegistryGrid cols={2}>
                  <KV
                    label="Utilized Footprint"
                    value={val(s.usedLandArea, " m²")}
                  />
                  <KV
                    label="Undeveloped Reserve"
                    value={val(s.unusedLandArea, " m²")}
                  />
                  <KV
                    label="Total Cadastral Area"
                    className="col-span-2"
                    valueClassName="text-xl text-primary"
                    value={val(
                      s.usedLandArea
                        ? (
                            Number(s.usedLandArea) +
                            Number(s.unusedLandArea || 0)
                          ).toFixed(1)
                        : null,
                      " m²",
                    )}
                  />
                </RegistryGrid>

                <div className="p-6 rounded-2xl bg-black/30 border border-blue-900/20 space-y-6">
                  <div className="flex items-center justify-between border-b border-blue-900/20 pb-4">
                    <span className="text-[10px] text-white/50 font-normal tracking-wide">
                      Logistical infrastructure
                    </span>
                    <span className="text-xs font-medium text-primary/80 tracking-tight">
                      {s.roadState || "Not specified"}
                    </span>
                  </div>
                  <RegistryGrid cols={2}>
                    <KV
                      label="Primary entry points"
                      value={val(s.numberOfAccessRoads)}
                    />
                    <KV
                      label="Infrastructure quality"
                      value={val(s.roadStatusPercentage, "%")}
                    />
                  </RegistryGrid>
                </div>
              </div>
            </Section>

            {/* 4. Human Capital Registry */}
            <Section
              icon={Users}
              iconColor="text-blue-400"
              title="Institutional Human Capital Registry"
            >
              <div className="space-y-10">
                {/* Students */}
                <div className="space-y-5">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2.5">
                      <GraduationCap className="w-4 h-4 text-blue-400/60" />
                      <span className="text-xs font-normal text-white/50 tracking-wide font-mono">
                        Student population
                      </span>
                    </div>
                    <span className="text-lg font-medium text-white/80">
                      {val(s.totalStudents)}
                    </span>
                  </div>
                  <RegistryGrid cols={2} gap="gap-4">
                    <div className="p-4 rounded-3xl bg-blue-500/5 border border-blue-500/10 flex justify-between items-center shadow-inner">
                      <span className="text-[10px] font-normal text-blue-400/60 tracking-wide">
                        MALE
                      </span>
                      <span className="text-sm font-medium text-blue-400">
                        {val(s.maleStudents)}
                      </span>
                    </div>
                    <div className="p-4 rounded-3xl bg-pink-500/5 border border-pink-500/10 flex justify-between items-center shadow-inner">
                      <span className="text-[10px] font-normal text-pink-400/60 tracking-wide">
                        FEMALE
                      </span>
                      <span className="text-sm font-medium text-pink-400">
                        {val(s.femaleStudents)}
                      </span>
                    </div>
                  </RegistryGrid>
                </div>

                {/* Academic Staff */}
                <div className="space-y-5">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2.5">
                      <Users className="w-4 h-4 text-amber-400/60" />
                      <span className="text-xs font-normal text-white/50 tracking-wide font-mono">
                        Academic staff
                      </span>
                    </div>
                    <span className="text-lg font-medium text-white/80">
                      {val(s.totalTeachers)}
                    </span>
                  </div>
                  <RegistryGrid cols={2} gap="gap-4">
                    <div className="p-4 rounded-3xl bg-white/5 border border-blue-900/20 flex justify-between items-center shadow-inner">
                      <span className="text-[10px] font-normal text-white/40 tracking-wide">
                        MALE
                      </span>
                      <span className="text-sm font-medium text-white/80">
                        {val(s.maleTeachers)}
                      </span>
                    </div>
                    <div className="p-4 rounded-3xl bg-white/5 border border-blue-900/20 flex justify-between items-center shadow-inner">
                      <span className="text-[10px] font-normal text-white/40 tracking-wide">
                        FEMALE
                      </span>
                      <span className="text-sm font-medium text-white/80">
                        {val(s.femaleTeachers)}
                      </span>
                    </div>
                  </RegistryGrid>
                </div>

                {/* Organizational Support */}
                <div className="pt-4 border-t border-blue-900/20">
                  <RegistryGrid cols={2}>
                    <KV
                      label="Administrative Registry"
                      value={val(s.adminStaff)}
                    />
                    <KV label="Technical Support" value={val(s.supportStaff)} />
                  </RegistryGrid>
                </div>
              </div>
            </Section>

            {/* 5. Building Inventory Registry */}
            <Section
              className="lg:col-span-2 xl:col-span-1"
              icon={Building2}
              iconColor="text-rose-400"
              title="Official Building Inventory Registry"
            >
              {s.buildings && s.buildings.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-normal text-white/40 tracking-widest">
                      {s.buildings.length} STRUCTURAL UNITS RECORDED
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 max-h-[440px] overflow-y-auto pr-2 custom-scrollbar">
                    {s.buildings.map((b: any) => (
                      <div
                        key={b.id}
                        className="group/b p-4 rounded-3xl bg-white/3 border border-blue-900/20 hover:bg-white/8 hover:border-gray-500/30 transition-all duration-300 shadow-inner"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="space-y-0.5">
                            <p className="text-sm font-medium text-white/80 group-hover/b:text-primary transition-colors">
                              {b.name}
                            </p>
                            <p className="text-[10px] font-mono text-white/40">
                              Code: {b.buildingCode || "N/A"}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "text-[12px] font-medium px-2 py-0.5 rounded-md border",
                              b.condition === "good"
                                ? "text-blue-400 border-blue-400/20 bg-blue-400/5"
                                : b.condition === "fair"
                                  ? "text-amber-400 border-amber-400/20 bg-amber-400/5"
                                  : "text-rose-400 border-rose-400/20 bg-rose-400/5",
                            )}
                          >
                            {b.condition
                              ? b.condition.toLowerCase()
                              : "unknown"}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <KV
                            label="Function"
                            value={b.function || "General"}
                            labelClassName="text-[12px] opacity-40"
                            valueClassName="text-[11px]"
                          />
                          <KV
                            label="Floors"
                            value={b.floors ? `G+${b.floors - 1}` : "G"}
                            labelClassName="text-[12px] opacity-40"
                            valueClassName="text-[11px]"
                          />
                          <KV
                            label="Area"
                            value={val(b.areaSquareMeters, " m²")}
                            labelClassName="text-[12px] opacity-40"
                            valueClassName="text-[11px]"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-30">
                  <Building2 className="w-12 h-12 text-white/40" />
                  <p className="text-xs font-normal tracking-wide text-center text-white/50">
                    No building registry data available for this region
                  </p>
                </div>
              )}
            </Section>

            {/* 6. Facility Compliance Survey Report */}
            <Section
              className="lg:col-span-2 xl:col-span-3"
              icon={BookOpen}
              iconColor="text-cyan-400"
              title="Official Facility Compliance Survey Report"
              headerAddon={
                surveySummary && (
                  <div className="flex items-center gap-4 bg-white/5 px-4 py-2 rounded-2xl border border-blue-900/20 shadow-inner">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                      <span className="text-[10px] font-medium text-blue-400">
                        {surveySummary?.compliant} compliant
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-amber-400" />
                      <span className="text-[10px] font-medium text-amber-400">
                        {surveySummary?.partial} partial
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-rose-400" />
                      <span className="text-[10px] font-medium text-rose-400">
                        {surveySummary?.non_compliant} critical
                      </span>
                    </div>
                  </div>
                )
              }
            >
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Activity className="w-8 h-8 text-primary animate-spin" />
                  <p className="text-[10px] font-normal text-white/40 tracking-wide">
                    Assembling institutional survey matrix...
                  </p>
                </div>
              ) : facilities.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed border-blue-900/20 rounded-4xl">
                  <p className="text-sm font-normal text-white/10 tracking-wide">
                    No official survey documentation attached
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-8">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <p className="text-[10px] font-normal text-white/40 tracking-wide mb-1">
                        Compliance matrix
                      </p>
                      <p className="text-sm font-normal text-white/40 tracking-wide">
                        Statistical verification reports
                      </p>
                    </div>
                  </div>

                  {facilities.map((fac) => (
                    <div key={fac.facilityId} className="space-y-6">
                      <div className="flex items-center gap-4">
                        <div className="px-4 py-2 rounded-full bg-white/5 border border-gray-500/20 shadow-inner">
                          <h3 className="text-sm font-bold text-white/80 tracking-tight">
                            {fac.title}
                          </h3>
                        </div>
                        <div className="h-px flex-1 bg-white/5" />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {fac.items.map((item) => {
                          const survey = surveyData.find(
                            (sv) =>
                              sv.facilityId === fac.facilityId &&
                              sv.itemId === item.id,
                          );
                          return (
                            <div
                              key={item.id}
                              className="group/item flex flex-col gap-3 p-5 rounded-3xl bg-gray-900/10 border border-gray-900 hover:bg-gray-900/20 hover:border-gray-500/30 transition-all duration-300 shadow-inner"
                            >
                              <div className="flex items-start justify-between gap-6">
                                <div className="space-y-1.5 flex-1">
                                  <p className="text-sm font-medium text-white/60 group-hover/item:text-white transition-colors leading-tight">
                                    {item.label}
                                  </p>
                                  <div className="flex flex-wrap gap-1.5 mt-2">
                                    {item.tags?.map((tag, idx) => (
                                      <span
                                        key={idx}
                                        className="text-[12px] font-normal text-primary tracking-wide border border-primary/10 px-1.5 py-0.5 rounded-md"
                                      >
                                        {tag.toLowerCase()}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {(survey?.notes || survey?.inspectedAt) && (
                                <div className="space-y-3 pt-3 border-t border-gray-500/10">
                                  {survey?.notes && (
                                    <div className="pl-3 border-l-2 border-primary/20">
                                      <p className="text-[11px] text-white/30 italic leading-relaxed group-hover/item:text-white/50 transition-colors">
                                        "{survey.notes}"
                                      </p>
                                    </div>
                                  )}
                                  <div className="flex items-center justify-between opacity-30 group-hover/item:opacity-60 transition-opacity">
                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                      <ComplianceBadge
                                        compliance={
                                          survey?.compliance || "non_compliant"
                                        }
                                      />
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <Calendar className="w-3 h-3" />
                                      <span className="text-[9px] font-normal tracking-wide">
                                        {survey?.inspectedAt
                                          ? new Date(
                                              survey.inspectedAt,
                                            ).toLocaleDateString()
                                          : "Pending"}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
};
