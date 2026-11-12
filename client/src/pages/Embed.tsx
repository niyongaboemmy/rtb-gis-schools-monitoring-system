import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, ExternalLink, Lock, RefreshCw, ShieldAlert } from "lucide-react";
import { API_BASE, api } from "../lib/api";
import { EMBED_EXPIRED_EVENT, EMBED_LINK_TOKEN } from "../lib/embed";
import { EmbedViewContext, type EmbedView } from "../lib/embed-view";
import { hasPermission, Permission, type PermissionType } from "../lib/permissions";
import { useAuthStore, type User } from "../store/authStore";
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
  const [state, setState] = useState<GateState>(EMBED_LINK_TOKEN ? { kind: "loading" } : { kind: "ready" });
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!EMBED_LINK_TOKEN) return;
    let cancelled = false;
    // Plain axios: no interceptors (no refresh, no redirect).
    axios
      .post<{ accessToken: string; user: User; expiresIn: number }>(`${API_BASE}/embed/session`, { token: EMBED_LINK_TOKEN })
      .then(({ data }) => {
        if (cancelled) return;
        useAuthStore.setState({ token: data.accessToken, user: data.user, isAuthenticated: true, status: "ready" });
        setState({ kind: "ready" });
        // End the view when the session runs out, before calls start failing.
        window.setTimeout(() => setExpired(true), Math.max(0, data.expiresIn * 1000 - 5000));
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

  return (
    <EmbedViewContext.Provider value={view}>
      {children}
      {expired && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/85 backdrop-blur-sm" role="alertdialog" aria-label="View expired">
          <Notice icon={RefreshCw} title="This view has expired" hint="Reload the page to continue." />
        </div>
      )}
    </EmbedViewContext.Provider>
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
