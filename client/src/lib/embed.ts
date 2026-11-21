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

/** What the server returns when a link is exchanged (POST /embed/session). */
export interface EmbedSession<U = unknown> {
  accessToken: string;
  expiresIn: number;
  view: string;
  schoolId: string | null;
  /** School views a school opened from a national view may show. */
  drill?: string[];
  user: U;
}

let sessionPromise: Promise<EmbedSession> | null = null;
let session: EmbedSession | null = null;
let expired = false;

/**
 * Exchanges the link token for a session once per page load; every embedded
 * view (the map, then a school opened from it) shares that one session.
 * `exchange` posts the token; it is only called the first time.
 */
export function ensureEmbedSession<U>(exchange: (token: string) => Promise<EmbedSession<U>>): Promise<EmbedSession<U>> {
  if (!EMBED_LINK_TOKEN) return Promise.reject(new Error("No embed link token"));
  if (!sessionPromise) {
    sessionPromise = exchange(EMBED_LINK_TOKEN).then((s) => {
      session = s;
      // End the view shortly before the session runs out, before calls fail.
      window.setTimeout(() => {
        expired = true;
        window.dispatchEvent(new Event(EMBED_EXPIRED_EVENT));
      }, Math.max(0, s.expiresIn * 1000 - 5000));
      return s;
    });
    // A failed exchange can be retried by a later view.
    sessionPromise.catch(() => {
      sessionPromise = null;
    });
  }
  return sessionPromise as Promise<EmbedSession<U>>;
}

/** The session this page already opened from its link, if any. */
export const currentEmbedSession = (): EmbedSession | null => session;

export const isEmbedExpired = (): boolean => expired;

// A 401 in link mode (lib/api.ts) also ends the session for every later view.
if (typeof window !== "undefined")
  window.addEventListener(EMBED_EXPIRED_EVENT, () => {
    expired = true;
  });

/** Storage that keeps nothing: the embed session lives in memory only. */
export const memoryOnlyStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};
