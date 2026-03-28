import { Input } from "../ui/input";
import { UserPlus } from "lucide-react";

interface StaffStepProps {
  maleTeachers: string;
  femaleTeachers: string;
  maleStudents: string;
  femaleStudents: string;
  maleAdminStaff: string;
  femaleAdminStaff: string;
  maleSupportStaff: string;
  femaleSupportStaff: string;
  totalStudents: string;
  onChange: (field: string, value: string) => void;
}

export function StaffStep({
  maleTeachers,
  femaleTeachers,
  maleStudents,
  femaleStudents,
  maleAdminStaff,
  femaleAdminStaff,
  maleSupportStaff,
  femaleSupportStaff,
  totalStudents,
  onChange,
}: StaffStepProps) {
  const getValue = (key: string) => {
    switch (key) {
      case "maleTeachers":
        return maleTeachers;
      case "femaleTeachers":
        return femaleTeachers;
      case "maleStudents":
        return maleStudents;
      case "femaleStudents":
        return femaleStudents;
      case "maleAdminStaff":
        return maleAdminStaff;
      case "femaleAdminStaff":
        return femaleAdminStaff;
      case "maleSupportStaff":
        return maleSupportStaff;
      case "femaleSupportStaff":
        return femaleSupportStaff;
      default:
        return "";
    }
  };

  const CategoryCard = ({
    title,
    icon: Icon,
    maleKey,
    femaleKey,
    color,
  }: {
    title: string;
    icon: any;
    maleKey: string;
    femaleKey: string;
    color: string;
  }) => {
    const maleVal = parseInt(getValue(maleKey)) || 0;
    const femaleVal = parseInt(getValue(femaleKey)) || 0;
    const total = maleVal + femaleVal;

    return (
      <div className="group relative p-4 rounded-2xl border border-border/40 bg-card/30 hover:bg-card/50 hover:border-primary/20 transition-all duration-300">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div
              className={`p-2 rounded-xl bg-linear-to-br ${color} bg-opacity-10`}
            >
              <Icon className={`w-4 h-4 text-primary`} />
            </div>
            <h3 className="text-sm font-bold text-foreground/80">{title}</h3>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground/60">
              Total
            </span>
            <span className="text-lg font-black text-primary leading-none">
              {total}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 pl-1">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500/60" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase">
                Male
              </span>
            </div>
            <Input
              type="number"
              min="0"
              placeholder="0"
              value={getValue(maleKey)}
              onChange={(e) => onChange(maleKey, e.target.value)}
              className="h-11 text-sm font-bold bg-background/50 border-border/20 focus:border-blue-500/50"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 pl-1">
              <div className="w-1.5 h-1.5 rounded-full bg-pink-500/60" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase">
                Female
              </span>
            </div>
            <Input
              type="number"
              min="0"
              placeholder="0"
              value={getValue(femaleKey)}
              onChange={(e) => onChange(femaleKey, e.target.value)}
              className="h-11 text-sm font-bold bg-background/50 border-border/20 focus:border-pink-500/50"
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CategoryCard
          title="Teaching Staff"
          icon={UserPlus}
          maleKey="maleTeachers"
          femaleKey="femaleTeachers"
          color="from-blue-500/20 to-cyan-500/20"
        />
        <CategoryCard
          title="Administrative"
          icon={UserPlus}
          maleKey="maleAdminStaff"
          femaleKey="femaleAdminStaff"
          color="from-blue-500/20 to-blue-500/20"
        />
        <CategoryCard
          title="Support Staff"
          icon={UserPlus}
          maleKey="maleSupportStaff"
          femaleKey="femaleSupportStaff"
          color="from-emerald-500/20 to-teal-500/20"
        />
        <CategoryCard
          title="Students Population"
          icon={UserPlus}
          maleKey="maleStudents"
          femaleKey="femaleStudents"
          color="from-indigo-500/20 to-blue-500/20"
        />
      </div>

      {/* Optional logic for syncing total fields if needed by parent */}
      <div className="hidden">
        {/* These fields might be expected by handleInputChange in SchoolForm */}
        <Input value={totalStudents} readOnly />
      </div>
    </div>
  );
}
