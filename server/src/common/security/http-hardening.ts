import type { HelmetOptions } from 'helmet';

/**
 * HTTP-level hardening shared by `main.ts` (and `serverless.ts`): security
 * headers (WS9.9, WS9.13) and per-route body-size limits (WS9.6).
 */

/** Third-party origins the client really talks to. Keep in sync with client. */
const TILE_ORIGINS = [
  'https://tile.openstreetmap.org',
  'https://*.tile.openstreetmap.org',
  'https://*.tile.opentopomap.org',
  'https://*.basemaps.cartocdn.com',
  'https://server.arcgisonline.com',
  'https://*.arcgisonline.com',
  'https://services.arcgis.com',
  'https://mt0.google.com',
  'https://mt1.google.com',
  'https://mt2.google.com',
  'https://mt3.google.com',
  'https://geodata.rw',
  // Cesium ion + default Bing imagery
  'https://*.cesium.com',
  'https://*.virtualearth.net',
];

const GOOGLE_SIGN_IN = ['https://accounts.google.com'];

/**
 * Content-Security-Policy directives for the SPA. Exported as a header string
 * too (`cspHeaderValue`) so nginx, which serves `index.html`, can send the
 * exact same policy.
 */
export function cspDirectives(): Record<string, string[]> {
  return {
    'default-src': ["'self'"],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
    'frame-ancestors': ["'none'"],
    'form-action': ["'self'"],
    // 'wasm-unsafe-eval': meshopt / draco / basis decoders compile WebAssembly.
    'script-src': [
      "'self'",
      "'wasm-unsafe-eval'",
      'https://accounts.google.com/gsi/client',
      // three.js DRACOLoader fetches its decoder from gstatic.
      'https://www.gstatic.com',
    ],
    // Cesium, three and the decoders spawn workers from blob: URLs.
    'worker-src': ["'self'", 'blob:'],
    'child-src': ["'self'", 'blob:'],
    // Tailwind/motion inject inline styles; Google sign-in ships a stylesheet.
    'style-src': [
      "'self'",
      "'unsafe-inline'",
      'https://fonts.googleapis.com',
      'https://accounts.google.com/gsi/style',
    ],
    'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
    'img-src': [
      "'self'",
      'data:',
      'blob:',
      'https://*.googleusercontent.com',
      'https://cdnjs.cloudflare.com',
      'https://images.unsplash.com',
      ...TILE_ORIGINS,
    ],
    'media-src': ["'self'", 'blob:', 'data:'],
    'connect-src': [
      "'self'",
      'ws:',
      'wss:',
      'blob:',
      'data:',
      'https://www.gstatic.com',
      'https://api.open-elevation.com',
      'https://elevation-api.io',
      ...GOOGLE_SIGN_IN,
      ...TILE_ORIGINS,
    ],
    'frame-src': ['https://accounts.google.com'],
    'upgrade-insecure-requests': [],
  };
}

export function cspHeaderValue(): string {
  return Object.entries(cspDirectives())
    .map(([k, v]) => (v.length ? `${k} ${v.join(' ')}` : k))
    .join('; ');
}

/** Permissions-Policy: geolocation is used by the location picker. */
export const PERMISSIONS_POLICY =
  'camera=(), microphone=(), payment=(), usb=(), geolocation=(self), fullscreen=(self)';

export function helmetOptions(isProd: boolean): HelmetOptions {
  return {
    // CSP only in production: Vite's dev server needs inline/eval for HMR.
    contentSecurityPolicy: isProd
      ? { useDefaults: false, directives: cspDirectives() }
      : false,
    // Cesium/three load cross-origin tiles and textures.
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-site' },
    // Google sign-in popups need to talk back to the opener.
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    strictTransportSecurity: isProd
      ? { maxAge: 31536000, includeSubDomains: true }
      : false,
  };
}

/**
 * Routes that legitimately post large JSON (geometries, bulk rows, viewer
 * state). Everything else is capped at `DEFAULT_BODY_LIMIT`. Multipart file
 * uploads go through multer and are unaffected by these limits.
 */
export const LARGE_BODY_ROUTES: RegExp[] = [
  /^\/api\/v1\/users\/bulk-json\/?$/,
  /^\/api\/v1\/schools\/?$/, // create school (may carry geometry)
  /^\/api\/v1\/schools\/[0-9a-f-]{36}\/?$/i, // update school
  /^\/api\/v1\/schools\/[0-9a-f-]{36}\/buildings\/?$/i,
  /^\/api\/v1\/schools\/buildings\/[0-9a-f-]{36}\/?$/i,
  /^\/api\/v1\/schools\/[0-9a-f-]{36}\/viewer-state\/?$/i,
  /^\/api\/v1\/schools\/[0-9a-f-]{36}\/kmz\/2d\/site-annotations\/?$/i,
  /^\/api\/v1\/schools\/[0-9a-f-]{36}\/site-features(\/.*)?$/i,
];

export const DEFAULT_BODY_LIMIT = '1mb';

export function largeBodyLimit(): string {
  return process.env.LARGE_JSON_BODY_LIMIT?.trim() || '50mb';
}

export function isLargeBodyRoute(path: string): boolean {
  const clean = path.split('?')[0];
  return LARGE_BODY_ROUTES.some((re) => re.test(clean));
}
