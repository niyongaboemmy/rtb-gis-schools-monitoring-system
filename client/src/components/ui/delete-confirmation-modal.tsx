import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, Trash2 } from "lucide-react";
import { Button } from "./button";
import { cn } from "../../lib/utils";
import { ImigongoPattern } from "./ImigongoPattern";

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  isLoading?: boolean;
}

export function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Deletion",
  description = "Are you sure you want to permanently delete this record? This action cannot be undone and will be logged in the system.",
  confirmLabel = "Delete Permanently",
  isLoading = false,
}: DeleteConfirmationModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-200 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-background/80 backdrop-blur-xl"
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative bg-card rounded-[40px] border border-border/20 max-w-md w-full z-200 overflow-hidden"
          >
            <ImigongoPattern className="absolute inset-0 text-rose-500 pointer-events-none opacity-[0.03]" />
            
            <div className="p-8 text-center space-y-6 relative z-10">
              <div className="w-20 h-20 rounded-[30px] bg-rose-500/10 flex items-center justify-center mx-auto text-rose-500">
                <AlertTriangle className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-black uppercase tracking-tighter leading-none">
                  {title}
                </h3>
                <p className="text-[10px] font-black text-muted-foreground uppercase opacity-60 tracking-widest leading-relaxed">
                  {description}
                </p>
              </div>

              <div className="flex flex-col gap-3 pt-4">
                <Button
                  onClick={onConfirm}
                  disabled={isLoading}
                  className={cn(
                    "rounded-full h-14 text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 bg-rose-600 hover:bg-rose-700 text-white"
                  )}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Processing...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Trash2 className="w-4 h-4" /> {confirmLabel}
                    </div>
                  )}
                </Button>
                
                <Button
                  variant="ghost"
                  onClick={onClose}
                  disabled={isLoading}
                  className="rounded-full h-12 text-[10px] font-black uppercase tracking-widest opacity-60 hover:opacity-100 transition-all"
                >
                  Cancel Action
                </Button>
              </div>
            </div>

            <button
              onClick={onClose}
              className="absolute top-6 right-6 p-2 rounded-full hover:bg-muted/50 transition-all"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
