import React, { useState, useCallback } from "react";
import { Upload, X, FileCheck, Loader2, AlertCircle, Check } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { EASE } from "../school-dashboard/tokens";
import { api } from "../../lib/api";
import { cn } from "../../lib/utils";
import { useToast } from "../ui/toast";

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
  const toast = useToast();
  const reduce = useReducedMotion();
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
        toast.success(`Drone layer "${file.name}" uploaded`);
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

  const busy = status === "uploading" || status === "processing";
  const shownProgress = status === "uploading" ? uploadProgress : 100;

  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.28, ease: EASE }}
      className="space-y-3 p-4"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-[15px] font-medium text-slate-800 dark:text-white">
          New drone image
        </h4>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close drone layer upload"
          className="flex h-7 w-7 items-center justify-center rounded-full text-slate-600 dark:text-white/60 hover:bg-slate-900/5 dark:hover:bg-white/8 hover:text-slate-800 dark:hover:text-white transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {!file ? (
          <motion.div
            key="drop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.18, ease: EASE }}
          >
            <div
              {...getRootProps()}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-8 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                isDragActive
                  ? "border-primary bg-primary/10"
                  : "border-slate-900/15 dark:border-white/15 bg-white/40 dark:bg-white/4 hover:border-primary/50 hover:bg-primary/5",
              )}
            >
              <input {...getInputProps()} />
              <span
                className={cn(
                  "mb-3 flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                  isDragActive
                    ? "bg-primary text-white"
                    : "bg-primary/10 text-primary dark:text-blue-300",
                )}
              >
                <Upload className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <p className="text-[15px] font-medium text-slate-800 dark:text-white">
                {isDragActive ? "Drop the file here" : "Drag & drop KMZ or GeoTIFF"}
              </p>
              <p className="mt-1 text-[14px] text-slate-600 dark:text-white/55">
                or click to choose · up to 50 MB
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="file"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.22, ease: EASE }}
            className="flex flex-col gap-3 rounded-2xl bg-white/50 dark:bg-white/5 p-3.5 ring-1 ring-slate-900/5 dark:ring-white/8"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary dark:text-blue-300">
                <FileCheck className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-slate-800 dark:text-white">
                  {file.name}
                </p>
                <p className="text-[13px] tabular-nums text-slate-600 dark:text-white/55">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
              {!isUploading && status !== "success" && (
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  aria-label="Remove selected file"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-slate-600 dark:text-white/60 hover:bg-destructive/10 hover:text-destructive transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              )}
            </div>

            {busy && (
              <div className="space-y-2" role="status" aria-live="polite">
                <div className="flex items-center justify-between text-[14px] text-slate-700 dark:text-white/75">
                  <span className="flex items-center gap-1.5">
                    {status === "processing" && (
                      <Loader2
                        className={cn("h-3.5 w-3.5 text-primary dark:text-blue-300", !reduce && "animate-spin")}
                        aria-hidden
                      />
                    )}
                    {status === "uploading" ? "Uploading" : "Preparing the image"}
                  </span>
                  <span className="tabular-nums text-slate-600 dark:text-white/55">
                    {status === "uploading" ? `${uploadProgress}%` : "Please wait"}
                  </span>
                </div>
                <div
                  className="h-1 w-full overflow-hidden rounded-full bg-slate-900/10 dark:bg-white/10"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={shownProgress}
                  aria-label="Upload progress"
                >
                  <motion.div
                    className={cn(
                      "h-full rounded-full bg-primary",
                      status === "processing" && !reduce && "animate-pulse",
                    )}
                    initial={false}
                    animate={{ width: `${shownProgress}%` }}
                    transition={{ duration: reduce ? 0 : 0.4, ease: EASE }}
                  />
                </div>
                {status === "processing" && (
                  <p className="text-[13px] leading-snug text-slate-600 dark:text-white/55">
                    Getting the image ready for the map. This can take a minute.
                  </p>
                )}
              </div>
            )}

            {status === "error" && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-[14px] leading-snug text-destructive"
              >
                <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>{error}</span>
              </div>
            )}

            {status === "success" && (
              <div
                role="status"
                className="flex items-center justify-center gap-1.5 rounded-xl bg-primary/10 px-3 py-2 text-[14px] font-medium text-primary dark:text-blue-300"
              >
                <Check className="h-3.5 w-3.5" aria-hidden />
                Image ready
              </div>
            )}

            {!isUploading && status !== "success" && (
              <button
                type="button"
                onClick={handleUpload}
                className="h-9 w-full rounded-full bg-primary text-[15px] font-medium text-white hover:bg-primary/90 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                {status === "error" ? "Try again" : "Upload"}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
