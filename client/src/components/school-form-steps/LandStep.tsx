import { Input } from "../ui/input";
import { RichDropdown, type DropdownOption } from "../ui/rich-dropdown";
import { MapPin } from "lucide-react";

interface LandStepProps {
  usedLandArea: string;
  unusedLandArea: string;
  numberOfAccessRoads: string;
  roadState: string;
  roadStatusPercentage: string;
  onChange: (field: string, value: string) => void;
}

export function LandStep({
  usedLandArea,
  unusedLandArea,
  numberOfAccessRoads,
  roadState,
  roadStatusPercentage,
  onChange,
}: LandStepProps) {
  return (
    <div className="space-y-8">
      {/* Land Area Information */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 rounded-full bg-linear-to-b from-green-500 to-emerald-500" />
          <label className="text-base font-bold text-foreground">
            Land Area Information
          </label>
        </div>
        <p className="text-sm text-muted-foreground pl-1">
          Specify the used and unused land areas for the institution in
          hectares.
        </p>
      </div>

      {/* Land Area Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {/* Used Land Area */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-1 h-6 rounded-full bg-linear-to-b from-blue-500 to-cyan-500" />
            <label className="text-base font-semibold text-foreground">
              Used Land Area
            </label>
          </div>
          <div className="space-y-2">
            <div className="relative">
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={usedLandArea}
                onChange={(e) => onChange("usedLandArea", e.target.value)}
                className="text-lg py-6 pr-12"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span className="text-sm">
                  m<sup>2</sup>
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground pl-1">
              Currently in use
            </p>
          </div>
        </div>

        {/* Unused Land Area */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-1 h-6 rounded-full bg-linear-to-b from-amber-500 to-yellow-500" />
            <label className="text-base font-semibold text-foreground">
              Unused Land Area
            </label>
          </div>
          <div className="space-y-2">
            <div className="relative">
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={unusedLandArea}
                onChange={(e) => onChange("unusedLandArea", e.target.value)}
                className="text-lg py-6 pr-12"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span className="text-sm">
                  m<sup>2</sup>
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground pl-1">
              Available for future use
            </p>
          </div>
        </div>

        {/* Total Land Summary */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-1 h-6 rounded-full bg-linear-to-b from-primary to-primary/60" />
            <label className="text-base font-semibold text-foreground">
              Total Land Area
            </label>
          </div>
          <div className="p-5 rounded-2xl bg-linear-to-br from-primary/10 to-primary/5 border-2 border-primary/20 flex flex-col justify-center min-h-[76px]">
            <div className="text-3xl font-bold text-primary flex items-baseline gap-1">
              {(
                (parseFloat(usedLandArea) || 0) +
                (parseFloat(unusedLandArea) || 0)
              ).toFixed(2)}
              <span className="text-sm font-semibold opacity-70 uppercase tracking-wider">
                m<sup>2</sup>
              </span>
            </div>
            <p className="text-[10px] uppercase font-bold text-primary/50 tracking-tighter mt-1">
              Combined Institution Footprint
            </p>
          </div>
        </div>
      </div>

      {/* Roads & Access */}
      <div className="space-y-4 pt-4 border-t border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 rounded-full bg-linear-to-b from-slate-500 to-slate-400" />
          <label className="text-base font-bold text-foreground">
            Roads & Access Details
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">
              Number of Access Roads
            </label>
            <Input
              type="number"
              min="0"
              placeholder="0"
              value={numberOfAccessRoads}
              onChange={(e) => onChange("numberOfAccessRoads", e.target.value)}
              className="text-lg py-6"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground flex items-center gap-2">
              Road State
            </label>
            <RichDropdown
              value={roadState}
              onChange={(value) => onChange("roadState", value)}
              placeholder="Select road state..."
              options={
                [
                  { label: "Paved", value: "paved" },
                  { label: "Gravel", value: "gravel" },
                  { label: "Earth", value: "earth" },
                  { label: "Mixed", value: "mixed" },
                ] as DropdownOption[]
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">
              Accessibility Rating (%)
            </label>
            <Input
              type="number"
              min="0"
              max="100"
              placeholder="100"
              value={roadStatusPercentage}
              onChange={(e) => onChange("roadStatusPercentage", e.target.value)}
              className="text-lg py-6"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
