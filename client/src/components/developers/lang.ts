import { createContext, useContext } from "react";

/** Languages every example on the developer guide is written in. */
export const LANGS = ["curl", "Node.js", "Python", "PHP"] as const;
export type Lang = (typeof LANGS)[number];

const STORAGE_KEY = "rtbgis.developers.lang";

export function readLang(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && (LANGS as readonly string[]).includes(v)) return v as Lang;
  } catch {
    /* storage blocked */
  }
  return "curl";
}

export function saveLang(lang: Lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* storage blocked */
  }
}

/** The reader's language, shared by every code sample on the page. */
export const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: "curl", setLang: () => undefined });
export const useLang = () => useContext(LangContext);
