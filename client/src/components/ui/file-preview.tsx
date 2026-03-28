import { useState } from "react";
import { 
  FileText, 
  Image as ImageIcon, 
  Download, 
  Maximize2, 
  X,
  FileCode,
  FileBox,
  FileQuestion,
  Eye
} from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./button";
import { motion, AnimatePresence } from "framer-motion";

interface FilePreviewProps {
  url: string;
  filename?: string;
  className?: string;
  showDetails?: boolean;
}

export function FilePreview({ url, filename, className, showDetails = true }: FilePreviewProps) {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const fileExtension = url.split(".").pop()?.toLowerCase() || "";
  const isImage = ["jpg", "jpeg", "png", "gif", "webp"].includes(fileExtension);
  const isPdf = fileExtension === "pdf";

  const getFileIcon = () => {
    switch (fileExtension) {
      case "pdf": return <FileText className="w-8 h-8 text-rose-500" />;
      case "doc":
      case "docx": return <FileText className="w-8 h-8 text-blue-500" />;
      case "xls":
      case "xlsx": return <FileBox className="w-8 h-8 text-emerald-500" />;
      case "json":
      case "js":
      case "ts": return <FileCode className="w-8 h-8 text-amber-500" />;
      default: return <FileQuestion className="w-8 h-8 text-slate-400" />;
    }
  };

  return (
    <div className={cn("group relative rounded-2xl border border-border/10 bg-muted/20 overflow-hidden transition-all hover:shadow-lg hover:shadow-primary/5", className)}>
      {isImage ? (
        <div className="aspect-video relative overflow-hidden">
          <img 
            src={url} 
            alt={filename || "Preview"} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button 
              variant="secondary" 
              size="sm" 
              className="rounded-full h-8 w-8 p-0"
              onClick={() => setIsLightboxOpen(true)}
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
            <Button 
              variant="secondary" 
              size="sm" 
              className="rounded-full h-8 w-8 p-0"
              asChild
            >
              <a href={url} download={filename} target="_blank" rel="noopener noreferrer">
                <Download className="w-4 h-4" />
              </a>
            </Button>
          </div>
        </div>
      ) : (
        <div className="aspect-video flex flex-col items-center justify-center p-6 bg-muted/10 border-b border-border/5">
          {getFileIcon()}
          {isPdf && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="mt-4 rounded-full text-[10px] font-black uppercase tracking-widest h-8"
              onClick={() => setIsLightboxOpen(true)}
            >
              <Eye className="w-3.5 h-3.5 mr-2" /> View PDF
            </Button>
          )}
        </div>
      )}

      {showDetails && (
        <div className="p-3 bg-card/50 flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <p className="text-[10px] font-black uppercase tracking-tight truncate text-muted-foreground">
              {filename || url.split("/").pop()}
            </p>
            <p className="text-[8px] font-bold text-primary opacity-60 uppercase">{fileExtension}</p>
          </div>
          {!isImage && !isPdf && (
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full shrink-0" asChild>
              <a href={url} download={filename} target="_blank" rel="noopener noreferrer">
                <Download className="w-3.5 h-3.5" />
              </a>
            </Button>
          )}
        </div>
      )}

      {/* Lightbox / PDF Modal */}
      <AnimatePresence>
        {isLightboxOpen && (
          <div className="fixed inset-0 z-200 flex items-center justify-center p-4 md:p-10">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLightboxOpen(false)}
              className="absolute inset-0 bg-background/90 backdrop-blur-xl"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-5xl w-full max-h-full bg-card rounded-[40px] overflow-hidden border border-border/10 shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-border/10 flex items-center justify-between bg-card">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    {isImage ? <ImageIcon className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-tight">{filename || "Document Preview"}</h3>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">{fileExtension} Document</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   <Button variant="outline" size="icon" className="rounded-full" asChild>
                    <a href={url} download={filename} target="_blank" rel="noopener noreferrer">
                      <Download className="w-4 h-4" />
                    </a>
                  </Button>
                  <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setIsLightboxOpen(false)}>
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>
              
              <div className="flex-1 bg-muted/10 overflow-auto flex items-center justify-center p-4 min-h-[50vh]">
                {isImage ? (
                  <img src={url} className="max-w-full max-h-full object-contain shadow-2xl rounded-lg" alt="Full Preview" />
                ) : isPdf ? (
                  <iframe src={`${url}#toolbar=0`} className="w-full h-full min-h-[70vh] rounded-xl border-none" title="PDF Preview" />
                ) : (
                  <div className="text-center py-20">
                    {getFileIcon()}
                    <p className="mt-4 text-sm font-bold uppercase tracking-tight">Preview not available for this file type</p>
                    <Button variant="default" className="mt-6 rounded-full px-8" asChild>
                      <a href={url} download={filename}>Download File</a>
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
