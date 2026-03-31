import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { api } from "../../lib/api";
import { BuildingFormDrawer } from "./BuildingFormDrawer";
import { BuildingDetailsModal } from "./BuildingDetailsModal";
import type { AvailableFacility } from "./BuildingFormDrawer";
import {
  Building2,
  Plus,
  Trash2,
  Pencil,
  Eye,
  DoorOpen,
  Layers,
  AlertTriangle,
  MapPin,
} from "lucide-react";

export interface FacilityItem {
  facility_id: string; // FacilityEntity.facilityId
  facility_name: string; // FacilityEntity.title (auto-filled)
  number_of_rooms: number;
}

export interface BuildingGeoLocation {
  latitude: number | null;
  longitude: number | null;
}

export interface BuildingData {
  id: string;
  buildingName: string;
  buildingCode: string;
  buildingFunction: string;
  buildingFloors: string;
  buildingArea: string;
  buildingYearBuilt: string;
  buildingCondition: string;
  buildingRoofCondition: string;
  buildingStructuralScore: string;
  buildingNotes: string;
  facilities: FacilityItem[];
  geolocation: BuildingGeoLocation;
  annotations?: {
    id: string;
    type: "text" | "point" | "line" | "polygon";
    content: string;
    coordinates?: number[];
    isFootprint?: boolean;
    areaSquareMeters?: number;
    style?: any;
    createdAt: string;
  }[];
  media?: {
    id?: string;
    path: string;
    type?: "image" | "video";
    title?: string;
    createdAt?: string;
  }[];
}

interface BuildingsStepProps {
  buildings?: BuildingData[];
  onBuildingsChange?: (buildings: BuildingData[]) => void;
  /** School's saved coordinates — used to auto-center the building geo modal */
  schoolLatitude?: number | null;
  schoolLongitude?: number | null;
  // Legacy single building support (deprecated)
  buildingName?: string;
  buildingCode?: string;
  buildingFunction?: string;
  buildingFloors?: string;
  buildingArea?: string;
  buildingYearBuilt?: string;
  buildingCondition?: string;
  buildingRoofCondition?: string;
  buildingStructuralScore?: string;
  buildingNotes?: string;
}

const conditionConfig: Record<string, { label: string; classes: string }> = {
  good: {
    label: "Good",
    classes:
      "bg-green-500/15 text-green-700 dark:text-green-400 ring-green-500/20",
  },
  fair: {
    label: "Fair",
    classes:
      "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 ring-yellow-500/20",
  },
  poor: {
    label: "Poor",
    classes:
      "bg-orange-500/15 text-orange-700 dark:text-orange-400 ring-orange-500/20",
  },
  critical: {
    label: "Critical",
    classes: "bg-red-500/15 text-red-700 dark:text-red-400 ring-red-500/20",
  },
};

const createEmptyBuilding = (): BuildingData => ({
  id: `building-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  buildingName: "",
  buildingCode: "",
  buildingFunction: "",
  buildingFloors: "",
  buildingArea: "",
  buildingYearBuilt: "",
  buildingCondition: "good",
  buildingRoofCondition: "good",
  buildingStructuralScore: "",
  buildingNotes: "",
  facilities: [],
  geolocation: { latitude: null, longitude: null },
  annotations: [],
  media: [],
});

export function BuildingsStep({
  buildings: initialBuildings,
  onBuildingsChange,
  schoolLatitude,
  schoolLongitude,
  buildingName,
  buildingCode,
  buildingFunction,
  buildingFloors,
  buildingArea,
  buildingYearBuilt,
  buildingCondition,
  buildingRoofCondition,
  buildingStructuralScore,
  buildingNotes,
}: BuildingsStepProps) {
  const [availableFacilities, setAvailableFacilities] = useState<
    AvailableFacility[]
  >([]);
  const [facilitiesLoading, setFacilitiesLoading] = useState(false);

  useEffect(() => {
    setFacilitiesLoading(true);
    api
      .get<AvailableFacility[]>("/schools/facilities")
      .then((res) => setAvailableFacilities(res.data))
      .catch(() => setAvailableFacilities([]))
      .finally(() => setFacilitiesLoading(false));
  }, []);

  const [buildings, setBuildings] = useState<BuildingData[]>(() => {
    if (initialBuildings && initialBuildings.length > 0)
      return initialBuildings;
    if (buildingName) {
      return [
        {
          id: "building-1",
          buildingName: buildingName || "",
          buildingCode: buildingCode || "",
          buildingFunction: buildingFunction || "",
          buildingFloors: buildingFloors || "",
          buildingArea: buildingArea || "",
          buildingYearBuilt: buildingYearBuilt || "",
          buildingCondition: buildingCondition || "good",
          buildingRoofCondition: buildingRoofCondition || "good",
          buildingStructuralScore: buildingStructuralScore || "",
          buildingNotes: buildingNotes || "",
          facilities: [],
          geolocation: { latitude: null, longitude: null },
        },
      ];
    }
    return [];
  });

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeBuilding, setActiveBuilding] = useState<BuildingData | null>(
    null,
  );
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  // Details modal state
  const [detailsBuilding, setDetailsBuilding] = useState<BuildingData | null>(
    null,
  );
  const [detailsIndex, setDetailsIndex] = useState<number>(0);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const openDetails = (building: BuildingData, index: number) => {
    setDetailsBuilding(building);
    setDetailsIndex(index);
    setDetailsOpen(true);
  };

  const openNew = () => {
    setActiveBuilding(createEmptyBuilding());
    setActiveIndex(-1);
    setDrawerOpen(true);
  };

  const openEdit = (building: BuildingData, index: number) => {
    setActiveBuilding(building);
    setActiveIndex(index);
    setDrawerOpen(true);
  };

  const handleSave = (data: BuildingData) => {
    let next: BuildingData[];
    if (activeIndex === -1) {
      next = [...buildings, data];
    } else {
      next = buildings.map((b, i) => (i === activeIndex ? data : b));
    }
    setBuildings(next);
    onBuildingsChange?.(next);
  };

  const handleRemove = (index: number) => {
    const next = buildings.filter((_, i) => i !== index);
    setBuildings(next);
    onBuildingsChange?.(next);
  };

  const namedCount = buildings.filter(
    (b) => b.buildingName.trim() !== "",
  ).length;

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">
            Buildings
          </span>
          {buildings.length > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold">
              {buildings.length}
            </span>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          onClick={openNew}
          className="h-8 px-3 text-xs gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Building
        </Button>
      </div>

      {/* Hint banner */}
      <div className="p-3.5 rounded-xl bg-amber-500/8 border border-amber-500/20 text-sm text-amber-700 dark:text-amber-300 flex items-start gap-2.5">
        <Building2 className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
        <span>
          Add all buildings on school. Click a building to edit its details, or
          use <strong>Add Building</strong> to register a new one.
        </span>
      </div>

      {/* Empty state */}
      {buildings.length === 0 && (
        <button
          type="button"
          onClick={openNew}
          className="w-full flex flex-col items-center justify-center gap-3 py-12 rounded-2xl border-2 border-dashed border-border/40 hover:border-primary/30 hover:bg-primary/3 transition-all group"
        >
          <div className="p-3 rounded-xl bg-muted group-hover:bg-primary/10 transition-colors">
            <Building2 className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              No buildings yet
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Click to add the first building
            </p>
          </div>
        </button>
      )}

      {/* Building list */}
      {buildings.length > 0 && (
        <div className="rounded-2xl border border-border/30 overflow-hidden divide-y divide-border/20">
          {buildings.map((building, index) => {
            const cond =
              conditionConfig[building.buildingCondition] ??
              conditionConfig.fair;
            const name = building.buildingName.trim() || `Unnamed Building`;
            const hasGeo =
              building.geolocation.latitude !== null ||
              building.geolocation.longitude !== null;

            return (
              <div
                key={building.id}
                className="group flex items-center gap-3 px-4 py-3.5 bg-card hover:bg-muted/40 transition-colors cursor-pointer"
                onClick={() => openDetails(building, index)}
              >
                {/* Index badge */}
                <div className="w-7 h-7 rounded-lg bg-primary/8 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {index + 1}
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground truncate">
                      {name}
                    </span>
                    {building.buildingCode && (
                      <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                        {building.buildingCode}
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${cond.classes}`}
                    >
                      {cond.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {building.buildingFunction && (
                      <span className="text-xs text-muted-foreground">
                        {building.buildingFunction}
                      </span>
                    )}
                    {(() => {
                      const totalRooms = building.facilities.reduce(
                        (sum, f) => sum + (f.number_of_rooms || 0),
                        0,
                      );
                      return building.buildingFloors || totalRooms > 0 ? (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Layers className="w-3 h-3" />
                          {[
                            building.buildingFloors &&
                              `${building.buildingFloors}F`,
                            totalRooms > 0 && `${totalRooms} rooms`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      ) : null;
                    })()}
                    {building.facilities.length > 0 && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <DoorOpen className="w-3 h-3" />
                        {building.facilities.length}{" "}
                        {building.facilities.length === 1
                          ? "facility"
                          : "facilities"}
                      </span>
                    )}
                    {hasGeo && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        Located
                      </span>
                    )}
                    {building.buildingStructuralScore && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <AlertTriangle className="w-3 h-3" />
                        Score: {building.buildingStructuralScore}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDetails(building, index);
                    }}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="View details"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(building, index);
                    }}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Edit building"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(index);
                    }}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Remove building"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Rest state indicator */}
                <Eye className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:hidden shrink-0" />
              </div>
            );
          })}
        </div>
      )}

      {/* Summary footer */}
      {buildings.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {namedCount} of {buildings.length} buildings named
          {buildings.length - namedCount > 0 && (
            <span className="text-amber-600 dark:text-amber-400 ml-1">
              · {buildings.length - namedCount} need a name
            </span>
          )}
        </p>
      )}

      {/* Details modal */}
      <BuildingDetailsModal
        isOpen={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        building={detailsBuilding}
        buildingIndex={detailsIndex}
        onEdit={() => {
          setDetailsOpen(false);
          if (detailsBuilding) openEdit(detailsBuilding, detailsIndex);
        }}
      />

      {/* Edit drawer */}
      <BuildingFormDrawer
        isOpen={drawerOpen}
        building={activeBuilding}
        buildingIndex={activeIndex}
        onSave={handleSave}
        onClose={() => setDrawerOpen(false)}
        availableFacilities={availableFacilities}
        facilitiesLoading={facilitiesLoading}
        schoolLat={schoolLatitude ?? null}
        schoolLng={schoolLongitude ?? null}
      />
    </div>
  );
}
