import { Input } from "../ui/input";
import { MapPin } from "lucide-react";

interface LandStepProps {
  usedLandArea: string;
  unusedLandArea: string;
  onChange: (field: string, value: string) => void;
}

export function LandStep({
  usedLandArea,
  unusedLandArea,
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

      {/* Used Land Area */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 rounded-full bg-linear-to-b from-blue-500 to-cyan-500" />
          <label className="text-base font-semibold text-foreground">
            Used Land Area
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Area (hectares)
            </label>
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
                <span className="text-sm">ha</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground pl-1">
              Land currently in use for buildings, facilities, agriculture, etc.
            </p>
          </div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Area (hectares)
            </label>
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
                <span className="text-sm">ha</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground pl-1">
              Vacant land available for future development.
            </p>
          </div>
        </div>
      </div>

      {/* Total Land Summary */}
      <div className="p-6 rounded-2xl bg-linear-to-r from-primary/10 to-primary/5 border-2 border-primary/20">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-foreground">
              Total Land Area
            </h3>
            <p className="text-sm text-muted-foreground">
              Used + Unused land combined
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-primary">
              {(
                (parseFloat(usedLandArea) || 0) +
                (parseFloat(unusedLandArea) || 0)
              ).toFixed(2)}
              <span className="text-lg ml-1">ha</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
