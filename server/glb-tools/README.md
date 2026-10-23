# glb-tools — GLB optimization pipeline

Standalone ESM workspace. Kept off `server`'s dependency tree because
`@gltf-transform/*` is ESM-only and the optimizer briefly needs ~2 GB of heap;
`rtb-api` forks it as a child process so a failure or OOM never touches the API.

## Why

Raw Metashape / photogrammetry GLB exports are ~30× heavier than the web needs:
one un-quantized, un-compressed mesh of 10–20M triangles.

Measured on **Fr Ramon TSS Kabuga**:

| | size | triangles |
|---|---|---|
| raw upload | 486.7 MB | 19.5 M |
| optimized (`ratio 0.1`, 4096px WebP) | **~16 MB** | 2.0 M |

≈ 30× smaller, ~20–25 s to process. Download at the box's ~1–2 MB/s drops from
~7 min to ~10 s.

## Pipeline (`optimize.mjs`)

`reproject degrees → local metres (with the staircase repair) → measure
detail → simplify (Meshopt exact; tiled exact or sloppy for huge meshes; keep
~30% of triangles, ≤ 5 M) → weld + prune → textures (JPEG/WebP ≤ 8192 px kept
byte for byte, others → WebP q95; mipmapped samplers) → measure → 16-bit
quantize + EXT_meshopt_compression`

**Staircase repair (`destep.mjs`).** Exports in degrees (longitude/latitude
in 32-bit floats) can only step ≈ 21 cm east–west near 30° E, which terraces
every wall, kerb and roof edge. Before converting to metres, longitude and
latitude are smoothed over the mesh with every vertex kept within ± half a
step of its stored value: the steps go, no shape is invented. Nyamirama
(19.4 M vertices): about 20 s, about 1 GB extra.

- `GLB_DESTEP=0` turns it off.
- `GLB_DESTEP_MAX_VERTS` is the size limit (default 60 M; 25 M on the
  low-memory profile).
- `GLB_DESTEP_ITERATIONS` defaults to 30.

The run report shows what it did under `destep`.

Output uses `EXT_meshopt_compression`, `KHR_mesh_quantization`,
`EXT_texture_webp` — the viewer decodes these via `GLTFLoader` +
`MeshoptDecoder` (see `client/src/components/School3DView.tsx`).

**Ortho draping (`drape.mjs`).** After optimizing, the server textures the
model's roofs and ground from the site map's full-detail photo tiles (≈ 1 cm
per pixel) instead of the model's own texture (≈ 8 cm).

- **Conditions:** it runs only for geo-referenced models (exported in
  degrees, reprojected by `optimize.mjs`, which reports `origin`) and only
  when the school has 2D tiles.
- **Alignment check first:** in the busiest 60 m window, the model's
  upward faces (own texture) must line up with the tiles within 8 cm with a
  clear match peak; otherwise nothing is draped and the reason is reported.
- **Which faces:** those facing up (≤ 45°), topmost from above (not under an
  overhang), inside their 4096 px page and on photo pixels.
- **Settings:** `GLB_DRAPE=0` turns it off; `GLB_DRAPE_CM` sets the detail
  (default 2).
- **Measured on Nyamirama:** 17 s and 1.5 GB for 145 k faces on 2 pages.

## Install (part of deploy)

```bash
npm --prefix server/glb-tools install --omit=dev
```

If this is missing, `isGlbOptimizerAvailable()` returns false and the API just
serves the raw GLB — nothing breaks, models are only unoptimized.

## Usage

```bash
# single file
node optimize.mjs <input.glb> <output.glb> [ratio=0.1] [texSize=4096]

# reprocess every GLB already in file-server storage
node reoptimize-all.mjs --storage /var/lib/rtb/storage
node reoptimize-all.mjs --storage /var/lib/rtb/storage --dry      # preview
node reoptimize-all.mjs --storage /var/lib/rtb/storage --only <schoolId>
node reoptimize-all.mjs --storage /var/lib/rtb/storage --force    # re-run from _source/
```

`reoptimize-all.mjs` archives each original to `schools/<id>/3d/_source/<name>.glb`
and writes the optimized build in its place. The served URL is unchanged, so no
DB updates are needed. Re-runnable: files with a `_source/` copy are skipped
unless `--force`.

## Runtime flow

`KmzService.processGlbJob` (BullMQ) uploads the raw GLB first (so the viewer
works immediately), then calls `optimizeAndReplaceGlb` → forks `optimize.mjs` →
on success archives the original and overwrites the served object.
