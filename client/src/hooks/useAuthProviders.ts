import { useEffect, useState } from "react";
import { fetchAuthProviders, type AuthProviders } from "../lib/tdmp";

/**
 * Sign-in methods offered by the server (GET /auth/providers), or null while
 * loading. Cached for the page load; an older server reports password + Google.
 */
export function useAuthProviders(): AuthProviders | null {
  const [providers, setProviders] = useState<AuthProviders | null>(null);
  useEffect(() => {
    let alive = true;
    void fetchAuthProviders().then((p) => {
      if (alive) setProviders(p);
    });
    return () => {
      alive = false;
    };
  }, []);
  return providers;
}
