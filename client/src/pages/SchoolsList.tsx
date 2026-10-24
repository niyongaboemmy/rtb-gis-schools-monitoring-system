import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  type ComponentType,
} from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
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
  Radar,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Pencil,
  MessageSquarePlus,
  Bookmark,
  Link2,
  ChevronDown,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { Skeleton, SkeletonTable } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty-state";
import { ErrorState } from "../components/ui/error-state";
import { RequestChangeDialog } from "../components/school-form-steps/RequestChangeDialog";
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
import { api, apiErrorMessage } from "../lib/api";
import { DeleteConfirmationModal } from "../components/ui/delete-confirmation-modal";
import { cn } from "../lib/utils";
import { formatNumber } from "../lib/format";

/* ─────────────────────────────  config  ───────────────────────────── */

/** Rows per page (multiples of 6 so the 2- and 3-column card grids fill evenly). */
const PAGE_SIZES = [12, 24, 48, 96];
const DEFAULT_PAGE_SIZE = 12;

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
  const canDelete = hasPermission(user, Permission.DELETE_SCHOOL);
  const canUpload = hasPermission(user, Permission.UPLOAD_KMZ);
  const canEdit =
    hasPermission(user, Permission.MANAGE_SCHOOLS) ||
    hasPermission(user, Permission.EDIT_SCHOOL_PROFILE);
  const canOpenDetail = hasPermission(user, Permission.VIEW_INTELLIGENCE);
  // Users who cannot edit location / identity may ask the GIS team (WS7.7).
  const canRequestChange =
    hasPermission(user, Permission.CREATE_REPORT) &&
    !hasPermission(user, Permission.MANAGE_SCHOOLS) &&
    !hasPermission(user, Permission.EDIT_SCHOOL_LOCATION);
  const [editing, setEditing] = useState<{ id: string; data: Record<string, unknown> } | null>(null);
  const [changeTarget, setChangeTarget] = useState<School | null>(null);
  const openSchool = (id: string) => {
    if (canOpenDetail) navigate(`/schools/${id}/decision`);
  };
  const startEdit = async (id: string) => {
    try {
      const res = await api.get(`/schools/${id}`);
      setEditing({ id, data: res.data as Record<string, unknown> });
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load this school for editing. Please try again."));
    }
  };

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
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
  const perRaw = parseInt(params.get("per") ?? "", 10);
  const PAGE_SIZE = PAGE_SIZES.includes(perRaw) ? perRaw : DEFAULT_PAGE_SIZE;
  const listTopRef = useRef<HTMLElement>(null);

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
    [sorted, safePage, PAGE_SIZE],
  );

  const stats = useMemo(() => {
    const total = allSchools.length;
    // KPI cards summarise the operating network, not decommissioned rows.
    const active = allSchools.filter((s) => (s.status ?? "active") === "active");
    const critical = active.filter(
      (s) => (s.priorityLevel ?? "").toLowerCase() === "critical",
    ).length;
    const gisDone = active.filter(
      (s) => (s.kmzStatus ?? "").toLowerCase() === "completed",
    ).length;
    const scored = active.filter((s) => s.overallScore != null);
    const avg = scored.length
      ? Math.round(
          scored.reduce((sum, s) => sum + calculatedScore(s), 0) / scored.length,
        )
      : 0;
    return {
      total,
      critical,
      gisPct: active.length
        ? Math.round((gisDone / active.length) * 100)
        : 0,
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
  // The store swallows fetch errors: not loading, not loaded → it failed.
  const loadFailed = !allSchoolsLoading && !allSchoolsLoaded;
  const retryLoad = () => {
    invalidateAllSchools();
    void fetchAllSchools();
  };
  const clearFilters = () => {
    setSearchDraft("");
    patch({ q: null, type: null, priority: null, gis: null, province: null });
  };

  /* ── saved views (WS3.10): named presets per user, URL stays shareable ── */
  const presetKey = `rtb-schools-views:${user?.id ?? "anon"}`;
  const [presets, setPresets] = useState<SavedView[]>(() => readViews(presetKey));
  const saveCurrentView = (name: string) => {
    const query = new URLSearchParams(params);
    query.delete("page");
    const next = [
      ...presets.filter((v) => v.name !== name),
      { name, query: query.toString() },
    ];
    setPresets(next);
    writeViews(presetKey, next);
    toast.success(`Saved view "${name}"`);
  };
  const deleteView = (name: string) => {
    const next = presets.filter((v) => v.name !== name);
    setPresets(next);
    writeViews(presetKey, next);
    toast.success(`Removed saved view "${name}"`);
  };
  const applyView = (v: SavedView) => {
    setParams(new URLSearchParams(v.query), { replace: true });
    setSearchDraft(new URLSearchParams(v.query).get("q") ?? "");
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link to this filtered view copied");
    } catch {
      toast.info(window.location.href, { title: "Copy this link" });
    }
  };

  /* ── exports (EXPORT_REPORTS): filtered view client-side, full set server-side ── */
  const exportRows = () =>
    sorted.map((s) => ({
      Name: s.name,
      Code: s.code,
      Type: s.type ?? "",
      Province: resolveProvinceName(s.province),
      District: resolveDistrictName(s.district),
      Priority: priorityStyle(s.priorityLevel).label,
      Status: s.status ?? "",
      Score: calculatedScore(s),
      "GIS / 3D": s.kmzStatus ?? "",
    }));
  const exportFilteredCsv = () => {
    const rows = exportRows();
    const header = Object.keys(rows[0] ?? { Name: "" });
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [
      header.join(","),
      ...rows.map((r) => header.map((h) => esc((r as Record<string, unknown>)[h])).join(",")),
    ].join("\n");
    downloadBlobUrl(new Blob([csv], { type: "text/csv" }), `schools-${rows.length}.csv`);
    toast.success(`${schoolCount(rows.length)} exported to CSV`);
  };
  const exportFilteredXlsx = async () => {
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const ws = XLSX.utils.json_to_sheet(exportRows());
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Schools");
      const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
      downloadBlobUrl(new Blob([buf]), `schools-${sorted.length}.xlsx`);
      toast.success(`${schoolCount(sorted.length)} exported to Excel`);
    } catch (err) {
      console.error("Export failed", err);
      toast.error(apiErrorMessage(err, "The export could not be created. Please try again."));
    } finally {
      setExporting(false);
    }
  };

  /* ── selection ── */
  const pageIds = pageRows.map((s) => s.id);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const somePageSelected = !allPageSelected && pageIds.some((id) => selected.has(id));
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
    toast.success(`${schoolCount(rows.length)} exported to CSV`);
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
      toast.success("Full schools dataset exported to Excel");
    } catch (err) {
      console.error("Export failed", err);
      toast.error(apiErrorMessage(err, "The export could not be downloaded. Please try again."));
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteSchool = async () => {
    if (!deleteTarget) return;
    const { id: schoolId, name: schoolName } = deleteTarget;
    setDeleting(true);
    try {
      await api.delete(`/schools/${schoolId}`);
      invalidateAllSchools();
      void fetchAllSchools();
      setSelected((prev) => {
        if (!prev.has(schoolId)) return prev;
        const next = new Set(prev);
        next.delete(schoolId);
        return next;
      });
      toast.success(`School "${schoolName}" deleted`);
      setDeleteTarget(null);
    } catch (err) {
      console.error("Delete failed", err);
      toast.error(apiErrorMessage(err, "Please try again."), {
        title: "Failed to delete school",
      });
    } finally {
      setDeleting(false);
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

  const scoreTone = (n: number) => (n ? priorityStyle(scoreBandKey(n)).dot : undefined);
  const sortSelect = (
    <div className={cn("items-center gap-1", view === "grid" ? "flex" : "flex xl:hidden")}>
      <PillSelect
        label="Sort by"
        options={SORT_OPTIONS.map((o) => ({ ...o, label: `Sort: ${o.label}` }))}
        value={sort}
        onChange={(v) => patch({ sort: v, dir: SORT_DEFAULT_DIR[v as SortKey] }, false)}
      />
      <button
        type="button"
        onClick={() => patch({ dir: dir === "asc" ? "desc" : "asc" }, false)}
        aria-label={dir === "asc" ? "Ascending — switch to descending" : "Descending — switch to ascending"}
        className={ICON_BTN}
      >
        {dir === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
      </button>
    </div>
  );
  const filterSelects = (
    <>
      <PillSelect label="Type" options={TYPE_OPTIONS} value={type} onChange={(v) => patch({ type: v || null })} />
      <PillSelect label="Priority" options={PRIORITY_OPTIONS} value={priority} onChange={(v) => patch({ priority: v || null })} />
      <PillSelect label="GIS state" options={GIS_OPTIONS} value={gis} onChange={(v) => patch({ gis: v || null })} />
      <PillSelect label="Province" options={provinceOptions} value={province} onChange={(v) => patch({ province: v || null })} />
    </>
  );
  const filterCount = [type, priority, gis, province].filter(Boolean).length;

  return (
    <div className="relative mx-auto max-w-[1600px] space-y-5 pb-24">
      {/* ── header ── */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[1.625rem] sm:text-[1.875rem] font-semibold tracking-tight text-foreground">Schools</h1>
          <p className="mt-0.5 text-[15px] text-muted-foreground">TVET institutions in your access area</p>
        </div>
        <div className="flex items-center gap-2">
          {canExport && (
            <ExportMenu
              busy={exporting}
              count={sorted.length}
              filtered={activeChips.length > 0}
              onCsv={exportFilteredCsv}
              onXlsx={exportFilteredXlsx}
              onFull={handleExport}
            />
          )}
          {canCreate && (
            <Button onClick={() => setIsAddModalOpen(true)} className="h-9 gap-1.5 rounded-full px-4 text-[15px] font-normal">
              <Plus className="h-4 w-4" /> <span>Add school</span>
            </Button>
          )}
        </div>
      </header>

      {/* ── summary strip ── */}
      <dl className="grid grid-cols-2 overflow-hidden rounded-2xl border border-border/40 bg-card/60 sm:grid-cols-4 dark:border-white/[0.07]">
        <Metric label="Institutions" loading={loading} value={formatNumber(stats.total)} />
        <Metric
          label="Critical priority"
          loading={loading}
          value={formatNumber(stats.critical)}
          accent={stats.critical > 0 ? PRIORITY_STYLE.critical.dot : undefined}
        />
        <Metric label="Mapped (GIS / 3D)" loading={loading} value={`${stats.gisPct}%`} bar={stats.gisPct} />
        <Metric
          label="Avg. condition score"
          loading={loading}
          value={stats.avg ? String(stats.avg) : "—"}
          accent={scoreTone(stats.avg)}
        />
      </dl>

      <section ref={listTopRef} className="scroll-mt-20 overflow-hidden rounded-3xl border border-border/40 bg-card/60 dark:border-white/[0.07]">
        {/* ── toolbar ── */}
        <div className="space-y-2.5 p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 basis-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={searchRef}
                aria-label="Search schools"
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
                placeholder="Search name, code or district"
                className="h-9 w-full rounded-full bg-muted/50 pl-9 pr-9 text-[15px] outline-none transition-colors placeholder:text-muted-foreground/70 focus:bg-background focus:ring-2 focus:ring-primary/30 dark:bg-white/[0.05] dark:focus:bg-white/[0.08]"
              />
              {searchDraft ? (
                <button
                  onClick={() => {
                    setSearchDraft("");
                    patch({ q: null });
                  }}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : (
                <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded bg-muted px-1.5 text-[12px] text-muted-foreground sm:block">
                  /
                </kbd>
              )}
            </div>

            {/* Filters inline on wide screens… */}
            <div className="hidden items-center gap-2 lg:flex">{filterSelects}</div>
            {/* …behind one button on smaller ones */}
            <button
              type="button"
              onClick={() => setFiltersOpen((o) => !o)}
              aria-expanded={filtersOpen}
              aria-controls="schools-filters"
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[15px] transition-colors lg:hidden",
                filtersOpen ? "bg-foreground/10 text-foreground" : "bg-muted/50 text-foreground/80 hover:bg-muted dark:bg-white/[0.05]",
              )}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {filterCount > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[12px] tabular-nums text-primary-foreground">
                  {filterCount}
                </span>
              )}
            </button>

            <div className="ml-auto flex items-center gap-1">
              {sortSelect}
              <SavedViewsMenu views={presets} onApply={applyView} onSave={saveCurrentView} onDelete={deleteView} />
              <button type="button" onClick={copyLink} aria-label="Copy link to this view" title="Copy link to this view" className={ICON_BTN}>
                <Link2 className="h-4 w-4" />
              </button>
              <div className="ml-1 flex rounded-full bg-muted/50 p-0.5 dark:bg-white/[0.05]" role="group" aria-label="Layout">
                {(
                  [
                    { v: "table", icon: Rows3, label: "List view", on: () => patch({ view: null }, false) },
                    { v: "grid", icon: LayoutGrid, label: "Grid view", on: () => patch({ view: "grid" }, false) },
                  ] as const
                ).map((b) => (
                  <button
                    key={b.v}
                    type="button"
                    onClick={b.on}
                    aria-label={b.label}
                    aria-pressed={view === b.v}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                      view === b.v ? "bg-background text-foreground shadow-sm dark:bg-white/[0.12]" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <b.icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {filtersOpen && (
              <motion.div
                id="schools-filters"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden lg:hidden"
              >
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{filterSelects}</div>
              </motion.div>
            )}
          </AnimatePresence>

          {activeChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {activeChips.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  aria-label={`Remove filter ${c.label}`}
                  onClick={() => {
                    if (c.key === "q") setSearchDraft("");
                    patch({ [c.key]: null });
                  }}
                  className="inline-flex h-6 items-center gap-1 rounded-full bg-primary/10 pl-2.5 pr-1.5 text-[13px] text-foreground/90 transition-colors hover:bg-primary/15"
                >
                  {c.label}
                  <X className="h-3 w-3 opacity-70" />
                </button>
              ))}
              <button onClick={clearFilters} className="px-1.5 text-[13px] text-primary hover:underline">
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* ── content ── */}
        <div className="border-t border-border/40 dark:border-white/[0.06]">
          {loading ? (
            <SkeletonTable rows={8} columns={6} className="m-4" />
          ) : loadFailed ? (
            <ErrorState
              className="m-4"
              message="The schools list could not be loaded. Check your connection and try again."
              onRetry={retryLoad}
            />
          ) : sorted.length === 0 ? (
            allSchools.length === 0 ? (
              <EmptyState
                className="m-4"
                icon={Radar}
                title="No schools in your area yet"
                description={
                  canCreate
                    ? "Register the first TVET school to start monitoring it."
                    : "When schools in your access area are registered they will appear here."
                }
                action={canCreate ? { label: "Add a school", onClick: () => setIsAddModalOpen(true), icon: Plus } : undefined}
              />
            ) : (
              <EmptyState
                className="m-4"
                icon={Radar}
                title="No schools match these filters"
                description="Adjust the search or remove a filter."
                secondaryAction={{ label: "Clear filters", onClick: clearFilters }}
              />
            )
          ) : (
            <>
              {/* Cards: always in grid view; phones → small laptops in list view */}
              <div className={cn("grid gap-2.5 p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-3", view !== "grid" && "xl:hidden")}>
                <AnimatePresence mode="popLayout">
                  {pageRows.map((s, i) => (
                    <SchoolCard
                      key={s.id}
                      school={s}
                      index={i}
                      selected={selected.has(s.id)}
                      onSelect={() => toggleOne(s.id)}
                      onOpen={canOpenDetail ? () => openSchool(s.id) : undefined}
                    />
                  ))}
                </AnimatePresence>
              </div>

              {view !== "grid" && (
                <Table
                  striped={false}
                  wrapperClassName="hidden xl:block"
                  className="[&_td]:px-3 [&_th]:px-3 2xl:[&_td]:px-4 2xl:[&_th]:px-4"
                >
                  <TableHeader>
                    <TableRow className="border-b border-border/40 hover:bg-transparent dark:border-white/[0.06]">
                      <TableHead className={cn(TH, "w-10 pl-5")}>
                        <Checkbox
                          checked={allPageSelected}
                          indeterminate={somePageSelected}
                          onChange={toggleAll}
                          aria-label={allPageSelected ? "Deselect this page" : "Select this page"}
                        />
                      </TableHead>
                      <SortableHead label="School" col="name" icon={<SortIcon col="name" />} onSort={onHeaderSort} />
                      <SortableHead label="Location" col="district" icon={<SortIcon col="district" />} onSort={onHeaderSort} />
                      <SortableHead label="Type" col="type" icon={<SortIcon col="type" />} onSort={onHeaderSort} />
                      <SortableHead label="Priority" col="priority" icon={<SortIcon col="priority" />} onSort={onHeaderSort} />
                      <SortableHead label="Score" col="score" icon={<SortIcon col="score" />} onSort={onHeaderSort} />
                      <SortableHead label="GIS / 3D" col="gis" icon={<SortIcon col="gis" />} onSort={onHeaderSort} />
                      <TableHead className={cn(TH, "pr-5 text-right")}>
                        <span className="sr-only">Actions</span>
                      </TableHead>
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
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ delay: Math.min(i * 0.015, 0.15) }}
                            className={cn(
                              "group border-b border-border/30 transition-colors last:border-0 dark:border-white/[0.04]",
                              isSel ? "bg-primary/[0.06]" : "hover:bg-muted/40 dark:hover:bg-white/[0.03]",
                            )}
                          >
                            <TableCell className="w-10 py-3 pl-5">
                              <Checkbox
                                checked={isSel}
                                onChange={() => toggleOne(school.id)}
                                aria-label={`Select ${school.name}`}
                              />
                            </TableCell>
                            <TableCell
                              onClick={() => openSchool(school.id)}
                              className={cn("py-3", canOpenDetail && "cursor-pointer")}
                            >
                              <div className="min-w-0 max-w-[16rem] 2xl:max-w-[22rem]">
                                {canOpenDetail ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openSchool(school.id);
                                    }}
                                    className="line-clamp-2 max-w-full rounded text-left text-[15px] font-medium text-foreground transition-colors group-hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  >
                                    {school.name}
                                  </button>
                                ) : (
                                  <div className="line-clamp-2 text-[15px] font-medium text-foreground">{school.name}</div>
                                )}
                                <div className="text-[13px] tabular-nums text-muted-foreground">{school.code}</div>
                              </div>
                            </TableCell>
                            <TableCell
                              onClick={() => openSchool(school.id)}
                              className={cn("py-3", canOpenDetail && "cursor-pointer")}
                            >
                              <div className="text-[15px] text-foreground/90">{resolveDistrictName(school.district)}</div>
                              <div className="text-[13px] text-muted-foreground">{shortProvince(resolveProvinceName(school.province))}</div>
                            </TableCell>
                            <TableCell className="py-3 text-xs text-muted-foreground">{school.type}</TableCell>
                            <TableCell className="py-3">
                              <PriorityTag style={ps} />
                            </TableCell>
                            <TableCell className="py-3">
                              <ScoreBar score={score} />
                            </TableCell>
                            <TableCell className="py-3">
                              <GisCell school={school} />
                            </TableCell>
                            <TableCell className="py-3 pr-5 text-right">
                              <div className="flex items-center justify-end gap-0.5 transition-opacity lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
                                {canOpenDetail && (
                                  <RowAction label={`Open ${school.name}`} onClick={() => openSchool(school.id)} icon={Eye} />
                                )}
                                {canEdit && (
                                  <RowAction label={`Edit ${school.name}`} onClick={() => void startEdit(school.id)} icon={Pencil} />
                                )}
                                {canRequestChange && (
                                  <RowAction
                                    label={`Request a change to ${school.name}`}
                                    onClick={() => setChangeTarget(school)}
                                    icon={MessageSquarePlus}
                                  />
                                )}
                                {canUpload && (
                                  <RowAction
                                    label={`Upload KMZ or 3D model for ${school.name}`}
                                    onClick={() => navigate(`/schools/${school.id}/kmz`)}
                                    icon={Upload}
                                  />
                                )}
                                {canDelete && (
                                  <RowAction
                                    label={`Delete ${school.name}`}
                                    onClick={() => setDeleteTarget({ id: school.id, name: school.name })}
                                    icon={Trash2}
                                    danger
                                  />
                                )}
                              </div>
                            </TableCell>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                  </TableBody>
                </Table>
              )}
            </>
          )}
        </div>

        {/* ── footer / pagination ── */}
        {!loading && sorted.length > 0 && (
          <Pagination
            page={safePage}
            totalPages={totalPages}
            pageSize={PAGE_SIZE}
            total={sorted.length}
            unfilteredTotal={stats.total}
            onPage={(n) => {
              patch({ page: n > 1 ? String(n) : null }, false);
              listTopRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
            }}
            onPageSize={(n) => patch({ per: n === DEFAULT_PAGE_SIZE ? null : String(n) })}
          />
        )}
      </section>

      {/* ── bulk-selection bar ── */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-full border border-border/40 bg-background/90 py-1.5 pl-4 pr-1.5 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#0c1120]/90"
          >
            <span className="text-[15px] tabular-nums text-foreground">{selected.size} selected</span>
            <Button size="sm" onClick={exportSelectedCsv} className="h-8 gap-1.5 rounded-full px-3 text-xs font-normal">
              <FileDown className="h-3.5 w-3.5" aria-hidden /> Export CSV
            </Button>
            <button
              onClick={() => setSelected(new Set())}
              aria-label="Clear selection"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
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
      {editing && (
        <SchoolForm
          isOpen
          onClose={() => setEditing(null)}
          onSuccess={() => {
            invalidateAllSchools();
            void fetchAllSchools();
          }}
          mode="edit"
          schoolId={editing.id}
          initialData={editing.data as never}
        />
      )}
      <DeleteConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        onConfirm={() => void handleDeleteSchool()}
        isLoading={deleting}
        title="Delete school"
        description={`Permanently delete "${deleteTarget?.name ?? ""}"? This action cannot be undone and will be logged in the system.`}
        confirmLabel="Delete school"
      />
      {changeTarget && (
        <RequestChangeDialog
          isOpen
          onClose={() => setChangeTarget(null)}
          schoolId={changeTarget.id}
          school={changeTarget as unknown as Record<string, unknown>}
          initialFields={["latitude"]}
        />
      )}
    </div>
  );
}

/* ── saved views ── */

interface SavedView {
  name: string;
  query: string;
}

function readViews(key: string): SavedView[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "[]") as SavedView[];
    return Array.isArray(v) ? v.filter((x) => x && typeof x.name === "string") : [];
  } catch {
    return [];
  }
}

function writeViews(key: string, views: SavedView[]) {
  try {
    localStorage.setItem(key, JSON.stringify(views.slice(0, 20)));
  } catch {
    /* storage blocked */
  }
}

function schoolCount(n: number): string {
  return `${formatNumber(n)} school${n === 1 ? "" : "s"}`;
}

function downloadBlobUrl(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function RowAction({
  label,
  onClick,
  icon: Icon,
  danger,
}: {
  label: string;
  onClick: () => void;
  icon: ComponentType<{ className?: string }>;
  danger?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "h-7 w-7 rounded-full text-muted-foreground [&_svg]:h-3.5 [&_svg]:w-3.5",
        danger
          ? "hover:bg-destructive/10 hover:text-destructive"
          : "hover:bg-primary/10 hover:text-primary",
      )}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}

function SavedViewsMenu({
  views,
  onApply,
  onSave,
  onDelete,
}: {
  views: SavedView[];
  onApply: (v: SavedView) => void;
  onSave: (name: string) => void;
  onDelete: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Saved views${views.length ? ` (${views.length})` : ""}`}
        title="Saved views"
        className={cn(ICON_BTN, "relative", open && "bg-muted text-foreground")}
      >
        <Bookmark className="h-4 w-4" aria-hidden="true" />
        {views.length > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 text-[12px] tabular-nums text-primary-foreground">
            {views.length}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-label="Saved views"
            onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
            className="absolute right-0 top-full z-50 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-border bg-background p-2 shadow-xl"
          >
            {views.length === 0 ? (
              <p className="px-2 py-2 text-xs text-muted-foreground">
                No saved views yet. Set filters, then save them here.
              </p>
            ) : (
              <ul className="max-h-56 overflow-y-auto">
                {views.map((v) => (
                  <li key={v.name} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        onApply(v);
                        setOpen(false);
                      }}
                      className="flex-1 truncate rounded-lg px-2 py-1.5 text-left text-sm text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {v.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(v.name)}
                      aria-label={`Delete saved view ${v.name}`}
                      className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form
              className="mt-2 flex items-center gap-1 border-t border-border/50 pt-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!name.trim()) return;
                onSave(name.trim());
                setName("");
              }}
            >
              <label className="sr-only" htmlFor="saved-view-name">
                Name for the current view
              </label>
              <input
                id="saved-view-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name this view…"
                maxLength={40}
                className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button type="submit" size="sm" className="h-8" disabled={!name.trim()}>
                Save
              </Button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

function ExportMenu({
  busy,
  count,
  filtered,
  onCsv,
  onXlsx,
  onFull,
}: {
  busy: boolean;
  count: number;
  filtered: boolean;
  onCsv: () => void;
  onXlsx: () => void;
  onFull: () => void;
}) {
  const [open, setOpen] = useState(false);
  // The menu is portalled to <body> with fixed coordinates: the page header it
  // sits in clips overflow (and its backdrop blur traps `position: fixed`).
  const anchorRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const toggle = () => {
    if (!open && anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect();
      const w = Math.min(288, window.innerWidth - 32);
      setPos({
        top: r.bottom + 8,
        left: Math.max(16, Math.min(r.right - w, window.innerWidth - 16 - w)),
      });
    }
    setOpen((o) => !o);
  };
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);
  const item =
    "flex w-full flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-accent focus-visible:outline-none focus-visible:bg-accent";
  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  return (
    <div ref={anchorRef} className="relative">
      <Button
        variant="outline"
        onClick={toggle}
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        className="h-9 gap-1.5 rounded-full border-border/50 bg-transparent px-3.5 text-[15px] font-normal shadow-none hover:bg-muted dark:border-white/10"
      >
        <FileDown className={cn("h-4 w-4", busy && "animate-pulse")} aria-hidden="true" />
        <span className="hidden sm:inline">{busy ? "Exporting…" : "Export"}</span>
        <ChevronDown className="h-3 w-3" aria-hidden="true" />
      </Button>
      {open && pos && createPortal(
        <>
          <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => setOpen(false)} />
          <div
            role="menu"
            aria-label="Export schools"
            onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
            style={{ top: pos.top, left: pos.left }}
            className="fixed z-50 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-background p-1.5 shadow-xl"
          >
            <button type="button" role="menuitem" className={item} onClick={run(onXlsx)}>
              <span className="text-sm text-foreground">Current view — Excel</span>
              <span className="text-xs text-muted-foreground">
                {count} school{count === 1 ? "" : "s"}{filtered ? " matching your filters" : ""}
              </span>
            </button>
            <button type="button" role="menuitem" className={item} onClick={run(onCsv)}>
              <span className="text-sm text-foreground">Current view — CSV</span>
              <span className="text-xs text-muted-foreground">Same rows, plain text for any tool</span>
            </button>
            <button type="button" role="menuitem" className={item} onClick={run(onFull)}>
              <span className="text-sm text-foreground">Full dataset — Excel</span>
              <span className="text-xs text-muted-foreground">Every school in your access area, more columns</span>
            </button>
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}

/* ─────────────────────────────  pieces  ───────────────────────────── */

const ICON_BTN =
  "flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-35 dark:hover:bg-white/[0.07]";
const TH = "h-10 text-[13px] font-normal normal-case tracking-normal text-muted-foreground";

/** "Northern Province" → "Northern"; "City of Kigali" stays readable. */
const shortProvince = (p: string) => p.replace(/\s+Province$/i, "");

/** Canonical Intervention Priority band for a 0–100 score. */
const scoreBandKey = (n: number) => (n < 35 ? "critical" : n < 55 ? "high" : n < 75 ? "medium" : "low");

/** Page numbers with ellipses: 1 … 4 5 6 … 12 (always first, last, and current ±1). */
function pageList(page: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(total - 1, page + 1);
  if (from > 2) out.push("…");
  for (let i = from; i <= to; i++) out.push(i);
  if (to < total - 1) out.push("…");
  out.push(total);
  return out;
}

function Pagination({
  page,
  totalPages,
  pageSize,
  total,
  unfilteredTotal,
  onPage,
  onPageSize,
}: {
  page: number;
  totalPages: number;
  pageSize: number;
  total: number;
  unfilteredTotal: number;
  onPage: (n: number) => void;
  onPageSize: (n: number) => void;
}) {
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border/40 px-4 py-3 text-xs text-muted-foreground dark:border-white/[0.06]"
    >
      <div className="flex items-center gap-3">
        <span className="tabular-nums" aria-live="polite">
          <span className="text-foreground">
            {formatNumber(from)}–{formatNumber(to)}
          </span>{" "}
          of {formatNumber(total)}
          {total !== unfilteredTotal && <span className="hidden sm:inline"> · filtered from {formatNumber(unfilteredTotal)}</span>}
        </span>
        <label className="relative hidden items-center gap-1.5 sm:flex">
          <span>Rows</span>
          <select
            aria-label="Rows per page"
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            className="h-7 cursor-pointer appearance-none rounded-full bg-muted/50 pl-2.5 pr-6 text-xs tabular-nums text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring dark:bg-white/[0.05] [&>option]:bg-background"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 h-3 w-3" />
        </label>
      </div>

      <div className="flex items-center gap-0.5">
        <button type="button" className={ICON_BTN} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </button>
        {/* Numbered pages from tablet up; a compact "3 / 12" on phones. */}
        <span className="px-1.5 tabular-nums sm:hidden">
          {page} / {totalPages}
        </span>
        <span className="hidden items-center gap-0.5 sm:flex">
          {pageList(page, totalPages).map((n, i) =>
            n === "…" ? (
              <span key={`gap-${i}`} className="w-6 text-center" aria-hidden>
                …
              </span>
            ) : (
              <button
                key={n}
                type="button"
                onClick={() => onPage(n)}
                aria-label={`Page ${n}`}
                aria-current={n === page ? "page" : undefined}
                className={cn(
                  "h-8 min-w-8 rounded-full px-2 tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  n === page ? "bg-primary text-primary-foreground" : "hover:bg-muted hover:text-foreground dark:hover:bg-white/[0.07]",
                )}
              >
                {n}
              </button>
            ),
          )}
        </span>
        <button
          type="button"
          className={ICON_BTN}
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}

function Metric({
  label,
  value,
  loading,
  accent,
  bar,
}: {
  label: string;
  value: string;
  loading?: boolean;
  /** Colour for the value (e.g. a priority band). */
  accent?: string;
  /** 0–100: draws a thin progress line under the value. */
  bar?: number;
}) {
  return (
    <div className="min-w-0 border-border/40 px-4 py-3 odd:border-r sm:border-r sm:last:border-r-0 [&:nth-child(-n+2)]:border-b sm:[&:nth-child(-n+2)]:border-b-0 dark:border-white/[0.06]">
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">
        {loading ? (
          <Skeleton className="h-6 w-12" />
        ) : (
          <span className="text-xl font-semibold tabular-nums tracking-tight text-foreground" style={accent ? { color: accent } : undefined}>
            {value}
          </span>
        )}
        {bar !== undefined && !loading && (
          <span className="mt-1.5 block h-1 w-full max-w-[7rem] overflow-hidden rounded-full bg-muted dark:bg-white/[0.08]">
            <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, Math.max(0, bar))}%` }} />
          </span>
        )}
      </dd>
    </div>
  );
}

/** Compact native select styled as a pill (accessible, great on phones). */
function PillSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="relative block min-w-0">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-9 w-full min-w-0 cursor-pointer appearance-none truncate rounded-full pl-3.5 pr-8 text-[15px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          "[&>option]:bg-background [&>option]:text-foreground",
          value
            ? "bg-primary/10 text-foreground dark:bg-primary/20"
            : "bg-muted/50 text-foreground/80 hover:bg-muted dark:bg-white/[0.05] dark:hover:bg-white/[0.08]",
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    </label>
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
    <TableHead className={TH}>
      <button
        type="button"
        onClick={() => onSort(col)}
        className="inline-flex items-center gap-1 rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {label}
        {icon}
      </button>
    </TableHead>
  );
}

function PriorityTag({ style }: { style: { label: string; dot: string } }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-foreground/85">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: style.dot }} />
      {style.label}
    </span>
  );
}

/** Score on the canonical bands (Critical < 35, High < 55, Medium < 75, Low ≥ 75). */
function ScoreBar({ score }: { score: number }) {
  const tone = score ? priorityStyle(scoreBandKey(score)).dot : "#64748b";
  return (
    <div className="flex items-center gap-2">
      <span className="w-6 text-right text-xs tabular-nums text-foreground">{score || "—"}</span>
      <span className="h-1 w-14 overflow-hidden rounded-full bg-muted dark:bg-white/[0.08]">
        <span className="block h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, score))}%`, background: tone }} />
      </span>
    </div>
  );
}

const GIS_STATE: Record<string, { label: string; dot: string }> = {
  completed: { label: "Mapped", dot: "#10b981" },
  processing: { label: "Processing", dot: "#f59e0b" },
  pending: { label: "Pending", dot: "#64748b" },
};

function GisCell({ school }: { school: School }) {
  const state = (school.kmzStatus ?? "pending").toLowerCase();
  const m = GIS_STATE[state] ?? { label: school.kmzStatus || "Pending", dot: "#64748b" };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-foreground/85">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: m.dot }} />
      <span className={state === "pending" ? "text-muted-foreground" : undefined}>{m.label}</span>
      {school.tifFilePath && (
        <span
          className="rounded-full bg-blue-500/10 px-1.5 text-[12px] text-blue-600 dark:text-blue-400"
          title="Native high-resolution drone imagery available"
        >
          4K
        </span>
      )}
    </span>
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
  onOpen?: () => void;
}) {
  const ps = priorityStyle(school.priorityLevel);
  const score = calculatedScore(school);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ delay: Math.min(index * 0.025, 0.2) }}
      className={cn(
        "group relative rounded-2xl border p-3.5 transition-colors",
        selected
          ? "border-primary/40 bg-primary/[0.05]"
          : "border-border/40 bg-background/40 hover:border-border dark:border-white/[0.06] dark:bg-white/[0.02] dark:hover:border-white/[0.12]",
      )}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onOpen}
          disabled={!onOpen}
          className="min-w-0 flex-1 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
        >
          <h3 className="truncate text-[15px] font-medium text-foreground transition-colors group-hover:text-primary">
            {school.name}
          </h3>
          <p className="truncate text-[13px] text-muted-foreground">
            {school.code} · {resolveDistrictName(school.district)}, {shortProvince(resolveProvinceName(school.province))}
          </p>
        </button>
        <Checkbox checked={selected} onChange={onSelect} className="mt-0.5" aria-label={`Select ${school.name}`} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <PriorityTag style={ps} />
        <ScoreBar score={score} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <GisCell school={school} />
        <span className="text-[13px] text-muted-foreground">{school.type}</span>
      </div>
    </motion.div>
  );
}
