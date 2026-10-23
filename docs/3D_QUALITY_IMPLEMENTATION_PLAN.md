# High-quality 3D rendering — implementation plan

23 Oct 2026 · Builds on `docs/3D_MODEL_QUALITY_GAP_ANALYSIS.md` (G1–G8).
Goal: school models that look **sharp up close (walls, roofs, signage) and
still open fast**, on desktop and phones, without breaking measurements, notes,
pins, deep links or the 2D ↔ 3D hand-off.

"Perfect" is bounded by the drone survey: no renderer adds detail that was not
photographed. So the plan has a measurable target, and the
platform side is built to carry that much detail without slowing down.

## Quality targets (acceptance criteria)

| Measure | Today (Nyamirama) | Target |
|---|---|---|
| Texture detail on ground and roofs (median) | ≈ 8 cm per pixel | **≤ 2 cm per pixel** |
| Texture detail on walls (90th percentile) | not measured, visibly worse | **≤ 4 cm per pixel** |
| First full view (desktop, 20 Mbit/s) | ~2–4 s, one 26–37 MB file | **≤ 3 s**, refining after that |
| Frame rate | — | **60 fps** desktop, **≥ 30 fps** mid-range Android |
| GPU memory | ≈ 85 MB per 4K texture, all at once | **≤ 512 MB** desktop, **≤ 256 MB** phone (tile cache budget) |
| Close-up of a 1 m sign / window from 5 m away | blurred | readable edges; window frames distinct |

Every phase is checked against this table with the Phase 0 tools.

## Progress

| Phase | Status | Date |
|---|---|---|
| 0 · Measure | **Done** | 23 Oct 2026 |
| 1 · Stop losing detail | **Done** (item 5 "reprocess all schools" runs at deploy) | 23 Oct 2026 |
| 2 · Survey spec and pilot | Spec written (`docs/3D_SURVEY_SPEC.md`); pilot flight is with the survey team | — |
| 3 · Multi-texture + KTX2 | **Done** for the platform; checked on the pilot export when it arrives | 23 Oct 2026 |
| 4 · 3D Tiles | Not started | — |
| 5 · Finish and roll out | Not started | — |

### Baseline and Phase 1 results (Nyamirama model, dev copy)

Measured with `server/glb-tools/quality.mjs` and `client/scripts/viewer-bench.mjs`
(headless Chrome, M2 Pro).

| Measure | Baseline | After Phase 1 |
|---|---|---|
| Ground and roofs, median (p90) | 8.85 cm (16.4) in the delivered file | 8.23 cm (12.2) served — no detail lost in our pipeline |
| Walls, median (p90) | 8.65 cm (17.6) | unchanged |
| Texture | 1 × 4096² WebP, 59.7% used | same bytes, passed through (`"action": "kept"`) |
| Triangles | 4,995,584 delivered → 1,497,415 served | same |
| Delivered file | already web-compressed (Meshopt, quantised) | now flagged before upload and in the manifest |
| Ready, desktop | 1.90 s, 18 MB | 1.82 s, 18 MB |
| Ready, phone emulation (4× CPU, 9 Mbit/s) | — | 24.8 s (download-bound: 18 MB ≈ 16 s) |
| Frame rate, desktop orbit | 121.5 fps | 122.1 fps |
| GPU texture memory | 64 MB (**mipmaps were off**) | 85.3 MB (mipmaps on) |
| Optimizer on the 37 MB original | — | 11.7 s, peak 1.75 GB RAM |

Findings while building Phase 1:

- **Viewer bug fixed:** three.js turns mipmaps off when a glTF sampler asks
  for plain linear filtering, so distant views sampled the full 4K texture
  (shimmer, aliasing). The viewer now forces trilinear mipmaps, and the
  optimizer writes the right sampler into every file. That costs +21 MB of
  GPU memory, as expected.
- The pipeline now loses nothing: the served detail (8.2 cm) is the same as
  or better than the delivered file (8.85 cm; the meter's weighting shifts
  slightly after simplification). **All remaining blur is in the delivered
  file.** Only a new export (Phase 2) changes it.
- Headless Chrome's CPU throttle does not slow the GPU, so phone frame rates
  must be measured on a real device (Phase 5).

What shipped in Phase 1:

- Textures that are already JPEG/WebP ≤ 8192 px pass through byte for byte;
  only PNG or oversize textures are re-encoded (WebP q95). The low-memory
  profile no longer shrinks textures (2048 px / q82 removed); it only limits
  geometry. The profile used is stored.
- Detail is measured at every upload and stored on the school
  (`schools.modelQuality`: served, delivered, profile, textures). Existing
  schools are measured once in the background the first time their 3D view
  opens. The 3D view's info bar shows e.g. "8.2 cm/px · Low detail", with
  the full explanation as a tooltip.
- The upload page reads the GLB header in the browser and warns when the file
  is already web-compressed, before anything is uploaded.
- `3d/_source/<file>.manifest.json` sits beside the kept original: name,
  size, SHA-256 and the delivered detail.
- Tests: glb-tools 13, server unit 560 (all suites), server e2e 49, client 214;
  client build and typecheck clean.

### Phase 3 results

**Encoder spike** (Nyamirama 4096² page, 2 threads like the t3.large):

| Encoding | Size | Quality (PSNR vs source) | Time | Peak RAM |
|---|---|---|---|---|
| WebP (today) | 6.8 MB | source | — | — |
| **UASTC, RDO λ 1 + zstd (chosen)** | 19.3 MB | **42.0 dB** (no visible difference) | 62 s | 0.70 GB |
| UASTC, RDO λ 3 | 16.3 MB | 36.3 dB | 55 s | — |
| UASTC, RDO λ 6 | 14.3 MB | 32.4 dB | 48 s | — |
| ETC1S | 4.2 MB | 31.6 dB (visible blocking) | 32 s | 1.08 GB |
| 8192² page, UASTC λ 1 | 53 MB | — | 192 s | 2.47 GB |

- The WebAssembly encoder (`ktx2-encoder`) refuses images over ≈ 12 Mpix,
  so it cannot encode a 4096² page. We use Khronos **KTX-Software `ktx`
  4.4.2**, unpacked into `server/glb-tools/vendor/ktx` by
  `install-ktx.mjs` (pinned SHA-256, no root). The API installs it on first
  use.
- ETC1S is too soft for close-ups; stronger RDO costs more quality than it
  saves in size.

**Trade-off and rule:** UASTC is ≈ 2.8× larger to download but ≈ 4× smaller
on the GPU. So:

- WebP stays the main build.
- The server adds `<name>.ktx2.glb` only when the WebP textures would take
  more than 96 MB of GPU memory (more than one 4K page). Override with
  `GLB_KTX2=always|off`.
- The viewer loads KTX2 on phones, and on desktops when WebP would take
  more than half the budget. It loads it only if the GPU supports a
  compressed format.
- If plain textures still exceed the device budget, they are scaled down
  and the info bar says "Reduced · On this device".

**End-to-end** (Nyamirama, forced with `GLB_KTX2=always`):

| | Phone emulation, WebP | Phone emulation, KTX2 | Desktop |
|---|---|---|---|
| Download | 18 MB | 29.9 MB | 18 MB (WebP kept) |
| GPU texture memory | 85.3 MB | **21.3 MB** | 85.3 MB |
| Ready | 24.8 s | 35.7 s | 1.78 s |
| Picture | — | identical to WebP (orientation, colour) | unchanged |

The variant build took 63 s on top of the 12 s optimise and runs after the
model is live. A single-4K school does not get a KTX2 variant in `auto`
mode; it pays off on the multi-page pilot export.

What shipped:
- `glb-tools/ktx2.mjs` and `install-ktx.mjs`.
- `kmz/glb-ktx2.ts`, plus a `schools.modelVariants` column (same migration
  as `modelQuality`).
- `GET kmz/status` returns `modelVariants`.
- Re-optimise and the file server never treat `*.ktx2.glb` as the model.
- Self-hosted Basis transcoder in `client/public/basis/`.
- `lib/viewer3d/model-variant.ts`.

Tests:
- glb-tools 15;
- server unit 564;
- file server 10;
- client 219;
- client build, typecheck and lint clean on new code.

Not yet verified: the Linux `ktx` download path (production is Linux
x86_64). Check after deploy that `pm2 logs rtb-api | grep "ktx ready"`
appears on the first heavy model.

---

## Review of the gap analysis

What holds up, and what needs correcting before building on it:

1. **Main diagnosis confirmed.** One 4096² texture for a 6.5 ha campus is the
   dominant loss. The viewer's settings (anisotropic filtering, mipmaps, sRGB,
   unlit, pixel ratio ≤ 2) are correct for the files we have today.
2. **The 8 cm figure is approximate.** It divided used texture pixels by the
   *bounding-box footprint*. The right measure is per triangle: texture pixels
   covered (UV area × texture size²) over **real 3D surface area**. That gives a
   distribution (ground, roofs, walls) and catches atlases that spend pixels
   unevenly. Phase 0 builds this measure; it will likely show walls far worse
   than 8 cm.
3. **"No viewer gap" is true only for single GLBs.** To carry 25–40× more
   texture pixels, the viewer needs streaming level of detail, GPU texture
   compression and memory budgets. Today it has none of these (Phases 3–4).
4. **"Never reduce texture size on large uploads" is not free.** The low-memory
   profile exists because WebP re-encoding of a 4K atlas was what ran out of
   memory on large inputs. The real fix is to **not re-encode at all when the
   source texture is already web-ready** (JPEG/WebP within limits: pass it
   through, with no quality loss and no memory spike), and to run unavoidable
   re-encodes in a separate, memory-limited step.
5. **KTX2 is a trade-off, not a free win.** UASTC (high quality) files are
   *larger on disk* than WebP (≈ 1.5–2× after zstd) but 4–8× smaller in GPU
   memory. ETC1S is small on both, but too soft for close-up detail. Use UASTC
   for the finest detail levels and ETC1S for coarse ones. The decoder files
   must be self-hosted. The server has no encoder today (no `toktx`/`ktx`/`basisu`).
6. **3D Tiles bring work the report left out:**
   - Very large uploads (a tileset is thousands of files, often several GB),
     but today's GLB/KMZ upload limit is 2 GB.
   - Storage growth across all schools.
   - Coordinate alignment: tilesets are in Earth-centred coordinates (ECEF),
     while our tools use a local model frame.
   - Measuring on geometry whose level of detail changes with the view.
   - Moving existing measurements onto the new model.
7. **Geometry quality matters as much as texture.** Wavy roofs come from depth
   maps (survey processing), not from our simplifier, which keeps ≈ 30% of
   triangles under a tight 0.1% error. Tiled exports carry the survey
   software's own detail levels, so **our server must not decimate tiles**.

---

## Phase 0 — Measure before changing anything (2–3 days, dev)

1. **Detail meter** (`server/glb-tools/quality.mjs`, also used on upload):
   - Per triangle: covered texture pixels ÷ 3D area → cm per pixel.
   - Reports the median and 90th percentile, split by surface direction
     (ground and roofs vs walls), plus triangles per m², texture count and
     sizes, and the share of each atlas used.
   - Flags files that arrive pre-compressed (`EXT_meshopt_compression`,
     quantised positions, textures ≤ 4K).
2. **Visual regression harness** (Playwright): 6 fixed camera bookmarks per
   pilot school (overview, roof close-up, facade, signage, courtyard, edge of
   site). It saves screenshots so each phase is compared side by side.
3. **Performance harness:**
   - Time to first frame and to a "settled" view.
   - Frame rate during a scripted fly-through.
   - GPU memory (`renderer.info.memory`, texture bytes) and download bytes.
   - Desktop and mobile emulation (CPU slowdown, 4G throttling).
4. Record the baseline for Nyamirama and Nyanza (production files, read-only)
   in this document.

**Done when:** both pilot schools have a baseline row and screenshots.

## Phase 1 — Stop losing detail in our pipeline (3–4 days, dev) · G4, G5, G8

1. **Texture pass-through:** if an atlas is already JPEG/WebP and ≤ 8192 px,
   keep its bytes unchanged. Re-encode only PNG or oversize textures, in their
   own step with a libvips memory limit.
2. **Low-memory profile no longer shrinks textures.** It still applies rough
   decimation and the triangle cap to geometry, and the profile used is
   recorded on the upload.
3. **Archive the original** exactly as uploaded (already in `_source/`), plus
   a manifest (size, hash, detail meter result). Warn on upload when the file
   is pre-compressed: "web preview quality — ask the surveyor for the full
   export".
4. **Detail score in the product:** the upload result and the school's 3D
   card show "Detail ≈ X cm per pixel", with a warning above 3 cm.
5. **Reprocess** schools whose originals are larger than what is served
   (admin "re-optimise" already exists).

**Tests:**
- Unit: pass-through keeps texture bytes identical; the low-memory profile
  keeps texture size.
- Meter: hand-made models with a known cm/px give the right answer.
- E2E: an upload shows its detail score.

**Done when:** no upload path lowers texture resolution, and every school shows
its detail score.

## Phase 2 — Survey standard and pilot (survey team, runs alongside 1 and 3) · G1, G6, G7

1. **Survey spec** (`docs/3D_SURVEY_SPEC.md`), agreed with the survey team:
   - **Flight:** ground detail ≤ 2 cm per pixel, 80% / 70% overlap, 45°
     oblique passes in 4–5 directions, a low orbit around key buildings,
     overcast or mid-morning light.
   - **Processing:** High/Ultra depth maps, mild filtering, ghosting filter on.
   - **Export:** OGC 3D Tiles (preferred), or a GLB/OBJ with several texture
     pages at ≤ 2 cm per pixel. Raw, not pre-compressed.
   - **Handover:** the project file and the raw export.
2. **Pilot:** re-fly and re-process one school (Nyanza TSS), export both
   3D Tiles and a multi-texture GLB, and check them with the Phase 0 meter.

**Done when:** the pilot export meets the detail targets in the meter.

## Phase 3 — Multi-texture GLB with GPU compression (1–1.5 weeks, dev) · G3

For small and medium campuses this already gives about 4–6× sharper models in
a single file.

1. **Server:** keep all texture pages (the optimizer must never merge them
   into one atlas). Encode them to **KTX2**: UASTC with zstd where pages are
   viewed close up, ETC1S otherwise. Run the encoder in the background job.
   - **Spike, first 1–2 days:** KTX-Software `ktx` CLI on the EC2 box vs a
     WebAssembly Basis encoder in Node. Pick by output quality, memory and
     speed on the pilot file.
2. **Client:**
   - `KTX2Loader` with the Basis transcoder self-hosted (copied from
     `three/examples/jsm/libs/basis/` into `client/public`), registered on the
     shared `GLTFLoader`.
   - Feature detection with WebP fallback: the server keeps a WebP variant.
3. **GPU budget guard:** read texture memory after load. On devices over
   budget, load the WebP variant at reduced size and say so in the stats bar
   ("Reduced detail on this device").

**Tests:**
- Same screenshots as Phase 0, side by side.
- GPU memory within budget on mobile emulation.
- Unit tests for encoder selection and fallback.

**Done when:** the pilot multi-texture GLB meets the detail targets and stays
within the GPU budget.

## Phase 4 — 3D Tiles streaming (2–3 weeks, dev) · G2

**4a. Ingest (server, ~1 week)**
- **Chunked, resumable upload** for tileset zips of several GB, written to
  temp storage. Then stream-unzip into
  `schools/<id>/3d/tiles/<buildId>/` (unique per build, cached for a year,
  like the 2D pyramid).
- **Validation:**
  - `tileset.json` schema;
  - every referenced content file is present;
  - the root bounds are inside Rwanda;
  - geometric errors are sensible;
  - tile formats are glb or b3dm.
- **Per-tile processing in the background:** Meshopt geometry and KTX2
  textures (Phase 3 encoder). No decimation: the survey software's own detail
  levels are kept.
- **Model origin** is taken from the tileset root (centre of the bounds). The
  school's location is never changed by this (location rules: a 3D model only
  fills an empty point).
- **Storage plan** (decision needed): roughly 1–5 GB per school. Grow EBS, or
  move tiles to S3 + CloudFront with immutable caching.

**4b. Viewer (client, ~1–1.5 weeks)**
- Add `3d-tiles-renderer` (NASA-AMMOS 3DTilesRendererJS; check compatibility
  with our three r183 at install).
- **Loading and placement:**
  - Use the GLTF extensions plugin for Meshopt, Draco and KTX2.
  - Place the tileset in our local model frame through `geo-bridge.ts`
    (Earth-centred → local east/north/up at the model origin). Existing tools
    then keep one coordinate frame.
- **Detail and memory:**
  - Screen-space error target per device (desktop ≈ 6 px, phone ≈ 12–16 px).
  - LRU cache in bytes matched to the GPU budgets above.
  - Smooth fades between detail levels.
  - A progress readout ("Loading detail…").
- **Port every tool:**
  - Measuring: raycast on the finest loaded tiles; three-mesh-bvh built per
    tile only while a measuring tool is active.
  - Notes and building pins.
  - Fly-to and the 2D ↔ 3D hand-off (focus building).
  - Camera home and viewer state.
  - Export and screenshots.
- **Fallback:** a school without tiles keeps the GLB path unchanged.

**4c. Moving existing site features**
- Measurements, notes and pins saved against an old GLB already store WGS84
  coordinates. Recompute their model coordinates in the new frame from WGS84,
  as a one-off and reversible migration with a dry-run report.

**Tests:**
- Unit: frame conversion round-trip (ECEF ↔ local, millimetre tolerance) and
  tileset validation.
- E2E: upload a small sample tileset → it renders → measure a known distance
  (± 2 cm) → note round-trip.
- Screenshot harness at all six bookmarks.
- Performance harness within the budgets.

**Done when:** the pilot school renders from 3D Tiles and meets every target in
the acceptance table, and all tools work on it.

## Phase 5 — Finish and roll out (≈ 1 week, dev + survey)

1. **Automatic quality per device:** pixel ratio, error target and cache size
   chosen from detected GPU tier and memory, with a manual High / Balanced /
   Saver switch in the viewer.
2. **Image quality touches:**
   - Optional SMAA for thin roof edges.
   - Correct sRGB for KTX2 (`colorSpace`).
   - No tone mapping on unlit photo textures, so colours stay as captured.
3. **Visual regression in CI** on a small sample tileset, so later changes
   can't quietly blur the models again.
4. **Rollout:**
   - Pilot school, then schools with new surveys as they arrive.
   - Every school keeps its GLB until its tileset passes the meter.
   - Track detail scores on an admin list.

---

## Timeline and owners

| Phase | Effort | Owner | Depends on |
|---|---|---|---|
| 0 Measure | 2–3 days | Dev | — |
| 1 Pipeline fixes | 3–4 days | Dev | 0 |
| 2 Survey spec + pilot | 1–3 weeks (calendar) | Survey team (+ dev review) | 0 (meter) |
| 3 Multi-texture + KTX2 | 1–1.5 weeks | Dev | 1; pilot GLB from 2 |
| 4 3D Tiles | 2–3 weeks | Dev | 3 (encoder); pilot tileset from 2; storage decision |
| 5 Finish + rollout | ≈ 1 week | Dev + survey | 4 |

Phases 0–1 improve every school now, with no new data. The large visible jump
comes when Phase 2 data meets Phases 3–4.

## Decisions needed

1. **Storage for tilesets:** grow the EC2 disk, or S3 + CloudFront (recommended
   once more than a few schools have tiles).
2. **Survey format:** confirm the survey team can deliver OGC 3D Tiles (DJI
   Terra, Metashape, Pix4D and RealityCapture all export them in recent
   versions) plus the project file.
3. **Pilot school:** Nyanza TSS proposed.
4. **KTX2 encoder:** native KTX-Software on the server vs WebAssembly, decided
   by the Phase 3 spike.

## Risks

| Risk | Mitigation |
|---|---|
| Survey data still low detail | Phase 0 meter gates every upload; the spec is agreed before the flight |
| Tileset too large for the server disk or upload | Chunked uploads, storage decision before Phase 4 |
| Phones run out of GPU memory | KTX2, byte-based cache budget, device tiers, Saver mode |
| Measurements differ between detail levels | Measure on the finest loaded tile; refine the area under the cursor before picking |
| Existing measurements misplaced after switching models | WGS84-based migration with a dry-run report; old GLB kept for rollback |
