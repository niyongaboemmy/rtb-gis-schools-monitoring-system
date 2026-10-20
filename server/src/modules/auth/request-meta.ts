/** Who/where a request came from, for sessions and audit entries. */
export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

export function requestMeta(req: {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
}): RequestMeta {
  const ua = req?.headers?.['user-agent'];
  return {
    ip: req?.ip,
    userAgent: (Array.isArray(ua) ? ua[0] : ua)?.slice(0, 512),
  };
}
