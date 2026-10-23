# School 3D survey — capture, processing and handover spec

Version 1 · 23 Oct 2026 · For the RTB survey team and contractors.
Why this exists: `docs/3D_MODEL_QUALITY_GAP_ANALYSIS.md`. Plan:
`docs/3D_QUALITY_IMPLEMENTATION_PLAN.md` (Phase 2).

Today's school models look soft because each campus is delivered as **one
4096 × 4096 texture**, which leaves about **8–9 cm of ground per texture
pixel**. The drone photos are far sharper than that. This spec keeps that
detail from the flight to the platform.

## 1. Targets (checked at handover)

| Check | Target |
|---|---|
| Photo ground detail (GSD) | **≤ 2 cm per pixel** |
| Model texture detail, ground and roofs (median) | **≤ 2 cm per pixel** |
| Model texture detail, walls (90th percentile) | **≤ 4 cm per pixel** |
| Position accuracy | ≤ 5 cm horizontal, ≤ 10 cm vertical (RTK or ground control) |
| Delivered file | full quality, **not** compressed for the web (see 4) |

We check the model with the platform's detail meter
(`node server/glb-tools/quality.mjs model.glb`) and show the result on the
school's 3D view.

## 2. Flight

**Height.** Fly at or below the height that gives 2 cm per pixel:

| Drone / camera | 2 cm/px at | Recommended |
|---|---|---|
| DJI Mavic 3 Enterprise (4/3″, 12.3 mm) | 75 m | **60 m** (1.6 cm) |
| DJI Phantom 4 RTK (1″, 8.8 mm) | 73 m | **60 m** (1.6 cm) |
| DJI Zenmuse P1, 35 mm (full frame) | 160 m | 100 m (1.25 cm) |

Other cameras: GSD (cm) = sensor width (mm) × height (m) × 100 ÷ (focal
length (mm) × image width (px)). Respect the legal height limit and any
no-fly zone; stay below terrain changes on sloped sites (use terrain follow).

**Pattern.**

1. **Grid (nadir):** 80% front overlap, 70% side overlap, over the whole
   campus plus a 20 m margin.
2. **Oblique passes:** camera at **45°**, in **4 directions** (N, E, S, W), or
   "Smart Oblique" / five-direction mode. Walls, eaves and verandas only come
   out sharp from side views.
3. **Low orbit** around each main building (classrooms, workshops, admin):
   30–40 m from the building, camera at 30–45°, one photo every 5–8°.
   These views also fix wavy roofs.

**Camera.** Mechanical shutter if available; shutter ≥ 1/800 s; ISO ≤ 400;
fixed white balance for the whole flight; JPEG at the highest quality.

**Conditions.**
- Overcast, or between 08:30–10:30 / 14:30–16:30. Avoid hard noon shadows.
- Wind below about 8 m/s. Dry roofs (wet iron sheets reflect the sky).
- Fewest people and vehicles: weekend or holiday, with the school informed.

**Position.** RTK/PPK on. If not, **≥ 5 ground control points** spread over
the site plus 2 check points. Report the accuracy reached.

## 3. Processing

Any photogrammetry software is fine. Menu names change between versions;
these are the goals:

| Step | Setting |
|---|---|
| Alignment | High accuracy; nadir, oblique and orbit photos in **one** project |
| Depth maps / dense cloud | **High** (Ultra for sites under 3 ha); filtering **Mild** |
| Mesh | From depth maps; keep the full face count before export |
| Moving objects | Ghosting / moving-object filter on |
| Texture | Generic mapping, mosaic blending, **texture size 8192**, **page count from the table below** |

Typical settings:
- **Agisoft Metashape:** Build Texture → Mapping *Generic*, Blending
  *Mosaic*, Texture size *8192*, **Texture count N**, ghosting filter on.
  For 3D Tiles: *Build Tiled Model* (source: depth maps), then export
  *Cesium 3D Tiles*.
- **Pix4D (Mapper / Matic):** mesh texture at maximum resolution; 3D Tiles
  export where available.
- **DJI Terra:** 3D reconstruction at *High*; output **3D Tiles (B3DM)**
  in addition to OBJ.
- **RealityCapture:** texel size ≈ 1.5–2 cm; tiled / 3D Tiles export.

**How many texture pages** (8192², at 2 cm/px, about 60% of each page used):

| Campus size | Texture pixels | 8192² pages | (or 4096² pages) |
|---|---|---|---|
| 2 ha | ≈ 90 M | 2 | 6 |
| 4 ha | ≈ 180 M | 3 | 11 |
| 6.5 ha | ≈ 290 M | 5 | 17 |
| 10 ha | ≈ 440 M | 7 | 27 |

**Same project, same position:** export the 2D orthophoto (KMZ) from the same
project, so the 2D map and the 3D model line up.

## 4. Export

**Preferred: OGC 3D Tiles.** A folder with `tileset.json` and its tile files
(B3DM or glTF content), with the software's own detail levels. Do not
simplify or re-tile it afterwards.

**Also accepted: one full-quality model.**
- Format **GLB** (the platform uploads GLB only). Add the OBJ + MTL +
  textures export to the handover folder if you have it.
- **All texture pages**, JPEG quality ≥ 90 (or PNG). Never merged into one
  atlas, never reduced to 4096.
- Positions in metres.
- **Not compressed for the web:** no Draco, no Meshopt, no quantisation, no
  "web/viewer" or "lightweight" export preset. The platform compresses the
  model itself. A pre-compressed file is flagged at upload as "already
  compressed for the web" and stays at preview quality.

**Coordinates.** State the coordinate system and its EPSG code (e.g. WGS 84
/ UTM zone 35S or 36S) and any local offset that was applied to the model.

## 5. Handover

One folder per school:

```
<school-code>_<YYYY-MM-DD>/
  tiles/            3D Tiles export (tileset.json …)          — preferred
  model/            full-quality GLB or OBJ + textures          — if no tiles
  ortho/            orthophoto (GeoTIFF and KMZ) from the same project
  project/          software project file (Metashape .psx + files, etc.)
  report.pdf        processing report (alignment, accuracy, GSD)
  README.txt        drone, camera, flight date and times, heights,
                    overlaps, RTK/GCP, coordinate system (EPSG), software
                    and version, texture size and count
  SHA256SUMS.txt    checksums of every file above
```

Uploads to the platform are limited to 2 GB per file today. Larger tilesets
go by shared drive until 3D Tiles upload is live (plan, Phase 4).

## 6. Acceptance check

The GIS team checks, before the school's model goes live:

1. Detail meter on the delivered model: ground and roofs ≤ 2 cm/px (median),
   walls ≤ 4 cm/px (90th percentile), not pre-compressed.
2. Accuracy from the processing report within section 1.
3. A visual walk round in the 3D view: classroom walls, window frames and
   doors distinct; roof sheets flat, not wavy; no holes on main buildings;
   signboards readable from about 5 m.
4. The model and the 2D orthophoto line up on the 2D/3D map.

A delivery that fails a check goes back with the meter output and
screenshots.

## 7. Pilot

The first school under this spec is **Nyanza TSS**. Deliver both a 3D Tiles
export and a multi-page GLB from the same project, so the two delivery paths
can be compared (plan, Phases 3–4).
