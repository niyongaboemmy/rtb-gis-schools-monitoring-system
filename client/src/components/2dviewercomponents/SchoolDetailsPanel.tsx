/* eslint-disable @typescript-eslint/no-explicit-any -- the school record is loosely typed across the viewer */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import { Building2, ClipboardCheck, GraduationCap, LandPlot, Users } from "lucide-react";
import { rwandaLocation } from "@devrw/rwanda-location";
import { api } from "../../lib/api";
import { formatHectares, formatNumber, formatPercent } from "../../lib/format";
import { MetricInfo } from "../metric-help/MetricInfo";
import { FloatingStat } from "../dashboard/FloatingStat";
import type { SchoolMetrics } from "../dashboard/types";
import { BRAND } from "../school-dashboard/tokens";
import { DetailsHero } from "../school-details/DetailsHero";
import { BuildingsListCard, ContactCard, LandAccessCard, LocationCard, PeopleCard } from "../school-details/cards";
import { SurveyCard, type Facility, type SurveyItem } from "../school-details/SurveyCard";
import { SchoolDetailsSkeleton } from "../school-details/SchoolDetailsSkeleton";

interface SchoolDetailsPanelProps {
  school: any;
  onEditProfile?: () => void;
  onUpdateSurvey?: () => void;
}

/** Rwanda admin codes → names (records may store either). */
function useAdminNames(s: any) {
  return useMemo(() => {
    const isCode = (v: unknown) => v !== null && v !== undefined && v !== "" && !isNaN(Number(v));
    const province = !s.province
      ? null
      : !isCode(s.province)
        ? s.province
        : rwandaLocation.getProvinces().find((p) => p.code === Number(s.province))?.name ?? s.province;
    const district = !s.district
      ? null
      : !isCode(s.district) || !Number(s.province)
        ? s.district
        : rwandaLocation.getDistricts(Number(s.province)).find((d) => d.code === Number(s.district))?.name ?? s.district;
    const sector = !s.sector
      ? null
      : !isCode(s.sector) || !Number(s.district)
        ? s.sector
        : rwandaLocation.getSectors(Number(s.district)).find((x) => x.code === s.sector)?.name ?? s.sector;
    const cell = !s.cell
      ? null
      : !isCode(s.cell) || !s.sector
        ? s.cell
        : rwandaLocation.getCells(s.sector).find((c) => c.code === Number(s.cell))?.name ?? s.cell;
    return { province, district, sector, cell };
  }, [s.province, s.district, s.sector, s.cell]);
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * The school's record (Details tab): identity, location, contacts, people,
 * land, buildings and the facility survey — in the dashboard's design system.
 * Figures that are derived (ratios, totals, compliance) come from the server
 * metrics; everything else is the record as entered.
 */
export const SchoolDetailsPanel: React.FC<SchoolDetailsPanelProps> = ({ school: s, onEditProfile, onUpdateSurvey }) => {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [survey, setSurvey] = useState<SurveyItem[]>([]);
  const [metrics, setMetrics] = useState<SchoolMetrics | null>(null);
  /** Which school the loaded figures belong to; anything else shows the skeleton. */
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const names = useAdminNames(s);
  const heroRef = useRef<HTMLDivElement>(null);
  const [pastHero, setPastHero] = useState(false);

  useEffect(() => {
    if (!s?.id) return;
    let alive = true;
    // Best-effort: each part renders "not recorded" if its request fails.
    Promise.allSettled([api.get("/schools/facilities"), api.get(`/schools/${s.id}/survey`), api.get(`/analytics/schools/${s.id}/metrics`)]).then(
      ([fac, sur, met]) => {
        if (!alive) return;
        setFacilities(fac.status === "fulfilled" && Array.isArray(fac.value.data) ? fac.value.data : []);
        setSurvey(sur.status === "fulfilled" && Array.isArray(sur.value.data) ? sur.value.data : []);
        setMetrics(met.status === "fulfilled" ? (met.value.data ?? null) : null);
        setLoadedId(s.id);
      },
    );
    return () => {
      alive = false;
    };
  }, [s?.id]);

  // Show the nav fade only after the hero has scrolled under the viewer nav.
  useEffect(() => {
    const el = heroRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setPastHero(!entry.isIntersecting), { rootMargin: "-96px 0px 0px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [loadedId]);

  if (loadedId !== s?.id) return <SchoolDetailsSkeleton />;

  const m = metrics;
  const buildings = Array.isArray(s.buildings) ? s.buildings : [];
  const place = [names.district, names.province].filter(Boolean).join(", ") || null;
  // Only records for items on the current checklist count as "checked".
  const checklist = new Set(facilities.flatMap((f) => f.items.map((it) => `${f.facilityId}/${it.id}`)));
  const items = checklist.size;
  const surveyed = survey.filter((r) => checklist.has(`${r.facilityId}/${r.itemId}`)).length;
  const kpis = [
    {
      label: "Students",
      value: isNum(m?.totalStudents) ? m.totalStudents : null,
      caption: isNum(m?.capacityUtilisation) ? `${formatPercent(m.capacityUtilisation)} of capacity` : "capacity not recorded",
      pct: isNum(m?.capacityUtilisation) ? Math.min(100, m.capacityUtilisation) : null,
      icon: GraduationCap,
      id: "school.totalStudents" as const,
      format: (n: number | null) => formatNumber(n),
    },
    {
      label: "Teachers",
      value: isNum(m?.totalTeachers) ? m.totalTeachers : null,
      caption: isNum(m?.studentToTeacherRatio) ? `${formatNumber(m.studentToTeacherRatio, 1)} : 1` : "—",
      pct: null,
      icon: Users,
      id: "school.studentTeacherRatio" as const,
      format: (n: number | null) => formatNumber(n),
    },
    {
      label: "Buildings",
      value: isNum(m?.buildingCount) ? m.buildingCount : buildings.length,
      caption: isNum(m?.assessedBuildingCount) ? `${formatNumber(m.assessedBuildingCount)} assessed` : "—",
      pct: isNum(m?.assessedBuildingCount) && isNum(m?.buildingCount) && m.buildingCount > 0 ? (m.assessedBuildingCount / m.buildingCount) * 100 : null,
      icon: Building2,
      id: "school.buildingCount" as const,
      format: (n: number | null) => formatNumber(n),
    },
    {
      label: "Land",
      value: isNum(m?.totalLandArea) ? m.totalLandArea : null,
      caption: isNum(m?.usedLandPct) ? `${formatPercent(m.usedLandPct)} used` : "not recorded",
      pct: isNum(m?.usedLandPct) ? m.usedLandPct : null,
      icon: LandPlot,
      id: "school.landArea" as const,
      format: (n: number | null) => formatHectares(n),
    },
    {
      label: "Survey",
      value: isNum(m?.facilityComplianceScore) ? m.facilityComplianceScore : null,
      caption: items ? `${formatNumber(surveyed)} of ${formatNumber(items)} checked` : "no checklist",
      pct: isNum(m?.facilityComplianceScore) ? m.facilityComplianceScore : null,
      icon: ClipboardCheck,
      id: "component.facilityCompliance" as const,
      format: (n: number | null) => formatPercent(n),
    },
  ];

  return (
    <div className="relative min-h-full">
      {/* Ambient backdrop — the same calm depth as the dashboard */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/4 top-0 h-[28rem] w-[28rem] rounded-full bg-primary/10 blur-[120px] dark:bg-primary/15" />
        <div className="absolute bottom-0 right-0 h-[24rem] w-[32rem] rounded-full bg-primary/10 blur-[120px]" />
      </div>

      {/* Fade under the viewer's floating nav — only once the hero has scrolled away */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none sticky top-0 z-30 -mb-24 h-24 bg-linear-to-b from-slate-50 from-40% via-slate-50/85 to-transparent transition-opacity duration-300 dark:from-gray-950 dark:from-40% dark:via-gray-950/85",
          pastHero ? "opacity-100" : "opacity-0",
        )}
      />

      <div ref={heroRef}>
      <DetailsHero
        name={s.name || "School"}
        code={s.code}
        place={place}
        status={s.status}
        type={s.type}
        priority={m?.priorityLevel ?? s.priorityLevel ?? null}
        establishedYear={s.establishedYear}
        updatedAt={s.updatedAt}
        onEditProfile={onEditProfile}
        onUpdateSurvey={onUpdateSurvey}
      />
      </div>

      <div className="relative mx-auto -mt-4 max-w-[1400px] space-y-5 px-4 pb-10 sm:-mt-6 sm:px-8 lg:px-10">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {kpis.map((k, i) => (
            // Phones show four; the survey figure has its own card below.
            <div key={k.label} className={i === 4 ? "hidden sm:block" : undefined}>
              <FloatingStat
                index={i}
                compact
                label={k.label}
                caption={k.caption}
                value={k.value}
                format={k.format}
                percent={k.pct}
                icon={k.icon}
                tone="text-primary"
                color={BRAND}
                info={<MetricInfo id={k.id} size="xs" />}
              />
            </div>
          ))}
        </dl>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <LocationCard school={s} names={names} index={0} />
          <ContactCard school={s} index={1} />
          <PeopleCard school={s} metrics={m} index={2} />
          <LandAccessCard school={s} metrics={m} index={3} />
          <BuildingsListCard buildings={buildings} index={4} className="md:col-span-2 xl:col-span-2" />
        </div>

        <SurveyCard facilities={facilities} survey={survey} complianceScore={m?.facilityComplianceScore ?? null} onUpdateSurvey={onUpdateSurvey} index={5} />
      </div>
    </div>
  );
};
