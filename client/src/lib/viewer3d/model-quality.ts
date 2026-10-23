/**
 * Detail measurement of a school's 3D model, from GET /kmz/status
 * (server/glb-tools/quality.mjs): centimetres of real surface per texture
 * pixel. Lower is sharper; a good drone survey reaches about 2 cm.
 */
export interface ModelQualityMeasure {
  triangles?: number;
  surfaceM2?: number;
  cmPerPixel?: {
    horizontal?: { median: number | null; p90: number | null };
    vertical?: { median: number | null; p90: number | null };
    overall?: { median: number | null; p90: number | null };
  };
  score?: "sharp" | "fair" | "low" | "unknown";
  precompressed?: boolean;
  warnings?: string[];
}

export interface ModelQuality {
  served?: ModelQualityMeasure | null;
  source?: ModelQualityMeasure | null;
  profile?: "standard" | "low-memory" | "measured";
  measuredAt?: string;
}

/** Headline figure: median cm/px on ground and roofs (else overall). */
export function detailCm(q: ModelQuality | null | undefined): number | null {
  const m = q?.served?.cmPerPixel;
  return m?.horizontal?.median ?? m?.overall?.median ?? null;
}

export const DETAIL_LABEL: Record<string, string> = {
  sharp: "Sharp",
  fair: "Fair",
  low: "Low detail",
  unknown: "Not measured",
};

/** Plain-word explanation for a tooltip. */
export function detailExplanation(q: ModelQuality | null | undefined): string {
  const cm = detailCm(q);
  if (cm == null) return "Detail not measured yet.";
  const walls = q?.served?.cmPerPixel?.vertical?.median;
  const lines = [
    `Each texture pixel covers about ${cm.toFixed(1)} cm of ground and roofs${walls != null ? ` and ${walls.toFixed(1)} cm of walls` : ""}. A sharp survey is about 2 cm.`,
    ...(q?.served?.warnings ?? []),
  ];
  return lines.join("\n");
}
