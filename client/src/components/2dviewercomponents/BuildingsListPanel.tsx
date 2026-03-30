import React from "react";
import { X, Building2, MapPin, Trash2, ShieldAlert } from "lucide-react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import type { BuildingData } from "../school-form-steps/BuildingsStep";

interface BuildingsListPanelProps {
  buildings: BuildingData[];
  onClose: () => void;
  onSelect: (building: BuildingData) => void;
  onDelete: (id: string) => Promise<void>;
}

export const BuildingsListPanel: React.FC<BuildingsListPanelProps> = ({
  buildings,
  onClose,
  onSelect,
  onDelete,
}) => {
  const [isDeleting, setIsDeleting] = React.useState<string | null>(null);
  const [showConfirm, setShowConfirm] = React.useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      setIsDeleting(id);
      await onDelete(id);
      setShowConfirm(null);
    } catch (err) {
      console.error("Delete failed", err);
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <Card className="absolute left-[360px] top-4 z-30 w-80 max-h-[calc(100vh-2rem)] flex flex-col bg-background/80 backdrop-blur-2xl border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-left-8 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-[13px] font-black tracking-tight flex items-center gap-2">
              Building Directory
              <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded-full text-[10px]">
                {buildings.length}
              </span>
            </h2>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
              Loaded Extent
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 rounded-xl hover:bg-destructive/10 hover:text-destructive"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto w-full p-2 space-y-1 custom-scrollbar">
        {buildings.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <Building2 className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-xs font-medium">No buildings detected</p>
            <p className="text-[10px]">Pan the map to load areas</p>
          </div>
        ) : (
          buildings.map((b) => (
            <div
              key={b.id}
              onClick={() => onSelect(b)}
              className="group relative flex flex-col gap-1.5 px-4 py-3 bg-muted/30 hover:bg-muted/60 transition-colors rounded-2xl cursor-pointer border border-transparent hover:border-border/40"
            >
              <div className="flex justify-between items-start w-full">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[12px] truncate max-w-[140px]">
                    {b.buildingName || "Unnamed Block"}
                  </span>
                  {b.buildingFunction && (
                    <span className="text-[9px] px-1.5 py-0.5 bg-sky-500/10 text-sky-500 rounded font-bold uppercase tracking-widest whitespace-nowrap">
                      {b.buildingFunction}
                    </span>
                  )}
                </div>

                {/* Delete Button / Confirm Dialog */}
                {showConfirm === b.id ? (
                  <div
                    className="flex flex-col items-end gap-1 absolute right-3 top-2 bg-background border border-border/40 p-2 rounded-xl shadow-xl z-10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-1.5 text-destructive text-[10px] font-bold uppercase mb-1">
                      <ShieldAlert className="w-3 h-3" />
                      Confirm Delete?
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] px-2 rounded-lg"
                        onClick={() => setShowConfirm(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-6 text-[10px] px-2 rounded-lg"
                        disabled={isDeleting === b.id}
                        onClick={(e) => handleDelete(e, b.id)}
                      >
                        {isDeleting === b.id ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowConfirm(b.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 bg-destructive/10 text-destructive rounded-lg hover:bg-destructive hover:text-white transition-all shrink-0"
                    title="Delete Building"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3 text-[10px] text-muted-foreground/80 font-medium">
                {b.buildingCode && (
                  <span className="bg-foreground/5 px-1 rounded font-mono">
                    {b.buildingCode}
                  </span>
                )}
                {b.buildingArea && <span>{Math.round(parseFloat(String(b.buildingArea)))} m²</span>}
                {b.geolocation?.latitude && (
                  <span className="flex items-center gap-0.5 mt-auto">
                    <MapPin className="w-3 h-3" />
                    Mapped
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
};
