import React, { useState, useCallback } from "react";
import { Upload, X, FileCheck, Loader2, AlertCircle } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import { api } from "../../lib/api";
import { cn } from "../../lib/utils";

interface OverlayUploaderProps {
  schoolId: string;
  onSuccess: (newManifest: any) => void;
  onCancel: () => void;
}

export const OverlayUploader: React.FC<OverlayUploaderProps> = ({
  schoolId,
  onSuccess,
  onCancel,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<
    "idle" | "uploading" | "processing" | "success" | "error"
  >("idle");

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setStatus("idle");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.google-earth.kmz": [".kmz"],
      "application/vnd.google-earth.kml+xml": [".kml"],
      "image/tiff": [".tif", ".tiff"],
    },
    multiple: false,
  });

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setStatus("uploading");
    setUploadProgress(0);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await api.post(
        `/schools/${schoolId}/kmz/2d/overlays`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / (progressEvent.total || 1),
            );
            setUploadProgress(percentCompleted);
            if (percentCompleted === 100) {
              setStatus("processing");
            }
          },
        },
      );

      if (response.data.success) {
        setStatus("success");
        setTimeout(() => onSuccess(response.data.manifest), 1000);
      } else {
        throw new Error(response.data.message || "Upload failed");
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "An error occurred during upload",
      );
      setStatus("error");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-4 space-y-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary">
          New Drone Layer
        </h4>
        <button
          onClick={onCancel}
          className="text-muted-foreground hover:text-white transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {!file ? (
        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-all cursor-pointer bg-white/5",
            isDragActive
              ? "border-primary bg-primary/10"
              : "border-white/10 hover:border-white/20 hover:bg-white/10",
          )}
        >
          <input {...getInputProps()} />
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <Upload className="h-5 w-5 text-primary" />
          </div>
          <p className="text-xs font-bold text-center">
            {isDragActive ? "Drop the file here" : "Drag & drop KMZ or GeoTIFF"}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-tighter">
            Max size: 50MB
          </p>
        </div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileCheck className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate">{file.name}</p>
              <p className="text-[9px] text-muted-foreground uppercase">
                {(file.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
            {!isUploading && status !== "success" && (
              <button
                onClick={() => setFile(null)}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {(status === "uploading" || status === "processing") && (
            <div className="space-y-2">
              <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest">
                <span>
                  {status === "uploading"
                    ? "Uploading..."
                    : "Processing & Tiling..."}
                </span>
                <span>
                  {status === "uploading"
                    ? `${uploadProgress}%`
                    : "Please wait"}
                </span>
              </div>
              <Progress
                value={status === "uploading" ? uploadProgress : 100}
                className="h-1.5"
              />
              {status === "processing" && (
                <p className="text-[9px] text-muted-foreground italic leading-tight">
                  We're optimizing your high-res imagery for smooth rendering.
                  This may take a few moments.
                </p>
              )}
            </div>
          )}

          {status === "error" && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-[10px] font-medium leading-tight">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {status === "success" && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-widest justify-center">
              Processing Complete!
            </div>
          )}

          {!isUploading && status !== "success" && (
            <Button
              className="w-full h-9 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-primary hover:bg-primary/90 transition-all"
              onClick={handleUpload}
            >
              Start Processing
            </Button>
          )}

          {status === "processing" && (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="h-4 w-4 text-primary animate-spin" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
