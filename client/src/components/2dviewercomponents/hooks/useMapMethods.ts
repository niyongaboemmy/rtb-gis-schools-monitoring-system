import { useCallback } from "react";
import Feature from "ol/Feature";
import { kmlSelectedStyle, getFeatureName } from "../MapUtils";

interface UseMapMethodsProps {
  mapRef: React.MutableRefObject<any>;
  selectedFeatureRef: React.MutableRefObject<Feature | null>;
  setSelectedFeatureName: (name: string | null) => void;
}

export function useMapMethods({
  mapRef,
  selectedFeatureRef,
  setSelectedFeatureName,
}: UseMapMethodsProps) {
  
  const flyToFeature = useCallback((feature: Feature) => {
    const map = mapRef.current;
    if (!map || !feature) return;
    const geom = feature.getGeometry();
    if (!geom) return;

    if (selectedFeatureRef.current && selectedFeatureRef.current !== feature) {
      selectedFeatureRef.current.setStyle(undefined);
    }
    feature.setStyle(kmlSelectedStyle);
    selectedFeatureRef.current = feature;
    setSelectedFeatureName(getFeatureName(feature) ?? null);

    const extent = geom.getExtent();
    if (extent[0] !== Infinity) {
      map.getView().fit(extent, {
        padding: [100, 100, 100, 100],
        duration: 1000,
        maxZoom: 21,
      });
    }
  }, [mapRef, selectedFeatureRef, setSelectedFeatureName]);

  const exportPng = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.once("rendercomplete", () => {
      const canvas = document.createElement("canvas");
      const size = map.getSize()!;
      canvas.width = size[0];
      canvas.height = size[1];
      const ctx = canvas.getContext("2d")!;
      Array.from(document.querySelectorAll(".ol-layer canvas") as NodeListOf<HTMLCanvasElement>).forEach((c) => {
        if (c.width > 0) {
          ctx.globalAlpha = parseFloat(c.style.opacity) || 1;
          ctx.drawImage(c, 0, 0);
        }
      });
      const link = document.createElement("a");
      link.href = canvas.toDataURL();
      link.download = `school-map-${Date.now()}.png`;
      link.click();
    });
    map.renderSync();
  }, [mapRef]);

  return { flyToFeature, exportPng };
}
