import { createContext } from "react";

/**
 * DOM node inside the Settings hero where the active tab may portal a
 * summary (stat tiles). Null when there is no hero (tab rendered alone).
 */
export const HeroSlotContext = createContext<HTMLElement | null>(null);
