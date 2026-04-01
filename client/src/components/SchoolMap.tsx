import { useState } from "react";
import School2DViewer from "./School2DViewer";
import ViewerModeModal from "./ViewerModeModal";

interface SchoolMapProps {
  /** Raw school object from the API */
  school: any;
  /** Override buildings list */
  buildings?: any[];
  /** Override places overlay */
  placesOverlay?: any;
  /** Constrain to container height */
  isEmbed?: boolean;
  onClose?: () => void;
  onSelectBuilding?: (building: any) => void;
  initialBuildingId?: string;
  onUpdateSchool?: (update: any) => void;
}

/**
 * SchoolMap — orchestrator that only owns the 2D/3D viewer mode selection.
 * It passes the raw school data directly to the chosen viewer category.
 */
export default function SchoolMap({
  school,
  buildings,
  placesOverlay,
  isEmbed = false,
  onClose,
  onSelectBuilding,
  initialBuildingId,
  onUpdateSchool,
}: SchoolMapProps) {
  const [showModal, setShowModal] = useState(false);
  const [viewerMode, setViewerMode] = useState<"2D" | "3D" | null>("2D");

  // ── Shared props for both viewers ───────────────────────────────────────
  const sharedProps = {
    school,
    buildings,
    placesOverlay,
    isEmbed,
    onClose,
    onSelectBuilding,
    initialBuildingId,
    onUpdateSchool,
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
          if (mode === "3D") {
            window.open(`/schools/${school.id}/3d-explorer`, "_blank");
            return;
          }
          setViewerMode(mode);
          setShowModal(false);
        }}
      />

      {viewerMode === null && (
        <div className="flex items-center justify-center w-full h-full min-h-[200px]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      )}

      {viewerMode === "2D" && <School2DViewer {...sharedProps} />}
    </>
  );
}
