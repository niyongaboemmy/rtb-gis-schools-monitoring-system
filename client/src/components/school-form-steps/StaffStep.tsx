import { Input } from "../ui/input";
import { UserMinus, UserPlus } from "lucide-react";

interface StaffStepProps {
  maleTeachers: string;
  femaleTeachers: string;
  maleStudents: string;
  femaleStudents: string;
  adminStaff: string;
  maleAdminStaff: string;
  femaleAdminStaff: string;
  supportStaff: string;
  maleSupportStaff: string;
  femaleSupportStaff: string;
  totalTeachers: string;
  totalStudents: string;
  onChange: (field: string, value: string) => void;
}

export function StaffStep({
  maleTeachers,
  femaleTeachers,
  maleStudents,
  femaleStudents,
  adminStaff,
  maleAdminStaff,
  femaleAdminStaff,
  supportStaff,
  maleSupportStaff,
  femaleSupportStaff,
  totalStudents,
  onChange,
}: StaffStepProps) {
  const staffFields = [
    {
      key: "maleTeachers",
      label: "Male Teachers",
      icon: UserPlus,
      color: "from-blue-500 to-cyan-500",
      bgColor: "bg-blue-500/10",
    },
    {
      key: "femaleTeachers",
      label: "Female Teachers",
      icon: UserMinus,
      color: "from-pink-500 to-rose-500",
      bgColor: "bg-pink-500/10",
    },
  ];

  const adminStaffFields = [
    {
      key: "maleAdminStaff",
      label: "Male Admin",
      icon: UserPlus,
      color: "from-violet-500 to-purple-500",
      bgColor: "bg-violet-500/10",
    },
    {
      key: "femaleAdminStaff",
      label: "Female Admin",
      icon: UserMinus,
      color: "from-fuchsia-500 to-pink-500",
      bgColor: "bg-fuchsia-500/10",
    },
  ];

  const supportStaffFields = [
    {
      key: "maleSupportStaff",
      label: "Male Support",
      icon: UserPlus,
      color: "from-emerald-500 to-teal-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      key: "femaleSupportStaff",
      label: "Female Support",
      icon: UserMinus,
      color: "from-teal-500 to-cyan-500",
      bgColor: "bg-teal-500/10",
    },
  ];

  const studentFields = [
    {
      key: "maleStudents",
      label: "Male Students",
      icon: UserPlus,
      color: "from-indigo-500 to-blue-500",
      bgColor: "bg-indigo-500/10",
    },
    {
      key: "femaleStudents",
      label: "Female Students",
      icon: UserMinus,
      color: "from-rose-500 to-pink-500",
      bgColor: "bg-rose-500/10",
    },
  ];

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
      case "totalStudents":
        return totalStudents;
      case "adminStaff":
        return adminStaff;
      case "supportStaff":
        return supportStaff;
      default:
        return "";
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 rounded-full bg-linear-to-b from-primary to-primary/60" />
          <label className="text-base font-bold text-foreground">
            School Teachers
          </label>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {staffFields.map(({ key, label, icon: Icon, color, bgColor }) => (
            <div
              key={key}
              className="p-5 rounded-2xl border-2 border-border/30 hover:border-primary/30 hover:bg-muted/30 transition-all duration-300"
            >
              <div className="flex flex-col items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-xl ${bgColor} flex items-center justify-center`}
                >
                  <Icon
                    className={`w-6 h-6 bg-linear-to-r ${color} bg-clip-text text-transparent`}
                  />
                </div>
                <label className="text-sm font-semibold text-foreground text-center">
                  {label}
                </label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={getValue(key)}
                  onChange={(e) => onChange(key, e.target.value)}
                  className="text-center font-bold text-lg w-full"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Administrative Staff Breakdown */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 rounded-full bg-linear-to-b from-violet-500 to-purple-500" />
          <label className="text-base font-bold text-foreground">
            Administrative Staff
          </label>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {adminStaffFields.map(
            ({ key, label, icon: Icon, color, bgColor }) => (
              <div
                key={key}
                className="p-5 rounded-2xl border-2 border-border/30 hover:border-violet-500/30 hover:bg-muted/30 transition-all duration-300"
              >
                <div className="flex flex-col items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-xl ${bgColor} flex items-center justify-center`}
                  >
                    <Icon
                      className={`w-6 h-6 bg-linear-to-r ${color} bg-clip-text text-transparent`}
                    />
                  </div>
                  <label className="text-sm font-semibold text-foreground text-center">
                    {label}
                  </label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={getValue(key)}
                    onChange={(e) => onChange(key, e.target.value)}
                    className="text-center font-bold text-lg w-full"
                  />
                </div>
              </div>
            ),
          )}
        </div>
      </div>

      {/* Support Staff Breakdown */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 rounded-full bg-linear-to-b from-emerald-500 to-teal-500" />
          <label className="text-base font-bold text-foreground">
            Support Staff
          </label>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {supportStaffFields.map(
            ({ key, label, icon: Icon, color, bgColor }) => (
              <div
                key={key}
                className="p-5 rounded-2xl border-2 border-border/30 hover:border-emerald-500/30 hover:bg-muted/30 transition-all duration-300"
              >
                <div className="flex flex-col items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-xl ${bgColor} flex items-center justify-center`}
                  >
                    <Icon
                      className={`w-6 h-6 bg-linear-to-r ${color} bg-clip-text text-transparent`}
                    />
                  </div>
                  <label className="text-sm font-semibold text-foreground text-center">
                    {label}
                  </label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={getValue(key)}
                    onChange={(e) => onChange(key, e.target.value)}
                    className="text-center font-bold text-lg w-full"
                  />
                </div>
              </div>
            ),
          )}
        </div>
      </div>

      {/* Student Breakdown */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 rounded-full bg-linear-to-b from-indigo-500 to-blue-500" />
          <label className="text-base font-bold text-foreground">
            School Students
          </label>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {studentFields.map(({ key, label, icon: Icon, color, bgColor }) => (
            <div
              key={key}
              className="p-5 rounded-2xl border-2 border-border/30 hover:border-indigo-500/30 hover:bg-muted/30 transition-all duration-300"
            >
              <div className="flex flex-col items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-xl ${bgColor} flex items-center justify-center`}
                >
                  <Icon
                    className={`w-6 h-6 bg-linear-to-r ${color} bg-clip-text text-transparent`}
                  />
                </div>
                <label className="text-sm font-semibold text-foreground text-center">
                  {label}
                </label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={getValue(key)}
                  onChange={(e) => onChange(key, e.target.value)}
                  className="text-center font-bold text-lg w-full"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
