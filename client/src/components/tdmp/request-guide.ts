/**
 * What each request to the TDMP team means, written for the TDMP team:
 * why we need it, exactly what to do, a concrete example, and what it turns
 * on in RTB GIS. Mirrors docs/TDMP_INTEGRATION_REQUESTS.md.
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
    summary: "Let our partner key read three school-level reports.",
    why: "Learners per programme (with the gender split) size workshops, classrooms, sanitation and dormitories against what each school has on the ground. Programme names and administrative units label them. Our key gets 403 on these routes, although the TDMP docs list them for external_api_consumer.",
    ask: [
      "Give the RTB 3D GIS service account read access to /reports/trades/students, /trades and /locations (school-level aggregates only).",
      "Keep /students and /teachers closed to us: we never need learner or teacher records.",
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
    unlocks: ["Learners per programme", "Learners by gender", "Programme names", "Administrative units"],
    check: "We call the three routes with our key on every connection test. Each one that answers 200 turns green here.",
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
    summary: "Two more fields on each /schools list row.",
    why: "The TSS / VTC band is only a filter today, and there is no change date on list rows. 64 of the 375 schools we sync are in neither band.",
    ask: [
      "Return categoryBand and updatedAt on every /schools list row.",
      "Tell us what the 64 schools in neither band are (integrated, short courses…).",
    ],
    example: {
      label: "One list row with the extra fields",
      lang: "json",
      code: `{ "schoolCode": "270501", "schoolName": "ACEJ KARAMA",
  "categoryBand": "TSS",
  "updatedAt": "2026-11-12T06:00:34+02:00" }`,
    },
    unlocks: ["Type for all schools", "Faster sync (no per-school calls)"],
    check: "We read the first 100 rows on every connection test and look for the two fields.",
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
    summary: "Register RTB 3D GIS for \"Sign in with TDMP\" (production and test).",
    why: "This is the only thing single sign-on still needs. Everything on our side follows the TDMP sign-in guide (12 Nov 2026): code + PKCE, ID token checked against your keys, profile from /oauth/userinfo, newest refresh token kept, token revoked at sign-out.",
    ask: [
      "Register RTB 3D GIS with the details below (guide §3) and send the client ID and secret over a secure channel.",
      "Add the launch URL as a tile on the TDMP sign-in page (guide §10).",
      "Create a test registration on the TDMP test environment with the localhost redirect URI.",
    ],
    example: {
      label: "Registration details",
      lang: "text",
      code: `System name        RTB 3D GIS
Server or browser  Has a server (client secret)
Redirect URI       https://rtb.aerovyntech.com/api/v1/auth/tdmp/callback
Launch URL         https://rtb.aerovyntech.com/sso/tdmp
Test redirect URI  http://localhost:5173/api/v1/auth/tdmp/callback
Technical contact  (name and email)`,
    },
    unlocks: ["Sign in with TDMP", "RTB 3D GIS tile on the TDMP sign-in page"],
    check: "Done once the client ID and secret are on our server.",
  },
  R7: {
    summary: "Send each user's role when they sign in (to agree).",
    why: "TDMP sign-in carries no role today (guide §8). Not blocking: RTB 3D GIS administrators pre-register expected users with a role, and anyone else waits for access. With roles from TDMP, nobody has to be set up twice.",
    ask: [
      "Agree with us how roles will arrive: a roles claim in the ID token and /oauth/userinfo, or sign-in tokens accepted at GET /auth/me/access-scope.",
      "Confirm or correct the mapping below.",
    ],
    example: {
      label: "Draft mapping (TDMP access level → RTB 3D GIS role)",
      lang: "text",
      code: `National (RTB HQ administrator)   → admin             (national)
National (planner / M&E officer)  → viewer            (national)
District                          → district_officer  (own district)
School (manager / head teacher)   → school_leader     (own school)
None                              → no access`,
    },
    unlocks: ["Right role at sign-in, without pre-registering"],
    check: "Done once TDMP's sign-in discovery lists a roles claim.",
  },
  R8: {
    summary: "Send which province, district or school a user covers (to agree).",
    why: "Sign-in carries no area today (guide §8). Not blocking: administrators set each user's area in RTB 3D GIS until TDMP provides it.",
    ask: [
      "Send the area with the role (R7): an access_scope claim, or the unit filled in on GET /auth/me/access-scope, as below.",
    ],
    example: {
      label: "access_scope",
      lang: "json",
      code: `"accessScope": {
  "kind": "district",
  "provinceId": 2, "provinceName": "Southern Province",
  "districtId": 14, "districtName": "Muhanga",
  "schoolCode": null
}`,
    },
    unlocks: ["District and province users placed automatically"],
    check: "Done once TDMP's sign-in discovery lists an access_scope claim.",
  },
  R9: {
    summary: "Tell us when the user already did MFA in TDMP.",
    why: "The guide lists no amr claim, so we still ask privileged roles for our own second factor after TDMP sign-in. With amr we would stop asking twice.",
    ask: ["Add amr to the ID token when MFA was used."],
    example: { label: "ID token claims", lang: "json", code: `{ "sub": "14", "email": "officer@rtb.gov.rw", "amr": ["pwd", "otp"] }` },
    unlocks: ["One MFA prompt instead of two"],
    check: "Done once TDMP's discovery document lists the amr claim.",
  },
  R10: {
    summary: "Test registration and one test account per access level.",
    why: "The guide mentions a separate test environment. We test sign-in, the waiting list and areas without touching real accounts.",
    ask: [
      "Send the test registration details (see R6).",
      "Create one test user per access level: national, province, district, school, none.",
    ],
    example: {
      label: "What we need",
      lang: "text",
      code: `Test client ID / secret (localhost redirect URI)
test.national@…   (National)
test.district@…   (District, Muhanga)
test.school@…     (School, ACEJ KARAMA)
test.none@…       (No data access)`,
    },
    unlocks: ["Safe sign-in testing"],
    check: "To confirm with TDMP.",
  },
  R17: {
    summary: "Tell connected systems when a TDMP account is deactivated.",
    why: "A TDMP refresh token keeps working for up to 30 days after the account is deactivated (guide §9). Until there is a signal, our TDMP sessions end after 24 hours and users go back through TDMP sign-in.",
    ask: [
      "Agree with us one way to learn of deactivations quickly: refresh tokens that stop at deactivation, back-channel logout, or a webhook.",
    ],
    example: {
      label: "Any of these",
      lang: "text",
      code: `POST /oauth/token (refresh_token)   → 400 invalid_grant once deactivated
POST {our back-channel logout URL}  ← logout_token for the user
POST {our webhook}                  ← { "event": "user.deactivated", "sub": "14" }`,
    },
    unlocks: ["Deactivations take effect within minutes, not up to 24 hours"],
    check: "To confirm with TDMP.",
  },
  R18: {
    summary: "Open a specific school from the TDMP launcher.",
    why: "The launcher opens one fixed page per system (guide §12). Our launch page already opens a school after sign-in when it gets the school code.",
    ask: ["Pass the school code to our launch URL from TDMP school pages."],
    example: {
      label: "Launch URL with a school",
      lang: "text",
      code: `https://rtb.aerovyntech.com/sso/tdmp?school={schoolCode}`,
    },
    unlocks: ["One click from a TDMP school to the same school in RTB 3D GIS"],
    check: "To confirm with TDMP.",
  },
  R15: {
    summary: "Show RTB GIS dashboards and 2D / 3D maps inside TDMP.",
    why: "TDMP users see a school's condition, site map and 3D model next to its TDMP record, without a second login. Views are read-only and limited to that school.",
    ask: [
      "On the TDMP server, call POST /partner/embed-links for each page view (never from the browser).",
      "Put the returned url in an iframe on the school page.",
      "Pick the view: school-dashboard, school-map-2d, school-map-3d, national-map or national-dashboard. Each link opens that one view only.",
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
};
