import React, { useState, useMemo } from "react";
import { Search, X } from "lucide-react";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import Feature from "ol/Feature";

interface MapNavigatorProps {
  features: Array<{ name: string; feature: Feature }>;
  selectedFeatureName: string | null;
  onFlyTo: (feature: Feature) => void;
  onClose: () => void;
}

export const MapNavigator: React.FC<MapNavigatorProps> = ({
  features,
  selectedFeatureName,
  onFlyTo,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredFeatures = useMemo(() => {
    if (!searchQuery.trim()) return features;
    const q = searchQuery.toLowerCase();
    return features.filter((f) => f.name.toLowerCase().includes(q));
  }, [features, searchQuery]);

  return (
    <div className={cn(
      "fixed z-40 transition-all duration-500",
      "inset-x-0 bottom-0 h-[50vh] md:h-auto", // Mobile bottom sheet
      "md:inset-auto md:right-16 md:top-4 md:w-64", // Desktop floating
      "animate-in slide-in-from-bottom md:slide-in-from-right-4"
    )}>
      <Card className="bg-background/80 backdrop-blur-2xl rounded-t-[32px] md:rounded-2xl border border-border/10 overflow-hidden h-full">
        <div className="p-3 border-b border-border/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-bold uppercase tracking-widest text-foreground/70">
              Navigator
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-lg"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="p-2">
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search features..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs bg-black/20 border-border/10 rounded-xl focus-visible:ring-primary/30"
            />
          </div>
        </div>

        <div className="overflow-y-auto max-h-[380px] px-2 pb-3 space-y-0.5 custom-scrollbar">
          {filteredFeatures.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-6">
              No features found
            </p>
          ) : (
            filteredFeatures.map(({ name, feature }) => (
              <button
                key={name}
                type="button"
                onClick={() => onFlyTo(feature)}
                className={cn(
                  "w-full text-left rounded-xl px-3 py-2 text-xs transition-colors",
                  selectedFeatureName === name
                    ? "bg-primary/15 text-primary font-bold"
                    : "hover:bg-muted/40 text-foreground/80",
                )}
              >
                {name}
              </button>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};
