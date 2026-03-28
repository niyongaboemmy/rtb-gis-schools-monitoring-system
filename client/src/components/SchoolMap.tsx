import { useState } from "react";
import School3DView from "./School3DView";
import School2DViewer from "./School2DViewer";
import ViewerModeModal from "./ViewerModeModal";

interface SchoolMapSchool {
  id: string | number;
  latitude: number | string;
  longitude: number | string;
  kmzFilePath?: string; // 3D KMZ — used by Cesium
  kmz2dFilePath?: string; // 2D KMZ/KML — used by OpenLayers
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

  // ── Shared props for both viewers ───────────────────────────────────────
  const sharedProps = {
    school,
    buildings,
    placesOverlay,
    isEmbed,
    onClose,
    onSelectBuilding,
    initialBuildingId,
  };

  return (
    <>
      <ViewerModeModal
        isOpen={showModal}
        onClose={() => {
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

      {viewerMode === null && (
        <div className="flex items-center justify-center w-full h-full min-h-[200px]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      )}

      {viewerMode === "3D" && <School3DView {...sharedProps} />}
      {viewerMode === "2D" && <School2DViewer {...sharedProps} />}
    </>
  );
}
