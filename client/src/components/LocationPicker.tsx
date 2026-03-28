import { useState, useEffect, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Input } from "./ui/input";
import { RichDropdown } from "./ui/rich-dropdown";
import type { DropdownOption } from "./ui/rich-dropdown";
import {
  MapPin,
  Navigation,
  Map as MapIcon,
  Satellite,
  Mountain,
  Layers,
  Box,
  Globe,
} from "lucide-react";
import { rwandaLocation } from "@devrw/rwanda-location";
import type {
  Province,
  District,
  Sector,
  Cell,
  Village,
} from "@devrw/rwanda-location";

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })
  ._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Rwanda center as default
const rwandaCenter: [number, number] = [-1.9403, 29.8739];

// Map view types
type MapViewType = "street" | "satellite" | "terrain";

// Map tile layers
const mapTileLayers: Record<MapViewType, { url: string; attribution: string }> =
  {
    street: {
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
    satellite: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attribution: "&copy; Esri",
    },
    terrain: {
      url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
      attribution: "&copy; OpenTopoMap",
    },
  };

// Approximate center coordinates for each province
const provinceCenters: Record<number, [number, number]> = {
  1: [-1.9536, 30.0606], // KIGALI
  2: [-2.5654, 29.5717], // SOUTH
  3: [-2.0696, 29.0097], // WEST
  4: [-1.4618, 29.6093], // NORTH
  5: [-2.0619, 30.4386], // EAST
};

// Approximate center coordinates for major districts
const districtCenters: Record<number, [number, number]> = {
  101: [-1.9403, 30.0446],
  102: [-1.8844, 30.134],
  103: [-1.9519, 30.1389],
  501: [-2.2074, 30.0674],
  502: [-1.6977, 30.4287],
  503: [-1.9644, 30.2164],
  504: [-2.222, 30.8123],
  505: [-2.1889, 30.5485],
  506: [-1.4209, 30.3328],
  507: [-1.9487, 30.435],
  401: [-1.5118, 29.7584],
  402: [-1.7793, 29.8656],
  403: [-1.6778, 29.9714],
  404: [-1.5022, 29.5345],
  405: [-1.9171, 29.9659],
  201: [-2.7859, 29.7658],
  202: [-2.5968, 29.7395],
  203: [-2.1036, 29.8378],
  204: [-2.0794, 29.7419],
  205: [-2.4347, 29.5663],
  206: [-2.3535, 29.9321],
  207: [-2.6658, 29.4705],
  208: [-2.2271, 29.7829],
  301: [-2.1359, 29.3519],
  302: [-2.3401, 29.3853],
  303: [-1.6936, 29.4305],
  304: [-2.4609, 28.9089],
  305: [-1.6797, 29.2566],
  306: [-2.1889, 28.8679],
  307: [-2.5122, 28.8173],
};

function getApproximateCenter(
  provinceCode: number | null,
  districtCode: number | null,
): [number, number] | null {
  if (districtCode && districtCenters[districtCode])
    return districtCenters[districtCode];
  if (provinceCode && provinceCenters[provinceCode])
    return provinceCenters[provinceCode];
  return null;
}

function getZoomLevel(
  hasProvince: boolean,
  hasDistrict: boolean,
  hasSector: boolean,
): number {
  if (hasSector) return 15;
  if (hasDistrict) return 12;
  if (hasProvince) return 10;
  return 8;
}

interface LocationPickerProps {
  latitude: string;
  longitude: string;
  province: string;
  district: string;
  sector: string;
  cell: string;
  village: string;
  address: string;
  elevation: string;
  onLocationChange: (lat: string, lng: string) => void;
  onAdministrativeChange: (field: string, value: string) => void;
  onAddressChange: (value: string) => void;
  onElevationChange: (value: string) => void;
  kmz2dFilePath?: string;
  tifFilePath?: string;
  onGisChange?: (field: string, value: string) => void;
}

function MapClickHandler({
  onLocationSelect,
}: {
  onLocationSelect: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click: (e) => onLocationSelect(e.latlng.lat, e.latlng.lng),
  });
  return null;
}

function MapUpdater({
  center,
  zoom,
}: {
  center: [number, number];
  zoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (center[0] !== 0 && center[1] !== 0) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);
  return null;
}

export function LocationPicker({
  latitude,
  longitude,
  province,
  district,
  sector,
  cell,
  village,
  address,
  elevation,
  onLocationChange,
  onAdministrativeChange,
  onAddressChange,
  onElevationChange,
  kmz2dFilePath = "",
  tifFilePath = "",
  onGisChange,
}: LocationPickerProps) {
  // Map view state
  const [mapView, setMapView] = useState<MapViewType>("street");

  // Administrative division codes
  const [selectedProvinceCode, setSelectedProvinceCode] = useState<
    number | null
  >(null);
  const [selectedDistrictCode, setSelectedDistrictCode] = useState<
    number | null
  >(null);
  const [selectedSectorCode, setSelectedSectorCode] = useState<string | null>(
    null,
  );
  const [selectedCellCode, setSelectedCellCode] = useState<number | null>(null);

  // Dropdown options
  const [provinceOptions, setProvinceOptions] = useState<DropdownOption[]>([]);
  const [districtOptions, setDistrictOptions] = useState<DropdownOption[]>([]);
  const [sectorOptions, setSectorOptions] = useState<DropdownOption[]>([]);
  const [cellOptions, setCellOptions] = useState<DropdownOption[]>([]);
  const [villageOptions, setVillageOptions] = useState<DropdownOption[]>([]);

  // Pin state
  const [userMovedPin, setUserMovedPin] = useState(false);
  const [autoCenter, setAutoCenter] = useState<[number, number] | null>(null);
  const [isLoadingElevation, setIsLoadingElevation] = useState(false);

  // Load provinces on mount
  useEffect(() => {
    const provinces = rwandaLocation.getProvinces();
    setProvinceOptions(
      provinces.map((p: Province) => ({
        label: p.name.charAt(0) + p.name.slice(1).toLowerCase(),
        value: p.code.toString(),
      })),
    );
  }, []);

  // Initialize selected codes from props (for edit mode)
  useEffect(() => {
    if (!province || !district || !sector) return;

    // Check if province is already a code (numeric) or a name
    const provinceCode = !isNaN(Number(province)) ? Number(province) : null;

    if (provinceCode) {
      // Codes provided directly - use them
      setSelectedProvinceCode(provinceCode);

      const districtCode = !isNaN(Number(district)) ? Number(district) : null;
      if (districtCode) {
        setSelectedDistrictCode(districtCode);

        if (sector) {
          setSelectedSectorCode(sector);

          if (cell) {
            const cellCode = !isNaN(Number(cell)) ? Number(cell) : null;
            if (cellCode) {
              setSelectedCellCode(cellCode);
            }
          }
        }
      }
    } else {
      // Names provided - try to find codes by name
      const provinces = rwandaLocation.getProvinces();
      const provinceData = provinces.find(
        (p) =>
          p.name.toLowerCase() === province.toLowerCase() ||
          p.name.toLowerCase() === province.toLowerCase().replace(/\s/g, ""),
      );
      if (provinceData) {
        setSelectedProvinceCode(provinceData.code);

        // Find district code by name
        const districts = rwandaLocation.getDistricts(provinceData.code);
        const districtData = districts.find(
          (d) => d.name.toLowerCase() === district.toLowerCase(),
        );
        if (districtData) {
          setSelectedDistrictCode(districtData.code);

          // Find sector code by name
          const sectors = rwandaLocation.getSectors(
            districtData.code,
            provinceData.code,
          );
          const sectorData = sectors.find(
            (s) => s.name.toLowerCase() === sector.toLowerCase(),
          );
          if (sectorData) {
            setSelectedSectorCode(sectorData.code);

            // Find cell code by name (if provided)
            if (cell) {
              const cells = rwandaLocation.getCells(
                sectorData.code,
                districtData.code,
                provinceData.code,
              );
              const cellData = cells.find(
                (c) => c.name.toLowerCase() === cell.toLowerCase(),
              );
              if (cellData) {
                setSelectedCellCode(cellData.code);
              }
            }
          }
        }
      }
    }
  }, [province, district, sector, cell, village]);

  // Auto-center based on selection
  useEffect(() => {
    if (!userMovedPin) {
      const center = getApproximateCenter(
        selectedProvinceCode ? parseInt(selectedProvinceCode.toString()) : null,
        selectedDistrictCode ? parseInt(selectedDistrictCode.toString()) : null,
      );
      if (center) {
        setAutoCenter(center);
        if (!latitude || !longitude) {
          onLocationChange(center[0].toFixed(6), center[1].toFixed(6));
        }
      }
    }
  }, [
    selectedProvinceCode,
    selectedDistrictCode,
    userMovedPin,
    latitude,
    longitude,
    onLocationChange,
  ]);

  // Load districts
  useEffect(() => {
    if (!selectedProvinceCode) {
      setDistrictOptions([]);
      return;
    }
    const districts = rwandaLocation.getDistricts(selectedProvinceCode);
    setDistrictOptions(
      districts.map((d: District) => ({
        label: d.name.charAt(0) + d.name.slice(1).toLowerCase(),
        value: d.code.toString(),
      })),
    );
  }, [selectedProvinceCode]);

  // Load sectors
  useEffect(() => {
    if (!selectedDistrictCode) {
      setSectorOptions([]);
      return;
    }
    const sectors = rwandaLocation.getSectors(selectedDistrictCode);
    setSectorOptions(
      sectors.map((s: Sector) => ({
        label: s.name.charAt(0) + s.name.slice(1).toLowerCase(),
        value: s.code,
      })),
    );
  }, [selectedDistrictCode]);

  // Load cells
  useEffect(() => {
    if (!selectedSectorCode) {
      setCellOptions([]);
      return;
    }
    const cells = rwandaLocation.getCells(selectedSectorCode);
    setCellOptions(
      cells.map((c: Cell) => ({
        label: c.name.charAt(0) + c.name.slice(1).toLowerCase(),
        value: c.code.toString(),
      })),
    );
  }, [selectedSectorCode]);

  // Load villages
  useEffect(() => {
    if (!selectedCellCode) {
      setVillageOptions([]);
      return;
    }
    const villages = rwandaLocation.getVillages(selectedCellCode);
    setVillageOptions(
      villages.map((v: Village) => ({
        label: v.name.charAt(0) + v.name.slice(1).toLowerCase(),
        value: v.code.toString(),
      })),
    );
  }, [selectedCellCode]);

  // Fetch elevation from Open-Elevation API
  const fetchElevation = async (lat: number, lng: number) => {
    setIsLoadingElevation(true);
    try {
      const response = await fetch(
        `https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch elevation");
      }

      const data = await response.json();
      if (data.results && data.results.length > 0) {
        const elevationValue = Math.round(data.results[0].elevation);
        onElevationChange(elevationValue.toString());
      }
    } catch (error) {
      console.error("Error fetching elevation:", error);
      // Try alternative API if primary fails
      try {
        const altResponse = await fetch(
          `https://elevation-api.io/api/elevation?points=${lat},${lng}`,
        );
        if (altResponse.ok) {
          const altData = await altResponse.json();
          if (altData.results && altData.results.length > 0) {
            const elevationValue = Math.round(
              altData.results[0].elevation.meters,
            );
            onElevationChange(elevationValue.toString());
          }
        }
      } catch (altError) {
        console.error("Alternative elevation API also failed:", altError);
      }
    } finally {
      setIsLoadingElevation(false);
    }
  };

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      setUserMovedPin(true);
      onLocationChange(lat.toFixed(6), lng.toFixed(6));
      // Automatically fetch elevation for the selected location
      fetchElevation(lat, lng);
    },
    [onLocationChange, onElevationChange],
  );

  const handleProvinceChange = (value: string) => {
    setUserMovedPin(false);
    const code = value ? parseInt(value) : null;
    setSelectedProvinceCode(code);
    setSelectedDistrictCode(null);
    setSelectedSectorCode(null);
    setSelectedCellCode(null);
    setDistrictOptions([]);
    setSectorOptions([]);
    setCellOptions([]);
    setVillageOptions([]);
    onAdministrativeChange("province", value);
    onAdministrativeChange("district", "");
    onAdministrativeChange("sector", "");
    onAdministrativeChange("cell", "");
    onAdministrativeChange("village", "");
  };

  const handleDistrictChange = (value: string) => {
    setUserMovedPin(false);
    const code = value ? parseInt(value) : null;
    setSelectedDistrictCode(code);
    setSelectedSectorCode(null);
    setSelectedCellCode(null);
    setSectorOptions([]);
    setCellOptions([]);
    setVillageOptions([]);
    onAdministrativeChange("district", value);
    onAdministrativeChange("sector", "");
    onAdministrativeChange("cell", "");
    onAdministrativeChange("village", "");
  };

  const handleSectorChange = (value: string) => {
    setUserMovedPin(false);
    setSelectedSectorCode(value);
    setSelectedCellCode(null);
    setCellOptions([]);
    setVillageOptions([]);
    onAdministrativeChange("sector", value);
    onAdministrativeChange("cell", "");
    onAdministrativeChange("village", "");
  };

  const handleCellChange = (value: string) => {
    setUserMovedPin(false);
    const code = value ? parseInt(value) : null;
    setSelectedCellCode(code);
    setVillageOptions([]);
    onAdministrativeChange("cell", value);
    onAdministrativeChange("village", "");
  };

  const handleVillageChange = (value: string) => {
    setUserMovedPin(false);
    onAdministrativeChange("village", value);
  };

  const mapCenter =
    autoCenter ||
    (latitude && longitude
      ? [parseFloat(latitude), parseFloat(longitude)]
      : rwandaCenter);
  const mapZoom = getZoomLevel(
    !!selectedProvinceCode,
    !!selectedDistrictCode,
    !!selectedSectorCode,
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">
            Province <span className="text-destructive">*</span>
          </label>
          <RichDropdown
            options={provinceOptions}
            value={selectedProvinceCode?.toString() || ""}
            onChange={handleProvinceChange}
            placeholder="Select Province"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">
            District <span className="text-destructive">*</span>
          </label>
          <RichDropdown
            options={districtOptions}
            value={selectedDistrictCode?.toString() || ""}
            onChange={handleDistrictChange}
            placeholder={
              !selectedProvinceCode
                ? "Select Province first"
                : "Select District"
            }
            disabled={!selectedProvinceCode}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">
            Sector <span className="text-destructive">*</span>
          </label>
          <RichDropdown
            options={sectorOptions}
            value={selectedSectorCode?.toString() || ""}
            onChange={handleSectorChange}
            placeholder={
              !selectedDistrictCode ? "Select District first" : "Select Sector"
            }
            disabled={!selectedDistrictCode}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">Cell</label>
          <RichDropdown
            options={cellOptions}
            value={selectedCellCode?.toString() || ""}
            onChange={handleCellChange}
            placeholder={
              !selectedSectorCode ? "Select Sector first" : "Select Cell"
            }
            disabled={!selectedSectorCode}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">
            Village
          </label>
          <RichDropdown
            options={villageOptions}
            value={village || ""}
            onChange={handleVillageChange}
            placeholder={
              !selectedCellCode ? "Select Cell first" : "Select Village"
            }
            disabled={!selectedCellCode}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">
            Address
          </label>
          <Input
            value={address}
            onChange={(e) => onAddressChange(e.target.value)}
            placeholder="Physical address"
            className="rounded-xl border-border/30 bg-background/80 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all h-11"
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold text-foreground">
              Pick Location on Map <span className="text-destructive">*</span>
            </label>
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <button
                type="button"
                onClick={() => setMapView("street")}
                className={`p-1.5 rounded-md transition-colors ${mapView === "street" ? "bg-primary text-primary-foreground" : "hover:bg-muted-foreground/20"}`}
                title="Street View"
              >
                <MapIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setMapView("satellite")}
                className={`p-1.5 rounded-md transition-colors ${mapView === "satellite" ? "bg-primary text-primary-foreground" : "hover:bg-muted-foreground/20"}`}
                title="Satellite View"
              >
                <Satellite className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setMapView("terrain")}
                className={`p-1.5 rounded-md transition-colors ${mapView === "terrain" ? "bg-primary text-primary-foreground" : "hover:bg-muted-foreground/20"}`}
                title="Terrain View"
              >
                <Mountain className="w-4 h-4" />
              </button>
            </div>
          </div>
          <span className="text-xs text-muted-foreground flex items-center gap-2">
            {userMovedPin && (
              <span className="text-amber-600 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                Manual pin - click map to adjust
              </span>
            )}
            {!userMovedPin && province && (
              <span className="text-green-600 flex items-center gap-1">
                <Navigation className="w-3 h-3" />
                Auto-centered to{" "}
                {district ? `${province} > ${district}` : province}
              </span>
            )}
            {!userMovedPin && !province && (
              <span className="flex items-center gap-1">
                <Navigation className="w-3 h-3" />
                Click on map to set coordinates
              </span>
            )}
          </span>
        </div>
        <div
          className="relative rounded-xl overflow-hidden border border-border/30"
          style={{ height: "350px" }}
        >
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            style={{ height: "100%", width: "100%" }}
            className="z-0"
          >
            <TileLayer
              attribution={mapTileLayers[mapView].attribution}
              url={mapTileLayers[mapView].url}
            />
            <MapClickHandler onLocationSelect={handleMapClick} />
            <MapUpdater center={mapCenter} zoom={mapZoom} />
            {latitude && longitude && (
              <Marker
                position={[
                  parseFloat(latitude) || mapCenter[0],
                  parseFloat(longitude) || mapCenter[1],
                ]}
              />
            )}
          </MapContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">
            Latitude <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={latitude}
              onChange={(e) => onLocationChange(e.target.value, longitude)}
              placeholder="-1.9441"
              required
              className="pl-10 rounded-xl border-border/30 bg-background/80 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all h-11"
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">
            Longitude <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={longitude}
              onChange={(e) => onLocationChange(latitude, e.target.value)}
              placeholder="30.0619"
              required
              className="pl-10 rounded-xl border-border/30 bg-background/80 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all h-11"
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">
            Elevation (m)
            {isLoadingElevation && (
              <span className="text-xs text-muted-foreground font-normal ml-2">
                (fetching...)
              </span>
            )}
          </label>
          <Input
            value={elevation}
            onChange={(e) => onElevationChange(e.target.value)}
            type="number"
            step="any"
            placeholder={isLoadingElevation ? "Loading..." : "e.g. 1500"}
            disabled={isLoadingElevation}
            className="rounded-xl border-border/30 bg-background/80 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all h-11"
          />
        </div>
      </div>

      <div className="pt-4 border-t border-border/20">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 rounded-full bg-linear-to-b from-blue-500 to-blue-400" />
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400" />
            High-Resolution Spatial Assets (Optimization)
          </h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Box className="w-3 h-3" />
              2D Optimized Orthomosaic (KMZ)
            </label>
            <Input
              value={kmz2dFilePath}
              onChange={(e) => onGisChange?.("kmz2dFilePath", e.target.value)}
              placeholder="e.g. schools/123/kmz_2d/ortho_optimized.kmz"
              className="rounded-xl border-border/30 bg-background/80 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all h-10 text-xs"
            />
            <p className="text-[10px] text-muted-foreground italic px-1">
              Optimized version for the 2D viewer (smaller file size).
            </p>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Globe className="w-3 h-3" />
              Highest Resolution TIF (COG)
            </label>
            <Input
              value={tifFilePath}
              onChange={(e) => onGisChange?.("tifFilePath", e.target.value)}
              placeholder="e.g. schools/123/tif/large_ortho.tif"
              className="rounded-xl border-border/30 bg-background/80 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all h-10 text-xs"
            />
            <p className="text-[10px] text-muted-foreground italic px-1">
              Cloud Optimized GeoTIFF (COG) for lossless native-quality zoom.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
