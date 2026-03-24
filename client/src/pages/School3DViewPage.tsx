import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import School3DView from "../components/School3DView";
import { Button } from "../components/ui/button";
import { ArrowLeft } from "lucide-react";
import { api } from "../lib/api";

export default function School3DViewPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [school, setSchool] = useState<any>(null);
  const [placesOverlay, setPlacesOverlay] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchSchool = async () => {
      try {
        const response = await api.get(`/schools/${id}`);
        setSchool(response.data);

        // Fetch places overlay data
        try {
          const placesResponse = await api.get(
            `/schools/${id}/kmz/places-overlay`,
          );
          console.log("[PlacesOverlay] Raw API response:", placesResponse.data);
          setPlacesOverlay(placesResponse.data.placesOverlayData);
          console.log(
            "[PlacesOverlay] Set to:",
            placesResponse.data.placesOverlayData,
          );
        } catch (e: any) {
          // No places overlay uploaded yet
          console.log("[PlacesOverlay] Not found or error:", e.message);
        }
      } catch (error) {
        console.error("Failed to fetch school data", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSchool();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Back Button */}
      <div className="fixed top-6 left-6 z-50">
        <Button
          asChild
          variant="outline"
          size="icon"
          className="rounded-full h-12 w-12 bg-black/30 backdrop-blur-md border-white/20 hover:bg-black/50"
        >
          <Link to={`/schools/${id}/decision`}>
            <ArrowLeft className="h-5 w-5 text-white" />
          </Link>
        </Button>
      </div>

      {/* School Info Badge */}
      <div className="fixed top-6 right-6 z-50">
        <div className="bg-black/70 backdrop-blur-xl rounded-2xl px-6 py-3 border border-white/20 shadow-lg">
          <p className="text-white font-bold text-lg">{school?.name}</p>
          <p className="text-blue-300 text-sm font-medium">{school?.code}</p>
        </div>
      </div>

      {/* 3D View */}
      <School3DView
        buildings={school?.buildings || []}
        geojson={school?.geojsonContent}
        placesOverlay={placesOverlay}
        placesOverlayUrl={
          school?.placesOverlayFilePath
            ? school.placesOverlayFilePath.startsWith("/")
              ? school.placesOverlayFilePath
              : `/public/uploads/schools/${id}/places-overlay/${school.placesOverlayFilePath}`
            : undefined
        }
        initialView={school?.geojsonContent?.properties?.initialView}
        masterKmlUrl={
          school?.kmzMasterKmlPath
            ? school.kmzMasterKmlPath.startsWith("http")
              ? school.kmzMasterKmlPath
              : `${import.meta.env.VITE_API_URL || ""}/${school.kmzMasterKmlPath.replace(/^\//, "")}`
            : undefined
        }
        kmzUrl={
          school?.kmzFilePath
            ? school.kmzFilePath.startsWith("/")
              ? school.kmzFilePath
              : `/public/uploads/schools/${id}/kmz/${school.kmzFilePath}`
            : undefined
        }
        fallbackLocation={{
          lat: Number(school?.latitude) || 0,
          lng: Number(school?.longitude) || 0,
        }}
        onClose={() => navigate(`/schools/${id}/decision`)}
      />
    </div>
  );
}
