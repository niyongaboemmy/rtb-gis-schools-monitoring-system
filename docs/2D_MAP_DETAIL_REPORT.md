# 2D site map: how much detail is there, and how to serve it fast

23 Oct 2026 · Measured on production (read-only) and on a 1,365-photo test
site on dev.

## Short answer

- **Can it zoom further?** It already can. The map allows zoom 25, which is
  beyond the photos' own detail at every school. Zooming further only makes
  each photo pixel bigger; it adds no information.
- **Can it be clearer?** Yes, on most screens. Laptops and phones have 2×
  ("retina") screens. The map picked its sharp photos for a 1× screen and
  stretched them 2×. That is now fixed (section 3): **2–4× sharper** at the
  zooms where detail exists.
- **Performance.** The sharp photos load only when you zoom in (PR #30).
  But they are the survey's original 512 px PNGs, stitched in the browser:
  **≈ 25 MB for one screen** at the first sharp zoom. Server-built WebP
  tiles would be **≈ 1.5 MB**, the same detail, and every zoom level costs
  about the same (section 4).

## 1. What the KMZ files contain (production)

Each KMZ is a "super-overlay": the same area at 7–8 detail levels, every
photo 512 × 512 px PNG.

| School | Photos | Finest level | Next level | Old map (8192 px pyramid) |
|---|---|---|---|---|
| Nyamirama TSS | 4,049 | **0.74 cm/px** (2,976 photos) | 1.5 cm | 5.9 cm |
| Nyanza TSS | 3,608 | **1.9 cm/px** (2,645) | 3.8 cm | 15.3 cm |
| Fr Ramon TSS Kabuga | 1,145 | **2.2 cm/px** (851) | 4.5 cm | 9.0 cm |

No photo is missing or unreadable.

The finest level is where all the detail is. Before PR #30 the map never
showed it.

## 2. Zoom limits

The map zoom at which one photo pixel fills one screen pixel:

| School | 1× screen | 2× screen | Map max zoom | Beyond the data at zoom 25 |
|---|---|---|---|---|
| Nyamirama | 24.3 | 23.3 | 25 | 1.6× (1×) / 3.2× (2×) |
| Nyanza | 23.0 | 22.0 | 25 | 4× / 8× |
| Fr Ramon | 22.8 | 21.8 | 25 | 4.7× / 9.4× |

Your screenshot (pine needles, single stones) is already at or past the
photos' own pixel size. Raising the zoom limit would give bigger pixels, not
more detail. **Recommendation:** keep zoom 25.

**Is the finest level real detail? Yes, at all three schools.** Export tools
sometimes add a top level that is only the level below enlarged, so this was
tested on production (`effres.cjs`):

- 30 textured photos per level were shrunk 2× and enlarged back.
- The test measures how much was lost (PSNR; lower = more real fine detail).
- Calibration: a deliberately enlarged level on the dev test site scores
  38.7 dB.

| School | Finest level | Level below |
|---|---|---|
| Nyamirama (0.74 cm) | 29.4 dB | 27.2 dB |
| Nyanza (1.9 cm) | 29.8 dB | 28.0 dB |
| Fr Ramon (2.2 cm) | 31.2 dB | 28.4 dB |

What this shows:

- Every finest level is far below the enlarged reference.
- They are only 2–3 dB above the level below, which is normal for real
  photos (the finest scale carries less contrast).
- Nyamirama's 0.74 cm is genuine: a low flight.
- The map should therefore use the finest level everywhere: tiles to zoom 24
  for Nyamirama and zoom 23 for Nyanza and Fr Ramon.

## 3. Clarity fixes made (client, ready to ship)

`client/src/components/2dviewercomponents/hooks/useKmzLoader.ts`:

1. **Tiles at the screen's real pixel density.**
   - OpenLayers picks the tile level from CSS pixels, and the photo layer
     drew 256 px tiles.
   - On a 2× screen each tile was therefore stretched to 512 physical
     pixels.
   - Tiles are now drawn at 512 px on 2× screens.
2. **Finer level between two zooms** (`zDirection: -1`).
   - The view is not snapped to whole zooms.
   - At zoom 22.6 the layer used to take level 23 or level 22, whichever
     was nearer, which up-scales by as much as 1.4×.
   - It now always takes the finer one.
3. **Switch to the sharp photos by screen pixels.**
   - On a 2× screen the overview pyramid is stretched one level earlier.
   - The photos now take over one level earlier there too.

Measured on the test site (photos 2.44 cm) on a 2× screen. Sharpness is the
variance of the Laplacian on the same view; higher is sharper.

| Zoom | Before | After |
|---|---|---|
| 21 | 19.2 (overview still showing) | **82.9** |
| 22 (native) | 13.1 | **26.1** |
| 23 (past native) | 8.6 | 9.8 |
| 24 (far past) | 2.0 | 2.3 |

Past the photos' own detail nothing can improve, as expected.

On 1× screens nothing changes (256 px tiles, as before).

Also: a dev-only test hook `window.__rtbMap` (dev builds or
`localStorage rtb-viewer-debug = 1`), like the 3D viewer's.

## 4. Performance: what a zoom costs

### Today (after PR #30)

| Zoom (2× screen, 1200 × 800 view) | Photos fetched | Download |
|---|---|---|
| ≤ 20 | 0 (overview pyramid only) | — |
| 21 (first sharp level) | 102 | **24.7 MB** |
| 22 | 36 | 11.3 MB |
| 23 | 16 | 3.7 MB |

Why it is heavy:

- Each photo is a full 512 px PNG (≈ 240 KB), downloaded whole even when
  only a corner is on screen.
- Every 256 / 512 px tile is assembled in the browser from several photos
  (decode + draw).
- Just past the overview level, many small photos are needed at once.

### Recommended: server-built tiles at the photos' full detail

Build standard map tiles (256 px WebP, the same grid as the basemap) from the
original photos, once per school, in the background:

- The deepest tile level matches the finest photo level.
- Tiles are drawn photo by photo with shared pixel edges, so there are no
  seams.
- Lower levels are made by halving the level below.

The builder exists as a draft (`server/src/modules/kmz/overlay-tiles.ts`,
not wired in). Measured on the test site:

| | Value |
|---|---|
| Deepest level | z23, 1.87 cm/px (photos 2.44 cm) |
| Tiles | 9,752 (7,225 at the deepest level), seams checked |
| Size | 61 MB (6.4 KB per tile; real photos ≈ 15–30 KB) |
| Build | 142 s, 0.58 GB peak memory (M2 Pro; expect 2–3× longer on the t3.large) |

What the map would then load:

- **Any zoom, 2× screen:** ≈ 70 tiles × ≈ 20 KB ≈ **1.5 MB per full screen**
  (vs 24.7 MB), the same detail.
- **Panning:** only the new edge tiles; tiles are cacheable for a year.
- **No in-browser stitching:** less CPU, smoother on phones.

Estimates for production:

| School | Deepest level | Tiles (all levels) | Storage |
|---|---|---|---|
| Nyamirama | z24 (0.93 cm) | ≈ 10,000 | ≈ 200 MB |
| Nyanza | z23 (1.87 cm) | ≈ 14,500 | ≈ 290 MB |
| Fr Ramon | z23 (1.87 cm) | ≈ 6,300 | ≈ 125 MB |

All three finest levels hold real detail (section 2), so these are the sizes
to plan for.

## 5. Plan

| Step | What | Effort |
|---|---|---|
| 1 | Ship the clarity fixes (section 3) | done, ready for PR |
| 2 | Check the finest levels are real detail | done: all three are |
| 3 | Wire the tile builder in:<br>• a background job with progress (same panel as 3D Reprocess)<br>• `schools/<id>/kmz_2d_content/_tiles/<build>/{z}/{x}/{y}.webp`<br>• manifest `tiles` {minZoom, maxZoom, extent}<br>• the viewer uses one XYZ layer when present (pyramid + browser stitching kept as fallback)<br>• tests: tile edges, levels, georeference, viewer switch | 2–3 days |
| 4 | Build tiles for the three schools; compare on screen and on a phone over 4G | ½ day |

## Caveats

- The test site is made from an enlarged texture, so its pixels are soft.
  Sharpness gains on the real photos will look larger.
- Download figures come from headless Chrome on a local network.
  Production adds latency per request, which favours fewer, smaller tiles
  even more.
