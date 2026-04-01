import { useEffect, useRef } from "react";
import Overlay from "ol/Overlay";
import { fromLonLat } from "ol/proj";
import type { Map as OLMap } from "ol";
import { api } from "../../../lib/api";
import type { BuildingData } from "../../school-form-steps/BuildingsStep";

interface UseReportIndicatorsOptions {
  mapRef: React.MutableRefObject<OLMap | null>;
  mapReady: boolean;
  schoolId: string;
  schoolBuildings: BuildingData[];
  showIndicators: boolean;
  refreshKey?: number;
  onBuildingClick?: (buildingId: string) => void;
}

const STYLE_ID = "report-indicators-style";

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .ri-root {
      position: relative;
      width: 40px;
      height: 40px;
      pointer-events: none;
    }
    .ri-pulse {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 2px solid currentColor;
      opacity: 0.7;
      animation: ri-pulse-anim 1.8s ease-out infinite;
    }
    .ri-pulse-2 {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 2px solid currentColor;
      opacity: 0.4;
      animation: ri-pulse-anim 1.8s ease-out infinite 0.6s;
    }
    .ri-badge {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: currentColor;
      border-radius: 9999px;
      padding: 3px 7px;
      display: flex;
      align-items: center;
      gap: 3px;
      box-shadow: 0 2px 10px rgba(0,0,0,.35);
      pointer-events: auto;
      cursor: default;
      white-space: nowrap;
    }
    .ri-badge span {
      color: white;
      font-size: 9px;
      font-weight: 700;
      line-height: 1;
      font-family: system-ui, sans-serif;
    }
    @keyframes ri-pulse-anim {
      0%   { transform: scale(1);   opacity: 0.7; }
      70%  { transform: scale(2.4); opacity: 0; }
      100% { transform: scale(2.4); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

function createIndicatorElement(
  buildingId: string,
  critical: number,
  pending: number,
  onBuildingClick?: (id: string) => void,
): HTMLDivElement {
  const color = critical > 0 ? "#f43f5e" : "#f59e0b";
  const total = critical + pending;
  const icon = critical > 0 ? "⚠" : "◷";

  const root = document.createElement("div");
  root.className = "ri-root";
  root.dataset.buildingId = buildingId;
  root.style.color = color;

  const ring1 = document.createElement("div");
  ring1.className = "ri-pulse";

  const ring2 = document.createElement("div");
  ring2.className = "ri-pulse-2";

  const badge = document.createElement("div");
  badge.className = "ri-badge";

  const iconSpan = document.createElement("span");
  iconSpan.textContent = icon;

  const countSpan = document.createElement("span");
  countSpan.textContent = String(total);

  badge.appendChild(iconSpan);
  badge.appendChild(countSpan);
  root.appendChild(ring1);
  root.appendChild(ring2);
  root.appendChild(badge);

  if (onBuildingClick) {
    badge.style.cursor = "pointer";
    badge.addEventListener("click", (e) => {
      e.stopPropagation();
      onBuildingClick(buildingId);
    });
  }

  return root;
}

export function useReportIndicators({
  mapRef,
  mapReady,
  schoolId,
  schoolBuildings,
  showIndicators,
  refreshKey = 0,
  onBuildingClick,
}: UseReportIndicatorsOptions) {
  const overlaysRef = useRef<Overlay[]>([]);

  // Cleanup helper
  const clearOverlays = () => {
    const map = mapRef.current;
    overlaysRef.current.forEach((ov) => {
      if (map) map.removeOverlay(ov);
      const el = ov.getElement();
      if (el?.parentNode) el.parentNode.removeChild(el);
    });
    overlaysRef.current = [];
  };

  // Fetch + build overlays whenever map/buildings are ready
  useEffect(() => {
    if (!mapReady || !schoolId || schoolBuildings.length === 0) return;
    const map = mapRef.current;
    if (!map) return;

    injectStyles();

    let cancelled = false;

    api
      .get("/reports", { params: { schoolId } })
      .then(({ data }) => {
        if (cancelled) return;

        const reports: Array<{ buildingId: string; status: string }> =
          data.data || [];

        // Group active reports by buildingId
        const counts = new Map<
          string,
          { critical: number; pending: number }
        >();
        reports.forEach((r) => {
          if (
            r.status !== "NEED_INTERVENTION" &&
            r.status !== "PENDING"
          )
            return;
          const existing = counts.get(r.buildingId) ?? {
            critical: 0,
            pending: 0,
          };
          if (r.status === "NEED_INTERVENTION") existing.critical++;
          else existing.pending++;
          counts.set(r.buildingId, existing);
        });

        if (counts.size === 0) return;

        clearOverlays();

        counts.forEach(({ critical, pending }, buildingId) => {
          const building = schoolBuildings.find((b) => b.id === buildingId);
          if (
            !building?.geolocation?.latitude ||
            !building?.geolocation?.longitude
          )
            return;

          const el = createIndicatorElement(buildingId, critical, pending, onBuildingClick);
          el.style.display = showIndicators ? "block" : "none";

          const coord = fromLonLat([
            Number(building.geolocation.longitude),
            Number(building.geolocation.latitude),
          ]);

          const overlay = new Overlay({
            element: el,
            position: coord,
            positioning: "center-center",
            stopEvent: true,
          });

          map.addOverlay(overlay);
          overlaysRef.current.push(overlay);
        });
      })
      .catch((err) => {
        if (!cancelled)
          console.error("Failed to fetch report indicators:", err);
      });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, schoolId, schoolBuildings, refreshKey]);

  // Toggle visibility without re-fetching
  useEffect(() => {
    overlaysRef.current.forEach((ov) => {
      const el = ov.getElement();
      if (el) el.style.display = showIndicators ? "block" : "none";
    });
  }, [showIndicators]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearOverlays();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
