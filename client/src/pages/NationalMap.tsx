import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  ZoomControl,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  Search,
  Filter,
  Layers,
  Navigation,
  Map as MapIcon,
} from "lucide-react";
import { PageHeader } from "../components/ui/page-header";
import { motion } from "framer-motion";
import { cn } from "../lib/utils";
import { Button } from "../components/ui/button";

export default function NationalMap() {
  const [geoData, setGeoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const fetchGeoData = async () => {
      try {
        const response = await api.get("/schools/geojson");
        setGeoData(response.data);
      } catch (err) {
        console.error("Failed to load map data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchGeoData();
  }, []);

  const getMarkerColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "#ef4444"; // destructive
      case "high":
        return "#f59e0b"; // amber
      case "medium":
        return "#3b82f6"; // blue
      case "low":
        return "#10b981"; // emerald
      default:
        return "#64748b"; // slate
    }
  };

  const createCustomIcon = (priority: string) => {
    const color = getMarkerColor(priority);
    return L.divIcon({
      className: "custom-pin",
      html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white;"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] w-full relative space-y-4">
      <PageHeader
        title="National Map"
        description="Geospatial Distribution of TVET Schools nationwide"
        icon={MapIcon}
        actions={
          <>
            <div className="relative flex-1 group min-w-[200px]">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                placeholder="Search region or district..."
                className="h-10 w-full border border-border/20 rounded-xl pl-11 pr-4 text-xs font-bold bg-background/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground/60 shadow-none"
              />
            </div>
            <Button
              variant="outline"
              className="h-10 rounded-xl px-4 md:px-6 gap-2 font-black uppercase tracking-wider text-[10px] border-border/20 hover:bg-primary/5 transition-colors shadow-none shrink-0"
            >
              <Filter className="w-4 h-4" /> Filters
            </Button>
            <Button
              variant="outline"
              className="h-10 rounded-xl px-4 md:px-6 gap-2 font-black uppercase tracking-wider text-[10px] border-border/20 hover:bg-primary/5 transition-colors shadow-none shrink-0"
            >
              <Layers className="w-4 h-4" /> Layers
            </Button>
          </>
        }
      />

      {loading ? (
        <Card className="flex-1 flex items-center justify-center border border-border/20 overflow-hidden bg-slate-100/50 backdrop-blur-sm rounded-3xl shadow-none">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="text-sm font-bold text-muted-foreground animate-pulse uppercase tracking-widest">
              Initialising GIS Engine...
            </p>
          </div>
        </Card>
      ) : (
        <Card className="flex-1 border border-border/20 overflow-hidden relative rounded-3xl shadow-none bg-card/60 backdrop-blur-sm">
          <MapContainer
            center={[-1.9403, 29.8739]} // Rwanda center
            zoom={9}
            className="w-full h-full z-0"
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ZoomControl position="bottomright" />

            {geoData?.features?.map((feature: any) => (
              <Marker
                key={feature.properties.id}
                position={[
                  feature.geometry.coordinates[1],
                  feature.geometry.coordinates[0],
                ]}
                icon={createCustomIcon(feature.properties.priorityLevel)}
              >
                <Popup className="custom-popup">
                  <div className="p-2 min-w-[220px]">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-black tracking-widest bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                        {feature.properties.code}
                      </span>
                      <Badge
                        variant={
                          feature.properties.priorityLevel === "critical"
                            ? "destructive"
                            : "default"
                        }
                        className="text-[9px] font-black uppercase px-2 py-0 rounded-full"
                      >
                        {feature.properties.priorityLevel || "Unassessed"}
                      </Badge>
                    </div>
                    <h4 className="font-bold text-sm mb-1 text-foreground">
                      {feature.properties.name}
                    </h4>
                    <p className="text-[11px] font-medium text-muted-foreground mb-4">
                      {feature.properties.district},{" "}
                      {feature.properties.province}
                    </p>

                    <Button
                      onClick={() =>
                        navigate(`/schools/${feature.properties.id}`)
                      }
                      size="sm"
                      className="w-full rounded-full font-bold gap-2 h-9"
                    >
                      <Navigation className="w-3.5 h-3.5" /> View School Details
                    </Button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Legend widget overlay */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 }}
            className="absolute bottom-8 left-8 z-1000 bg-card/85 backdrop-blur-md p-5 rounded-2xl border border-border/20 text-[11px] w-56 ring-1 ring-white/10"
          >
            <h4 className="font-black uppercase tracking-widest mb-4 text-foreground/70">
              Action Priorities
            </h4>
            <div className="space-y-3">
              {[
                {
                  label: "Critical Action",
                  color: "bg-red-500",
                },
                {
                  label: "High Priority",
                  color: "bg-amber-500",
                },
                {
                  label: "Medium Priority",
                  color: "bg-blue-500",
                },
                {
                  label: "Optimal / Safe",
                  color: "bg-emerald-500",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-4 group cursor-help"
                >
                  <div
                    className={cn(
                      "w-2.5 h-2.5 rounded-full transition-colors duration-500",
                      item.color
                    )}
                  />
                  <span className="font-bold text-foreground/80 group-hover:text-foreground transition-colors">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </Card>
      )}
    </div>
  );
}
