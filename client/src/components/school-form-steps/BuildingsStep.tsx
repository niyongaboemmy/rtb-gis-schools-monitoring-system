import { useState } from "react";
import { Input } from "../ui/input";
import { RichDropdown } from "../ui/rich-dropdown";
import type { DropdownOption } from "../ui/rich-dropdown";
import { Button } from "../ui/button";
import {
  Building2,
  Hash,
  Layers,
  Maximize2,
  Calendar,
  AlertTriangle,
  Home,
  FileText,
  Plus,
  Trash2,
} from "lucide-react";

export interface BuildingData {
  id: string;
  buildingName: string;
  buildingCode: string;
  buildingFunction: string;
  buildingFloors: string;
  buildingRooms: string;
  buildingArea: string;
  buildingYearBuilt: string;
  buildingCondition: string;
  buildingRoofCondition: string;
  buildingStructuralScore: string;
  buildingNotes: string;
}

interface BuildingsStepProps {
  buildings?: BuildingData[];
  onBuildingsChange?: (buildings: BuildingData[]) => void;
  // Legacy single building support (deprecated - use buildings array)
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

const buildingConditionOptions: DropdownOption[] = [
  { label: "Good", value: "good" },
  { label: "Fair", value: "fair" },
  { label: "Poor", value: "poor" },
  { label: "Critical", value: "critical" },
];

const roofConditionOptions: DropdownOption[] = [
  { label: "Good", value: "good" },
  { label: "Needs Repair", value: "needs_repair" },
  { label: "Damaged", value: "damaged" },
];

const createEmptyBuilding = (): BuildingData => ({
  id: `building-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  buildingName: "",
  buildingCode: "",
  buildingFunction: "",
  buildingFloors: "",
  buildingRooms: "",
  buildingArea: "",
  buildingYearBuilt: "",
  buildingCondition: "good",
  buildingRoofCondition: "good",
  buildingStructuralScore: "",
  buildingNotes: "",
});

interface BuildingCardProps {
  building: BuildingData;
  index: number;
  onUpdate: (id: string, field: keyof BuildingData, value: string) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
}

function BuildingCard({
  building,
  index,
  onUpdate,
  onRemove,
  canRemove,
}: BuildingCardProps) {
  return (
    <div className="p-5 rounded-2xl border-2 border-border/30 hover:border-primary/20 transition-all duration-300 bg-card">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-foreground flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary" />
          Building #{index + 1}
        </h4>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onRemove(building.id)}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Building2 className="w-3 h-3 text-muted-foreground" />
            Name <span className="text-destructive">*</span>
          </label>
          <Input
            placeholder="e.g. Main Building"
            value={building.buildingName}
            onChange={(e) =>
              onUpdate(building.id, "buildingName", e.target.value)
            }
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Hash className="w-3 h-3 text-muted-foreground" />
            Code
          </label>
          <Input
            placeholder="e.g. BLD-001"
            value={building.buildingCode}
            onChange={(e) =>
              onUpdate(building.id, "buildingCode", e.target.value)
            }
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Home className="w-3 h-3 text-muted-foreground" />
            Function
          </label>
          <Input
            placeholder="e.g. Classroom, Admin"
            value={building.buildingFunction}
            onChange={(e) =>
              onUpdate(building.id, "buildingFunction", e.target.value)
            }
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Layers className="w-3 h-3 text-muted-foreground" />
            Floors
          </label>
          <Input
            type="number"
            min="1"
            placeholder="e.g. 2"
            value={building.buildingFloors}
            onChange={(e) =>
              onUpdate(building.id, "buildingFloors", e.target.value)
            }
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Layers className="w-3 h-3 text-muted-foreground" />
            Rooms
          </label>
          <Input
            type="number"
            min="1"
            placeholder="e.g. 4"
            value={building.buildingRooms}
            onChange={(e) =>
              onUpdate(building.id, "buildingRooms", e.target.value)
            }
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Maximize2 className="w-3 h-3 text-muted-foreground" />
            Area (m²)
          </label>
          <Input
            type="number"
            step="any"
            placeholder="e.g. 500"
            value={building.buildingArea}
            onChange={(e) =>
              onUpdate(building.id, "buildingArea", e.target.value)
            }
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Calendar className="w-3 h-3 text-muted-foreground" />
            Year Built
          </label>
          <Input
            type="number"
            min="1900"
            max="2030"
            placeholder="e.g. 2015"
            value={building.buildingYearBuilt}
            onChange={(e) =>
              onUpdate(building.id, "buildingYearBuilt", e.target.value)
            }
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground flex items-center gap-2">
            <AlertTriangle className="w-3 h-3 text-muted-foreground" />
            Condition
          </label>
          <RichDropdown
            options={buildingConditionOptions}
            value={building.buildingCondition}
            onChange={(val) => onUpdate(building.id, "buildingCondition", val)}
            placeholder="Select..."
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground flex items-center gap-2">
            <AlertTriangle className="w-3 h-3 text-muted-foreground" />
            Roof Condition
          </label>
          <RichDropdown
            options={roofConditionOptions}
            value={building.buildingRoofCondition}
            onChange={(val) =>
              onUpdate(building.id, "buildingRoofCondition", val)
            }
            placeholder="Select..."
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Hash className="w-3 h-3 text-muted-foreground" />
            Structural Score (0-100)
          </label>
          <Input
            type="number"
            min="0"
            max="100"
            placeholder="e.g. 85"
            value={building.buildingStructuralScore}
            onChange={(e) =>
              onUpdate(building.id, "buildingStructuralScore", e.target.value)
            }
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileText className="w-3 h-3 text-muted-foreground" />
            Notes
          </label>
          <textarea
            placeholder="Additional notes..."
            value={building.buildingNotes}
            onChange={(e) =>
              onUpdate(building.id, "buildingNotes", e.target.value)
            }
            className="w-full min-h-[60px] rounded-xl border border-border/30 bg-background/80 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
          />
        </div>
      </div>
    </div>
  );
}

export function BuildingsStep({
  buildings: initialBuildings,
  onBuildingsChange,
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
  // Use new multi-building approach if onBuildingsChange is provided
  const [buildings, setBuildings] = useState<BuildingData[]>(() => {
    if (initialBuildings && initialBuildings.length > 0) {
      return initialBuildings;
    }
    // If legacy single building data exists, convert to array
    if (buildingName) {
      return [
        {
          id: "building-1",
          buildingName: buildingName || "",
          buildingCode: buildingCode || "",
          buildingFunction: buildingFunction || "",
          buildingFloors: buildingFloors || "",
          buildingRooms: "",
          buildingArea: buildingArea || "",
          buildingYearBuilt: buildingYearBuilt || "",
          buildingCondition: buildingCondition || "good",
          buildingRoofCondition: buildingRoofCondition || "good",
          buildingStructuralScore: buildingStructuralScore || "",
          buildingNotes: buildingNotes || "",
        },
      ];
    }
    return [createEmptyBuilding()];
  });

  const handleAddBuilding = () => {
    const newBuildings = [...buildings, createEmptyBuilding()];
    setBuildings(newBuildings);
    onBuildingsChange?.(newBuildings);
  };

  const handleUpdateBuilding = (
    id: string,
    field: keyof BuildingData,
    value: string,
  ) => {
    const newBuildings = buildings.map((b) =>
      b.id === id ? { ...b, [field]: value } : b,
    );
    setBuildings(newBuildings);
    onBuildingsChange?.(newBuildings);
  };

  const handleRemoveBuilding = (id: string) => {
    if (buildings.length > 1) {
      const newBuildings = buildings.filter((b) => b.id !== id);
      setBuildings(newBuildings);
      onBuildingsChange?.(newBuildings);
    }
  };

  const hasAtLeastOneBuilding = buildings.some(
    (b) => b.buildingName.trim() !== "",
  );

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-2xl bg-linear-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
        <div className="flex items-start gap-3">
          <Building2 className="w-5 h-5 text-amber-500 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
              Building Details
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Add buildings on campus. This information helps assess the
              school's infrastructure condition.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {buildings.map((building, index) => (
          <BuildingCard
            key={building.id}
            building={building}
            index={index}
            onUpdate={handleUpdateBuilding}
            onRemove={handleRemoveBuilding}
            canRemove={buildings.length > 1}
          />
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={handleAddBuilding}
        className="w-full rounded-xl border-2 border-dashed border-primary/30 hover:border-primary/50 hover:bg-primary/5"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Another Building
      </Button>

      {buildings.length > 0 && (
        <div className="text-center text-sm text-muted-foreground">
          Total buildings:{" "}
          <span className="font-semibold">{buildings.length}</span>
          {hasAtLeastOneBuilding && (
            <span className="ml-2 text-green-600">
              ({buildings.filter((b) => b.buildingName.trim() !== "").length}{" "}
              with name)
            </span>
          )}
        </div>
      )}
    </div>
  );
}
