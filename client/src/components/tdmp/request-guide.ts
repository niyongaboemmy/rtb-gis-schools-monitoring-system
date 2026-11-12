/**
 * What each request to the TDMP team means, written for the TDMP team:
 * why we need it, exactly what to do, a concrete example, and what it turns
 * on in RTB GIS. Mirrors docs/TDMP_INTEGRATION_REQUESTS.md (R1–R13).
 */
export interface RequestGuide {
  /** One line, plain language. */
  summary: string;
  why: string;
  /** Steps for the TDMP team, in order. */
  ask: string[];
  example: { label: string; lang: "http" | "json" | "text"; code: string };
  /** What goes live in RTB GIS when it is done. */
  unlocks: string[];
  /** How RTB GIS notices it is done. */
  check: string;
}

export const REQUEST_GUIDE: Record<string, RequestGuide> = {
  R1: {
    summary: "Let our partner key read five school-level reports.",
    why: "Learner and teacher gender splits, learners per programme and programme names make the enrolment and staffing figures complete. Our key gets 403 on these routes, although the TDMP docs list them for external_api_consumer.",
    ask: [
      "Give the RTB 3D GIS service account read access to the five routes below (school-level aggregates only).",
      "Keep /students and /teachers closed to us: we never need learner or teacher records.",
      "If a report cannot filter by school, a small /schools/{code}/staff-summary route is enough.",
    ],
    example: {
      label: "A call that should return 200 instead of 403 (illustrative values)",
      lang: "http",
      code: `GET /api/v1/reports/trades/students?schoolId=292
Authorization: ApiKey fortress_sk_…

200 OK
{ "data": [ { "tradeCode": "SOD", "tradeName": "Software Development",
              "total": 312, "breakdown": { "byGender": { "Male": 201, "Female": 111 } } } ] }`,
    },
    unlocks: ["Learners per programme", "Learners by gender", "Teachers by gender", "Admin and support staff", "Programme names"],
    check: "We call the five routes with our key on every connection test. Each one that answers 200 turns green here.",
  },
  R2: {
    summary: "Approved seats per programme, per school.",
    why: "Capacity tells planners whether a programme is full or under-used. It feeds the population-pressure part of the school condition score. We could not find it anywhere in the TDMP API.",
    ask: [
      "Tell us whether TDMP or SDMS holds approved seats per programme for the current academic year.",
      "If it does, add it to the programme rows (or a new route) as shown below.",
    ],
    example: {
      label: "A shape that would work (illustrative values)",
      lang: "http",
      code: `GET /api/v1/schools/270501/programmes

200 OK
[ { "tradeCode": "SOD", "tradeName": "Software Development", "level": "L5",
    "learners": 120, "capacity": 140, "academicYear": "2026/2027" } ]`,
    },
    unlocks: ["Seat capacity", "Capacity utilisation on dashboards"],
    check: "Marked done once the capacity field appears in a TDMP response we read.",
  },
  R3: {
    summary: "Three more fields on each /schools list row.",
    why: "Today we need an extra call per school for the year established, and the TSS / VTC band is only a filter. 64 of the 375 schools we sync are in neither band.",
    ask: [
      "Return categoryBand, establishmentDate and updatedAt on every /schools list row.",
      "Tell us what the 64 schools in neither band are (integrated, short courses…).",
      "Optional: headTeacherName for the school contact card.",
    ],
    example: {
      label: "One list row with the extra fields",
      lang: "json",
      code: `{ "schoolCode": "270501", "schoolName": "ACEJ KARAMA",
  "categoryBand": "TSS",
  "establishmentDate": "1984-09-01",
  "updatedAt": "2026-11-12T06:00:34+02:00" }`,
    },
    unlocks: ["Type for all schools", "Faster sync (no per-school calls)"],
    check: "We read the first 100 rows on every connection test and look for the three fields.",
  },
  R4: {
    summary: "Clean placeholder values and confirm two rules.",
    why: "Some rows carry placeholders or test data. We treat them as unknown, but clean data at the source helps every system that reads TDMP.",
    ask: [
      "Replace \"unfetched\" values (22 schools) with real values or null.",
      "Use one spelling per status (PRIVATE, not Private).",
      "Hide test rows (access_scope_test, manual_seed) from partner keys.",
      "Is 130613 the same school as 120940 (Kigali Excellent Tourism and Hospitality Academy)?",
      "Confirm: a schoolCode is never re-used, and INACTIVE means closed.",
    ],
    example: {
      label: "Before → after",
      lang: "json",
      code: `// before
{ "schoolCode": "57PC", "schoolCategory": "unfetched", "isActive": "unfetched" }
{ "schoolCode": "121103", "schoolStatus": "Private" }
// after
{ "schoolCode": "57PC", "schoolCategory": "TVET", "isActive": "ACTIVE" }
{ "schoolCode": "121103", "schoolStatus": "PRIVATE" }`,
    },
    unlocks: ["Complete school status", "No duplicate schools"],
    check: "We count \"unfetched\" schools and mixed-case statuses on every connection test.",
  },
  R5: {
    summary: "Optional: tell us when school data changes.",
    why: "We already check TDMP's data time regularly, so this is a nice-to-have. A change feed would let us sync within minutes and skip unchanged schools entirely.",
    ask: [
      "Either support ?updatedSince=<ISO time> on /schools,",
      "or call a webhook of ours after each re-materialisation.",
      "Confirm the daily refresh time (we observe about 06:00 Kigali).",
    ],
    example: {
      label: "Incremental read",
      lang: "http",
      code: `GET /api/v1/schools?categoryGroup=TVET&updatedSince=2026-11-12T06:00:00%2B02:00

200 OK
{ "data": [ /* only schools changed since then */ ], "meta": { "page": { "total": 3 } } }`,
    },
    unlocks: ["Near real-time updates"],
    check: "To confirm with TDMP: we cannot detect a webhook from here.",
  },
  R6: {
    summary: "Register RTB 3D GIS as an OAuth client for single sign-on.",
    why: "With a client, anyone signed in to TDMP opens RTB 3D GIS without signing in again, with the right role and area. Everything on our side is built and tested.",
    ask: [
      "Create a confidential client with the body below and send clientId / clientSecret over a secure channel.",
      "Mark it first-party, so the consent screen is skipped.",
      "Support prompt=none (straight back when the user already has a TDMP session).",
      "Tell us token lifetimes, and add an end-session endpoint if you can.",
    ],
    example: {
      label: "POST /api/v1/oauth/clients",
      lang: "json",
      code: `{
  "name": "RTB 3D GIS",
  "redirectUris": [
    "https://rtb.aerovyntech.com/api/v1/auth/tdmp/callback",
    "http://localhost:5173/api/v1/auth/tdmp/callback"
  ],
  "grantTypes": ["authorization_code", "refresh_token"]
}`,
    },
    unlocks: ["Sign in with TDMP", "No second login"],
    check: "Partly done when the client id / secret are on our server; done once TDMP also advertises prompt=none.",
  },
  R7: {
    summary: "Which TDMP roles may open RTB 3D GIS.",
    why: "Each TDMP role must map to one of our roles. Roles we don't know are refused, so we need the list before sign-on can open.",
    ask: [
      "Send the TDMP role names (e.g. from GET /iam/roles).",
      "Confirm or correct the mapping below.",
    ],
    example: {
      label: "Draft mapping",
      lang: "text",
      code: `RTB HQ administrator        → admin             (national)
RTB planner / M&E officer   → viewer            (national)
District education officer  → district_officer  (own district)
School manager / head       → school_leader     (own school)
anything else               → no access`,
    },
    unlocks: ["Right role at sign-in"],
    check: "Done once at least one RTB GIS role is mapped to a TDMP role (Settings ▸ Roles).",
  },
  R8: {
    summary: "Say which province, district or school a user covers.",
    why: "access-scope gives the kind of scope but not its unit. Without it we cannot place a district officer, so we refuse them rather than show too much.",
    ask: [
      "Add the unit names and ids to GET /auth/me/access-scope, as below.",
      "Ideally, also send roles and scope as id_token claims.",
    ],
    example: {
      label: "GET /api/v1/auth/me/access-scope",
      lang: "json",
      code: `"accessScope": {
  "kind": "district",
  "provinceId": 2, "provinceName": "Southern Province",
  "districtId": 14, "districtName": "Muhanga",
  "schoolCode": null
}`,
    },
    unlocks: ["District and province users can sign in"],
    check: "Done once TDMP's sign-in discovery lists roles or access_scope claims.",
  },
  R9: {
    summary: "Tell us when the user already did MFA in TDMP.",
    why: "Then we skip our own second factor instead of asking twice.",
    ask: ["Add amr to the id_token when MFA was used."],
    example: { label: "id_token claims", lang: "json", code: `{ "sub": "14", "email": "officer@rtb.gov.rw", "amr": ["pwd", "otp"] }` },
    unlocks: ["One MFA prompt instead of two"],
    check: "Done once TDMP's discovery document lists the amr claim.",
  },
  R10: {
    summary: "A staging TDMP with one test user per role.",
    why: "We test sign-on, roles and scopes without touching real accounts.",
    ask: ["Provide a staging URL (or test tenant).", "Create one test user for each role in R7."],
    example: {
      label: "What we need",
      lang: "text",
      code: `https://staging.tdmp.rtb.gov.rw
test.admin@…     (RTB HQ administrator)
test.district@…  (District officer, Muhanga)
test.school@…    (Head teacher, ACEJ KARAMA)`,
    },
    unlocks: ["Safe sign-in testing"],
    check: "To confirm with TDMP.",
  },
  R11: {
    summary: "Outcome indicators for future dashboards.",
    why: "Pass rates, graduate employment and labour demand will sit next to the condition score. They are not part of it.",
    ask: [
      "Read access to /performance/summary when we start this phase.",
      "Tell us whether tracer-study and labour-market data are planned.",
    ],
    example: {
      label: "Pass rates per school (illustrative values)",
      lang: "http",
      code: `GET /api/v1/performance/summary?groupBy=school&academicYear=2025/2026

200 OK
{ "data": [ { "schoolCode": "270501", "passRate": 0.87, "students": 210 } ] }`,
    },
    unlocks: ["Assessment pass rates", "Graduate employment", "Labour-market demand"],
    check: "Pass rates turn green once /performance/summary answers 200 for our key.",
  },
  R14: {
    summary: "Take school coordinates from RTB GIS to update TDMP's GPS.",
    why: "RTB GIS places schools from drone surveys and GIS staff work. Reading our points keeps TDMP's gpsLat / gpsLong accurate without anyone re-typing them.",
    ask: [
      "Store the partner key we issue on the TDMP server (never in a browser).",
      "Run a daily job: GET /partner/schools/coordinates, first in full, then with updatedSince.",
      "Update gpsLat / gpsLong when quality is surveyed or manual, and the point is inside Rwanda.",
      "Full guide with ready code: /developers#coordinates.",
    ],
    example: {
      label: "Daily incremental pull",
      lang: "http",
      code: `GET /api/v1/partner/schools/coordinates?updatedSince=2026-11-12T11:00:00Z&limit=1000
Authorization: ApiKey rtbgis_pk_…

200 OK
{ "data": [ { "schoolCode": "280705", "latitude": -1.8835, "longitude": 29.9379,
              "quality": "surveyed", "updatedAt": "2026-11-12T10:40:00Z" } ],
  "page": { "current": 1, "limit": 1000, "total": 1 },
  "generatedAt": "2026-11-13T07:30:00Z" }`,
    },
    unlocks: ["Accurate GPS in TDMP", "One source of truth for location"],
    check: "Partly done once a key with coordinates access exists; done once TDMP has used it.",
  },
  R15: {
    summary: "Show RTB GIS dashboards and 2D / 3D maps inside TDMP.",
    why: "TDMP users see a school's condition, site map and 3D model next to its TDMP record, without a second login. Views are read-only and limited to that school.",
    ask: [
      "On the TDMP server, call POST /partner/embed-links for each page view (never from the browser).",
      "Put the returned url in an iframe on the school page.",
      "Pick the view: school-dashboard, school-map-2d, school-map-3d or national-map.",
      "Try it live, with the key, at /developers#embed.",
    ],
    example: {
      label: "Server call, then the iframe",
      lang: "text",
      code: `POST /api/v1/partner/embed-links
Authorization: ApiKey rtbgis_pk_…
{ "view": "school-dashboard", "schoolCode": "280705" }

→ { "url": "https://rtb.aerovyntech.com/embed/schools/…/dashboard#token=…", "expiresAt": "…" }

<iframe src="{url}" style="width:100%;height:720px;border:0" allow="fullscreen"></iframe>`,
    },
    unlocks: ["RTB GIS views inside TDMP", "Audit trail of every embedded view"],
    check: "Done once the first embedded view is opened (recorded in our audit trail).",
  },
  R16: {
    summary: "Tell us which TDMP sites may show embedded views.",
    why: "Browsers only show RTB GIS inside sites we allow (Content-Security-Policy frame-ancestors). Any other site is refused, which protects users from clickjacking.",
    ask: [
      "Send every origin that will host the iframes (production, staging), e.g. https://tdmp.rtb.gov.rw.",
      "Tell us before adding a new one.",
    ],
    example: {
      label: "What we configure",
      lang: "text",
      code: `Content-Security-Policy: frame-ancestors 'self' https://tdmp.rtb.gov.rw`,
    },
    unlocks: ["Embedded views load on TDMP pages"],
    check: "To confirm with TDMP; then set on the partner key and the web server.",
  },
  R12: {
    summary: "Rotate our API key; separate keys per environment.",
    why: "The production key was shared in plain text before it was installed. A fresh key closes that gap.",
    ask: [
      "Rotate the key (POST /api-key/keys/{id}/rotate) and send the new one over a secure channel.",
      "Issue a separate key for staging / development.",
      "Tell us any rate limits.",
    ],
    example: {
      label: "Our request load today",
      lang: "text",
      code: `1 small request at the interval our admins choose (≥ 15 min, now every 6 h)
~10 requests per daily full run (07:15 Kigali)`,
    },
    unlocks: ["Clean key history"],
    check: "To confirm after the new key is installed.",
  },
  R13: {
    summary: "GPS for the TVET schools that have none in TDMP.",
    why: "These schools are in TDMP but cannot be placed on the national map. Our admins can place them by hand, but fixing GPS at the source helps every system.",
    ask: [
      "Add gpsLat / gpsLong (WGS84, inside Rwanda) for the schools listed in the requests document.",
      "Or take the points we set from our partner API: GET /api/v1/partner/schools/coordinates.",
    ],
    example: {
      label: "GET /api/v1/schools/310517 on TDMP, once fixed (placeholder coordinates)",
      lang: "json",
      code: `{ "schoolCode": "310517", "schoolName": "MUBUGA TSS",
  "gpsLat": -2.xxxxxx, "gpsLong": 29.xxxxxx }`,
    },
    unlocks: ["Every school on the map"],
    check: "Counted from our latest sync: schools whose TDMP point is missing or outside Rwanda.",
  },
};
