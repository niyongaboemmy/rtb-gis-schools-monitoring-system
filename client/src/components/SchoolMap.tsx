import { Suspense, useState } from "react";
import { useNavigate } from "react-router-dom";
import { viewerLink } from "../lib/viewer-tools";
import { lazyPage } from "../lib/lazy";
import ViewerModeModal from "./ViewerModeModal";

// The 2D viewer pulls in OpenLayers (and, on its 3D tab, three.js). Pages that
// embed a map (school dashboard, reporting, report details) only download it
// when the map is actually shown.
const School2DViewer = lazyPage(() => import("./School2DViewer"));

const spinner = (
  <div className="flex items-center justify-center w-full h-full min-h-[200px]" role="status">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
    <span className="sr-only">Loading the map…</span>
  </div>
);

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
  const navigate = useNavigate();
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
            navigate(viewerLink("3d", school.id));
            return;
          }
          setViewerMode(mode);
          setShowModal(false);
        }}
      />

      {viewerMode === null && spinner}

      {viewerMode === "2D" && (
        <Suspense fallback={spinner}>
          <School2DViewer {...sharedProps} />
        </Suspense>
      )}
    </>
  );
}
