import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
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
  MapPin,
  CheckCircle2,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Clock,
  School as SchoolIcon,
  Activity,
  Target,
  Layers,
  XCircle,
  RotateCcw,
  Filter,
  Gauge,
} from "lucide-react";
import {
  format,
  formatDistanceToNowStrict,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  isSameDay,
  isSameWeek,
  isSameMonth,
  parseISO,
  startOfMonth,
  endOfDay,
  differenceInCalendarDays,
} from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
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
import { MetricCard } from "../ui/metric-card";
import { useCountUp, deltaPct } from "../../lib/dashboard-utils";

/* ─────────────────────────────── model ─────────────────────────────── */

type Status = "PENDING" | "SOLVED" | "NEED_INTERVENTION" | "FAILED";

interface Report {
  id: string;
  schoolId: string;
  buildingId?: string;
  facilityId: string;
  itemId?: string;
  issueCategory: string | string[];
  description: string;
  status: Status;
  attachments?: string[];
  reportedBy?: string;
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string | null;
  school?: { name: string; district?: string; province?: string };
}

type SortField =
  | "name"
  | "total"
  | "pending"
  | "needsIntervention"
  | "solved"
  | "resolutionRate";

const STATUS: Record<
  Status,
  { label: string; color: string; text: string; bg: string; ring: string }
> = {
  PENDING: {
    label: "Pending",
    color: "#f59e0b",
    text: "text-amber-500",
    bg: "bg-amber-500/12",
    ring: "ring-amber-500/40",
  },
  NEED_INTERVENTION: {
    label: "Needs Intervention",
    color: "#f43f5e",
    text: "text-rose-500",
    bg: "bg-rose-500/12",
    ring: "ring-rose-500/40",
  },
  SOLVED: {
    label: "Solved",
    color: "#10b981",
    text: "text-emerald-500",
    bg: "bg-emerald-500/12",
    ring: "ring-emerald-500/40",
  },
  FAILED: {
    label: "Failed / Invalid",
    color: "#94a3b8",
    text: "text-slate-400",
    bg: "bg-slate-500/12",
    ring: "ring-slate-500/40",
  },
};
const STATUS_ORDER: Status[] = [
  "PENDING",
  "NEED_INTERVENTION",
  "SOLVED",
  "FAILED",
];

/* ─────────────────────────────── helpers ─────────────────────────────── */

const asArray = (c: Report["issueCategory"]): string[] =>
  Array.isArray(c) ? c.filter(Boolean) : c ? [c] : [];

/* ─────────────────────────── section shell ─────────────────────────── */

function Section({
  icon: Icon,
  title,
  action,
  children,
  className,
  accent = "text-primary",
}: {
  icon: typeof Clock;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  accent?: string;
}) {
  return (
    <Card
      className={cn(
        "rounded-3xl border border-border/30 bg-card/60 backdrop-blur-sm shadow-none overflow-hidden",
        className,
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
            <Icon className={cn("h-4 w-4", accent)} />
            {title}
          </CardTitle>
          {action}
        </div>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

/* ─────────────────────────── resolution gauge ─────────────────────────── */

function ResolutionGauge({ rate }: { rate: number }) {
  const v = useCountUp(rate);
  const tone =
    rate >= 75 ? "#10b981" : rate >= 50 ? "#f59e0b" : "#f43f5e";
  const r = 58;
  const circ = Math.PI * r; // half-circumference
  const off = circ - (Math.min(100, Math.max(0, rate)) / 100) * circ;
  const arc = `M ${70 - r} 70 A ${r} ${r} 0 0 1 ${70 + r} 70`;
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 140 80" className="w-44">
        <path d={arc} fill="none" stroke="hsl(var(--muted))" strokeWidth="12" strokeLinecap="round" />
        <path
          d={arc}
          fill="none"
          stroke={tone}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={off}
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="-mt-8 text-center">
        <div className="text-3xl font-black tabular-nums" style={{ color: tone }}>
          {Math.round(v)}
          <span className="text-lg">%</span>
        </div>
        <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">
          Resolution rate
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════ component ═══════════════════════════════ */

export function AdminReportingDashboard() {
  const [allReports, setAllReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [range, setRange] = useState<PeriodRange>({
    label: "This Month",
    key: "this_month",
    startDate: startOfMonth(new Date()),
    endDate: endOfDay(new Date()),
  });
  const [statusFilter, setStatusFilter] = useState<Status | null>(null);
  const [sortField, setSortField] = useState<SortField>("needsIntervention");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const abortRef = useRef<AbortController | null>(null);

  const { allSchools, fetchAllSchools, facilities } = useSchoolsStore();

  useEffect(() => {
    fetchAllSchools();
  }, [fetchAllSchools]);

  // ── One fetch, client-side windowing → instant period switching ──────────
  const load = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    try {
      const first = await api.get("/reports", {
        params: { page: 1, limit: 1000 },
        signal: ctrl.signal,
      });
      const batch1: Report[] = first.data?.data ?? first.data ?? [];
      const total: number = first.data?.total ?? batch1.length;
      const pages = Math.min(10, Math.ceil(total / 1000)); // hard cap 10k

      let rows = batch1;
      if (pages > 1) {
        const rest = await Promise.all(
          Array.from({ length: pages - 1 }, (_, i) =>
            api
              .get("/reports", { params: { page: i + 2, limit: 1000 } })
              .then((r) => (r.data?.data ?? r.data ?? []) as Report[]),
          ),
        );
        rows = [...batch1, ...rest.flat()];
      }
      setAllReports(Array.isArray(rows) ? rows : []);
    } catch (err) {
      const name = (err as { name?: string })?.name;
      if (name !== "CanceledError" && name !== "AbortError") {
        console.error("[AdminReportingDashboard] load error", err);
        setAllReports([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  // ── School lookup ─────────────────────────────────────────────────────────
  const schoolMap = useMemo(
    () => new Map(allSchools.map((s) => [s.id, s])),
    [allSchools],
  );
  // Operating-network size — denominator for "% of schools" KPIs.
  const activeSchoolCount = useMemo(
    () =>
      allSchools.filter((s) => (s.status ?? "active") === "active").length,
    [allSchools],
  );
  const provinceOf = useCallback(
    (r: Report) =>
      schoolMap.get(r.schoolId)?.province ?? r.school?.province ?? "Unknown",
    [schoolMap],
  );
  const districtOf = useCallback(
    (r: Report) =>
      schoolMap.get(r.schoolId)?.district ?? r.school?.district ?? "Unknown",
    [schoolMap],
  );
  const nameOf = useCallback(
    (r: Report) =>
      schoolMap.get(r.schoolId)?.name ?? r.school?.name ?? "Unknown School",
    [schoolMap],
  );

  // ── Windowing (current + previous equal window) ───────────────────────────
  const inWindow = (r: Report, start: Date | null, end: Date | null) => {
    const t = new Date(r.createdAt).getTime();
    if (Number.isNaN(t)) return false;
    if (start && t < start.getTime()) return false;
    if (end && t > end.getTime()) return false;
    return true;
  };

  const windowReports = useMemo(
    () =>
      allReports.filter((r) =>
        inWindow(r, range.startDate, range.endDate),
      ),
    [allReports, range],
  );

  const prevWindowReports = useMemo(() => {
    if (!range.startDate || !range.endDate) return [];
    const span = range.endDate.getTime() - range.startDate.getTime();
    const prevStart = new Date(range.startDate.getTime() - span - 1);
    const prevEnd = new Date(range.startDate.getTime() - 1);
    return allReports.filter((r) => inWindow(r, prevStart, prevEnd));
  }, [allReports, range]);

  // statusFilter narrows everything *below* the KPI/donut band
  const filteredReports = useMemo(
    () =>
      statusFilter
        ? windowReports.filter((r) => r.status === statusFilter)
        : windowReports,
    [windowReports, statusFilter],
  );

  // ── KPIs (from the full window) ──────────────────────────────────────────
  const count = (rs: Report[], s: Status) =>
    rs.filter((r) => r.status === s).length;

  const kpi = useMemo(() => {
    const rs = windowReports;
    const total = rs.length;
    const pending = count(rs, "PENDING");
    const needsIntervention = count(rs, "NEED_INTERVENTION");
    const solved = count(rs, "SOLVED");
    const failed = count(rs, "FAILED");
    const schoolsAffected = new Set(rs.map((r) => r.schoolId)).size;

    // Resolution rate = solved ÷ genuine issues (FAILED are invalid, excluded).
    const genuine = total - failed;
    const resolutionRate =
      genuine > 0 ? Math.round((solved / genuine) * 100) : 0;

    const avgReportsPerSchool = schoolsAffected > 0 ? total / schoolsAffected : 0;

    // Mean days to resolution — prefer the real resolvedAt timestamp.
    const durations = rs
      .filter((r) => r.status === "SOLVED")
      .map((r) => {
        const endStr = r.resolvedAt ?? r.updatedAt;
        if (!endStr || !r.createdAt) return null;
        const d =
          (new Date(endStr).getTime() - new Date(r.createdAt).getTime()) /
          86_400_000;
        return Number.isFinite(d) && d >= 0 ? d : null;
      })
      .filter((d): d is number => d != null);
    const avgResolutionDays = durations.length
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    const openAges = rs
      .filter((r) => r.status === "PENDING" || r.status === "NEED_INTERVENTION")
      .map((r) => differenceInCalendarDays(new Date(), new Date(r.createdAt)))
      .filter((n) => Number.isFinite(n) && n >= 0);
    const oldestOpenDays = openAges.length ? Math.max(...openAges) : 0;

    // previous-window comparatives
    const p = prevWindowReports;
    const prev = {
      total: p.length,
      pending: count(p, "PENDING"),
      needsIntervention: count(p, "NEED_INTERVENTION"),
      solved: count(p, "SOLVED"),
      schoolsAffected: new Set(p.map((r) => r.schoolId)).size,
    };

    return {
      total,
      pending,
      needsIntervention,
      solved,
      failed,
      schoolsAffected,
      resolutionRate,
      avgReportsPerSchool,
      avgResolutionDays,
      oldestOpenDays,
      open: pending + needsIntervention,
      d: {
        total: deltaPct(total, prev.total),
        pending: deltaPct(pending, prev.pending),
        needsIntervention: deltaPct(needsIntervention, prev.needsIntervention),
        solved: deltaPct(solved, prev.solved),
        schoolsAffected: deltaPct(schoolsAffected, prev.schoolsAffected),
      },
    };
  }, [windowReports, prevWindowReports]);

  // ── Adaptive trend + KPI sparklines in one bucketing pass ────────────────
  const { trendData, trendBucket, sparks } = useMemo(() => {
    const rs = windowReports;
    const empty = { trendData: [] as { date: string; count: number }[], trendBucket: "day" as const, sparks: { total: [] as number[], pending: [] as number[], needsIntervention: [] as number[], solved: [] as number[] } };
    if (rs.length === 0) return empty;

    const start =
      range.startDate ??
      new Date(Math.min(...rs.map((r) => new Date(r.createdAt).getTime())));
    const end = range.endDate ?? new Date();
    try {
      const span = differenceInCalendarDays(end, start);
      const bucket: "day" | "week" | "month" =
        span <= 31 ? "day" : span <= 180 ? "week" : "month";
      const buckets =
        bucket === "day"
          ? eachDayOfInterval({ start, end })
          : bucket === "week"
            ? eachWeekOfInterval({ start, end }, { weekStartsOn: 1 })
            : eachMonthOfInterval({ start, end });
      const same = (a: Date, b: Date) =>
        bucket === "day"
          ? isSameDay(a, b)
          : bucket === "week"
            ? isSameWeek(a, b, { weekStartsOn: 1 })
            : isSameMonth(a, b);
      const lbl =
        bucket === "day" ? "MMM d" : bucket === "week" ? "'W'w" : "MMM";

      const parsed = rs
        .map((r) => {
          try {
            return { d: parseISO(r.createdAt), s: r.status };
          } catch {
            return null;
          }
        })
        .filter((x): x is { d: Date; s: Status } => !!x && !Number.isNaN(x.d.getTime()));

      const series = buckets.map((b) => {
        const hit = parsed.filter((x) => same(x.d, b));
        return {
          date: format(b, lbl),
          count: hit.length,
          pending: hit.filter((x) => x.s === "PENDING").length,
          needsIntervention: hit.filter((x) => x.s === "NEED_INTERVENTION").length,
          solved: hit.filter((x) => x.s === "SOLVED").length,
        };
      });

      const tail = (k: "count" | "pending" | "needsIntervention" | "solved") =>
        series.slice(-12).map((x) => x[k]);

      return {
        trendBucket: bucket,
        trendData: series.map(({ date, count }) => ({ date, count })),
        sparks: {
          total: tail("count"),
          pending: tail("pending"),
          needsIntervention: tail("needsIntervention"),
          solved: tail("solved"),
        },
      };
    } catch {
      return empty;
    }
  }, [windowReports, range]);

  // ── Per-school aggregation ──────────────────────────────────────────────
  const buildMatrix = useCallback(
    (rows: Report[]) => {
      const by = new Map<string, Report[]>();
      rows.forEach((r) => {
        if (!by.has(r.schoolId)) by.set(r.schoolId, []);
        by.get(r.schoolId)!.push(r);
      });
      return Array.from(by.entries()).map(([id, rs]) => {
        const total = rs.length;
        const pending = rs.filter((r) => r.status === "PENDING").length;
        const needsIntervention = rs.filter((r) => r.status === "NEED_INTERVENTION").length;
        const solved = rs.filter((r) => r.status === "SOLVED").length;
        const failed = rs.filter((r) => r.status === "FAILED").length;
        const genuine = total - failed;
        return {
          id,
          name: nameOf(rs[0]),
          province: provinceOf(rs[0]),
          district: districtOf(rs[0]),
          total,
          pending,
          needsIntervention,
          solved,
          resolutionRate: genuine > 0 ? Math.round((solved / genuine) * 100) : 0,
        };
      });
    },
    [nameOf, provinceOf, districtOf],
  );

  // Board always reflects the full window (what actually needs attention);
  // the table respects the active status filter (drill-down view).
  const windowMatrix = useMemo(() => buildMatrix(windowReports), [buildMatrix, windowReports]);
  const schoolMatrix = useMemo(() => {
    if (!statusFilter) return windowMatrix;
    const keep = new Set(filteredReports.map((r) => r.schoolId));
    return windowMatrix.filter((s) => keep.has(s.id));
  }, [windowMatrix, filteredReports, statusFilter]);

  const sortedMatrix = useMemo(() => {
    return [...schoolMatrix].sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      if (typeof av === "string" && typeof bv === "string")
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc"
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });
  }, [schoolMatrix, sortField, sortDir]);

  const BACKLOG_THRESHOLD = 4;
  const board = useMemo(() => {
    const src = windowMatrix;
    const backlog = src
      .filter((s) => s.pending >= BACKLOG_THRESHOLD)
      .sort((a, b) => b.pending - a.pending);
    return {
      intervention: src
        .filter((s) => s.needsIntervention > 0)
        .sort((a, b) => b.needsIntervention - a.needsIntervention),
      backlog: backlog.slice(0, 6),
      backlogTotal: backlog.length,
      topVolume: [...src].sort((a, b) => b.total - a.total).slice(0, 5),
    };
  }, [windowMatrix]);

  // ── Distributions ───────────────────────────────────────────────────────
  const groupCount = (fn: (r: Report) => string, limit?: number) => {
    const m: Record<string, number> = {};
    filteredReports.forEach((r) => {
      const k = fn(r);
      m[k] = (m[k] || 0) + 1;
    });
    const out = Object.entries(m)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    return limit ? out.slice(0, limit) : out;
  };

  const provinceData = useMemo(
    () => groupCount(provinceOf),
    [filteredReports, provinceOf], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const districtData = useMemo(
    () => groupCount(districtOf, 8),
    [filteredReports, districtOf], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const facilityMap = useMemo(
    () => new Map(facilities.map((f) => [f.facilityId, f.title])),
    [facilities],
  );
  const facilityData = useMemo(
    () => groupCount((r) => facilityMap.get(r.facilityId) ?? r.facilityId ?? "Unknown", 8),
    [filteredReports, facilityMap], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const categoryData = useMemo(() => {
    const m: Record<string, number> = {};
    filteredReports.forEach((r) =>
      asArray(r.issueCategory).forEach((c) => {
        m[c] = (m[c] || 0) + 1;
      }),
    );
    return Object.entries(m)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [filteredReports]);

  const donut = useMemo(
    () =>
      STATUS_ORDER.map((s) => ({
        key: s,
        name: STATUS[s].label,
        value: count(windowReports, s),
        color: STATUS[s].color,
      })).filter((d) => d.value > 0),
    [windowReports],
  );

  const recent = useMemo(
    () =>
      [...filteredReports]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, 8),
    [filteredReports],
  );

  // ── Interactions ────────────────────────────────────────────────────────
  const toggleStatus = (s: Status) =>
    setStatusFilter((cur) => (cur === s ? null : s));

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    setIsUpdating(true);
    try {
      await api.patch(`/reports/${id}/status`, { status });
      const patch = (r: Report): Report =>
        r.id === id
          ? {
              ...r,
              status: status as Status,
              resolvedAt:
                status === "SOLVED"
                  ? r.resolvedAt ?? new Date().toISOString()
                  : r.resolvedAt,
              updatedAt: new Date().toISOString(),
            }
          : r;
      setAllReports((prev) => prev.map(patch));
      setSelectedReport((prev) => (prev ? patch(prev) : prev));
    } finally {
      setIsUpdating(false);
    }
  };

  const tooltipStyle = {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "12px",
    fontSize: 11,
  };

  const HBar = ({
    data,
    color,
    empty,
  }: {
    data: { name: string; count: number }[];
    color: string;
    empty: string;
  }) =>
    data.length === 0 ? (
      <div className="h-40 flex items-center justify-center text-muted-foreground text-[11px]">
        {empty}
      </div>
    ) : (
      <ResponsiveContainer width="100%" height={Math.max(150, data.length * 30)}>
        <BarChart layout="vertical" data={data} margin={{ left: 0, right: 12 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            opacity={0.25}
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
            width={96}
            tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
          />
          <RechartsTooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
          <Bar dataKey="count" fill={color} radius={[0, 5, 5, 0]} name="Reports" barSize={16} />
        </BarChart>
      </ResponsiveContainer>
    );

  const SortHeader = ({
    field,
    children,
    className,
  }: {
    field: SortField;
    children: ReactNode;
    className?: string;
  }) => (
    <TableHead
      className={cn(
        "cursor-pointer select-none hover:text-foreground transition-colors text-[10px] font-black uppercase tracking-wider",
        className,
      )}
      onClick={() => handleSort(field)}
    >
      <div className={cn("flex items-center gap-1", className?.includes("text-right") && "justify-end")}>
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

  // ── Loading ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6 pb-20">
        <Skeleton className="h-12 rounded-2xl w-full max-w-sm" />
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-3xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-72 rounded-3xl lg:col-span-1" />
          <Skeleton className="h-72 rounded-3xl lg:col-span-2" />
        </div>
        <Skeleton className="h-64 rounded-3xl" />
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    );
  }

  const noData = allReports.length === 0;

  return (
    <div className="relative space-y-6 pb-20">
      <ImigongoPattern
        className="fixed inset-0 text-primary pointer-events-none mask-[linear-gradient(to_bottom_right,black_0%,transparent_45%,transparent_55%,black_100%)]"
        opacity={0.025}
      />

      <div className="relative z-10 space-y-6">
        {/* ── Toolbar ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <PeriodFilter onRangeChange={setRange} />
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/30 bg-card/60 px-3 h-9 text-[10px] font-black uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-primary/5 transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> Refresh
            </button>
            {statusFilter && (
              <button
                onClick={() => setStatusFilter(null)}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/30 px-3 h-9 text-[10px] font-black uppercase tracking-wider text-primary"
              >
                <Filter className="w-3 h-3" />
                {STATUS[statusFilter].label}
                <XCircle className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 tabular-nums">
            {kpi.total} report{kpi.total === 1 ? "" : "s"} · {range.label}
          </div>
        </div>

        {noData ? (
          <Card className="rounded-3xl border border-dashed border-border/50 bg-card/40">
            <CardContent className="py-20 flex flex-col items-center gap-3 text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <BarChart3 className="w-7 h-7 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground max-w-xs">
                No infrastructure issue reports have been filed yet. They'll appear
                here as schools submit them.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* ── KPI grid ────────────────────────────────────────────── */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              <MetricCard
                icon={BarChart3}
                label="Total Reports"
                value={kpi.total}
                delta={kpi.d.total}
                spark={sparks.total}
                sparkColor="#3b82f6"
                tone="text-primary"
                toneBg="bg-primary/10"
                delay={0}
              />
              <MetricCard
                icon={Clock}
                label="Pending Review"
                value={kpi.pending}
                hint={kpi.total ? `${Math.round((kpi.pending / kpi.total) * 100)}% of reports` : undefined}
                delta={kpi.d.pending}
                spark={sparks.pending}
                sparkColor={STATUS.PENDING.color}
                tone="text-amber-500"
                toneBg="bg-amber-500/12"
                active={statusFilter === "PENDING"}
                onClick={() => toggleStatus("PENDING")}
                delay={0.04}
              />
              <MetricCard
                icon={AlertTriangle}
                label="Needs Intervention"
                value={kpi.needsIntervention}
                hint={kpi.needsIntervention > 0 ? "Immediate action" : "No critical issues"}
                delta={kpi.d.needsIntervention}
                spark={sparks.needsIntervention}
                sparkColor={STATUS.NEED_INTERVENTION.color}
                tone="text-rose-500"
                toneBg="bg-rose-500/12"
                active={statusFilter === "NEED_INTERVENTION"}
                onClick={() => toggleStatus("NEED_INTERVENTION")}
                delay={0.08}
              />
              <MetricCard
                icon={CheckCircle2}
                label="Resolution Rate"
                value={kpi.resolutionRate}
                suffix="%"
                hint={
                  kpi.failed > 0
                    ? `${kpi.solved} solved · ${kpi.failed} invalid excl.`
                    : `${kpi.solved} of ${kpi.total} resolved`
                }
                spark={sparks.solved}
                sparkColor={STATUS.SOLVED.color}
                tone="text-emerald-500"
                toneBg="bg-emerald-500/12"
                active={statusFilter === "SOLVED"}
                onClick={() => toggleStatus("SOLVED")}
                delay={0.12}
              />
              <MetricCard
                icon={SchoolIcon}
                label="Schools Affected"
                value={kpi.schoolsAffected}
                hint={activeSchoolCount ? `${Math.round((kpi.schoolsAffected / activeSchoolCount) * 100)}% of ${activeSchoolCount}` : undefined}
                delta={kpi.d.schoolsAffected}
                tone="text-violet-500"
                toneBg="bg-violet-500/12"
                delay={0.16}
              />
              <MetricCard
                icon={Activity}
                label="Avg Reports / School"
                value={kpi.avgReportsPerSchool}
                decimals={1}
                hint="per affected school"
                tone="text-sky-500"
                toneBg="bg-sky-500/12"
                delay={0.2}
              />
              <MetricCard
                icon={Clock}
                label="Avg Resolution Time"
                value={kpi.avgResolutionDays > 0 ? kpi.avgResolutionDays : "—"}
                decimals={1}
                suffix={kpi.avgResolutionDays > 0 ? "d" : ""}
                hint={kpi.solved > 0 ? `${kpi.solved} resolved reports` : "no resolved reports"}
                tone={kpi.avgResolutionDays > 14 ? "text-amber-500" : "text-emerald-500"}
                toneBg={kpi.avgResolutionDays > 14 ? "bg-amber-500/12" : "bg-emerald-500/12"}
                delay={0.24}
              />
              <MetricCard
                icon={AlertCircle}
                label="Oldest Open Report"
                value={kpi.oldestOpenDays > 0 ? kpi.oldestOpenDays : "—"}
                suffix={kpi.oldestOpenDays > 0 ? "d" : ""}
                hint={kpi.open > 0 ? `${kpi.open} still open` : "nothing open"}
                tone={kpi.oldestOpenDays > 30 ? "text-rose-500" : kpi.oldestOpenDays > 14 ? "text-amber-500" : "text-muted-foreground"}
                toneBg={kpi.oldestOpenDays > 30 ? "bg-rose-500/12" : kpi.oldestOpenDays > 14 ? "bg-amber-500/12" : "bg-muted"}
                delay={0.28}
              />
            </div>

            {/* ── Status mix + Trend ──────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Section icon={Gauge} title="Status Mix" accent="text-primary">
                <div className="flex flex-col items-center gap-4">
                  <ResolutionGauge rate={kpi.resolutionRate} />
                  {donut.length > 0 && (
                    <>
                      <ResponsiveContainer width="100%" height={130}>
                        <PieChart>
                          <Pie
                            data={donut}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={62}
                            paddingAngle={donut.length > 1 ? 3 : 0}
                            dataKey="value"
                            onClick={(d) => {
                              const o = d as { key?: Status; payload?: { key?: Status } };
                              const k = o?.key ?? o?.payload?.key;
                              if (k) toggleStatus(k);
                            }}
                            className="cursor-pointer focus:outline-none"
                          >
                            {donut.map((d) => (
                              <Cell
                                key={d.key}
                                fill={d.color}
                                opacity={
                                  !statusFilter || statusFilter === d.key ? 1 : 0.3
                                }
                                stroke="hsl(var(--card))"
                                strokeWidth={2}
                              />
                            ))}
                          </Pie>
                          <RechartsTooltip contentStyle={tooltipStyle} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="w-full space-y-1">
                        {donut.map((d) => (
                          <button
                            key={d.key}
                            onClick={() => toggleStatus(d.key)}
                            className={cn(
                              "w-full flex items-center justify-between text-[11px] rounded-lg px-2 py-1.5 transition-colors",
                              statusFilter === d.key
                                ? "bg-muted"
                                : "hover:bg-muted/50",
                            )}
                          >
                            <span className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ background: d.color }}
                              />
                              <span className="text-muted-foreground font-semibold">
                                {d.name}
                              </span>
                            </span>
                            <span className="font-black tabular-nums">
                              {d.value}
                              <span className="text-muted-foreground/50 font-bold ml-1">
                                {Math.round((d.value / kpi.total) * 100)}%
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </Section>

              <Section
                icon={Activity}
                title={`${trendBucket === "day" ? "Daily" : trendBucket === "week" ? "Weekly" : "Monthly"} Submission Trend`}
                className="lg:col-span-2"
              >
                {trendData.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-muted-foreground text-[11px]">
                    No trend data for this period
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={210}>
                    <AreaChart data={trendData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                      <defs>
                        <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.25} vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={20} />
                      <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
                      <RechartsTooltip contentStyle={tooltipStyle} labelStyle={{ fontWeight: 800 }} cursor={{ stroke: "hsl(var(--primary))", strokeOpacity: 0.3 }} />
                      <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2.25} fill="url(#trendGrad)" name="Reports" dot={false} activeDot={{ r: 4 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </Section>
            </div>

            {/* ── Decision board ──────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Section
                icon={AlertTriangle}
                title="Requires Immediate Intervention"
                accent="text-rose-500"
                className="border-rose-500/20 bg-rose-500/3"
                action={
                  <Badge className="bg-rose-500 text-white text-[10px] font-black tabular-nums">
                    {board.intervention.length}
                  </Badge>
                }
              >
                {board.intervention.length === 0 ? (
                  <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    <span className="text-[11px] font-semibold">All clear for this period</span>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {board.intervention.map((s, i) => (
                      <motion.div
                        key={s.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(i * 0.03, 0.3) }}
                        className="flex items-center gap-3 p-2.5 rounded-xl bg-background/60 border border-rose-500/12 hover:border-rose-500/35 transition-colors"
                      >
                        <span className="shrink-0 w-6 h-6 rounded-lg bg-rose-500/15 flex items-center justify-center text-[10px] font-black text-rose-500 tabular-nums">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <Link to={`/schools/${s.id}`} className="text-[11px] font-bold truncate hover:text-rose-500 transition-colors block">
                            {s.name}
                          </Link>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {s.district}, {s.province}
                          </p>
                        </div>
                        <Badge className="bg-rose-500/15 text-rose-600 border-0 text-[10px] font-black shrink-0 tabular-nums">
                          {s.needsIntervention} critical
                        </Badge>
                      </motion.div>
                    ))}
                  </div>
                )}
              </Section>

              <div className="space-y-6">
                <Section icon={TrendingUp} title="Top Schools by Volume">
                  {board.topVolume.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground text-center py-4">No data</p>
                  ) : (
                    <div className="space-y-2.5">
                      {board.topVolume.map((s, i) => {
                        const max = board.topVolume[0].total || 1;
                        return (
                          <div key={s.id} className="flex items-center gap-3">
                            <span className="text-[10px] font-black text-muted-foreground/60 w-3 tabular-nums">{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <Link to={`/schools/${s.id}`} className="text-[11px] font-semibold truncate hover:text-primary transition-colors">
                                  {s.name}
                                </Link>
                                <span className="text-[11px] font-black tabular-nums shrink-0">{s.total}</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${(s.total / max) * 100}%` }}
                                  transition={{ duration: 0.6, delay: i * 0.05 }}
                                  className={cn("h-full rounded-full", s.needsIntervention > 0 ? "bg-rose-500" : "bg-primary")}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Section>

                <Section
                  icon={AlertCircle}
                  title="High Pending Backlog"
                  accent="text-amber-500"
                  className="border-amber-500/20 bg-amber-500/3"
                  action={
                    <Badge className="bg-amber-500/20 text-amber-600 border-0 text-[10px] font-black tabular-nums">
                      {board.backlogTotal} schools
                    </Badge>
                  }
                >
                  {board.backlog.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground text-center py-3">No backlog schools</p>
                  ) : (
                    <div className="space-y-1.5">
                      {board.backlog.map((s) => (
                        <div key={s.id} className="flex items-center gap-2">
                          <Link to={`/schools/${s.id}`} className="flex-1 text-[11px] font-semibold truncate hover:text-amber-500 transition-colors">
                            {s.name}
                          </Link>
                          <Badge className="bg-amber-500/15 text-amber-600 border-0 text-[10px] font-black shrink-0 tabular-nums">
                            {s.pending} pending
                          </Badge>
                        </div>
                      ))}
                      {board.backlogTotal > board.backlog.length && (
                        <p className="text-[10px] text-muted-foreground/60 text-center pt-1">
                          +{board.backlogTotal - board.backlog.length} more
                        </p>
                      )}
                    </div>
                  )}
                </Section>
              </div>
            </div>

            {/* ── Distributions ──────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Section icon={MapPin} title="Reports by Province">
                <HBar data={provinceData} color="hsl(var(--primary))" empty="No location data" />
              </Section>
              <Section icon={Building2} title="Top Districts">
                <HBar data={districtData} color={STATUS.NEED_INTERVENTION.color} empty="No district data" />
              </Section>
              <Section icon={Target} title="Top Issue Categories">
                <HBar data={categoryData} color={STATUS.PENDING.color} empty="No category data" />
              </Section>
              <Section icon={Layers} title="Top Failing Facilities">
                <HBar data={facilityData} color={STATUS.SOLVED.color} empty="No facility data" />
              </Section>
            </div>

            {/* ── Recent activity (wires the detail modal) ────────────── */}
            <Section
              icon={Activity}
              title="Recent Activity"
              action={
                <span className="text-[10px] font-medium normal-case tracking-normal text-muted-foreground/60">
                  tap a row to review & update
                </span>
              }
            >
              {recent.length === 0 ? (
                <p className="text-[11px] text-muted-foreground text-center py-6">
                  No reports {statusFilter ? `with status "${STATUS[statusFilter].label}"` : ""} in this period
                </p>
              ) : (
                <div className="space-y-1.5">
                  {recent.map((r, i) => {
                    const meta = STATUS[r.status];
                    return (
                      <motion.button
                        key={r.id}
                        type="button"
                        onClick={() => setSelectedReport(r)}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: Math.min(i * 0.03, 0.25) }}
                        className="w-full flex items-center gap-3 rounded-xl border border-border/25 bg-background/40 px-3 py-2.5 text-left hover:border-primary/35 hover:bg-primary/3 transition-colors"
                      >
                        <span className={cn("w-2 h-2 rounded-full shrink-0", meta.text.replace("text-", "bg-"))} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-bold truncate">{nameOf(r)}</p>
                          <p className="text-[10px] text-muted-foreground truncate capitalize">
                            {asArray(r.issueCategory).join(", ") || "—"}
                          </p>
                        </div>
                        <span className={cn("hidden sm:inline-flex text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md", meta.bg, meta.text)}>
                          {meta.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 w-14 text-right">
                          {formatDistanceToNowStrict(new Date(r.createdAt), { addSuffix: false })}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </Section>

            {/* ── Priority matrix ────────────────────────────────────── */}
            <Section
              icon={BarChart3}
              title="Schools Priority Matrix"
              action={
                <span className="text-[10px] font-medium normal-case tracking-normal text-muted-foreground/60 tabular-nums">
                  {sortedMatrix.length} schools
                </span>
              }
            >
              {sortedMatrix.length === 0 ? (
                <div className="py-10 flex flex-col items-center gap-2 text-muted-foreground">
                  <XCircle className="h-8 w-8 opacity-30" />
                  <p className="text-[11px] font-semibold">No schools match the current filter</p>
                </div>
              ) : (
                <div className="-mx-2 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/30 hover:bg-transparent">
                        <SortHeader field="name">School</SortHeader>
                        <TableHead className="hidden md:table-cell text-[10px] font-black uppercase tracking-wider">Province</TableHead>
                        <TableHead className="hidden lg:table-cell text-[10px] font-black uppercase tracking-wider">District</TableHead>
                        <SortHeader field="total" className="text-right">Total</SortHeader>
                        <SortHeader field="pending" className="text-right">Pending</SortHeader>
                        <SortHeader field="needsIntervention" className="text-right">Critical</SortHeader>
                        <SortHeader field="solved" className="text-right">Solved</SortHeader>
                        <SortHeader field="resolutionRate" className="text-right">Rate</SortHeader>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedMatrix.map((s) => (
                        <TableRow
                          key={s.id}
                          className={cn(
                            "border-border/20 transition-colors",
                            s.needsIntervention > 0
                              ? "bg-rose-500/4 border-l-2 border-l-rose-500 hover:bg-rose-500/10"
                              : s.pending >= BACKLOG_THRESHOLD
                                ? "bg-amber-500/4 border-l-2 border-l-amber-500 hover:bg-amber-500/10"
                                : "hover:bg-muted/30",
                          )}
                        >
                          <TableCell className="font-semibold text-[12px]">
                            <Link to={`/schools/${s.id}`} className="hover:text-primary transition-colors">
                              {s.name}
                            </Link>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-[11px] text-muted-foreground">{s.province}</TableCell>
                          <TableCell className="hidden lg:table-cell text-[11px] text-muted-foreground">{s.district}</TableCell>
                          <TableCell className="text-right text-[12px] font-black tabular-nums">{s.total}</TableCell>
                          <TableCell className="text-right">
                            {s.pending > 0 ? (
                              <Badge className="bg-amber-500/15 text-amber-600 border-0 text-[10px] font-black tabular-nums">{s.pending}</Badge>
                            ) : (
                              <span className="text-[11px] text-muted-foreground/40">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {s.needsIntervention > 0 ? (
                              <Badge className="bg-rose-500/15 text-rose-600 border-0 text-[10px] font-black tabular-nums">{s.needsIntervention}</Badge>
                            ) : (
                              <span className="text-[11px] text-muted-foreground/40">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {s.solved > 0 ? (
                              <Badge className="bg-emerald-500/15 text-emerald-600 border-0 text-[10px] font-black tabular-nums">{s.solved}</Badge>
                            ) : (
                              <span className="text-[11px] text-muted-foreground/40">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={cn(
                                "text-[12px] font-black tabular-nums",
                                s.resolutionRate >= 75
                                  ? "text-emerald-500"
                                  : s.resolutionRate >= 50
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
            </Section>
          </>
        )}
      </div>

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
