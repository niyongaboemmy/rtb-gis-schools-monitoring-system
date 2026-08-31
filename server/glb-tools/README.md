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

`dedup → weld → simplify (Meshopt, keep 10% of tris, lockBorder) → prune →
WebP textures (≤4096px) → quantize + reorder + EXT_meshopt_compression`

Output uses `EXT_meshopt_compression`, `KHR_mesh_quantization`,
`EXT_texture_webp` — the viewer decodes these via `GLTFLoader` +
`MeshoptDecoder` (see `client/src/components/School3DView.tsx`).

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
