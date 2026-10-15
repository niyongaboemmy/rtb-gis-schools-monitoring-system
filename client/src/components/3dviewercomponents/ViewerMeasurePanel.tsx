/**
 * 3D measurement list — the shared MeasurementListPanel with 3D accuracy.
 * Kept as its own module so School3DView's import stays stable.
 */
import React from "react";
import MeasurementListPanel, { type MeasurementRow } from "./MeasurementListPanel";
import { accuracyLabel, type DisplayUnit } from "../../lib/viewer-tools";

export type { MeasurementRow };

interface ViewerMeasurePanelProps {
  rows: MeasurementRow[];
  unit: DisplayUnit;
  onUnitChange: (u: DisplayUnit) => void;
  onFlyTo: (id: string) => void;
  onRename?: (id: string, name: string) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onClearAll?: () => void | Promise<void>;
  onExport?: () => void | Promise<void>;
  onClose: () => void;
}

export const ViewerMeasurePanel: React.FC<ViewerMeasurePanelProps> = (props) => (
  <MeasurementListPanel
    {...props}
    footnote={`3D accuracy ${accuracyLabel("3d")} · areas are plan (flat) area; sloped surface area is listed below each.`}
  />
);

export default React.memo(ViewerMeasurePanel);
