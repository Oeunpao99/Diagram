/** Target page sizes for fit-to-box layout.
 *
 *  A diagram destined for a 16:9 slide, an A4 sheet or a Word page should be
 *  laid out to the *shape* of that medium. Each preset is a box in flow
 *  pixels (the same units as node positions); the layout engine reshapes,
 *  scales and centres the flow inside that box, and the export crops to it.
 */

export interface PagePreset {
  id: string;
  label: string;
  hint: string;
  width: number;
  height: number;
}

export const PAGE_PRESETS: PagePreset[] = [
  { id: "slide-16-9", label: "Slide 16:9", hint: "PowerPoint / Keynote", width: 1920, height: 1080 },
  { id: "slide-4-3", label: "Slide 4:3", hint: "Older decks", width: 1280, height: 960 },
  { id: "a4-portrait", label: "A4 portrait", hint: "Word / Google Docs", width: 794, height: 1123 },
  { id: "a4-landscape", label: "A4 landscape", hint: "Docs / reports", width: 1123, height: 794 },
  { id: "square", label: "Square 1:1", hint: "Social previews", width: 1080, height: 1080 },
];

/** The target the auto-layout should fit, or null for free-form layout. */
export interface PageTarget {
  /** Matches a `PagePreset.id` when the user picked a preset. */
  id?: string | null;
  width: number;
  height: number;
}

const PAGE_KEYS = ["page_x", "page_y", "page_width", "page_height"] as const;

/** The page box recorded in `doc.meta` by a fit-to-box layout, in flow
 *  coordinates. Returns null when no target is set. */
export function pageRectFromMeta(meta: Record<string, unknown>): {
  x: number;
  y: number;
  width: number;
  height: number;
} | null {
  const x = typeof meta.page_x === "number" ? meta.page_x : 0;
  const y = typeof meta.page_y === "number" ? meta.page_y : 0;
  const width = typeof meta.page_width === "number" ? meta.page_width : 0;
  const height = typeof meta.page_height === "number" ? meta.page_height : 0;
  if (width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}

/** Restores a `PageTarget` (dimensions + preset id, when recognisable) from
 *  the doc's meta, so the page menu reflects a saved diagram. */
export function pageTargetFromMeta(meta: Record<string, unknown>): PageTarget | null {
  const width = typeof meta.page_width === "number" ? meta.page_width : 0;
  const height = typeof meta.page_height === "number" ? meta.page_height : 0;
  if (width <= 0 || height <= 0) return null;
  const presetId = typeof meta.page_preset === "string" ? meta.page_preset : undefined;
  return { id: presetId, width, height };
}

/** Strips page-size keys from a copy of the doc's meta (used with a null
 *  target to drop the constraint). */
export function withoutPageKeys(meta: Record<string, unknown>): Record<string, unknown> {
  const next = { ...meta };
  for (const key of PAGE_KEYS) delete next[key];
  if (meta.page_preset !== undefined) delete next.page_preset;
  return next;
}