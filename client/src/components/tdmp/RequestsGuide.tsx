import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Clock,
  Gauge,
  Lightbulb,
  ListOrdered,
  PlugZap,
  Radar,
  Sparkles,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { formatNumber, formatRelative } from "../../lib/format";
import type { ConnectionReport, RequestState, RequestStatus } from "../../lib/tdmp";
import { Button } from "../ui/button";
import { StatusPill } from "../ui/status-pill";
import { PILL_BUTTON, type Tone } from "../ui/surfaces";
import { REQUEST_GUIDE } from "./request-guide";

const STATE: Record<RequestState, { label: string; tone: Tone; bar: string }> = {
  done: { label: "Done", tone: "good", bar: "bg-success" },
  partial: { label: "Partly done", tone: "warn", bar: "bg-warning" },
  waiting: { label: "Waiting for TDMP", tone: "neutral", bar: "bg-slate-400/60 dark:bg-white/25" },
  manual: { label: "To confirm", tone: "primary", bar: "bg-primary" },
};

type Filter = "all" | "P1" | RequestState;
const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "P1", label: "P1 only" },
  { id: "waiting", label: "Waiting" },
  { id: "partial", label: "Partly done" },
  { id: "manual", label: "To confirm" },
  { id: "done", label: "Done" },
];

const SECTION = "rounded-2xl bg-slate-900/[0.03] p-4 ring-1 ring-inset ring-slate-900/5 dark:bg-white/[0.035] dark:ring-white/8";

function CopyBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl bg-slate-950 ring-1 ring-white/10">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-1.5">
        <span className="truncate text-[11px] font-medium text-slate-400">{label}</span>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            } catch {
              // Clipboard blocked: the text stays selectable.
            }
          }}
          data-tooltip="Copy this example"
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-slate-300 hover:bg-white/10"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" aria-hidden /> : <ClipboardCopy className="h-3 w-3" aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="max-h-72 overflow-auto p-3 text-[12px] leading-relaxed text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** The selected request, explained for the TDMP team. */
function RequestDetail({ req, endpoints }: { req: RequestStatus; endpoints: ConnectionReport["endpoints"] }) {
  const reduce = useReducedMotion();
  const g = REQUEST_GUIDE[req.id];
  const s = STATE[req.state];
  const related = endpoints.filter((e) => e.request === req.id);
  const item = (i: number) => ({
    initial: reduce ? false : { opacity: 0, x: -6 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.25, delay: 0.05 + i * 0.05 },
  });
  return (
    <motion.article
      key={req.id}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? undefined : { opacity: 0, y: -6 }}
      transition={{ duration: 0.22 }}
      className="space-y-4"
      aria-labelledby={`req-${req.id}-title`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-mono font-semibold text-primary">{req.id}</span>
            <span className="rounded-md bg-slate-900/[0.05] px-1.5 py-0.5 font-medium dark:bg-white/10">{req.priority}</span>
          </p>
          <h3 id={`req-${req.id}-title`} className="mt-1.5 text-lg font-semibold leading-snug text-foreground">
            {req.title}
          </h3>
          {g && <p className="mt-0.5 text-sm text-muted-foreground">{g.summary}</p>}
        </div>
        <StatusPill tone={s.tone} pulse={req.state === "waiting"}>
          {s.label}
        </StatusPill>
      </header>

      {g ? (
        <>
          <section className={SECTION} aria-label="Why it matters">
            <p className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
              <Lightbulb className="h-4 w-4 text-warning" aria-hidden /> Why it matters
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">{g.why}</p>
          </section>

          <section className={SECTION} aria-label="What we ask TDMP">
            <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
              <ListOrdered className="h-4 w-4 text-primary" aria-hidden /> What we ask the TDMP team
            </p>
            <ol className="space-y-2">
              {g.ask.map((a, i) => (
                <motion.li key={i} {...item(i)} className="flex gap-2.5 text-sm text-foreground">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{a}</span>
                </motion.li>
              ))}
            </ol>
          </section>

          <section aria-label="Example">
            <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden /> Example
            </p>
            <CopyBlock code={g.example.code} label={g.example.label} />
          </section>

          <div className="grid gap-3 md:grid-cols-2">
            <section className={SECTION} aria-label="What it unlocks">
              <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
                <ArrowRight className="h-4 w-4 text-success" aria-hidden /> Turns on in RTB GIS
              </p>
              <div className="flex flex-wrap gap-1.5">
                {g.unlocks.map((u, i) => (
                  <motion.span
                    key={u}
                    initial={reduce ? false : { opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 + i * 0.04 }}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs ring-1 ring-inset",
                      req.state === "done" ? "bg-success/10 text-success ring-success/20" : "bg-white/60 text-foreground ring-slate-900/10 dark:bg-white/[0.04] dark:ring-white/10",
                    )}
                  >
                    {req.state === "done" && <Check className="mr-1 inline h-3 w-3" aria-hidden />}
                    {u}
                  </motion.span>
                ))}
              </div>
            </section>
            <section className={SECTION} aria-label="How we check it">
              <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
                <Radar className="h-4 w-4 text-primary" aria-hidden /> How we check it
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">{g.check}</p>
              <p className="mt-2 rounded-lg bg-slate-900/[0.04] px-2.5 py-1.5 text-xs text-foreground dark:bg-white/[0.05]">
                <span className="text-muted-foreground">Now: </span>
                {req.evidence}
              </p>
            </section>
          </div>

          {related.length > 0 && (
            <section aria-label="Related endpoints">
              <p className="mb-2 text-[13px] font-semibold text-foreground">Endpoints this request opens</p>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {related.map((e) => (
                  <li key={e.key} className="flex items-center justify-between gap-2 rounded-xl bg-slate-900/[0.03] px-3 py-2 text-sm dark:bg-white/[0.035]">
                    <span className="min-w-0">
                      <span className="block truncate text-foreground">{e.label}</span>
                      <span className="block truncate font-mono text-[11px] text-muted-foreground">{e.path}</span>
                    </span>
                    <StatusPill tone={e.ok ? "good" : "warn"} dot={false}>
                      {e.ok ? "200" : String(e.status || "—")}
                    </StatusPill>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{req.evidence}</p>
      )}
    </motion.article>
  );
}

/**
 * Connection and requests, for the TDMP team: an overview of where every
 * request stands, and a guided explanation of each one.
 */
export function RequestsGuide({ report, checking, onCheck }: { report: ConnectionReport; checking: boolean; onCheck: () => void }) {
  const reduce = useReducedMotion();
  const [tab, setTab] = useState<"requests" | "endpoints">("requests");
  const [filter, setFilter] = useState<Filter>("all");
  const firstOpen = report.requests.find((r) => r.state !== "done")?.id ?? report.requests[0]?.id;
  const [selectedId, setSelectedId] = useState<string | undefined>(firstOpen);

  const counts = useMemo(() => {
    const c: Record<RequestState, number> = { done: 0, partial: 0, waiting: 0, manual: 0 };
    for (const r of report.requests) c[r.state]++;
    return c;
  }, [report.requests]);
  const total = report.requests.length || 1;
  const visible = report.requests.filter((r) => filter === "all" || (filter === "P1" ? r.priority === "P1" : r.state === filter));
  const selected = report.requests.find((r) => r.id === selectedId) ?? visible[0];

  return (
    <div className="space-y-5">
      {/* Overview: connection + animated status bar */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {report.authorised ? (
              <StatusPill tone="good">Connected</StatusPill>
            ) : (
              <StatusPill tone="danger">{report.configured.apiKey ? (report.reachable ? "Key refused" : "Unreachable") : "No API key"}</StatusPill>
            )}
            <span className="text-muted-foreground">
              {report.tvetSchools != null ? `${formatNumber(report.tvetSchools)} TVET schools · ` : ""}
              {counts.done} of {report.requests.length} requests done · checked {formatRelative(report.checkedAt)}
            </span>
          </div>
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-900/[0.06] dark:bg-white/10" role="img" aria-label={`Done ${counts.done}, partly done ${counts.partial}, to confirm ${counts.manual}, waiting ${counts.waiting}`}>
            {(["done", "partial", "manual", "waiting"] as RequestState[]).map((k, i) =>
              counts[k] ? (
                <motion.span
                  key={k}
                  className={cn("h-full", STATE[k].bar)}
                  initial={reduce ? false : { width: 0 }}
                  animate={{ width: `${(counts[k] / total) * 100}%` }}
                  transition={{ duration: 0.7, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                />
              ) : null,
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            {(["done", "partial", "manual", "waiting"] as RequestState[]).map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span className={cn("h-2 w-2 rounded-full", STATE[k].bar)} aria-hidden /> {STATE[k].label} {counts[k]}
              </span>
            ))}
          </div>
        </div>
        <Button variant="outline" className={PILL_BUTTON.small} onClick={onCheck} isLoading={checking} disabled={checking} data-tooltip="Ask TDMP again now and refresh every status">
          <PlugZap className="h-3.5 w-3.5" aria-hidden /> Test again
        </Button>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Connection details" className="inline-flex rounded-full bg-slate-900/[0.05] p-1 dark:bg-white/[0.06]">
        {(
          [
            ["requests", "Requests to TDMP", ListOrdered],
            ["endpoints", "What our key can read", Gauge],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn("relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors", tab === id ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            {tab === id && <motion.span layoutId="req-tab" className="absolute inset-0 rounded-full bg-primary" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
            <Icon className="relative h-3.5 w-3.5" aria-hidden />
            <span className="relative">{label}</span>
          </button>
        ))}
      </div>

      {tab === "endpoints" ? (
        <ul className="grid gap-2 sm:grid-cols-2" aria-label="TDMP endpoints">
          {report.endpoints.map((e, i) => (
            <motion.li
              key={e.key}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center justify-between gap-3 rounded-xl bg-slate-900/[0.03] px-3 py-2.5 dark:bg-white/[0.035]"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm text-foreground">{e.label}</span>
                <span className="block truncate font-mono text-[11px] text-muted-foreground">{e.path}</span>
              </span>
              <StatusPill tone={e.ok ? "good" : e.status === 403 ? "warn" : "danger"} dot={false}>
                {e.ok ? "Readable" : e.status === 403 ? `Waiting ${e.request ?? ""}`.trim() : e.status === 0 ? "No answer" : String(e.status)}
              </StatusPill>
            </motion.li>
          ))}
        </ul>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5" aria-label="Filter requests">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                aria-pressed={filter === f.id}
                className={cn(
                  "rounded-full px-3 py-1 text-xs ring-1 ring-inset transition-colors",
                  filter === f.id ? "bg-primary/10 font-medium text-primary ring-primary/30" : "text-muted-foreground ring-slate-900/10 hover:text-foreground dark:ring-white/10",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
            {/* Request list */}
            <ul className="flex gap-2 overflow-x-auto pb-1 lg:max-h-[60vh] lg:flex-col lg:overflow-y-auto lg:overflow-x-visible lg:pb-0" aria-label="Requests">
              {visible.map((r) => {
                const active = selected?.id === r.id;
                return (
                  <li key={r.id} className="shrink-0 lg:shrink">
                    <button
                      type="button"
                      onClick={() => setSelectedId(r.id)}
                      aria-current={active ? "true" : undefined}
                      data-tooltip={REQUEST_GUIDE[r.id]?.summary}
                      className="relative flex w-56 items-start gap-2.5 rounded-xl px-3 py-2.5 text-left lg:w-full"
                    >
                      {active && (
                        <motion.span layoutId="req-active" className="absolute inset-0 rounded-xl bg-primary/[0.08] ring-1 ring-inset ring-primary/30" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
                      )}
                      <span className="relative mt-0.5 shrink-0" aria-hidden>
                        {r.state === "done" ? (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        ) : (
                          <Clock className={cn("h-4 w-4", r.state === "partial" ? "text-warning" : r.state === "manual" ? "text-primary" : "text-muted-foreground")} />
                        )}
                      </span>
                      <span className="relative min-w-0">
                        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span className="font-mono font-semibold">{r.id}</span>· {r.priority}
                        </span>
                        <span className={cn("block text-sm leading-snug", active ? "font-medium text-foreground" : "text-foreground/90")}>{r.title}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
              {!visible.length && <li className="px-3 py-2 text-sm text-muted-foreground">No request in this filter.</li>}
            </ul>

            {/* Detail */}
            <div className="min-w-0 rounded-2xl bg-white/50 p-4 ring-1 ring-inset ring-slate-900/[0.06] sm:p-5 dark:bg-white/[0.02] dark:ring-white/[0.08]">
              <AnimatePresence mode="popLayout" initial={false}>
                {selected ? <RequestDetail key={selected.id} req={selected} endpoints={report.endpoints} /> : null}
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
