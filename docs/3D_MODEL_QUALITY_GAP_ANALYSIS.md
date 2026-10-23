# 3D model quality — gap analysis

23 Oct 2026 · Scope: why the school 3D models (e.g. Nyanza TSS, Nyamirama TSS)
look soft and unrealistic although they load fast, and what it takes to make
them sharp.

## The short answer

The blur comes from **how much image detail the model file carries**, not from
the viewer.

- Each school model has **one 4096 × 4096 texture for the whole campus**.
  Measured on Nyamirama TSS: the model is 228 × 284 m, and its single texture
  uses about 60% of its pixels. That leaves roughly **8 cm of ground per texture
  pixel**, and more on walls and roof slopes. A school drone flight usually
  photographs at **1.5–3 cm per pixel**, so the model keeps only about 1/15 to
  1/30 of the detail that was captured.
- The geometry is photogrammetry from top-down photos, so walls are smeared
  and smooth metal roofs come out wavy (both visible in the Nyanza screenshot).
- Our upload pipeline can make it worse: on production, any upload over
  **1.2 GB** is shrunk to a 2048 px texture.
- The viewer is already set up correctly (full resolution, best texture
  filtering, no lighting tricks on the baked photo colours). It cannot show
  detail the file does not contain.

Sharp *and* fast at this scale needs two things together: export with far more
texture detail, and deliver it with **level of detail** (OGC 3D Tiles), so the
browser streams only the detail for what is on screen, as Google Earth does.

## What was measured

| Item | Nyamirama TSS (local copy) | Nyanza TSS (your screenshot) |
|---|---|---|
| Size on the ground | 228 × 284 m (≈ 6.5 ha) | — |
| Triangles | 4,995,584 (uploaded file) | 3,359,396 |
| Textures | **1 × 4096²** WebP | **1** |
| Atlas pixels actually used | 59.7% (≈ 10 M px) | — |
| Ground detail per texture pixel | **≈ 8 cm** (flat ground; worse on walls) | similar class |
| File as uploaded | already web-compressed (Meshopt + WebP) | — |

Nyamirama's kept "original" (`3d/_source/`) is itself already compressed
(Meshopt geometry, WebP texture, quantised positions). The file was reduced
**before** it reached us, by the export tool or a converter, so the detail
cannot be recovered on our side.

## Where quality is lost: the full chain

| Stage | Today (observed or likely) | Needed for a sharp model | Gap |
|---|---|---|---|
| 1. Drone capture | Mostly top-down (nadir) photos | Ground detail ≤ 2 cm/px, 80% / 70% overlap, **45° oblique passes** for walls, even light | Walls and eaves smeared; shiny roofs noisy |
| 2. Photogrammetry processing | Unknown settings | High/Ultra depth maps, mesh from depth maps, mild filtering | Wavy roofs suggest low depth-map quality or few views |
| 3. Export | **1 texture, 4096²**, whole campus; web-compressed GLB | **Many texture pages** (or a tiled export) at ≤ 2–3 cm/px; raw, not pre-compressed | **Main gap**: about 16× too few texture pixels |
| 4. Our upload pipeline | WebP q95, ≤ 8192 px, keeps ~30% of triangles. **> 1.2 GB on prod → 2048 px, q82, ≤ 1.5 M tris** | Never reduce texture detail; keep the original | Large uploads lose ¾ of their texture pixels |
| 5. Delivery | One GLB, loaded whole | Level of detail (3D Tiles) + GPU-compressed textures (KTX2) | Bigger textures can't fit one file / phone GPU |
| 6. Viewer | Full screen resolution (≤ 2×), max anisotropic filtering, mipmaps, sRGB, unlit | — | **No gap** |

## Gaps, ranked

### G1 · One 4K texture for a whole campus (Critical, export)
A 6.5 ha campus at 2 cm/px needs about **2,500 texture pixels per m²**. With
walls and roofs and typical 60% atlas use, that is **≈ 250–400 M texture
pixels**: about 15–25 textures of 4096², or 4–6 of 8192². The current file has
one 4096² texture (≈ 10 M used pixels), so it is short by a factor of 16 or more.

**Fix:** in the photogrammetry software, export with more texture pages / a
larger size, or export a tiled model (G2). Settings to ask the survey team for:

- Agisoft Metashape: *Build Texture*. Generic mapping, mosaic blending,
  texture size 8192, **texture count 6–16**; or *Build Tiled Model* → export
  Cesium 3D Tiles.
- Pix4D (Mapper / Matic): mesh texture at maximum resolution; export **3D Tiles**
  where available.
- DJI Terra: 3D reconstruction at high resolution; output **3D Tiles (B3DM)**
  in addition to OBJ/OSGB.
- RealityCapture: texel size target ≈ 1.5–2 cm; export tiled / 3D Tiles.

(Menu names vary with version; the goal is "more texture pixels, ideally
tiled", not one 4K atlas.)

### G2 · No level of detail (Critical, platform)
A single GLB is loaded whole. A sharp campus is hundreds of MB of texture,
which no phone GPU holds at once. The standard answer is **OGC 3D Tiles**: the
model is cut into tiles at several detail levels, and the viewer requests only
the tiles and detail level the camera needs (Cesium, Google Photorealistic 3D
Tiles and DJI/Metashape exports all use it).

**Fix:** accept a 3D Tiles upload (a zip with `tileset.json`), store it as
files, and render it in our existing three.js viewer with
**3DTilesRendererJS** (NASA-AMMOS, open source, made for three.js). Keep the
GLB path for schools that only have a GLB. Measurements, notes and pins keep
working, since they use the same coordinates.

### G3 · Textures are not GPU-compressed (High, platform)
WebP shrinks the download, but the GPU still holds raw pixels: **one 4096²
texture ≈ 85 MB of GPU memory** (with mipmaps); one 8192² ≈ 340 MB. That is
why larger textures are not an option for one file on phones.

**Fix:** encode textures as **KTX2 / Basis Universal** (UASTC for detail) in
the upload pipeline (glTF-Transform can do this). About 4–8× less GPU memory,
which makes 8K pages or many tiles practical.

### G4 · Large uploads are reduced on production (High, our pipeline)
`glb-optimizer.ts` switches to a "low-memory" profile when the upload is larger
than 15% of server RAM (**1.2 GB on the 8 GB t3.large**). That profile forces a
**2048 px texture at quality 82**, rough ("sloppy") decimation and at most
1.5 M triangles, so the biggest, most detailed uploads come out worst.

**Fix:** never reduce texture size in that profile; WebP/KTX2 encoding can
stream. Run large jobs on a bigger worker or with `GLB_OPT_HEAP_MB`, or
process them offline. Log the profile used on the upload record so it is
visible.

### G5 · The real original is not kept (Medium, process + pipeline)
We keep the file *as uploaded*, but uploads are already web-compressed
exports. Once detail is removed upstream it is gone for good, including for
future re-processing (e.g. into 3D Tiles).

**Fix:** ask for and archive the raw export (OBJ/FBX + full-size JPG textures,
or the 3D Tiles folder) and, ideally, the processing project. Reject or flag
GLBs that arrive pre-compressed (`EXT_meshopt_compression`, quantised) as
"web preview quality".

### G6 · Capture is mostly top-down (Medium, survey)
Facades and eaves need side views. Shiny or uniform iron-sheet roofs need many
overlapping views and diffuse light, otherwise the surface becomes wavy (as
seen on Nyanza's roofs).

**Fix:** a flight spec for school surveys:

- Ground detail ≤ 2 cm/px (≈ 60 m altitude for a 20 MP 1″ / 4/3″ camera).
- 80% front / 70% side overlap.
- **Oblique passes at 45°** in 4–5 directions (DJI "Smart Oblique" or a
  cross-hatch grid).
- An extra low orbit around key buildings.
- Overcast or mid-morning light, no hard noon shadows.

### G7 · Processing settings unknown (Medium, survey)
The wavy, blobby surfaces fit low depth-map quality or aggressive filtering.

**Fix:**

- Depth maps at High (Ultra for small sites), mild filtering.
- Mesh built from depth maps; keep enough faces before export.
- Ghosting filter on for moving people and cars.
- Then G1 for texturing.

### G8 · No quality check at upload (Medium, our pipeline)
Nobody sees that a model has 8 cm texture pixels until they look closely.

**Fix:** at upload, compute and show **"detail: ~8 cm per pixel"** (the same
measure as this report: used texture pixels ÷ surface area). Warn above
3 cm/px, and show it on the school's 3D card so survey quality can be tracked
and compared.

### What is already right (viewer)
Screen-resolution rendering up to 2×, maximum anisotropic filtering, trilinear
mipmaps, sRGB output, unlit materials that show the baked photo colours as
captured, Meshopt-compressed geometry with 14-bit UVs, and a WebP q95 texture
on the normal path. The 3D viewer needs no changes for the current files.

## Recommended plan

| When | What | Who | Effect |
|---|---|---|---|
| Now (no new data) | **G4** keep full texture size for large uploads · **G8** detail score at upload · **G5** archive originals, flag pre-compressed files | Dev, ~2–3 days | Stops our side from losing detail; makes quality visible |
| Next survey | Pilot one school (e.g. Nyanza) with the **G6/G7** flight and processing spec and a **G1** multi-texture or tiled export | Survey team + dev review | Proves the gain: target ≤ 2–3 cm/px, crisp walls and roofs |
| Platform, ~2–3 weeks | **G2** 3D Tiles upload + 3DTilesRendererJS in the viewer · **G3** KTX2 textures | Dev | Sharp up close and still fast, on desktop and phone |

### Expected result

| | Today | After pilot export + 3D Tiles |
|---|---|---|
| Ground detail per texture pixel | ≈ 8–12 cm | **≈ 2 cm** |
| Texture pixels for a 6.5 ha campus | ≈ 10 M (one 4K) | 250–400 M, streamed by view |
| First view | fast (one 26–37 MB file) | fast (only visible tiles, coarse first) |
| GPU memory on a phone | ≈ 85 MB per 4K texture | bounded by the tile cache, KTX2 compressed |

## Caveats
- Measured on Nyamirama's local copy; Nyanza's texture size and extent come
  from its screenshot statistics only (1 texture). The production files were
  not inspected.
- Photogrammetry software names and limits vary by version; confirm the export
  options with the survey team.
