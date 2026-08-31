import { useState, useEffect, useMemo, useRef } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Users,
  RefreshCw,
  TrendingUp,
  Database,
  MapPin,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "../components/ui/page-header";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { api } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import { hasPermission, Permission } from "../lib/permissions";
import { cn } from "../lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface PopulationRecord {
  id: string;
  schoolId: string;
  school?: {
    id: string;
    name: string;
    code: string;
    province: string;
    district: string;
  };
  population500m: number | null;
  population1km: number | null;
  population2km: number | null;
  schoolAgePopulation500m: number | null;
  schoolAgePopulation1km: number | null;
  schoolAgePopulation2km: number | null;
  populationDensityPerKm2: number | null;
  studentToSchoolRatio: number | null;
  dataSource: string | null;
  syncedAt: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("en-US").format(Math.round(n));

const densityColor = (density: number): string => {
  if (density >= 5000) return "bg-red-500";
  if (density >= 2000) return "bg-orange-500";
  if (density >= 800)  return "bg-amber-500";
  if (density >= 200)  return "bg-yellow-400";
  return "bg-emerald-500";
};

const densityLabel = (density: number): string => {
  if (density >= 5000) return "Very High";
  if (density >= 2000) return "High";
  if (density >= 800)  return "Moderate";
  if (density >= 200)  return "Low";
  return "Very Low";
};

const densityTextColor = (density: number): string => {
  if (density >= 5000) return "text-red-600 dark:text-red-400";
  if (density >= 2000) return "text-orange-600 dark:text-orange-400";
  if (density >= 800)  return "text-amber-600 dark:text-amber-400";
  if (density >= 200)  return "text-yellow-600 dark:text-yellow-400";
  return "text-emerald-600 dark:text-emerald-400";
};

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card className="border border-border/20 bg-card/50 backdrop-blur-sm rounded-3xl overflow-hidden">
      <CardContent className="p-6 flex items-start gap-4">
        <div className={cn("p-3 rounded-2xl shrink-0", color)}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
            {label}
          </p>
          <p className="text-2xl font-semibold text-foreground leading-tight">
            {value}
          </p>
          {sub && (
            <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Custom bar chart tooltip
function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border/20 rounded-2xl p-3 shadow-xl text-[12px] min-w-40">
      <p className="font-semibold text-foreground mb-2 truncate max-w-45">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.fill }} />
            {p.name}
          </span>
          <span className="font-medium text-foreground">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Province heatmap row ──────────────────────────────────────────────────────

function ProvinceRow({
  province,
  schools,
}: {
  province: string;
  schools: PopulationRecord[];
}) {
  const [expanded, setExpanded] = useState(false);
  const avgDensity =
    schools.reduce((s, r) => s + (r.populationDensityPerKm2 ?? 0), 0) /
    (schools.length || 1);
  const maxDensity = Math.max(...schools.map((r) => r.populationDensityPerKm2 ?? 0));
  const totalPop2km = schools.reduce((s, r) => s + (r.population2km ?? 0), 0);

  return (
    <div className="rounded-2xl border border-border/20 overflow-hidden">
      <button
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Density bar */}
        <div className="w-2 self-stretch rounded-full shrink-0" style={{ minHeight: 32 }}>
          <div className={cn("w-2 h-full rounded-full", densityColor(avgDensity))} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-foreground">{province}</span>
            <Badge
              variant="outline"
              className={cn(
                "text-[9px] font-black uppercase tracking-widest rounded-full px-2 py-0 border-transparent",
                densityColor(avgDensity).replace("bg-", "bg-") + "/10",
                densityTextColor(avgDensity),
              )}
            >
              {densityLabel(avgDensity)}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {schools.length} school{schools.length !== 1 ? "s" : ""} ·{" "}
            {fmt(totalPop2km)} total pop. within 2 km
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className={cn("text-base font-semibold tabular-nums", densityTextColor(avgDensity))}>
            {fmt(avgDensity)}
          </p>
          <p className="text-[10px] text-muted-foreground">avg /km²</p>
        </div>
        <span className="text-muted-foreground text-[10px] font-black ml-2">
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border/10"
          >
            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {schools
                .slice()
                .sort((a, b) => (b.populationDensityPerKm2 ?? 0) - (a.populationDensityPerKm2 ?? 0))
                .map((r) => {
                  const d = r.populationDensityPerKm2 ?? 0;
                  const maxD = maxDensity || 1;
                  return (
                    <div
                      key={r.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-card/50 border border-border/10"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-foreground truncate">
                          {r.school?.name ?? r.schoolId}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn("h-full rounded-full", densityColor(d))}
                              style={{ width: `${Math.min(100, (d / maxD) * 100)}%` }}
                            />
                          </div>
                          <span className={cn("text-[10px] font-semibold tabular-nums shrink-0", densityTextColor(d))}>
                            {fmt(d)}/km²
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PopulationAnalytics() {
  const { user } = useAuthStore();
  const canSync = hasPermission(user, Permission.SYNC_POPULATION);

  const [records, setRecords] = useState<PopulationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; errors: string[] } | null>(null);
  const [syncToast, setSyncToast] = useState<"success" | "error" | null>(null);
  const syncToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/population");
      setRecords(res.data ?? []);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await api.post("/population/sync");
      setSyncResult(res.data);
      setSyncToast("success");
      await fetchData();
    } catch {
      setSyncToast("error");
    } finally {
      setSyncing(false);
      if (syncToastTimer.current) clearTimeout(syncToastTimer.current);
      syncToastTimer.current = setTimeout(() => setSyncToast(null), 4000);
    }
  };

  // ── Derived data ────────────────────────────────────────────────────────────

  const withData = records.filter(
    (r) => r.population2km != null || r.populationDensityPerKm2 != null,
  );

  const avgRatio = useMemo(() => {
    const valid = withData.filter((r) => r.studentToSchoolRatio != null);
    if (!valid.length) return null;
    return valid.reduce((s, r) => s + (r.studentToSchoolRatio ?? 0), 0) / valid.length;
  }, [withData]);

  const totalPop2km = useMemo(
    () => withData.reduce((s, r) => s + (r.population2km ?? 0), 0),
    [withData],
  );

  const avgDensity = useMemo(() => {
    const valid = withData.filter((r) => r.populationDensityPerKm2 != null);
    if (!valid.length) return null;
    return valid.reduce((s, r) => s + (r.populationDensityPerKm2 ?? 0), 0) / valid.length;
  }, [withData]);

  // Bar chart: top 12 schools sorted by population2km
  const barData = useMemo(() => {
    return withData
      .filter((r) => r.population2km)
      .sort((a, b) => (b.population2km ?? 0) - (a.population2km ?? 0))
      .slice(0, 12)
      .map((r) => ({
        name: r.school?.name
          ? r.school.name.length > 18
            ? r.school.name.slice(0, 18) + "…"
            : r.school.name
          : r.schoolId.slice(0, 8),
        "500 m":  r.population500m ?? 0,
        "1 km":   r.population1km  ?? 0,
        "2 km":   r.population2km  ?? 0,
      }));
  }, [withData]);

  // Province groups for heatmap
  const provinceGroups = useMemo(() => {
    const map: Record<string, PopulationRecord[]> = {};
    for (const r of withData) {
      const prov = r.school?.province ?? "Unknown";
      (map[prov] ??= []).push(r);
    }
    return Object.entries(map).sort(([, a], [, b]) => b.length - a.length);
  }, [withData]);

  // ── Empty / loading states ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <PageHeader
        title="Population Analytics"
        description="ArcGIS demographic buffers and catchment intelligence for TVET institutions"
        icon={Users}
        actions={
          <div className="flex items-center gap-2">
            {canSync && (
              <Button
                onClick={handleSync}
                disabled={syncing}
                className="rounded-full h-10 px-5 font-black uppercase tracking-wider text-[10px] bg-linear-to-r from-primary to-primary/80 shadow-none hover:opacity-90 transition-all"
              >
                <RefreshCw className={cn("mr-2 h-3.5 w-3.5", syncing && "animate-spin")} />
                {syncing ? "Syncing…" : "Sync Population Data"}
              </Button>
            )}
          </div>
        }
      />

      {/* ── Sync result banner ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {syncResult && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={cn(
              "flex items-center gap-3 px-5 py-3 rounded-2xl text-[13px] font-medium border",
              syncResult.errors.length === 0
                ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                : "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400",
            )}
          >
            {syncResult.errors.length === 0 ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>
              Synced {syncResult.synced} school{syncResult.synced !== 1 ? "s" : ""}
              {syncResult.errors.length > 0 && ` · ${syncResult.errors.length} error(s)`}
            </span>
            {syncResult.errors.length > 0 && (
              <span className="text-[11px] opacity-70 ml-1">
                ({syncResult.errors.slice(0, 2).join("; ")}
                {syncResult.errors.length > 2 ? "…" : ""})
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── No-data empty state ────────────────────────────────────────────── */}
      {withData.length === 0 && (
        <Card className="border border-border/20 bg-card/40 rounded-3xl">
          <CardContent className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
              <Database className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <div>
              <p className="font-semibold text-foreground">No population data yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                {canSync
                  ? 'Use "Sync Population Data" to pull ArcGIS demographics for all schools.'
                  : "Population data has not been synced. Contact an administrator."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {withData.length > 0 && (
        <>
          {/* ── KPI row ─────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Avg Student-to-School Ratio"
              value={avgRatio != null ? avgRatio.toFixed(3) : "—"}
              sub="Students per resident in 2 km catchment"
              icon={TrendingUp}
              color="bg-primary/10 text-primary"
            />
            <KpiCard
              label="Schools with Population Data"
              value={String(withData.length)}
              sub={`of ${records.length} total schools`}
              icon={Database}
              color="bg-blue-500/10 text-blue-500"
            />
            <KpiCard
              label="Total Catchment Population (2 km)"
              value={fmt(totalPop2km)}
              sub="Sum of populations within 2 km of all schools"
              icon={Users}
              color="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            />
            <KpiCard
              label="Avg Population Density"
              value={avgDensity != null ? `${fmt(avgDensity)}/km²` : "—"}
              sub="Average across all synced schools"
              icon={MapPin}
              color="bg-amber-500/10 text-amber-600 dark:text-amber-400"
            />
          </div>

          {/* ── Grouped bar chart ────────────────────────────────────────────── */}
          {barData.length > 0 && (
            <Card className="border border-border/20 bg-card/40 backdrop-blur-sm rounded-3xl overflow-hidden">
              <CardHeader className="border-b border-border/10 pb-4">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary/50 inline-block" />
                  Population by Buffer Radius — Top {barData.length} Schools
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart
                    data={barData}
                    margin={{ top: 8, right: 16, left: 0, bottom: 48 }}
                    barCategoryGap="30%"
                    barGap={3}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="hsl(var(--border))"
                      strokeOpacity={0.4}
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fontWeight: 600, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                      height={60}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                      width={40}
                    />
                    <RechartsTooltip content={<BarTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
                    <Legend
                      wrapperStyle={{ fontSize: 11, fontWeight: 700, paddingTop: 8 }}
                      formatter={(value) => (
                        <span style={{ color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                          {value}
                        </span>
                      )}
                    />
                    <Bar dataKey="500 m" fill="hsl(var(--primary))"       radius={[4, 4, 0, 0]} opacity={0.9} />
                    <Bar dataKey="1 km"  fill="hsl(210 80% 56%)"           radius={[4, 4, 0, 0]} opacity={0.85} />
                    <Bar dataKey="2 km"  fill="hsl(160 60% 45%)"           radius={[4, 4, 0, 0]} opacity={0.8} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* ── Province heatmap ─────────────────────────────────────────────── */}
          {provinceGroups.length > 0 && (
            <Card className="border border-border/20 bg-card/40 backdrop-blur-sm rounded-3xl overflow-hidden">
              <CardHeader className="border-b border-border/10 pb-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary/50 inline-block" />
                    Province Density Heatmap
                  </CardTitle>
                  {/* Legend */}
                  <div className="flex items-center gap-3 flex-wrap">
                    {[
                      { label: "Very Low", cls: "bg-emerald-500" },
                      { label: "Low",      cls: "bg-yellow-400" },
                      { label: "Moderate", cls: "bg-amber-500" },
                      { label: "High",     cls: "bg-orange-500" },
                      { label: "Very High",cls: "bg-red-500" },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-1.5">
                        <div className={cn("w-2.5 h-2.5 rounded-sm", item.cls)} />
                        <span className="text-[10px] font-medium text-muted-foreground">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                {provinceGroups.map(([province, schools]) => (
                  <ProvinceRow key={province} province={province} schools={schools} />
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ── Fixed toast ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {syncToast && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "fixed bottom-6 right-6 z-200 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl pointer-events-none",
              syncToast === "success"
                ? "bg-emerald-600 text-white"
                : "bg-red-600 text-white",
            )}
          >
            {syncToast === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span className="text-[13px] font-medium">
              {syncToast === "success" ? "Population data synced" : "Sync failed — check logs"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
