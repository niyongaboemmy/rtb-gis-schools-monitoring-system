import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  type ComponentType,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Plus,
  Eye,
  Upload,
  FileDown,
  Search,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  LayoutGrid,
  Rows3,
  MapPin,
  Layers,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Radar,
  Trash2,
} from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { RichDropdown } from "../components/ui/rich-dropdown";
import { Skeleton } from "../components/ui/skeleton";
import { PageHeader } from "../components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { SchoolForm } from "../components/SchoolForm";
import { useToast } from "../components/ui/toast";
import { ImigongoPattern } from "../components/ui/ImigongoPattern";
import {
  resolveDistrictName,
  resolveProvinceName,
} from "../lib/rwanda-locations";
import {
  useSchoolsStore,
  calculatedScore,
  type School,
} from "../store/schoolsStore";
import { useAuthStore } from "../store/authStore";
import { hasPermission, Permission } from "../lib/permissions";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

/* ─────────────────────────────  config  ───────────────────────────── */

const PAGE_SIZE = 12;

const PRIORITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};
const GIS_RANK: Record<string, number> = { completed: 0, processing: 1 };

const PRIORITY_STYLE: Record<
  string,
  { label: string; dot: string; badge: "destructive" | "warning" | "success" | "default" }
> = {
  critical: { label: "Critical", dot: "#ef4444", badge: "destructive" },
  high: { label: "High", dot: "#f59e0b", badge: "warning" },
  medium: { label: "Medium", dot: "#3b82f6", badge: "default" },
  low: { label: "Low", dot: "#10b981", badge: "success" },
};
const priorityStyle = (p?: string) =>
  PRIORITY_STYLE[(p ?? "").toLowerCase()] ?? {
    label: "Unassessed",
    dot: "#64748b",
    badge: "default" as const,
  };

const TYPE_OPTIONS = [
  { label: "All types", value: "" },
  { label: "TSS", value: "TSS" },
  { label: "VTC", value: "VTC" },
  { label: "Integrated", value: "INTEGRATED" },
  { label: "TVET", value: "TVET" },
  { label: "Polytechnic", value: "POLYTECHNIC" },
];
const PRIORITY_OPTIONS = [
  { label: "All priorities", value: "" },
  { label: "Critical", value: "critical" },
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
  { label: "Low", value: "low" },
];
const GIS_OPTIONS = [
  { label: "Any GIS state", value: "" },
  { label: "Completed", value: "completed" },
  { label: "Processing", value: "processing" },
  { label: "Pending", value: "pending" },
];
const SORT_OPTIONS = [
  { label: "Priority", value: "priority" },
  { label: "Name", value: "name" },
  { label: "District", value: "district" },
  { label: "Type", value: "type" },
  { label: "Score", value: "score" },
  { label: "GIS status", value: "gis" },
];

type SortKey = "priority" | "name" | "district" | "type" | "score" | "gis";
type SortDir = "asc" | "desc";

const SORT_DEFAULT_DIR: Record<SortKey, SortDir> = {
  priority: "asc",
  name: "asc",
  district: "asc",
  type: "asc",
  score: "desc",
  gis: "asc",
};

/* ─────────────────────────────  page  ───────────────────────────── */

export default function SchoolsList() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const {
    allSchools,
    allSchoolsLoading,
    allSchoolsLoaded,
    fetchAllSchools,
    invalidateAllSchools,
  } = useSchoolsStore();

  const { user } = useAuthStore();
  const canExport = hasPermission(user, Permission.EXPORT_REPORTS);
  const canCreate = hasPermission(user, Permission.CREATE_SCHOOL);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchDraft, setSearchDraft] = useState(params.get("q") ?? "");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void fetchAllSchools();
  }, [fetchAllSchools]);

  /* ── URL-synced state ── */
  const q = params.get("q") ?? "";
  const type = params.get("type") ?? "";
  const priority = params.get("priority") ?? "";
  const gis = params.get("gis") ?? "";
  const province = params.get("province") ?? "";
  const sort = (params.get("sort") as SortKey) || "priority";
  const dir = (params.get("dir") as SortDir) || SORT_DEFAULT_DIR[sort] || "asc";
  const view = params.get("view") === "grid" ? "grid" : "table";
  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1);

  const patch = useCallback(
    (next: Record<string, string | null>, resetPage = true) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(next)) {
            if (v == null || v === "") p.delete(k);
            else p.set(k, v);
          }
          if (resetPage && !("page" in next)) p.delete("page");
          return p;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  useEffect(() => {
    setSearchDraft(q);
  }, [q]);

  /* keyboard: "/" focuses search */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement)?.tagName,
        )
      ) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ── derived data ── */
  const provinceOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of allSchools) {
      const name = resolveProvinceName(s.province);
      if (name) set.add(name);
    }
    return [
      { label: "All provinces", value: "" },
      ...[...set].sort().map((p) => ({ label: p, value: p })),
    ];
  }, [allSchools]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return allSchools.filter((s) => {
      if (
        needle &&
        ![
          s.name,
          s.code,
          resolveDistrictName(s.district),
          resolveProvinceName(s.province),
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(needle))
      )
        return false;
      if (type && (s.type ?? "").toUpperCase() !== type) return false;
      if (priority && (s.priorityLevel ?? "").toLowerCase() !== priority)
        return false;
      if (gis) {
        const state = (s.kmzStatus ?? "pending").toLowerCase();
        if (
          gis === "pending"
            ? state === "completed" || state === "processing"
            : state !== gis
        )
          return false;
      }
      if (province && resolveProvinceName(s.province) !== province) return false;
      return true;
    });
  }, [allSchools, q, type, priority, gis, province]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let r = 0;
      switch (sort) {
        case "name":
          r = a.name.localeCompare(b.name);
          break;
        case "district":
          r = resolveDistrictName(a.district).localeCompare(
            resolveDistrictName(b.district),
          );
          break;
        case "type":
          r = (a.type ?? "").localeCompare(b.type ?? "");
          break;
        case "score":
          r = calculatedScore(a) - calculatedScore(b);
          break;
        case "gis":
          r =
            (GIS_RANK[(a.kmzStatus ?? "").toLowerCase()] ?? 2) -
            (GIS_RANK[(b.kmzStatus ?? "").toLowerCase()] ?? 2);
          break;
        default:
          r =
            (PRIORITY_RANK[(a.priorityLevel ?? "").toLowerCase()] ?? 9) -
            (PRIORITY_RANK[(b.priorityLevel ?? "").toLowerCase()] ?? 9);
      }
      if (r === 0) r = a.name.localeCompare(b.name);
      return dir === "desc" ? -r : r;
    });
    return arr;
  }, [filtered, sort, dir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [sorted, safePage],
  );

  const stats = useMemo(() => {
    const total = allSchools.length;
    const critical = allSchools.filter(
      (s) => (s.priorityLevel ?? "").toLowerCase() === "critical",
    ).length;
    const gisDone = allSchools.filter(
      (s) => (s.kmzStatus ?? "").toLowerCase() === "completed",
    ).length;
    const scored = allSchools.filter((s) => s.overallScore != null);
    const avg = scored.length
      ? Math.round(
          scored.reduce((sum, s) => sum + calculatedScore(s), 0) / scored.length,
        )
      : 0;
    return {
      total,
      critical,
      gisPct: total ? Math.round((gisDone / total) * 100) : 0,
      avg,
    };
  }, [allSchools]);

  const activeChips = [
    q && { key: "q", label: `“${q}”` },
    type && { key: "type", label: type },
    priority && { key: "priority", label: priorityStyle(priority).label },
    gis && { key: "gis", label: `GIS: ${gis}` },
    province && { key: "province", label: province },
  ].filter(Boolean) as { key: string; label: string }[];

  const loading = allSchoolsLoading && !allSchoolsLoaded;

  /* ── selection ── */
  const pageIds = pageRows.map((s) => s.id);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const exportSelectedCsv = () => {
    const rows = allSchools.filter((s) => selected.has(s.id));
    const header = [
      "Name",
      "Code",
      "Type",
      "Province",
      "District",
      "Priority",
      "Status",
      "Score",
      "GIS",
    ];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [
      header.join(","),
      ...rows.map((s) =>
        [
          s.name,
          s.code,
          s.type,
          resolveProvinceName(s.province),
          resolveDistrictName(s.district),
          s.priorityLevel ?? "",
          s.status ?? "",
          calculatedScore(s),
          s.kmzStatus ?? "",
        ]
          .map(esc)
          .join(","),
      ),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `schools-selection-${rows.length}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get("/schools/export", { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "schools-export.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed", err);
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteSchool = async (schoolId: string, schoolName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${schoolName}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await api.delete(`/schools/${schoolId}`);
      invalidateAllSchools();
      void fetchAllSchools();
      toast.success(`"${schoolName}" deleted`);
    } catch (err) {
      console.error("Delete failed", err);
      const message = (
        err as { response?: { data?: { message?: string | string[] } } }
      ).response?.data?.message;
      toast.error(
        Array.isArray(message)
          ? message.join("\n")
          : message || "Please try again.",
        { title: "Failed to delete school" },
      );
    }
  };

  const onHeaderSort = (key: SortKey) => {
    if (sort === key) patch({ dir: dir === "asc" ? "desc" : "asc" }, false);
    else patch({ sort: key, dir: SORT_DEFAULT_DIR[key] }, false);
  };

  const SortIcon = ({ col }: { col: SortKey }) =>
    sort !== col ? (
      <ArrowUpDown className="h-3 w-3 opacity-40" />
    ) : dir === "asc" ? (
      <ArrowUp className="h-3 w-3 text-primary" />
    ) : (
      <ArrowDown className="h-3 w-3 text-primary" />
    );

  return (
    <div className="relative min-h-screen space-y-6 pb-10">
      <ImigongoPattern
        className="pointer-events-none fixed inset-0 text-primary mask-[linear-gradient(to_bottom_right,black_0%,transparent_40%,transparent_60%,black_100%)]"
        opacity={0.04}
      />

      <div className="relative z-10 space-y-6">
        <PageHeader
          title="Schools Directory"
          description="Manage and monitor all national TVET institutions"
          icon={Building2}
          actions={
            <div className="flex items-center gap-2">
              {canExport && (
                <Button
                  variant="outline"
                  onClick={handleExport}
                  disabled={exporting}
                  className="h-10 gap-2 rounded-full border-border/20 px-5 text-[10px] font-black uppercase tracking-wider shadow-none hover:bg-primary/5"
                >
                  <FileDown
                    className={cn("h-3.5 w-3.5", exporting && "animate-pulse")}
                  />
                  {exporting ? "Exporting…" : "Export Excel"}
                </Button>
              )}
              {canCreate && (
                <Button
                  onClick={() => setIsAddModalOpen(true)}
                  className="h-10 gap-2 rounded-full bg-linear-to-r from-primary to-primary/80 px-6 text-sm tracking-wide transition-transform hover:scale-[0.97] active:scale-95"
                >
                  <Plus className="h-4 w-4" /> Add New School
                </Button>
              )}
            </div>
          }
        />

        {/* ── stat strip ── */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            icon={Building2}
            label="Institutions"
            value={stats.total}
            tone="bg-primary/10 text-primary"
            loading={loading}
          />
          <StatTile
            icon={AlertTriangle}
            label="Critical priority"
            value={stats.critical}
            tone="bg-rose-500/10 text-rose-600 dark:text-rose-400"
            loading={loading}
          />
          <StatTile
            icon={Layers}
            label="GIS / 3D coverage"
            value={`${stats.gisPct}%`}
            tone="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            loading={loading}
          />
          <StatTile
            icon={Sparkles}
            label="Avg. intelligence score"
            value={stats.avg}
            tone="bg-amber-500/10 text-amber-600 dark:text-amber-400"
            loading={loading}
          />
        </div>

        <Card className="overflow-hidden rounded-3xl border border-border/20 bg-card/70 shadow-none backdrop-blur-xl dark:border-white/10">
          <CardContent className="p-0">
            {/* ── toolbar ── */}
            <div className="flex flex-col gap-3 border-b border-border/10 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[220px] flex-1">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    ref={searchRef}
                    value={searchDraft}
                    onChange={(e) => setSearchDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") patch({ q: searchDraft || null });
                      if (e.key === "Escape") {
                        setSearchDraft("");
                        patch({ q: null });
                      }
                    }}
                    onBlur={() => patch({ q: searchDraft || null })}
                    placeholder="Search name, code, district…  ( / )"
                    className="h-10 w-full rounded-full border border-border/30 bg-background/60 pl-10 pr-9 text-xs font-semibold outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50 dark:border-white/10 dark:bg-white/5"
                  />
                  {searchDraft && (
                    <button
                      onClick={() => {
                        setSearchDraft("");
                        patch({ q: null });
                      }}
                      aria-label="Clear search"
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <FilterSelect
                  options={TYPE_OPTIONS}
                  value={type}
                  onChange={(v) => patch({ type: v || null })}
                />
                <FilterSelect
                  options={PRIORITY_OPTIONS}
                  value={priority}
                  onChange={(v) => patch({ priority: v || null })}
                />
                <FilterSelect
                  options={GIS_OPTIONS}
                  value={gis}
                  onChange={(v) => patch({ gis: v || null })}
                />
                <FilterSelect
                  options={provinceOptions}
                  value={province}
                  onChange={(v) => patch({ province: v || null })}
                />

                <div className="ml-auto flex items-center gap-2">
                  <div className="hidden items-center gap-1 sm:flex">
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                      Sort
                    </span>
                    <FilterSelect
                      options={SORT_OPTIONS}
                      value={sort}
                      onChange={(v) =>
                        patch(
                          { sort: v, dir: SORT_DEFAULT_DIR[v as SortKey] },
                          false,
                        )
                      }
                      compact
                    />
                    <button
                      onClick={() =>
                        patch({ dir: dir === "asc" ? "desc" : "asc" }, false)
                      }
                      aria-label="Toggle sort direction"
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/30 bg-background/60 text-muted-foreground hover:text-primary dark:border-white/10 dark:bg-white/5"
                    >
                      {dir === "asc" ? (
                        <ArrowUp className="h-4 w-4" />
                      ) : (
                        <ArrowDown className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  <div className="flex overflow-hidden rounded-xl border border-border/30 dark:border-white/10">
                    <button
                      onClick={() => patch({ view: null }, false)}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center transition-colors",
                        view === "table"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      aria-label="Table view"
                    >
                      <Rows3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => patch({ view: "grid" }, false)}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center transition-colors",
                        view === "grid"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      aria-label="Grid view"
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {activeChips.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {activeChips.map((c) => (
                    <button
                      key={c.key}
                      onClick={() => {
                        if (c.key === "q") setSearchDraft("");
                        patch({ [c.key]: null });
                      }}
                      className="flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-primary transition-colors hover:bg-primary/10"
                    >
                      {c.label}
                      <X className="h-3 w-3" />
                    </button>
                  ))}
                  <button
                    onClick={() =>
                      patch({
                        q: null,
                        type: null,
                        priority: null,
                        gis: null,
                        province: null,
                      })
                    }
                    className="rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground hover:text-foreground"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>

            {/* ── content ── */}
            {loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            ) : sorted.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                  <Radar className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="text-sm font-bold text-foreground">
                  No institutions match these filters
                </p>
                <p className="text-xs text-muted-foreground">
                  Adjust the search or filter chips above.
                </p>
              </div>
            ) : view === "grid" ? (
              <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                <AnimatePresence mode="popLayout">
                  {pageRows.map((s, i) => (
                    <SchoolCard
                      key={s.id}
                      school={s}
                      index={i}
                      selected={selected.has(s.id)}
                      onSelect={() => toggleOne(s.id)}
                      onOpen={() => navigate(`/schools/${s.id}/decision`)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <Table wrapperClassName="border-none rounded-none bg-transparent shadow-none">
                <TableHeader>
                  <TableRow className="border-b border-border/10 hover:bg-transparent">
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={toggleAll}
                        className="h-3.5 w-3.5 rounded border-border accent-primary"
                        aria-label="Select page"
                      />
                    </TableHead>
                    <SortableHead
                      label="Institution / Code"
                      col="name"
                      icon={<SortIcon col="name" />}
                      onSort={onHeaderSort}
                    />
                    <SortableHead
                      label="Location"
                      col="district"
                      icon={<SortIcon col="district" />}
                      onSort={onHeaderSort}
                    />
                    <SortableHead
                      label="Type"
                      col="type"
                      icon={<SortIcon col="type" />}
                      onSort={onHeaderSort}
                    />
                    <SortableHead
                      label="Priority"
                      col="priority"
                      icon={<SortIcon col="priority" />}
                      onSort={onHeaderSort}
                    />
                    <SortableHead
                      label="Score"
                      col="score"
                      icon={<SortIcon col="score" />}
                      onSort={onHeaderSort}
                    />
                    <SortableHead
                      label="GIS / 3D"
                      col="gis"
                      icon={<SortIcon col="gis" />}
                      onSort={onHeaderSort}
                    />
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence mode="popLayout">
                    {pageRows.map((school, i) => {
                      const ps = priorityStyle(school.priorityLevel);
                      const score = calculatedScore(school);
                      const isSel = selected.has(school.id);
                      return (
                        <motion.tr
                          key={school.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ delay: Math.min(i * 0.02, 0.2) }}
                          className={cn(
                            "group border-b border-border/5 transition-colors last:border-0",
                            isSel ? "bg-primary/5" : "hover:bg-muted/40",
                          )}
                        >
                          <TableCell className="w-10">
                            <input
                              type="checkbox"
                              checked={isSel}
                              onChange={() => toggleOne(school.id)}
                              className="h-3.5 w-3.5 rounded border-border accent-primary"
                              aria-label={`Select ${school.name}`}
                            />
                          </TableCell>
                          <TableCell
                            onClick={() =>
                              navigate(`/schools/${school.id}/decision`)
                            }
                            className="cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5">
                              <span
                                className="h-8 w-1 shrink-0 rounded-full"
                                style={{ background: ps.dot }}
                              />
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                                  {school.name}
                                </div>
                                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                                  {school.code}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell
                            onClick={() =>
                              navigate(`/schools/${school.id}/decision`)
                            }
                            className="cursor-pointer"
                          >
                            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground/80">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              {resolveDistrictName(school.district)}
                            </div>
                            <div className="pl-[18px] text-[10px] font-medium text-muted-foreground">
                              {resolveProvinceName(school.province)}
                            </div>
                          </TableCell>
                          <TableCell className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                            {school.type}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={ps.badge}
                              className="rounded-full border-border/10 px-2 py-0 text-[9px] font-black uppercase tracking-widest"
                            >
                              {ps.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <ScoreBar score={score} />
                          </TableCell>
                          <TableCell>
                            <GisCell school={school} />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary"
                                onClick={() =>
                                  navigate(`/schools/${school.id}/decision`)
                                }
                                title="View detail & 3D"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary"
                                onClick={() =>
                                  navigate(`/schools/${school.id}/kmz`)
                                }
                                title="Upload KMZ"
                              >
                                <Upload className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive"
                                onClick={() =>
                                  handleDeleteSchool(school.id, school.name)
                                }
                                title="Delete school"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </TableBody>
              </Table>
            )}

            {/* ── footer / pagination ── */}
            {!loading && sorted.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/10 p-4 text-xs">
                <span className="font-medium text-muted-foreground">
                  Showing{" "}
                  <span className="rounded-md bg-muted/60 px-1.5 py-0.5 font-bold text-foreground tabular-nums">
                    {(safePage - 1) * PAGE_SIZE + 1}–
                    {Math.min(safePage * PAGE_SIZE, sorted.length)}
                  </span>{" "}
                  of {sorted.length}
                  {sorted.length !== stats.total && (
                    <span className="text-muted-foreground/60">
                      {" "}
                      (filtered from {stats.total})
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full border-border/20 px-4"
                    disabled={safePage <= 1}
                    onClick={() => patch({ page: String(safePage - 1) }, false)}
                  >
                    Previous
                  </Button>
                  <span className="px-1 text-muted-foreground">
                    Page {safePage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full border-border/20 px-4"
                    disabled={safePage >= totalPages}
                    onClick={() => patch({ page: String(safePage + 1) }, false)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── bulk-selection bar ── */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-border/40 bg-background/95 px-4 py-3 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#0c1120]/95"
          >
            <span className="text-xs font-black uppercase tracking-wider text-foreground">
              {selected.size} selected
            </span>
            <Button
              size="sm"
              onClick={exportSelectedCsv}
              className="h-8 gap-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider"
            >
              <FileDown className="h-3.5 w-3.5" /> Export CSV
            </Button>
            <button
              onClick={() => setSelected(new Set())}
              className="rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <SchoolForm
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          invalidateAllSchools();
          void fetchAllSchools();
        }}
        mode="create"
      />
    </div>
  );
}

/* ─────────────────────────────  pieces  ───────────────────────────── */

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
  loading,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  tone: string;
  loading?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/20 bg-card/60 p-4 backdrop-blur-xl dark:border-white/10">
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          tone,
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        {loading ? (
          <Skeleton className="h-6 w-12" />
        ) : (
          <div className="text-xl font-black leading-none tabular-nums">
            {value}
          </div>
        )}
        <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          {label}
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  options,
  value,
  onChange,
  compact,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "w-32" : "w-36"}>
      <RichDropdown options={options} value={value} onChange={onChange} />
    </div>
  );
}

function SortableHead({
  label,
  col,
  icon,
  onSort,
}: {
  label: string;
  col: SortKey;
  icon: React.ReactNode;
  onSort: (c: SortKey) => void;
}) {
  return (
    <TableHead>
      <button
        onClick={() => onSort(col)}
        className="flex items-center gap-1.5 uppercase transition-colors hover:text-foreground"
      >
        {label}
        {icon}
      </button>
    </TableHead>
  );
}

function ScoreBar({ score }: { score: number }) {
  const tone = score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(100, Math.max(0, score))}%`,
            background: tone,
          }}
        />
      </div>
      <span className="text-xs font-black tabular-nums" style={{ color: tone }}>
        {score || "—"}
      </span>
    </div>
  );
}

function GisCell({ school }: { school: School }) {
  const state = (school.kmzStatus ?? "pending").toLowerCase();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge
        variant={
          state === "completed"
            ? "success"
            : state === "processing"
              ? "warning"
              : "outline"
        }
        className="rounded-full border-border/10 px-2 py-0 text-[9px] font-black uppercase tracking-widest"
      >
        {state === "completed" && <CheckCircle2 className="mr-1 h-3 w-3" />}
        {school.kmzStatus || "pending"}
      </Badge>
      {school.tifFilePath && (
        <Badge
          variant="outline"
          className="rounded-full border-blue-500/20 bg-blue-500/5 px-2 py-0 text-[8px] font-black uppercase tracking-widest text-blue-500"
          title="Native high-resolution drone imagery available"
        >
          4K native
        </Badge>
      )}
    </div>
  );
}

function SchoolCard({
  school,
  index,
  selected,
  onSelect,
  onOpen,
}: {
  school: School;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}) {
  const ps = priorityStyle(school.priorityLevel);
  const score = calculatedScore(school);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.25) }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-card/60 p-4 backdrop-blur-xl transition-colors",
        selected
          ? "border-primary/50 ring-1 ring-primary/30"
          : "border-border/20 hover:border-primary/30 dark:border-white/10",
      )}
    >
      <span
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: ps.dot }}
      />
      <div className="flex items-start justify-between gap-2">
        <button onClick={onOpen} className="min-w-0 text-left">
          <h3 className="truncate text-sm font-bold text-foreground transition-colors group-hover:text-primary">
            {school.name}
          </h3>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
            {school.code}
          </p>
        </button>
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          className="mt-1 h-3.5 w-3.5 shrink-0 rounded border-border accent-primary"
          aria-label={`Select ${school.name}`}
        />
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <MapPin className="h-3 w-3" />
        {resolveDistrictName(school.district)} ·{" "}
        {resolveProvinceName(school.province)}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <Badge
          variant={ps.badge}
          className="rounded-full border-border/10 px-2 py-0 text-[9px] font-black uppercase tracking-widest"
        >
          {ps.label}
        </Badge>
        <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
          {school.type}
        </span>
      </div>

      <div className="mt-3">
        <ScoreBar score={score} />
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border/10 pt-3">
        <GisCell school={school} />
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpen}
          className="h-7 gap-1 rounded-lg text-[10px] font-black uppercase tracking-wider text-primary hover:bg-primary/10"
        >
          <Eye className="h-3.5 w-3.5" /> Open
        </Button>
      </div>
    </motion.div>
  );
}
