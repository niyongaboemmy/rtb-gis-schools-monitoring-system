import { useState, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  UploadCloud,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowLeft,
  MapPin,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { PageHeader } from "../components/ui/page-header";
import { useAuthStore } from "../store/authStore";

export default function PlacesOverlayUpload() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<
    "idle" | "uploading" | "processing" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (!file || !id) return;

    setStatus("uploading");
    setMessage("Uploading places overlay file...");
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    const apiBaseUrl = import.meta.env.VITE_API_URL || "/api/v1";
    const token = useAuthStore.getState().token;

    xhr.open("POST", `${apiBaseUrl}/schools/${id}/kmz/places-overlay`);
    xhr.setRequestHeader("Accept", "application/json");
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = (event.loaded / event.total) * 100;
        setUploadProgress(percentComplete);
        if (percentComplete < 100) {
          setMessage(`Uploading: ${percentComplete.toFixed(0)}%`);
        } else {
          setMessage("Processing places data...");
        }
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setStatus("success");
        setUploadProgress(100);
        setMessage(
          "Places overlay successfully integrated. Points of interest will appear on the map.",
        );
        setTimeout(() => {
          navigate(`/schools/${id}/decision`);
        }, 3000);
      } else {
        setStatus("error");
        try {
          const errorData = JSON.parse(xhr.responseText);
          setMessage(
            errorData.message || "Failed to process places overlay file.",
          );
        } catch {
          setMessage(
            "Failed to upload file. The file may be too large for the server to process.",
          );
        }
      }
    };

    xhr.onerror = () => {
      setStatus("error");
      setMessage("Network error occurred while uploading file.");
    };

    xhr.send(formData);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Places Overlay"
        description="Upload a KML/KMZ file to display additional points of interest (shops, hospitals, etc.) on the map."
        icon={MapPin}
        backButton={
          <Button
            variant="outline"
            size="icon"
            asChild
            className="rounded-full h-12 w-12 border-border/10 shadow-none hover:bg-background/50 hover:border-primary/30 transition-all"
          >
            <Link to={`/schools/${id}`}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
        }
      />

      <div className="bg-card rounded-3xl p-8">
        {status === "success" ? (
          <div className="text-center py-12 space-y-4">
            <div className="mx-auto w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-500 rounded-full flex items-center justify-center">
              <CheckCircle className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-medium">Upload Complete</h2>
            <p className="text-muted-foreground">{message}</p>
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-500">
              Redirecting to School Map view...
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors
                ${file ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/50"}
                ${status === "uploading" || status === "processing" ? "opacity-50 pointer-events-none" : ""}
              `}
            >
              <input
                type="file"
                id="places-upload"
                className="hidden"
                accept=".kmz,.kml"
                onChange={handleFileChange}
                disabled={status === "uploading" || status === "processing"}
              />

              {!file ? (
                <label
                  htmlFor="places-upload"
                  className="cursor-pointer flex flex-col items-center gap-4"
                >
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-primary">
                    <UploadCloud className="h-8 w-8" />
                  </div>
                  <div>
                    <span className="text-lg font-medium text-primary hover:underline">
                      Click to upload
                    </span>
                    <span className="text-muted-foreground">
                      {" "}
                      or drag and drop
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    KML or KMZ files only (max 2GB)
                  </p>
                </label>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center text-orange-600">
                    <MapPin className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="text-lg font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {file.size > 1024 * 1024 * 1024
                        ? (file.size / (1024 * 1024 * 1024)).toFixed(2) + " GB"
                        : (file.size / (1024 * 1024)).toFixed(2)}{" "}
                      MB
                    </p>
                  </div>
                  {status === "uploading" && (
                    <div className="w-full max-w-xs">
                      <div className="h-2 bg-primary/20 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-300 ease-out"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="text-xs text-center text-muted-foreground mt-1">
                        {uploadProgress < 100
                          ? `Uploading... ${uploadProgress.toFixed(0)}%`
                          : "Processing on server..."}
                      </p>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFile(null)}
                    disabled={status === "uploading" || status === "processing"}
                  >
                    Change File
                  </Button>
                </div>
              )}
            </div>

            {status === "error" && (
              <div className="bg-destructive/10 border-l-4 border-destructive p-4 rounded-r-md flex gap-3 text-destructive">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p className="text-sm">{message}</p>
              </div>
            )}

            <div className="flex justify-end gap-4">
              <Button
                variant="outline"
                asChild
                disabled={status === "uploading" || status === "processing"}
              >
                <Link to={`/schools`}>Cancel</Link>
              </Button>
              <Button
                onClick={handleUpload}
                disabled={
                  !file || status === "uploading" || status === "processing"
                }
                className="min-w-[120px]"
              >
                {status === "uploading" || status === "processing" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing
                  </>
                ) : (
                  "Upload & Process"
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
