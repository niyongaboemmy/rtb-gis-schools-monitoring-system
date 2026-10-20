/** Turns an Axios-style error into a short, readable sentence. */
export function errorMessage(err: unknown, fallback = "Something went wrong while loading this data."): string {
  const e = err as {
    response?: { status?: number; data?: { message?: string | string[] } };
    message?: string;
  };
  const status = e?.response?.status;
  if (status === 403) return "You do not have access to this information.";
  if (status === 404) return "We could not find what you were looking for.";
  const m = e?.response?.data?.message;
  if (Array.isArray(m)) return m.join(" ");
  if (typeof m === "string" && m) return m;
  if (e?.message === "Network Error") return "Cannot reach the server. Check your connection and try again.";
  return fallback;
}
