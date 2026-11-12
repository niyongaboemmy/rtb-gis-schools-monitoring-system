import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useSpring } from "framer-motion";
import {
  ArrowUp,
  BookOpen,
  ChefHat,
  Check,
  CircleDashed,
  Code2,
  Globe2,
  Hash,
  KeyRound,
  LayoutDashboard,
  Map,
  MapPin,
  Play,
  Search,
  ShieldAlert,
  ShieldCheck,
  Timer,
  TriangleAlert,
} from "lucide-react";
import { cn } from "../lib/utils";
import { useScrollSpy } from "../hooks/useScrollSpy";
import { BASE, ENDPOINTS, ERRORS, RECIPES, SECTIONS, examplesFor, type Endpoint } from "../components/developers/api-reference";
import { Code, CodeTabs, CopyButton, LangProvider } from "../components/developers/code";
import { CommandPalette, type PaletteItem } from "../components/developers/CommandPalette";

// ── Small building blocks ────────────────────────────────────────────────────

const METHOD_TONE: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  POST: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
};

/** Scrolls to an anchor below the sticky header and keeps the URL in step. */
function goTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  history.replaceState(null, "", `#${id}`);
}

function Section({ id, title, icon: Icon, lead, children }: { id: string; title: string; icon: typeof BookOpen; lead?: ReactNode; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      id={id}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.4 }}
      className="scroll-mt-[calc(var(--dev-header,6rem)+1rem)] space-y-4"
      aria-labelledby={`${id}-h`}
    >
      <div className="space-y-1">
        <h2 id={`${id}-h`} className="group flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden>
            <Icon className="h-4 w-4" />
          </span>
          {title}
          <AnchorLink id={id} />
        </h2>
        {lead && <p className="text-sm leading-relaxed text-muted-foreground">{lead}</p>}
      </div>
      {children}
    </motion.section>
  );
}

/** "#" button that copies a deep link to this heading. */
function AnchorLink({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        history.replaceState(null, "", `#${id}`);
        try {
          await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#${id}`);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard blocked */
        }
      }}
      className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:text-primary focus-visible:opacity-100 group-hover:opacity-100"
      data-tooltip={copied ? "Link copied" : "Copy a link to this part"}
      aria-label={`Copy a link to ${id}`}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden /> : <Hash className="h-3.5 w-3.5" aria-hidden />}
    </button>
  );
}

const P = ({ children }: { children: ReactNode }) => <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>;
const C = ({ children }: { children: ReactNode }) => (
  <code className="rounded bg-slate-900/[0.06] px-1 py-0.5 font-mono text-[12px] text-foreground dark:bg-white/10">{children}</code>
);
const panel = "rounded-2xl bg-slate-900/[0.03] ring-1 ring-inset ring-slate-900/5 dark:bg-white/[0.035] dark:ring-white/8";

const STATUS_TONE = (s: number) =>
  s >= 200 && s < 300 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : s >= 400 && s < 500 ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-destructive/15 text-destructive";

/** One endpoint: parameters, examples that follow the "Try it" inputs, and the live console. */
function EndpointCard({ endpoint: e, apiKey, onSuccess }: { endpoint: Endpoint; apiKey: string; onSuccess: () => void }) {
  const [query, setQuery] = useState(e.tryQuery ?? "");
  const [code, setCode] = useState("280705");
  const [body, setBody] = useState(e.body ? JSON.stringify(e.body, null, 2) : "");
  const [result, setResult] = useState<{ status: number; text: string; ms: number; bytes: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const parsedBody = useMemo(() => {
    try {
      return body ? JSON.parse(body) : undefined;
    } catch {
      return undefined;
    }
  }, [body]);
  const examples = examplesFor(e, { query, code, body: parsedBody });

  /** Sets one query parameter to an example value (from the parameter table). */
  const setParam = (name: string, value: string) => {
    const q = new URLSearchParams(query);
    q.set(name, value);
    setQuery(decodeURIComponent(q.toString()));
  };

  const run = async () => {
    setBusy(true);
    setResult(null);
    const t0 = performance.now();
    try {
      const path = e.path.replace("{schoolCode}", encodeURIComponent(code));
      const res = await fetch(`${BASE}${path}${query ? `?${query}` : ""}`, {
        method: e.method,
        headers: { Authorization: `ApiKey ${apiKey}`, ...(e.method === "POST" ? { "Content-Type": "application/json" } : {}) },
        body: e.method === "POST" ? body : undefined,
      });
      const text = await res.text();
      let pretty = text;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        /* not JSON */
      }
      setResult({ status: res.status, text: pretty, ms: Math.round(performance.now() - t0), bytes: text.length });
      if (res.status >= 200 && res.status < 300) onSuccess();
    } catch (err) {
      setResult({ status: 0, text: String(err), ms: Math.round(performance.now() - t0), bytes: 0 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <article id={`ep-${e.id}`} className="scroll-mt-[calc(var(--dev-header,6rem)+1rem)] space-y-4 rounded-[1.5rem] bg-background p-4 shadow-sm ring-1 ring-border sm:p-5">
      <header className="group flex flex-wrap items-center gap-2">
        <span className={cn("rounded-md px-2 py-0.5 font-mono text-xs font-semibold", METHOD_TONE[e.method])}>{e.method}</span>
        <code className="break-all font-mono text-sm text-foreground">{e.path}</code>
        {e.scope && <span className="rounded-full bg-slate-900/[0.05] px-2 py-0.5 text-[11px] text-muted-foreground dark:bg-white/10">{e.scope}</span>}
        <AnchorLink id={`ep-${e.id}`} />
      </header>
      <div>
        <h3 className="font-medium text-foreground">{e.title}</h3>
        <P>{e.desc}</P>
      </div>
      {e.params && (
        <div className="overflow-x-auto rounded-xl ring-1 ring-border/70">
          <table className="w-full text-xs">
            <tbody className="divide-y divide-border/60">
              {e.params.map((p) => (
                <tr key={p.name}>
                  <td className="whitespace-nowrap px-3 py-2 align-top">
                    <C>{p.name}</C>
                    {p.required && <span className="ml-1 text-destructive">*</span>}
                    <span className="block text-[10px] text-muted-foreground">{p.in}</span>
                  </td>
                  <td className="px-3 py-2 align-top font-mono text-[11px] text-muted-foreground">{p.type}</td>
                  <td className="px-3 py-2 align-top text-muted-foreground">
                    {p.desc}
                    {p.example && p.in === "query" && (
                      <button
                        type="button"
                        onClick={() => setParam(p.name, p.example!)}
                        className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary hover:bg-primary/15"
                        data-tooltip="Add to the request below"
                      >
                        + {p.name}={p.example}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="grid gap-3 xl:grid-cols-2">
        <CodeTabs examples={examples} label="Request" />
        <Code code={e.response} label="Response 200 (example)" />
      </div>

      <div className="space-y-2 rounded-2xl bg-primary/[0.04] p-3 ring-1 ring-inset ring-primary/15">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
          <Play className="h-3.5 w-3.5" aria-hidden /> Try it {apiKey ? "with your key" : "(enter your key at the top)"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">{e.method}</span>
          {e.path.includes("{schoolCode}") && (
            <input value={code} onChange={(ev) => setCode(ev.target.value)} aria-label="schoolCode" className="h-8 w-32 rounded-lg border border-border bg-background px-2 font-mono text-xs" />
          )}
          {e.method === "GET" && (
            <input value={query} onChange={(ev) => setQuery(ev.target.value)} aria-label="Query string" placeholder="query, e.g. limit=5" className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 font-mono text-xs" />
          )}
          <button
            type="button"
            onClick={() => void run()}
            disabled={!apiKey || busy}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50"
            data-tooltip={apiKey ? "Send this request with your key" : "Enter your partner key at the top of the page first"}
          >
            <Play className="h-3.5 w-3.5" aria-hidden /> {busy ? "Sending…" : "Send"}
          </button>
          <CopyButton text={examples.curl} label="Copy as curl" className="text-muted-foreground hover:bg-slate-900/[0.05] dark:hover:bg-white/10" />
        </div>
        {e.method === "POST" && (
          <textarea
            value={body}
            onChange={(ev) => setBody(ev.target.value)}
            aria-label="Request body"
            rows={4}
            className={cn("w-full rounded-lg border bg-background p-2 font-mono text-xs", body && parsedBody === undefined ? "border-destructive" : "border-border")}
          />
        )}
        {result && (
          <div className="space-y-2" aria-live="polite">
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className={cn("rounded-md px-2 py-0.5 font-mono font-semibold", STATUS_TONE(result.status))}>{result.status || "error"}</span>
              <span className="inline-flex items-center gap-1">
                <Timer className="h-3 w-3" aria-hidden /> {result.ms} ms
              </span>
              <span>{(result.bytes / 1024).toFixed(1)} KB</span>
            </p>
            <Code code={result.text} label={`HTTP ${result.status || "error"}`} />
          </div>
        )}
      </div>
    </article>
  );
}

// ── Key access level (GET /partner/ping) ─────────────────────────────────────

type ViewId = "school-dashboard" | "school-map-2d" | "school-map-3d" | "national-map" | "national-dashboard";
const VIEW_OPTIONS: { id: ViewId; label: string }[] = [
  { id: "school-dashboard", label: "School dashboard" },
  { id: "school-map-2d", label: "School map (2D)" },
  { id: "school-map-3d", label: "School model (3D)" },
  { id: "national-map", label: "National map" },
  { id: "national-dashboard", label: "National dashboard" },
];
const isAreaView = (v: string) => v === "national-map" || v === "national-dashboard";
const PROVINCES = ["Kigali City", "Eastern Province", "Northern Province", "Southern Province", "Western Province"];

interface KeyAccess {
  tier: "national" | "province" | "district" | "schools";
  province?: string | null;
  district?: string | null;
  schoolCodes?: string[] | null;
  views: ViewId[];
  summary: string;
}
type KeyCheck =
  | { state: "none" }
  | { state: "checking" }
  | { state: "invalid"; message: string }
  | { state: "ok"; partner: string; keyName: string; scopes: string[]; access: KeyAccess };

/** Checks the key the reader typed, so the page can show and apply its access level. */
function useKeyCheck(apiKey: string): KeyCheck {
  // The answer is kept with the key it is for; a different key reads as "checking".
  const [checked, setChecked] = useState<{ key: string; check: KeyCheck } | null>(null);
  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;
    const done = (check: KeyCheck) => !cancelled && setChecked({ key: apiKey, check });
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`${BASE}/partner/ping`, { headers: { Authorization: `ApiKey ${apiKey}` } });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) done({ state: "invalid", message: data?.message ?? `HTTP ${res.status}` });
        else done({ state: "ok", partner: data.partner, keyName: data.keyName, scopes: data.scopes ?? [], access: data.access });
      } catch {
        done({ state: "invalid", message: "RTB GIS could not be reached" });
      }
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [apiKey]);
  if (!apiKey) return { state: "none" };
  return checked?.key === apiKey ? checked.check : { state: "checking" };
}

function KeyBadge({ check }: { check: KeyCheck }) {
  if (check.state === "none") return null;
  if (check.state === "checking") return <span className="text-xs text-muted-foreground">Checking key…</span>;
  if (check.state === "invalid")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive" data-tooltip={check.message}>
        <ShieldAlert className="h-3.5 w-3.5" aria-hidden /> Key not accepted
      </span>
    );
  return (
    <a
      href="#embed"
      className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300"
      data-tooltip={`${check.partner} · ${check.keyName}: ${check.access.views.length} view(s) allowed`}
    >
      <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> {check.access.summary}
    </a>
  );
}

/** What a view covers for a key at this access level, in one sentence. */
function coverage(access: KeyAccess, view: string): string {
  if (!access.views.includes(view as ViewId)) return "This key may not open this view: RTB GIS answers 403 PARTNER_ACCESS_DENIED.";
  if (isAreaView(view)) {
    switch (access.tier) {
      case "national":
        return "The whole country by default. You may narrow the link to one province or one district.";
      case "province":
        return `Only ${access.province}. You may narrow it to one of its districts; any other area answers 403.`;
      case "district":
        return `Only ${access.district} district, whatever you ask for. A wider area answers 403.`;
      case "schools":
        return "This key covers specific schools only, so national views answer 403. Use a school view.";
    }
  }
  switch (access.tier) {
    case "national":
      return "Any school in RTB GIS.";
    case "province":
      return `Any school in ${access.province}. A school elsewhere answers 404, as if it did not exist.`;
    case "district":
      return `Any school in ${access.district} district. A school elsewhere answers 404.`;
    case "schools":
      return `Only the key's ${access.schoolCodes?.length ?? 0} school(s). Any other code answers 404.`;
  }
}

type LinkScope = { tier: string; province?: string; district?: string; schoolName?: string } | null;
const scopeText = (s: LinkScope) =>
  !s ? "—" : s.tier === "national" ? "All of Rwanda" : s.tier === "province" ? `${s.province}` : s.tier === "district" ? `${s.district} district` : (s.schoolName ?? "One school");

function EmbedBuilder({ apiKey, check, onPreview }: { apiKey: string; check: KeyCheck; onPreview?: () => void }) {
  const access = check.state === "ok" ? check.access : null;
  const [view, setView] = useState<ViewId>("school-dashboard");
  const [code, setCode] = useState("280705");
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [result, setResult] = useState<{ url: string; scope: LinkScope; expiresAt: string; school?: { name: string } | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const school = !isAreaView(view);
  const allowed = (v: ViewId) => !access || access.views.includes(v);

  // Fields the key fixes are filled in and locked.
  const lockProvince = access?.tier === "province" || access?.tier === "district";
  const lockDistrict = access?.tier === "district";
  const shownProvince = lockProvince ? (access?.province ?? "") : province;
  const shownDistrict = lockDistrict ? (access?.district ?? "") : district;

  useEffect(() => {
    if (access && !access.views.includes(view)) setView(access.views[0] ?? "school-dashboard");
    if (access?.tier === "schools" && access.schoolCodes?.length) setCode(access.schoolCodes[0]);
    setResult(null);
    setError(null);
    // Reset only when the key changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access]);

  const body = school
    ? { view, schoolCode: code }
    : { view, ...(shownProvince ? { province: shownProvince } : {}), ...(shownDistrict ? { district: shownDistrict } : {}) };
  const snippet = `<iframe
  src="{url from POST /partner/embed-links}"
  title="RTB 3D GIS — ${view}"
  style="width:100%;height:720px;border:0;border-radius:16px"
  allow="fullscreen; clipboard-write"
  referrerpolicy="no-referrer"
></iframe>`;
  const preview = async () => {
    setError(null);
    setResult(null);
    const res = await fetch(`${BASE}/partner/embed-links`, {
      method: "POST",
      headers: { Authorization: `ApiKey ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(`${res.status}${data?.code ? ` ${data.code}` : ""}: ${data?.message ?? "Request refused"}`);
    else {
      setResult({ url: data.url, scope: data.scope ?? null, expiresAt: data.expiresAt, school: data.school });
      onPreview?.();
    }
  };
  const field = "block h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-70";
  return (
    <div className="space-y-3">
      <div className={cn("rounded-2xl p-3 ring-1 ring-inset", access ? "bg-emerald-500/[0.06] ring-emerald-500/20" : "bg-slate-900/[0.03] ring-slate-900/5 dark:bg-white/[0.035] dark:ring-white/8")}>
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
          {access ? <>Your key: {access.summary}</> : check.state === "invalid" ? <>Key not accepted: {check.message}</> : <>Enter your partner key at the top to see its access level here</>}
        </p>
        {access && (
          <>
            <p className="mt-1 text-xs text-muted-foreground">
              <strong className="text-foreground">{VIEW_OPTIONS.find((o) => o.id === view)?.label}:</strong> {coverage(access, view)}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Views this key may open">
              {VIEW_OPTIONS.map((o) => (
                <span key={o.id} className={cn("rounded-md px-2 py-0.5 font-mono text-[11px]", allowed(o.id) ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-slate-500/10 text-muted-foreground line-through")}>
                  {o.id}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1 text-xs text-muted-foreground">
          View
          <select value={view} onChange={(e) => { setView(e.target.value as ViewId); setResult(null); setError(null); }} className={field}>
            {VIEW_OPTIONS.map((o) => (
              <option key={o.id} value={o.id} disabled={!allowed(o.id)}>
                {o.label}{allowed(o.id) ? "" : " (not allowed for this key)"}
              </option>
            ))}
          </select>
        </label>
        {school ? (
          <label className="space-y-1 text-xs text-muted-foreground">
            School code
            {access?.tier === "schools" && access.schoolCodes?.length ? (
              <select value={code} onChange={(e) => setCode(e.target.value)} className={cn(field, "w-36 font-mono")}>
                {access.schoolCodes.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            ) : (
              <input value={code} onChange={(e) => setCode(e.target.value)} className={cn(field, "w-32 font-mono")} />
            )}
          </label>
        ) : (
          <>
            <label className="space-y-1 text-xs text-muted-foreground" data-tooltip={lockProvince ? "Fixed by your key's access level" : "Optional: limit the view to one province"}>
              Province
              <select value={shownProvince} disabled={lockProvince} onChange={(e) => { setProvince(e.target.value); setDistrict(""); }} className={cn(field, "w-44")}>
                <option value="">Whole country</option>
                {(lockProvince && shownProvince && !PROVINCES.includes(shownProvince) ? [shownProvince, ...PROVINCES] : PROVINCES).map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs text-muted-foreground" data-tooltip={lockDistrict ? "Fixed by your key's access level" : "Optional: limit the view to one district"}>
              District
              <input value={shownDistrict} disabled={lockDistrict} onChange={(e) => setDistrict(e.target.value)} placeholder="Any" className={cn(field, "w-36")} />
            </label>
          </>
        )}
        <button
          type="button"
          onClick={() => void preview()}
          disabled={!apiKey || !allowed(view)}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          data-tooltip={!apiKey ? "Enter your partner key at the top of the page first" : allowed(view) ? "Mint a real link and show the view below" : "Your key may not open this view"}
        >
          <Play className="h-4 w-4" aria-hidden /> Preview
        </button>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Code code={`POST /api/v1/partner/embed-links\nAuthorization: ApiKey rtbgis_pk_…\nContent-Type: application/json\n\n${JSON.stringify(body, null, 2)}`} label="Your server" />
        <Code code={snippet} label="Your page" />
      </div>
      {error && (
        <p className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {error}
        </p>
      )}
      {result && (
        <>
          <p className="flex flex-wrap items-center gap-2 rounded-xl bg-emerald-500/[0.08] px-3 py-2 text-sm text-foreground" aria-live="polite">
            <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden />
            This link covers <strong>{result.school?.name ?? scopeText(result.scope)}</strong>
            <span className="text-xs text-muted-foreground">· set by RTB GIS from your key, expires {new Date(result.expiresAt).toLocaleTimeString()}</span>
          </p>
          <iframe src={result.url} title={`Preview: ${view}`} className="h-[560px] w-full rounded-2xl border-0 ring-1 ring-border" allow="fullscreen" referrerPolicy="no-referrer" />
        </>
      )}
    </div>
  );
}

/** The reader's progress through the quickstart, ticked off live. */
function Quickstart({ check, requested, previewed }: { check: KeyCheck; requested: boolean; previewed: boolean }) {
  const steps = [
    {
      done: check.state === "ok",
      title: "Enter your partner key",
      text: check.state === "ok" ? `Key accepted · ${check.access.summary}` : check.state === "invalid" ? `Key not accepted: ${check.message}` : "Paste it in the field at the top. It stays in this tab only.",
      go: undefined as string | undefined,
    },
    { done: requested, title: "Send your first request", text: "Press Send on any endpoint, e.g. Check your key.", go: "ep-ping" },
    { done: previewed, title: "Preview an embedded view", text: "Pick a view and press Preview to see what your users will see.", go: "embed" },
  ];
  const count = steps.filter((s) => s.done).length;
  return (
    <div className={cn(panel, "p-4")}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">Quickstart</p>
        <span className="text-xs text-muted-foreground">{count} of 3 done</span>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-900/[0.06] dark:bg-white/10">
        <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-500 ease-out" style={{ width: `${(count / 3) * 100}%` }} />
      </div>
      <ol className="grid gap-2 sm:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title}>
            <button
              type="button"
              onClick={() => (s.go ? goTo(s.go) : document.getElementById("partner-key")?.focus())}
              className={cn("h-full w-full rounded-xl p-3 text-left ring-1 ring-inset transition-colors", s.done ? "bg-emerald-500/[0.07] ring-emerald-500/25" : "bg-background ring-border hover:ring-primary/40")}
            >
              <span className="mb-1 flex items-center gap-2 text-sm font-medium text-foreground">
                {s.done ? <Check className="h-4 w-4 text-emerald-600" aria-hidden /> : <CircleDashed className="h-4 w-4 text-muted-foreground" aria-hidden />}
                {i + 1}. {s.title}
              </span>
              <span className="block text-xs leading-relaxed text-muted-foreground">{s.text}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Recipes() {
  const tags = useMemo(() => [...new Set(RECIPES.flatMap((r) => r.tags))], []);
  const [tag, setTag] = useState<string | null>(null);
  const shown = RECIPES.filter((r) => !tag || r.tags.includes(tag));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter recipes">
        {[null, ...tags].map((t) => (
          <button
            key={t ?? "all"}
            type="button"
            aria-pressed={tag === t}
            onClick={() => setTag(t)}
            className={cn("rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors", tag === t ? "bg-primary text-primary-foreground ring-primary" : "text-muted-foreground ring-border hover:text-foreground")}
          >
            {t ?? "All"}
          </button>
        ))}
      </div>
      {shown.map((r) => (
        <article key={r.id} id={r.id} className="scroll-mt-[calc(var(--dev-header,6rem)+1rem)] space-y-3 rounded-[1.5rem] bg-background p-4 shadow-sm ring-1 ring-border sm:p-5">
          <header className="group flex flex-wrap items-center gap-2">
            <h3 className="font-medium text-foreground">{r.title}</h3>
            <AnchorLink id={r.id} />
            <span className="ml-auto flex flex-wrap gap-1">
              {r.tags.map((t) => (
                <span key={t} className="rounded-full bg-slate-900/[0.05] px-2 py-0.5 text-[10px] text-muted-foreground dark:bg-white/10">
                  {t}
                </span>
              ))}
            </span>
          </header>
          <P>{r.summary}</P>
          <CodeTabs examples={r.examples} />
        </article>
      ))}
    </div>
  );
}

function ErrorTable() {
  const [q, setQ] = useState("");
  const rows = ERRORS.filter((e) => !q || `${e.http} ${e.code} ${e.meaning} ${e.fix}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-3">
      <label className="flex max-w-sm items-center gap-2 rounded-full border border-border bg-background px-3">
        <Search className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an error: 403, EMBED…" aria-label="Find an error" className="h-9 w-full bg-transparent text-sm outline-none" />
      </label>
      <div className="overflow-x-auto rounded-2xl ring-1 ring-border">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/[0.03] text-left text-xs text-muted-foreground dark:bg-white/[0.04]">
            <tr>
              <th className="px-3 py-2">HTTP</th>
              <th className="px-3 py-2">code</th>
              <th className="px-3 py-2">Meaning</th>
              <th className="px-3 py-2">How to fix</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 text-muted-foreground">
            {rows.map((r) => (
              <tr key={r.http + r.code}>
                <td className="px-3 py-2">
                  <span className={cn("rounded-md px-1.5 py-0.5 font-mono text-xs font-semibold", STATUS_TONE(Number(r.http)))}>{r.http}</span>
                </td>
                <td className="px-3 py-2"><C>{r.code}</C></td>
                <td className="px-3 py-2">{r.meaning}</td>
                <td className="px-3 py-2 text-foreground/80">{r.fix}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center">No error matches “{q}”.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** /developers — the RTB 3D GIS partner API guide (for TDMP and other platforms). */
export default function Developers() {
  return (
    <LangProvider>
      <DevelopersPage />
    </LangProvider>
  );
}

function DevelopersPage() {
  const [apiKey, setApiKey] = useState("");
  const keyCheck = useKeyCheck(apiKey);
  const [requested, setRequested] = useState(false);
  const [previewed, setPreviewed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const mobileNav = useRef<HTMLUListElement>(null);
  const header = useRef<HTMLElement>(null);
  const [headerHeight, setHeaderHeight] = useState(96);
  const spyLine = () => (header.current?.offsetHeight ?? 96) + 40;

  const sectionIds = useMemo(() => SECTIONS.map((s) => s.id), []);
  const endpointIds = useMemo(() => ENDPOINTS.map((e) => `ep-${e.id}`), []);
  const active = useScrollSpy(sectionIds, { offset: spyLine, snapToEnd: true });
  const activeEndpoint = useScrollSpy(endpointIds, { offset: spyLine });

  // Anchors land just below the sticky header, whatever its height (it wraps on phones).
  useEffect(() => {
    const el = header.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setHeaderHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });

  // Keep the URL and the mobile chip bar on the section being read.
  useEffect(() => {
    if (!active) return;
    if (window.location.hash !== `#${active}` && !window.location.hash.startsWith("#ep-") && !window.location.hash.startsWith("#recipe-"))
      history.replaceState(null, "", `#${active}`);
    const bar = mobileNav.current;
    const chip = bar?.querySelector<HTMLElement>(`[data-section="${active}"]`);
    if (bar && chip) bar.scrollTo?.({ left: chip.offsetLeft - bar.clientWidth / 2 + chip.clientWidth / 2, behavior: "smooth" });
  }, [active]);

  // A deep link (#ep-embed-links…) lands once the page has rendered.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    const t = window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "start" }), 60);
    return () => window.clearTimeout(t);
  }, []);

  // ⌘K / Ctrl+K or "/" opens search; the back-to-top button after a screen of scrolling.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    const onScroll = () => setShowTop(window.scrollY > 800);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const paletteItems = useMemo<PaletteItem[]>(
    () => [
      ...SECTIONS.map((s) => ({ id: s.id, label: s.label, group: "Section" })),
      ...ENDPOINTS.map((e) => ({ id: `ep-${e.id}`, label: e.title, group: e.method, hint: e.path })),
      ...RECIPES.map((r) => ({ id: r.id, label: r.title, group: "Recipe", hint: r.tags.join(" ") })),
      ...ERRORS.map((e) => ({ id: "errors", label: `${e.http} ${e.code === "—" ? e.meaning : e.code}`, group: "Error", hint: e.fix })),
    ],
    [],
  );

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ ["--dev-header" as string]: `${headerHeight}px` }}>
      <header ref={header} className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <a href="#overview" onClick={(e) => (e.preventDefault(), goTo("overview"))} className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-sky-500 text-primary-foreground shadow-sm" aria-hidden>
              <Code2 className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-base font-semibold tracking-tight">RTB 3D GIS — Partner API</span>
              <span className="block text-[11px] text-muted-foreground">For TDMP and other platforms · v1</span>
            </span>
          </a>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="order-last flex h-9 w-full items-center gap-2 rounded-full border border-border bg-background px-3 text-sm text-muted-foreground hover:border-primary/40 sm:order-none sm:ml-auto sm:w-56"
            aria-label="Search the guide"
          >
            <Search className="h-4 w-4" aria-hidden /> Search…
            <kbd className="ml-auto rounded border border-border px-1.5 text-[10px]">⌘K</kbd>
          </button>
          <label className="flex w-full items-center gap-2 sm:w-auto">
            <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              id="partner-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value.trim())}
              placeholder="Partner key (stays in this tab)"
              aria-label="Partner key for trying requests"
              autoComplete="off"
              className="h-9 w-full rounded-full border border-border bg-background px-3 text-sm sm:w-72"
            />
            <KeyBadge check={keyCheck} />
          </label>
        </div>
        <motion.div className="h-0.5 origin-left bg-gradient-to-r from-primary to-sky-400" style={{ scaleX: progress }} aria-hidden />
        <nav aria-label="Sections (compact)" className="border-t border-border/40 lg:hidden">
          <ul ref={mobileNav} className="flex gap-1 overflow-x-auto px-4 py-2 [scrollbar-width:none]">
            {SECTIONS.map((s) => (
              <li key={s.id} className="shrink-0">
                <a
                  href={`#${s.id}`}
                  data-section={s.id}
                  onClick={(e) => (e.preventDefault(), goTo(s.id))}
                  aria-current={active === s.id ? "location" : undefined}
                  className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors", active === s.id ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
                >
                  <s.icon className="h-3.5 w-3.5" aria-hidden /> {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="Sections" className="hidden lg:sticky lg:top-24 lg:block lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">On this page</p>
          <ul className="space-y-0.5">
            {SECTIONS.map((s) => {
              const on = active === s.id;
              return (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    onClick={(e) => (e.preventDefault(), goTo(s.id))}
                    aria-current={on ? "location" : undefined}
                    className={cn("relative flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors", on ? "font-medium text-primary" : "text-muted-foreground hover:text-foreground")}
                  >
                    {on && <motion.span layoutId="dev-nav-active" className="absolute inset-0 rounded-xl bg-primary/10" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                    <s.icon className="relative h-4 w-4" aria-hidden />
                    <span className="relative">{s.label}</span>
                  </a>
                  {s.id === "endpoints" && (
                    <ul className="my-1 ml-5 space-y-0.5 border-l border-border pl-2">
                      {ENDPOINTS.map((e) => {
                        const epOn = on && activeEndpoint === `ep-${e.id}`;
                        return (
                          <li key={e.id}>
                            <a
                              href={`#ep-${e.id}`}
                              onClick={(ev) => (ev.preventDefault(), goTo(`ep-${e.id}`))}
                              aria-current={epOn ? "location" : undefined}
                              className={cn("flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs transition-colors", epOn ? "bg-primary/5 font-medium text-primary" : "text-muted-foreground hover:text-foreground")}
                            >
                              <span className={cn("w-9 shrink-0 font-mono text-[9px] font-semibold", e.method === "GET" ? "text-emerald-600 dark:text-emerald-400" : "text-sky-600 dark:text-sky-400")}>{e.method}</span>
                              <span className="truncate">{e.title}</span>
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
          <div className={cn(panel, "mt-6 p-3 text-xs text-muted-foreground")}>
            <p className="mb-1 font-medium text-foreground">Base URL</p>
            <div className="flex items-center gap-1">
              <code className="min-w-0 flex-1 truncate font-mono text-[11px]">{BASE}</code>
              <CopyButton text={BASE} label="Copy" className="text-muted-foreground hover:bg-slate-900/[0.05] dark:hover:bg-white/10" />
            </div>
          </div>
        </nav>

        <main className="min-w-0 space-y-16">
          <Section id="overview" title="Overview" icon={BookOpen}>
            <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-primary/[0.12] via-sky-500/[0.06] to-transparent p-5 ring-1 ring-inset ring-primary/15 sm:p-6">
              <p className="max-w-2xl text-sm leading-relaxed text-foreground/80">
                RTB 3D GIS shares two things with partner platforms: <strong className="text-foreground">school data</strong> through a read-only
                API, and <strong className="text-foreground">live views</strong> (school dashboard, 2D map, 3D model, national map and dashboard)
                you can embed. Everything is read-only, and every key is limited to the area RTB GIS gives it.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-4">
                {[
                  ["REST + JSON", "UTF-8, ISO 8601 times"],
                  ["API key", "Authorization: ApiKey …"],
                  ["5 views", "one link, one view"],
                  ["Read-only", "never writes data"],
                ].map(([t, d]) => (
                  <div key={t} className="rounded-xl bg-background/70 px-3 py-2 ring-1 ring-inset ring-border/60">
                    <p className="text-sm font-semibold text-foreground">{t}</p>
                    <p className="text-[11px] text-muted-foreground">{d}</p>
                  </div>
                ))}
              </div>
            </div>
            <Quickstart check={keyCheck} requested={requested} previewed={previewed} />
            <ol className="grid gap-3 sm:grid-cols-3">
              {[
                { icon: KeyRound, title: "Get a key", text: "An RTB GIS admin creates a partner key with an access level (TDMP integration page ▸ Partner access)." },
                { icon: Code2, title: "Read data", text: "Call the API from your server: schools, one school, your key's details." },
                { icon: Globe2, title: "Embed views", text: "Mint a signed link per page view and put it in an iframe." },
              ].map((f, i) => (
                <li key={f.title} className={cn(panel, "p-4")}>
                  <span className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] text-primary-foreground">{i + 1}</span>
                    <f.icon className="h-4 w-4 text-primary" aria-hidden /> {f.title}
                  </span>
                  <span className="text-xs leading-relaxed text-muted-foreground">{f.text}</span>
                </li>
              ))}
            </ol>
          </Section>

          <Section id="auth" title="Authentication" icon={KeyRound} lead="Every partner request carries a partner key, created by an RTB GIS administrator and shown once.">
            <div className="grid gap-3 lg:grid-cols-2">
              <Code code={`Authorization: ApiKey rtbgis_pk_…\n# or\nX-API-Key: rtbgis_pk_…`} label="Headers" />
              <Code code={`# .env on your server (never in the browser or the repo)\nRTBGIS_BASE_URL=${BASE}\nRTBGIS_KEY=rtbgis_pk_…`} label=".env" />
            </div>
            <div className="overflow-x-auto rounded-2xl ring-1 ring-border">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/[0.03] text-left text-xs text-muted-foreground dark:bg-white/[0.04]">
                  <tr>
                    <th className="px-3 py-2">Scope</th>
                    <th className="px-3 py-2">Allows</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  <tr><td className="px-3 py-2"><C>schools:read</C></td><td className="px-3 py-2 text-muted-foreground">School list and one school</td></tr>
                  <tr><td className="px-3 py-2"><C>embed:create</C></td><td className="px-3 py-2 text-muted-foreground">Signed embed links to dashboards and maps</td></tr>
                  <tr><td className="px-3 py-2"><C>coordinates:read</C></td><td className="px-3 py-2 text-muted-foreground">The coordinates feed (only when RTB GIS grants it)</td></tr>
                </tbody>
              </table>
            </div>
            <h3 className="pt-2 font-medium text-foreground">Access level</h3>
            <P>
              Each key also has an <strong className="text-foreground">access level</strong> set by RTB GIS. Every endpoint applies it, so a key never
              sees more than it was given. <C>GET /partner/ping</C> shows yours, and so does the badge next to the key field once you enter it.
            </P>
            <div className="overflow-x-auto rounded-2xl ring-1 ring-border">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/[0.03] text-left text-xs text-muted-foreground dark:bg-white/[0.04]">
                  <tr>
                    <th className="px-3 py-2">Level</th>
                    <th className="px-3 py-2">Data endpoints</th>
                    <th className="px-3 py-2">Embed links</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-muted-foreground">
                  {[
                    ["national", "All schools", "Any school; national map and dashboard of the country, a province or a district"],
                    ["province", "Schools in the province", "Schools in the province; national map and dashboard of the province or one of its districts"],
                    ["district", "Schools in the district", "Schools in the district; national map and dashboard of the district only"],
                    ["schools", "Only the listed schools", "Only the listed schools; no national map or dashboard"],
                  ].map(([tier, data, embed]) => (
                    <tr key={tier} className={cn(keyCheck.state === "ok" && keyCheck.access.tier === tier && "bg-emerald-500/[0.07]")}>
                      <td className="px-3 py-2">
                        <C>{tier}</C>
                        {keyCheck.state === "ok" && keyCheck.access.tier === tier && <span className="ml-2 text-[11px] font-medium text-emerald-600">your key</span>}
                      </td>
                      <td className="px-3 py-2">{data}</td>
                      <td className="px-3 py-2">{embed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <P>
              A school outside your access answers <C>404</C>, as if it did not exist. Asking for a wider area or a view the key does not allow answers{" "}
              <C>403 PARTNER_ACCESS_DENIED</C>. If RTB GIS narrows a key, views already open under the old access end at once.
            </P>
          </Section>

          <Section id="endpoints" title="Endpoints" icon={Code2} lead="All responses are JSON (UTF-8). Times are ISO 8601 in UTC. Coordinates are WGS84 decimal degrees. The examples follow what you type in “Try it”.">
            <div className="space-y-6">
              {ENDPOINTS.map((e) => (
                <EndpointCard key={e.id} endpoint={e} apiKey={apiKey} onSuccess={() => setRequested(true)} />
              ))}
            </div>
          </Section>

          <Section
            id="embed"
            title="Embedding views"
            icon={LayoutDashboard}
            lead={
              <>
                Each view needs a fresh signed link, minted by <strong className="text-foreground">your server</strong> with{" "}
                <C>POST /partner/embed-links</C> when your page renders. The link opens a read-only session limited to that school (or area) for
                the session length you chose. When it ends, the view asks the user to reload.
              </>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {[
                { icon: LayoutDashboard, t: "school-dashboard", d: "Condition score, priorities, facilities, enrolment and reports." },
                { icon: Map, t: "school-map-2d", d: "Site map with drone imagery and buildings." },
                { icon: Globe2, t: "school-map-3d", d: "The 3D model with measuring tools (nothing saved)." },
                { icon: MapPin, t: "national-map", d: "All schools on the map; optionally one province or district." },
                { icon: BookOpen, t: "national-dashboard", d: "National figures and rankings; optionally one province or district." },
              ].map((v) => {
                const ok = keyCheck.state !== "ok" || keyCheck.access.views.includes(v.t as ViewId);
                return (
                  <div key={v.t} className={cn(panel, "p-3 transition-opacity", !ok && "opacity-50")}>
                    <v.icon className="mb-1.5 h-4 w-4 text-primary" aria-hidden />
                    <C>{v.t}</C>
                    <p className="mt-1 text-xs text-muted-foreground">{v.d}</p>
                    {!ok && <p className="mt-1 text-[11px] font-medium text-amber-600">Not allowed for your key</p>}
                  </div>
                );
              })}
            </div>
            <P>
              <strong className="text-foreground">One link, one view.</strong> A dashboard link shows only the dashboard, a 2D link only the 2D map,
              a 3D link only the model, a national-map link only the national map, and a national-dashboard link only the national dashboard. The
              session behind it can reach no other view&apos;s data (RTB GIS refuses it with <C>403 EMBED_VIEW_DENIED</C>), always within your key&apos;s
              access level.
            </P>
            <P>
              <strong className="text-foreground">The area comes from your key, not from the request.</strong> For the national map and
              dashboard you may <em>narrow</em> the area with <C>province</C> / <C>district</C>, never widen it. The response&apos;s{" "}
              <C>scope</C> says what the link really covers, and the view shows it in its corner (&ldquo;Showing: Muhanga District&rdquo;).
            </P>
            <EmbedBuilder apiKey={apiKey} check={keyCheck} onPreview={() => setPreviewed(true)} />
            <P>
              People who already have an RTB GIS account can also open <C>/embed/schools/&#123;id&#125;/dashboard</C> (and the other views)
              directly: they then see it with their own role and area.
            </P>
          </Section>

          <Section id="recipes" title="Recipes" icon={ChefHat} lead="Complete, copy-ready examples for the common jobs. The language you pick applies to every example on the page.">
            <Recipes />
          </Section>

          <Section
            id="coordinates"
            title="Coordinates feed"
            icon={MapPin}
            lead={
              <>
                For keys with the <C>coordinates:read</C> scope: RTB GIS school points (from drone surveys and GIS staff), to keep another system&apos;s
                locations in line. Pull it daily and incrementally.
              </>
            }
          >
            <ol className="space-y-3">
              {[
                ["First load", <>Page through <C>GET /partner/schools/coordinates?limit=1000</C> and keep <C>generatedAt</C>.</>],
                ["Match", <>Each row&apos;s <C>schoolCode</C> is the TDMP / SDMS school code.</>],
                ["Choose what to trust", <>Use points whose <C>quality</C> is <C>surveyed</C> or <C>manual</C>; skip <C>unverified</C>.</>],
                ["Validate", <>Accept points inside Rwanda only (latitude −2.95 to −0.95, longitude 28.75 to 31.0).</>],
                ["Stay current", <>Once a day, call again with <C>updatedSince=&lt;previous generatedAt&gt;</C>; only changed schools come back.</>],
              ].map(([t, d], i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">{i + 1}</span>
                  <span className="text-sm">
                    <span className="font-medium text-foreground">{t}. </span>
                    <span className="text-muted-foreground">{d}</span>
                  </span>
                </li>
              ))}
            </ol>
            <CodeTabs
              label="Daily job"
              examples={{
                "Node.js": `const BASE = "${BASE}";
const headers = { Authorization: \`ApiKey \${process.env.RTBGIS_KEY}\` };
const since = await store.get("rtbgis.coordinates.since"); // null on first run

let page = 1, generatedAt;
for (;;) {
  const q = new URLSearchParams({ limit: "1000", page: String(page) });
  if (since) q.set("updatedSince", since);
  const res = await fetch(\`\${BASE}/partner/schools/coordinates?\${q}\`, { headers });
  if (!res.ok) throw new Error(\`RTB GIS answered \${res.status}\`);
  const body = await res.json();
  generatedAt ??= body.generatedAt;
  for (const s of body.data) {
    if (!["surveyed", "manual"].includes(s.quality)) continue;
    if (s.latitude < -2.95 || s.latitude > -0.95 || s.longitude < 28.75 || s.longitude > 31) continue;
    await db.schools.update({ schoolCode: s.schoolCode }, { lat: s.latitude, lng: s.longitude });
  }
  if (page * body.page.limit >= body.page.total) break;
  page++;
}
await store.set("rtbgis.coordinates.since", generatedAt);`,
                Python: `import os, requests
BASE = "${BASE}"
H = {"Authorization": f"ApiKey {os.environ['RTBGIS_KEY']}"}
since = store.get("rtbgis.coordinates.since")
page, generated_at = 1, None
while True:
    params = {"limit": 1000, "page": page, **({"updatedSince": since} if since else {})}
    body = requests.get(f"{BASE}/partner/schools/coordinates", headers=H, params=params, timeout=30).json()
    generated_at = generated_at or body["generatedAt"]
    for s in body["data"]:
        if s["quality"] in ("surveyed", "manual") and -2.95 <= s["latitude"] <= -0.95 and 28.75 <= s["longitude"] <= 31:
            db.update_school_location(s["schoolCode"], s["latitude"], s["longitude"])
    if page * body["page"]["limit"] >= body["page"]["total"]:
        break
    page += 1
store.set("rtbgis.coordinates.since", generated_at)`,
              }}
            />
            <P>
              Prefer GeoJSON? Add <C>format=geojson</C> and load the response straight into a map layer.
            </P>
          </Section>

          <Section id="errors" title="Errors and limits" icon={TriangleAlert} lead="Errors share one shape. Search by status or code to see how to fix it.">
            <ErrorTable />
            <Code code={`{ "statusCode": 401, "code": "PARTNER_KEY_INVALID", "message": "Missing, unknown or revoked partner API key." }`} label="Error body" />
          </Section>

          <Section id="security" title="Security" icon={ShieldCheck}>
            <ul className="grid gap-3 sm:grid-cols-2">
              {[
                ["Keys stay on servers", "Stored hashed on our side and revocable at any time; revoking also ends every open embedded view made with that key."],
                ["Short-lived signed links", "Embed links expire in minutes and carry their token in the URL fragment, never sent to servers or in Referer headers."],
                ["Read-only, scoped views", "Limited to the school or area in the link and to one view; every view opened is recorded in our audit trail."],
                ["Restricted framing", "Only the sites registered with your key may frame RTB GIS views (Content-Security-Policy frame-ancestors)."],
              ].map(([t, d]) => (
                <li key={t} className={cn(panel, "p-4")}>
                  <p className="mb-1 flex items-center gap-2 text-sm font-medium text-foreground">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden /> {t}
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{d}</p>
                </li>
              ))}
            </ul>
          </Section>
        </main>
      </div>

      <motion.button
        type="button"
        onClick={() => goTo("overview")}
        initial={false}
        animate={{ opacity: showTop ? 1 : 0, y: showTop ? 0 : 12, pointerEvents: showTop ? "auto" : "none" }}
        className="fixed bottom-5 right-5 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
        aria-label="Back to top"
        data-tooltip="Back to top"
      >
        <ArrowUp className="h-4 w-4" aria-hidden />
      </motion.button>

      <CommandPalette items={paletteItems} open={paletteOpen} onClose={() => setPaletteOpen(false)} onPick={goTo} />
    </div>
  );
}
