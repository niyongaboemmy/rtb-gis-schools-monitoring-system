import { useMemo, useState } from "react";
import { Building2, Check, Copy, Globe, LandPlot, Mail, MapPin, Phone, Route, UserRound, Users } from "lucide-react";
import { cn } from "../../lib/utils";
import { formatArea, formatHectares, formatNumber, formatPercent } from "../../lib/format";
import { label } from "../../lib/labels";
import { MetricInfo } from "../metric-help/MetricInfo";
import type { FacilityBuilding, SchoolMetrics } from "../dashboard/types";
import { GlassCard } from "../school-dashboard/GlassCard";
import { CONDITIONS, SITE_MAP, type ConditionKey } from "../school-dashboard/status-colors";
import { StackBar } from "../school-dashboard/charts/StackBar";
import { Meter, StatusPill } from "../school-dashboard/details/primitives";
import { BRAND, BRAND_LIGHT } from "../school-dashboard/tokens";
import { Field, Missing, SplitBar } from "./parts";

/* eslint-disable @typescript-eslint/no-explicit-any -- the school record is loosely typed across the viewer */
type SchoolRecord = Record<string, any>;

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/* ── Location ─────────────────────────────────────────────────────────── */

export function LocationCard({
  school: s,
  names,
  index,
}: {
  school: SchoolRecord;
  names: { province: string | null; district: string | null; sector: string | null; cell: string | null };
  index?: number;
}) {
  const [copied, setCopied] = useState(false);
  const lat = num(s.latitude);
  const lng = num(s.longitude);
  const site = SITE_MAP[s.kmzStatus ?? "pending"] ?? SITE_MAP.pending;
  const coords = lat != null && lng != null ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : null;

  return (
    <GlassCard title="Location" icon={MapPin} index={index}>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5">
        <Field label="Province" value={names.province} />
        <Field label="District" value={names.district} />
        <Field label="Sector" value={names.sector} />
        <Field label="Cell" value={names.cell} />
        <Field label="Village" value={s.village} />
        <Field label="Address" value={s.address} />
      </dl>

      <div className="mt-4 rounded-2xl bg-slate-900/[0.03] p-3.5 ring-1 ring-slate-900/5 dark:bg-white/[0.04] dark:ring-white/8">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-medium text-slate-500 dark:text-white/45">GPS position</p>
          <StatusPill color={site.color}>{site.label}</StatusPill>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate font-mono text-[13px] tabular-nums text-slate-900 dark:text-white/90">{coords ?? <Missing />}</p>
          {coords && (
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(coords).then(() => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1500);
                });
              }}
              aria-label={copied ? "Coordinates copied" : "Copy coordinates"}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-900/6 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 dark:text-white/50 dark:hover:bg-white/8"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
            </button>
          )}
        </div>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-white/45">
          Elevation {num(s.elevation) != null ? `${formatNumber(num(s.elevation))} m` : <Missing>not recorded</Missing>}
        </p>
      </div>
    </GlassCard>
  );
}

/* ── Contact & leadership ─────────────────────────────────────────────── */

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

function ContactRow({ icon: Icon, label: text, value, href }: { icon: typeof Phone; label: string; value?: string | null; href?: string }) {
  const has = Boolean(value && String(value).trim());
  const body = (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900/4 text-slate-500 dark:bg-white/6 dark:text-white/55" aria-hidden>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] text-slate-500 dark:text-white/45">{text}</span>
        <span className={cn("block truncate text-sm font-medium", has ? "text-slate-900 dark:text-white/90" : "")}>{has ? value : <Missing />}</span>
      </span>
    </>
  );
  return has && href ? (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="flex items-center gap-3 rounded-xl p-1 -m-1 transition-colors hover:bg-slate-900/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 dark:hover:bg-white/[0.04]">
      {body}
    </a>
  ) : (
    <div className="flex items-center gap-3">{body}</div>
  );
}

export function ContactCard({ school: s, index }: { school: SchoolRecord; index?: number }) {
  const website = s.website ? String(s.website) : null;
  return (
    <GlassCard title="Contact & leadership" icon={UserRound} index={index}>
      <div className="flex items-center gap-3 rounded-2xl bg-slate-900/[0.03] p-3 ring-1 ring-slate-900/5 dark:bg-white/[0.04] dark:ring-white/8">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary dark:text-blue-300" aria-hidden>
          {s.headTeacher ? initials(String(s.headTeacher)) : <UserRound className="h-5 w-5" />}
        </span>
        <div className="min-w-0">
          <p className="text-[11px] text-slate-500 dark:text-white/45">Head teacher</p>
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{s.headTeacher || <Missing />}</p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        <ContactRow icon={Phone} label="Phone" value={s.phone} href={s.phone ? `tel:${s.phone}` : undefined} />
        <ContactRow icon={Mail} label="Email" value={s.email} href={s.email ? `mailto:${s.email}` : undefined} />
        <ContactRow
          icon={Globe}
          label="Website"
          value={website?.replace(/^https?:\/\//, "")}
          href={website ? (website.startsWith("http") ? website : `https://${website}`) : undefined}
        />
      </div>
    </GlassCard>
  );
}

/* ── People ───────────────────────────────────────────────────────────── */

export function PeopleCard({ school: s, metrics, index }: { school: SchoolRecord; metrics: SchoolMetrics | null; index?: number }) {
  return (
    <GlassCard title="People" icon={Users} index={index} info={<MetricInfo id="school.studentTeacherRatio" size="xs" />}>
      <div className="space-y-5">
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <p className="text-[11px] font-medium text-slate-500 dark:text-white/45">Students</p>
            <p className="text-xl font-semibold tabular-nums text-slate-900 dark:text-white">{formatNumber(num(metrics?.totalStudents ?? s.totalStudents))}</p>
          </div>
          <SplitBar
            ariaLabel="Students by gender"
            parts={[
              { label: "Male", value: num(s.maleStudents), color: BRAND },
              { label: "Female", value: num(s.femaleStudents), color: BRAND_LIGHT },
            ]}
          />
        </div>
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <p className="text-[11px] font-medium text-slate-500 dark:text-white/45">
              Teachers
              {metrics?.studentToTeacherRatio != null && (
                <span className="ml-1.5 text-slate-400 dark:text-white/35">· {formatNumber(metrics.studentToTeacherRatio, 1)} students each</span>
              )}
            </p>
            <p className="text-xl font-semibold tabular-nums text-slate-900 dark:text-white">{formatNumber(num(metrics?.totalTeachers ?? s.totalTeachers))}</p>
          </div>
          <SplitBar
            ariaLabel="Teachers by gender"
            parts={[
              { label: "Male", value: num(s.maleTeachers), color: BRAND },
              { label: "Female", value: num(s.femaleTeachers), color: BRAND_LIGHT },
            ]}
          />
        </div>
        <dl className="grid grid-cols-2 gap-3 border-t border-slate-900/6 pt-4 dark:border-white/8">
          <Field label="Administrative staff" value={num(s.adminStaff) != null ? formatNumber(num(s.adminStaff)) : null} />
          <Field label="Support staff" value={num(s.supportStaff) != null ? formatNumber(num(s.supportStaff)) : null} />
        </dl>
      </div>
    </GlassCard>
  );
}

/* ── Land & access ────────────────────────────────────────────────────── */

export function LandAccessCard({ school: s, metrics, index }: { school: SchoolRecord; metrics: SchoolMetrics | null; index?: number }) {
  const used = num(metrics?.usedLandArea ?? s.usedLandArea);
  const unused = num(metrics?.unusedLandArea ?? s.unusedLandArea);
  const total = num(metrics?.totalLandArea);
  const road = num(metrics?.roadStatusPercentage ?? s.roadStatusPercentage);
  const roads = num(s.numberOfAccessRoads);

  return (
    <GlassCard title="Land & access" icon={LandPlot} index={index} info={<MetricInfo id="school.landArea" size="xs" />}>
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] font-medium text-slate-500 dark:text-white/45">Total land</p>
        <p className="text-xl font-semibold tabular-nums text-slate-900 dark:text-white">{total != null ? formatHectares(total) : <span className="text-sm"><Missing>No land data</Missing></span>}</p>
      </div>
      {used != null || unused != null ? (
        <div className="mt-2">
          <SplitBar
            ariaLabel="Land use in hectares"
            parts={[
              { label: "Used", value: used, color: BRAND },
              { label: "Unused", value: unused, color: BRAND_LIGHT },
            ]}
          />
        </div>
      ) : null}

      <div className="mt-5 space-y-3 border-t border-slate-900/6 pt-4 dark:border-white/8">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-white/45">
            <Route className="h-3.5 w-3.5" aria-hidden /> Roads
          </p>
          <p className="text-sm font-medium text-slate-900 dark:text-white/90">
            {s.roadState ? label("roadState", s.roadState) : <Missing />}
            {roads != null && <span className="ml-1.5 text-xs font-normal text-slate-500 dark:text-white/50">· {formatNumber(roads)} access road{roads === 1 ? "" : "s"}</span>}
          </p>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1 font-medium text-slate-500 dark:text-white/45">
              All-season access <MetricInfo id="school.roadAccess" size="xs" />
            </span>
            <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{road != null ? formatPercent(road) : <Missing />}</span>
          </div>
          {road != null && <Meter value={road} label={`${formatPercent(road)} all-season road access`} />}
        </div>
      </div>
    </GlassCard>
  );
}

/* ── Buildings ────────────────────────────────────────────────────────── */

const RANK: Record<ConditionKey, number> = { critical: 0, poor: 1, fair: 2, good: 3, none: 4 };
const META = Object.fromEntries(CONDITIONS.map((c) => [c.key, c])) as Record<ConditionKey, (typeof CONDITIONS)[number]>;
const conditionOf = (b: FacilityBuilding): ConditionKey => {
  const c = String(b.condition ?? "").toLowerCase();
  return (c in META ? c : "none") as ConditionKey;
};

export function BuildingsListCard({ buildings, index, className }: { buildings: (FacilityBuilding & { buildingCode?: string | null })[]; index?: number; className?: string }) {
  const counts = useMemo(() => {
    const c = Object.fromEntries(CONDITIONS.map((x) => [x.key, 0])) as Record<ConditionKey, number>;
    buildings.forEach((b) => c[conditionOf(b)]++);
    return c;
  }, [buildings]);
  const sorted = useMemo(() => [...buildings].sort((a, b) => RANK[conditionOf(a)] - RANK[conditionOf(b)]), [buildings]);

  return (
    <GlassCard
      title="Buildings"
      icon={Building2}
      index={index}
      className={className}
      badge={<span className="rounded-full bg-slate-900/5 px-2 py-0.5 text-[11px] font-medium tabular-nums text-slate-600 dark:bg-white/8 dark:text-white/65">{formatNumber(buildings.length)}</span>}
    >
      {buildings.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-center text-[13px] text-slate-500 dark:border-white/12 dark:text-white/50">
          No buildings recorded. Add them from the 2D map or upload a site map (KMZ).
        </p>
      ) : (
        <>
          <StackBar
            max={buildings.length}
            height={10}
            ariaLabel="Buildings by condition"
            segments={CONDITIONS.map((c) => ({
              key: c.key,
              value: counts[c.key],
              color: c.color,
              textured: c.key === "none",
              tip: (
                <span>
                  {c.label}: <b>{formatNumber(counts[c.key])}</b>
                </span>
              ),
            }))}
          />
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-white/50">
            {CONDITIONS.filter((c) => counts[c.key] > 0).map((c) => (
              <li key={c.key} className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.color }} aria-hidden />
                {c.label} <b className="font-semibold tabular-nums text-slate-800 dark:text-white/85">{counts[c.key]}</b>
              </li>
            ))}
          </ul>
          <ul className="custom-scrollbar -mr-2 mt-3 max-h-72 space-y-1.5 overflow-y-auto pr-2">
            {sorted.map((b) => {
              const c = META[conditionOf(b)];
              const floors = num(b.floors);
              const area = num(b.areaSquareMeters);
              const facts = [b.function || "Use not recorded", floors ? `${formatNumber(floors)} floor${floors === 1 ? "" : "s"}` : null, area ? formatArea(area) : null].filter(Boolean);
              return (
                <li key={b.id} className="flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-slate-900/[0.03] dark:hover:bg-white/[0.04]">
                  <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: c.color }} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-baseline gap-2">
                      <span className="truncate text-[13px] font-medium text-slate-900 dark:text-white/90">{b.name || "Unnamed building"}</span>
                      {b.buildingCode && <span className="shrink-0 font-mono text-[10px] text-slate-400 dark:text-white/35">{b.buildingCode}</span>}
                    </p>
                    <p className="truncate text-[11px] text-slate-500 dark:text-white/45">{facts.join(" · ")}</p>
                  </div>
                  <StatusPill color={c.color}>{c.label}</StatusPill>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </GlassCard>
  );
}
