/**
 * Theme plumbing.
 *
 * The stylesheet defines its palette as custom properties in three places:
 * `:root` (light), `:root[data-theme="dark"]`, and a prefers-color-scheme
 * block for "system". All this module does is stamp `data-theme` / `data-accent`
 * onto <html> and keep them in sync with the OS when the choice is "system".
 */

import type { Accent, Theme } from "./api/types";

const THEME_KEY = "dc.theme";
const ACCENT_KEY = "dc.accent";

export const THEMES: { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export const ACCENTS: { value: Accent; label: string; swatch: string }[] = [
  { value: "emerald", label: "Emerald", swatch: "#0d9f6e" },
  { value: "violet", label: "Violet", swatch: "#6d5ae0" },
  { value: "blue", label: "Blue", swatch: "#2563eb" },
  { value: "amber", label: "Amber", swatch: "#b06f0e" },
  { value: "rose", label: "Rose", swatch: "#c4372f" },
];

/** Read the cached preference so the first paint is already correct. */
export function storedTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* fall through */
  }
  return "system";
}

export function storedAccent(): Accent {
  try {
    const v = localStorage.getItem(ACCENT_KEY) as Accent | null;
    if (v && ACCENTS.some((a) => a.value === v)) return v;
  } catch {
    /* fall through */
  }
  return "emerald";
}

const media = () => window.matchMedia("(prefers-color-scheme: dark)");

export function applyTheme(theme: Theme, accent: Accent) {
  const root = document.documentElement;
  const resolved = theme === "system" ? (media().matches ? "dark" : "light") : theme;

  root.setAttribute("data-theme", resolved);
  root.setAttribute("data-accent", accent);
  // Lets the browser paint form controls and scrollbars to match.
  root.style.colorScheme = resolved;

  try {
    localStorage.setItem(THEME_KEY, theme);
    localStorage.setItem(ACCENT_KEY, accent);
  } catch {
    /* preference is in-memory for this tab only */
  }
}

/** While the choice is "system", follow the OS if the user flips it. */
export function watchSystemTheme(getTheme: () => Theme, getAccent: () => Accent) {
  const mq = media();
  const handler = () => {
    if (getTheme() === "system") applyTheme("system", getAccent());
  };
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}
