# 3D viewer performance

## The problem

The 3D digital-twin viewer (`/schools/:id/3d-explorer`) appeared to hang at
`0%`. Root cause: the uploaded GLBs are raw Metashape / photogrammetry exports —
one un-quantized, un-compressed mesh of 10–20M triangles.

Example — **Fr Ramon TSS Kabuga**: 486.7 MB, 19.5M triangles, a 6 MB texture
(so ~480 MB is raw geometry). At the EC2 box's ~1–2 MB/s outbound that's a
7–9 minute download with no progress feedback.

## Fix 1 — GLB optimization pipeline (done)

`server/glb-tools/optimize.mjs`:

```
dedup → weld → simplify (Meshopt, keep ~10% tris, lockBorder)
      → prune → WebP textures (≤4096px)
      → quantize + reorder + EXT_meshopt_compression
```

Measured: **486.7 MB / 19.5M tris → ~16 MB / 2.0M tris** (~30×), ~20–25 s.
Verified to decode through `three` `GLTFLoader` + `MeshoptDecoder` with an
unchanged bounding box.

- `KmzService.processGlbJob` uploads the raw GLB first (viewer works
  immediately), then best-effort replaces it with the optimized build and keeps
  the original at `schools/<id>/3d/_source/`. Served URL unchanged.
- Client: `School3DView` wires `MeshoptDecoder` into `GLTFLoader`.
- Runs as a forked child process (isolated ~2 GB heap) so a failure never
  touches `rtb-api`.

### Deploy steps

1. Add to `deploy/scripts/deploy.sh` (after the `file-server` install line):

   ```bash
   npm --prefix server/glb-tools install --omit=dev --no-audit --no-fund
   ```

   If skipped, `rtb-api` self-installs the deps on first boot
   (`ensureGlbTools()`), so this is an optimization, not a hard requirement.

2. Reprocess the GLBs already in storage (one-off, on the box):

   ```bash
   cd /opt/rtb
   node server/glb-tools/reoptimize-all.mjs --storage /var/lib/rtb/storage
   # preview first with --dry ; single school with --only <schoolId>
   ```

   Idempotent — files with a `_source/` copy are skipped unless `--force`.

## Fix 2 — nginx (recommended, not yet applied — conf is deployed manually)

In `/etc/nginx/sites-available/rtb.aerovyntech.com.conf`:

1. **gzip is missing `text/javascript`** — the ~8.5 MB JS bundle currently ships
   uncompressed (nginx labels `.js` as `text/javascript`, which isn't in the
   `gzip_types` list). Add it:

   ```nginx
   gzip_types text/plain text/css application/json application/javascript
              text/javascript application/xml image/svg+xml application/wasm;
   ```

2. **Serve `/files` straight from disk** instead of proxying every byte through
   the Node file-server (which buffers through the event loop):

   ```nginx
   location ^~ /files/ {
       alias /var/lib/rtb/storage/;
       add_header Access-Control-Allow-Origin *;
       location ~* \.glb$ { add_header Cache-Control "public, max-age=604800, immutable"; }
       try_files $uri =404;
   }
   # keep the proxy for /files/schools/*/3d and /files/schools/*/viewer-state
   # (dynamic endpoints) and for /upload — match those location blocks first.
   ```

   (The `/files/schools/:id/3d` discovery route and `viewer-state` are handled
   by the Node file-server, so keep a `location = ` / regex proxy for those
   ahead of the static `alias`.)

3. Confirm `listen 443 ssl http2;` (curl showed HTTP/1.1).

## Fix 3 — client bundle split (future)

`dist/assets/index-*.js` is ~8.5 MB (Cesium + Three both eagerly bundled).
Code-split the Cesium/3D routes with dynamic `import()` to cut first-load TTI.
