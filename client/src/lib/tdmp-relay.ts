/**
 * TDMP registers public paths for RTB GIS (`/auth/tdmp/callback`, and the
 * launch path `/auth/tdmp/start`), as in TDMP's SSO guide. The web server
 * sends them to the web app; this hands them straight to the API, before
 * anything renders, so the API finishes (or starts) the sign-in with the
 * query TDMP sent. Kept free of app imports so it runs first and stays tiny.
 */
const RELAYED = new Set(["/auth/tdmp/callback", "/auth/tdmp/start"]);

/** Where to send the browser, or null when this page is not a TDMP path. */
export function tdmpRelayTarget(pathname: string, search: string, apiBase: string): string | null {
  const path = pathname.replace(/\/+$/, "");
  if (!RELAYED.has(path)) return null;
  return `${apiBase.replace(/\/+$/, "")}${path}${search}`;
}

const target =
  typeof window === "undefined"
    ? null
    : tdmpRelayTarget(
        window.location.pathname,
        window.location.search,
        import.meta.env.VITE_API_URL || "/api/v1",
      );
if (target) window.location.replace(target);

/** True while the browser is being handed to the API: don't render the app. */
export const relayingToTdmpApi = target !== null;
