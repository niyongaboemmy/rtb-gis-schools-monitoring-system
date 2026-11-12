import { createContext, useContext } from "react";

/** The embedded views (mirrors server partner-embed.ts EMBED_VIEWS). */
export type EmbedView = "school-dashboard" | "school-map-2d" | "school-map-3d" | "national-map" | "national-dashboard";

/**
 * Set inside an embedded view (/embed/*): the one view this page is. Viewers
 * use it to hide what belongs to other views (2D ↔ 3D switch, dashboard tab).
 * null everywhere else in the app.
 */
export const EmbedViewContext = createContext<EmbedView | null>(null);

export const useEmbedView = (): EmbedView | null => useContext(EmbedViewContext);
