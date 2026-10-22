import { useEffect, useRef } from "react";
import Overlay from "ol/Overlay";
import { fromLonLat } from "ol/proj";
import type { Map as OLMap } from "ol";
import type { BuildingData } from "../../school-form-steps/BuildingsStep";
import type { BuildingReportCount } from "./useSchoolReports";

interface UseReportIndicatorsOptions {
  mapRef: React.MutableRefObject<OLMap | null>;
  mapReady: boolean;
  schoolBuildings: BuildingData[];
  /** Open reports per building (shared with the list and the panel). */
  counts: Map<string, BuildingReportCount>;
  showIndicators: boolean;
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
      min-width: 22px;
      height: 22px;
      padding: 0 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 0 2px rgba(255,255,255,.95), 0 4px 14px -4px rgba(15,23,42,.55);
      pointer-events: auto;
      cursor: default;
      white-space: nowrap;
      transition: transform .2s cubic-bezier(.22,1,.36,1);
      animation: ri-pop .35s cubic-bezier(.22,1,.36,1);
    }
    .ri-badge:hover { transform: translate(-50%, -50%) scale(1.12); }
    .ri-badge span {
      color: white;
      font-size: 11px;
      font-weight: 500;
      line-height: 1;
      font-variant-numeric: tabular-nums;
      font-family: inherit;
    }
    @keyframes ri-pop {
      from { transform: translate(-50%, -50%) scale(.4); opacity: 0; }
      to   { transform: translate(-50%, -50%) scale(1); opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce) {
      .ri-pulse, .ri-pulse-2, .ri-badge { animation: none; }
      .ri-pulse-2 { display: none; }
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
  // Brand primary (darker when something needs action), like the rest of the map.
  const color = critical > 0 ? "#1d4ed8" : "#2563eb";
  const total = critical + pending;

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

  const countSpan = document.createElement("span");
  countSpan.textContent = String(total);
  badge.title = [critical && `${critical} need action`, pending && `${pending} waiting`].filter(Boolean).join(" · ");
  badge.setAttribute("role", "button");
  badge.setAttribute("aria-label", `${total} open report${total === 1 ? "" : "s"}`);

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
  schoolBuildings,
  counts,
  showIndicators,
  onBuildingClick,
}: UseReportIndicatorsOptions) {
  const overlaysRef = useRef<Overlay[]>([]);
  const clickRef = useRef(onBuildingClick);
  const showRef = useRef(showIndicators);

  useEffect(() => {
    clickRef.current = onBuildingClick;
    showRef.current = showIndicators;
  });

  const clearOverlays = () => {
    const map = mapRef.current;
    overlaysRef.current.forEach((ov) => {
      if (map) map.removeOverlay(ov);
      const el = ov.getElement();
      if (el?.parentNode) el.parentNode.removeChild(el);
    });
    overlaysRef.current = [];
  };

  // Rebuild the badges whenever the counts or the buildings change — always
  // clearing first, so a building whose reports were all closed loses its badge.
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    injectStyles();
    clearOverlays();

    counts.forEach(({ action, waiting }, buildingId) => {
      const building = schoolBuildings.find((b) => String(b.id) === buildingId);
      if (!building?.geolocation?.latitude || !building?.geolocation?.longitude) return;

      const el = createIndicatorElement(buildingId, action, waiting, (id) => clickRef.current?.(id));
      el.style.display = showRef.current ? "block" : "none";

      const overlay = new Overlay({
        element: el,
        position: fromLonLat([Number(building.geolocation.longitude), Number(building.geolocation.latitude)]),
        positioning: "center-center",
        stopEvent: true,
      });
      map.addOverlay(overlay);
      overlaysRef.current.push(overlay);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, schoolBuildings, counts]);

  // Toggle visibility without rebuilding
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
