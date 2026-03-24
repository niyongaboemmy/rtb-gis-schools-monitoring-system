import { Input } from "../ui/input";
import { RichDropdown } from "../ui/rich-dropdown";
import type { DropdownOption } from "../ui/rich-dropdown";
import { Building2, Hash, FileText, Calendar, Globe } from "lucide-react";

interface BasicInfoStepProps {
  code: string;
  name: string;
  type: string;
  status: string;
  description: string;
  establishedYear: string;
  website: string;
  mode?: "create" | "edit";
  onChange: (field: string, value: string) => void;
}

const schoolTypeOptions: DropdownOption[] = [
  { label: "TSS (Technical Secondary School)", value: "TSS" },
  { label: "VTC (Vocational Training Center)", value: "VTC" },
  { label: "Integrated", value: "INTEGRATED" },
];

const schoolStatusOptions: DropdownOption[] = [
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "Under Renovation", value: "under_renovation" },
];

export function BasicInfoStep({
  code,
  name,
  type,
  status,
  description,
  establishedYear,
  website,
  mode = "create",
  onChange,
}: BasicInfoStepProps) {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 rounded-full bg-linear-to-b from-primary to-primary/60" />
          <label className="text-base font-bold text-foreground">
            Institution Details
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Hash className="w-4 h-4 text-muted-foreground" />
              Institution Code <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder="e.g. TSS-001"
              required
              value={code}
              onChange={(e) => onChange("code", e.target.value)}
              disabled={mode === "edit"}
              icon={<Hash className="w-4 h-4" />}
            />
          </div>
          <div className="space-y-3">
            <label className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              Institution Name <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder="Full institution name"
              required
              value={name}
              onChange={(e) => onChange("name", e.target.value)}
              icon={<Building2 className="w-4 h-4" />}
            />
          </div>
          <div className="space-y-3">
            <label className="text-sm font-semibold text-foreground">
              Type
            </label>
            <RichDropdown
              options={schoolTypeOptions}
              value={type}
              onChange={(val) => onChange("type", val)}
              placeholder="Select type..."
            />
          </div>
          <div className="space-y-3">
            <label className="text-sm font-semibold text-foreground">
              Status
            </label>
            <RichDropdown
              options={schoolStatusOptions}
              value={status}
              onChange={(val) => onChange("status", val)}
              placeholder="Select status..."
            />
          </div>
          <div className="space-y-3">
            <label className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              Year of Establishment
            </label>
            <Input
              type="number"
              min="1900"
              max="2099"
              placeholder="e.g. 1984"
              value={establishedYear}
              onChange={(e) => onChange("establishedYear", e.target.value)}
              icon={<Calendar className="w-4 h-4" />}
            />
          </div>
          <div className="space-y-3">
            <label className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Globe className="w-4 h-4 text-muted-foreground" />
              Website
            </label>
            <Input
              placeholder="e.g. www.school.ac.rw"
              value={website}
              onChange={(e) => onChange("website", e.target.value)}
              icon={<Globe className="w-4 h-4" />}
            />
          </div>
          <div className="space-y-3 md:col-span-2">
            <label className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              Description
            </label>
            <textarea
              placeholder="Brief description of the institution..."
              value={description}
              onChange={(e) => onChange("description", e.target.value)}
              className="w-full min-h-[120px] rounded-2xl border border-border/30 bg-background/80 px-4 py-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
