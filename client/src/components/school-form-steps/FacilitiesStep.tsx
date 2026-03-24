import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { RichDropdown, type DropdownOption } from "../ui/rich-dropdown";
import {
  BookOpen,
  FlaskConical,
  Wifi,
  Zap,
  Droplets,
  Sun,
  Dumbbell,
  Bed,
  UtensilsCrossed,
} from "lucide-react";

interface FacilitiesStepProps {
  hasLibrary: string;
  hasLaboratory: string;
  hasComputerLab: string;
  hasSportsField: string;
  hasHostel: string;
  hasCanteen: string;
  hasElectricity: string;
  hasWater: string;
  hasInternet: string;
  hasSolarPanel: string;
  numberOfAccessRoads: string;
  roadState: string;
  roadStatusPercentage: string;
  onChange: (field: string, value: string) => void;
}

export function FacilitiesStep({
  hasLibrary,
  hasLaboratory,
  hasComputerLab,
  hasSportsField,
  hasHostel,
  hasCanteen,
  hasElectricity,
  hasWater,
  hasInternet,
  hasSolarPanel,
  numberOfAccessRoads,
  roadState,
  roadStatusPercentage,
  onChange,
}: FacilitiesStepProps) {
  const facilities = [
    {
      key: "hasLibrary",
      label: "Library",
      icon: BookOpen,
      color: "from-amber-500 to-orange-500",
      bgColor: "bg-amber-500/10",
    },
    {
      key: "hasLaboratory",
      label: "Laboratory",
      icon: FlaskConical,
      color: "from-emerald-500 to-green-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      key: "hasComputerLab",
      label: "Computer Lab",
      icon: Wifi,
      color: "from-blue-500 to-cyan-500",
      bgColor: "bg-blue-500/10",
    },
    {
      key: "hasSportsField",
      label: "Sports Field",
      icon: Dumbbell,
      color: "from-violet-500 to-purple-500",
      bgColor: "bg-violet-500/10",
    },
    {
      key: "hasHostel",
      label: "Hostel",
      icon: Bed,
      color: "from-rose-500 to-pink-500",
      bgColor: "bg-rose-500/10",
    },
    {
      key: "hasCanteen",
      label: "Canteen",
      icon: UtensilsCrossed,
      color: "from-amber-500 to-yellow-500",
      bgColor: "bg-amber-500/10",
    },
  ];

  const utilities = [
    {
      key: "hasElectricity",
      label: "Electricity",
      icon: Zap,
      color: "from-amber-500 to-yellow-500",
      bgColor: "bg-amber-500/10",
    },
    {
      key: "hasWater",
      label: "Water",
      icon: Droplets,
      color: "from-blue-500 to-cyan-500",
      bgColor: "bg-blue-500/10",
    },
    {
      key: "hasInternet",
      label: "Internet",
      icon: Wifi,
      color: "from-green-500 to-emerald-500",
      bgColor: "bg-green-500/10",
    },
    {
      key: "hasSolarPanel",
      label: "Solar Panel",
      icon: Sun,
      color: "from-orange-500 to-amber-500",
      bgColor: "bg-orange-500/10",
    },
  ];

  const isChecked = (key: string) => {
    switch (key) {
      case "hasLibrary":
        return hasLibrary === "true";
      case "hasLaboratory":
        return hasLaboratory === "true";
      case "hasComputerLab":
        return hasComputerLab === "true";
      case "hasSportsField":
        return hasSportsField === "true";
      case "hasHostel":
        return hasHostel === "true";
      case "hasCanteen":
        return hasCanteen === "true";
      case "hasElectricity":
        return hasElectricity === "true";
      case "hasWater":
        return hasWater === "true";
      case "hasInternet":
        return hasInternet === "true";
      case "hasSolarPanel":
        return hasSolarPanel === "true";
      default:
        return false;
    }
  };

  return (
    <div className="space-y-8">
      {/* Facilities */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 rounded-full bg-linear-to-b from-primary to-primary/60" />
          <label className="text-base font-bold text-foreground">
            Facilities
          </label>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {facilities.map(({ key, label, icon: Icon, color, bgColor }) => (
            <div
              key={key}
              className={`relative p-5 rounded-2xl border-2 transition-all duration-300 ${
                isChecked(key)
                  ? "border-primary/50 bg-primary/5 shadow-lg shadow-primary/10"
                  : "border-border/30 hover:border-primary/30 hover:bg-muted/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl ${bgColor} flex items-center justify-center`}
                  >
                    <Icon
                      className={`w-5 h-5 bg-linear-to-r ${color} bg-clip-text text-transparent`}
                    />
                  </div>
                  <span className="font-semibold text-foreground">{label}</span>
                </div>
                <Switch
                  checked={isChecked(key)}
                  onCheckedChange={(checked) =>
                    onChange(key, checked ? "true" : "false")
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Utilities */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 rounded-full bg-linear-to-b from-amber-500 to-yellow-500" />
          <label className="text-base font-bold text-foreground">
            Utilities & Infrastructure
          </label>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {utilities.map(({ key, label, icon: Icon, color, bgColor }) => (
            <div
              key={key}
              className={`relative p-4 rounded-2xl border-2 transition-all duration-300 ${
                isChecked(key)
                  ? "border-primary/50 bg-primary/5 shadow-lg shadow-primary/10"
                  : "border-border/30 hover:border-primary/30 hover:bg-muted/30"
              }`}
            >
              <div className="flex flex-col items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-xl ${bgColor} flex items-center justify-center`}
                >
                  <Icon
                    className={`w-6 h-6 bg-linear-to-r ${color} bg-clip-text text-transparent`}
                  />
                </div>
                <span className="font-semibold text-foreground text-sm">
                  {label}
                </span>
                <Switch
                  checked={isChecked(key)}
                  onCheckedChange={(checked) =>
                    onChange(key, checked ? "true" : "false")
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Roads */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 rounded-full bg-linear-to-b from-slate-500 to-slate-400" />
          <label className="text-base font-bold text-foreground">
            Roads & Access
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
            <label className="text-sm font-semibold text-foreground">
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
              Roads Accessibility Rating Status (%)
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
