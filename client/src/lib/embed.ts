/**
 * Embedded views (partner iframes, e.g. TDMP): /embed/* pages opened with a
 * signed link `…#token=…`. In that mode the page runs on a short read-only
 * session exchanged from the link, held in memory only:
 *  - it never reads or writes the saved RTB GIS profile (an RTB GIS tab open
 *    in the same browser shares this origin's storage), and
 *  - it never tries the refresh cookie or redirects to /login (third-party
 *    cookies don't reach iframes; an expired view just asks for a reload).
 * Opened without a token, /embed/* pages use the normal signed-in session.
 */

function readLinkToken(): string | null {
  if (typeof window === "undefined") return null;
  if (!window.location.pathname.startsWith("/embed/") && window.location.pathname !== "/embed") return null;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const token = hash.get("token");
  if (!token) return null;
  // Drop the token from the address bar (screenshots, copy-paste, history).
  try {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  } catch {
    /* ignore */
  }
  return token;
}

/** The signed link token this page was opened with, read once at start-up. */
export const EMBED_LINK_TOKEN: string | null = readLinkToken();

export const isEmbedLinkMode = (): boolean => EMBED_LINK_TOKEN !== null;

/** Fired when an embed session ends (expired / revoked): the page shows a notice. */
export const EMBED_EXPIRED_EVENT = "rtb:embed-expired";

/** Storage that keeps nothing: the embed session lives in memory only. */
export const memoryOnlyStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};
