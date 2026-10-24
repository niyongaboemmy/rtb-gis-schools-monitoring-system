import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Download, Gauge, Info, Layers, RefreshCw, Search, ShieldAlert, Wallet, X } from "lucide-react";
import { api, apiErrorMessage } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import { hasPermission, Permission } from "../lib/permissions";
import { cn } from "../lib/utils";
import { formatCurrency, formatNumber, formatPercent, formatScore } from "../lib/format";
import { label } from "../lib/labels";
import { BAND_HEX, bandOf } from "../lib/scoring";
import { useToast } from "../components/ui/toast";
import { MetricInfo } from "../components/metric-help/MetricInfo";
import { DashboardError } from "../components/dashboard/DashboardStates";
import { FloatingStat } from "../components/dashboard/FloatingStat";
import type { NationalOverview, PriorityKey } from "../components/dashboard/types";
import { BRAND, EASE, glassSurface } from "../components/school-dashboard/tokens";
import { DetailModal } from "../components/school-dashboard/DetailModal";
import { StackBar } from "../components/school-dashboard/charts/StackBar";
import { EmptyNote, FilterChips, SegmentedTabs } from "../components/school-dashboard/details/primitives";
import { num, type DecisionRow } from "../components/decisions/decision-utils";
import { QueueRow } from "../components/decisions/QueueRow";
import { DecisionDetail, DecisionFooter, DecisionSummary, ScoringModelInfo } from "../components/decisions/DecisionDetail";
import { DecisionsSkeleton } from "../components/decisions/DecisionsSkeleton";

type SortMode = "urgent" | "cost" | "name";
type Filter = "all" | PriorityKey;
const BANDS: PriorityKey[] = ["critical", "high", "medium", "low"];
const PAGE = 20;

/**
 * Decision & Analytics — one question: which schools need action first?
 * Key figures from the server overview (same as the national dashboard), the
 * ranked queue, and per-school detail in a dialog. Weights and bands come
 * from the served scoring model; nothing here is recomputed.
 */
export default function AnalyticsDecisions() {
  const { user } = useAuthStore();
  const toast = useToast();
  const reduce = useReducedMotion();
  const tabsId = useId();
  const canExport = hasPermission(user, Permission.EXPORT_REPORTS);
  const canRecalculate = hasPermission(user, Permission.MANAGE_DECISIONS);

  const [decisions, setDecisions] = useState<DecisionRow[]>([]);
  const [overview, setOverview] = useState<NationalOverview | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortMode>("urgent");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<DecisionRow | null>(null);
  const [showModel, setShowModel] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [res, ov] = await Promise.all([api.get("/analytics/decisions"), api.get("/analytics/overview")]);
      setDecisions(Array.isArray(res.data) ? res.data : []);
      setOverview(ov.data ?? null);
    } catch (err) {
      console.error("Failed to load decisions", err);
      setLoadError(true);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    // Load once on mount; the async setState happens after the request resolves.
    void fetchAll();
  }, [fetchAll]);

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      await api.post("/analytics/recalculate");
      toast.success("Scores updated for all schools");
      await fetchAll();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not recalculate scores. Please try again."));
    } finally {
      setRecalculating(false);
    }
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
      toast.success("Schools exported to Excel");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not export schools. Please try again."));
    } finally {
      setExporting(false);
    }
  };

  const model = overview?.scoringModel ?? null;
  // Queue counts describe the list being filtered; the key figures use the overview.
  const counts = useMemo(() => {
    const c = { critical: 0, high: 0, medium: 0, low: 0 } as Record<PriorityKey, number>;
    decisions.forEach((d) => {
      if (d.priorityLevel && d.priorityLevel in c) c[d.priorityLevel as PriorityKey]++;
    });
    return c;
  }, [decisions]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = decisions.filter(
      (d) =>
        (filter === "all" || d.priorityLevel === filter) &&
        (!q || [d.school?.name, d.school?.code, d.school?.district, d.school?.province].some((v) => v?.toLowerCase().includes(q))),
    );
    const score = (d: DecisionRow) => num(d.overallScore) ?? 101;
    if (sort === "urgent") rows.sort((a, b) => (num(a.urgencyMonths) ?? 999) - (num(b.urgencyMonths) ?? 999) || score(a) - score(b));
    if (sort === "cost") rows.sort((a, b) => (num(b.estimatedBudgetRwf) ?? 0) - (num(a.estimatedBudgetRwf) ?? 0) || score(a) - score(b));
    if (sort === "name") rows.sort((a, b) => String(a.school?.name ?? "").localeCompare(String(b.school?.name ?? "")));
    return rows;
  }, [decisions, filter, sort, query]);

  if (!loaded) return <DecisionsSkeleton />;

  const by = overview?.byPriority ?? {};
  const critical = by.critical ?? 0;
  const high = by.high ?? 0;
  const scored = overview?.scoredSchoolCount ?? 0;
  const avg = scored > 0 ? num(overview?.nationalAvgScore) : null;
  const coverage = num(overview?.avgDataCoverage);
  const budget = num(overview?.totalEstimatedBudgetRwf);
  const place = (d: DecisionRow) => [d.school?.district, d.school?.province].filter(Boolean).join(", ");

  const btn =
    "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-60";

  return (
    <div className="relative space-y-5 pb-10">
      {/* ── Header ─────────────────────────────────────────────── */}
      <motion.header
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-[0_10px_24px_-10px_rgb(37_99_235/0.8)]">
            <Layers className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="text-[1.625rem] sm:text-[1.875rem] font-semibold tracking-tight text-slate-900 dark:text-white">Priorities</h1>
            <p className="text-[15px] text-slate-500 dark:text-white/55">Which schools need help first, ranked by School Condition Score.</p>
          </div>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <button
            type="button"
            onClick={() => setShowModel(true)}
            aria-label="How scoring works"
            className={cn(btn, "px-2.5 text-slate-600 hover:bg-slate-900/5 sm:px-4 dark:text-white/70 dark:hover:bg-white/8")}
          >
            <Info className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">How scoring works</span>
          </button>
          {canRecalculate && (
            <button
              type="button"
              onClick={handleRecalculate}
              disabled={recalculating}
              className={cn(btn, "ml-auto sm:ml-0 bg-white/80 text-slate-800 ring-1 ring-slate-900/10 hover:bg-white dark:bg-white/8 dark:text-white/85 dark:ring-white/12 dark:hover:bg-white/12")}
            >
              <RefreshCw className={cn("h-4 w-4", recalculating && "animate-spin motion-reduce:animate-none")} aria-hidden />
              {recalculating ? "Updating…" : "Update scores"}
            </button>
          )}
          {canExport && (
            <button type="button" onClick={handleExport} disabled={exporting} className={cn(btn, "bg-primary text-white shadow-[0_10px_30px_-12px_rgb(37_99_235/0.7)] hover:bg-primary/90")}>
              <Download className="h-4 w-4" aria-hidden />
              {exporting ? "Exporting…" : "Export"}
            </button>
          )}
        </div>
      </motion.header>

      {loadError && <DashboardError title="We couldn't load the list of schools" onRetry={fetchAll} retrying={loading} />}

      {/* ── Key figures (server overview = national dashboard) ─── */}
      <dl className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
        <FloatingStat
          index={0}
          compact
          label="Need action"
          value={overview ? critical + high : null}
          format={(n) => formatNumber(n)}
          caption={`${formatNumber(critical)} critical · ${formatNumber(high)} high`}
          percent={scored ? ((critical + high) / scored) * 100 : null}
          icon={ShieldAlert}
          tone="text-primary"
          color={BRAND}
          info={<MetricInfo id="national.priorityCount" size="xs" />}
        />
        <FloatingStat
          index={1}
          compact
          label="Average score"
          value={avg}
          format={(n) => formatNumber(n, 1)}
          caption={avg == null ? "no schools scored" : `${label("priority", bandOf(avg, model))} band`}
          percent={avg}
          icon={Gauge}
          tone="text-primary"
          color={BRAND}
          info={<MetricInfo id="national.avgConditionScore" size="xs" />}
        />
        <FloatingStat
          index={2}
          compact
          label="Estimated cost"
          value={budget}
          format={(n) => (n == null || n <= 0 ? "—" : formatCurrency(n, { compact: true }))}
          caption="rough estimate, all scored schools"
          icon={Wallet}
          tone="text-primary"
          color={BRAND}
          info={<MetricInfo id="national.estimatedBudget" size="xs" />}
        />
        <FloatingStat
          index={3}
          compact
          label="Scored schools"
          value={overview ? scored : null}
          format={(n) => formatNumber(n)}
          caption={coverage == null ? `of ${formatNumber(overview?.totalSchools ?? null)} schools` : `${formatPercent(coverage * 100)} real data`}
          percent={overview?.totalSchools ? (scored / overview.totalSchools) * 100 : null}
          icon={Layers}
          tone="text-primary"
          color={BRAND}
          info={<MetricInfo id="national.scoredSchools" size="xs" />}
        />
      </dl>

      {/* ── Queue ──────────────────────────────────────────────── */}
      <motion.section
        aria-labelledby={`${tabsId}-title`}
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2, ease: EASE }}
        className={cn("p-3 sm:p-4", glassSurface)}
      >
        <div className="space-y-3 px-1 pb-3 pt-1 sm:px-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id={`${tabsId}-title`} className="text-[15px] font-semibold tracking-tight text-slate-900 dark:text-white">
              Schools to act on <span className="ml-1 text-sm font-normal tabular-nums text-slate-400 dark:text-white/40">{formatNumber(decisions.length)}</span>
            </h2>
            <SegmentedTabs<SortMode>
              idPrefix={tabsId}
              ariaLabel="Sort the queue"
              value={sort}
              onChange={(k) => {
                setSort(k);
                setLimit(PAGE);
              }}
              tabs={[
                { key: "urgent", label: "Most urgent" },
                { key: "cost", label: "Highest cost" },
                { key: "name", label: "A–Z" },
              ]}
            />
          </div>

          {decisions.length > 0 && (
            <StackBar
              max={decisions.length}
              height={10}
              ariaLabel="Schools by priority"
              segments={BANDS.map((b) => ({
                key: b,
                value: counts[b],
                color: BAND_HEX[b],
                tip: (
                  <span>
                    {label("priority", b)}: <b>{formatNumber(counts[b])}</b>
                  </span>
                ),
              }))}
            />
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <FilterChips<Filter>
              ariaLabel="Filter by priority"
              value={filter}
              onChange={(k) => {
                setFilter(k);
                setLimit(PAGE);
              }}
              options={[
                { key: "all", label: "All", count: decisions.length },
                ...BANDS.map((b) => ({ key: b, label: label("priority", b), count: counts[b], color: BAND_HEX[b] })),
              ]}
            />
            <label className="relative block sm:w-60">
              <span className="sr-only">Search schools</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setLimit(PAGE);
                }}
                placeholder="School, code or district"
                className="h-9 w-full rounded-full bg-white/80 pl-9 pr-8 text-sm text-slate-900 ring-1 ring-slate-900/10 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/60 dark:bg-white/6 dark:text-white dark:ring-white/10 [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-900/5 hover:text-slate-700 dark:hover:bg-white/8"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              )}
            </label>
          </div>
        </div>

        {/* Column labels (desktop) */}
        <div
          aria-hidden
          className="hidden grid-cols-[2rem_auto_minmax(0,1.6fr)_minmax(0,1fr)_7rem_6rem_auto] gap-x-3.5 border-y border-slate-900/6 px-4 py-2 text-[13px] font-medium text-slate-400 lg:grid dark:border-white/8 dark:text-white/40"
        >
          <span>#</span>
          <span className="w-[46px]">Score</span>
          <span>School</span>
          <span>Lowest part</span>
          <span>Act within</span>
          <span>Est. cost</span>
          <span className="w-4" />
        </div>

        {decisions.length === 0 && !loadError ? (
          <div className="p-4">
            <EmptyNote title="No schools have been scored yet">
              Scores appear once school data is entered{canRecalculate ? " — or use Update scores to score existing schools now." : "."}
            </EmptyNote>
          </div>
        ) : visible.length === 0 ? (
          <div className="p-4">
            <EmptyNote title="No schools match">Try another priority or search.</EmptyNote>
          </div>
        ) : (
          <>
            <ol className="mt-1 space-y-0.5">
              {visible.slice(0, limit).map((d, i) => (
                <QueueRow key={d.id} d={d} rank={i + 1} model={model} index={i} onOpen={() => setOpen(d)} />
              ))}
            </ol>
            {visible.length > limit && (
              <button
                type="button"
                onClick={() => setLimit((l) => l + PAGE)}
                className="mt-2 w-full rounded-xl py-2.5 text-xs font-medium text-primary transition-colors hover:bg-primary/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                Show {formatNumber(Math.min(PAGE, visible.length - limit))} more of {formatNumber(visible.length - limit)}
              </button>
            )}
          </>
        )}
      </motion.section>

      {/* ── Dialogs ────────────────────────────────────────────── */}
      <DetailModal
        isOpen={open != null}
        onClose={() => setOpen(null)}
        icon={Gauge}
        eyebrow={open ? place(open) || open.school?.code : undefined}
        title={open?.school?.name ?? "School"}
        description="Recommended actions first, then how the score is made up."
        summary={open ? <DecisionSummary d={open} model={model} /> : null}
        footer={open ? <DecisionFooter d={open} /> : null}
        maxWidth="max-w-4xl"
      >
        {open && <DecisionDetail d={open} model={model} />}
      </DetailModal>

      <DetailModal
        isOpen={showModel}
        onClose={() => setShowModel(false)}
        icon={Layers}
        eyebrow="Decision model"
        title="How scoring works"
        description={avg != null ? `National average ${formatScore(avg)} of 100 across ${formatNumber(scored)} scored schools.` : undefined}
        maxWidth="max-w-2xl"
      >
        <ScoringModelInfo model={model} />
      </DetailModal>
    </div>
  );
}
