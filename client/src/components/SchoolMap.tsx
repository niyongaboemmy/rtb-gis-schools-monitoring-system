import { useState } from "react";
import School3DView from "./School3DView";
import School2DViewer from "./School2DViewer";
import ViewerModeModal from "./ViewerModeModal";

interface SchoolMapSchool {
  id: string | number;
  latitude: number | string;
  longitude: number | string;
  kmzFilePath?: string;       // 3D KMZ — used by Cesium
  kmz2dFilePath?: string;     // 2D KMZ/KML — used by OpenLayers
  kmzMasterKmlPath?: string;
  geojsonContent?: any;
  placesOverlayFilePath?: string;
  placesOverlayData?: any;
  buildings?: any[];
}

interface SchoolMapProps {
  /** Raw school object from the API */
  school: SchoolMapSchool;
  /** Override buildings list — SchoolReporting fetches buildings separately */
  buildings?: any[];
  /** Override places overlay — School3DViewPage fetches it via a dedicated API call */
  placesOverlay?: any;
  /** Constrain to container height, no fullscreen toggle */
  isEmbed?: boolean;
  onClose?: () => void;
  onSelectBuilding?: (building: any) => void;
  initialBuildingId?: string;
}

/**
 * SchoolMap — orchestrator that owns the 2D/3D viewer mode selection and
 * renders the appropriate viewer. Callers pass a school object; all URL
 * construction is handled internally so it never leaks into pages.
 */
export default function SchoolMap({
  school,
  buildings,
  placesOverlay,
  isEmbed = false,
  onClose,
  onSelectBuilding,
  initialBuildingId,
}: SchoolMapProps) {
  const [showModal, setShowModal] = useState(true);
  const [viewerMode, setViewerMode] = useState<"2D" | "3D" | null>(null);

  // ── Derive viewer props from school object ──────────────────────────────
  // All paths stored in DB start with "/" — pass through as-is.
  // Legacy fallbacks (bare filenames) construct /files/... paths.

  // 3D KMZ — for Cesium viewer
  const kmzUrl = school.kmzFilePath
    ? school.kmzFilePath.startsWith("/")
      ? school.kmzFilePath
      : `/files/schools/${school.id}/kmz/${school.kmzFilePath}`
    : undefined;

  // 2D KMZ/KML — for OpenLayers viewer; fallback to 3D KMZ if not uploaded separately
  const kmz2dUrl = school.kmz2dFilePath
    ? school.kmz2dFilePath.startsWith("/")
      ? school.kmz2dFilePath
      : `/files/schools/${school.id}/kmz_2d/${school.kmz2dFilePath}`
    : kmzUrl;

  const masterKmlUrl = school.kmzMasterKmlPath
    ? school.kmzMasterKmlPath.startsWith("/") || school.kmzMasterKmlPath.startsWith("http")
      ? school.kmzMasterKmlPath
      : `/files/schools/${school.id}/kmz_content/${school.kmzMasterKmlPath}`
    : undefined;

  const placesOverlayUrl = school.placesOverlayFilePath
    ? school.placesOverlayFilePath.startsWith("/")
      ? school.placesOverlayFilePath
      : `/files/schools/${school.id}/places-overlay/${school.placesOverlayFilePath}`
    : undefined;

  const fallbackLocation = {
    lat: Number(school.latitude) || 0,
    lng: Number(school.longitude) || 0,
  };

  const effectiveBuildings = buildings ?? school.buildings ?? [];
  const initialView = school.geojsonContent?.properties?.initialView;
  const effectivePlacesOverlay = placesOverlay ?? school.placesOverlayData;

  const sharedProps = {
    buildings: effectiveBuildings,
    geojson: school.geojsonContent,
    placesOverlay: effectivePlacesOverlay,
    placesOverlayUrl,
    fallbackLocation,
    initialView,
    isEmbed,
    onClose,
    onSelectBuilding,
    initialBuildingId,
  };

  // 3D viewer gets the Cesium KMZ + extracted master KML
  const viewer3DProps = { ...sharedProps, kmzUrl, masterKmlUrl };
  // 2D viewer gets the OpenLayers-specific KML/KMZ (or falls back to the 3D file)
  const viewer2DProps = { ...sharedProps, kmzUrl: kmz2dUrl, masterKmlUrl: undefined };

  return (
    <>
      {/* Mode selection — opens immediately, stays until user picks */}
      <ViewerModeModal
        isOpen={showModal}
        onClose={() => {
          // If no mode is selected, closing the modal should cancel the whole map view
          if (viewerMode === null && onClose) {
            onClose();
          }
          setShowModal(false);
        }}
        onSelect={(mode) => {
          setViewerMode(mode);
          setShowModal(false);
        }}
      />

      {/* Spinner shown while modal is open and no mode is set yet */}
      {viewerMode === null && (
        <div className="flex items-center justify-center w-full h-full min-h-[200px]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      )}

      {/* Render the chosen viewer with viewer-specific props */}
      {viewerMode === "3D" && <School3DView {...viewer3DProps} />}
      {viewerMode === "2D" && <School2DViewer {...viewer2DProps} />}
    </>
  );
}
