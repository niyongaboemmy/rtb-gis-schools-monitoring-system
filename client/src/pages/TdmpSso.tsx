import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, refreshSession } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import { useToast } from "../components/ui/toast";
import { SessionSplash } from "../components/auth/AuthGate";
import { safeNextPath, tdmpStartUrl } from "../lib/tdmp";

const SCHOOL_NOT_FOUND = "That school is not in RTB GIS yet.";

/**
 * Picks up a session from the refresh cookie when this tab doesn't have one
 * yet (first visit, or a remembered user still restoring). Resolves true when
 * a session is available.
 */
async function ensureSession(): Promise<boolean> {
  if (useAuthStore.getState().token) return true;
  try {
    await refreshSession();
    return true;
  } catch {
    return false;
  }
}

/**
 * `/sso/tdmp?school=CODE` — the "Open in RTB GIS" link on a TDMP school page.
 * Signed in already → straight to the school; otherwise through TDMP sign-in,
 * which returns here via /sso/tdmp/complete.
 */
export function TdmpSsoEntry() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const started = useRef(false);
  const school = params.get("school")?.trim() ?? "";

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      if (!(await ensureSession())) {
        window.location.assign(tdmpStartUrl(school ? { school } : {}));
        return;
      }
      if (!school) return navigate("/", { replace: true });
      try {
        const { data } = await api.get<{ id: string }>(`/tdmp/schools/resolve/${encodeURIComponent(school)}`);
        navigate(`/schools/${data.id}`, { replace: true });
      } catch (err) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 404) toast.warning(SCHOOL_NOT_FOUND);
        else if (status === 403) toast.warning("This school is outside your access area.");
        else toast.error("Could not open that school. Please try again.");
        navigate("/", { replace: true });
      }
    })();
  }, [school, navigate, toast]);

  return <SessionSplash />;
}

/**
 * `/sso/tdmp/complete?next=…` — where the server sends the browser after a
 * TDMP sign-in. The refresh cookie is already set; exchange it for a session
 * and continue to `next` (same-app paths only).
 */
export function TdmpSsoComplete() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const next = safeNextPath(params.get("next"));
    const notice = params.get("notice");
    void (async () => {
      // Always exchange the fresh cookie: a remembered profile in this tab
      // may belong to whoever signed in before.
      try {
        await refreshSession();
      } catch {
        navigate("/login?sso_error=failed", { replace: true });
        return;
      }
      if (notice === "school_not_found") toast.warning(SCHOOL_NOT_FOUND);
      navigate(next, { replace: true });
    })();
  }, [params, navigate, toast]);

  return <SessionSplash />;
}
