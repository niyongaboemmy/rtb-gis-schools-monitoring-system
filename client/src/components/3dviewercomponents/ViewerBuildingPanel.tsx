import React from 'react';

interface ViewerBuildingPanelProps {
  building: any;
  onClose: () => void;
}

export const ViewerBuildingPanel: React.FC<ViewerBuildingPanelProps> = ({ building, onClose }) => {
  const name = building.name || building.buildingName || 'Unnamed Block';
  const code = building.code || building.buildingCode || null;
  const condition = building.condition || building.buildingCondition || null;
  const fn = building.function || null;
  const floors = building.floors != null ? building.floors : null;
  const area = building.area != null ? building.area : null;
  const yearBuilt = building.yearBuilt || null;
  const roofCondition = building.roofCondition || null;
  const structuralScore = building.structuralScore != null ? building.structuralScore : null;
  const notes = building.notes || null;
  const annotCount = (building.annotations?.length || 0);

  const conditionColor: Record<string, string> = {
    good: '#10b981',
    fair: '#3b82f6',
    poor: '#f59e0b',
    critical: '#ef4444',
  };
  const condColor = condition ? (conditionColor[condition.toLowerCase()] || '#60a5fa') : '#60a5fa';

  return (
    <div className="bld-panel">
      <div className="bld-panel-header">
        <div className="bld-panel-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
        </div>
        <div className="bld-panel-title">
          <div className="bld-panel-name">{name}</div>
          {code && <div className="bld-panel-code">{code}</div>}
        </div>
        <button className="bld-panel-close" onClick={onClose} title="Close">✕</button>
      </div>

      <div className="bld-panel-body">
        {condition && (
          <div className="bld-info-row">
            <span className="bld-info-label">Condition</span>
            <span className="bld-info-badge" style={{ color: condColor, borderColor: condColor + '44', backgroundColor: condColor + '18' }}>
              {condition}
            </span>
          </div>
        )}
        {fn && (
          <div className="bld-info-row">
            <span className="bld-info-label">Function</span>
            <span className="bld-info-val">{fn}</span>
          </div>
        )}
        {floors != null && (
          <div className="bld-info-row">
            <span className="bld-info-label">Floors</span>
            <span className="bld-info-val">{floors}</span>
          </div>
        )}
        {area != null && (
          <div className="bld-info-row">
            <span className="bld-info-label">Floor Area</span>
            <span className="bld-info-val">{area} m²</span>
          </div>
        )}
        {yearBuilt && (
          <div className="bld-info-row">
            <span className="bld-info-label">Year Built</span>
            <span className="bld-info-val">{yearBuilt}</span>
          </div>
        )}
        {roofCondition && (
          <div className="bld-info-row">
            <span className="bld-info-label">Roof</span>
            <span className="bld-info-val">{roofCondition}</span>
          </div>
        )}
        {structuralScore != null && (
          <div className="bld-info-row">
            <span className="bld-info-label">Structural Score</span>
            <span className="bld-info-val">{structuralScore}</span>
          </div>
        )}
        {annotCount > 0 && (
          <div className="bld-info-row">
            <span className="bld-info-label">Annotations</span>
            <span className="bld-info-badge" style={{ color: '#a855f7', borderColor: '#a855f744', backgroundColor: '#a855f718' }}>
              {annotCount}
            </span>
          </div>
        )}
        {notes && (
          <div className="bld-info-notes">
            <div className="bld-info-label" style={{ marginBottom: 4 }}>Notes</div>
            <div className="bld-notes-text">{notes}</div>
          </div>
        )}
        {!condition && !floors && !area && !yearBuilt && !fn && !roofCondition && (
          <div className="bld-no-data">No additional details available.</div>
        )}
      </div>
    </div>
  );
};

export default React.memo(ViewerBuildingPanel);
