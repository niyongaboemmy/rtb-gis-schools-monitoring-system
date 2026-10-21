import { useMemo, useState } from "react";
import { Circle, Marker, Tooltip, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { PRIORITY_META, priorityMeta, schoolPulseIcon } from "../../maps/schoolMap";
import { gridCluster } from "../geo";
import type { PlottedSchool } from "../types";
import { formatScore } from "../../../lib/format";

/* Icons are cached: a new icon object per render would make Leaflet rebuild the DOM node. */
const iconCache = new Map<string, L.DivIcon>();
function pinIcon(priority: string, selected: boolean, hover: boolean) {
  const key = `${priority}|${selected}|${hover}`;
  let icon = iconCache.get(key);
  if (!icon) {
    const base = schoolPulseIcon(priority, 18, selected);
    icon = L.divIcon({
      ...base.options,
      className: `${base.options.className ?? ""}${hover ? " nm-pin--hover" : ""}`,
    });
    iconCache.set(key, icon);
  }
  return icon;
}

const KEYS = ["critical", "high", "medium", "low"] as const;

function clusterIcon(items: PlottedSchool[]) {
  const counts = KEYS.map((k) => items.filter((p) => p.priority === k).length);
  const other = items.length - counts.reduce((a, b) => a + b, 0);
  const stops: string[] = [];
  let at = 0;
  const push = (n: number, color: string) => {
    if (!n) return;
    const end = at + (n / items.length) * 360;
    stops.push(`${color} ${at}deg ${end}deg`);
    at = end;
  };
  KEYS.forEach((k, i) => push(counts[i], PRIORITY_META[k].color));
  push(other, "#64748b");
  const size = Math.round(34 + Math.min(22, Math.log2(items.length) * 6));
  return L.divIcon({
    className: "nm-cluster",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<span class="nm-cluster__ring" style="--nm-mix:conic-gradient(${stops.join(",")})"></span><span class="nm-cluster__core">${items.length}</span>`,
  });
}

interface Props {
  points: PlottedSchool[];
  selectedId: string | null;
  hoverId: string | null;
  /** Legend spotlight: pins outside this band fade back. */
  focusBand: string | null;
  cluster: boolean;
  density: boolean;
  onSelect: (p: PlottedSchool) => void;
  onHover: (id: string | null) => void;
}

/** School pins (or grid clusters at low zoom) plus an optional density glow. */
export function SchoolLayer({
  points,
  selectedId,
  hoverId,
  focusBand,
  cluster,
  density,
  onSelect,
  onHover,
}: Props) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });

  const { singles, groups } = useMemo(() => {
    if (!cluster || zoom >= 14) return { singles: points, groups: [] as PlottedSchool[][] };
    const z = Math.round(zoom);
    const free = points.filter((p) => p.school.id !== selectedId);
    const clusters = gridCluster(
      free.map((p) => {
        const pt = map.project([p.lat, p.lng], z);
        return { item: p, x: pt.x, y: pt.y };
      }),
      60,
    );
    const singlesOut = points.filter((p) => p.school.id === selectedId);
    const groupsOut: PlottedSchool[][] = [];
    for (const c of clusters) {
      if (c.items.length === 1) singlesOut.push(c.items[0]);
      else groupsOut.push(c.items);
    }
    return { singles: singlesOut, groups: groupsOut };
  }, [cluster, zoom, points, selectedId, map]);

  return (
    <>
      {density &&
        points.map((p) => (
          <Circle
            key={`d-${p.school.id}`}
            center={[p.lat, p.lng]}
            radius={9000}
            pathOptions={{
              pane: "nm-density",
              stroke: false,
              fillColor: priorityMeta(p.priority).color,
              fillOpacity: 0.16,
              interactive: false,
            }}
          />
        ))}

      {groups.map((items) => {
        const lat = items.reduce((s, p) => s + p.lat, 0) / items.length;
        const lng = items.reduce((s, p) => s + p.lng, 0) / items.length;
        const key = items.map((p) => p.school.id).sort().join("|");
        return (
          <Marker
            key={`c-${key}`}
            position={[lat, lng]}
            icon={clusterIcon(items)}
            opacity={focusBand && !items.some((p) => p.priority === focusBand) ? 0.25 : 1}
            eventHandlers={{
              add: (e) => {
                const el = (e.target as L.Marker).getElement();
                el?.setAttribute("aria-label", `${items.length} schools — zoom in`);
              },
              click: () => {
                const b = L.latLngBounds(items.map((p) => [p.lat, p.lng] as L.LatLngTuple));
                if (b.getNorthEast().equals(b.getSouthWest())) map.setView(b.getCenter(), zoom + 2);
                else map.fitBounds(b.pad(0.3), { maxZoom: Math.min(16, zoom + 4) });
              },
            }}
          >
            <Tooltip className="scm-tip" direction="top" offset={[0, -14]}>
              <span className="text-[11px]">
                {items.length} schools · click to zoom in
              </span>
            </Tooltip>
          </Marker>
        );
      })}

      {singles.map((p) => {
        const isSel = p.school.id === selectedId;
        const isHover = p.school.id === hoverId;
        const dim = (!!hoverId && !isHover && !isSel) || (!!focusBand && p.priority !== focusBand && !isSel);
        const m = priorityMeta(p.priority);
        return (
          <Marker
            key={p.school.id}
            position={[p.lat, p.lng]}
            icon={pinIcon(p.priority, isSel, isHover)}
            opacity={dim ? (focusBand ? 0.2 : 0.35) : 1}
            zIndexOffset={isSel ? 1000 : isHover ? 900 : 0}
            eventHandlers={{
              add: (e) => {
                const el = (e.target as L.Marker).getElement();
                el?.setAttribute("aria-label", `${p.school.name}, ${m.label} priority`);
                el?.setAttribute("data-tooltip", "off");
              },
              click: () => onSelect(p),
              mouseover: () => onHover(p.school.id),
              mouseout: () => onHover(null),
            }}
          >
            <Tooltip className="scm-tip" direction="top" opacity={1} offset={[0, -4]}>
              <span className="flex items-center gap-2">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: m.color, boxShadow: `0 0 6px ${m.color}` }}
                />
                <span className="text-xs font-semibold">{p.school.name}</span>
                <span className="text-[11px] tabular-nums opacity-60">{formatScore(p.score)}</span>
              </span>
            </Tooltip>
          </Marker>
        );
      })}
    </>
  );
}
