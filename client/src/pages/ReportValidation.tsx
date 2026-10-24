import { useEffect, useId, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Inbox,
  PartyPopper,
  Play,
  RefreshCw,
  Search,
  Siren,
  X,
} from "lucide-react";
import { cn } from "../lib/utils";
import { formatNumber } from "../lib/format";
import { useAuthorization } from "../hooks/useAuthorization";
import { Permission } from "../lib/permissions";
import { DashboardError } from "../components/dashboard/DashboardStates";
import { EASE, glassSurface } from "../components/school-dashboard/tokens";
import {
  EmptyNote,
  FilterChips,
  SegmentedTabs,
} from "../components/school-dashboard/details/primitives";
import { ValidationList } from "../components/report-review/ValidationList";
import { Pagination } from "../components/report-review/Pagination";
import { ReportAssessment } from "../components/report-review/ReportAssessment";
import { ValidationSkeleton } from "../components/report-review/ReviewSkeleton";
import { useReviewData } from "../components/report-review/useReviewData";
import {
  ageDays,
  REVIEW_VERB,
  STATUS,
  type ReviewReport,
  type Status,
} from "../components/report-review/review-utils";

type Tab = "new" | "escalated" | "history";
type Kind = "all" | "issue" | "data_change_request";
const TAB_STATUSES: Record<Tab, Status[]> = {
  new: ["PENDING"],
  escalated: ["NEED_INTERVENTION"],
  history: ["SOLVED", "FAILED"],
};
const TAB_NAME: Record<Tab, string> = {
  new: "New",
  escalated: "Needs action",
  history: "Done",
};
const PAGE_SIZE = 10;

const tabOf = (s: Status): Tab =>
  s === "PENDING" ? "new" : s === "NEED_INTERVENTION" ? "escalated" : "history";
const typing = (el: EventTarget | null) => {
  const t = el as HTMLElement | null;
  return (
    !!t &&
    (t.tagName === "INPUT" ||
      t.tagName === "TEXTAREA" ||
      t.tagName === "SELECT" ||
      t.isContentEditable)
  );
};

/**
 * Review reports, in two steps so each screen stays light:
 *  1. the list (tabs, filters, pages) — nothing else;
 *  2. one report on its own, with the decision buttons, Back and Previous/Next.
 * The open report lives in the URL (?report=<id>), so the browser's Back
 * button returns to the list and notification links open a report directly.
 */
export default function ReportValidation() {
  const { isAuthorized } = useAuthorization();
  const reduce = useReducedMotion();
  const tabsId = useId();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    rows,
    loaded,
    loading,
    error,
    load,
    decide,
    deciding,
    facilityTitle,
    itemLabel,
    haystack,
  } = useReviewData();

  const canManage = isAuthorized(Permission.MANAGE_REPORTS);
  const canCloseRequests = isAuthorized(Permission.EDIT_SCHOOL_LOCATION);
  const changeRequestDesk =
    !isAuthorized(Permission.VIEW_ALL_SCHOOLS_REPORTING_DASHBOARD) &&
    canCloseRequests;

  const [tab, setTab] = useState<Tab>(
    (searchParams.get("tab") as Tab) || "new",
  );
  const [kind, setKind] = useState<Kind>(
    searchParams.get("type") === "data_change_request" || changeRequestDesk
      ? "data_change_request"
      : "all",
  );
  const [query, setQuery] = useState("");
  const [province, setProvince] = useState("");
  const [page, setPage] = useState(1);
  const [autoAdvance, setAutoAdvance] = useState(true);
  /** Slide direction for the next screen: 1 forward / next, -1 back / previous. */
  const [dir, setDir] = useState<1 | -1>(1);
  /** Brief confirmation after a decision, before the next report slides in. */
  const [flash, setFlash] = useState<{ label: string; color: string } | null>(
    null,
  );

  const openId = searchParams.get("report");

  // A deep link opens the report on its own tab, so Previous/Next follow that list.
  const [linkHandled, setLinkHandled] = useState(false);
  if (openId && loaded && !linkHandled) {
    const hit = rows.find((r) => r.id === openId);
    setLinkHandled(true);
    if (hit) {
      setTab(tabOf(hit.status));
      setKind("all");
    }
  }

  const provinces = useMemo(
    () =>
      [
        ...new Set(
          rows.map((r) => r.school?.province).filter(Boolean) as string[],
        ),
      ].sort(),
    [rows],
  );

  const scoped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (kind === "all" || (r.type ?? "issue") === kind) &&
        (!province || r.school?.province === province) &&
        (!q || haystack(r).includes(q)),
    );
  }, [rows, kind, province, query, haystack]);

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { new: 0, escalated: 0, history: 0 };
    scoped.forEach((r) => c[tabOf(r.status)]++);
    return c;
  }, [scoped]);

  // New / Needs action: oldest first. Done: newest decision first.
  const list = useMemo(() => {
    const t = (iso?: string | null) => (iso ? new Date(iso).getTime() || 0 : 0);
    const l = scoped.filter((r) => TAB_STATUSES[tab].includes(r.status));
    return tab === "history"
      ? l.sort(
          (a, b) =>
            t(b.reviewedAt ?? b.updatedAt ?? b.createdAt) -
            t(a.reviewedAt ?? a.updatedAt ?? a.createdAt),
        )
      : l.sort((a, b) => t(a.createdAt) - t(b.createdAt));
  }, [scoped, tab]);

  const oldestNew = useMemo(() => {
    const ages = scoped
      .filter((r) => r.status === "PENDING")
      .map((r) => ageDays(r.createdAt) ?? 0);
    return ages.length ? Math.max(...ages) : null;
  }, [scoped]);
  const decidedThisWeek = useMemo(
    () =>
      scoped.filter(
        (r) =>
          (r.status === "SOLVED" || r.status === "FAILED") &&
          (ageDays(r.reviewedAt ?? null) ?? 99) <= 7,
      ).length,
    [scoped],
  );

  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = list.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const open = openId ? (rows.find((r) => r.id === openId) ?? null) : null;
  const index = open ? list.findIndex((r) => r.id === open.id) : -1;
  const prev = index > 0 ? list[index - 1] : null;
  const next = index >= 0 && index < list.length - 1 ? list[index + 1] : null;

  const openReport = (r: ReviewReport, direction: 1 | -1 = 1) => {
    setDir(direction);
    const p = new URLSearchParams(searchParams);
    p.set("report", r.id);
    setSearchParams(p);
    // Return to the same page of the list afterwards.
    const i = list.findIndex((x) => x.id === r.id);
    if (i >= 0) setPage(Math.floor(i / PAGE_SIZE) + 1);
    window.scrollTo?.({ top: 0 });
  };
  const backToList = () => {
    setDir(-1);
    const p = new URLSearchParams(searchParams);
    p.delete("report");
    setSearchParams(p);
  };

  // Step 2 keys: ←/K previous, →/J next, Esc back to the list.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        typing(e.target) ||
        document.querySelector('[role="dialog"]')
      )
        return;
      const k = e.key.toLowerCase();
      if (k === "escape") backToList();
      else if ((k === "arrowleft" || k === "k") && prev) openReport(prev, -1);
      else if ((k === "arrowright" || k === "j") && next) openReport(next);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const canDecide = (r: ReviewReport) =>
    canManage || (r.type === "data_change_request" && canCloseRequests);

  const onDecide = async (
    r: ReviewReport,
    action: Parameters<typeof decide>[1],
    note: string,
  ) => {
    const after = list.filter((x) => x.id !== r.id);
    const at = Math.max(
      0,
      list.findIndex((x) => x.id === r.id),
    );
    const ok = await decide(r, action, note);
    if (!ok) return;
    setFlash({
      label: REVIEW_VERB[action.status] ?? "Saved",
      color: STATUS[action.status]?.color ?? "#2563eb",
    });
    await new Promise((res) => setTimeout(res, reduce ? 300 : 900));
    setFlash(null);
    if (!autoAdvance) return;
    // The decided report leaves this list: open the next one, or go back when none are left.
    const following = after[Math.min(at, after.length - 1)];
    if (following) openReport(following);
    else backToList();
  };

  if (!loaded) return <ValidationSkeleton />;

  const filtersActive = query !== "" || province !== "" || kind !== "all";

  // ── Step 2: one report ──────────────────────────────────────────
  const stepTwo = openId && (
    <div className="relative mx-auto max-w-4xl space-y-4 pb-10">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE }}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <button
          type="button"
          onClick={backToList}
          className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-900/10 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 dark:text-white/80 dark:ring-white/12 dark:hover:bg-white/8"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to {TAB_NAME[tab].toLowerCase()} reports
        </button>
        {index >= 0 && (
          <nav
            aria-label="Move between reports"
            className="flex items-center gap-1.5"
          >
            <span className="px-1 text-xs tabular-nums text-slate-500 dark:text-white/50">
              {formatNumber(index + 1)} of {formatNumber(list.length)}
            </span>
            <button
              type="button"
              onClick={() => prev && openReport(prev, -1)}
              disabled={!prev}
              aria-label="Previous report"
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 ring-1 ring-slate-900/10 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-40 dark:text-white/70 dark:ring-white/12 dark:hover:bg-white/8"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => next && openReport(next)}
              disabled={!next}
              aria-label="Next report"
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 ring-1 ring-slate-900/10 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-40 dark:text-white/70 dark:ring-white/12 dark:hover:bg-white/8"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </nav>
        )}
      </motion.div>

      <section
        aria-label="Selected report"
        className={cn("relative p-5 sm:p-7", glassSurface)}
      >
        <AnimatePresence>
          {flash && (
            <motion.div
              role="status"
              className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-[1.75rem] bg-white/80 backdrop-blur-sm dark:bg-[hsl(224_40%_7%)]/85"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <motion.span
                className="flex h-16 w-16 items-center justify-center rounded-full text-white"
                style={{ background: flash.color }}
                initial={reduce ? false : { scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 420, damping: 20 }}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-8 w-8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <motion.path
                    d="M5 12.5l4.5 4.5L19 7.5"
                    initial={reduce ? false : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.4, delay: 0.15, ease: "easeOut" }}
                  />
                </svg>
              </motion.span>
              <motion.p
                className="text-sm font-semibold text-slate-900 dark:text-white"
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                {flash.label}
                {autoAdvance && (
                  <span className="block text-center text-xs font-normal text-slate-500 dark:text-white/55">
                    Opening the next report…
                  </span>
                )}
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
        {open ? (
          <ReportAssessment
            key={open.id}
            report={open}
            facilityTitle={facilityTitle(open.facilityId)}
            itemLabel={itemLabel(open.facilityId, open.itemId)}
            onDecide={
              canDecide(open) ? (a, note) => onDecide(open, a, note) : null
            }
            busy={deciding}
            autoAdvance={autoAdvance}
            onAutoAdvanceChange={setAutoAdvance}
            shortcuts
            pinClassName="top-16"
          />
        ) : (
          <EmptyNote title="This report was not found">
            It may have been removed, or it is outside your access area.
          </EmptyNote>
        )}
      </section>
    </div>
  );

  // ── Step 1: the list ────────────────────────────────────────────
  const stepOne = (
    <div className="relative mx-auto max-w-6xl space-y-5 pb-10">
      <motion.header
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-white">
            <ClipboardCheck className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="text-[1.625rem] sm:text-[1.875rem] font-medium tracking-tight text-slate-900 dark:text-white">
              Review reports
            </h1>
            <p className="text-[15px] text-slate-500 dark:text-white/55">
              Pick a report to open it and decide.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/reports"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-slate-600 ring-1 ring-slate-900/10 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 dark:text-white/70 dark:ring-white/12 dark:hover:bg-white/8"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Reports dashboard
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Refresh"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-600 ring-1 ring-slate-900/10 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-60 dark:text-white/70 dark:ring-white/12 dark:hover:bg-white/8"
          >
            <RefreshCw
              className={cn(
                "h-4 w-4",
                loading && "animate-spin motion-reduce:animate-none",
              )}
              aria-hidden
            />
          </button>
          {tab !== "history" && list.length > 0 && (
            <motion.button
              type="button"
              onClick={() => openReport(list[0])}
              whileHover={reduce ? undefined : { y: -1 }}
              whileTap={reduce ? undefined : { scale: 0.97 }}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2"
            >
              <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
              Start with the oldest
            </motion.button>
          )}
        </div>
      </motion.header>

      {error && (
        <DashboardError
          title="We couldn't load the reports"
          message={error}
          onRetry={() => void load()}
          retrying={loading}
        />
      )}

      {/* ── At a glance (tap to switch list) ──────────────────────── */}
      <div className="grid grid-cols-3 gap-2.5">
        {(
          [
            {
              key: "new",
              icon: Inbox,
              label: "Waiting",
              value: counts.new,
              hint:
                oldestNew == null
                  ? "nothing waiting"
                  : `oldest ${formatNumber(oldestNew)} days`,
              tone:
                oldestNew != null && oldestNew > 30
                  ? "text-red-500/80 dark:text-red-300/70"
                  : "text-slate-500 dark:text-white/50",
            },
            {
              key: "escalated",
              icon: Siren,
              label: "Needs action",
              value: counts.escalated,
              hint: "RTB or the district must act",
              tone: "text-slate-500 dark:text-white/50",
            },
            {
              key: "history",
              icon: CheckCheck,
              label: "Decided this week",
              value: decidedThisWeek,
              hint: `${formatNumber(counts.history)} done in total`,
              tone: "text-slate-500 dark:text-white/50",
            },
          ] as const
        ).map((t, i) => (
          <motion.button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              setPage(1);
            }}
            aria-pressed={tab === t.key}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05 + i * 0.06, ease: EASE }}
            whileHover={reduce ? undefined : { y: -2 }}
            className={cn(
              "flex min-w-0 items-center gap-3 rounded-2xl p-3 text-left ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 sm:p-3.5",
              tab === t.key
                ? "bg-primary/[0.07] ring-primary/30 dark:bg-primary/15"
                : "bg-white/70 ring-slate-900/6 hover:bg-white dark:bg-white/[0.03] dark:ring-white/8 dark:hover:bg-white/[0.06]",
            )}
          >
            <span
              className={cn(
                "hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:flex",
                tab === t.key
                  ? "bg-primary text-white"
                  : "bg-primary/10 text-primary dark:text-blue-300",
              )}
              aria-hidden
            >
              <t.icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium text-slate-500 dark:text-white/50">
                {t.label}
              </span>
              <span className="block text-xl font-medium leading-tight tabular-nums text-slate-900 dark:text-white/90">
                {formatNumber(t.value)}
              </span>
              <span className={cn("block truncate text-[13px]", t.tone)}>
                {t.hint}
              </span>
            </span>
          </motion.button>
        ))}
      </div>

      <motion.section
        aria-label="Reports"
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
        className={cn("space-y-3 p-3 sm:p-4", glassSurface)}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SegmentedTabs<Tab>
            idPrefix={tabsId}
            ariaLabel="Report lists"
            value={tab}
            onChange={(t) => {
              setTab(t);
              setPage(1);
            }}
            tabs={(
              [
                ["new", "New", counts.new],
                ["escalated", "Needs action", counts.escalated],
                ["history", "Done", counts.history],
              ] as const
            ).map(([key, name, n]) => ({
              key,
              label: (
                <span className="inline-flex items-center gap-1.5">
                  {name}
                  <span
                    className={cn(
                      "min-w-5 rounded-full px-1.5 text-center text-[12px] font-medium leading-[18px] tabular-nums",
                      tab === key
                        ? "bg-primary/15 text-primary dark:bg-primary/25 dark:text-blue-200"
                        : "bg-slate-900/6 text-slate-500 dark:bg-white/8 dark:text-white/55",
                    )}
                  >
                    {n}
                  </span>
                </span>
              ),
            }))}
          />
          <FilterChips<Kind>
            ariaLabel="Report type"
            value={kind}
            onChange={(k) => {
              setKind(k);
              setPage(1);
            }}
            options={[
              { key: "all", label: "All" },
              { key: "issue", label: "Problems" },
              { key: "data_change_request", label: "Change requests" },
            ]}
          />
        </div>
        <div className="flex gap-2">
          <label className="relative block min-w-0 flex-1">
            <span className="sr-only">Search reports</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="School, facility or words"
              className="h-9 w-full rounded-full bg-white/80 pl-9 pr-3 text-sm text-slate-900 ring-1 ring-slate-900/10 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/60 dark:bg-white/6 dark:text-white dark:ring-white/10 [&::-webkit-search-cancel-button]:hidden"
            />
          </label>
          <label className="relative block w-40 shrink-0">
            <span className="sr-only">Province</span>
            <select
              value={province}
              onChange={(e) => {
                setProvince(e.target.value);
                setPage(1);
              }}
              className="h-9 w-full appearance-none truncate rounded-full bg-white/80 pl-3 pr-7 text-sm text-slate-800 ring-1 ring-slate-900/10 focus:outline-none focus:ring-2 focus:ring-primary/60 dark:bg-white/6 dark:text-white/85 dark:ring-white/10"
            >
              <option value="">All provinces</option>
              {provinces.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <span
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400"
              aria-hidden
            >
              ▾
            </span>
          </label>
          {filtersActive && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setProvince("");
                setKind("all");
                setPage(1);
              }}
              aria-label="Clear filters"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-900/5 hover:text-slate-800 dark:text-white/50 dark:hover:bg-white/8"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>

        {list.length === 0 ? (
          filtersActive ? (
            <EmptyNote title="No reports match">
              Try clearing the filters.
            </EmptyNote>
          ) : (
            <motion.div
              initial={reduce ? false : { opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="flex flex-col items-center gap-2 py-12 text-center"
            >
              <motion.span
                className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-300"
                initial={reduce ? false : { scale: 0.6, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 380,
                  damping: 18,
                  delay: 0.1,
                }}
              >
                <PartyPopper className="h-7 w-7" aria-hidden />
              </motion.span>
              <p className="text-sm font-medium text-slate-900 dark:text-white/90">
                {tab === "history" ? "No decisions yet" : "All caught up"}
              </p>
              <p className="max-w-xs text-xs text-slate-500 dark:text-white/50">
                {tab === "new"
                  ? "New reports from schools appear here, oldest first."
                  : tab === "escalated"
                    ? "Nothing is waiting for RTB or the district."
                    : "Reviewed reports and their notes appear here."}
              </p>
            </motion.div>
          )
        ) : (
          <ValidationList
            rows={pageRows}
            selectedId={null}
            onSelect={openReport}
            facilityTitle={facilityTitle}
            history={tab === "history"}
            grouped
            showStatus={tab === "history"}
          />
        )}
        <Pagination
          page={currentPage}
          pageSize={PAGE_SIZE}
          total={list.length}
          onChange={setPage}
          label="Report pages"
        />
      </motion.section>
    </div>
  );

  // Screens slide in the direction of travel (forward / back, next / previous).
  return (
    <AnimatePresence mode="wait" initial={false} custom={dir}>
      <motion.div
        key={openId ?? "list"}
        custom={dir}
        variants={{
          enter: (d: number) =>
            reduce ? { opacity: 0 } : { opacity: 0, x: d * 32 },
          // Enter takes a moment; leaving is quick so there is no empty gap.
          center: {
            opacity: 1,
            x: 0,
            transition: { duration: 0.24, ease: EASE },
          },
          exit: (d: number) =>
            reduce
              ? { opacity: 0, transition: { duration: 0.08 } }
              : {
                  opacity: 0,
                  x: d * -24,
                  transition: { duration: 0.1, ease: "easeIn" },
                },
        }}
        initial="enter"
        animate="center"
        exit="exit"
      >
        {stepTwo || stepOne}
      </motion.div>
    </AnimatePresence>
  );
}
