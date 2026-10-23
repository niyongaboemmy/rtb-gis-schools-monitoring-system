# 2D map rendering — implementation plan

Goal: the school's site map (drone imagery) appears in about a second, the
page stays responsive while it loads, and no more data is downloaded than the
screen shows. Based on the render audit of 23 Oct 2026 (findings F1–F15).

## Phase 1 — Stop the viewer fighting itself (client + file server)

| # | Change | Where | Finding |
|---|---|---|---|
| 1.1 | Map loading state (tiles loading, images decoding) and cursor coordinates move out of `School2DViewer` React state into a tiny external store; only `MapHud` subscribes. | `2dviewercomponents/map-hud-store.ts` (new), `useKmzLoader`, `useMapSetup`, `MapHud`, `School2DViewer` | F3, F4 |
| 1.2 | Hover hit-test throttled to one per animation frame; the hover outline is rebuilt only when the feature under the cursor changes. | `useMapSetup` | F4 |
| 1.3 | Site-map (KML) styles cached by label + geometry type instead of rebuilt per feature per frame. | `MapUtils.kmlStyle` | F5 |
| 1.4 | Tile pyramids preload one lower level, not all (`preload: 1`). | `useKmzLoader` | F8 |
| 1.5 | Site-map files cached for a year (`immutable`): every upload writes new paths. | `file-server/server.js` | F9 |

Tests: unit tests for the store and style cache; Playwright mouse-move long tasks before/after.

## Phase 2 — One tile pyramid per site map (server + client)

| # | Change | Where | Finding |
|---|---|---|---|
| 2.1 | `buildOverlayPyramid()`: composite every ground overlay (coarse levels first, finest on top) onto one canvas at the finest resolution (capped at 12,288 px), then cut it into a 256 px WebP tile pyramid with sharp/libvips. Result stored under `kmz_2d_content/_pyramid/`. | `server/src/modules/kmz/overlay-pyramid.ts` (new) | F1, F10 |
| 2.2 | The KMZ job builds the pyramid after extracting overlays and records it in the manifest (`manifest.pyramid`). Failures fall back to today's behaviour. | `kmz.service.ts` | F1 |
| 2.3 | Existing schools: `GET kmz/2d/manifest` queues a one-time pyramid build when a manifest has photo overlays but no pyramid (reads the already-stored photos; does not touch coordinates). Admin can also force it. | `kmz.service.ts`, `kmz.controller.ts`, `StorageService.readFile` | F1 |
| 2.4 | Client: when `manifest.pyramid` exists, draw it with the WebGL tile layer (only on-screen tiles) and skip the in-browser compositor entirely. | `useKmzLoader` | F2, F6 |

Tests: unit test of the pyramid builder on generated images (tile count, bounds, coarse/fine order); Playwright on the simulated 21-photo export: bytes, requests, time to full imagery, before/after.

## Phase 3 — Start sooner

| # | Change | Where | Finding |
|---|---|---|---|
| 3.1 | The manifest + KML request starts when the viewer mounts, in parallel with map creation. | `useKmzLoader` | F7 |
| 3.2 | KML compressed by nginx. | `deploy/nginx/*.conf` | F15 |

Not in this round (low impact, noted for later): KML parsing in a worker (F13), incremental building-pin updates (F14), basemap max zoom (F12: needs a check of the provider's real coverage), duplicate school fetch (F11).

---

## Status — implemented 23 Oct 2026

All three phases are done and tested.

### Results (local, Chrome, 1440 × 900)

| Measure | Before | After |
|---|---|---|
| 60 mouse moves over the map | 7 long tasks, 0.57 s blocked | 1 one-time task (~0.2 s); next 120 moves ~0.1 s |
| Site map of 85 photos in 4 detail levels (real upload pipeline) | 85 photos, **7.6 MB**, imagery complete after 4.5–6 s | **17 tiles, ~14 KB** (synthetic photos; real drone tiles are ~10–30 KB each), complete at **1.6 s** after opening |
| Zooming in one step | (all already downloaded) | ~20 more tiles |
| Upload → pyramid ready | — | 2.2–2.6 s for 85 photos (64 used; 21 coarse ones skipped as covered) |
| Manifest request starts | ~0.9 s | ~0.5 s (with the viewer) |

### Bugs found and fixed on the way

- **WebGL tile layers never drew**: style values were passed as layer properties instead of `style.variables` ("Missing variables in style"). This also broke large single images (> 2048 px) tiled on upload.
- **Large tiled images were transposed**: libvips writes `{z}/{y}/{x}`; the viewer asked for `{z}/{x}/{y}` and sized the grid from the width only. New uploads record the pixel size (exact grid); older ones get the axis order corrected.
- The upload's tiler looked for the tile format after deleting the folder (always guessed jpg).
- Rounding each photo's position and size separately left 1 px seams between photos (test: 3,489 see-through pixels before, 0 after).

### Rollout notes (production)

- No migration: the manifest JSON gains `pyramid`. Existing schools get their pyramid built once, in the background, the first time someone opens their map (`build-pyramid` job on the KMZ queue; their photos are read from storage; the school's location is not touched). Anyone with `UPLOAD_KMZ` can force a rebuild: `POST /schools/:id/kmz/2d/pyramid`.
- Memory: the canvas is capped at `KMZ_PYRAMID_MAX_PX` (default 8192 px per side, ≈ 270 MB worst case while compositing); photos are measured one by one and only the ones used are read again. Lower the cap on a small instance.
- Restart the file server to pick up the new cache headers (`file-server/cache-control.js`), and reload nginx for KML compression.
- Large single images already tiled before this change still use a power-of-two grid guess; re-upload those KMZs for an exact fit.

### Tests added

- Server: `overlay-pyramid.spec.ts` (levels, coverage skip, size cap, seams, 341-photo scale), schools/location specs unchanged.
- Client: `map-render.test.ts` (HUD store batching, style cache, pyramid tile grid), `map-panels.test.tsx` updated.
- File server: `cache-control.test.js`.
