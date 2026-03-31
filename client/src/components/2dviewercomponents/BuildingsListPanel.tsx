import React from "react";
import { X, Building2, MapPin, Trash2, ShieldAlert } from "lucide-react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import type { BuildingData } from "../school-form-steps/BuildingsStep";
import { cn } from "../../lib/utils";
import { SearchInput } from "../ui/search-input";
import { Plus } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "../ui/tooltip";

interface BuildingsListPanelProps {
  buildings: BuildingData[];
  onClose: () => void;
  onSelect: (building: BuildingData) => void;
  onDelete: (id: string) => Promise<void>;
  onAdd?: () => void;
  selectedId?: string;
}

export const BuildingsListPanel: React.FC<BuildingsListPanelProps> = ({
  buildings,
  onClose,
  onSelect,
  onDelete,
  onAdd,
  selectedId,
}) => {
  const [isDeleting, setIsDeleting] = React.useState<string | null>(null);
  const [showConfirm, setShowConfirm] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState("");

  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (selectedId && listRef.current) {
      const element = listRef.current.querySelector(
        `[data-id="${selectedId}"]`,
      );
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [selectedId]);

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

  const filteredBuildings = buildings.filter(
    (b) =>
      (b.buildingName || "Unnamed Block")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (b.buildingCode || "").toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <Card
      className={cn(
        "fixed z-30 flex flex-col bg-card/95 backdrop-blur-2xl border border-white/10 shadow-2xl overflow-hidden transition-all duration-500",
        "inset-x-0 bottom-0 h-[60vh] rounded-t-[32px] md:rounded-3xl", // Mobile
        "md:inset-auto md:right-22 md:top-4 md:w-80 md:h-auto md:max-h-[calc(100vh-2rem)]", // Desktop
        "animate-in fade-in slide-in-from-bottom md:slide-in-from-right-8",
      )}
    >
      {/* Mobile Drag Handle */}
      <div className="flex md:hidden justify-center pt-3 pb-1 shrink-0">
        <div className="w-12 h-1.5 rounded-full bg-white/20" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/20 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-[15px] font-black tracking-tight flex items-center gap-2">
              Buildings
              <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded-full text-[10px]">
                {buildings.length}
              </span>
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onAdd && (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={onAdd}
                    className="h-8 rounded-xl bg-primary text-white shadow-lg shadow-primary/20 hover:opacity-90 px-2.5 flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left" className="hidden md:block">
                  Design New Block
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 rounded-xl hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Search Input */}
      <div className="px-4 py-3 border-b border-border/10">
        <SearchInput
          placeholder="Search by name or code..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onClear={() => setSearchTerm("")}
          className="h-9 text-xs"
          containerClassName="w-full"
        />
      </div>

      {/* List */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto w-full p-2 space-y-1 custom-scrollbar"
      >
        {filteredBuildings.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <Building2 className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-xs font-medium">
              {searchTerm ? "No results found" : "No buildings detected"}
            </p>
            <p className="text-[10px]">
              {searchTerm
                ? "Try adjusting your search"
                : "Pan the map to load areas"}
            </p>
          </div>
        ) : (
          filteredBuildings.map((b) => (
            <div
              key={b.id}
              data-id={b.id}
              onClick={() => onSelect(b)}
              className={cn(
                "group relative flex flex-col gap-1.5 px-4 py-3 transition-all rounded-2xl cursor-pointer border",
                selectedId === b.id
                  ? "bg-primary/20 border-primary/40 shadow-sm shadow-primary/10"
                  : "bg-white/5 hover:bg-white/10 border-transparent hover:border-white/10",
              )}
            >
              <div className="flex justify-between items-start w-full">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "font-bold text-[12px] truncate max-w-[140px]",
                      selectedId === b.id ? "text-primary" : "text-white/90",
                    )}
                  >
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
                    className="flex flex-col items-end gap-1 absolute right-3 top-2 bg-[#0f1117] border border-white/10 p-2 rounded-xl shadow-2xl z-10"
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
                {b.buildingArea && (
                  <span>
                    {Math.round(parseFloat(String(b.buildingArea)))} m²
                  </span>
                )}
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
