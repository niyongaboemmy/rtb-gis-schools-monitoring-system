import { BookOpen, ChefHat, Code2, KeyRound, LayoutDashboard, MapPin, ShieldCheck, TriangleAlert } from "lucide-react";
import type { Lang } from "./lang";

export const ORIGIN = typeof window !== "undefined" ? window.location.origin : "https://rtb.aerovyntech.com";
export const BASE = `${ORIGIN}/api/v1`;

export interface Param {
  name: string;
  in: "query" | "path" | "body";
  type: string;
  required?: boolean;
  desc: string;
  /** A value "Try it" can fill in with one click. */
  example?: string;
}

export interface Endpoint {
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

export const ENDPOINTS: Endpoint[] = [
  {
    id: "ping",
    method: "GET",
    path: "/partner/ping",
    title: "Check your key",
    desc: "Returns the partner, the key's scopes and its access level. Call it when your service starts to verify the setup.",
    response: `{ "access": { "tier": "district", "province": "Southern Province", "district": "Muhanga",
              "views": ["school-dashboard", "school-map-2d"], "summary": "Muhanga district" },
  "partner": "TDMP", "keyName": "TDMP production", "keyPrefix": "rtbgis_pk_3f9a1c",
  "scopes": ["schools:read", "embed:create"], "time": "2026-11-12T10:00:00.000Z" }`,
  },
  {
    id: "schools",
    method: "GET",
    path: "/partner/schools",
    title: "Schools",
    scope: "schools:read",
    desc: "Schools within your key's access, with location quality, condition score, priority and which views can be embedded for each.",
    params: [
      { name: "updatedSince", in: "query", type: "ISO date-time", desc: "Only schools changed after this time.", example: "2026-11-01T00:00:00Z" },
      { name: "status", in: "query", type: "active | inactive | under_renovation", desc: "Filter by status.", example: "active" },
      { name: "district", in: "query", type: "string", desc: "Filter by district name.", example: "Muhanga" },
      { name: "page", in: "query", type: "integer", desc: "Page number, from 1.", example: "1" },
      { name: "limit", in: "query", type: "1–1000", desc: "Rows per page (default 100).", example: "5" },
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
    desc: "One school by its TDMP / SDMS code, with its campus boundary as GeoJSON when surveyed. A school outside your access answers 404.",
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
    desc: "A short-lived URL to one dashboard or map, to put in an iframe. Call it from your server for each page view; never expose the key to browsers.",
    params: [
      { name: "view", in: "body", type: "school-dashboard | school-map-2d | school-map-3d | national-map | national-dashboard", required: true, desc: "Which view. The link opens that view only." },
      { name: "schoolCode", in: "body", type: "string", desc: "Required for school views. The viewer only sees this school." },
      { name: "province / district", in: "body", type: "string", desc: "National map / dashboard only: narrow it to one province or district (never wider than the key)." },
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
  {
    id: "coordinates",
    method: "GET",
    path: "/partner/schools/coordinates",
    title: "School coordinates",
    scope: "coordinates:read",
    desc: "Each school's point (WGS84) with its source and quality, ordered by last location change. Only for keys given the coordinates scope.",
    params: [
      { name: "updatedSince", in: "query", type: "ISO date-time", desc: "Only schools whose location changed after this time. Pass the generatedAt of your previous pull.", example: "2026-11-01T00:00:00Z" },
      { name: "format", in: "query", type: "json | geojson", desc: "geojson returns a FeatureCollection of points.", example: "geojson" },
      { name: "district", in: "query", type: "string", desc: "Filter by district name.", example: "Kamonyi" },
      { name: "limit", in: "query", type: "1–1000", desc: "Rows per page (default 100).", example: "5" },
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
];

export const SECTIONS = [
  { id: "overview", label: "Overview", icon: BookOpen },
  { id: "auth", label: "Authentication", icon: KeyRound },
  { id: "endpoints", label: "Endpoints", icon: Code2 },
  { id: "embed", label: "Embedding views", icon: LayoutDashboard },
  { id: "recipes", label: "Recipes", icon: ChefHat },
  { id: "coordinates", label: "Coordinates feed", icon: MapPin },
  { id: "errors", label: "Errors and limits", icon: TriangleAlert },
  { id: "security", label: "Security", icon: ShieldCheck },
] as const;

const keyEnv = { "Node.js": "process.env.RTBGIS_KEY", Python: "os.environ['RTBGIS_KEY']", PHP: "getenv('RTBGIS_KEY')" };

/** The request in every language, with a query string and body. */
export function examplesFor(e: Endpoint, opts: { query?: string; code?: string; body?: unknown } = {}): Record<Lang, string> {
  const path = e.path.replace("{schoolCode}", opts.code ?? "280705");
  const query = opts.query ?? e.tryQuery ?? "";
  const url = `${BASE}${path}${query ? `?${query}` : ""}`;
  const bodyObj = opts.body ?? e.body;
  const json = bodyObj ? JSON.stringify(bodyObj) : "";
  if (e.method === "GET")
    return {
      curl: `curl "${url}" \\\n  -H "Authorization: ApiKey $RTBGIS_KEY"`,
      "Node.js": `const res = await fetch("${url}", {\n  headers: { Authorization: \`ApiKey \${${keyEnv["Node.js"]}}\` },\n});\nif (!res.ok) throw new Error(\`RTB GIS answered \${res.status}\`);\nconst data = await res.json();`,
      Python: `import os, requests\n\nr = requests.get(\n    "${url}",\n    headers={"Authorization": f"ApiKey {${keyEnv.Python}}"},\n    timeout=30,\n)\nr.raise_for_status()\ndata = r.json()`,
      PHP: `<?php\n$ch = curl_init("${url}");\ncurl_setopt_array($ch, [\n    CURLOPT_HTTPHEADER => ["Authorization: ApiKey " . ${keyEnv.PHP}],\n    CURLOPT_RETURNTRANSFER => true,\n]);\n$data = json_decode(curl_exec($ch), true);`,
    };
  return {
    curl: `curl -X POST "${url}" \\\n  -H "Authorization: ApiKey $RTBGIS_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '${json}'`,
    "Node.js": `const res = await fetch("${url}", {\n  method: "POST",\n  headers: {\n    Authorization: \`ApiKey \${${keyEnv["Node.js"]}}\`,\n    "Content-Type": "application/json",\n  },\n  body: JSON.stringify(${json}),\n});\nconst { url } = await res.json(); // put this in the iframe`,
    Python: `import os, requests\n\nr = requests.post(\n    "${url}",\n    headers={"Authorization": f"ApiKey {${keyEnv.Python}}"},\n    json=${json.replace(/\btrue\b/g, "True").replace(/\bfalse\b/g, "False").replace(/\bnull\b/g, "None")},\n    timeout=30,\n)\niframe_url = r.json()["url"]`,
    PHP: `<?php\n$ch = curl_init("${url}");\ncurl_setopt_array($ch, [\n    CURLOPT_POST => true,\n    CURLOPT_HTTPHEADER => [\n        "Authorization: ApiKey " . ${keyEnv.PHP},\n        "Content-Type: application/json",\n    ],\n    CURLOPT_POSTFIELDS => '${json}',\n    CURLOPT_RETURNTRANSFER => true,\n]);\n$iframeUrl = json_decode(curl_exec($ch), true)["url"];`,
  };
}

export interface Recipe {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  examples: Partial<Record<Lang, string>>;
}

export const RECIPES: Recipe[] = [
  {
    id: "recipe-school-page",
    title: "Show a school's dashboard on your school page",
    summary: "Mint a link on the server while rendering the page, then drop it in an iframe. A fresh link per page view; the key never reaches the browser.",
    tags: ["embed", "server-side"],
    examples: {
      "Node.js": `// Express route on your server
app.get("/schools/:code", async (req, res) => {
  const r = await fetch("${BASE}/partner/embed-links", {
    method: "POST",
    headers: {
      Authorization: \`ApiKey \${process.env.RTBGIS_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ view: "school-dashboard", schoolCode: req.params.code, sessionMinutes: 120 }),
  });
  if (r.status === 404) return res.status(404).send("School not in RTB GIS");
  const { url } = await r.json();
  res.render("school", { code: req.params.code, rtbGisUrl: url });
});

// school.ejs
// <iframe src="<%= rtbGisUrl %>" style="width:100%;height:720px;border:0"
//         allow="fullscreen" referrerpolicy="no-referrer"></iframe>`,
      Python: `# Flask view on your server
@app.get("/schools/<code>")
def school_page(code):
    r = requests.post(
        "${BASE}/partner/embed-links",
        headers={"Authorization": f"ApiKey {os.environ['RTBGIS_KEY']}"},
        json={"view": "school-dashboard", "schoolCode": code, "sessionMinutes": 120},
        timeout=10,
    )
    if r.status_code == 404:
        abort(404)
    return render_template("school.html", code=code, rtbgis_url=r.json()["url"])

# school.html
# <iframe src="{{ rtbgis_url }}" style="width:100%;height:720px;border:0"
#         allow="fullscreen" referrerpolicy="no-referrer"></iframe>`,
      PHP: `<?php
// school.php?code=280705
$ch = curl_init("${BASE}/partner/embed-links");
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ["Authorization: ApiKey " . getenv('RTBGIS_KEY'), "Content-Type: application/json"],
    CURLOPT_POSTFIELDS => json_encode(["view" => "school-dashboard", "schoolCode" => $_GET["code"]]),
    CURLOPT_RETURNTRANSFER => true,
]);
$link = json_decode(curl_exec($ch), true);
?>
<iframe src="<?= htmlspecialchars($link["url"]) ?>" style="width:100%;height:720px;border:0"
        allow="fullscreen" referrerpolicy="no-referrer"></iframe>`,
    },
  },
  {
    id: "recipe-spa",
    title: "Single-page app: fetch the link when the panel opens",
    summary: "React, Vue or Angular front ends call a small endpoint on your own backend, which mints the link. The browser only ever sees the signed URL.",
    tags: ["embed", "SPA"],
    examples: {
      "Node.js": `// 1) Your backend: POST /api/rtbgis-link  { view, schoolCode?, district? }
app.post("/api/rtbgis-link", requireLogin, async (req, res) => {
  const r = await fetch("${BASE}/partner/embed-links", {
    method: "POST",
    headers: { Authorization: \`ApiKey \${process.env.RTBGIS_KEY}\`, "Content-Type": "application/json" },
    body: JSON.stringify(req.body),
  });
  res.status(r.status).json(await r.json());
});

// 2) Your React component
function RtbGisView({ view, schoolCode }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    fetch("/api/rtbgis-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ view, schoolCode }),
    }).then((r) => r.json()).then((d) => setUrl(d.url));
  }, [view, schoolCode]); // a new link each time the panel opens
  return url ? <iframe src={url} title="RTB 3D GIS" style={{ width: "100%", height: 720, border: 0 }} /> : <p>Loading…</p>;
}`,
    },
  },
  {
    id: "recipe-area",
    title: "National dashboard for a district officer",
    summary: "Narrow a national view to the signed-in user's district. RTB GIS never lets it go wider than your key, and the response's scope says what the link covers.",
    tags: ["embed", "access level"],
    examples: {
      curl: `curl -X POST "${BASE}/partner/embed-links" \\
  -H "Authorization: ApiKey $RTBGIS_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "view": "national-dashboard", "district": "Muhanga" }'

# 201 → { "url": "…/embed/dashboard#token=…",
#         "scope": { "tier": "district", "province": "Southern Province", "district": "Muhanga" } }
# 403 PARTNER_ACCESS_DENIED → the district is outside your key's access`,
      "Node.js": `const body = { view: "national-dashboard" };
if (user.district) body.district = user.district;      // from your own user profile
else if (user.province) body.province = user.province;

const r = await fetch("${BASE}/partner/embed-links", {
  method: "POST",
  headers: { Authorization: \`ApiKey \${process.env.RTBGIS_KEY}\`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const link = await r.json();
if (r.status === 403) throw new Error(link.message);   // wider than the key
console.log("covers", link.scope);                     // { tier: "district", province, district }`,
      Python: `body = {"view": "national-dashboard"}
if user.district:
    body["district"] = user.district
elif user.province:
    body["province"] = user.province

r = requests.post("${BASE}/partner/embed-links",
                  headers={"Authorization": f"ApiKey {os.environ['RTBGIS_KEY']}"}, json=body, timeout=10)
if r.status_code == 403:
    raise PermissionError(r.json()["message"])  # wider than the key
link = r.json()  # link["scope"] says what it covers`,
    },
  },
  {
    id: "recipe-all-schools",
    title: "Page through every school, with retries",
    summary: "Read the whole list 1000 rows at a time and back off politely on 429 or a network hiccup.",
    tags: ["data", "pagination", "retries"],
    examples: {
      "Node.js": `async function getJson(url, tries = 5) {
  for (let i = 0; ; i++) {
    const res = await fetch(url, { headers: { Authorization: \`ApiKey \${process.env.RTBGIS_KEY}\` } });
    if (res.ok) return res.json();
    if ((res.status === 429 || res.status >= 500) && i < tries) {
      await new Promise((r) => setTimeout(r, 2 ** i * 1000)); // 1s, 2s, 4s…
      continue;
    }
    throw new Error(\`RTB GIS answered \${res.status}\`);
  }
}

const schools = [];
for (let page = 1; ; page++) {
  const body = await getJson(\`${BASE}/partner/schools?limit=1000&page=\${page}\`);
  schools.push(...body.data);
  if (page * body.page.limit >= body.page.total) break;
}`,
      Python: `import os, time, requests

S = requests.Session()
S.headers["Authorization"] = f"ApiKey {os.environ['RTBGIS_KEY']}"

def get_json(url, params, tries=5):
    for i in range(tries + 1):
        r = S.get(url, params=params, timeout=30)
        if r.ok:
            return r.json()
        if r.status_code in (429, 500, 502, 503, 504) and i < tries:
            time.sleep(2 ** i)  # 1s, 2s, 4s…
            continue
        r.raise_for_status()

schools, page = [], 1
while True:
    body = get_json("${BASE}/partner/schools", {"limit": 1000, "page": page})
    schools += body["data"]
    if page * body["page"]["limit"] >= body["page"]["total"]:
        break
    page += 1`,
    },
  },
  {
    id: "recipe-startup",
    title: "Check the key when your service starts",
    summary: "Fail fast on a revoked or mis-copied key, and log what it may reach.",
    tags: ["setup"],
    examples: {
      "Node.js": `const r = await fetch("${BASE}/partner/ping", {
  headers: { Authorization: \`ApiKey \${process.env.RTBGIS_KEY}\` },
});
if (!r.ok) throw new Error(\`RTB GIS key rejected (\${r.status}): check RTBGIS_KEY\`);
const me = await r.json();
console.info(\`RTB GIS: \${me.partner} · \${me.access.summary} · views: \${me.access.views.join(", ")}\`);`,
      Python: `r = requests.get("${BASE}/partner/ping",
                 headers={"Authorization": f"ApiKey {os.environ['RTBGIS_KEY']}"}, timeout=10)
if not r.ok:
    raise SystemExit(f"RTB GIS key rejected ({r.status_code}): check RTBGIS_KEY")
me = r.json()
log.info("RTB GIS: %s · %s · views: %s", me["partner"], me["access"]["summary"], ", ".join(me["access"]["views"]))`,
    },
  },
];

export const ERRORS: { http: string; code: string; meaning: string; fix: string }[] = [
  { http: "401", code: "PARTNER_KEY_INVALID", meaning: "Key missing, unknown or revoked.", fix: "Send Authorization: ApiKey <key>. If it was revoked, ask the RTB GIS team for a new key." },
  { http: "403", code: "PARTNER_SCOPE_MISSING", meaning: "The key lacks the scope for this route.", fix: "GET /partner/ping lists your scopes. Ask RTB GIS to add the one you need." },
  { http: "403", code: "PARTNER_ACCESS_DENIED", meaning: "Outside the key's access level: a wider area, or a view the key may not open.", fix: "Ask for the key's own area or narrower (ping shows it), or a view in access.views." },
  { http: "400", code: "—", meaning: "A parameter is wrong or unknown (the message says which).", fix: "Check the parameter table of the endpoint; unknown districts and provinces are rejected." },
  { http: "404", code: "—", meaning: "No school with that code within your access.", fix: "Use the TDMP / SDMS code. A school outside your access looks the same as a missing one." },
  { http: "429", code: "—", meaning: "More than 120 requests a minute from one client.", fix: "Back off and retry (1 s, 2 s, 4 s…). See the paging recipe." },
  { http: "401", code: "EMBED_LINK_INVALID / EMBED_LINK_REVOKED", meaning: "Shown inside the iframe: the link expired or its key was revoked.", fix: "Mint a new link per page view; links can only be opened for ttlSeconds." },
  { http: "403", code: "EMBED_VIEW_DENIED", meaning: "An embedded view asked for data that belongs to another view.", fix: "Expected: one link opens one view. Mint a link for the other view." },
];
