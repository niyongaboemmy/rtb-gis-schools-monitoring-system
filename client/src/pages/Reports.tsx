import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  FileText,
  Download,
  Search,
  FileSpreadsheet,
  FileBarChart2,
  ClipboardList,
  RotateCcw,
  MapPin,
  CheckCircle2,
  Clock,
  TriangleAlert,
  XCircle,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Loader2,
  ArrowUpRight,
} from "lucide-react";
import {
  format,
  formatDistanceToNowStrict,
  eachWeekOfInterval,
  isSameWeek,
} from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "../components/ui/page-header";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { RichDropdown } from "../components/ui/rich-dropdown";
import { ImigongoPattern } from "../components/ui/ImigongoPattern";
import { MetricCard } from "../components/ui/metric-card";
import { ReportDetailsModal } from "../components/reports/ReportDetailsModal";
import { useSchoolsStore } from "../store/schoolsStore";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

/* ───────────────────────────── model ───────────────────────────── */

type Status = "PENDING" | "SOLVED" | "NEED_INTERVENTION" | "FAILED";

interface Report {
  id: string;
  schoolId: string;
  facilityId?: string;
  issueCategory?: string | string[];
  description?: string;
  status: Status;
  reportedBy?: string;
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string | null;
  school?: { name?: string; district?: string; province?: string };
}

const STATUS_META: Record<
  Status,
  { label: string; short: string; color: string; chip: string; dot: string; icon: typeof Clock }
> = {
  PENDING: {
    label: "Pending",
    short: "Pending",
    color: "#f59e0b",
    chip: "bg-amber-500/12 text-amber-600 dark:text-amber-400 border-amber-500/25",
    dot: "bg-amber-500",
    icon: Clock,
  },
  NEED_INTERVENTION: {
    label: "Needs Intervention",
    short: "Intervention",
    color: "#f43f5e",
    chip: "bg-rose-500/12 text-rose-600 dark:text-rose-400 border-rose-500/25",
    dot: "bg-rose-500",
    icon: TriangleAlert,
  },
  SOLVED: {
    label: "Solved",
    short: "Solved",
    color: "#10b981",
    chip: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
    dot: "bg-emerald-500",
    icon: CheckCircle2,
  },
  FAILED: {
    label: "Failed / Invalid",
    short: "Failed",
    color: "#94a3b8",
    chip: "bg-slate-500/12 text-slate-500 dark:text-slate-400 border-slate-500/20",
    dot: "bg-slate-500",
    icon: XCircle,
  },
};

const PAGE_SIZE = 20;
type SortKey = "school" | "status" | "createdAt";

/* ─────────────────────────── helpers ──────────────────────────── */

const catLabel = (c: Report["issueCategory"]): string =>
  Array.isArray(c) ? c.filter(Boolean).join(", ") : (c ?? "—");

function downloadReportsCsv(rows: Report[]) {
  const head = ["School", "Province", "District", "Category", "Status", "Description", "Reported", "Resolved"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const body = rows.map((r) =>
    [
      r.school?.name ?? "",
      r.school?.province ?? "",
      r.school?.district ?? "",
      catLabel(r.issueCategory),
      STATUS_META[r.status]?.label ?? r.status,
      r.description ?? "",
      r.createdAt ? new Date(r.createdAt).toISOString() : "",
      r.resolvedAt ? new Date(r.resolvedAt).toISOString() : "",
    ].map(esc).join(","),
  );
  const csv = [head.join(","), ...body].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `issue-reports-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadBlob(path: string, filename: string) {
  const res = await api.get(path, { responseType: "blob" });
  const url = URL.createObjectURL(new Blob([res.data as BlobPart]));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─────────────────────────── export card ──────────────────────────── */

function ExportCard({
  icon: Icon,
  title,
  sub,
  cta,
  onClick,
  busy,
  done,
  tone,
  delay = 0,
}: {
  icon: typeof FileText;
  title: string;
  sub: string;
  cta: string;
  onClick: () => void;
  busy?: boolean;
  done?: boolean;
  tone: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
    >
      <Card className="group relative border border-border/30 bg-card/60 backdrop-blur-xl rounded-3xl shadow-none overflow-hidden hover:border-primary/40 transition-colors h-full">
        <div className="pointer-events-none absolute -right-8 -top-8 w-28 h-28 rounded-full bg-primary/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
        <CardContent className="p-5 flex flex-col gap-4 h-full relative">
          <div className="flex items-start justify-between">
            <div className={cn("w-11 h-11 rounded-2xl flex items-center justify-center", tone)}>
              <Icon className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
          </div>
          <div className="flex-1 space-y-1">
            <h3 className="text-sm font-black uppercase tracking-tight">{title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{sub}</p>
          </div>
          <Button
            variant="outline"
            onClick={onClick}
            disabled={busy}
            className={cn(
              "w-full rounded-xl h-9 text-[10px] font-black uppercase tracking-wider border-border/25 gap-2 transition-colors",
              done ? "border-emerald-500/40 text-emerald-500 bg-emerald-500/5" : "hover:bg-primary/5",
            )}
          >
            {busy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : done ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            {busy ? "Preparing…" : done ? "Downloaded" : cta}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ─────────────────────────────── page ─────────────────────────────── */

export default function Reports() {
  const { allSchools, fetchAllSchools } = useSchoolsStore();

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [selected, setSelected] = useState<Report | null>(null);
  const [updating, setUpdating] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | Status>("ALL");
  const [province, setProvince] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "createdAt",
    dir: "desc",
  });
  const [page, setPage] = useState(1);
  const abortRef = useRef<AbortController | null>(null);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchAllSchools();
  }, [fetchAllSchools]);

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
      const pages = Math.min(10, Math.ceil(total / 1000));
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
      setReports(Array.isArray(rows) ? rows : []);
    } catch (err) {
      const name = (err as { name?: string })?.name;
      if (name !== "CanceledError" && name !== "AbortError") {
        console.error("Failed to load reports", err);
        setReports([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  useEffect(() => () => { if (doneTimer.current) clearTimeout(doneTimer.current); }, []);

  const schoolMap = useMemo(
    () => new Map(allSchools.map((s) => [s.id, s])),
    [allSchools],
  );

  const withSchool = useMemo(
    () =>
      reports.map((r) => ({
        ...r,
        school: {
          name: r.school?.name ?? schoolMap.get(r.schoolId)?.name ?? "Unknown school",
          district: r.school?.district ?? schoolMap.get(r.schoolId)?.district ?? "—",
          province: r.school?.province ?? schoolMap.get(r.schoolId)?.province ?? "—",
        },
      })),
    [reports, schoolMap],
  );

  const stats = useMemo(() => {
    const total = withSchool.length;
    const by = (s: Status) => withSchool.filter((r) => r.status === s).length;
    const solved = by("SOLVED");
    const failed = by("FAILED");
    // Resolution rate = solved ÷ genuine issues (FAILED reports are invalid, excluded).
    const genuine = total - failed;
    return {
      total,
      pending: by("PENDING"),
      intervention: by("NEED_INTERVENTION"),
      solved,
      failed,
      resolutionRate: genuine > 0 ? Math.round((solved / genuine) * 100) : 0,
    };
  }, [withSchool]);

  // Weekly submission sparklines (last 12 weeks) for the KPI band
  const sparks = useMemo(() => {
    if (withSchool.length === 0)
      return { total: [] as number[], pending: [] as number[], intervention: [] as number[], solved: [] as number[] };
    const times = withSchool
      .map((r) => new Date(r.createdAt).getTime())
      .filter((t) => !Number.isNaN(t));
    if (times.length === 0)
      return { total: [], pending: [], intervention: [], solved: [] };
    const start = new Date(Math.min(...times));
    const weeks = eachWeekOfInterval({ start, end: new Date() }, { weekStartsOn: 1 }).slice(-12);
    const bucket = (pred: (r: (typeof withSchool)[number]) => boolean) =>
      weeks.map(
        (w) =>
          withSchool.filter(
            (r) => pred(r) && isSameWeek(new Date(r.createdAt), w, { weekStartsOn: 1 }),
          ).length,
      );
    return {
      total: bucket(() => true),
      pending: bucket((r) => r.status === "PENDING"),
      intervention: bucket((r) => r.status === "NEED_INTERVENTION"),
      solved: bucket((r) => r.status === "SOLVED"),
    };
  }, [withSchool]);

  const provinceOptions = useMemo(() => {
    const set = new Set<string>();
    withSchool.forEach(
      (r) => r.school?.province && r.school.province !== "—" && set.add(r.school.province),
    );
    return [
      { label: "All provinces", value: "" },
      ...Array.from(set).sort().map((p) => ({ label: p, value: p })),
    ];
  }, [withSchool]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = withSchool.filter((r) => {
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (province && r.school?.province !== province) return false;
      if (!q) return true;
      return (
        r.school?.name?.toLowerCase().includes(q) ||
        r.school?.district?.toLowerCase().includes(q) ||
        catLabel(r.issueCategory).toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q)
      );
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sort.key === "school")
        return (a.school?.name ?? "").localeCompare(b.school?.name ?? "") * dir;
      if (sort.key === "status")
        return a.status.localeCompare(b.status) * dir;
      return (
        (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir
      );
    });
  }, [withSchool, search, statusFilter, province, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages);
  const pageRows = filtered.slice((pageClamped - 1) * PAGE_SIZE, pageClamped * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, province, sort]);

  const runExport = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
      setDone(key);
      if (doneTimer.current) clearTimeout(doneTimer.current);
      doneTimer.current = setTimeout(() => setDone(null), 2500);
    } catch (err) {
      console.error("Export failed", err);
    } finally {
      setBusy(null);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    setUpdating(true);
    try {
      await api.patch(`/reports/${id}/status`, { status });
      const patch = (r: Report): Report =>
        r.id === id
          ? {
              ...r,
              status: status as Status,
              resolvedAt:
                status === "SOLVED" ? r.resolvedAt ?? new Date().toISOString() : r.resolvedAt,
            }
          : r;
      setReports((prev) => prev.map(patch));
      setSelected((prev) => (prev ? patch(prev) : prev));
    } finally {
      setUpdating(false);
    }
  };

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" },
    );

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setProvince("");
  };
  const filtersActive = search !== "" || statusFilter !== "ALL" || province !== "";

  const SortTh = ({ label, k, className }: { label: string; k: SortKey; className?: string }) => (
    <TableHead
      onClick={() => toggleSort(k)}
      className={cn(
        "text-[10px] font-black uppercase tracking-wider cursor-pointer select-none hover:text-foreground transition-colors",
        className,
      )}
    >
      <span className={cn("inline-flex items-center gap-1", className?.includes("text-right") && "flex-row-reverse")}>
        {label}
        {sort.key === k ? (
          sort.dir === "asc" ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
        ) : (
          <ChevronDown className="w-3 h-3 opacity-20" />
        )}
      </span>
    </TableHead>
  );

  return (
    <div className="relative space-y-6 pb-12">
      <ImigongoPattern
        className="fixed inset-0 text-primary pointer-events-none mask-[linear-gradient(to_bottom_right,black_0%,transparent_45%,transparent_55%,black_100%)]"
        opacity={0.025}
      />

      <div className="relative z-10 space-y-6">
        <PageHeader
          title="Reports & Exports"
          description="Download institutional datasets and browse every infrastructure issue report."
          icon={FileText}
          actions={
            <Button
              variant="outline"
              onClick={load}
              disabled={loading}
              className="rounded-xl h-10 px-5 font-black uppercase tracking-wider text-[10px] border-border/25 shadow-none hover:bg-primary/5 gap-2"
            >
              <RotateCcw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
              Refresh
            </Button>
          }
        />

        {/* KPI band */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          <MetricCard
            icon={ClipboardList}
            label="Total Reports"
            value={loading ? "—" : stats.total}
            spark={sparks.total}
            sparkColor="#3b82f6"
            tone="text-primary"
            toneBg="bg-primary/10"
            delay={0}
          />
          <MetricCard
            icon={Clock}
            label="Pending"
            value={loading ? "—" : stats.pending}
            hint={stats.total ? `${Math.round((stats.pending / stats.total) * 100)}% of reports` : undefined}
            spark={sparks.pending}
            sparkColor={STATUS_META.PENDING.color}
            tone="text-amber-500"
            toneBg="bg-amber-500/12"
            active={statusFilter === "PENDING"}
            onClick={() => setStatusFilter((s) => (s === "PENDING" ? "ALL" : "PENDING"))}
            delay={0.04}
          />
          <MetricCard
            icon={TriangleAlert}
            label="Needs Intervention"
            value={loading ? "—" : stats.intervention}
            hint={stats.intervention > 0 ? "Immediate action" : "None critical"}
            spark={sparks.intervention}
            sparkColor={STATUS_META.NEED_INTERVENTION.color}
            tone="text-rose-500"
            toneBg="bg-rose-500/12"
            active={statusFilter === "NEED_INTERVENTION"}
            onClick={() => setStatusFilter((s) => (s === "NEED_INTERVENTION" ? "ALL" : "NEED_INTERVENTION"))}
            delay={0.08}
          />
          <MetricCard
            icon={CheckCircle2}
            label="Solved"
            value={loading ? "—" : stats.solved}
            spark={sparks.solved}
            sparkColor={STATUS_META.SOLVED.color}
            tone="text-emerald-500"
            toneBg="bg-emerald-500/12"
            active={statusFilter === "SOLVED"}
            onClick={() => setStatusFilter((s) => (s === "SOLVED" ? "ALL" : "SOLVED"))}
            delay={0.12}
          />
          <MetricCard
            icon={FileBarChart2}
            label="Resolution Rate"
            value={loading ? "—" : stats.resolutionRate}
            suffix={loading ? "" : "%"}
            hint={stats.failed > 0 ? `${stats.solved} solved · ${stats.failed} invalid excl.` : `${stats.solved} of ${stats.total} resolved`}
            tone="text-violet-500"
            toneBg="bg-violet-500/12"
            delay={0.16}
          />
        </div>

        {/* Export hub */}
        <div>
          <h2 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-3">
            Bulk Exports
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ExportCard
              icon={FileSpreadsheet}
              title="Schools Master Dataset"
              sub="Every school with location, classification, facilities, staffing and GIS status — Excel workbook."
              cta="Download .xlsx"
              tone="bg-emerald-500/10 text-emerald-500"
              busy={busy === "schools"}
              done={done === "schools"}
              delay={0}
              onClick={() => runExport("schools", () => downloadBlob("/schools/export", "schools-export.xlsx"))}
            />
            <ExportCard
              icon={FileBarChart2}
              title="Decision Assessments"
              sub="Latest computed scores, priority bands, urgency and estimated rehab budget per school — CSV."
              cta="Download .csv"
              tone="bg-violet-500/10 text-violet-500"
              busy={busy === "assessments"}
              done={done === "assessments"}
              delay={0.05}
              onClick={() =>
                runExport("assessments", () =>
                  downloadBlob("/analytics/export", `rtb-assessments-${new Date().toISOString().split("T")[0]}.csv`),
                )
              }
            />
            <ExportCard
              icon={ClipboardList}
              title="Issue Reports Log"
              sub={`${filtersActive ? `${filtered.length} filtered` : `All ${stats.total}`} infrastructure issue reports with status, category and resolution timestamps — CSV.`}
              cta="Download .csv"
              tone="bg-primary/10 text-primary"
              busy={busy === "issues"}
              done={done === "issues"}
              delay={0.1}
              onClick={() => runExport("issues", async () => downloadReportsCsv(filtered))}
            />
          </div>
        </div>

        {/* Report browser */}
        <Card className="border border-border/30 bg-card/60 backdrop-blur-xl rounded-3xl shadow-none overflow-hidden">
          <CardContent className="p-0">
            <div className="p-4 border-b border-border/25 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-50">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search school, district, category, description…"
                    className="h-9 pl-9 rounded-xl border-border/25 bg-background/50 text-xs shadow-none"
                  />
                </div>
                <div className="w-44">
                  <RichDropdown
                    options={provinceOptions}
                    value={province}
                    onChange={setProvince}
                    placeholder="All provinces"
                  />
                </div>
                {filtersActive && (
                  <Button
                    variant="ghost"
                    onClick={resetFilters}
                    className="h-9 rounded-xl text-[10px] font-black uppercase tracking-wider text-muted-foreground gap-1.5"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { key: "ALL", label: "All", count: stats.total },
                    { key: "PENDING", label: "Pending", count: stats.pending },
                    { key: "NEED_INTERVENTION", label: "Intervention", count: stats.intervention },
                    { key: "SOLVED", label: "Solved", count: stats.solved },
                    { key: "FAILED", label: "Failed", count: stats.failed },
                  ] as const
                ).map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setStatusFilter(c.key as "ALL" | Status)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider border transition-colors",
                      statusFilter === c.key
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background/50 text-muted-foreground border-border/25 hover:bg-primary/5",
                    )}
                  >
                    {c.label}
                    <span className="tabular-nums opacity-70">{c.count}</span>
                  </button>
                ))}
                <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 tabular-nums">
                  {filtered.length} result{filtered.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            {loading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-12 rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : pageRows.length === 0 ? (
              <div className="py-16 flex flex-col items-center gap-3 text-center">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <ClipboardList className="w-7 h-7 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground max-w-xs">
                  {reports.length === 0
                    ? "No infrastructure issue reports have been filed yet."
                    : "No reports match these filters."}
                </p>
                {filtersActive && reports.length > 0 && (
                  <Button variant="outline" onClick={resetFilters} className="rounded-xl h-8 text-[10px] font-black uppercase tracking-wider">
                    Clear filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/25 hover:bg-transparent">
                      <SortTh label="School" k="school" className="pl-5" />
                      <TableHead className="hidden md:table-cell text-[10px] font-black uppercase tracking-wider">Location</TableHead>
                      <TableHead className="hidden lg:table-cell text-[10px] font-black uppercase tracking-wider">Category</TableHead>
                      <SortTh label="Status" k="status" />
                      <SortTh label="Reported" k="createdAt" className="text-right pr-5" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.map((r, i) => {
                      const meta = STATUS_META[r.status] ?? STATUS_META.PENDING;
                      return (
                        <motion.tr
                          key={r.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: Math.min(i * 0.015, 0.2) }}
                          onClick={() => setSelected(r)}
                          className="border-border/20 cursor-pointer hover:bg-primary/5 transition-colors"
                        >
                          <TableCell className="pl-5 py-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", meta.dot)} />
                              <span className="text-xs font-bold truncate max-w-55">{r.school?.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <MapPin className="w-3 h-3 shrink-0" />
                              {[r.school?.district, r.school?.province].filter((x) => x && x !== "—").join(", ") || "—"}
                            </span>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <span className="text-[11px] text-muted-foreground truncate block max-w-45 capitalize">
                              {catLabel(r.issueCategory)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider", meta.chip)}>
                              <meta.icon className="w-2.5 h-2.5" />
                              <span className="hidden sm:inline">{meta.label}</span>
                              <span className="sm:hidden">{meta.short}</span>
                            </span>
                          </TableCell>
                          <TableCell className="text-right pr-5">
                            <span className="text-[11px] text-muted-foreground tabular-nums" title={r.createdAt ? format(new Date(r.createdAt), "PPpp") : ""}>
                              {r.createdAt ? formatDistanceToNowStrict(new Date(r.createdAt), { addSuffix: true }) : "—"}
                            </span>
                          </TableCell>
                        </motion.tr>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {!loading && filtered.length > PAGE_SIZE && (
              <div className="flex items-center justify-between p-4 border-t border-border/25">
                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground tabular-nums">
                  {(pageClamped - 1) * PAGE_SIZE + 1}–{Math.min(pageClamped * PAGE_SIZE, filtered.length)} of {filtered.length}
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg border-border/25" disabled={pageClamped <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-[11px] font-black tabular-nums px-2">{pageClamped} / {totalPages}</span>
                  <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg border-border/25" disabled={pageClamped >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AnimatePresence>
        {selected && (
          <ReportDetailsModal
            report={selected}
            onClose={() => setSelected(null)}
            onUpdateStatus={handleUpdateStatus}
            isUpdating={updating}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
