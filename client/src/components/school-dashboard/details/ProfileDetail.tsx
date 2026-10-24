import type { ReactNode } from "react";
import { Building2, GraduationCap, MapPin, Users, type LucideIcon } from "lucide-react";
import { formatHectares, formatNumber, formatPercent } from "../../../lib/format";
import { MetricInfo } from "../../metric-help/MetricInfo";
import type { MetricId } from "../../metric-help/metrics";
import type { SchoolMetrics } from "../../dashboard/types";
import { BRAND, BRAND_LIGHT } from "../tokens";
import { Meter, SummaryStat, SummaryStats } from "./primitives";

/** Server-computed school figures (GET /analytics/schools/:id/metrics); nothing is derived here. */
export type ProfileMetrics = Partial<
  Pick<
    SchoolMetrics,
    | "totalStudents"
    | "totalCapacity"
    | "capacityUtilisation"
    | "totalStaff"
    | "totalTeachers"
    | "maleTeacherShare"
    | "studentToTeacherRatio"
    | "buildingCount"
    | "assessedBuildingCount"
    | "avgBuildingAge"
    | "avgBuildingYear"
    | "usedLandArea"
    | "totalLandArea"
    | "usedLandPct"
    | "educationProgramsCount"
    | "roadStatusPercentage"
  >
>;

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const OVER = "#f59e0b"; // over capacity (warning, always labelled)

export function ProfileSummary({ metrics }: { metrics: ProfileMetrics | null }) {
  const m = metrics ?? {};
  return (
    <SummaryStats>
      <SummaryStat
        label="Students"
        value={formatNumber(m.totalStudents ?? null)}
        hint={isNum(m.capacityUtilisation) ? `${formatPercent(m.capacityUtilisation)} of capacity` : "capacity not recorded"}
      />
      <SummaryStat label="Teachers" value={formatNumber(m.totalTeachers ?? null)} hint={isNum(m.studentToTeacherRatio) ? `${formatNumber(m.studentToTeacherRatio, 1)} students each` : "—"} />
      <SummaryStat label="Buildings" value={formatNumber(m.buildingCount ?? null)} hint={isNum(m.assessedBuildingCount) ? `${formatNumber(m.assessedBuildingCount)} assessed` : "—"} />
      <SummaryStat label="Programmes" value={formatNumber(m.educationProgramsCount ?? null)} hint="trades offered" />
    </SummaryStats>
  );
}

function Fact({ label, value, metric, children }: { label: ReactNode; value: ReactNode; metric?: MetricId; children?: ReactNode }) {
  return (
    <div className="py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-white/55">
          {label}
          {metric && <MetricInfo id={metric} size="xs" />}
        </dt>
        <dd className="text-right text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{value}</dd>
      </div>
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}

const Missing = ({ children = "Not recorded" }: { children?: ReactNode }) => (
  <span className="font-normal text-slate-400 dark:text-white/40">{children}</span>
);

function Group({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <section className="rounded-2xl px-4 pb-1.5 pt-3.5 ring-1 ring-slate-900/6 dark:ring-white/8">
      <h3 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900 dark:text-white">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary dark:text-blue-300" aria-hidden>
          <Icon className="h-3.5 w-3.5" />
        </span>
        {title}
      </h3>
      <dl className="mt-1 divide-y divide-slate-900/5 dark:divide-white/6">{children}</dl>
    </section>
  );
}

/** Enrolment, staff, campus and access — as recorded for this school. */
export function ProfileDetail({ metrics }: { metrics: ProfileMetrics | null }) {
  const m = metrics ?? {};
  const util = isNum(m.capacityUtilisation) ? m.capacityUtilisation : null;
  const road = isNum(m.roadStatusPercentage) ? m.roadStatusPercentage : null;
  const male = isNum(m.maleTeacherShare) ? m.maleTeacherShare : null;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Group title="Enrolment" icon={Users}>
        <Fact label="Students" value={formatNumber(m.totalStudents ?? null)} metric="school.totalStudents" />
        <Fact label="Capacity" value={isNum(m.totalCapacity) && m.totalCapacity > 0 ? formatNumber(m.totalCapacity) : <Missing />} />
        <Fact
          label="Capacity used"
          metric="school.capacityUtilisation"
          value={util == null ? <Missing>No capacity data yet</Missing> : `${formatPercent(util, { decimals: 1 })} of capacity`}
        >
          {util != null && (
            // Scale to 150% so "over capacity" is visible; the tick marks 100%.
            <Meter value={(Math.min(util, 150) / 150) * 100} marker={(100 / 150) * 100} color={util > 100 ? OVER : BRAND} label={`${formatPercent(util)} of capacity`} />
          )}
        </Fact>
      </Group>

      <Group title="Teaching staff" icon={GraduationCap}>
        <Fact label="All staff" value={formatNumber(m.totalStaff ?? null)} />
        <Fact label="Teachers" value={formatNumber(m.totalTeachers ?? null)} />
        <Fact
          label="Students per teacher"
          metric="school.studentTeacherRatio"
          value={isNum(m.studentToTeacherRatio) ? `${formatNumber(m.studentToTeacherRatio, 1)} : 1` : <Missing />}
        />
        <Fact label="Teachers by gender" value={male == null ? <Missing>No gender breakdown</Missing> : `${formatPercent(male)} male`}>
          {male != null && (
            <div className="flex h-1.5 gap-[2px] overflow-hidden rounded-full" role="img" aria-label={`${formatPercent(male)} male, ${formatPercent(100 - male)} female`}>
              <span className="h-full rounded-l-full" style={{ width: `${male}%`, background: BRAND }} />
              <span className="h-full flex-1 rounded-r-full" style={{ background: BRAND_LIGHT }} />
            </div>
          )}
        </Fact>
      </Group>

      <Group title="Campus" icon={Building2}>
        <Fact
          label="Buildings"
          metric="school.buildingCount"
          value={
            isNum(m.buildingCount) ? (
              <>
                {formatNumber(m.buildingCount)}
                {isNum(m.assessedBuildingCount) && m.assessedBuildingCount < m.buildingCount && (
                  <span className="ml-1.5 text-xs font-normal text-slate-500 dark:text-white/50">{formatNumber(m.assessedBuildingCount)} assessed</span>
                )}
              </>
            ) : (
              "—"
            )
          }
        />
        <Fact
          label="Average age"
          value={isNum(m.avgBuildingAge) ? `${formatNumber(m.avgBuildingAge)} years` : <Missing>No building ages</Missing>}
        />
        <Fact
          label="Land used"
          metric="school.landArea"
          value={
            isNum(m.usedLandArea) ? (
              <>
                {formatHectares(m.usedLandArea)}
                {isNum(m.totalLandArea) && <span className="ml-1.5 text-xs font-normal text-slate-500 dark:text-white/50">of {formatHectares(m.totalLandArea)}</span>}
              </>
            ) : (
              <Missing>No land data</Missing>
            )
          }
        >
          {isNum(m.usedLandPct) && <Meter value={m.usedLandPct} label={`${formatPercent(m.usedLandPct, { decimals: 1 })} of the land used`} />}
        </Fact>
      </Group>

      <Group title="Access & programmes" icon={MapPin}>
        <Fact
          label="All-season road access"
          metric="school.roadAccess"
          value={road == null ? <Missing /> : `${formatPercent(road)} · ${road > 80 ? "good" : road > 50 ? "moderate" : "limited"}`}
        >
          {road != null && <Meter value={road} label={`${formatPercent(road)} all-season road access`} />}
        </Fact>
        <Fact
          label="TVET programmes"
          metric="school.programmes"
          value={metrics == null ? "—" : (m.educationProgramsCount ?? 0) > 0 ? formatNumber(m.educationProgramsCount ?? 0) : <Missing>None recorded</Missing>}
        />
      </Group>
    </div>
  );
}
