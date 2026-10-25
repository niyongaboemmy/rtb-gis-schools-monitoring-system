import { lazy, type ComponentType } from "react";

const RELOAD_KEY = "rtb:chunk-reload";

/** A failed dynamic import: a chunk the server no longer has, or no network. */
function isChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /dynamically imported module|Importing a module script failed|Failed to fetch|error loading dynamically|ChunkLoadError/i.test(msg);
}

/**
 * `React.lazy` that survives a deploy. A tab opened before a release still
 * references the old content-hashed chunk names; once those files are gone
 * the import fails. Reload the page once to pick up the new index.html —
 * the flag stops a reload loop when the network is genuinely down.
 */
// Same constraint as React.lazy's own signature (props are inferred per page).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyPage<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      const mod = await factory();
      try {
        sessionStorage.removeItem(RELOAD_KEY);
      } catch {
        /* storage blocked */
      }
      return mod;
    } catch (err) {
      let reloaded = false;
      try {
        reloaded = sessionStorage.getItem(RELOAD_KEY) === "1";
        if (!reloaded && isChunkLoadError(err)) sessionStorage.setItem(RELOAD_KEY, "1");
      } catch {
        reloaded = true; // can't remember the attempt → don't risk a loop
      }
      if (!reloaded && isChunkLoadError(err)) {
        window.location.reload();
        // Keep Suspense showing its fallback until the reload happens.
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }
  });
}
