# 3D model result review: Nyamirama TSS

23 Oct 2026 · Reviews the production screenshot of the water-tank yard and
compares it with renders of the same spot from Nyamirama's original export
(977 MB, 39 M triangles).

## Rating

| Version | Rating | Why |
|---|---|---|
| **Production now (your screenshot)** | **3 / 10** | Saw-tooth wall tops, blocky stones and stepped roof edges (the 21 cm staircase), plus soft 8 cm texture |
| After **Reprocess** (staircase repair, PR #31) | 5 / 10 | Clean geometry; texture still 8 cm per pixel; walls soft |
| + **Roofs and ground textured from the 2D drone photos** (proposed, existing data) | ≈ 7 / 10 | Top surfaces ≈ 1–2 cm per pixel (≈ 4–8× sharper); walls unchanged |
| New survey export per `docs/3D_SURVEY_SPEC.md` | 8–9 / 10 | Sharp walls too (oblique photos, several texture pages, metric coordinates) |

The renders behind this are in the scratchpad (`geo3d/closeA-*.png`):

- `closeA-s.png`: today vs repaired, from the south (closest to your
  screenshot).
- `closeA-full-s.png`: repaired 5 M vs repaired 39 M triangles.

## What the screenshot shows

The screenshot matches **today's** model exactly:

- the wall top is a saw-tooth;
- the stones are cubes;
- roof edges step along one direction.

That is the 21 cm east–west staircase of the export (positions stored as
32-bit degrees).

The repaired model of the same area, built from the same original, has:

- a straight wall top;
- rounded stones;
- clean roof and blue-sheet edges.

So **production has most likely not been reprocessed since PR #31.** Check
with:

```
ssh -i rtb-gis-prod.pem.pem ubuntu@16.170.92.234 'cd /tmp && sudo -u postgres psql -d rtb_gis_db -c "select name, \"modelOptimizedAt\", \"modelQuality\"->>'"'"'profile'"'"' as profile, \"modelQuality\"->'"'"'served'"'"'->>'"'"'triangles'"'"' as tris from schools where \"kmzFilePath\" ilike '"'"'%.glb%'"'"'"'
```

A `modelOptimizedAt` of 3 Sep 2026 means the model is still the old build.

## Gaps, most important first

| # | Gap | Effect | Fix | Owner / effort |
|---|---|---|---|---|
| 1 | **Not reprocessed** since the staircase repair | Saw-tooth walls and roofs (your screenshot) | Press **Reprocess** on the 3D upload tab for Nyamirama and Fr Ramon | You, ≈ 5 min each |
| 2 | **Texture: one 4096² image for the whole campus** (≈ 8–9 cm per pixel) | Everything soft up close, signs unreadable | Short term: gap 3. Long term: new export with several texture pages | Survey / dev |
| 3 | **The sharp 2D photos are not used in 3D.** The same survey has a 0.74 cm orthophoto (verified as real detail), 10× sharper than the 3D texture, covering roofs and ground | 68 % of the model's surface (horizontal) shows 8 cm detail while 1 cm detail exists | **Ortho draping**: re-texture roofs and ground from the 2D photos (below) | Dev, ≈ 4–5 days incl. prototype |
| 4 | **Walls are soft and smeared** (≈ 8.7 cm per pixel, mostly top-down photos) | Facades, doors and windows unclear | Oblique flight passes and an orbit (survey spec) | Survey, next flight |
| 5 | **Small objects are blobs** (stones, tanks, bins) | Photogrammetry limit at this capture | Lower flight / orbit; nothing to fix in software | Survey |
| 6 | **Nyanza can't be repaired on the server** (80 M triangles; the low-memory path skips the repair and caps at 1.5 M triangles) | Nyanza keeps today's steps | Process the original once on a bigger machine (16 GB is enough), then place the result as the served model on the server. Not through the upload page, which would simplify it again to ≈ 1.5 M triangles | Dev, ≈ ½ day |
| 7 | More triangles (39 M streamed) | **No visible gain** after the repair (renders) | Not worth building for these files | — |

## Gap 3 in detail: ortho draping

**Idea.** For every roof and ground triangle (surface facing up), take the
colour from the 2D drone photos instead of the 3D texture.

- Both come from the same survey and are geo-referenced.
- The 3D model keeps its origin (latitude, longitude, altitude), so each
  vertex maps to a map position, then to a pixel of the 2D tiles we now
  build (0.93 cm at zoom 24).
- Walls keep the 3D texture.

**Expected gain** (Nyamirama):

| Surface | Share of the model | Today | With draping |
|---|---|---|---|
| Roofs and ground | 68 % | 8.9 cm/px | **1–2 cm/px** |
| Walls | 32 % | 8.7 cm/px | unchanged |

**Option A: server bakes new texture pages (first step).**

- Horizontal faces are grouped by area and given texture pages from the 2D
  tiles at about 2 cm per pixel. That is ≈ 110 M pixels for the 4.5 ha
  imaged area, ≈ 7 pages of 4096².
- Pages are encoded as KTX2 (Phase 3 is already built) to fit GPU memory.
- The result is an ordinary GLB, so the viewer and tools are unchanged.
- **Effort:** ≈ 4–5 days with a prototype on the water-tank yard first.

**Option B: the viewer streams the 2D tiles as the texture of roofs and
ground** (virtual texturing).

- Only nearby tiles are loaded, at whatever detail the camera needs, up to
  0.93 cm.
- **Effort:** best quality and bandwidth, but ≈ 2 weeks (custom shader,
  tile cache).
- Worth it only if A proves the gain.

**Risks to check in the prototype:**

1. **Alignment.** The orthophoto and mesh come from the same processing, so
   they should agree within a few centimetres; to be measured on roof edges.
2. **Roof overhangs and steep roofs.** The orthophoto sees a roof from
   above, so steep slopes stretch. Limit draping to surfaces within about
   45° of horizontal.
3. **Seams where draped roofs meet the original walls.** These need a soft
   blend at the edge.

**Prerequisite:** Nyamirama's 2D photos locally (the `tar` command given
earlier, about 1–1.5 GB), or run the prototype against the new production
tiles.

## Recommended order

1. **Now:** Reprocess Nyamirama and Fr Ramon (gap 1). Rating 3 → 5.
2. **This week:** ortho-draping prototype on the water-tank yard. If the
   alignment holds, build option A (gap 3). Rating → ≈ 7 for roofs and
   ground.
3. **Next survey:** oblique passes and metric coordinates (survey spec). Walls
   and small objects, rating → 8–9.
4. **Nyanza:** process once on a 16 GB machine with the repair, then put the
   result in place on the server directly (gap 6).
