import { useState, useEffect, useMemo, useRef } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import {
  AlertTriangle,
  Building2,
  TrendingUp,
  BarChart3,
  PieChart as PieIcon,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  Clock,
  School as SchoolIcon,
  Activity,
  Target,
  Layers,
  XCircle,
} from "lucide-react";
import { format, eachDayOfInterval, isSameDay, parseISO, startOfMonth, endOfDay } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { KPICard } from "../analytics/KPICard";
import { PeriodFilter } from "../ui/period-filter";
import type { PeriodRange } from "../ui/period-filter";
import { ImigongoPattern } from "../ui/ImigongoPattern";
import { ReportDetailsModal } from "./ReportDetailsModal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { useSchoolsStore } from "../../store/schoolsStore";
import { api } from "../../lib/api";
import { cn } from "../../lib/utils";
import { Skeleton } from "../ui/skeleton";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Report {
  id: string;
  schoolId: string;
  buildingId?: string;
  facilityId: string;
  itemId: string;
  issueCategory: string | string[];
  description: string;
  status: "PENDING" | "SOLVED" | "NEED_INTERVENTION" | "FAILED";
  attachments: string[];
  reportedBy: string;
  createdAt: string;
  updatedAt: string;
  school?: { name: string; district?: string; province?: string };
}

type SortField =
  | "name"
  | "total"
  | "pending"
  | "needsIntervention"
  | "solved"
  | "resolutionRate";

// ─── Constants ───────────────────────────────────────────────────────────────

const COLORS = {
  PENDING: "#f59e0b",
  SOLVED: "#10b981",
  NEED_INTERVENTION: "#f43f5e",
  FAILED: "#6b7280",
} as const;

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  SOLVED: "Solved",
  NEED_INTERVENTION: "Needs Intervention",
  FAILED: "Failed / Invalid",
};

// ─── Component ───────────────────────────────────────────────────────────────

export function AdminReportingDashboard() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [range, setRange] = useState<PeriodRange>({
    label: "This Month",
    key: "this_month",
    startDate: startOfMonth(new Date()),
    endDate: endOfDay(new Date()),
  });
  const [sortField, setSortField] = useState<SortField>("needsIntervention");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const abortRef = useRef<AbortController | null>(null);

  const { allSchools, fetchAllSchools, facilities } = useSchoolsStore();

  // ── Data Fetching ─────────────────────────────────────────────────────────

  useEffect(() => {
    fetchAllSchools();
  }, [fetchAllSchools]);

  const fetchAllReports = async (currentRange: PeriodRange) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    try {
      const params: Record<string, string> = { page: "1", limit: "1000" };
      if (currentRange.startDate)
        params.startDate = currentRange.startDate.toISOString();
      if (currentRange.endDate)
        params.endDate = currentRange.endDate.toISOString();

      const firstRes = await api.get("/reports", {
        params,
        signal: abortRef.current.signal,
      });
      const firstBatch: Report[] = firstRes.data.data || firstRes.data || [];
      const totalPages: number = firstRes.data.meta?.totalPages ?? 1;

      if (totalPages <= 1) {
        setReports(Array.isArray(firstBatch) ? firstBatch : []);
        return;
      }

      const remaining = Array.from({ length: totalPages - 1 }, (_, i) =>
        api
          .get("/reports", { params: { ...params, page: String(i + 2) } })
          .then((r) => r.data.data || r.data || []),
      );
      const batches = await Promise.all(remaining);
      setReports([...firstBatch, ...batches.flat()]);
    } catch (err: any) {
      if (err?.name !== "CanceledError" && err?.name !== "AbortError") {
        console.error("[AdminReportingDashboard] fetchAllReports error:", err);
        setReports([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllReports(range);
    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRangeChange = (newRange: PeriodRange) => {
    setRange(newRange);
    fetchAllReports(newRange);
  };

  // ── Status Update ─────────────────────────────────────────────────────────

  const handleUpdateStatus = async (reportId: string, status: string) => {
    setIsUpdating(true);
    try {
      await api.patch(`/reports/${reportId}/status`, { status });
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status: status as Report["status"] } : r)),
      );
      if (selectedReport?.id === reportId) {
        setSelectedReport((prev) =>
          prev ? { ...prev, status: status as Report["status"] } : prev,
        );
      }
    } catch (err) {
      console.error("Failed to update report status:", err);
      throw err;
    } finally {
      setIsUpdating(false);
    }
  };

  // ── Sort ──────────────────────────────────────────────────────────────────

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  // ── Computed Values ───────────────────────────────────────────────────────

  const kpiStats = useMemo(() => {
    const total = reports.length;
    const pending = reports.filter((r) => r.status === "PENDING").length;
    const needsIntervention = reports.filter(
      (r) => r.status === "NEED_INTERVENTION",
    ).length;
    const solved = reports.filter((r) => r.status === "SOLVED").length;
    const schoolsAffected = new Set(reports.map((r) => r.schoolId)).size;
    const resolutionRate =
      total > 0 ? Math.round((solved / total) * 100) : 0;
    const avgReportsPerSchool =
      schoolsAffected > 0 ? Math.round(total / schoolsAffected) : 0;
    return {
      total,
      pending,
      needsIntervention,
      solved,
      schoolsAffected,
      resolutionRate,
      avgReportsPerSchool,
    };
  }, [reports]);

  const schoolMatrix = useMemo(() => {
    const bySchool = new Map<string, Report[]>();
    reports.forEach((r) => {
      if (!bySchool.has(r.schoolId)) bySchool.set(r.schoolId, []);
      bySchool.get(r.schoolId)!.push(r);
    });

    const schoolMap = new Map(allSchools.map((s) => [s.id, s]));

    return Array.from(bySchool.entries())
      .map(([schoolId, sReports]) => {
        const school = schoolMap.get(schoolId);
        const total = sReports.length;
        const pending = sReports.filter((r) => r.status === "PENDING").length;
        const needsIntervention = sReports.filter(
          (r) => r.status === "NEED_INTERVENTION",
        ).length;
        const solved = sReports.filter((r) => r.status === "SOLVED").length;
        const failed = sReports.filter((r) => r.status === "FAILED").length;
        const resolutionRate =
          total > 0 ? Math.round((solved / total) * 100) : 0;
        return {
          id: schoolId,
          name: school?.name ?? sReports[0]?.school?.name ?? "Unknown School",
          province:
            school?.province ?? sReports[0]?.school?.province ?? "—",
          district:
            school?.district ?? sReports[0]?.school?.district ?? "—",
          total,
          pending,
          needsIntervention,
          solved,
          failed,
          resolutionRate,
        };
      });
  }, [reports, allSchools]);

  const sortedMatrix = useMemo(() => {
    return [...schoolMatrix].sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc"
          ? av.localeCompare(bv)
          : bv.localeCompare(av);
      }
      return sortDir === "asc"
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });
  }, [schoolMatrix, sortField, sortDir]);

  const decisionBoard = useMemo(
    () => ({
      requiresIntervention: [...schoolMatrix]
        .filter((s) => s.needsIntervention > 0)
        .sort((a, b) => b.needsIntervention - a.needsIntervention),
      highBacklog: [...schoolMatrix]
        .filter((s) => s.pending > 3)
        .sort((a, b) => b.pending - a.pending)
        .slice(0, 8),
      top5ByVolume: [...schoolMatrix]
        .sort((a, b) => b.total - a.total)
        .slice(0, 5),
    }),
    [schoolMatrix],
  );

  const trendData = useMemo(() => {
    if (reports.length === 0) return [];
    const start =
      range.startDate ??
      new Date(
        Math.min(...reports.map((r) => new Date(r.createdAt).getTime())),
      );
    const end = range.endDate ?? new Date();
    try {
      const days = eachDayOfInterval({ start, end });
      return days.map((day) => ({
        date: format(day, "MMM dd"),
        count: reports.filter((r) => {
          try {
            return isSameDay(parseISO(r.createdAt), day);
          } catch {
            return false;
          }
        }).length,
      }));
    } catch {
      return [];
    }
  }, [reports, range]);

  const provinceData = useMemo(() => {
    const schoolMap = new Map(allSchools.map((s) => [s.id, s]));
    const map: Record<string, number> = {};
    reports.forEach((r) => {
      const province =
        schoolMap.get(r.schoolId)?.province ??
        r.school?.province ??
        "Unknown";
      map[province] = (map[province] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [reports, allSchools]);

  const districtData = useMemo(() => {
    const schoolMap = new Map(allSchools.map((s) => [s.id, s]));
    const map: Record<string, number> = {};
    reports.forEach((r) => {
      const district =
        schoolMap.get(r.schoolId)?.district ??
        r.school?.district ??
        "Unknown";
      map[district] = (map[district] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [reports, allSchools]);

  const statusPieData = useMemo(
    () =>
      (
        [
          "PENDING",
          "SOLVED",
          "NEED_INTERVENTION",
          "FAILED",
        ] as const
      )
        .map((s) => ({
          name: STATUS_LABELS[s],
          value: reports.filter((r) => r.status === s).length,
          color: COLORS[s],
        }))
        .filter((d) => d.value > 0),
    [reports],
  );

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    reports.forEach((r) => {
      const cats = Array.isArray(r.issueCategory)
        ? r.issueCategory
        : typeof r.issueCategory === "string"
          ? [r.issueCategory]
          : [];
      cats.filter(Boolean).forEach((c) => {
        map[c] = (map[c] || 0) + 1;
      });
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [reports]);

  const facilityData = useMemo(() => {
    const facilityMap = new Map(
      facilities.map((f) => [f.facilityId, f.title]),
    );
    const map: Record<string, number> = {};
    reports.forEach((r) => {
      const name =
        facilityMap.get(r.facilityId) ?? r.facilityId ?? "Unknown";
      map[name] = (map[name] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [reports, facilities]);

  // ── Sort Header Helper ────────────────────────────────────────────────────

  const SortHeader = ({
    field,
    children,
    className,
  }: {
    field: SortField;
    children: React.ReactNode;
    className?: string;
  }) => (
    <TableHead
      className={cn(
        "cursor-pointer select-none hover:text-foreground transition-colors text-[10px] font-black uppercase tracking-wider",
        className,
      )}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field ? (
          sortDir === "asc" ? (
            <ChevronUp className="h-3 w-3 text-primary" />
          ) : (
            <ChevronDown className="h-3 w-3 text-primary" />
          )
        ) : (
          <ChevronDown className="h-3 w-3 opacity-20" />
        )}
      </div>
    </TableHead>
  );

  // ── Loading Skeleton ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6 pb-20">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-3xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-3xl" />
          <Skeleton className="h-64 rounded-3xl" />
        </div>
        <Skeleton className="h-56 rounded-3xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 rounded-3xl" />
          <Skeleton className="h-64 rounded-3xl" />
          <Skeleton className="h-64 rounded-3xl" />
        </div>
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="relative space-y-6 pb-20">
      <ImigongoPattern
        className="fixed inset-0 text-primary pointer-events-none mask-[linear-gradient(to_bottom_right,black_0%,transparent_40%,transparent_60%,black_100%)]"
        opacity={0.03}
      />

      <div className="relative z-10 space-y-6">
        {/* ── 1. Command Center ─────────────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <KPICard
            title="Total Reports"
            value={kpiStats.total}
            icon={BarChart3}
            variant="info"
            delay={0}
            subValue={`${range.label}`}
          />
          <KPICard
            title="Pending Review"
            value={kpiStats.pending}
            icon={Clock}
            variant="warning"
            delay={0.05}
            subValue={
              kpiStats.total > 0
                ? `${Math.round((kpiStats.pending / kpiStats.total) * 100)}% of total`
                : undefined
            }
          />
          <KPICard
            title="Needs Intervention"
            value={kpiStats.needsIntervention}
            icon={AlertTriangle}
            variant="destructive"
            delay={0.1}
            subValue={
              kpiStats.needsIntervention > 0
                ? "Requires immediate action"
                : "No critical issues"
            }
          />
          <KPICard
            title="Resolution Rate"
            value={`${kpiStats.resolutionRate}%`}
            icon={CheckCircle2}
            variant="success"
            delay={0.15}
            subValue={`${kpiStats.solved} resolved`}
          />
          <KPICard
            title="Schools Affected"
            value={kpiStats.schoolsAffected}
            icon={SchoolIcon}
            variant="default"
            delay={0.2}
            subValue={`of ${allSchools.length} total`}
          />
          <KPICard
            title="Avg Reports / School"
            value={kpiStats.avgReportsPerSchool}
            icon={Activity}
            variant="default"
            delay={0.25}
            subValue="per affected school"
          />
        </div>

        {/* ── 2. Decision Board ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Critical — Requires Intervention */}
          <Card className="rounded-3xl border-rose-500/20 bg-rose-500/5 backdrop-blur-sm shadow-none overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-rose-500">
                <AlertTriangle className="h-4 w-4" />
                Requires Immediate Intervention
                <Badge className="ml-auto bg-rose-500 text-white text-[10px] font-black">
                  {decisionBoard.requiresIntervention.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {decisionBoard.requiresIntervention.length === 0 ? (
                <div className="flex items-center gap-2 py-6 justify-center text-muted-foreground">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <span className="text-[11px] font-semibold">
                    No critical issues in this period
                  </span>
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {decisionBoard.requiresIntervention.map((s, i) => (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-background/60 border border-rose-500/10 hover:border-rose-500/30 transition-colors"
                    >
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-rose-500/15 flex items-center justify-center">
                        <span className="text-[10px] font-black text-rose-500">
                          {i + 1}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link
                          to={`/schools/${s.id}`}
                          className="text-[11px] font-bold truncate hover:text-rose-500 transition-colors block"
                        >
                          {s.name}
                        </Link>
                        <p className="text-[10px] text-muted-foreground">
                          {s.district}, {s.province}
                        </p>
                      </div>
                      <Badge className="bg-rose-500/15 text-rose-600 border-0 text-[10px] font-black flex-shrink-0">
                        {s.needsIntervention} critical
                      </Badge>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* High Backlog + Top Volume */}
          <div className="space-y-4">
            {/* Top 5 by Volume */}
            <Card className="rounded-3xl border-border/20 bg-card/60 backdrop-blur-sm shadow-none overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Top Schools by Report Volume
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {decisionBoard.top5ByVolume.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground text-center py-3">
                    No data
                  </p>
                ) : (
                  decisionBoard.top5ByVolume.map((s, i) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-2"
                    >
                      <span className="text-[10px] font-black text-muted-foreground w-4">
                        {i + 1}.
                      </span>
                      <Link
                        to={`/schools/${s.id}`}
                        className="flex-1 text-[11px] font-semibold truncate hover:text-primary transition-colors"
                      >
                        {s.name}
                      </Link>
                      <div className="flex gap-1">
                        <Badge
                          variant="outline"
                          className="text-[10px] font-black"
                        >
                          {s.total}
                        </Badge>
                        {s.needsIntervention > 0 && (
                          <Badge className="bg-rose-500/15 text-rose-600 border-0 text-[10px] font-black">
                            {s.needsIntervention}⚠
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* High Backlog */}
            <Card className="rounded-3xl border-amber-500/20 bg-amber-500/5 backdrop-blur-sm shadow-none overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-amber-500">
                  <AlertCircle className="h-4 w-4" />
                  High Pending Backlog
                  <Badge className="ml-auto bg-amber-500/20 text-amber-600 border-0 text-[10px] font-black">
                    {decisionBoard.highBacklog.length} schools
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {decisionBoard.highBacklog.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground text-center py-2">
                    No high backlog schools
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {decisionBoard.highBacklog.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-2"
                      >
                        <Link
                          to={`/schools/${s.id}`}
                          className="flex-1 text-[11px] font-semibold truncate hover:text-amber-500 transition-colors"
                        >
                          {s.name}
                        </Link>
                        <Badge className="bg-amber-500/15 text-amber-600 border-0 text-[10px] font-black flex-shrink-0">
                          {s.pending} pending
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── 3. Trend Analysis ─────────────────────────────────────────── */}
        <Card className="rounded-3xl border-border/20 bg-card/60 backdrop-blur-sm shadow-none overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                <Activity className="h-4 w-4 text-primary" />
                Daily Report Submission Trend
              </CardTitle>
              <PeriodFilter onRangeChange={handleRangeChange} />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {trendData.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-muted-foreground text-[11px]">
                No trend data for selected period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart
                  data={trendData}
                  margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="hsl(var(--primary))"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor="hsl(var(--primary))"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    opacity={0.3}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "12px",
                      fontSize: 11,
                    }}
                    labelStyle={{ fontWeight: "bold" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#trendGrad)"
                    name="Reports"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* ── 4. Geographic Distribution ────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Province */}
          <Card className="rounded-3xl border-border/20 bg-card/60 backdrop-blur-sm shadow-none overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                <MapPin className="h-4 w-4 text-primary" />
                Reports by Province
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={Math.max(180, provinceData.length * 36)}>
                <BarChart
                  layout="vertical"
                  data={provinceData}
                  margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    opacity={0.3}
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={90}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "12px",
                      fontSize: 11,
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill="hsl(var(--primary))"
                    radius={[0, 4, 4, 0]}
                    name="Reports"
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* District Top 10 */}
          <Card className="rounded-3xl border-border/20 bg-card/60 backdrop-blur-sm shadow-none overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                <Building2 className="h-4 w-4 text-primary" />
                Top 10 Districts by Reports
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={Math.max(180, districtData.length * 28)}>
                <BarChart
                  layout="vertical"
                  data={districtData}
                  margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    opacity={0.3}
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={90}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "12px",
                      fontSize: 11,
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill={COLORS.NEED_INTERVENTION}
                    radius={[0, 4, 4, 0]}
                    name="Reports"
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* ── 5. Status & Category Analysis ─────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Status Donut */}
          <Card className="lg:col-span-4 rounded-3xl border-border/20 bg-card/60 backdrop-blur-sm shadow-none overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                <PieIcon className="h-4 w-4 text-primary" />
                Status Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 flex flex-col items-center gap-4">
              {statusPieData.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-muted-foreground text-[11px]">
                  No data
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={statusPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={72}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {statusPieData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "12px",
                          fontSize: 11,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="w-full space-y-1.5">
                    {statusPieData.map((d) => (
                      <div
                        key={d.name}
                        className="flex items-center justify-between text-[11px]"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ background: d.color }}
                          />
                          <span className="text-muted-foreground font-medium">
                            {d.name}
                          </span>
                        </div>
                        <span className="font-black tabular-nums">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Top Issue Categories */}
          <Card className="lg:col-span-4 rounded-3xl border-border/20 bg-card/60 backdrop-blur-sm shadow-none overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                <Target className="h-4 w-4 text-primary" />
                Top Issue Categories
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {categoryData.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-muted-foreground text-[11px]">
                  No category data
                </div>
              ) : (
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(160, categoryData.length * 26)}
                >
                  <BarChart
                    layout="vertical"
                    data={categoryData}
                    margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                      opacity={0.3}
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{
                        fontSize: 9,
                        fill: "hsl(var(--muted-foreground))",
                      }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={100}
                      tick={{
                        fontSize: 9,
                        fill: "hsl(var(--muted-foreground))",
                      }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "12px",
                        fontSize: 11,
                      }}
                    />
                    <Bar
                      dataKey="count"
                      fill={COLORS.PENDING}
                      radius={[0, 4, 4, 0]}
                      name="Reports"
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Top Facilities */}
          <Card className="lg:col-span-4 rounded-3xl border-border/20 bg-card/60 backdrop-blur-sm shadow-none overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                <Layers className="h-4 w-4 text-primary" />
                Top Failing Facilities
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {facilityData.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-muted-foreground text-[11px]">
                  No facility data
                </div>
              ) : (
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(160, facilityData.length * 26)}
                >
                  <BarChart
                    layout="vertical"
                    data={facilityData}
                    margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                      opacity={0.3}
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{
                        fontSize: 9,
                        fill: "hsl(var(--muted-foreground))",
                      }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={100}
                      tick={{
                        fontSize: 9,
                        fill: "hsl(var(--muted-foreground))",
                      }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "12px",
                        fontSize: 11,
                      }}
                    />
                    <Bar
                      dataKey="count"
                      fill={COLORS.SOLVED}
                      radius={[0, 4, 4, 0]}
                      name="Reports"
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── 6. Schools Priority Matrix ────────────────────────────────── */}
        <Card className="rounded-3xl border-border/20 bg-card/60 backdrop-blur-sm shadow-none overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
              <BarChart3 className="h-4 w-4 text-primary" />
              Schools Priority Matrix
              <span className="ml-auto text-[10px] font-medium normal-case tracking-normal text-muted-foreground/60">
                {sortedMatrix.length} schools with reports
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 p-0">
            {sortedMatrix.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-2 text-muted-foreground">
                <XCircle className="h-8 w-8 opacity-30" />
                <p className="text-[11px] font-semibold">No school reports in this period</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/30 hover:bg-transparent">
                      <SortHeader field="name">School</SortHeader>
                      <TableHead className="text-[10px] font-black uppercase tracking-wider">
                        Province
                      </TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-wider">
                        District
                      </TableHead>
                      <SortHeader field="total" className="text-right">
                        Total
                      </SortHeader>
                      <SortHeader field="pending" className="text-right">
                        Pending
                      </SortHeader>
                      <SortHeader
                        field="needsIntervention"
                        className="text-right"
                      >
                        Intervention
                      </SortHeader>
                      <SortHeader field="solved" className="text-right">
                        Solved
                      </SortHeader>
                      <SortHeader
                        field="resolutionRate"
                        className="text-right"
                      >
                        Rate
                      </SortHeader>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedMatrix.map((s) => (
                      <TableRow
                        key={s.id}
                        className={cn(
                          "border-border/20 transition-colors",
                          s.needsIntervention > 0
                            ? "bg-rose-500/5 border-l-2 border-l-rose-500 hover:bg-rose-500/10"
                            : s.pending > 5
                              ? "bg-amber-500/5 border-l-2 border-l-amber-500 hover:bg-amber-500/10"
                              : "hover:bg-muted/30",
                        )}
                      >
                        <TableCell className="font-semibold text-[12px]">
                          <Link
                            to={`/schools/${s.id}`}
                            className="hover:text-primary transition-colors"
                          >
                            {s.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-[11px] text-muted-foreground">
                          {s.province}
                        </TableCell>
                        <TableCell className="text-[11px] text-muted-foreground">
                          {s.district}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-[12px] font-black tabular-nums">
                            {s.total}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {s.pending > 0 ? (
                            <Badge className="bg-amber-500/15 text-amber-600 border-0 text-[10px] font-black">
                              {s.pending}
                            </Badge>
                          ) : (
                            <span className="text-[11px] text-muted-foreground/40">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {s.needsIntervention > 0 ? (
                            <Badge className="bg-rose-500/15 text-rose-600 border-0 text-[10px] font-black">
                              {s.needsIntervention}
                            </Badge>
                          ) : (
                            <span className="text-[11px] text-muted-foreground/40">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {s.solved > 0 ? (
                            <Badge className="bg-emerald-500/15 text-emerald-600 border-0 text-[10px] font-black">
                              {s.solved}
                            </Badge>
                          ) : (
                            <span className="text-[11px] text-muted-foreground/40">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={cn(
                              "text-[12px] font-black tabular-nums",
                              s.resolutionRate >= 75
                                ? "text-emerald-500"
                                : s.resolutionRate >= 40
                                  ? "text-amber-500"
                                  : "text-rose-500",
                            )}
                          >
                            {s.resolutionRate}%
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Report Details Modal ──────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedReport && (
          <ReportDetailsModal
            report={selectedReport}
            onClose={() => setSelectedReport(null)}
            onUpdateStatus={handleUpdateStatus}
            isUpdating={isUpdating}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
