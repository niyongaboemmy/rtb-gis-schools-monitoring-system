import React from 'react';

interface ViewerAnnotationDialogProps {
  annotInput: string;
  annotColor: string;
  editAnnotId: string | null;
  annotColors: string[];
  setAnnotInput: (val: string) => void;
  setAnnotColor: (val: string) => void;
  submitAnnotation: () => void;
  cancelAnnotation: () => void;
}

export const ViewerAnnotationDialog: React.FC<ViewerAnnotationDialogProps> = ({
  annotInput,
  annotColor,
  editAnnotId,
  annotColors,
  setAnnotInput,
  setAnnotColor,
  submitAnnotation,
  cancelAnnotation,
}) => {
  return (
    <div className="annot-dialog">
      <div className="ad-title">🏷 {editAnnotId ? "Edit annotation" : "Add annotation"}</div>

      <div className="ad-colors">
        {annotColors.map(c => (
          <button key={c} className={`ad-color-btn ${annotColor === c ? 'active' : ''}`} style={{ background: c }} onClick={() => setAnnotColor(c)} />
        ))}
      </div>

      <textarea className="ad-textarea" placeholder="Type your note…" value={annotInput} autoFocus
        style={{ color: annotColor }}
        onChange={e => setAnnotInput(e.target.value)}
        onKeyDown={e => { 
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitAnnotation(); } 
          if (e.key === "Escape") { cancelAnnotation(); } 
        }} />
      <div className="ad-row">
        <button className="ad-cancel" onClick={cancelAnnotation}>Cancel</button>
        <button className="ad-save" onClick={submitAnnotation}>Save</button>
      </div>
    </div>
  );
};

export default React.memo(ViewerAnnotationDialog);
