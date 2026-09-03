import { useState, useEffect, useRef, useMemo } from "react";
import { api } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import { hasPermission, Permission } from "../lib/permissions";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Download,
  Info,
  RefreshCw,
  Layers,
  Building2,
  Clock,
  Users,
  Route,
  MapPin,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  ShieldAlert,
  Gauge,
  Sparkles,
  Wallet,
  ArrowUpDown,
  TriangleAlert,
  Timer,
} from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { PageHeader } from "../components/ui/page-header";
import { cn } from "../lib/utils";

/* ─────────────────────────────────────────────────────────────────────────────
 * Model — mirrors server/src/modules/analytics/scoring.constants.ts
 * ────────────────────────────────────────────────────────────────────────── */

const WEIGHTS = [
  { key: "infrastructureScore", label: "Infrastructure State", value: 35, icon: Building2, color: "#3b82f6" },
  { key: "buildingAgeScore", label: "Building Age Matrix", value: 25, icon: Clock, color: "#8b5cf6" },
  { key: "facilityComplianceScore", label: "Facility Compliance", value: 15, icon: ClipboardCheck, color: "#06b6d4" },
  { key: "populationPressureScore", label: "Capacity Resilience", value: 10, icon: Users, color: "#10b981" },
  { key: "accessibilityScore", label: "Accessibility Index", value: 10, icon: Route, color: "#f59e0b" },
  { key: "resolutionRateScore", label: "Issue Resolution", value: 5, icon: CheckCircle2, color: "#ec4899" },
] as const;

const PRIORITY_BANDS = [
  { level: "critical", label: "Critical", range: "0–34", dot: "bg-rose-500", text: "text-rose-500" },
  { level: "high", label: "High", range: "35–54", dot: "bg-orange-500", text: "text-orange-500" },
  { level: "medium", label: "Medium", range: "55–74", dot: "bg-amber-500", text: "text-amber-500" },
  { level: "low", label: "Optimal", range: "75–100", dot: "bg-emerald-500", text: "text-emerald-500" },
] as const;

/** 4-tier tone aligned exactly to the priority bands. */
function scoreTone(score: number) {
  if (score >= 75) return { text: "text-emerald-500", bar: "bg-emerald-500", ring: "#10b981" };
  if (score >= 55) return { text: "text-amber-500", bar: "bg-amber-500", ring: "#f59e0b" };
  if (score >= 35) return { text: "text-orange-500", bar: "bg-orange-500", ring: "#f97316" };
  return { text: "text-rose-500", bar: "bg-rose-500", ring: "#f43f5e" };
}

function priorityStyle(level?: string) {
  switch (level) {
    case "critical":
      return { badge: "destructive" as const, rail: "bg-rose-500", glow: "bg-rose-500/10", label: "Critical" };
    case "high":
      return { badge: "warning" as const, rail: "bg-orange-500", glow: "bg-orange-500/10", label: "High" };
    case "medium":
      return { badge: "secondary" as const, rail: "bg-amber-500", glow: "bg-amber-500/10", label: "Medium" };
    default:
      return { badge: "success" as const, rail: "bg-emerald-500", glow: "bg-emerald-500/10", label: "Optimal" };
  }
}

/** Recommendation tag → visual treatment. */
const TAG_STYLE: Record<string, { cls: string; icon: typeof Sparkles }> = {
  URGENT: { cls: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30", icon: TriangleAlert },
  CRITICAL: { cls: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30", icon: TriangleAlert },
  DATA: { cls: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30", icon: Info },
  PLAN: { cls: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30", icon: Clock },
  ACCESS: { cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30", icon: Route },
  CAPACITY: { cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30", icon: Users },
  COMPLIANCE: { cls: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30", icon: ClipboardCheck },
  OPERATIONS: { cls: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20", icon: RefreshCw },
  OK: { cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
};

/* ─────────────────────────────────────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────────────────────────────────── */

const int = (v: unknown): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : 0;
};

const rwfCompact = (v: unknown): string => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `${new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n)} RWF`;
};

const urgencyLabel = (months: unknown): string => {
  const m = Number(months);
  if (!Number.isFinite(m)) return "Not scheduled";
  if (m <= 0) return "Immediate action";
  return `Intervene within ${m} mo`;
};

const parseRec = (rec: string): { tag: string | null; text: string } => {
  const match = /^\[([A-Z]+)\]\s*(.*)$/.exec(rec);
  return match ? { tag: match[1], text: match[2] } : { tag: null, text: rec };
};

/* ─────────────────────────────────────────────────────────────────────────────
 * Small components
 * ────────────────────────────────────────────────────────────────────────── */

function ScoreRing({ score, size = 76 }: { score: number; size?: number }) {
  const tone = scoreTone(score);
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(Math.max(score, 0), 100) / 100;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-muted/40" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={tone.ring}
          strokeDasharray={c}
          strokeDashoffset={c - pct * c}
          style={{ transition: "stroke-dashoffset 0.7s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-lg font-black font-mono leading-none", tone.text)}>{int(score)}</span>
        <span className="text-[8px] uppercase tracking-widest text-muted-foreground font-black mt-0.5">Score</span>
      </div>
    </div>
  );
}

function SubScore({
  icon: Icon,
  label,
  value,
  weight,
  gap,
}: {
  icon: typeof Building2;
  label: string;
  value: unknown;
  weight: number;
  gap?: boolean;
}) {
  const v = int(value);
  const tone = scoreTone(v);
  // Points this factor adds to the 0–100 overall index = score × weight.
  const contribution = (v * weight) / 100;
  return (
    <div className="p-3 rounded-2xl border border-border/20 bg-background/40">
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
          <Icon className="w-3.5 h-3.5 shrink-0" />
          <span className="text-[10px] font-black uppercase tracking-wide truncate">{label}</span>
        </div>
        <span className="text-[8px] font-black text-muted-foreground/50 tabular-nums uppercase tracking-wider shrink-0">
          weight {weight}%
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
          <div className={cn("h-full rounded-full transition-all", tone.bar)} style={{ width: `${Math.min(v, 100)}%` }} />
        </div>
        <span className={cn("text-xs font-black font-mono text-right tabular-nums", tone.text)}>
          {v}
          <span className="text-muted-foreground/40 font-bold text-[9px]">/100</span>
        </span>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        {gap ? (
          <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
            <TriangleAlert className="w-2.5 h-2.5" /> Data gap
          </span>
        ) : (
          <span />
        )}
        <span className="text-[8px] font-bold tabular-nums text-muted-foreground/50">
          adds {contribution.toFixed(1)} to overall
        </span>
      </div>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Building2;
  label: string;
  value: string | number;
  tone: string;
}) {
  return (
    <Card className="border border-border/50 bg-card/60 backdrop-blur-xl rounded-2xl shadow-none">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", tone)}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xl font-black font-mono leading-none tabular-nums truncate">{value}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-black mt-1">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Page
 * ────────────────────────────────────────────────────────────────────────── */

type SortMode = "urgent" | "score" | "budget";

interface DecisionRow {
  id: string;
  priorityLevel?: string;
  overallScore?: number | string;
  infrastructureScore?: number | string;
  buildingAgeScore?: number | string;
  facilityComplianceScore?: number | string;
  populationPressureScore?: number | string;
  accessibilityScore?: number | string;
  resolutionRateScore?: number | string;
  urgencyMonths?: number | null;
  estimatedBudgetRwf?: number | string | null;
  hasInfraDataGap?: boolean;
  hasPopDataGap?: boolean;
  recommendations?: string[];
  createdAt?: string;
  school?: { name?: string; district?: string; province?: string };
}

export default function AnalyticsDecisions() {
  const { user } = useAuthStore();
  const canExport = hasPermission(user, Permission.EXPORT_REPORTS);

  const [decisions, setDecisions] = useState<DecisionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [sortMode, setSortMode] = useState<SortMode>("urgent");
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchDecisions();
  }, []);

  const fetchDecisions = async () => {
    setLoading(true);
    try {
      const response = await api.get("/analytics/decisions");
      setDecisions(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error("Failed to load decisions", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      await api.post("/analytics/recalculate");
      await fetchDecisions();
    } catch (err) {
      console.error("Failed to recalculate", err);
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
    } catch (err) {
      console.error("Export failed", err);
    } finally {
      setExporting(false);
    }
  };

  const stats = useMemo(() => {
    const total = decisions.length;
    const byLevel = (lvl: string) => decisions.filter((d) => d.priorityLevel === lvl).length;
    const avg =
      total > 0
        ? Math.round(decisions.reduce((s, d) => s + (Number(d.overallScore) || 0), 0) / total)
        : 0;
    const budget = decisions.reduce((s, d) => s + (Number(d.estimatedBudgetRwf) || 0), 0);
    return {
      total,
      critical: byLevel("critical"),
      high: byLevel("high"),
      medium: byLevel("medium"),
      low: byLevel("low"),
      avg,
      budget,
    };
  }, [decisions]);

  const visible = useMemo(() => {
    const rows = filter === "all" ? decisions : decisions.filter((d) => d.priorityLevel === filter);
    const sorted = [...rows];
    if (sortMode === "urgent") sorted.sort((a, b) => (Number(a.overallScore) || 0) - (Number(b.overallScore) || 0));
    if (sortMode === "score") sorted.sort((a, b) => (Number(b.overallScore) || 0) - (Number(a.overallScore) || 0));
    if (sortMode === "budget") sorted.sort((a, b) => (Number(b.estimatedBudgetRwf) || 0) - (Number(a.estimatedBudgetRwf) || 0));
    return sorted;
  }, [decisions, filter, sortMode]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Decision Engineering"
        description="Automated infrastructure scoring, intervention queue & cost estimates"
        icon={Layers}
        actions={
          <>
            <Button
              variant="outline"
              className="gap-2 h-10 rounded-xl font-black uppercase text-[10px] tracking-wider px-6 shadow-none flex-1 md:flex-none border-border/20 bg-background/50 hover:bg-primary/5 transition-colors"
              onClick={handleRecalculate}
              disabled={recalculating}
            >
              <RefreshCw className={cn("w-4 h-4", recalculating && "animate-spin")} />
              {recalculating ? "Processing…" : "Recalculate All"}
            </Button>
            {canExport && (
              <Button
                className="gap-2 h-10 rounded-xl font-black uppercase text-[10px] tracking-wider px-6 flex-1 md:flex-none bg-linear-to-r from-primary to-primary/80 hover:bg-primary transition-colors"
                onClick={handleExport}
                disabled={exporting}
              >
                <Download className={cn("w-4 h-4", exporting && "animate-pulse")} />
                {exporting ? "Exporting…" : "Export Excel"}
              </Button>
            )}
          </>
        }
      />

      {/* KPI strip */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <StatTile icon={Gauge} label="Assessed Schools" value={stats.total} tone="bg-primary/10 text-primary" />
        <StatTile icon={ShieldAlert} label="Critical Priority" value={stats.critical} tone="bg-rose-500/10 text-rose-500" />
        <StatTile icon={TriangleAlert} label="High Priority" value={stats.high} tone="bg-orange-500/10 text-orange-500" />
        <StatTile icon={Sparkles} label="Average Score" value={stats.avg} tone="bg-emerald-500/10 text-emerald-500" />
        <StatTile icon={Wallet} label="Est. Rehab Budget" value={rwfCompact(stats.budget)} tone="bg-violet-500/10 text-violet-500" />
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* ── Scoring model panel ─────────────────────────────────────────── */}
        <Card className="lg:col-span-1 h-fit lg:sticky lg:top-24 border border-border/20 bg-card/60 backdrop-blur-xl rounded-3xl shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-black uppercase tracking-wide flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" /> Scoring Model
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Stacked composition bar */}
            <div>
              <div className="flex h-3 w-full rounded-full overflow-hidden">
                {WEIGHTS.map((w) => (
                  <div key={w.key} style={{ width: `${w.value}%`, background: w.color }} title={`${w.label} · ${w.value}%`} />
                ))}
              </div>
              <p className="mt-2 text-[10px] font-medium text-muted-foreground leading-relaxed">
                A single 0–100 index. Each factor is scored 0–100, then multiplied
                by its weight below; the weighted parts sum to the overall score.
                Higher = healthier school = lower intervention priority.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2.5 pb-1 border-b border-border/20">
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 flex-1">Factor</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Weight</span>
              </div>
              {WEIGHTS.map((w) => (
                <div key={w.key} className="flex items-center gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: w.color }} />
                  <w.icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs font-medium flex-1 truncate">{w.label}</span>
                  <span className="text-[11px] font-black font-mono tabular-nums text-muted-foreground">{w.value}%</span>
                </div>
              ))}
              <div className="flex items-center gap-2.5 pt-1 border-t border-border/20">
                <span className="text-[10px] font-black uppercase tracking-wider flex-1">Total</span>
                <span className="text-[11px] font-black font-mono tabular-nums">100%</span>
              </div>
            </div>

            {/* Priority bands */}
            <div className="pt-4 border-t border-border/20 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Priority Bands</p>
              <div className="grid grid-cols-2 gap-1.5">
                {PRIORITY_BANDS.map((b) => (
                  <div key={b.level} className="flex items-center gap-1.5 rounded-lg bg-muted/30 px-2 py-1.5">
                    <span className={cn("w-1.5 h-1.5 rounded-full", b.dot)} />
                    <span className="text-[10px] font-black">{b.label}</span>
                    <span className="text-[9px] font-mono text-muted-foreground ml-auto tabular-nums">{b.range}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 bg-primary/5 border border-primary/10 rounded-xl">
              <Info className="w-4 h-4 shrink-0 text-primary/70 mt-0.5" />
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Inputs: building-condition surveys, construction age, facility-compliance audits, catchment demographics,
                road access and issue-resolution history. Recalculate after updating school records.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ── Intervention queue ──────────────────────────────────────────── */}
        <Card className="lg:col-span-3 border border-border/20 bg-card/60 backdrop-blur-xl rounded-3xl shadow-none overflow-hidden">
          <CardHeader className="gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">Intervention Queue</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {sortMode === "urgent"
                    ? "Most urgent first — lowest decision score at the top"
                    : sortMode === "score"
                      ? "Highest decision score first"
                      : "Highest estimated cost first"}
                </p>
              </div>
              <button
                onClick={() =>
                  setSortMode((m) => (m === "urgent" ? "score" : m === "score" ? "budget" : "urgent"))
                }
                className="flex items-center gap-1.5 rounded-lg border border-border/20 bg-background/50 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-primary/5 transition-colors"
              >
                <ArrowUpDown className="w-3 h-3" />
                {sortMode === "urgent" ? "By urgency" : sortMode === "score" ? "By score" : "By budget"}
              </button>
            </div>

            {/* Priority filter chips */}
            {!loading && decisions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {[
                  { key: "all", label: "All", count: stats.total },
                  { key: "critical", label: "Critical", count: stats.critical },
                  { key: "high", label: "High", count: stats.high },
                  { key: "medium", label: "Medium", count: stats.medium },
                  { key: "low", label: "Optimal", count: stats.low },
                ].map((chip) => (
                  <button
                    key={chip.key}
                    onClick={() => setFilter(chip.key)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider transition-colors border",
                      filter === chip.key
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background/50 text-muted-foreground border-border/20 hover:bg-primary/5",
                    )}
                  >
                    {chip.label}
                    <span className="tabular-nums opacity-70">{chip.count}</span>
                  </button>
                ))}
              </div>
            )}
          </CardHeader>

          <CardContent className="p-0">
            <div className="divide-y divide-border/20">
              {loading ? (
                [0, 1, 2].map((i) => (
                  <div key={i} className="p-6 space-y-4 animate-pulse">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="h-4 w-52 rounded bg-muted" />
                        <div className="h-3 w-36 rounded bg-muted" />
                      </div>
                      <div className="h-19 w-19 rounded-full bg-muted" />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {[0, 1, 2, 3, 4, 5].map((j) => (
                        <div key={j} className="h-16 rounded-2xl bg-muted" />
                      ))}
                    </div>
                  </div>
                ))
              ) : visible.length === 0 ? (
                <div className="p-16 text-center flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Gauge className="w-7 h-7 text-primary" />
                  </div>
                  <p className="text-muted-foreground text-sm max-w-xs">
                    {decisions.length === 0
                      ? "No assessments found. Run a recalculation to generate the intervention queue."
                      : "No schools in this priority band."}
                  </p>
                  {decisions.length === 0 && (
                    <Button
                      variant="outline"
                      className="mt-2 gap-2 rounded-xl h-9 text-xs font-black uppercase tracking-wider"
                      onClick={handleRecalculate}
                      disabled={recalculating}
                    >
                      <RefreshCw className={cn("w-3.5 h-3.5", recalculating && "animate-spin")} />
                      Recalculate All
                    </Button>
                  )}
                </div>
              ) : (
                visible.map((d: DecisionRow, idx: number) => {
                  const style = priorityStyle(d.priorityLevel);
                  const overall = int(d.overallScore);
                  return (
                    <motion.div
                      key={d.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: Math.min(idx * 0.03, 0.25) }}
                      className="relative p-6 pl-7 hover:bg-muted/20 transition-colors"
                    >
                      <span className={cn("absolute left-0 top-4 bottom-4 w-1 rounded-full", style.rail)} />

                      {/* Header row */}
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                        <div className="min-w-0">
                          <div className="flex items-center flex-wrap gap-2 mb-1.5">
                            <h3 className="font-black text-base leading-tight tracking-tight">
                              {d.school?.name ?? "Unknown school"}
                            </h3>
                            <Badge variant={style.badge} className="capitalize font-black text-[10px]">
                              {style.label}
                            </Badge>
                          </div>
                          <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            {(d.school?.district || d.school?.province) && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5" />
                                {[d.school?.district, d.school?.province].filter(Boolean).join(", ")}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {d.createdAt ? `Assessed ${format(new Date(d.createdAt), "MMM d, yyyy")}` : "—"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-right">
                            <div className="flex items-center gap-1.5 justify-end text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                              <Timer className="w-3 h-3" /> {urgencyLabel(d.urgencyMonths)}
                            </div>
                            <div className="flex items-center gap-1.5 justify-end mt-1 text-[11px] font-black font-mono text-violet-500 tabular-nums">
                              <Wallet className="w-3 h-3" /> {rwfCompact(d.estimatedBudgetRwf)}
                            </div>
                          </div>
                          <ScoreRing score={overall} />
                        </div>
                      </div>

                      {/* Sub-scores */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 mb-4">
                        <SubScore icon={Building2} label="Infrastructure" value={d.infrastructureScore} weight={35} gap={d.hasInfraDataGap} />
                        <SubScore icon={Clock} label="Building Age" value={d.buildingAgeScore} weight={25} />
                        <SubScore icon={ClipboardCheck} label="Facility Compliance" value={d.facilityComplianceScore} weight={15} />
                        <SubScore icon={Users} label="Capacity Resilience" value={d.populationPressureScore} weight={10} gap={d.hasPopDataGap} />
                        <SubScore icon={Route} label="Accessibility" value={d.accessibilityScore} weight={10} />
                        <SubScore icon={CheckCircle2} label="Issue Resolution" value={d.resolutionRateScore} weight={5} />
                      </div>

                      {/* Recommendations */}
                      {Array.isArray(d.recommendations) && d.recommendations.length > 0 && (
                        <div className={cn("rounded-2xl p-4 border border-border/20", style.glow)}>
                          <h4 className="text-[11px] font-black uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-primary" />
                            System Recommendations
                          </h4>
                          <ul className="space-y-2">
                            {d.recommendations.map((rec: string, i: number) => {
                              const { tag, text } = parseRec(rec);
                              const ts = tag ? TAG_STYLE[tag] : null;
                              const TagIcon = ts?.icon ?? CheckCircle2;
                              return (
                                <li key={i} className="flex items-start gap-2.5 text-[13px] leading-snug text-foreground/90">
                                  {tag && (
                                    <span
                                      className={cn(
                                        "shrink-0 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider",
                                        ts?.cls ?? "bg-muted text-muted-foreground border-border/30",
                                      )}
                                    >
                                      <TagIcon className="w-2.5 h-2.5" />
                                      {tag}
                                    </span>
                                  )}
                                  <span className="pt-0.5">{text}</span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </motion.div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
