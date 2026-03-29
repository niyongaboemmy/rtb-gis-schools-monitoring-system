import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Viewer,
  Entity,
  Model,
  useCesium,
  Fog,
  Sun,
  SkyAtmosphere,
  KmlDataSource,
  GeoJsonDataSource,
  PolylineGraphics,
  PolygonGraphics,
  ImageryLayer,
} from "resium";
import JSZip from "jszip";
import {
  Cartesian3,
  Math as CesiumMath,
  Ion,
  createWorldTerrainAsync,
  Color,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  CallbackProperty,
  PolygonHierarchy,
  KmlDataSource as CesiumKmlDataSource,
  SingleTileImageryProvider,
} from "cesium";
import {
  X,
  Maximize2,
  Minimize2,
  Globe,
  ShieldCheck,
  Box,
  Download,
  Ruler,
  Square,
  MapPin,
  Search,
  Layers,
  Eye,
  EyeOff,
  PlusCircle,
  MessageSquare,
  MousePointer2,
} from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";
import { Card } from "./ui/card";
import { BlockInspector } from "./BlockInspector";
import { BuildingFormDrawer } from "./school-form-steps/BuildingFormDrawer";
import type { BuildingData } from "./school-form-steps/BuildingsStep";
import { FILE_SERVER_URL, api } from "../lib/api";

Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN;

type ViewMode = "2D" | "3D";

interface School3DViewProps {
  /** Raw school object from the API */
  school: any;
  /** Override buildings list */
  buildings?: any[];
  /** Override places overlay */
  placesOverlay?: any;
  onClose?: () => void;
  isEmbed?: boolean;
  onSelectBuilding?: (building: any) => void;
  initialBuildingId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// unpackKmzFile
// ─────────────────────────────────────────────────────────────────────────────
interface UnpackedKmzFile {
  kmlText: string;
  kmlBlob: Blob;
  sourceUri: string;
  cleanup: () => void;
}

async function unpackKmzFile(file: File): Promise<UnpackedKmzFile> {
  const createdBlobUrls: string[] = [];
  const buffer = await file.arrayBuffer();
  const sourceUri = `https://local-kmz-host/${encodeURIComponent(file.name)}`;
  const sig = new Uint8Array(buffer, 0, 2);
  const isZip = sig[0] === 0x50 && sig[1] === 0x4b;
  let kmlText: string;

  if (isZip) {
    const zip = await new JSZip().loadAsync(buffer);
    const assetMap = new Map<string, string>();
    await Promise.all(
      Object.keys(zip.files)
        .filter((n) => !n.toLowerCase().endsWith(".kml") && !zip.files[n].dir)
        .map(async (name) => {
          const blob = await zip.files[name].async("blob");
          const url = URL.createObjectURL(blob);
          createdBlobUrls.push(url);
          assetMap.set(name, url);
        }),
    );
    const kmlEntries = Object.keys(zip.files).filter((n) =>
      n.toLowerCase().endsWith(".kml"),
    );
    const rootKml =
      kmlEntries.find((n) => n.toLowerCase() === "doc.kml") ?? kmlEntries[0];
    if (!rootKml) throw new Error("No .kml found.");
    kmlText = await zip.files[rootKml].async("text");
    kmlText = kmlText.replace(/<href>([^<]+)<\/href>/gi, (_, raw) => {
      const path = raw.trim();
      const resolved =
        assetMap.get(path) ?? assetMap.get(path.split("/").pop() ?? "");
      return resolved ? `<href>${resolved}</href>` : `<href>${path}</href>`;
    });
  } else {
    kmlText = new TextDecoder("utf-8").decode(buffer);
  }

  return {
    kmlText,
    kmlBlob: new Blob([kmlText], {
      type: "application/vnd.google-earth.kml+xml",
    }),
    sourceUri,
    cleanup: () => createdBlobUrls.forEach((u) => URL.revokeObjectURL(u)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// KmlLoaderBridge
// ─────────────────────────────────────────────────────────────────────────────
function useKmlLoader(
  viewer: any,
  source: File | string | undefined,
  wallHeight: number,
  callbacks: {
    onFeaturesLoaded: (entities: any[]) => void;
    onLoadStart: () => void;
    onLoadEnd: () => void;
  },
) {
  const dsRef = useRef<CesiumKmlDataSource | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!viewer || !source) return;
    let cancelled = false;
    (async () => {
      callbacks.onLoadStart();
      if (dsRef.current) viewer.dataSources.remove(dsRef.current, true);
      cleanupRef.current?.();
      cleanupRef.current = null;

      try {
        const ds = new CesiumKmlDataSource({
          camera: viewer.scene.camera,
          canvas: viewer.scene.canvas,
        });

        if (source instanceof File) {
          const unpacked = await unpackKmzFile(source);
          if (cancelled) return unpacked.cleanup();
          cleanupRef.current = unpacked.cleanup;
          const tmpUrl = URL.createObjectURL(unpacked.kmlBlob);
          await ds.load(tmpUrl, { sourceUri: unpacked.sourceUri });
          URL.revokeObjectURL(tmpUrl);
        } else {
          await ds.load(source);
        }

        if (cancelled) return;
        const entities = Array.from(ds.entities.values) as any[];
        entities.forEach((e: any) => {
          if (e.polygon) {
            e.polygon.extrudedHeight = wallHeight;
            e.polygon.outline = wallHeight > 0;
            e.polygon.outlineColor = Color.fromCssColorString(
              "rgba(255,255,255,0.5)",
            );
          }
          if (e.label) {
            e.label.font = "bold 14px sans-serif";
            e.label.heightReference = 1;
            e.label.pixelOffset = { x: 0, y: -15 };
            e.label.disableDepthTestDistance = 1000000; // Always visible
            e.label.horizontalOrigin = 0; // CENTER
            e.label.fillColor = Color.WHITE;
            e.label.outlineColor = Color.BLACK;
            e.label.outlineWidth = 2;
          }
          // Handle Point entities (pins/markers)
          if (e.point) {
            e.point.pixelSize = 10;
            e.point.color = Color.RED;
            e.point.outlineColor = Color.WHITE;
            e.point.outlineWidth = 2;
            e.point.heightReference = 1; // Clamp to ground
          }
          // Handle Billboard entities (icon markers)
          if (e.billboard) {
            e.billboard.heightReference = 1; // Clamp to ground
            e.billboard.scale =
              (e.billboard.scale?.getValue?.() ?? e.billboard.scale ?? 1) * 0.5;
            e.billboard.disableDepthTestDistance = 1000000; // Always visible
          }
        });
        await viewer.dataSources.add(ds);
        dsRef.current = ds;
        callbacks.onFeaturesLoaded(entities);
        callbacks.onLoadEnd();
        viewer.zoomTo(ds);
      } catch (err) {
        console.error("[KmlLoader] Error:", err);
        callbacks.onLoadEnd();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [viewer, source, wallHeight]);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      if (dsRef.current && viewer)
        viewer.dataSources.remove(dsRef.current, true);
    };
  }, [viewer]);
}

const KmlLoaderBridge: React.FC<{
  source: File | string;
  wallHeight: number;
  onFeaturesLoaded: (entities: any[]) => void;
  onLoadStart: () => void;
  onLoadEnd: () => void;
}> = ({ source, wallHeight, onFeaturesLoaded, onLoadStart, onLoadEnd }) => {
  const { viewer } = useCesium();
  useKmlLoader(viewer, source, wallHeight, {
    onFeaturesLoaded,
    onLoadStart,
    onLoadEnd,
  });
  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// MeasurementLayer
// ─────────────────────────────────────────────────────────────────────────────
const MeasurementLayer: React.FC<{ mode: "none" | "distance" | "area" }> = ({
  mode,
}) => {
  const { viewer } = useCesium();
  const [positions, setPositions] = useState<Cartesian3[]>([]);
  const [activePoint, setActivePoint] = useState<Cartesian3 | null>(null);

  useEffect(() => {
    if (mode === "none" || !viewer) return;
    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click: any) => {
      const c = viewer.camera.pickEllipsoid(
        click.position,
        viewer.scene.globe.ellipsoid,
      );
      if (c) setPositions((p) => [...p, c]);
    }, ScreenSpaceEventType.LEFT_CLICK);
    handler.setInputAction((mv: any) => {
      const c = viewer.camera.pickEllipsoid(
        mv.endPosition,
        viewer.scene.globe.ellipsoid,
      );
      if (c) setActivePoint(c);
    }, ScreenSpaceEventType.MOUSE_MOVE);
    return () => handler.destroy();
  }, [mode, viewer]);

  if (mode === "none" || positions.length === 0) return null;

  return (
    <Entity>
      {mode === "distance" ? (
        <PolylineGraphics
          positions={
            new CallbackProperty(
              () => (activePoint ? [...positions, activePoint] : positions),
              false,
            )
          }
          width={3}
          material={Color.YELLOW}
          clampToGround
        />
      ) : (
        <PolygonGraphics
          hierarchy={
            new CallbackProperty(
              () =>
                new PolygonHierarchy(
                  activePoint ? [...positions, activePoint] : positions,
                ),
              false,
            )
          }
          material={Color.YELLOW.withAlpha(0.3)}
        />
      )}
    </Entity>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ViewInitializer
// ─────────────────────────────────────────────────────────────────────────────
// ViewInitializer handles the fly-to logic accurately with priority
const ViewInitializer: React.FC<{
  location: { lat: number; lng: number };
  onComplete: () => void;
  initialView?: any;
  initialBuildingId?: string;
  features?: any[];
}> = ({ location, onComplete, initialView, initialBuildingId, features }) => {
  const { viewer } = useCesium();
  useEffect(() => {
    if (!viewer) return;

    // Highest priority: fly to initialBuildingId if provided
    if (initialBuildingId && features && features.length > 0) {
      const target = features.find((f) => {
        const id = f.id || f.name;
        return (
          id === initialBuildingId ||
          (f.name &&
            f.name.toLowerCase().includes(initialBuildingId.toLowerCase()))
        );
      });

      if (target) {
        viewer.flyTo(target, { duration: 3 }).then(onComplete);
        return;
      }
    }

    // Use initialView (from KMZ) as top priority
    if (initialView) {
      const dest = Cartesian3.fromDegrees(
        Number(initialView.longitude),
        Number(initialView.latitude),
        Number(initialView.range || initialView.altitude || 1000),
      );

      const hpr = {
        heading: CesiumMath.toRadians(Number(initialView.heading || 0)),
        pitch: CesiumMath.toRadians(Number(initialView.tilt || -45)),
        roll: CesiumMath.toRadians(Number(initialView.roll || 0)),
      };

      viewer.camera.flyTo({
        destination: dest,
        orientation: hpr,
        duration: 3,
        complete: onComplete,
      });
      return;
    }

    // Fallback to database coordinates
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(
        Number(location.lng),
        Number(location.lat),
        1200,
      ),
      orientation: {
        heading: CesiumMath.toRadians(0),
        pitch: CesiumMath.toRadians(-45),
        roll: 0,
      },
      duration: 3,
      complete: onComplete,
    });
  }, [viewer, location, initialView]);

  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// School3DView
// ─────────────────────────────────────────────────────────────────────────────
const School3DView: React.FC<School3DViewProps> = ({
  school,
  buildings,
  placesOverlay,
  onClose,
  isEmbed,
  onSelectBuilding,
  initialBuildingId,
}) => {
  // ── Derive spatial URLs locally ───────────────────────────────────────────
  const kmzUrl = school.kmzFilePath
    ? school.kmzFilePath.startsWith("/")
      ? school.kmzFilePath
      : `${FILE_SERVER_URL}/schools/${school.id}/kmz/${school.kmzFilePath}`
    : undefined;

  const masterKmlUrl = school.kmzMasterKmlPath
    ? school.kmzMasterKmlPath.startsWith("/") ||
      school.kmzMasterKmlPath.startsWith("http")
      ? school.kmzMasterKmlPath
      : `${FILE_SERVER_URL}/schools/${school.id}/kmz_content/${school.kmzMasterKmlPath}`
    : undefined;

  // Use optimized 2D KMZ if explicitly provided for better performance
  const kmz2dUrl = school.kmz2dFilePath
    ? school.kmz2dFilePath.startsWith("/")
      ? school.kmz2dFilePath
      : `${FILE_SERVER_URL}/schools/${school.id}/kmz_2d/${school.kmz2dFilePath}`
    : undefined;

  const tifUrl = school.tifFilePath
    ? school.tifFilePath.startsWith("/")
      ? school.tifFilePath
      : `${FILE_SERVER_URL}/schools/${school.id}/tif/${school.tifFilePath}`
    : undefined;

  const placesOverlayUrl = school.placesOverlayFilePath
    ? school.placesOverlayFilePath.startsWith("/")
      ? school.placesOverlayFilePath
      : `${FILE_SERVER_URL}/schools/${school.id}/places-overlay/${school.placesOverlayFilePath}`
    : undefined;

  const fallbackLocation = {
    lat: Number(school.latitude) || 0,
    lng: Number(school.longitude) || 0,
  };

  const effectiveBuildings = buildings ?? school.buildings ?? [];
  const geojson = school.geojsonContent;
  const initialView = geojson?.properties?.initialView;
  const kmzFile = undefined; // 3D viewer doesn't receive manual kmzFile prop from SchoolMap

  const viewerRef = useRef<any>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("2D");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isHighQuality, setIsHighQuality] = useState(false);
  const [isRegionalFocus, setIsRegionalFocus] = useState(false);
  const [measurementMode, setMeasurementMode] = useState<
    "none" | "distance" | "area"
  >("none");
  const [showPlacesOverlay, setShowPlacesOverlay] = useState(true);
  const [wallHeight] = useState(0); // Constant for now
  const [features, setFeatures] = useState<any[]>([]);

  useEffect(() => {
    setFeatures([]);
  }, [kmzUrl, masterKmlUrl, geojson]);
  const [showNavigator, setShowNavigator] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEntity, setSelectedEntity] = useState<any>(null);
  const [activeBlock, setActiveBlock] = useState<BuildingData | null>(null);
  const [isBlockInspectorOpen, setIsBlockInspectorOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<string>("none");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerBuilding, setDrawerBuilding] = useState<BuildingData | null>(null);
  const [schoolBuildings, setSchoolBuildings] = useState<BuildingData[]>([]);
  const [availableFacilities, setAvailableFacilities] = useState<any[]>([]);
  const [facilitiesLoading, setFacilitiesLoading] = useState(false);
  const [inspectorPosition, setInspectorPosition] = useState<{ x: number; y: number } | null>(null);

  const [isMapLoading, setIsMapLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [flightComplete, setFlightComplete] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [terrainProvider, setTerrainProvider] = useState<any>(undefined);

  const [currentLat, setCurrentLat] = useState(fallbackLocation.lat);
  const [currentLng, setCurrentLng] = useState(fallbackLocation.lng);
  const [currentAlt, setCurrentAlt] = useState(0);

  const parsedGeojson = React.useMemo(() => {
    if (!geojson) return null;
    try {
      return typeof geojson === "string" ? JSON.parse(geojson) : geojson;
    } catch (e) {
      console.error("Failed to parse GeoJSON:", e);
      return null;
    }
  }, [geojson]);

  const parsedPlacesOverlay = React.useMemo(() => {
    if (!placesOverlay) return null;
    console.log({ placesOverlay: { ...placesOverlay } });
    try {
      return typeof placesOverlay === "string"
        ? JSON.parse(placesOverlay)
        : placesOverlay;
    } catch (e) {
      console.error("Failed to parse places overlay:", e);
      return null;
    }
  }, [placesOverlay]);

  useEffect(() => {
    createWorldTerrainAsync()
      .then(setTerrainProvider)
      .catch(() => {});
  }, []);

  const buildingsWithModels = React.useMemo(
    () => effectiveBuildings.filter((b: any) => b.modelPath),
    [effectiveBuildings],
  );

  const isLargeFile = false; // Legacy check, no longer needed as manual files are handled elsewhere

  const kmzSource = kmzFile ?? kmz2dUrl ?? kmzUrl;
  const hasKmzSource = !!kmzSource;

  useEffect(() => {
    if (
      viewMode === "3D" &&
      !masterKmlUrl &&
      buildingsWithModels.length > 0 &&
      flightComplete
    ) {
      const id = setTimeout(() => setDataLoaded(true), 1500);
      return () => clearTimeout(id);
    }
  }, [viewMode, masterKmlUrl, buildingsWithModels, flightComplete]);

  const [loadingStep, setLoadingStep] = useState(1);
  const [loadingMessage, setLoadingMessage] = useState(
    "Locating school environment...",
  );

  useEffect(() => {
    if (!isMapLoading) return;

    // Update progress based on steps
    if (!flightComplete) {
      setLoadingStep(1);
      setLoadingMessage("Locating school environment...");
    } else if (!dataLoaded) {
      setLoadingStep(2);
      setLoadingMessage(
        tifUrl 
          ? "Rendering High-Res Textures..." 
          : (viewMode === "3D" ? "Extracting 3D Models..." : "Processing Spatial Data...")
      );
    } else {
      setLoadingStep(3);
      setLoadingMessage("Initializing 3D Engine...");
    }
  }, [flightComplete, dataLoaded, isMapLoading, viewMode]);

  useEffect(() => {
    if (!isMapLoading) return;
    // Safety timeout: stop loading after 15 seconds for massive files
    const safetyId = setTimeout(() => {
      setIsMapLoading(false);
    }, 15000);

    // If we have GeoJSON or Master KML, we can clear the loading screen fast
    const canClearLoading =
      flightComplete && (dataLoaded || (viewMode === "2D" && !!parsedGeojson));

    if (canClearLoading) {
      // Step 3 delay: wait a bit for Cesium to actually paint the loaded models
      const finalDelay = viewMode === "3D" ? 3500 : 800;
      setLoadingProgress(100);
      setTimeout(() => setIsMapLoading(false), finalDelay);
    }
    const id = setInterval(() => {
      setLoadingProgress((p) => (p < 90 ? p + 1 : p));
    }, 150);
    return () => {
      clearInterval(id);
      clearTimeout(safetyId);
    };
  }, [
    flightComplete,
    dataLoaded,
    parsedGeojson,
    isMapLoading,
    buildingsWithModels,
    viewMode,
  ]);

  // Performance & Initialization Hook
  useEffect(() => {
    const v = viewerRef.current?.cesiumElement;
    if (!v) return;

    // INCREASE CONCURRENT REQUESTS FOR MASSIVE KMZ
    const RequestScheduler = (window as any).Cesium?.RequestScheduler;
    if (RequestScheduler) {
      RequestScheduler.maximumRequestsPerServer = 24;
    }

    // PERFORMANCE TUNING
    v.scene.globe.maximumScreenSpaceError = isMapLoading ? 16.0 : 2.0;
    v.scene.globe.loadingDescendantLimit = 20;
    v.scene.postProcessStages.fxaa.enabled = false;
    v.scene.light.intensity = 2.0;
  }, [isMapLoading]);

  // Telemetry updates
  useEffect(() => {
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer) return;
    const remove = viewer.scene.postRender.addEventListener(() => {
      const c = viewer.camera.positionCartographic;
      if (c) {
        setCurrentLat(CesiumMath.toDegrees(c.latitude));
        setCurrentLng(CesiumMath.toDegrees(c.longitude));
        setCurrentAlt(c.height);
      }
    });
    return () => remove();
  }, []);

  // ── Sync buildings with backend ──────────────────────────────────────────
  const fetchFacilities = useCallback(async () => {
    try {
      setFacilitiesLoading(true);
      const res = await api.get("/schools/facilities/available");
      setAvailableFacilities(res.data);
    } catch (err) {
      console.error("Failed to fetch facilities", err);
    } finally {
      setFacilitiesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFacilities();
  }, [fetchFacilities]);

  const handleSaveBuilding = async (data: BuildingData) => {
    try {
      setIsMapLoading(true);
      if (data.id.startsWith("temp-")) {
        const res = await api.post(`/schools/${school.id}/buildings`, data);
        setSchoolBuildings((prev) => [...prev, res.data]);
      } else {
        const res = await api.patch(`/schools/buildings/${data.id}`, data);
        setSchoolBuildings((prev) => 
          prev.map((b) => (b.id === data.id ? res.data : b))
        );
      }
      setDrawerOpen(false);
    } catch (err) {
      console.error("Failed to save building", err);
    } finally {
      setIsMapLoading(false);
    }
  };

  useEffect(() => {
    setSchoolBuildings(effectiveBuildings);
  }, [effectiveBuildings]);

  // ── Mouse Click / Picking ────────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer) return;

    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click: any) => {
      const picked = viewer.scene.pick(click.position);
      
      if (activeTool === "create_block") {
        const c = viewer.camera.pickEllipsoid(click.position);
        if (c) {
          const carto = viewer.scene.globe.ellipsoid.cartesianToCartographic(c);
          const lng = CesiumMath.toDegrees(carto.longitude);
          const lat = CesiumMath.toDegrees(carto.latitude);
          
          const newBuilding: BuildingData = {
            id: `temp-${Date.now()}`,
            buildingName: "",
            buildingCode: "",
            buildingFunction: "",
            buildingCondition: "good",
            buildingRoofCondition: "good",
            buildingStructuralScore: "100",
            buildingFloors: "1",
            buildingArea: "0",
            buildingYearBuilt: new Date().getFullYear().toString(),
            buildingNotes: "",
            facilities: [],
            geolocation: { latitude: lat, longitude: lng },
            annotations: [],
            media: [],
          };
          setDrawerBuilding(newBuilding);
          setDrawerOpen(true);
          setActiveTool("none");
        }
        return;
      }

      if (picked && picked.id) {
        // Find if it matches a building
        const building = schoolBuildings.find(b => 
          b.id === picked.id.id || b.buildingName === picked.id.name
        );
        
        if (building) {
          setActiveBlock(building);
          setIsBlockInspectorOpen(true);
          setInspectorPosition({ x: click.position.x, y: click.position.y });
          return;
        }
      } else {
        setIsBlockInspectorOpen(false);
      }
    }, ScreenSpaceEventType.LEFT_CLICK);

    return () => handler.destroy();
  }, [activeTool, schoolBuildings, school.id]);

  const handleExportKMZ = () => {
    const schoolId = window.location.pathname.split("/")[2];
    if (schoolId) {
      window.open(
        `${import.meta.env.VITE_API_URL || ""}/api/v1/schools/${schoolId}/kmz/model.kmz`,
        "_blank",
      );
    }
  };

  const toolbarButtons = [
    {
      icon: (
        <Globe
          className={cn(
            "w-5 h-5",
            isRegionalFocus
              ? "text-primary animate-pulse"
              : "text-muted-foreground",
          )}
        />
      ),
      active: isRegionalFocus,
      onClick: () => setIsRegionalFocus(!isRegionalFocus),
      title: "Regional Focus",
    },
    {
      icon: (
        <ShieldCheck
          className={cn(
            "w-5 h-5",
            isHighQuality ? "text-primary" : "text-muted-foreground",
          )}
        />
      ),
      active: isHighQuality,
      onClick: () => setIsHighQuality(!isHighQuality),
      title: "High Quality",
    },
    {
      icon: (
        <Layers
          className={cn(
            "w-5 h-5",
            showNavigator ? "text-primary" : "text-muted-foreground",
          )}
        />
      ),
      active: showNavigator,
      onClick: () => setShowNavigator(!showNavigator),
      title: "Feature Navigator",
    },
    {
      icon: (
        <Ruler
          className={cn(
            "w-5 h-5",
            measurementMode === "distance"
              ? "text-primary"
              : "text-muted-foreground",
          )}
        />
      ),
      active: measurementMode === "distance",
      onClick: () =>
        setMeasurementMode(
          measurementMode === "distance" ? "none" : "distance",
        ),
      title: "Distance Measure",
    },
    {
      icon: (
        <Square
          className={cn(
            "w-5 h-5",
            measurementMode === "area"
              ? "text-primary"
              : "text-muted-foreground",
          )}
        />
      ),
      active: measurementMode === "area",
      onClick: () =>
        setMeasurementMode(measurementMode === "area" ? "none" : "area"),
      title: "Area Measure",
    },
    {
      icon: (
        <MousePointer2
          className={cn(
            "w-5 h-5",
            activeTool === "select" ? "text-primary" : "text-muted-foreground",
          )}
        />
      ),
      active: activeTool === "select",
      onClick: () => setActiveTool(activeTool === "select" ? "none" : "select"),
      title: "Select Block",
    },
    {
      icon: (
        <PlusCircle
          className={cn(
            "w-5 h-5",
            activeTool === "create_block"
              ? "text-primary"
              : "text-muted-foreground",
          )}
        />
      ),
      active: activeTool === "create_block",
      onClick: () =>
        setActiveTool(activeTool === "create_block" ? "none" : "create_block"),
      title: "Create School Block",
    },
    {
      icon: (
        <Download className="w-5 h-5 text-muted-foreground hover:text-primary" />
      ),
      active: false,
      onClick: handleExportKMZ,
      title: "Export for Google Earth (3D)",
    },
    {
      icon: isFullscreen ? (
        <Minimize2 className="w-5 h-5" />
      ) : (
        <Maximize2 className="w-5 h-5" />
      ),
      active: isFullscreen,
      onClick: () => setIsFullscreen(!isFullscreen),
      title: "Fullscreen",
    },
  ];

  return (
    <div
      className={cn(
        isEmbed
          ? "relative w-full h-full min-h-[500px]"
          : "fixed inset-0 z-100",
      )}
    >
      <Card
        className={cn(
          "w-full h-full relative overflow-hidden bg-background/80 backdrop-blur-xl border border-border/10 flex flex-col",
          isEmbed ? "rounded-[35px]" : "",
        )}
      >
        {/* Logo/Badge */}
        <div className="absolute top-6 left-6 z-10 flex gap-3 pointer-events-none">
          <div className="w-10 h-10 bg-primary/20 rounded-2xl flex items-center justify-center border border-primary/20">
            <Globe className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2
              className={cn(
                "font-black tracking-tighter uppercase",
                isEmbed ? "text-[10px]" : "text-sm",
              )}
            >
              {isEmbed
                ? "Interactive Map Selector"
                : "Structural Mapping Engine"}
            </h2>
            <p className="text-[8px] text-muted-foreground font-bold opacity-60 uppercase">
              {isLargeFile
                ? "Backend-Heavy Hybrid Mode"
                : "Original KMZ Processing Mode"}
            </p>
          </div>
        </div>

        {/* Floating Sidebar Toolbar */}
        <div className="absolute top-6 right-6 z-10 flex gap-2">
          <div className="flex flex-col gap-2">
            <div className="p-2 mb-2 bg-background/60 backdrop-blur-xl rounded-2xl border border-border/10 flex flex-col items-center gap-2 shadow-2xl">
              <span className="text-[8px] font-black uppercase tracking-tighter opacity-60">
                View
              </span>
              <Button
                size="icon"
                variant={viewMode === "2D" ? "default" : "ghost"}
                className="w-8 h-8 rounded-lg"
                onClick={() => setViewMode("2D")}
                title="2D Map View"
              >
                <Globe className="w-3 h-3" />
              </Button>
              <Button
                size="icon"
                variant={viewMode === "3D" ? "default" : "ghost"}
                className="w-8 h-8 rounded-lg"
                onClick={() => setViewMode("3D")}
                title="3D Models View"
              >
                <Box className="w-3 h-3" />
              </Button>
            </div>
            {placesOverlay && (
              <Button
                variant={showPlacesOverlay ? "default" : "secondary"}
                size="icon"
                className={cn(
                  "w-10 h-10 rounded-xl shadow-lg",
                  showPlacesOverlay ? "bg-orange-500 hover:bg-orange-600" : "",
                )}
                onClick={() => setShowPlacesOverlay(!showPlacesOverlay)}
                title={
                  showPlacesOverlay
                    ? "Hide Places Overlay"
                    : "Show Places Overlay"
                }
              >
                {showPlacesOverlay ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
              </Button>
            )}
            {toolbarButtons.map((btn, i) => (
              <Button
                key={i}
                size="icon"
                variant={btn.active ? "default" : "secondary"}
                className="w-10 h-10 rounded-xl shadow-lg"
                onClick={btn.onClick}
                title={btn.title}
              >
                {btn.icon}
              </Button>
            ))}
            {onClose && (
              <Button
                variant="secondary"
                size="icon"
                className="rounded-full h-10 w-10 bg-red-500/10 text-red-500 hover:bg-red-500/20"
                onClick={onClose}
              >
                <X size={18} />
              </Button>
            )}
          </div>
        </div>

        {/* Feature Navigator Panel */}
        {showNavigator && features.length > 0 && (
          <div className="absolute top-24 left-6 bottom-24 z-10 w-64 pointer-events-none">
            <Card className="w-full h-full p-4 bg-background/60 backdrop-blur-2xl border-border/10 rounded-3xl overflow-hidden flex flex-col pointer-events-auto">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  placeholder="Filter entities..."
                  className="w-full bg-background/40 border-border/5 rounded-xl py-2 pl-9 pr-3 text-[10px] outline-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex-1 overflow-y-auto space-y-1 text-[10px]">
                {features
                  .filter((f) =>
                    (f.name || "")
                      .toLowerCase()
                      .includes(searchQuery.toLowerCase()),
                  )
                  .slice(0, 50)
                  .map((f, i) => (
                    <button
                      key={i}
                      className="w-full text-left p-2 rounded-lg hover:bg-primary/10 truncate font-medium"
                      onClick={() => {
                        viewerRef.current?.cesiumElement?.flyTo(f);
                        setSelectedEntity(f);
                      }}
                    >
                      <MapPin className="inline w-3 h-3 mr-2 opacity-50" />{" "}
                      {f.name || "Unnamed Feature"}
                    </button>
                  ))}
              </div>
            </Card>
          </div>
        )}

        {/* Selection HUD */}
        {selectedEntity && (
          <div className="absolute top-6 right-80 z-10 w-64 animate-in slide-in-from-right-4">
            <Card className="p-4 bg-background/80 backdrop-blur-2xl border-primary/20 rounded-2xl shadow-2xl relative">
              <Button
                size="icon"
                variant="ghost"
                className="absolute top-2 right-2 w-6 h-6"
                onClick={() => setSelectedEntity(null)}
              >
                <X className="w-4 h-4" />
              </Button>
              <h3 className="text-xs font-black uppercase mb-1">
                {selectedEntity.name || "Entity"}
              </h3>
              <p className="text-[10px] text-muted-foreground mb-3">
                Element Details
              </p>
              <Button
                className="w-full text-[10px] font-black uppercase h-8 rounded-full"
                size="sm"
                onClick={() =>
                  viewerRef.current?.cesiumElement?.flyTo(selectedEntity)
                }
              >
                Zoom to Feature
              </Button>
              {onSelectBuilding && selectedEntity.name && (
                <Button
                  className="w-full text-[10px] font-black uppercase h-10 rounded-full mt-2 shadow-lg shadow-primary/20"
                  size="sm"
                  variant="default"
                  onClick={() => {
                    const match = effectiveBuildings.find(
                      (b: any) =>
                        (b.name &&
                          selectedEntity.name &&
                          b.name.toLowerCase() ===
                            selectedEntity.name.toLowerCase()) ||
                        b.id === selectedEntity.id,
                    );
                    if (match) onSelectBuilding(match);
                  }}
                >
                  <MapPin className="w-3 h-3 mr-2" /> Select as Location
                </Button>
              )}
            </Card>
          </div>
        )}

        <div className="flex-1 w-full relative">
          <Viewer
            full
            ref={viewerRef}
            terrainProvider={terrainProvider}
            shadows={isHighQuality}
            animation={false}
            timeline={false}
            infoBox={false}
            selectionIndicator={false}
            navigationHelpButton={false}
            sceneModePicker={false}
            baseLayerPicker={false}
            geocoder={false}
            homeButton={false}
            fullscreenButton={false}
            onSelectedEntityChange={(e: any) => {
              if (e) {
                const name = e.name;
                const building = effectiveBuildings.find(
                  (b: any) =>
                    b.name?.toLowerCase() === name?.toLowerCase() ||
                    b.code?.toLowerCase() === name?.toLowerCase(),
                );
                if (building) {
                  setSelectedEntity(building);
                  if (onSelectBuilding) onSelectBuilding(building);
                }
              } else {
                setSelectedEntity(null);
              }
            }}
            style={{ width: "100%", height: "100%" }}
          >
            <SkyAtmosphere show />
            <Fog enabled={isHighQuality} />
            <Sun show />

            {parsedGeojson && (
              <GeoJsonDataSource
                data={parsedGeojson}
                clampToGround
                onLoad={(ds) => {
                  ds.entities.values.forEach((entity: any) => {
                    if (entity.polygon) {
                      entity.polygon.material = Color.fromCssColorString(
                        "rgba(0, 150, 255, 0.4)",
                      ) as any;
                      entity.polygon.outline = true as any;
                      entity.polygon.outlineColor = Color.WHITE as any;
                    }
                    if (entity.polyline) {
                      entity.polyline.width = 2 as any;
                      entity.polyline.material = Color.YELLOW as any;
                    }
                    // Handle Pins/Labels in 2D/GeoJSON fallback
                    if (entity.billboard || entity.label || entity.point) {
                      if (entity.billboard) {
                        entity.billboard.image =
                          "https://maps.google.com/mapfiles/kml/pushpin/red-pushpin.png" as any;
                        entity.billboard.scale = 0.5 as any;
                        entity.billboard.heightReference = 1 as any; // Clamp to ground
                      }
                      if (entity.label) {
                        entity.label.font = "bold 14px sans-serif" as any;
                        entity.label.fillColor = Color.WHITE as any;
                        entity.label.outlineColor = Color.BLACK as any;
                        entity.label.outlineWidth = 2 as any;
                        entity.label.style = 2 as any; // FILL_AND_OUTLINE
                        entity.label.verticalOrigin = 1 as any; // BOTTOM
                        entity.label.pixelOffset = { x: 0, y: -20 } as any;
                        entity.label.heightReference = 1 as any; // Clamp to ground
                      }
                      if (entity.point) {
                        entity.point.pixelSize = 8 as any;
                        entity.point.color = Color.RED as any;
                        entity.point.outlineColor = Color.WHITE as any;
                        entity.point.outlineWidth = 2 as any;
                        entity.point.heightReference = 1 as any;
                      }
                    }
                  });
                  setFeatures((prev) => {
                    const next = [...prev, ...ds.entities.values];
                    // De-duplicate by name or id
                    const seen = new Set();
                    return next.filter((e) => {
                      if (seen.has(e.id || e.name)) return false;
                      seen.add(e.id || e.name);
                      return true;
                    });
                  });
                  setDataLoaded(true);
                  if (viewMode === "2D") {
                    setFlightComplete(true);
                    viewerRef.current?.cesiumElement?.zoomTo(ds);
                  }
                }}
              />
            )}

            {/* Places Overlay */}
            {showPlacesOverlay && parsedPlacesOverlay && (
              <GeoJsonDataSource
                data={parsedPlacesOverlay}
                clampToGround
                onLoad={(ds) => {
                  ds.entities.values.forEach((entity: any) => {
                    // Style for places overlay - only outline, no fill
                    if (entity.polygon) {
                      entity.polygon.material = Color.TRANSPARENT as any;
                      entity.polygon.outline = true as any;
                      entity.polygon.outlineColor = Color.RED as any;
                      entity.polygon.outlineWidth = 5 as any;
                    }
                    if (entity.polyline) {
                      entity.polyline.width = 3 as any;
                      entity.polyline.material = Color.RED as any;
                    }
                    if (entity.billboard) {
                      entity.billboard.image =
                        "https://maps.google.com/mapfiles/kml/pushpins/ylw-pushpin.png" as any;
                      entity.billboard.scale = 0.8 as any;
                      entity.billboard.heightReference = 1 as any;
                    }
                    if (entity.label) {
                      entity.label.font = "bold 14px sans-serif" as any;
                      entity.label.fillColor = Color.ORANGE as any;
                      entity.label.outlineColor = Color.BLACK as any;
                      entity.label.outlineWidth = 2 as any;
                      entity.label.style = 2 as any;
                      entity.label.verticalOrigin = 1 as any;
                      entity.label.pixelOffset = { x: 0, y: -20 } as any;
                      entity.label.heightReference = 1 as any;
                      entity.label.show = true as any;
                    }
                    if (entity.point) {
                      entity.point.pixelSize = 15 as any;
                      entity.point.color = Color.ORANGE as any;
                      entity.point.outlineColor = Color.WHITE as any;
                      entity.point.outlineWidth = 3 as any;
                      entity.point.heightReference = 1 as any;
                      entity.point.show = true as any;
                    }
                  });
                }}
              />
            )}

            {/* High-Resolution GeoTIFF Layer (High Performance) */}
            {tifUrl && (
              <ImageryLayer
                imageryProvider={
                  new SingleTileImageryProvider({
                    url: tifUrl,
                  })
                }
                alpha={0.8}
              />
            )}

            {/* Load places overlay from direct URL if available */}
            {showPlacesOverlay && placesOverlayUrl && (
              <KmlLoaderBridge
                source={placesOverlayUrl}
                wallHeight={0}
                onFeaturesLoaded={(entities) => {
                  console.log(
                    "[PlacesOverlay KML] Loaded entities:",
                    entities.length,
                  );
                }}
                onLoadStart={() => {}}
                onLoadEnd={() => {}}
              />
            )}

            {hasKmzSource && (
              <KmlLoaderBridge
                source={kmzSource!}
                wallHeight={wallHeight}
                onFeaturesLoaded={(entities: any[]) => {
                  setFeatures(entities);
                  setDataLoaded(true);
                  setFlightComplete(true);
                }}
                onLoadStart={() => setDataLoaded(false)}
                onLoadEnd={() => {
                  setDataLoaded(true);
                  setFlightComplete(true);
                }}
              />
            )}

            {/* Specialized 3D Handle: Load extracted KML directly if available */}
            {masterKmlUrl && viewMode === "3D" && (
              <KmlDataSource
                data={masterKmlUrl}
                clampToGround
                onLoad={(ds) => {
                  setDataLoaded(true);
                  setFeatures((prev) => {
                    const next = [...prev, ...ds.entities.values];
                    const seen = new Set();
                    return next.filter((e) => {
                      if (seen.has(e.id || e.name)) return false;
                      seen.add(e.id || e.name);
                      return true;
                    });
                  });
                  // Ensure all entities have labels shown if they have names
                  ds.entities.values.forEach((e: any) => {
                    if (e.label) {
                      e.label.font = "bold 16px sans-serif";
                      e.label.heightReference = 1; // ClampToGround
                      e.label.pixelOffset = { x: 0, y: -20 };
                      e.label.disableDepthTestDistance = 1000000; // Always visible
                      e.label.horizontalOrigin = 0; // CENTER
                    }
                    if (e.billboard) {
                      e.billboard.heightReference = 1; // ClampToGround
                      e.billboard.scale =
                        (e.billboard.scale?.getValue() || 1.0) * 1.5;
                      e.billboard.pixelOffset = { x: 0, y: -10 };
                    }
                  });

                  if (!initialView && !parsedGeojson?.properties?.initialView) {
                    viewerRef.current?.cesiumElement?.zoomTo(ds);
                  }
                }}
                onError={(e: any) =>
                  console.error("Specialized 3D Load Failed:", e)
                }
              />
            )}

            {viewMode === "3D" &&
              !masterKmlUrl &&
              buildingsWithModels.map((building: any) => {
                const meta = building.modelMetadata || {};
                const pos = meta.location || {
                  lat: Number(building.centroidLat),
                  lng: Number(building.centroidLng),
                  alt: 0,
                };
                return (
                  <Entity
                    key={building.id}
                    position={Cartesian3.fromDegrees(
                      pos.lng,
                      pos.lat,
                      pos.alt || 0,
                    )}
                    name={building.name}
                  >
                    <Model
                      url={
                        building.modelPath?.startsWith("http")
                          ? building.modelPath
                          : `${(import.meta.env.VITE_API_URL || "").replace(/\/$/, "")}/${building.modelPath.replace(/^\//, "")}`
                      }
                      scale={meta.scale?.x || 1}
                      minimumPixelSize={1}
                      maximumScale={20000}
                    />
                  </Entity>
                );
              })}

            <MeasurementLayer mode={measurementMode} />

            {/* Phase 1: Locating (Priority on KMZ initialView) */}
            {!flightComplete && (
              <ViewInitializer
                location={fallbackLocation}
                initialView={
                  initialView || parsedGeojson?.properties?.initialView
                }
                initialBuildingId={initialBuildingId}
                features={features}
                onComplete={() => setFlightComplete(true)}
              />
            )}
          </Viewer>

          {/* Bottom Telemetry HUD */}
          <div className="absolute bottom-6 left-6 z-10">
            <Card className="px-4 py-3 bg-background/60 backdrop-blur-2xl border-border/10 rounded-2xl shadow-xl flex gap-4">
              <div className="text-center">
                <p className="text-[7px] font-black uppercase text-muted-foreground">
                  Latitude
                </p>
                <p className="text-[10px] font-mono font-bold leading-none">
                  {currentLat.toFixed(5)}°
                </p>
              </div>
              <div className="h-4 w-px bg-border/20 self-center" />
              <div className="text-center">
                <p className="text-[7px] font-black uppercase text-muted-foreground">
                  Longitude
                </p>
                <p className="text-[10px] font-mono font-bold leading-none">
                  {currentLng.toFixed(5)}°
                </p>
              </div>
              <div className="h-4 w-px bg-border/20 self-center" />
              <div className="text-center">
                <p className="text-[7px] font-black uppercase text-muted-foreground">
                  Elevation
                </p>
                <p className="text-[10px] font-mono font-bold leading-none">
                  {currentAlt.toFixed(1)}m
                </p>
              </div>
            </Card>
          </div>
        </div>

        {/* Global Loading Overlay */}
        {isMapLoading && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/40 backdrop-blur-3xl">
            <div className="relative mb-8">
              <div className="w-24 h-24 rounded-full border-t-2 border-primary/40 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Globe
                  className={cn(
                    "w-8 h-8 text-primary transition-all duration-700",
                    !flightComplete ? "animate-pulse" : "scale-110",
                  )}
                />
              </div>
            </div>

            <div className="w-64 space-y-6 text-center">
              <div className="space-y-4 text-left">
                {/* Step 1: Locating */}
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold transition-all",
                      loadingStep === 1
                        ? "bg-primary text-primary-foreground border-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]"
                        : "bg-emerald-500 text-white border-emerald-500",
                    )}
                  >
                    {loadingStep > 1 ? "✓" : "1"}
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-black uppercase tracking-widest transition-opacity",
                      loadingStep === 1 ? "opacity-100" : "opacity-40",
                    )}
                  >
                    Step 1: Locating School Environment
                  </span>
                </div>

                {/* Step 2: Processing */}
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold transition-all",
                      loadingStep === 2
                        ? "bg-primary text-primary-foreground border-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]"
                        : loadingStep > 2
                          ? "bg-emerald-500 text-white border-emerald-500"
                          : "bg-background/20 text-muted-foreground border-border/10",
                    )}
                  >
                    {loadingStep > 2 ? "✓" : "2"}
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-black uppercase tracking-widest transition-opacity",
                      loadingStep === 2
                        ? "opacity-100"
                        : loadingStep < 2
                          ? "opacity-20"
                          : "opacity-40",
                    )}
                  >
                    Step 2: Processing Spatial Content
                  </span>
                </div>

                {/* Step 3: Initializing */}
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold transition-all",
                      loadingStep === 3
                        ? "bg-primary text-primary-foreground border-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]"
                        : "bg-background/20 text-muted-foreground border-border/10",
                    )}
                  >
                    {loadingStep === 3 ? "3" : "3"}
                  </div>
                  <div className="flex-1">
                    <span
                      className={cn(
                        "text-[10px] font-black uppercase tracking-widest block transition-opacity",
                        loadingStep === 3 ? "opacity-100" : "opacity-20",
                      )}
                    >
                      Step 3: Initializing 3D Engine
                    </span>
                    {loadingStep === 3 && (
                      <span className="text-[8px] text-primary block -mt-1 font-bold animate-pulse">
                        {loadingMessage}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[8px] font-black text-primary/60 uppercase tracking-tighter">
                  <span>GIS Engine Pipeline</span>
                  <span>{Math.round(loadingProgress)}%</span>
                </div>
                <div className="h-1 bg-primary/10 rounded-full overflow-hidden border border-primary/5">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${loadingProgress}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default School3DView;
