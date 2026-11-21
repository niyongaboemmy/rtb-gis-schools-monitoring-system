import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, ExternalLink, Lock, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { cn } from "../lib/utils";
import { API_BASE, api } from "../lib/api";
import type { EmbedSession } from "../lib/embed";
import { currentEmbedSession, EMBED_EXPIRED_EVENT, EMBED_LINK_TOKEN, ensureEmbedSession, isEmbedExpired } from "../lib/embed";
import {
  EmbedDrillContext,
  EmbedViewContext,
  isSchoolEmbedView,
  SCHOOL_EMBED_VIEWS,
  type EmbedNavState,
  type EmbedView,
} from "../lib/embed-view";
import { hasPermission, Permission, type PermissionType } from "../lib/permissions";
import { useAuthStore, type User } from "../store/authStore";
import { useScope } from "../hooks/useScope";
import SchoolDecisionDashboard from "./SchoolDecisionDashboard";
import NationalMap from "./NationalMap";
import Dashboard from "./Dashboard";
import SchoolMap from "../components/SchoolMap";
import School3DView from "../components/School3DView";

type GateState =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "error"; title: string; hint: string };

const LINK_ERRORS: Record<string, { title: string; hint: string }> = {
  EMBED_LINK_INVALID: { title: "This link has expired", hint: "Reload the page in TDMP to get a fresh view." },
  EMBED_LINK_REVOKED: { title: "Access was withdrawn", hint: "The partner key behind this view was revoked. Contact the RTB GIS team." },
};

/** Full-height notice used for every non-ready state. */
function Notice({ icon: Icon, title, hint, action }: { icon: typeof Lock; title: string; hint: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <div className="max-w-sm text-center">
        <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary" aria-hidden>
          <Icon className="h-5 w-5" />
        </span>
        <h1 className="text-base font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}

/** "RTB 3D GIS" badge with a link to open the full app in a new tab. */
function Badge({ to }: { to: string }) {
  return (
    <a
      href={to}
      target="_blank"
      rel="noreferrer"
      className="fixed bottom-3 right-3 z-[60] inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur-md hover:bg-black/75"
      data-tooltip="Open this view in RTB 3D GIS (new tab)"
    >
      RTB 3D GIS <ExternalLink className="h-3 w-3" aria-hidden />
    </a>
  );
}

/**
 * Runs an embedded view: from a signed partner link (read-only session in
 * memory) or, opened directly, with the signed-in RTB GIS session. Either way
 * the user needs `need`, and the server limits the data to their scope.
 */
export function EmbedGate({ view, need, children }: { view: EmbedView; need: PermissionType; children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  // The one page this embed is; anything else is not part of it.
  const [home] = useState(location.pathname);
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  // A school opened from the map reuses the session the map already opened.
  const [state, setState] = useState<GateState>(
    EMBED_LINK_TOKEN && !currentEmbedSession() ? { kind: "loading" } : { kind: "ready" },
  );
  const [expired, setExpired] = useState(isEmbedExpired);

  useEffect(() => {
    if (!EMBED_LINK_TOKEN || currentEmbedSession()) return;
    let cancelled = false;
    // Plain axios: no interceptors (no refresh, no redirect). Once per page load.
    ensureEmbedSession<User>((token) =>
      axios.post<EmbedSession<User>>(`${API_BASE}/embed/session`, { token }).then(({ data }) => {
        useAuthStore.setState({ token: data.accessToken, user: data.user, isAuthenticated: true, status: "ready" });
        return data;
      }),
    )
      .then(() => {
        if (!cancelled) setState({ kind: "ready" });
      })
      .catch((err) => {
        if (cancelled) return;
        const code = err?.response?.data?.code as string | undefined;
        setState({ kind: "error", ...(LINK_ERRORS[code ?? ""] ?? { title: "This view could not open", hint: "Reload the page, or contact the RTB GIS team if it keeps happening." }) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onExpired = () => setExpired(true);
    window.addEventListener(EMBED_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(EMBED_EXPIRED_EVENT, onExpired);
  }, []);

  if (state.kind === "loading" || status === "restoring")
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" role="status" aria-label="Loading">
        <RefreshCw className="h-6 w-6 animate-spin text-primary" aria-hidden />
      </div>
    );
  if (state.kind === "error") return <Notice icon={ShieldAlert} title={state.title} hint={state.hint} />;
  if (!isAuthenticated || !user)
    return (
      <Notice
        icon={Lock}
        title="Sign in to RTB 3D GIS"
        hint="This view needs an RTB 3D GIS account, or a link from TDMP."
        action={
          <a href={`/login?next=${encodeURIComponent(window.location.pathname)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Sign in <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        }
      />
    );
  if (!hasPermission(user, need))
    return <Notice icon={ShieldAlert} title="No access to this view" hint="Your role does not include it. Ask an RTB GIS administrator." />;
  // A link or button inside the view tried to open another page.
  if (location.pathname !== home)
    return (
      <Notice
        icon={ShieldAlert}
        title="Not part of this view"
        hint="This embedded view only shows what was shared. Open RTB 3D GIS for more."
        action={
          <button
            type="button"
            onClick={() => navigate(home, { replace: true })}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to the view
          </button>
        }
      />
    );

  // School views a school opened from a national view may show: the link's
  // (partner key) in link mode; all of them with a signed-in RTB GIS session
  // (its own permissions and scope still apply).
  const session = currentEmbedSession();
  const drill: EmbedView[] = session
    ? (session.drill ?? []).filter(isSchoolEmbedView)
    : [...SCHOOL_EMBED_VIEWS];
  const navState = location.state as EmbedNavState | null;
  const drilled = isSchoolEmbedView(view) && (session ? !isSchoolEmbedView(session.view) : !!navState?.embedFrom);
  const backTo =
    navState?.embedFrom ?? (session?.view === "national-dashboard" ? "/embed/dashboard" : "/embed/map");

  return (
    <EmbedViewContext.Provider value={view}>
      <EmbedDrillContext.Provider value={drill}>
        {drilled && <DrillBar view={view} views={drill} backTo={backTo} />}
        {drilled && view === "school-dashboard" && <div className="h-14" aria-hidden />}
        {children}
      </EmbedDrillContext.Provider>
      <ScopeChip view={view} />
      {expired && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/85 backdrop-blur-sm" role="alertdialog" aria-label="View expired">
          <Notice icon={RefreshCw} title="This view has expired" hint="Reload the page to continue." />
        </div>
      )}
    </EmbedViewContext.Provider>
  );
}

const DRILL_TABS: { view: EmbedView; label: string; path: string }[] = [
  { view: "school-dashboard", label: "Overview", path: "dashboard" },
  { view: "school-map-2d", label: "2D map", path: "map-2d" },
  { view: "school-map-3d", label: "3D model", path: "map-3d" },
];

/**
 * A school opened from the embedded national map: back to the map, and the
 * school's other views the link allows. Floats top-centre (the embedded
 * viewers keep that spot free) above the full-screen 2D viewer.
 */
function DrillBar({ view, views, backTo }: { view: EmbedView; views: readonly EmbedView[]; backTo: string }) {
  const { pathname } = useLocation();
  const id = pathname.split("/")[3] ?? "";
  const tabs = DRILL_TABS.filter((t) => views.includes(t.view));
  const state: EmbedNavState = { embedFrom: backTo };
  return (
    <nav
      aria-label="School views"
      className="fixed left-1/2 top-3 z-[70] flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-center gap-1 rounded-full bg-white/80 p-1 shadow-[0_8px_24px_-12px_rgb(15_23_42/0.45)] ring-1 ring-slate-900/10 backdrop-blur-xl dark:bg-[hsl(224_40%_8%)]/85 dark:ring-white/10"
    >
      <Link
        to={backTo}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-900/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 dark:text-white/80 dark:hover:bg-white/10"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> {backTo.startsWith("/embed/dashboard") ? "Dashboard" : "Map"}
      </Link>
      {tabs.length > 1 && <span className="h-5 w-px shrink-0 bg-slate-900/10 dark:bg-white/10" aria-hidden />}
      {tabs.length > 1 &&
        tabs.map((t) => {
          const on = t.view === view;
          return (
            <Link
              key={t.view}
              to={`/embed/schools/${id}/${t.path}`}
              state={state}
              replace
              aria-current={on ? "page" : undefined}
              className={cn(
                "inline-flex h-8 shrink-0 items-center rounded-full px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                on
                  ? "bg-primary text-primary-foreground"
                  : "text-slate-600 hover:bg-slate-900/5 hover:text-slate-900 dark:text-white/65 dark:hover:bg-white/10 dark:hover:text-white",
              )}
            >
              {t.label}
            </Link>
          );
        })}
    </nav>
  );
}

/** Which area the view is limited to, so viewers can see the access level at work. */
function ScopeChip({ view }: { view: EmbedView }) {
  const scope = useScope();
  const loc = useAuthStore((s) => s.user?.location);
  const label = view.startsWith("school-") ? (loc?.schoolName ?? scope.label) : scope.isNational ? "All of Rwanda" : scope.label;
  return (
    <span
      className="fixed bottom-3 left-3 z-[60] inline-flex max-w-[60vw] items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur-md"
      data-tooltip="This view only shows data inside this area (the access level of the link)"
      aria-label={`Showing: ${label}`}
    >
      <ShieldCheck className="h-3 w-3 shrink-0" aria-hidden /> <span className="truncate">Showing: {label}</span>
    </span>
  );
}

const appLink = (path: string) => `${window.location.origin}${path}`;

export function EmbedSchoolDashboard() {
  const { id } = useParams<{ id: string }>();
  return (
    <EmbedGate view="school-dashboard" need={Permission.VIEW_INTELLIGENCE}>
      <main className="min-h-screen bg-background p-3 text-foreground sm:p-5">
        <SchoolDecisionDashboard id={id} standalone={false} />
      </main>
      <Badge to={appLink(`/schools/${id}/decision`)} />
    </EmbedGate>
  );
}

function SchoolMap2D({ id }: { id: string }) {
  const [school, setSchool] = useState<unknown>(null);
  const [overlay, setOverlay] = useState<unknown>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    api
      .get(`/schools/${id}`)
      .then(async ({ data }) => {
        if (cancelled) return;
        setSchool(data);
        try {
          const p = await api.get(`/schools/${id}/kmz/places-overlay`);
          if (!cancelled) setOverlay(p.data?.placesOverlayData ?? null);
        } catch {
          // No places overlay uploaded.
        }
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [id]);
  if (failed) return <Notice icon={ShieldAlert} title="This school could not load" hint="It may be outside the area this view covers." />;
  if (!school)
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900" role="status" aria-label="Loading map">
        <RefreshCw className="h-6 w-6 animate-spin text-white" aria-hidden />
      </div>
    );
  return (
    <div className="h-screen w-full bg-slate-900">
      <SchoolMap school={school} placesOverlay={overlay} isEmbed onClose={() => undefined} />
    </div>
  );
}

export function EmbedSchoolMap2D() {
  const { id = "" } = useParams<{ id: string }>();
  return (
    <EmbedGate view="school-map-2d" need={Permission.SCHOOL_VIEW_2D3D_MAP}>
      <SchoolMap2D id={id} />
      <Badge to={appLink(`/schools/${id}/3dview`)} />
    </EmbedGate>
  );
}

export function EmbedSchoolMap3D() {
  const { id = "" } = useParams<{ id: string }>();
  return (
    <EmbedGate view="school-map-3d" need={Permission.SCHOOL_VIEW_2D3D_MAP}>
      <div className="h-screen w-full">
        <School3DView schoolId={id} schoolName="" onClose={() => undefined} />
      </div>
      <Badge to={appLink(`/schools/${id}/3d-explorer`)} />
    </EmbedGate>
  );
}

export function EmbedNationalMap() {
  return (
    <EmbedGate view="national-map" need={Permission.VIEW_MAP}>
      <main className="min-h-screen bg-background p-3 text-foreground sm:p-5">
        <NationalMap />
      </main>
      <Badge to={appLink("/map")} />
    </EmbedGate>
  );
}

export function EmbedNationalDashboard() {
  return (
    <EmbedGate view="national-dashboard" need={Permission.VIEW_DASHBOARD}>
      <main className="min-h-screen bg-background p-3 text-foreground sm:p-5">
        <Dashboard />
      </main>
      <Badge to={appLink("/")} />
    </EmbedGate>
  );
}
