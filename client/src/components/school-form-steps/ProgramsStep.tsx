import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Cog, Plus, Trash2 } from "lucide-react";

export interface EducationProgram {
  id: string;
  code: string;
  name: string;
  totalStudents: string;
  capacity: string;
}

interface ProgramsStepProps {
  educationPrograms: EducationProgram[];
  onEducationProgramsChange: (programs: EducationProgram[]) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 11);

export function ProgramsStep({
  educationPrograms,
  onEducationProgramsChange,
}: ProgramsStepProps) {
  return (
    <div className="space-y-8">
      {/* trades (TVET Trades) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1 h-6 rounded-full bg-linear-to-b from-emerald-500 to-teal-500" />
            <label className="text-base font-bold text-foreground">
              TVET Trades
            </label>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const newProgram: EducationProgram = {
                id: generateId(),
                code: "",
                name: "",
                totalStudents: "",
                capacity: "",
              };
              onEducationProgramsChange([...educationPrograms, newProgram]);
            }}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Trade
          </Button>
        </div>
        <p className="text-sm text-muted-foreground pl-1">
          Add trades (e.g., Construction, Computer Science, Agriculture)
        </p>
        {educationPrograms.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-border rounded-xl">
            <Cog className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">
              No trades added yet. Click "Add Program" to add a trade.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {educationPrograms.map((program, index) => (
              <div
                key={program.id}
                className="flex items-center gap-3 p-4 rounded-xl border-2 border-border/30 bg-card"
              >
                <div className="flex flex-row items-center gap-3 w-full">
                  <div>
                    <Input
                      placeholder="Code (e.g., CON-001)"
                      value={program.code}
                      onChange={(e) => {
                        const updated = [...educationPrograms];
                        updated[index].code = e.target.value;
                        onEducationProgramsChange(updated);
                      }}
                      className="font-mono text-sm w-[150px]"
                    />
                  </div>
                  <div className="w-full">
                    <Input
                      placeholder="Program Name (e.g., Construction)"
                      value={program.name}
                      onChange={(e) => {
                        const updated = [...educationPrograms];
                        updated[index].name = e.target.value;
                        onEducationProgramsChange(updated);
                      }}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <Input
                      type="number"
                      min="0"
                      placeholder="Students"
                      value={program.totalStudents}
                      onChange={(e) => {
                        const updated = [...educationPrograms];
                        updated[index].totalStudents = e.target.value;
                        onEducationProgramsChange(updated);
                      }}
                      className="text-sm w-[100px]"
                    />
                  </div>
                  <div>
                    <Input
                      type="number"
                      min="0"
                      placeholder="Capacity"
                      value={program.capacity}
                      onChange={(e) => {
                        const updated = [...educationPrograms];
                        updated[index].capacity = e.target.value;
                        onEducationProgramsChange(updated);
                      }}
                      className="text-sm w-[100px]"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const updated = educationPrograms.filter(
                      (_, i) => i !== index,
                    );
                    onEducationProgramsChange(updated);
                  }}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
