import { create } from "zustand";

export type SettingsSection = "profile" | "appearance" | "customization" | "extensions";

export interface CanvasPrefs {
  minimap: boolean;
  grid: boolean;
  snap: boolean;
  autosave: boolean;
}

export interface ExtensionPrefs {
  mermaidPdfExport: boolean;
  presentation: boolean;
  canvasComments: boolean;
  smartSpellcheck: boolean;
}

const PREFS_KEY = "dc.canvas-prefs";
const EXT_KEY = "dc.extensions";

function load<T>(key: string, fallback: T, clamp: (v: T) => boolean): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return clamp(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* in-memory only */
  }
}

const isPrefs = (v: CanvasPrefs) =>
  typeof v?.minimap === "boolean" && typeof v?.grid === "boolean" && typeof v?.snap === "boolean";

const isExtensions = (v: ExtensionPrefs) =>
  typeof v?.mermaidPdfExport === "boolean" && typeof v?.presentation === "boolean";

export const DEFAULT_PREFS: CanvasPrefs = { minimap: true, grid: true, snap: true, autosave: true };
export const DEFAULT_EXTENSIONS: ExtensionPrefs = {
  mermaidPdfExport: true,
  presentation: false,
  canvasComments: true,
  smartSpellcheck: true,
};

interface SettingsState {
  open: boolean;
  section: SettingsSection;
  prefs: CanvasPrefs;
  extensions: ExtensionPrefs;

  openSettings: (section?: SettingsSection) => void;
  closeSettings: () => void;
  setSection: (section: SettingsSection) => void;
  setPref: (key: keyof CanvasPrefs, value: boolean) => void;
  setExtension: (key: keyof ExtensionPrefs, value: boolean) => void;
}

export const useSettings = create<SettingsState>((set, get) => ({
  open: false,
  section: "profile",
  prefs: load(PREFS_KEY, DEFAULT_PREFS, isPrefs),
  extensions: load(EXT_KEY, DEFAULT_EXTENSIONS, isExtensions),

  openSettings(section) {
    set({ open: true, section: section ?? get().section });
  },
  closeSettings: () => set({ open: false }),
  setSection: (section) => set({ section }),

  setPref(key, value) {
    const prefs = { ...get().prefs, [key]: value };
    save(PREFS_KEY, prefs);
    set({ prefs });
  },
  setExtension(key, value) {
    const extensions = { ...get().extensions, [key]: value };
    save(EXT_KEY, extensions);
    set({ extensions });
  },
}));