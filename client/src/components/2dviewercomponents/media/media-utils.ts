import type { BuildingData } from "../../school-form-steps/BuildingsStep";
import { buildingName } from "../building-utils";

/** One entry of a building's `media` list (stored on the building). */
export interface MediaEntry {
  id?: string;
  path: string;
  type?: "image" | "video";
  title?: string;
  createdAt?: string;
}

/** A media file with the building it belongs to — what the viewer and gallery show. */
export interface GalleryItem {
  key: string;
  /** "" when a report was filed for the whole campus. */
  buildingId: string;
  buildingName: string;
  /** Position in the building's own media list (building photos only). */
  index: number;
  media: MediaEntry;
  /** Building photo, or a photo attached to a problem report. */
  source: "building" | "report";
  reportId?: string;
}

export const isVideoMedia = (m: Pick<MediaEntry, "type" | "path">): boolean =>
  m.type === "video" || /\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(m.path ?? "");

export const mediaTypeOf = (path: string): "image" | "video" => (isVideoMedia({ path }) ? "video" : "image");

/** Every building's media, in building order. */
export function collectMedia(buildings: BuildingData[]): GalleryItem[] {
  return buildings.flatMap((b) =>
    ((b.media ?? []) as MediaEntry[])
      .filter((m) => m?.path)
      .map((m, index) => ({
        key: `${b.id}:${index}:${m.path}`,
        buildingId: String(b.id),
        buildingName: buildingName(b),
        index,
        media: m,
        source: "building" as const,
      })),
  );
}

const IMAGE_OR_VIDEO = /\.(jpe?g|png|webp|gif|heic|heif|avif|mp4|webm|mov|ogg)(\?|#|$)/i;

/** Photos and videos attached to problem reports (PDFs and other files are left out). */
export function collectReportMedia(
  reports: Array<{ id: string; buildingId?: string | null; description?: string | null; attachments?: string[] | null; createdAt: string }>,
  buildings: BuildingData[],
): GalleryItem[] {
  const names = new Map(buildings.map((b) => [String(b.id), buildingName(b)]));
  return reports.flatMap((r) =>
    (r.attachments ?? [])
      .filter((url) => url && IMAGE_OR_VIDEO.test(url))
      .map((path, i) => {
        const buildingId = r.buildingId ? String(r.buildingId) : "";
        const desc = (r.description ?? "").trim();
        return {
          key: `report:${r.id}:${i}`,
          buildingId,
          buildingName: (buildingId && names.get(buildingId)) || "Whole campus",
          index: i,
          media: {
            path,
            type: mediaTypeOf(path),
            title: desc ? (desc.length > 60 ? `${desc.slice(0, 57)}…` : desc) : "Report photo",
            createdAt: r.createdAt,
          },
          source: "report" as const,
          reportId: r.id,
        };
      }),
  );
}

/** A readable title from a file name ("IMG_2041.jpg" → "IMG 2041"). */
export const titleFromFile = (name: string): string =>
  name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Photo";
