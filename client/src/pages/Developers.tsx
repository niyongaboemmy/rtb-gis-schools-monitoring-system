import { useMemo, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  BookOpen,
  Check,
  ClipboardCopy,
  Code2,
  Globe2,
  KeyRound,
  LayoutDashboard,
  Map,
  MapPin,
  Play,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { cn } from "../lib/utils";

const ORIGIN = typeof window !== "undefined" ? window.location.origin : "https://rtb.aerovyntech.com";
const BASE = `${ORIGIN}/api/v1`;

// ── Small building blocks ────────────────────────────────────────────────────

function Code({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl bg-slate-950 ring-1 ring-white/10">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-1.5">
        <span className="truncate text-[11px] font-medium text-slate-400">{label ?? ""}</span>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            } catch {
              /* clipboard blocked */
            }
          }}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-slate-300 hover:bg-white/10"
          data-tooltip="Copy"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" aria-hidden /> : <ClipboardCopy className="h-3 w-3" aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="max-h-96 overflow-auto p-3 text-[12px] leading-relaxed text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** Same example in several languages. */
function CodeTabs({ examples }: { examples: Record<string, string> }) {
  const langs = Object.keys(examples);
  const [lang, setLang] = useState(langs[0]);
  return (
    <div className="space-y-2">
      <div role="tablist" className="inline-flex rounded-full bg-slate-900/[0.05] p-0.5 dark:bg-white/[0.06]">
        {langs.map((l) => (
          <button
            key={l}
            role="tab"
            aria-selected={lang === l}
            onClick={() => setLang(l)}
            className={cn("rounded-full px-3 py-1 text-xs font-medium", lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            {l}
          </button>
        ))}
      </div>
      <Code code={examples[lang]} label={lang} />
    </div>
  );
}

const METHOD_TONE: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  POST: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
};

interface Param {
  name: string;
  in: "query" | "path" | "body";
  type: string;
  required?: boolean;
  desc: string;
}

interface Endpoint {
  id: string;
  method: "GET" | "POST";
  path: string;
  title: string;
  scope?: string;
  desc: string;
  params?: Param[];
  body?: Record<string, unknown>;
  response: string;
  /** Default query string for "Try it". */
  tryQuery?: string;
}

const ENDPOINTS: Endpoint[] = [
  {
    id: "ping",
    method: "GET",
    path: "/partner/ping",
    title: "Check your key",
    desc: "Returns the partner and scopes the key carries. Use it to verify your setup.",
    response: `{ "partner": "TDMP", "keyName": "TDMP production", "keyPrefix": "rtbgis_pk_3f9a1c",
  "scopes": ["schools:read", "coordinates:read", "embed:create"], "time": "2026-11-12T10:00:00.000Z" }`,
  },
  {
    id: "coordinates",
    method: "GET",
    path: "/partner/schools/coordinates",
    title: "School coordinates",
    scope: "coordinates:read",
    desc: "Every school's point (WGS84) with where it came from. The feed to update your own GPS from. Ordered by last location change; use updatedSince for incremental pulls.",
    params: [
      { name: "updatedSince", in: "query", type: "ISO date-time", desc: "Only schools whose location changed after this time. Pass the generatedAt of your previous pull." },
      { name: "format", in: "query", type: "json | geojson", desc: "geojson returns a FeatureCollection of points." },
      { name: "status", in: "query", type: "active | inactive | under_renovation", desc: "Filter by status." },
      { name: "district", in: "query", type: "string", desc: "Filter by district name." },
      { name: "page", in: "query", type: "integer", desc: "Page number, from 1." },
      { name: "limit", in: "query", type: "1–1000", desc: "Rows per page (default 100)." },
    ],
    response: `{
  "data": [
    { "schoolCode": "280705", "rtbGisId": "f2df0307-…", "name": "Fr Ramon KABUGA TSS",
      "district": "Kamonyi", "sector": "Ngamba", "status": "active",
      "latitude": -1.88350, "longitude": 29.93790, "elevation": 1712.4,
      "source": "kmz", "quality": "surveyed", "updatedAt": "2026-11-12T10:40:00.000Z" }
  ],
  "page": { "current": 1, "limit": 100, "total": 375 },
  "generatedAt": "2026-11-12T11:00:00.000Z"
}`,
    tryQuery: "limit=5",
  },
  {
    id: "schools",
    method: "GET",
    path: "/partner/schools",
    title: "Schools",
    scope: "schools:read",
    desc: "Schools in RTB GIS with location quality, condition score and which views can be embedded.",
    params: [
      { name: "updatedSince", in: "query", type: "ISO date-time", desc: "Only schools changed after this time." },
      { name: "status", in: "query", type: "string", desc: "Filter by status." },
      { name: "district", in: "query", type: "string", desc: "Filter by district name." },
      { name: "page / limit", in: "query", type: "integer", desc: "Paging (limit 1–1000, default 100)." },
    ],
    response: `{ "data": [ {
    "schoolCode": "270501", "rtbGisId": "…", "name": "ACEJ KARAMA", "type": "TSS", "status": "active",
    "province": "Southern Province", "district": "Muhanga", "sector": "Muhanga",
    "latitude": -2.071518, "longitude": 29.726629, "coordinateQuality": "tdmp",
    "conditionScore": 62.4, "priority": "medium",
    "views": { "dashboard": true, "map2d": true, "imagery2d": false, "model3d": false }
  } ], "page": { "current": 1, "limit": 100, "total": 375 } }`,
    tryQuery: "limit=3",
  },
  {
    id: "school",
    method: "GET",
    path: "/partner/schools/{schoolCode}",
    title: "One school",
    scope: "schools:read",
    desc: "One school by its TDMP / SDMS code, with its campus boundary as GeoJSON when surveyed.",
    params: [{ name: "schoolCode", in: "path", type: "string", required: true, desc: "TDMP / SDMS school code, e.g. 280705." }],
    response: `{ "schoolCode": "280705", "name": "Fr Ramon KABUGA TSS", "latitude": -1.8835, "longitude": 29.9379,
  "coordinateQuality": "surveyed", "elevation": 1712.4,
  "boundaries": [ { "name": "Campus", "type": "campus", "areaSquareMeters": 41250.5,
                    "geojson": { "type": "Polygon", "coordinates": [ [ [29.9371, -1.8829], … ] ] } } ] }`,
  },
  {
    id: "embed-links",
    method: "POST",
    path: "/partner/embed-links",
    title: "Signed embed link",
    scope: "embed:create",
    desc: "A short-lived URL to a dashboard or map, to put in an iframe. Call it from your server for each page view; never expose the key to browsers.",
    params: [
      { name: "view", in: "body", type: "school-dashboard | school-map-2d | school-map-3d | national-map", required: true, desc: "Which view." },
      { name: "schoolCode", in: "body", type: "string", desc: "Required for school views. The viewer only sees this school." },
      { name: "province / district", in: "body", type: "string", desc: "National map only: limit it to one province or district." },
      { name: "ttlSeconds", in: "body", type: "60–3600", desc: "How long the link can be opened (default 300)." },
      { name: "sessionMinutes", in: "body", type: "5–480", desc: "How long the view stays open once loaded (default 120)." },
    ],
    body: { view: "school-dashboard", schoolCode: "280705" },
    response: `{
  "view": "school-dashboard",
  "url": "${ORIGIN}/embed/schools/f2df0307-…/dashboard#token=eyJhbGciOi…",
  "token": "eyJhbGciOi…",
  "expiresAt": "2026-11-12T11:05:00.000Z",
  "sessionMinutes": 120,
  "scope": { "tier": "school", "district": "Kamonyi", "schoolId": "f2df0307-…", "schoolName": "Fr Ramon KABUGA TSS" },
  "school": { "id": "f2df0307-…", "code": "280705", "name": "Fr Ramon KABUGA TSS" }
}`,
  },
];

const SECTIONS = [
  { id: "overview", label: "Overview", icon: BookOpen },
  { id: "auth", label: "Authentication", icon: KeyRound },
  { id: "endpoints", label: "Endpoints", icon: Code2 },
  { id: "embed", label: "Embedding views", icon: LayoutDashboard },
  { id: "coordinates", label: "Coordinates guide", icon: MapPin },
  { id: "errors", label: "Errors and limits", icon: TriangleAlert },
  { id: "security", label: "Security", icon: ShieldCheck },
] as const;

function Section({ id, title, icon: Icon, children }: { id: string; title: string; icon: typeof BookOpen; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      id={id}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.4 }}
      className="scroll-mt-20 space-y-4"
      aria-labelledby={`${id}-h`}
    >
      <h2 id={`${id}-h`} className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground">
        <Icon className="h-5 w-5 text-primary" aria-hidden /> {title}
      </h2>
      {children}
    </motion.section>
  );
}

const P = ({ children }: { children: ReactNode }) => <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>;
const C = ({ children }: { children: ReactNode }) => (
  <code className="rounded bg-slate-900/[0.06] px-1 py-0.5 font-mono text-[12px] text-foreground dark:bg-white/10">{children}</code>
);

function examplesFor(e: Endpoint): Record<string, string> {
  const url = `${BASE}${e.path.replace("{schoolCode}", "280705")}${e.tryQuery ? `?${e.tryQuery}` : ""}`;
  const body = e.body ? JSON.stringify(e.body, null, 2) : "";
  if (e.method === "GET")
    return {
      curl: `curl "${url}" \\\n  -H "Authorization: ApiKey $RTBGIS_KEY"`,
      "Node.js": `const res = await fetch("${url}", {\n  headers: { Authorization: \`ApiKey \${process.env.RTBGIS_KEY}\` },\n});\nconst data = await res.json();`,
      Python: `import os, requests\nr = requests.get("${url}",\n    headers={"Authorization": f"ApiKey {os.environ['RTBGIS_KEY']}"})\ndata = r.json()`,
    };
  return {
    curl: `curl -X POST "${url}" \\\n  -H "Authorization: ApiKey $RTBGIS_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(e.body)}'`,
    "Node.js": `const res = await fetch("${url}", {\n  method: "POST",\n  headers: {\n    Authorization: \`ApiKey \${process.env.RTBGIS_KEY}\`,\n    "Content-Type": "application/json",\n  },\n  body: JSON.stringify(${body.replace(/\n/g, "\n  ")}),\n});\nconst { url } = await res.json(); // put this in the iframe`,
    Python: `import os, requests\nr = requests.post("${url}",\n    headers={"Authorization": f"ApiKey {os.environ['RTBGIS_KEY']}"},\n    json=${JSON.stringify(e.body)})\niframe_url = r.json()["url"]`,
  };
}

/** Runs a request with a key typed here (kept in this tab's memory only). */
function TryIt({ endpoint, apiKey }: { endpoint: Endpoint; apiKey: string }) {
  const [query, setQuery] = useState(endpoint.tryQuery ?? "");
  const [code, setCode] = useState("280705");
  const [body, setBody] = useState(endpoint.body ? JSON.stringify(endpoint.body, null, 2) : "");
  const [result, setResult] = useState<{ status: number; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      const path = endpoint.path.replace("{schoolCode}", encodeURIComponent(code));
      const res = await fetch(`${BASE}${path}${query ? `?${query}` : ""}`, {
        method: endpoint.method,
        headers: { Authorization: `ApiKey ${apiKey}`, ...(endpoint.method === "POST" ? { "Content-Type": "application/json" } : {}) },
        body: endpoint.method === "POST" ? body : undefined,
      });
      const text = await res.text();
      let pretty = text;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        /* not JSON */
      }
      setResult({ status: res.status, text: pretty });
    } catch (err) {
      setResult({ status: 0, text: String(err) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2 rounded-2xl bg-primary/[0.04] p-3 ring-1 ring-inset ring-primary/15">
      <div className="flex flex-wrap items-center gap-2">
        {endpoint.path.includes("{schoolCode}") && (
          <input value={code} onChange={(e) => setCode(e.target.value)} aria-label="schoolCode" className="h-8 w-32 rounded-lg border border-border bg-background px-2 font-mono text-xs" />
        )}
        {endpoint.method === "GET" && (
          <input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Query string" placeholder="query, e.g. limit=5" className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 font-mono text-xs" />
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
      </div>
      {endpoint.method === "POST" && (
        <textarea value={body} onChange={(e) => setBody(e.target.value)} aria-label="Request body" rows={4} className="w-full rounded-lg border border-border bg-background p-2 font-mono text-xs" />
      )}
      {result && <Code code={result.text} label={`HTTP ${result.status || "error"}`} />}
    </div>
  );
}

/** Builds an iframe for a view, live, with the key typed on this page. */
function EmbedBuilder({ apiKey }: { apiKey: string }) {
  const [view, setView] = useState("school-dashboard");
  const [code, setCode] = useState("280705");
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const school = view !== "national-map";
  const snippet = `<iframe
  src="{url from POST /partner/embed-links}"
  title="RTB 3D GIS — ${view}"
  style="width:100%;height:720px;border:0;border-radius:16px"
  allow="fullscreen; clipboard-write"
  referrerpolicy="no-referrer"
></iframe>`;
  const preview = async () => {
    setError(null);
    setUrl(null);
    const res = await fetch(`${BASE}/partner/embed-links`, {
      method: "POST",
      headers: { Authorization: `ApiKey ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(school ? { view, schoolCode: code } : { view }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data?.message ?? `HTTP ${res.status}`);
    else setUrl(data.url);
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1 text-xs text-muted-foreground">
          View
          <select value={view} onChange={(e) => setView(e.target.value)} className="block h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground">
            <option value="school-dashboard">School dashboard</option>
            <option value="school-map-2d">School map (2D)</option>
            <option value="school-map-3d">School model (3D)</option>
            <option value="national-map">National map</option>
          </select>
        </label>
        {school && (
          <label className="space-y-1 text-xs text-muted-foreground">
            School code
            <input value={code} onChange={(e) => setCode(e.target.value)} className="block h-9 w-32 rounded-lg border border-border bg-background px-2 font-mono text-sm text-foreground" />
          </label>
        )}
        <button
          type="button"
          onClick={() => void preview()}
          disabled={!apiKey}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          data-tooltip={apiKey ? "Mint a real link and show the view below" : "Enter your partner key at the top of the page first"}
        >
          <Play className="h-4 w-4" aria-hidden /> Preview
        </button>
      </div>
      <Code code={snippet} label="HTML" />
      {error && <p className="text-sm text-destructive">{error}</p>}
      {url && (
        <iframe src={url} title={`Preview: ${view}`} className="h-[560px] w-full rounded-2xl border-0 ring-1 ring-border" allow="fullscreen" referrerPolicy="no-referrer" />
      )}
    </div>
  );
}

/** /developers — the RTB 3D GIS partner API guide (for TDMP and other platforms). */
export default function Developers() {
  const [apiKey, setApiKey] = useState("");
  const [active, setActive] = useState<string>("overview");
  const flow = useMemo(
    () => [
      { icon: KeyRound, title: "Get a key", text: "An RTB GIS admin creates a partner key (TDMP integration page ▸ Partner access)." },
      { icon: MapPin, title: "Read data", text: "Pull schools and coordinates from your server, daily or incrementally." },
      { icon: Globe2, title: "Embed views", text: "Mint a signed link per page view and put it in an iframe." },
    ],
    [],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground" aria-hidden>
              <Code2 className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">RTB 3D GIS — Partner API</h1>
              <p className="text-xs text-muted-foreground">For TDMP and other platforms · v1 · base URL <C>{BASE}</C></p>
            </div>
          </div>
          <label className="flex w-full items-center gap-2 sm:w-auto">
            <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value.trim())}
              placeholder="Partner key, to try requests (kept in this tab only)"
              aria-label="Partner key for trying requests"
              autoComplete="off"
              className="h-9 w-full rounded-full border border-border bg-background px-3 text-sm sm:w-80"
            />
          </label>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="Sections" className="lg:sticky lg:top-6 lg:self-start">
          <ul className="flex gap-1 overflow-x-auto lg:flex-col">
            {SECTIONS.map((s) => (
              <li key={s.id} className="shrink-0">
                <a
                  href={`#${s.id}`}
                  onClick={() => setActive(s.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors",
                    active === s.id ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-slate-900/[0.04] hover:text-foreground dark:hover:bg-white/[0.05]",
                  )}
                >
                  <s.icon className="h-4 w-4" aria-hidden /> {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 space-y-14">
          <Section id="overview" title="Overview" icon={BookOpen}>
            <P>
              RTB 3D GIS shares two things with partner platforms: <strong className="text-foreground">school data</strong> (locations it surveys,
              boundaries, condition score) through a read-only API, and <strong className="text-foreground">live views</strong> (school
              dashboard, 2D map, 3D model, national map) you can embed. Everything is read-only: partners never change RTB GIS data.
            </P>
            <ol className="grid gap-3 sm:grid-cols-3">
              {flow.map((f, i) => (
                <motion.li
                  key={f.title}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="rounded-2xl bg-slate-900/[0.03] p-4 ring-1 ring-inset ring-slate-900/5 dark:bg-white/[0.035] dark:ring-white/8"
                >
                  <span className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] text-primary-foreground">{i + 1}</span>
                    <f.icon className="h-4 w-4 text-primary" aria-hidden /> {f.title}
                  </span>
                  <span className="text-xs leading-relaxed text-muted-foreground">{f.text}</span>
                </motion.li>
              ))}
            </ol>
          </Section>

          <Section id="auth" title="Authentication" icon={KeyRound}>
            <P>
              Every partner request carries a partner key, created by an RTB GIS administrator and shown once. Send it in either header:
            </P>
            <Code code={`Authorization: ApiKey rtbgis_pk_…\n# or\nX-API-Key: rtbgis_pk_…`} label="Headers" />
            <div className="overflow-x-auto rounded-2xl ring-1 ring-border">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/[0.03] text-left text-xs text-muted-foreground dark:bg-white/[0.04]">
                  <tr>
                    <th className="px-3 py-2">Scope</th>
                    <th className="px-3 py-2">Allows</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  <tr><td className="px-3 py-2"><C>schools:read</C></td><td className="px-3 py-2 text-muted-foreground">School list and one school with boundary</td></tr>
                  <tr><td className="px-3 py-2"><C>coordinates:read</C></td><td className="px-3 py-2 text-muted-foreground">The coordinates feed</td></tr>
                  <tr><td className="px-3 py-2"><C>embed:create</C></td><td className="px-3 py-2 text-muted-foreground">Signed embed links to dashboards and maps</td></tr>
                </tbody>
              </table>
            </div>
            <P>Keep the key on your server. Never put it in a web page, a mobile app or a URL.</P>
          </Section>

          <Section id="endpoints" title="Endpoints" icon={Code2}>
            <P>All responses are JSON (UTF-8). Times are ISO 8601 in UTC. Coordinates are WGS84 decimal degrees.</P>
            <div className="space-y-6">
              {ENDPOINTS.map((e) => (
                <article key={e.id} id={`ep-${e.id}`} className="space-y-3 rounded-[1.5rem] p-4 ring-1 ring-border sm:p-5">
                  <header className="flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-md px-2 py-0.5 font-mono text-xs font-semibold", METHOD_TONE[e.method])}>{e.method}</span>
                    <code className="break-all font-mono text-sm text-foreground">{e.path}</code>
                    {e.scope && <span className="rounded-full bg-slate-900/[0.05] px-2 py-0.5 text-[11px] text-muted-foreground dark:bg-white/10">{e.scope}</span>}
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
                              <td className="px-3 py-2 align-top text-muted-foreground">{p.desc}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="grid gap-3 xl:grid-cols-2">
                    <CodeTabs examples={examplesFor(e)} />
                    <Code code={e.response} label="Response 200 (example)" />
                  </div>
                  <TryIt endpoint={e} apiKey={apiKey} />
                </article>
              ))}
            </div>
          </Section>

          <Section id="embed" title="Embedding views" icon={LayoutDashboard}>
            <P>
              Each view needs a fresh signed link, minted by <strong className="text-foreground">your server</strong> with{" "}
              <C>POST /partner/embed-links</C> when your page renders. The link opens a read-only session limited to that school (or area) for
              the session length you chose. When it ends, the view asks the user to reload.
            </P>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { icon: LayoutDashboard, t: "school-dashboard", d: "Condition score, priorities, facilities, enrolment and reports." },
                { icon: Map, t: "school-map-2d", d: "Site map with drone imagery and buildings." },
                { icon: Globe2, t: "school-map-3d", d: "The 3D model with measuring tools (nothing saved)." },
                { icon: MapPin, t: "national-map", d: "All schools; optionally one province or district." },
              ].map((v) => (
                <div key={v.t} className="rounded-2xl bg-slate-900/[0.03] p-3 ring-1 ring-inset ring-slate-900/5 dark:bg-white/[0.035] dark:ring-white/8">
                  <v.icon className="mb-1.5 h-4 w-4 text-primary" aria-hidden />
                  <C>{v.t}</C>
                  <p className="mt-1 text-xs text-muted-foreground">{v.d}</p>
                </div>
              ))}
            </div>
            <EmbedBuilder apiKey={apiKey} />
            <P>
              People who already have an RTB GIS account can also open <C>/embed/schools/&#123;id&#125;/dashboard</C> (and the map views)
              directly: they then see it with their own role and area.
            </P>
          </Section>

          <Section id="coordinates" title="Coordinates guide (for TDMP)" icon={MapPin}>
            <P>
              RTB GIS owns school locations: they come from drone surveys (KMZ site maps, 3D models) or from GIS staff. This is how TDMP keeps its{" "}
              <C>gpsLat</C> / <C>gpsLong</C> in line with them.
            </P>
            <ol className="space-y-3">
              {[
                ["First load", <>Page through <C>GET /partner/schools/coordinates?limit=1000</C> and keep <C>generatedAt</C>.</>],
                ["Match", <>Each row's <C>schoolCode</C> is the TDMP / SDMS school code.</>],
                ["Choose what to trust", <>Update your GPS when <C>quality</C> is <C>surveyed</C> or <C>manual</C>. Skip <C>tdmp</C> (that point came from you) and <C>unverified</C>.</>],
                ["Validate", <>Accept points inside Rwanda only (latitude −2.95 to −0.95, longitude 28.75 to 31.0).</>],
                ["Stay current", <>Once a day (after 07:30 Kigali), call again with <C>updatedSince=&lt;previous generatedAt&gt;</C>; only changed schools come back.</>],
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
              examples={{
                "Node.js": `// Daily job on the TDMP server
const BASE = "${BASE}";
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
    await db.schools.update({ schoolCode: s.schoolCode }, { gpsLat: s.latitude, gpsLong: s.longitude });
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
            db.update_school_gps(s["schoolCode"], s["latitude"], s["longitude"])
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

          <Section id="errors" title="Errors and limits" icon={TriangleAlert}>
            <div className="overflow-x-auto rounded-2xl ring-1 ring-border">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/[0.03] text-left text-xs text-muted-foreground dark:bg-white/[0.04]">
                  <tr>
                    <th className="px-3 py-2">HTTP</th>
                    <th className="px-3 py-2">code</th>
                    <th className="px-3 py-2">Meaning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-muted-foreground">
                  {[
                    ["401", "PARTNER_KEY_INVALID", "Key missing, unknown or revoked."],
                    ["403", "PARTNER_SCOPE_MISSING", "The key lacks the scope for this route."],
                    ["400", "—", "A parameter is wrong (the message says which)."],
                    ["404", "—", "No school with that code in RTB GIS."],
                    ["429", "—", "More than 120 requests a minute from one client: wait and retry."],
                    ["401", "EMBED_LINK_INVALID / EMBED_LINK_REVOKED", "Shown inside the iframe: the link expired or its key was revoked."],
                  ].map(([h, c, m]) => (
                    <tr key={h + c}>
                      <td className="px-3 py-2 font-mono text-xs">{h}</td>
                      <td className="px-3 py-2"><C>{c}</C></td>
                      <td className="px-3 py-2">{m}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Code code={`{ "statusCode": 401, "code": "PARTNER_KEY_INVALID", "message": "Missing, unknown or revoked partner API key." }`} label="Error body" />
          </Section>

          <Section id="security" title="Security" icon={ShieldCheck}>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              <li>Keys are stored hashed on our side and can be revoked at any time; revoking also ends every open embedded view made with that key.</li>
              <li>Embed links are signed, expire in minutes, and carry their token in the URL fragment (never sent to servers or in Referer headers).</li>
              <li>Embedded views are read-only and limited to the school or area in the link; every view is recorded in our audit trail.</li>
              <li>Only the sites registered with your key may frame RTB GIS views (Content-Security-Policy frame-ancestors).</li>
              <li>The coordinates feed contains school locations only: no personal data.</li>
            </ul>
          </Section>
        </main>
      </div>
    </div>
  );
}
