import React, { useRef, useState } from 'react';
import { Camera, X, UploadCloud, File as FileIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './button';

interface FileUploaderProps {
  onFilesSelected: (files: File[]) => void;
  maxFiles?: number;
  accept?: string;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  onFilesSelected,
  maxFiles = 5,
  accept = 'image/*,application/pdf',
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newFiles = [...selectedFiles, ...files].slice(0, maxFiles);
    setSelectedFiles(newFiles);
    onFilesSelected(newFiles);

    // Generate previews for images
    const newPreviews = files
      .filter((file) => file.type.startsWith('image/'))
      .map((file) => URL.createObjectURL(file));
    setPreviews((prev) => [...prev, ...newPreviews].slice(0, maxFiles));
  };

  const removeFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    const newPreviews = [...previews];
    
    // Revoke URL if it's an image
    if (selectedFiles[index].type.startsWith('image/')) {
        // Find which preview matches this file (this is simplified)
        // In a real app we'd map files to previews more robustly
        newPreviews.splice(index, 1);
    }

    setSelectedFiles(newFiles);
    setPreviews(newPreviews);
    onFilesSelected(newFiles);
  };

  const triggerFileSelect = () => fileInputRef.current?.click();
  const triggerCamera = () => cameraInputRef.current?.click();

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={triggerFileSelect}
          className="flex-1 h-36 flex flex-col gap-3 border-dashed border-2 hover:border-primary hover:bg-primary/5 transition-all rounded-[30px] group"
        >
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center group-hover:bg-primary/20 group-hover:text-primary transition-colors">
            <UploadCloud className="w-6 h-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-black uppercase tracking-widest">Upload Files</span>
            <span className="text-[10px] text-muted-foreground font-medium">Images or PDF</span>
          </div>
        </Button>

        <div className="flex sm:flex-col items-center justify-center px-2 py-2 sm:py-0">
            <div className="w-full sm:w-px h-px sm:h-full bg-border/50" />
            <span className="px-3 sm:px-0 py-2 text-[10px] font-black text-muted-foreground bg-background">OR</span>
            <div className="w-full sm:w-px h-px sm:h-full bg-border/50" />
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={triggerCamera}
          className="flex-1 h-36 flex flex-col gap-3 border-dashed border-2 hover:border-primary hover:bg-primary/5 transition-all rounded-[30px] group"
        >
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center group-hover:bg-primary/20 group-hover:text-primary transition-colors">
            <Camera className="w-6 h-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-black uppercase tracking-widest">Capture Photo</span>
            <span className="text-[10px] text-muted-foreground font-medium">Use Camera</span>
          </div>
        </Button>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={accept}
        multiple
        className="hidden"
      />
      <input
        type="file"
        ref={cameraInputRef}
        onChange={handleFileChange}
        accept="image/*"
        capture="environment"
        className="hidden"
      />

      <AnimatePresence>
        {selectedFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3"
          >
            {selectedFiles.map((file, index) => (
              <motion.div
                key={`${file.name}-${index}`}
                layout
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="relative group aspect-square rounded-xl overflow-hidden border bg-muted/30"
              >
                {file.type.startsWith('image/') ? (
                  <img
                    src={URL.createObjectURL(file)}
                    alt="preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center">
                    <FileIcon className="w-8 h-8 text-primary mb-1" />
                    <span className="text-[10px] truncate w-full px-1">{file.name}</span>
                  </div>
                )}
                
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {selectedFiles.length >= maxFiles && (
        <p className="text-xs text-amber-500 font-medium text-center">
          Maximum of {maxFiles} files reached.
        </p>
      )}
    </div>
  );
};
