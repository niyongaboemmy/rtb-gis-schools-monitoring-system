import { Input } from "../ui/input";
import { Users, GraduationCap, Building2, Calendar } from "lucide-react";

interface AcademicStepProps {
  totalStudents: string;
  totalTeachers: string;
  totalBuildings: string;
  establishedYear: string;
  onChange: (field: string, value: string) => void;
}

export function AcademicStep({
  totalStudents,
  totalTeachers,
  totalBuildings,
  establishedYear,
  onChange,
}: AcademicStepProps) {
  const fields = [
    {
      key: "totalStudents",
      label: "Total Students",
      icon: Users,
      color: "from-blue-500 to-cyan-500",
      bgColor: "bg-blue-500/10",
    },
    {
      key: "totalTeachers",
      label: "Total Teachers",
      icon: GraduationCap,
      color: "from-violet-500 to-purple-500",
      bgColor: "bg-violet-500/10",
    },
    {
      key: "totalBuildings",
      label: "Total Buildings",
      icon: Building2,
      color: "from-emerald-500 to-teal-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      key: "establishedYear",
      label: "Established Year",
      icon: Calendar,
      color: "from-amber-500 to-orange-500",
      bgColor: "bg-amber-500/10",
      type: "number",
      min: "1900",
      max: "2030",
    },
  ];

  const getValue = (key: string) => {
    switch (key) {
      case "totalStudents":
        return totalStudents;
      case "totalTeachers":
        return totalTeachers;
      case "totalBuildings":
        return totalBuildings;
      case "establishedYear":
        return establishedYear;
      default:
        return "";
    }
  };

  const getProps = (key: string) => {
    switch (key) {
      case "establishedYear":
        return {
          type: "number",
          min: 1900,
          max: 2030,
          placeholder: "e.g. 2010",
        };
      default:
        return { type: "number", placeholder: "0" };
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 rounded-full bg-linear-to-b from-primary to-primary/60" />
          <label className="text-base font-bold text-foreground">
            Academic Information
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {fields.map(({ key, label, icon: Icon, color, bgColor }) => (
            <div
              key={key}
              className="p-5 rounded-2xl border-2 border-border/30 hover:border-primary/30 hover:bg-muted/30 transition-all duration-300"
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-lg ${bgColor} flex items-center justify-center`}
                  >
                    <Icon
                      className={`w-4 h-4 bg-linear-to-r ${color} bg-clip-text text-transparent`}
                    />
                  </div>
                  <label className="text-sm font-semibold text-foreground">
                    {label}
                  </label>
                </div>
                <Input
                  name={key}
                  value={getValue(key)}
                  onChange={(e) => onChange(key, e.target.value)}
                  className="font-bold text-lg text-center"
                  {...getProps(key)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
