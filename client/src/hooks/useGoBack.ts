import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Returns a "go back" handler that steps through browser history when possible
 * (so the user lands wherever they actually came from — Dashboard, National Map,
 * a deep link, …) and only falls back to a concrete route when there is no
 * history entry to return to (e.g. the page was opened directly).
 *
 * React Router stamps `window.history.state.idx` on every entry it creates;
 * `idx > 0` means there is somewhere to go back to within this SPA session.
 */
export function useGoBack(fallback = "/schools") {
  const navigate = useNavigate();
  return useCallback(() => {
    const idx: number =
      (typeof window !== "undefined" &&
        (window.history.state as { idx?: number } | null)?.idx) ||
      0;
    if (idx > 0) navigate(-1);
    else navigate(fallback);
  }, [navigate, fallback]);
}
