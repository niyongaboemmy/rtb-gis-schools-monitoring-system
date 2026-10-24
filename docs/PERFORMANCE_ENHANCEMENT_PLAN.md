# Browser performance enhancement plan

23 Oct 2026 · Covers why the web app slows down on some computers, what we
measured, and a phased plan to fix it. A few functional and security defects
found during the same review are listed at the end.

## Summary

The app is slow on weaker laptops for four reasons, in order of impact:

1. **Too much JavaScript before the first screen.** Every visit downloads and
   runs about 15 MB of JavaScript (4.2 MB compressed). 5.7 MB of it is
   Cesium, which the app never uses.
2. **The GPU never rests.** The 3D viewer redraws 60 times a second even
   when nothing moves. Endless animations and large blurred panels make the
   browser repaint all the time, even on plain dashboard pages.
3. **API responses carry data the screen does not use.** The schools list
   is 1.39 MB for 8 schools. 82% of that is a 2D tile index that the client
   never reads.
4. **The 3D viewer does not release GPU memory** when it closes.

Most of the gain comes from Phase 1 (about 2 days). It needs no visual
redesign.

> **Fix first (security, not performance):** a search term makes the schools
> API ignore every other filter, **including the user's access scope**.
> See [S1](#s1-search-bypasses-filters-and-access-scope).

## How we measured

- **Build:** the production client, served locally against the dev API and
  database (8 schools; Huye TSS has an 18.9 MB optimised model plus 2D tiles).
- **Browser:** Playwright with Chromium. Headless Chromium draws WebGL in
  software (SwiftShader). That is a fair stand-in for a weak integrated GPU,
  but it makes GPU-bound pages look worse than on a good GPU.
- **Low-end laptop:** CPU slowed 4× through the DevTools protocol.
- **Idle cost:** each page was left untouched for 5 s while we recorded
  main-thread CPU, style recalculations, layouts and frames per second. A
  healthy idle page uses about 0% CPU and holds 60 fps.
- **Leaks:** open and close the 3D viewer 6 times, force garbage collection,
  compare.
- **Production:** HTML, asset sizes and response headers fetched from
  `rtb.aerovyntech.com`.

The scripts are `perf.cjs` (routes, cold load, leak test) and `hot.cjs`
(CPU profile, running animations, blur census). Task P6.1 moves them into
the repo.

## Baseline

### Start-up (login page, empty cache)

| Measure | Value |
|---|---|
| JavaScript transferred | 3.6 MB compressed (local), 4.2 MB (production) |
| JavaScript parsed | 9.27 MB app bundle + 5.7 MB `Cesium.js` |
| Main-thread blocking at 4× CPU | 1.86 s total, longest single freeze 788 ms |
| Requests | 8, one huge app file plus Cesium |
| Cache headers in production | none (no `Cache-Control`, no `immutable`) |
| Compression in production | gzip on the fly (`Transfer-Encoding: chunked`), no pre-compressed files, HTTP/1.1 |

What the 9.27 MB app bundle is made of (share of source):

| Package | Share | Needed on the login page? |
|---|---|---|
| three | 18.9% | No, 3D viewer only |
| ol (OpenLayers) | 16.1% | No, 2D site viewer only |
| app components | 15.7% | Partly |
| xlsx | 7.0% | No, bulk upload only |
| recharts (+ redux toolkit, immer) | 7.6% | No, two analytics screens |
| react-dom | 4.3% | Yes |
| leaflet | 3.5% | No, maps only |
| geotiff | 3.4% | No |
| react-router | 2.8% | Yes |
| framer-motion + motion-dom | 4.1% | Partly |

### Idle cost per page (no interaction, CPU not slowed)

| Page | Idle main-thread CPU | Frames per second | What keeps it busy |
|---|---|---|---|
| Dashboard `/` | 1.4% | **11** (1.6 at 4×) | 13 endless SVG animations (`rb-pulse`, `rb-breathe`, `rb-sweep`) under 14 visible blurred panels |
| National map `/map` | 3.0% | 93 | `scm-ping` pin pulse: **94 style recalculations per second** |
| School detail `/schools/:id` | **34.8%** | **1.4** | 3D canvases + 17 endless framer-motion animations + 40 visible blurred elements |
| School decision `/schools/:id/decision` | 2.6% | **3.6** | Same hero backdrop (17 endless animations, 40 blurred elements) |
| 3D explorer | 1.3% | **1.8** | three.js loop renders every frame (GPU-bound) |
| School 3D view (Kigali) | **63.1%** | **2.2** | Render loop + overlays, 42 blurred elements |
| Schools list, Analytics, Reports, Settings | ≤ 2.7% | 90–120 | Healthy |

### Memory (3D viewer opened and closed 6 times)

| Measure | Result |
|---|---|
| JS heap after close and garbage collection | Back to about 25 MB each time. **No JS leak** |
| Detached DOM nodes | +220 per cycle (1,989 → 3,098) |
| Event listeners | +38 per cycle (766 → 968) |
| WebGL contexts created | +1 per cycle; never disposed or force-lost |
| Heap while the viewer is open | about 110 MB |

### API payloads

| Endpoint | Size | Problem |
|---|---|---|
| `GET /schools?limit=1000` | **1.39 MB for 8 schools** | `kmz2dManifest` is 1.14 MB of it, from just 2 schools. Projected size: about 570 KB per school that has 2D imagery, so roughly 57 MB at 100 processed schools. The client never reads this field from the list. The remaining ~250 KB was not traced to a column in the database and is probably eager-loaded relations; check this first in P5.1. |
| `GET /reports?limit=1000` | grows with reports | Joins the full `school` row (all JSON columns) onto every report. No upper limit on `limit`. The review screen loads up to 10 × 1000. |
| `GET /schools/geojson` | grows with schools | `find()` loads every school with every column, then filters in memory. |

## Root causes

### R1. Cesium is injected into every page

`vite-plugin-cesium` (`client/vite.config.ts:16`) adds this to the top of
`index.html`:

```html
<link rel="stylesheet" href="/cesium/Widgets/widgets.css">
<script src="/cesium/Cesium.js"></script>
```

- It is a plain, synchronous script, so the browser stops building the
  page until it has downloaded and run 5.7 MB of code.
- Nothing in `client/src` imports `cesium` or `resium`. The viewer moved
  to three.js and the plugin stayed behind.
- The build also copies 13 MB of Cesium assets to `dist/cesium`.

### R2. No code splitting

- `client/src/App.tsx:9-35` imports every page statically, including
  `School3DView`.
- There is no `React.lazy`, and `vite.config.ts` has no chunking setup.
- So the login screen pays for three.js, OpenLayers, Leaflet, recharts and
  xlsx.
- `xlsx` is imported dynamically in `SchoolsList.tsx` but statically in
  `users/BulkUploadModal.tsx`, which cancels the split. The build warns about
  this.

### R3. Assets are not cached between visits or deploys

`deploy/nginx/rtb.aerovyntech.com.conf` has gzip on, but:

- **No caching headers.** Its `location /` sends no `Cache-Control`, so
  browsers guess. File names under `/assets/` are content-hashed and safe
  to cache for a year, but nothing tells the browser.
- **The cache resets on every deploy.** `Last-Modified` changes for every
  file, even unchanged ones.
- **Compression costs CPU on every request.** It is done per request
  instead of once at build time (`gzip_static`), and there is no Brotli.
- **The server only listens on port 80** (TLS presumably ends in front of
  it), and responses arrive over HTTP/1.1, so the browser cannot download
  files in parallel over one connection.

### R4. The 3D viewer renders continuously at top quality

`client/src/components/School3DView.tsx`:

- **Render loop** (`animate`, around line 1571): calls
  `requestAnimationFrame` every frame and always calls `renderer.render()`
  and `drawOverlay()`, whether or not the camera, model or overlays changed.
- **Watchdog** (around line 1653): restarts the loop every 2 s if it ever
  stops.
- **`drawOverlay`** (around line 1299): clears the overlay canvas and
  raycasts once per pin or annotation, every frame, to test occlusion.
- **Renderer settings** (line 1534):

  | Setting | Cost |
  |---|---|
  | `preserveDrawingBuffer: true` | Stops the GPU from swapping buffers cheaply. Only screenshots need it, and the screenshot code already re-renders before reading pixels. |
  | `logarithmicDepthBuffer: true` | Computes depth in the fragment shader, which turns off the GPU's early depth test. Every hidden pixel is shaded too. |
  | `antialias: true` + pixel ratio up to 2 | On a retina screen, 4× the pixels, each with multisampling. |
  | `powerPreference: "high-performance"` | Wakes the discrete GPU on dual-GPU laptops; drains battery. |

- **No low-quality mode.** Texture budgets already adapt to the device
  (`lib/viewer3d/gpu-budget.ts`, `deviceClass()`), but render quality does not.

### R5. The 3D viewer does not clean up

- The unmount effect (around line 1701) only cancels the frame loop and the
  watchdog.
- Nothing calls `renderer.dispose()`, `renderer.forceContextLoss()` or
  `controls.dispose()`.
- The model's geometries, BVH trees, materials and textures are never
  disposed.
- Turning wireframe on creates a new `MeshBasicMaterial` per mesh each time
  (around line 655).
- `School2DViewer.tsx` mounts `<School3DView key={focus3d ?? "school"}>`, so
  every building focus or 2D↔3D switch builds a new renderer and uploads the
  whole model to the GPU again.
- Chrome allows about 16 live WebGL contexts per page. Laptops whose GPU
  shares system RAM feel the pressure much sooner.

### R6. Endless decorative animations under heavy blur

- **Dashboard backdrop** (`components/dashboard/RwandaBackdrop.tsx`, around
  lines 338, 489, 529-541): an infinite `rb-pulse` circle per critical or
  high school, plus `rb-breathe`, `rb-sweep` and `rb-halo`. All sit inside a
  full-width SVG with an `feGaussianBlur` glow. Animations inside an SVG are
  not composited, so the browser repaints the whole SVG every frame.
- **School pages** (`components/school-dashboard/HeroBackdrop.tsx`, around
  lines 123-317): three blobs of about 600 px with `blur-[120-130px]` drift
  forever. Contour rings scale forever. A mouse parallax drives framer-motion
  on the main thread.
- **National map** (`components/maps/schoolMap.ts:44`, `index.css:223-248`):
  an infinite `scm-ping` pulse on every critical or high pin.
- **Blur over moving content**: 66 files use `backdrop-blur`. The worst
  cases sit over content that changes every frame:

  | File | Over what |
  |---|---|
  | `FloatingStat.tsx` | Animated dashboard backdrop. Uses `backdrop-blur-2xl` plus `backdrop-saturate-[1.8]` |
  | `MapHud.tsx` | OpenLayers map |
  | `ViewerRightToolbar.tsx` | three.js canvas |
  | `national-map/tokens.ts` | National map |

  A blurred panel is recomputed every time what's behind it changes. A blur
  of 24–40 px is one of the most expensive things a weak GPU can be asked to
  do.
- **Reduced motion:** animations stop when the OS asks for reduced motion
  (197 checks in the code). Nothing switches them off for weak hardware.

### R7. The 2D map keeps running under the 3D tab

- In `School2DViewer.tsx` the 3D tab is an overlay. The OpenLayers map
  underneath (WebGL basemap, labels, overlay layers) stays mounted and keeps
  rendering, so two WebGL engines run at once.
- Removed OpenLayers layers are never `dispose()`d
  (`useKmzLoader.ts:196`, `useMapSetup.ts:352`).
- Full-resolution `ImageBitmap`s from KMZ ground overlays are cached and
  never `close()`d (`useKmzLoader.ts:411-416`). This applies to overlays the
  server has not tiled.

### R8. List endpoints return whole rows

- **Schools list:** `schools.service.ts` `findAll` has no column list, so it
  returns every JSON column, including `kmz2dManifest`, `geojsonContent`,
  `placesOverlayData`, `siteAnnotations`, `glb3dAnnotations`, `facilities`
  and `modelVariants`.
- **Dashboard refetch:** `Dashboard.tsx:108-111` invalidates and refetches
  this list on every visit, and other pages use the same cached list.
- **Reports:** `reports.service.ts:166-168` uses `leftJoinAndSelect` on
  school, building and reporter.
- **National map GeoJSON:** `getGeoJson` loads every school and filters in
  memory.
- **Missing indexes:**
  - `issue_reports`: `schoolId`, `status`, `createdAt`.
  - `school_buildings`: `schoolId`.
  - `schools`: `status` (every aggregate filters on it) and `overallScore`
    (the list sorts by it).

### R9. Smaller costs on the main thread

- **Store subscriptions:** about 25 components read the whole
  `useAuthStore()` or `useSchoolsStore()` without a selector, including
  `AppLayout` and `useAuthorization`. Any store change re-renders the layout
  and most of the page.
- **Socket.IO:** up to 4 connections per tab (`AppLayout`,
  `SchoolDecisionDashboard`, `School2DViewer`, `useSiteFeatures`).
- **National map:** hovering one school re-renders every marker
  (`SchoolLayer.tsx`). Density mode draws one SVG circle per school.
- **Dark map tiles:** dark mode, the default, puts a five-step CSS `filter`
  chain on the whole tile layer (`nationalMap.css:153`), re-applied while
  panning.
- **Login page:** the globe on the login page (`AuthGlobe.tsx`) animates
  continuously. It already pauses when off-screen.

## Targets

Measured with the same scripts, on the production build, CPU slowed 4×:

| Measure | Now | Target |
|---|---|---|
| JavaScript before the login page (compressed) | 4.2 MB | **≤ 400 KB** |
| Main-thread blocking on the login page | 1.86 s | **≤ 300 ms** |
| Returning visit after a deploy that didn't touch a file | full re-download | **0 bytes for that file** |
| Idle CPU on any page, 3D viewer included | up to 63% | **≤ 3%** |
| Idle fps, Dashboard and school pages | 1.6–11 | **≥ 50** |
| WebGL contexts alive after closing the viewer | +1 per open | **0** |
| Detached DOM after 6 viewer cycles | +1,100 nodes | **< 100** |
| `GET /schools?limit=1000`, 8 schools | 1.39 MB | **≤ 50 KB** |

## The plan

Effort figures are estimates for one engineer who knows the codebase.

### Phase 0: security fix (½ day, do now)

See [S1](#s1-search-bypasses-filters-and-access-scope). It ships on its own.

### Phase 1: load less, cache it (≈ 2 days, biggest win)

**P1.1 Remove Cesium.** *(1 h, low risk)*

- Delete `cesium()` from `vite.config.ts`, plus `cesium` and `resium` from
  `optimizeDeps.include`, `resolve.dedupe`, the `resium` alias and
  `ssr.noExternal`.
- Uninstall `cesium`, `resium` and `vite-plugin-cesium`. Also remove
  `dayjs` and `@tanstack/react-query`, which nothing imports.
- Update the stale Cesium wording in `KmzUpload.tsx` and in CLAUDE.md
  ("3D visualization (CesiumJS)").
- Check: `dist/index.html` has no `/cesium/` tag, and `dist/cesium/` is gone.
- Effect: 5.7 MB (1.7 MB compressed) less on every first visit, and the
  page is no longer blocked on that download.

**P1.2 Lazy-load routes.** *(½ day, low risk)*

- In `App.tsx`, load every page except Login, ForgotPassword and
  `AppLayout` with `lazy(() => import(...))`.
- Wrap the route outlet in one `<Suspense>` with the existing splash or
  skeleton.
- In `School2DViewer.tsx` and `SchoolMap.tsx`, load `School3DView` on
  demand.
- Remove the static `xlsx` import from `BulkUploadModal.tsx`; use
  `await import("xlsx")` when a file is picked.
- Optional, nice to have: prefetch the user's home route
  (`homePathFor()`) right after login.

**P1.3 Split the large libraries into stable chunks.** *(2 h)*

- In `vite.config.ts`, give three, OpenLayers, Leaflet and recharts their own
  chunks. Rolldown (Vite 8) uses `build.rolldownOptions.output` code
  splitting groups; plain `manualChunks` also works.
- They then stay cached across deploys that only change app code.
- Raise `chunkSizeWarningLimit` only for the `three` chunk.

**P1.4 Cache and compress properly in nginx.** *(2 h, ops)*

```nginx
location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    gzip_static on;          # serve the .gz written at build time
    try_files $uri =404;
}
location = /index.html {
    add_header Cache-Control "no-cache";
}
```

- Pre-compress at build time: a Vite compression plugin, or
  `gzip -k -9` / `brotli -k` over `dist/assets` in the deploy script.
- Enable HTTP/2 wherever TLS ends.
- Brotli needs the nginx module. If it isn't available, `gzip_static` alone
  is still a clear win.
- Check: a second visit after a deploy re-downloads only the chunks that
  changed.

**P1.5 Add a bundle budget to CI.** *(1 h)*

- A small script fails the build if the entry chunk is over 400 KB
  compressed, or if `index.html` references `/cesium/`.
- This stops R1 and R2 from coming back.

### Phase 2: stop the GPU working when nothing moves (≈ 3 days)

**P2.1 Render the 3D viewer only when needed.** *(1½ days, medium risk)*

In `School3DView.tsx`:

1. Add `needsRenderRef` and `requestRender()`.
2. Call `requestRender()` on controls `change`, while damping or key
   velocity is non-zero, and on resize, model load, visibility, measure,
   annotation, pin and theme changes.
3. In `animate`, return early unless something requested a frame. Keep the
   loop going only while damping, keys or velocity are active.
4. Run the occlusion raycasts in `drawOverlay` only after the camera has
   changed, and cache the results.
5. Replace the endless pin pulse (`Math.sin(Date.now())`) with a pulse of
   about 1 s after selection, or a CSS animation on a DOM marker.
6. Keep the watchdog, but have it restart the loop only when a frame was
   requested and none was drawn.

Risk: a missed trigger leaves a stale frame. Mitigation: route every state
setter that affects the scene through one helper, and test orbit, zoom, pan,
WASD, measure, annotate, screenshot and resize by hand.

**P2.2 Cheaper renderer defaults.** *(½ day)*

- Remove `preserveDrawingBuffer`. Screenshots already re-render before
  `toDataURL` (around lines 1987-1993). Verify after the change.
- Turn on `logarithmicDepthBuffer` only when the scene's far/near ratio
  needs it (very large site extents). Otherwise set a tight `near`.
- Use `powerPreference: "default"`.

**P2.3 Quality tiers.** *(1 day)*

- Extend `deviceClass()` in `lib/viewer3d/gpu-budget.ts` into
  `low | standard | high`, using:
  - `navigator.deviceMemory` and `navigator.hardwareConcurrency`;
  - the WebGL renderer string (`WEBGL_debug_renderer_info`: "Intel",
    "SwiftShader", "llvmpipe" and "Mali" mean low);
  - a frame-time check during the first 2 s after load.
- **Low tier:** pixel ratio 1, no MSAA, smaller texture budget, the
  lighter model variant.
- **Standard tier:** pixel ratio up to 1.5.
- **High tier:** today's settings.
- If frames stay over 40 ms, drop one tier automatically.
- Add a "Graphics quality: Auto / Low / High" option to the viewer settings,
  remembered per browser.

**P2.4 Pause what can't be seen.** *(½ day)*

- Stop the render loop when the tab is hidden (`visibilitychange`) or the
  canvas is off-screen (`IntersectionObserver`).
- In `School2DViewer`, while the 3D tab is open, hide the OpenLayers target
  (`display:none`) or set `map.setTarget(undefined)`, and restore it on close.

### Phase 3: free memory on close (≈ 1½ days)

**P3.1 Proper 3D teardown.** *(1 day)*

In the unmount effect:

1. Traverse the model. For each mesh: `geometry.disposeBoundsTree?.()`,
   `geometry.dispose()`, then each material's textures and the material.
2. Call `controls.dispose()`, `renderer.renderLists.dispose()`,
   `renderer.dispose()` and `renderer.forceContextLoss()`.
3. Remove the canvas.
4. Remove every window and document listener added in `initThree`. The
   leak test shows +38 listeners and +220 DOM nodes per cycle; find them
   with a heap snapshot and the "Detached" filter.
5. Cache one shared wireframe material instead of creating one per mesh.

Check: WebGL contexts alive after 6 cycles = 0, and detached DOM stays flat.

**P3.2 Stop remounting the 3D view on building focus.** *(½ day)*

- In `School2DViewer`, keep one `School3DView` instance.
- Pass `focus3d` as a prop that moves the camera. Today the `key` change
  rebuilds the renderer.

**P3.3 OpenLayers cleanup.** *(½ day)*

- Call `layer.dispose()` (and dispose the source) for every removed layer.
- On unmount, dispose all layers, then the map.
- `close()` cached `ImageBitmap`s when the school changes and on unmount.
- Before relying on it, check `dispose()` behaviour against the OpenLayers
  10 docs.

### Phase 4: a light visual-effects mode (≈ 2 days)

**P4.1 One switch for effects.** *(1 day)*

- Add a `data-fx="full" | "lite"` attribute on `<html>`, set by a small
  `useEffectsLevel()` hook.
- It turns "lite" on automatically when:
  - the OS asks for reduced motion;
  - `deviceMemory ≤ 4` or `hardwareConcurrency ≤ 4`;
  - the 3D quality tier is low;
  - or a 1 s frame-time probe after the first paint averages over 25 ms.
- The user can override it in Profile ▸ Preferences.
- In "lite":
  - `backdrop-filter` becomes a solid or semi-opaque surface (one rule
    in `index.css`, plus the token in `national-map/tokens.ts`);
  - endless CSS animations are paused (`animation: none`);
  - framer-motion uses `MotionConfig reducedMotion="always"` at the app
    root;
  - the hero and dashboard backdrops render as static images.

**P4.2 Make the defaults cheap too.** *(1 day)*

These apply even in "full", because they cost a lot and add little:

| Where | Change |
|---|---|
| `RwandaBackdrop` | Pulse only the selected or hovered school, or run the pulse 3 times and stop. Remove the `feGaussianBlur` filter, or pre-render the glow once. |
| `HeroBackdrop` | Animate the blobs once on mount, then hold still. Drop the mouse parallax, or limit it to `transform` on one composited layer. |
| `scm-ping` (map) | Animate only `transform` and `opacity` (composited, no style recalc). Run 3 cycles, then stop. |
| Blur over maps, the 3D canvas and animated backdrops | Use solid surfaces (`MapHud`, `ViewerRightToolbar`, `FloatingStat`, national-map panels). Keep blur only over static content. |
| Dark basemap | Use a dark tile style from the provider instead of the CSS `filter` chain in `nationalMap.css:153`. |

Check: Dashboard and school pages hold ≥ 50 fps at idle in the probe;
style recalculations at idle drop to about 0 per second on `/map`.

### Phase 5: lighter data from the API (≈ 2–3 days)

**P5.1 Lightweight school list.** *(1 day)*

- Give `findAll` an explicit column list: id, name, code, location, type,
  status, scores, priority, counts, `kmzStatus`, `modelOptimized`.
- Leave out `kmz2dManifest`, `geojsonContent`, `placesOverlayData`,
  `siteAnnotations`, `glb3dAnnotations`, `facilities` and `modelVariants`.
  The detail endpoint still returns them.
- Before removing each field, `grep` every client consumer of the list
  type. The client never reads `kmz2dManifest` from the list.
- Cap `limit` at 200 on the server.
- Fix the client to page using `total` (see F3).

**P5.2 Reports.** *(½ day)*

- Select only school `id, name, code, province, district` (and the same
  for building and reporter) instead of `leftJoinAndSelect`.
- Cap `limit`.
- Give the review and analytics screens a stats endpoint instead of
  10 × 1000 rows.

**P5.3 GeoJSON and decisions.** *(½ day)*

- Move the status and scope filters into SQL in `getGeoJson`
  (`whereActiveSchool`, `applySchoolScope`) and select only the fields the
  map uses.
- Give `getDecisions` the same treatment.

**P5.4 Indexes (one migration).** *(½ day)*

- `issue_reports (schoolId)`, `(status)`, `(createdAt)`.
- `school_buildings (schoolId)`.
- `schools (status)`, `(overallScore)`.

**P5.5 Don't refetch on every Dashboard visit.** *(2 h)*

- Replace `invalidateAllSchools()` + `fetchAllSchools()` on mount
  (`Dashboard.tsx:108-111`) with stale-while-revalidate, for example a
  60 s freshness window.
- Socket events already announce school changes; use them to invalidate.

### Phase 6: React hygiene and guardrails (≈ 2 days)

**P6.1 Commit the perf probe.** *(½ day)*

- Move `perf.cjs` and `hot.cjs` into `client/perf/`, with an
  `npm run perf` script.
- Run them before each release and record results in this document.
- Optional: run nightly in CI at 4× CPU and fail on target regressions.

**P6.2 Zustand selectors.** *(½ day)*

- Replace the ~25 whole-store reads with selectors, or `useShallow`,
  starting with `AppLayout.tsx` and `useAuthorization.ts`.

**P6.3 One socket per tab.** *(½ day)*

- Make `connectSocket()` reference-counted and shared, so screens join
  rooms on it instead of opening new connections.

**P6.4 National map.** *(½ day)*

- Do the hover dimming with a CSS class on the container instead of a
  React re-render.
- Use Leaflet's canvas renderer (`preferCanvas`) for the density layer.

## Order of work and expected effect

| Order | Work | Effort | Main effect |
|---|---|---|---|
| 0 | S1 search/scope fix | ½ d | Closes data exposure |
| 1 | P1.1–P1.5 | 2 d | First load: about 15 MB → under 1 MB of JS (estimate). Returning visits mostly cached |
| 2 | P4.2 (cheap defaults) | 1 d | Dashboard and school pages idle smoothly on any laptop |
| 3 | P2.1, P2.2, P2.4 | 2½ d | 3D viewer idle CPU and GPU near zero; battery and fans calm |
| 4 | P3.1–P3.3 | 2 d | No GPU memory growth when moving between schools |
| 5 | P5.1–P5.5 | 2½ d | List responses roughly 25× smaller; size no longer grows with imagery |
| 6 | P2.3, P4.1 | 2 d | Weak machines get a reduced-effects and low-graphics mode automatically |
| 7 | P6.1–P6.4 | 2 d | Fewer re-renders; regressions caught early |

Total: about 14 engineer-days. Phases 0–1 and P4.2 (3½ days) remove most of
what users notice.

## Verification for each phase

1. Run `npm run perf` (after P6.1; before then, the scratch scripts) on the
   production build:
   - with no CPU slowdown and at 4× CPU;
   - compare against the baseline tables above.
2. Hand-test on a real low-end machine: an Intel UHD laptop with 8 GB RAM
   running Chrome. Use DevTools ▸ Performance, and the Rendering ▸ "Frame
   rendering stats" overlay.
3. Run the existing suites: client `npm run test` and `npm run build`,
   server `npm run test`, and the e2e suite on a throwaway database.
4. After Phase 1 is deployed, `curl -I` an `/assets/` file on production
   and check for `Cache-Control: ... immutable` and `Content-Encoding`.

## Defects found during the same review

These are not performance problems, but they turned up during testing.

### S1. Search bypasses filters and access scope

**Severity: critical (data exposure).**

- `server/src/modules/schools/schools.service.ts:159-163` builds:

  ```sql
  school.name ILIKE :s OR school.code ILIKE :s OR school.district ILIKE :s
  ```

  without brackets, and then appends the other filters and
  `applySchoolScope` with `AND`.
- In SQL, `AND` binds tighter than `OR`, so a name or code match returns
  any school, whatever the user's scope.
- Reproduced on the dev API:
  - `?status=inactive` → 0 schools; `?status=inactive&search=a` → 7,
    all active or under renovation.
  - `?province=NoSuchProvince` → 0; adding `&search=a` → 7.
- Fix:

  ```ts
  qb.where(new Brackets((w) => w
    .where('school.name ILIKE :search')
    .orWhere('school.code ILIKE :search')
    .orWhere('school.district ILIKE :search')), { search: `%${search}%` });
  ```

- Add a case to `permission-matrix.e2e-spec.ts`: a district officer searches
  `?search=a` and gets schools from their own district only.
- `kmz.service.ts:394`, `audit-query.ts:90` and `analytics.service.ts:143`
  already bracket their `OR`s.

### Functional defects

| # | Severity | Where | Defect | Fix |
|---|---|---|---|---|
| F1 | High | `school-form-steps/StaffStep.tsx` | `CategoryCard` is declared inside the component, so inputs lose focus after every key press | Move it to module level |
| F2 | High | `SchoolReporting.tsx:2152-2175`, `2283-2295` | Edit and Delete show for users without `MANAGE_REPORTS`; they fill in the form, then get a 403 that loses their work | Gate on `canTriage`, or let report owners edit on the server |
| F3 | Medium | `store/schoolsStore.ts:203` | Reads `meta.totalPages`, which the server never sends, so "all schools" stops at 1,000 | `Math.ceil(total / limit)` |
| F4 | Medium | `SchoolReporting.tsx:318`, `SchoolDecisionDashboard.tsx:146`, `AnalyticsDecisions.tsx:62` | Load failures show as "no data" | Add error states with a retry |
| F5 | Medium | `SchoolReporting.tsx:296-405` | An aborted fetch clears the spinner while the newer request is still running | `if (!signal.aborted)` in `finally`, as in `useReviewData.ts` |
| F6 | Medium | `App.tsx:79` | The 3D explorer's Close calls `window.close()`, which does nothing in a tab the user opened | Fall back to `navigate(/schools/:id/decision)` |
| F7 | Medium | `analytics.service.ts:931` + `AnalyticsDecisions.tsx:42` | "Recalculate all" runs inside the HTTP request, and the client shows it to scoped roles the server rejects | Run it as a background job with progress; match the national-scope gate |
| F8 | Low | `SchoolsList.tsx:912`, `:1631`, CSV export | Raw enum values ("INTEGRATED") | `label()` from `lib/labels.ts` |
| F9 | Low | 8 icon-only buttons (`ViewerMovementControls.tsx:46`, `ProgramsStep.tsx:127`, `file-preview.tsx:100`, …) | No `aria-label` | Add labels |
| F10 | Low | `SchoolsList.tsx:497`, `AnalyticsDecisions.tsx:97` | Blob URL revoked right after `click()`; the download can fail in Firefox and Safari | Use the existing `downloadBlobUrl` helper |
| F11 | Low | Client lint | 212 problems (174 `no-explicit-any`, 14 `exhaustive-deps`, 4 `static-components`) | Fix `static-components` and `exhaustive-deps` first; they are real bugs (F1) |
| F12 | Low | `pages/SchoolDetail.tsx`, `School3DViewPage.tsx:27-37` | Dead page; `console.log` left in production code | Delete or route it; remove the logs |

### Test status at review time

| Check | Result |
|---|---|
| Client type check | Passes |
| Client unit tests | 231 pass |
| Server type check | Passes |
| Server unit tests | 581 pass |
| Client lint | Fails (212 problems) |
| Client and server permission lists | Identical (38 permissions) |
