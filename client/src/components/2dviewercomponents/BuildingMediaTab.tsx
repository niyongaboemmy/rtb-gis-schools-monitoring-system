import { useState } from "react";
import {
  Plus,
  Trash2,
  Globe,
  Image as ImageIcon,
  Video,
  ExternalLink,
  X,
  Upload,
  Shield,
} from "lucide-react";
import { fileApi } from "../../lib/api";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";
import type { BuildingData } from "../school-form-steps/BuildingsStep";

interface BuildingMediaTabProps {
  building: BuildingData;
  schoolId: string;
  onUpdateBuilding: (update: BuildingData) => Promise<void>;
}

export function BuildingMediaTab({
  building,
  schoolId,
  onUpdateBuilding,
}: BuildingMediaTabProps) {
  const [newTitle, setNewTitle] = useState("");
  const [newPath, setNewPath] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadMode, setUploadMode] = useState<"local" | "remote">("local");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    if (file) {
      if (file.type.startsWith("image/")) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
      } else {
        setPreviewUrl(null);
      }
      if (!newTitle) setNewTitle(file.name.split(".")[0]);
    }
  };

  const handleAddMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadMode === "remote" && !newPath) return;
    if (uploadMode === "local" && !selectedFile) return;

    setIsSaving(true);
    let finalPath = newPath;

    try {
      if (uploadMode === "local" && selectedFile) {
        const formData = new FormData();
        formData.append("files", selectedFile);

        const { data } = await fileApi.post(
          `/upload?folder=buildings&schoolId=${schoolId}`,
          formData,
        );

        if (data.success && data.urls && data.urls.length > 0) {
          finalPath = data.urls[0];
        } else {
          throw new Error("Upload failed");
        }
      }

      const newMediaItem = {
        title:
          newTitle ||
          (uploadMode === "local" ? selectedFile?.name : "Remote Asset") ||
          "Untitled",
        path: finalPath,
        type: (finalPath.match(/\.(mp4|webm|ogg|mov)$/i)
          ? "video"
          : "image") as "image" | "video",
        createdAt: new Date().toISOString(),
      };

      const updatedMedia = [...(building.media || []), newMediaItem];
      await onUpdateBuilding({ ...building, media: updatedMedia });

      setNewTitle("");
      setNewPath("");
      setSelectedFile(null);
      setPreviewUrl(null);
      setIsAdding(false);
    } catch (err) {
      console.error("Failed to add media:", err);
      alert("Asset capture failed. Please retry.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveMedia = async (index: number) => {
    const updatedMedia = building.media?.filter((_, i) => i !== index);
    try {
      await onUpdateBuilding({ ...building, media: updatedMedia });
    } catch (err) {
      console.error("Failed to remove media:", err);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-0 py-2 custom-scrollbar space-y-6">
      <div className="flex items-center justify-between px-0.5">
        <div className="space-y-0.5">
          <p className="text-[10px] text-white/40 uppercase font-black tracking-[0.2em] font-mono">
            Digital Assets
          </p>
          <p className="text-[11px] text-white/60 font-medium">
            Building registry & media
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setIsAdding(!isAdding);
            setPreviewUrl(null);
          }}
          className={cn(
            "h-8 px-4 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest border-none",
            isAdding
              ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
              : "bg-primary/20 text-primary hover:bg-primary/30",
          )}
          variant="ghost"
        >
          {isAdding ? (
            <X className="w-3.5 h-3.5 mr-1.5" />
          ) : (
            <Plus className="w-3.5 h-3.5 mr-1.5" />
          )}
          {isAdding ? "Close" : "Capture"}
        </Button>
      </div>

      {isAdding && (
        <form
          onSubmit={handleAddMedia}
          className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500 group relative"
        >
          {/* Mode Switcher */}
          <div className="flex p-1 rounded-xl bg-white/5 border border-white/5">
            {[
              { id: "local", label: "Local Upload", icon: Upload },
              { id: "remote", label: "Remote URL", icon: Globe },
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setUploadMode(mode.id as any)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                  uploadMode === mode.id
                    ? "bg-white/10 text-white"
                    : "text-white/40 hover:text-white/40",
                )}
              >
                <mode.icon className="w-3 h-3" />
                {mode.label}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[9px] uppercase font-black text-white/60 tracking-widest ml-1">
                Asset Identity
              </label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Name this asset..."
                className="bg-white/3 border-white/5 h-11 text-xs rounded-xl focus:ring-primary/20 placeholder:text-white/10"
              />
            </div>

            {uploadMode === "local" ? (
              <div className="space-y-2">
                <label className="text-[9px] uppercase font-black text-white/60 tracking-widest ml-1">
                  File Source
                </label>
                <div className="relative group/upload">
                  <input
                    type="file"
                    id="media-upload"
                    className="hidden"
                    onChange={onFileSelect}
                    accept="image/*,video/*"
                  />
                  <label
                    htmlFor="media-upload"
                    className={cn(
                      "flex flex-col items-center justify-center min-h-[140px] border-2 border-dashed rounded-2xl transition-all cursor-pointer overflow-hidden",
                      selectedFile
                        ? "border-primary/50 bg-primary/5"
                        : "border-white/5 hover:border-white/10 bg-white/2",
                    )}
                  >
                    {previewUrl ? (
                      <div className="w-full h-full relative group/preview">
                        <img
                          src={previewUrl}
                          className="w-full h-[140px] object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                          alt="Preview"
                        />
                        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Plus className="w-6 h-6 text-white mb-1" />
                          <p className="text-[8px] font-black text-white uppercase">
                            Change Image
                          </p>
                        </div>
                      </div>
                    ) : selectedFile ? (
                      <div className="flex flex-col items-center p-4">
                        <Video className="w-8 h-8 text-primary/60 mb-2" />
                        <p className="text-xs font-bold text-white/90 truncate max-w-[200px]">
                          {selectedFile.name}
                        </p>
                        <p className="text-[9px] text-white/40 uppercase mt-1">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB •
                          READY
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center text-white/40 group-hover:text-white/40 transition-all">
                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-2 border border-white/5 group-hover:scale-110 transition-transform">
                          <Upload className="w-5 h-5" />
                        </div>
                        <p className="text-[9px] uppercase font-black tracking-widest">
                          Drop files here
                        </p>
                      </div>
                    )}
                  </label>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-[9px] uppercase font-black text-white/60 tracking-widest ml-1">
                  Remote Endpoint
                </label>
                <div className="relative">
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
                  <Input
                    value={newPath}
                    onChange={(e) => setNewPath(e.target.value)}
                    placeholder="https://..."
                    className="bg-white/3 border-white/5 h-11 pl-10 text-xs rounded-xl focus:ring-primary/20 placeholder:text-white/10"
                  />
                </div>
              </div>
            )}
          </div>

          <Button
            type="submit"
            disabled={
              isSaving || (uploadMode === "local" ? !selectedFile : !newPath)
            }
            className="w-full py-6 rounded-2xl bg-linear-to-r from-primary to-blue-600 hover:from-blue-600 hover:to-primary text-white font-black text-[10px] uppercase tracking-[0.2em] mt-2 border-none transition-all duration-500 active:scale-[0.98]"
          >
            {isSaving ? (
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Processing Asset...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5" />
                Commit to Registry
              </div>
            )}
          </Button>
        </form>
      )}

      {/* Media Grid */}
      <div className="grid grid-cols-1 gap-3 pb-8">
        {!building.media || building.media.length === 0 ? (
          <div className="h-40 rounded-3xl border border-dashed border-white/10 flex flex-col items-center justify-center p-8 bg-black/10">
            <Globe className="w-8 h-8 text-white/5 mb-3" />
            <p className="text-[10px] text-white/40 font-normal text-center leading-relaxed">
              {" "}
              No digital assets found.
              <br />
              Attach external media to this block.{" "}
            </p>
          </div>
        ) : (
          building.media.map((m, idx) => {
            const isVideo =
              m.type === "video" || m.path.match(/\.(mp4|webm|ogg|mov)$/i);
            const isExternal = m.path.startsWith("http");

            return (
              <div
                key={idx}
                className="group relative flex items-center gap-4 p-3 rounded-2xl bg-white/3 border border-white/5 hover:bg-white/6 hover:border-white/10 transition-all overflow-hidden"
              >
                {/* Preview / Icon - High Fidelity Preview */}
                <div className="w-16 h-16 rounded-xl bg-black/40 border border-white/5 flex items-center justify-center shrink-0 overflow-hidden relative group-hover:border-primary/30 transition-colors">
                  {isVideo ? (
                    <div className="flex flex-col items-center">
                      <Video className="w-6 h-6 text-primary/40 group-hover:text-primary transition-colors" />
                      <span className="text-[7px] text-primary/30 uppercase font-black mt-1">
                        Video
                      </span>
                    </div>
                  ) : (
                    <div
                      className="w-full h-full relative cursor-pointer"
                      onClick={() => window.open(m.path, "_blank")}
                    >
                      <img
                        src={m.path}
                        alt={m.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                          const fallback =
                            target.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = "flex";
                        }}
                      />
                      <div
                        className="hidden absolute inset-0 flex-col items-center justify-center bg-black/40"
                        style={{ display: "none" }}
                      >
                        <ImageIcon className="w-6 h-6 text-blue-400/40" />
                      </div>
                    </div>
                  )}
                  {isExternal && (
                    <Badge className="absolute top-1 left-1 bg-primary/20 text-[6px] h-3 px-1 border-none text-primary uppercase backdrop-blur-md">
                      Web
                    </Badge>
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white/90 truncate pr-8 group-hover:text-white transition-colors uppercase tracking-tight antialiased">
                    {m.title || "Untitled Asset"}
                  </p>
                  <p className="text-[10px] text-white/40 truncate font-mono mt-0.5 group-hover:text-white/40 transition-colors">
                    {m.path}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => window.open(m.path, "_blank")}
                      className="text-[9px] font-black text-primary/60 hover:text-primary uppercase tracking-widest transition-colors flex items-center gap-1"
                    >
                      View Source
                      <ExternalLink className="w-2.5 h-2.5" />
                    </button>
                    <div className="w-1 h-1 rounded-full bg-white/5" />
                    <span className="text-[9px] text-white/10 font-bold uppercase tracking-widest">
                      {m.type || "Asset"}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <button
                  onClick={() => handleRemoveMedia(idx)}
                  className="absolute top-3 right-3 p-1.5 rounded-lg text-white/10 hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
