/** Non-component helpers for the app shell (kept apart for fast refresh). */

/** Readable names for top-level routes. */
const ROUTE_LABELS: Record<string, string> = {
  "": "National dashboard",
  welcome: "Welcome",
  "school-dashboard": "School dashboard",
  map: "National map",
  schools: "Schools",
  analytics: "Decision & analytics",
  "analytics/population": "Population",
  reporting: "School reporting",
  reports: "Reports",
  settings: "Settings",
  profile: "My profile",
};

/** Readable names for school sub-pages (/schools/:id/<sub>). */
const SCHOOL_SUBPAGES: Record<string, string> = {
  decision: "Condition dashboard",
  "3dview": "2D / 3D viewer",
  "3d-explorer": "3D explorer",
  kmz: "Upload KMZ / 3D model",
  "places-overlay": "Places overlay",
};


export interface Crumb {
  label: string;
  to?: string;
}

/** Pure route → crumbs mapping (exported for tests). */
export function crumbsFor(pathname: string): { crumbs: Crumb[]; schoolId: string | null; schoolSub: string | null } {
  const parts = pathname.replace(/^\/+|\/+$/g, "").split("/");
  if (parts[0] === "schools" && parts[1]) {
    const sub = parts[2] ?? "decision";
    return {
      crumbs: [{ label: "Schools", to: "/schools" }],
      schoolId: parts[1],
      schoolSub: SCHOOL_SUBPAGES[sub] ?? sub.replace(/-/g, " "),
    };
  }
  const two = parts.slice(0, 2).join("/");
  if (ROUTE_LABELS[two] && parts.length > 1) {
    return {
      crumbs: [
        { label: ROUTE_LABELS[parts[0]] ?? parts[0], to: `/${parts[0]}` },
        { label: ROUTE_LABELS[two] },
      ],
      schoolId: null,
      schoolSub: null,
    };
  }
  return {
    crumbs: [{ label: ROUTE_LABELS[parts[0]] ?? parts[0].replace(/-/g, " ") }],
    schoolId: null,
    schoolSub: null,
  };
}


/**
 * Swap `/schools/<old>/<sub-page>` for `/schools/<new>/<sub-page>` so the user
 * stays on the same sub-page (dashboard, viewer, upload…) when switching.
 */
export function switchSchoolPath(pathname: string, newId: string): string {
  const m = /^\/schools\/[^/]+(\/.*)?$/.exec(pathname);
  if (!m) return `/schools/${newId}/decision`;
  return `/schools/${newId}${m[1] ?? "/decision"}`;
}


export interface TourStep {
  /** Value of the `data-tour` attribute to highlight; omit for a centred step. */
  target?: string;
  title: string;
  body: string;
}


/* ── Role-based tours ───────────────────────────────────────────────────── */

export const NATIONAL_TOUR: TourStep[] = [
  {
    title: "Welcome to TVET 3D GIS",
    body: "A quick 1-minute tour of where things are. You can reopen it any time from the Help (?) menu.",
  },
  {
    target: "nav",
    title: "Main menu",
    body: "Dashboards, the national map, the schools directory, analytics and reports. You only see what your role allows.",
  },
  {
    target: "search",
    title: "Find a school fast",
    body: "Search any school by name or code and jump straight to its dashboard.",
  },
  {
    target: "scope",
    title: "Your access area",
    body: "This shows which schools you can see: the whole country or only your province, district or sector.",
  },
  {
    target: "notifications",
    title: "Notifications",
    body: "Report updates and change requests sent to you appear here.",
  },
  {
    target: "help",
    title: "Help",
    body: "Reopen this tour from here whenever you need it.",
  },
];

export const SCHOOL_TOUR: TourStep[] = [
  {
    title: "Welcome to your school's space",
    body: "This short tour shows how to follow your school and report problems. Reopen it from the Help (?) menu.",
  },
  {
    target: "nav-school-dashboard",
    title: "Your school dashboard",
    body: "Your home page: your school's condition score, buildings and open issues.",
  },
  {
    target: "nav-reporting",
    title: "Report an issue",
    body: "Tell RTB about a broken facility: choose the building and item, describe it and add photos.",
  },
  {
    target: "notifications",
    title: "Stay informed",
    body: "When RTB updates one of your reports, you get a notification here.",
  },
  {
    target: "help",
    title: "Help",
    body: "Reopen this tour from here. Need to correct the school's location or buildings? Use \"Request a change\" on the school record.",
  },
];

const doneKey = (userId: string, variant: string) => `rtb-tour-done:${userId}:${variant}`;

export function tourSeen(userId: string, variant: string): boolean {
  try {
    return localStorage.getItem(doneKey(userId, variant)) === "1";
  } catch {
    return true; // storage blocked → never nag
  }
}

export function markTourSeen(userId: string, variant: string) {
  try {
    localStorage.setItem(doneKey(userId, variant), "1");
  } catch {
    /* ignore */
  }
}
