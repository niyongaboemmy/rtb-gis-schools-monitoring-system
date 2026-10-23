/**
 * The school's current 3D model: `kmzFilePath` when it is a GLB (uploads stopped
 * creating building rows long ago), else a legacy building `modelPath`.
 */
export function existing3dModel(school: {
  kmzFilePath?: string | null;
  buildings?: Array<{ modelPath?: string | null }> | null;
}): string | null {
  const isGlb = (p?: string | null) => !!p && /\.glb(\?|$)/i.test(p);
  if (isGlb(school.kmzFilePath)) return school.kmzFilePath!;
  return school.buildings?.find((b) => isGlb(b.modelPath))?.modelPath ?? null;
}
