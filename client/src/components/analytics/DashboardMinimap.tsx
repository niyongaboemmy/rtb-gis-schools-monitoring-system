import { useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import { Link } from "react-router-dom";
import { Map } from "lucide-react";
import "leaflet/dist/leaflet.css";
import type { School } from "../../store/schoolsStore";
import { cn } from "../../lib/utils";

interface DashboardMinimapProps {
  schools: School[];
  className?: string;
}

const PRIORITY_COLOR: Record<string, string> = {
  critical: "#ef4444",
  high:     "#f59e0b",
  medium:   "#3b82f6",
  low:      "#10b981",
};

const RWANDA_CENTER: [number, number] = [-1.9403, 29.8739];

export function DashboardMinimap({ schools, className }: DashboardMinimapProps) {
  // Only schools that have coordinates — decimal columns come back as strings from the API
  const plotted = useMemo(
    () =>
      schools.filter((s) => {
        const lat = parseFloat(String(s.latitude));
        const lng = parseFloat(String(s.longitude));
        return isFinite(lat) && isFinite(lng) && lat !== 0 && lng !== 0;
      }),
    [schools],
  );

  return (
    <div className={cn("relative rounded-3xl overflow-hidden border border-border/20 dark:border-blue-700/30 bg-card/60", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/10 dark:border-blue-700/20">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 flex items-center gap-2">
          <Map className="w-3.5 h-3.5" />
          School Locations
        </span>
        <Link
          to="/map"
          className="text-[9px] font-black uppercase tracking-widest text-primary/70 hover:text-primary transition-colors"
        >
          Full map →
        </Link>
      </div>

      {/* Map */}
      <div className="h-[220px] w-full">
        <MapContainer
          center={RWANDA_CENTER}
          zoom={8}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={false}
          zoomControl={false}
          dragging={false}
          doubleClickZoom={false}
          keyboard={false}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            className="grayscale opacity-50"
          />
          {plotted.map((school) => {
            const lat = parseFloat(String(school.latitude));
            const lng = parseFloat(String(school.longitude));
            const color = PRIORITY_COLOR[school.priorityLevel] ?? "#64748b";
            return (
              <CircleMarker
                key={school.id}
                center={[lat, lng]}
                radius={4}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 0.8,
                  weight: 1,
                  opacity: 0.9,
                }}
              >
                <Tooltip direction="top" offset={[0, -4]} opacity={0.9}>
                  <span className="text-[11px] font-medium">
                    {school.name} — {school.priorityLevel}
                  </span>
                </Tooltip>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      {/* Priority legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 border-t border-border/10 dark:border-blue-700/20">
        {Object.entries(PRIORITY_COLOR).map(([label, color]) => (
          <div key={label} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/70">
              {label}
            </span>
          </div>
        ))}
        <span className="ml-auto text-[9px] font-black uppercase tracking-wider text-muted-foreground/40">
          {plotted.length} / {schools.length} mapped
        </span>
      </div>
    </div>
  );
}
