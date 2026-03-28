import { useState, useCallback, useRef, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  UploadCloud,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Layers,
  MapPin,
  Box,
  Map,
  FileCheck,
  RefreshCw,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { PageHeader } from "../components/ui/page-header";
import { useAuthStore } from "../store/authStore";
import { cn } from "../lib/utils";
import { api } from "../lib/api";

export default function KmzUpload() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [uploadMode, setUploadMode] = useState<"3d" | "2d">("3d");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<
    "idle" | "uploading" | "processing" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [existingFile3d, setExistingFile3d] = useState<string | null>(null);
  const [existingFile2d, setExistingFile2d] = useState<string | null>(null);
  const [loadingSchool, setLoadingSchool] = useState(true);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .get(`/schools/${id}`)
      .then((res) => {
        const school = res.data;
        // 3D: look for a .dlb file in the buildings modelPaths
        const dlbBuilding = school.buildings?.find((b: any) =>
          b.modelPath?.toLowerCase().endsWith(".glb"),
        );
        setExistingFile3d(dlbBuilding?.modelPath || null);
        // 2D: kmz/kml file stored on the school
        setExistingFile2d(school.kmz2dFilePath || null);
      })
      .finally(() => setLoadingSchool(false));
  }, [id]);

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
    setMessage("Deploying geospatial payload to cloud storage...");
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    const apiBaseUrl = import.meta.env.VITE_API_URL || "/api/v1";
    const token = useAuthStore.getState().token;

    const endpoint =
      uploadMode === "2d"
        ? `${apiBaseUrl}/schools/${id}/kmz/2d`
        : `${apiBaseUrl}/schools/${id}/kmz`;
    xhr.open("POST", endpoint);
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
          setMessage("Processing geospatial data...");
        }
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setStatus("success");
        setUploadProgress(100);
        setMessage(
          "Geospatial data successfully integrated into GIS database.",
        );
        setTimeout(() => {
          navigate(`/schools/${id}`);
        }, 3000);
      } else {
        setStatus("error");
        try {
          const errorData = JSON.parse(xhr.responseText);
          setMessage(
            errorData.message ||
              "Failed to analyze geospatial payload. File format mismatch or file exceeds size limits.",
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

  const existingFile = uploadMode === "3d" ? existingFile3d : existingFile2d;
  const existingFileName = existingFile
    ? existingFile.split("/").pop()
    : null;
  const isUpdate = !!existingFile;

  const acceptAttr = uploadMode === "3d" ? ".glb" : ".kmz,.kml";
  const formatLabel = uploadMode === "3d" ? "GLB" : "KMZ or KML";
  const formatHint =
    uploadMode === "3d"
      ? ".glb files only (max 2GB)"
      : ".kmz or .kml files only (max 2GB)";

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Upload Maps"
        description="Upload map files for 3D Cesium rendering or 2D OpenLayers display."
        icon={Layers}
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

      {/* 2D / 3D mode selector */}
      <div className="grid grid-cols-2 gap-4">
        {[
          {
            mode: "3d" as const,
            label: "3D Viewer",
            desc: "Cesium — GLB format with 3D building models & terrain",
            icon: Box,
            fileLabel: existingFile3d ? existingFile3d.split("/").pop() : null,
          },
          {
            mode: "2d" as const,
            label: "2D Viewer",
            desc: "OpenLayers — KMZ or KML flat features & overlays",
            icon: Map,
            fileLabel: existingFile2d ? existingFile2d.split("/").pop() : null,
          },
        ].map(({ mode, label, desc, icon: Icon, fileLabel }) => (
          <button
            key={mode}
            onClick={() => {
              setUploadMode(mode);
              setFile(null);
              setStatus("idle");
            }}
            className={cn(
              "rounded-3xl p-6 text-left border-2 transition-all",
              uploadMode === mode
                ? "border-primary bg-primary/5"
                : "border-border/20 hover:border-primary/40 bg-card",
            )}
          >
            <div className="flex items-start justify-between mb-3">
              <Icon
                className={cn(
                  "w-6 h-6",
                  uploadMode === mode ? "text-primary" : "text-muted-foreground",
                )}
              />
              {!loadingSchool && fileLabel && (
                <span className="text-[9px] font-black uppercase tracking-widest bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                  Uploaded
                </span>
              )}
            </div>
            <p className="text-sm font-black uppercase tracking-tight">
              {label}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">{desc}</p>
            {!loadingSchool && fileLabel && (
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-2 truncate">
                {fileLabel}
              </p>
            )}
          </button>
        ))}
      </div>

      <div className="bg-card rounded-3xl p-8">
        {status === "success" ? (
          <div className="text-center py-12 space-y-4">
            <div className="mx-auto w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-500 rounded-full flex items-center justify-center">
              <CheckCircle className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-medium">Processing Complete</h2>
            <p className="text-muted-foreground">{message}</p>
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-500">
              Redirecting to school details...
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Existing file notice */}
            {!loadingSchool && isUpdate && (
              <div className="flex items-start gap-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4">
                <FileCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                    {uploadMode === "3d" ? "3D map" : "2D map"} already uploaded
                  </p>
                  <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 truncate mt-0.5">
                    {existingFileName}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Uploading a new file will replace the existing one.
                  </p>
                </div>
              </div>
            )}

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
                id="kmz-upload"
                className="hidden"
                accept={acceptAttr}
                onChange={handleFileChange}
                disabled={status === "uploading" || status === "processing"}
              />

              {!file ? (
                <label
                  htmlFor="kmz-upload"
                  className="cursor-pointer flex flex-col items-center gap-4"
                >
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-primary">
                    <UploadCloud className="h-8 w-8" />
                  </div>
                  <div>
                    <span className="text-lg font-medium text-primary hover:underline">
                      {isUpdate ? "Click to replace file" : "Click to upload"}
                    </span>
                    <span className="text-muted-foreground"> or drag and drop</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{formatHint}</p>
                </label>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                    <Layers className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="text-lg font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {file.size > 1024 * 1024 * 1024
                        ? (file.size / (1024 * 1024 * 1024)).toFixed(2) + " GB"
                        : (file.size / (1024 * 1024)).toFixed(2) + " MB"}
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
                <Link to={`/schools/${id}`}>Cancel</Link>
              </Button>
              <Button
                onClick={handleUpload}
                disabled={
                  !file || status === "uploading" || status === "processing"
                }
                className="min-w-[140px]"
              >
                {status === "uploading" || status === "processing" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing
                  </>
                ) : isUpdate ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Update {formatLabel} File
                  </>
                ) : (
                  <>
                    <UploadCloud className="mr-2 h-4 w-4" />
                    Upload {formatLabel} File
                  </>
                )}
              </Button>
            </div>

            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-3">
                Want to add places of interest (shops, hospitals, etc.)?
              </p>
              <Button variant="outline" asChild>
                <Link to={`/schools/${id}/places-overlay`}>
                  <MapPin className="mr-2 h-4 w-4" />
                  Upload Places Overlay
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
