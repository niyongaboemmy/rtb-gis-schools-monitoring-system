import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "./button";
import { Modal } from "./modal";

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  isLoading?: boolean;
}

/**
 * Destructive confirmation, built on <Modal>: rendered on <body> (never
 * clipped by a glass panel), focus-trapped, Esc closes, bottom sheet on phones.
 */
export function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Delete this record?",
  description = "This can't be undone. The deletion is recorded in the audit trail.",
  confirmLabel = "Delete",
  isLoading = false,
}: DeleteConfirmationModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isLoading) onClose();
      }}
      title={title}
      maxWidth="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isLoading} className="h-10 rounded-full px-4 text-sm">
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            isLoading={isLoading}
            className="h-10 gap-1.5 rounded-full px-5 text-sm font-medium"
          >
            {!isLoading && <Trash2 className="h-4 w-4" aria-hidden />}
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-4 py-2">
        <span
          aria-hidden
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-destructive/12 text-destructive ring-1 ring-inset ring-destructive/20"
        >
          <AlertTriangle className="h-5 w-5" />
        </span>
        <p className="min-w-0 pt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
    </Modal>
  );
}
