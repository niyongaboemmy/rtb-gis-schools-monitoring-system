# Drone Image Progressive Loading — Analysis & Solution Design

## 1. Current Rendering Pipeline (How It Works Today)

```
KMZ file (on server)
  └─ fetch() → ArrayBuffer
       └─ JSZip.loadAsync()
            ├─ Non-KML files → URL.createObjectURL() → blob: URLs (assetMap)
            ├─ KML files → <href> rewritten to blob: URLs
            └─ parseGroundOverlaysFromKml()
                 └─ per <GroundOverlay>: { north, south, east, west, imageUrl, drawOrder }
                      └─ ImageLayer(ImageStatic)
                           ├─ url: blob: URL pointing to the full-res image
                           ├─ imageExtent: EPSG:3857 bounding box
                           └─ added to OL map, grouped by drawOrder (150 ms apart)
```

Each `<GroundOverlay>` in the KML becomes one OpenLayers `ImageLayer` backed by `ImageStatic`. The entire image (e.g. `2076 × 1338` px orthophoto) is downloaded at once and placed on the map canvas.

---

## 2. Root Cause of the Coordinate Offset Warning

```
[Image: original 2076x1338, displayed at 2000x1289.
 Multiply coordinates by 1.04 to map to original image.]
```

This is an **OpenLayers internal warning** from `ImageStatic`. When OL rasterises the image onto its canvas it caps the maximum dimension at `2000 px` (browser/GPU canvas limit). The actual image is `2076 px` wide, so OL scales the canvas representation down by `2076 / 2000 = 1.038 ≈ 1.04×`.

**Effect:** The drone orthophoto is **rendered ~4% smaller** than its actual pixel dimensions. Because the geographic extent (`imageExtent`) is still the original bounding box, every pixel in the rendered image now corresponds to a slightly larger geographic area → **the image appears slightly misaligned / stretched** when overlaid with KML vector features or the satellite basemap.

**It is not a data or projection error** — it is purely a browser canvas size constraint imposed on a single oversized image.

---

## 3. Why the Existing "Progressive Loading" Is Incomplete

The current code in `loadGroundOverlays` (lines 587–636) groups overlays by `drawOrder` and staggeres HTTP requests by 150 ms:

```ts
const groupedByLevel = new Map<number, GroundOverlayData[]>();
// ...
setTimeout(loadNextLevel, 150);
```

**What this does:** Breaks up simultaneous HTTP requests to avoid a burst of parallel downloads. It is a network-level optimisation.

**What it does NOT do:**
- It does not produce lower-resolution previews — the full-resolution image is always requested.
- The `drawOrder` in a single-image KMZ is typically `0` for everything, so there is only one level anyway.
- There is no zoom-based LOD (Level of Detail) — the same full-res image is shown at every zoom level from 1× to 23×.
- Blob URLs are created for all images at unpack time, keeping the entire orthophoto in browser RAM even if the user is zoomed out.

---

## 4. Proposed Solution — Three Tiers

### Tier 1 — Quick Win (Pure Client, No Server Changes)

**Strategy: multi-resolution KMZ packing**

Pack the drone orthophoto into the KMZ at three resolution levels as separate `<GroundOverlay>` elements, each with a different `drawOrder`:

| drawOrder | Image size | Purpose |
|-----------|-----------|---------|
| 0 | ≤ 256 × 165 px | Instant preview (< 10 KB) |
| 1 | ≤ 800 × 515 px | Medium detail |
| 2 | 2076 × 1338 px | Full resolution |

The existing `loadGroundOverlays` code already staggers groups by `drawOrder`, so this requires **zero client code changes**. Levels 0 and 1 load fast and give the user immediate visual feedback; level 2 loads behind them.

**How to generate the multi-res images (Python / PIL example):**

```python
from PIL import Image

img = Image.open("orthophoto.jpg")
img.save("ortho_thumb.jpg",  quality=75)                          # full res
img.resize((800, int(800 * img.height / img.width))).save("ortho_med.jpg",   quality=75)
img.resize((256, int(256 * img.height / img.width))).save("ortho_low.jpg",   quality=60)
```

**KML snippet:**

```xml
<GroundOverlay><drawOrder>0</drawOrder>
  <Icon><href>files/ortho_low.jpg</href></Icon>
  <LatLonBox>...</LatLonBox>
</GroundOverlay>
<GroundOverlay><drawOrder>1</drawOrder>
  <Icon><href>files/ortho_med.jpg</href></Icon>
  <LatLonBox>...</LatLonBox>
</GroundOverlay>
<GroundOverlay><drawOrder>2</drawOrder>
  <Icon><href>files/ortho_thumb.jpg</href></Icon>
  <LatLonBox>...</LatLonBox>
</GroundOverlay>
```

**Fixes the 1.04× issue:** The full-res image can be stored at ≤ 2000 px wide (e.g. 2000 × 1289) to stay within the OL canvas limit, eliminating the scaling warning entirely.

---

### Tier 2 — Recommended (Server-Side XYZ Tile Pyramid)

**Strategy: GDAL tile generation → TileLayer + XYZ source**

Convert the orthophoto into a standard XYZ tile pyramid using `gdal2tiles.py`. OpenLayers then requests only the tiles visible in the current viewport at the appropriate zoom level — identical to how the basemap works.

**Generation (once, on the server):**

```bash
# GDAL approach
gdal_translate -of GTiff -a_srs EPSG:4326 \
  -a_ullr <west> <north> <east> <south> \
  orthophoto.jpg ortho_geo.tif

gdal2tiles.py -z 15-21 -w none ortho_geo.tif ./tiles/school_123/
```

**Serving:** The `tiles/school_123/{z}/{x}/{y}.png` directory is served statically. Each tile is ≤ 256 × 256 px.

**Client change in `loadGroundOverlays`:**

Replace `ImageLayer(ImageStatic)` with a `TileLayer(XYZ)`:

```ts
// Instead of ImageStatic for each GroundOverlay:
const tileLayer = new TileLayer({
  source: new XYZ({
    url: `${FILE_SERVER_URL}/tiles/${school.id}/{z}/{x}/{y}.png`,
    minZoom: 15,
    maxZoom: 21,
    crossOrigin: "anonymous",
  }),
  zIndex: 5,
  opacity: kmzOpacity,
});
map.addLayer(tileLayer);
```

**Benefits:**
- Completely eliminates the 1.04× canvas scaling issue (tiles are 256 × 256).
- Only tiles in the viewport are fetched → minimal bandwidth at low zoom.
- Browser cache handles re-visits for free.
- Zoom-responsive: low zoom = coarser tiles; high zoom = full-detail tiles.
- No blob URL memory pressure.

**Drawback:** Requires a tile generation step in the upload pipeline (can be async/background job).

---

### Tier 3 — Best Long-Term (Cloud Optimized GeoTIFF)

**Strategy: COG + `ol-geotiff` source**

A COG stores internal tile pyramids in a single file. The HTTP range request mechanism means the client downloads only the byte-range corresponding to the current viewport and zoom level — no pre-tiling needed.

**Generation:**

```bash
# Using rio-cogeo
pip install rio-cogeo
rio cogeo create orthophoto.tif orthophoto_cog.tif --cog-profile deflate
```

**Client dependency:**

```bash
npm install geotiff @geotiff/georaster georaster-layer-for-leaflet
# or for OpenLayers:
npm install ol-geotiff
```

**Client usage sketch:**

```ts
import GeoTIFF from "ol/source/GeoTIFF";
import WebGLTileLayer from "ol/layer/WebGLTile";

const cogLayer = new WebGLTileLayer({
  source: new GeoTIFF({
    sources: [{ url: `${FILE_SERVER_URL}/schools/${school.id}/cog/ortho.tif` }],
  }),
  zIndex: 5,
  opacity: kmzOpacity,
});
map.addLayer(cogLayer);
```

OpenLayers 7+ has native COG support via `ol/source/GeoTIFF` — no extra library needed.

**Benefits:**
- Single file upload (no tile generation step).
- True streaming LOD via HTTP range requests.
- Works at any zoom without pre-computing zoom levels.

**Drawback:** Requires OpenLayers ≥ 7 and WebGL renderer; slightly more complex server CORS headers (`Accept-Ranges: bytes`).

---

## 5. Decision Matrix

| Criterion | Tier 1 (Multi-res KMZ) | Tier 2 (XYZ Tiles) | Tier 3 (COG) |
|-----------|----------------------|-------------------|-------------|
| Server changes | Minor (upload processor) | Moderate (tile pipeline) | Minor (COG convert) |
| Client changes | None | Small | Small (OL 7+ required) |
| Fixes 1.04× offset | Yes (cap image at 2000 px) | Yes (256 px tiles) | Yes |
| Performance at low zoom | Good | Excellent | Excellent |
| Performance at high zoom | Good (loads full image) | Excellent (only viewport tiles) | Excellent |
| Browser RAM usage | Medium (3 blobs in RAM) | Low (cached tiles) | Low (range requests) |
| Offline / no extra infra | Yes | Yes (static files) | Yes (single file) |
| Implementation effort | Low | Medium | Medium |

**Recommendation for immediate use:** Tier 1 (zero client changes, fixes the warning, improves UX).
**Recommendation for production scale:** Tier 2 (tile pyramid), integrated as a background job triggered on KMZ upload.

---

## 6. Fixing the 1.04× Warning Without Multi-Res

If a full rework is not yet feasible, the coordinate offset can be neutralised by resizing the source image to exactly `2000 × (height * 2000/width)` before packing into the KMZ. This ensures the image fits within OL's canvas limit with no scaling needed:

```python
from PIL import Image
img = Image.open("ortho.jpg")
w, h = img.size
if w > 2000:
    img = img.resize((2000, int(h * 2000 / w)), Image.LANCZOS)
img.save("ortho_capped.jpg", quality=85)
```

The geographic `LatLonBox` in the KML is unchanged — only the pixel dimensions change.

---

## 7. Suggested Lazy-Loading Enhancement for Tier 1 (Client Code)

The current stagger delay is a hard 150 ms per level. A more robust approach waits for the lower-res image to actually render before requesting the next:

```ts
const loadNextLevel = () => {
  if (currentLevelIndex >= levels.length || !mapRef.current) return;
  // ... add layer for current level ...
  currentLevelIndex++;

  // Wait for the image to load, not just a fixed timeout
  const lastLayer = groundOverlayLayersRef.current.at(-1);
  if (lastLayer) {
    lastLayer.getSource()!.on("imageloadend", () => {
      requestAnimationFrame(loadNextLevel); // yield one frame then load next
    });
    lastLayer.getSource()!.on("imageloaderror", () => {
      requestAnimationFrame(loadNextLevel); // continue even on error
    });
  } else {
    setTimeout(loadNextLevel, 150); // fallback
  }
};
```

This gives true progressive rendering: the medium-res image only starts downloading after the low-res thumbnail is fully painted.

---

## 8. Summary of Files Involved

| File | Role |
|------|------|
| [School2DViewer.tsx](../client/src/components/School2DViewer.tsx) | Map component — all rendering logic |
| `unpackKmzFile()` (lines 87–156) | Unzips KMZ, creates blob URLs for all assets |
| `parseGroundOverlaysFromKml()` (lines 159–193) | Extracts GroundOverlay bounds + image URLs |
| `loadGroundOverlays()` (lines 565–637) | Creates `ImageLayer(ImageStatic)` per overlay, staggers by `drawOrder` |
| `loadKml()` (lines 639–685) | Orchestrates KML vector features + ground overlay loading |
