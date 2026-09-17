import type { NodeKind } from "../api/types";

export interface ResolvedColor {
  bg: string;
  line: string;
  ink: string;
}

/** Per-node colour palette. Picked in the selection toolbar and stored in
 *  `node.style.color`; undefined keeps the default theme look. A raw `#hex`
 *  is also accepted for arbitrary custom colours.
 *
 *  Full-strength fill, not a pastel tint — `bg` is the saturated colour
 *  itself (what used to live in `line`), `line` is a darker shade of that
 *  same hue for the border, and `ink` is white so it reads against the
 *  now-solid background, the same treatment the start/end pills already use. */
export const NODE_COLORS: Record<string, ResolvedColor> = {
  teal: { bg: "#0d9488", line: "#0b423d", ink: "#ffffff" },
  emerald: { bg: "#0d9f6e", line: "#0a4a36", ink: "#ffffff" },
  blue: { bg: "#2563eb", line: "#173b78", ink: "#ffffff" },
  indigo: { bg: "#4f46e5", line: "#2a2268", ink: "#ffffff" },
  violet: { bg: "#6d5ae0", line: "#33246b", ink: "#ffffff" },
  fuchsia: { bg: "#c026d3", line: "#73177e", ink: "#ffffff" },
  rose: { bg: "#c4372f", line: "#6b140f", ink: "#ffffff" },
  orange: { bg: "#ea7a10", line: "#6b3006", ink: "#ffffff" },
  amber: { bg: "#b06f0e", line: "#5a3a06", ink: "#ffffff" },
  slate: { bg: "#5b6b7b", line: "#1e293b", ink: "#ffffff" },
};

function hexRgb(hex: string): [number, number, number] | null {
  let h = hex.replace("#", "");
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixToward(rgb: [number, number, number], target: number, amount: number): string {
  const mixed = rgb.map((ch) => Math.round(ch + (target - ch) * amount));
  const [r, g, b] = mixed;
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Each diagram family gets its own laid-back accent palette, so a process
 *  flow, an org chart and a network read as different "worlds" at a glance
 *  even before you look at the shapes. Only applies when the user hasn't
 *  pinned an explicit colour on the node. */
export const TYPE_DEFAULT: Record<string, ResolvedColor> = {
  process_flow: { bg: "#f2effc", line: "#7a6be0", ink: "#2c2360" },
  swimlane: { bg: "#eef3fc", line: "#4f7fce", ink: "#22406f" },
  architecture: { bg: "#eef1f6", line: "#4f637c", ink: "#1f2c3d" },
  network: { bg: "#e6f3f4", line: "#2b8a94", ink: "#145760" },
  sequence: { bg: "#f8f0de", line: "#b0781f", ink: "#5c3f0c" },
  er: { bg: "#fae9f1", line: "#b84b78", ink: "#5c213e" },
  data_flow: { bg: "#e2f4ec", line: "#1d9a6c", ink: "#10503a" },
  org_chart: { bg: "#faece3", line: "#c1763a", ink: "#5c2e0e" },
  mind_map: { bg: "#fae8e6", line: "#c6574f", ink: "#5c201b" },
  tree: { bg: "#e5f3ec", line: "#1f9d6e", ink: "#0f4b34" },
};

/** Kinds that adopt the family accent — the "meat" boxes. The rest stay
 *  semantic: start/end pills, the amber decision, green data/DB, actors and
 *  dashed notes. */
export const TINTED_KINDS: ReadonlySet<NodeKind> = new Set([
  "process",
  "system",
  "service",
  "cloud",
  "document",
  "queue",
  "circle",
  "hexagon",
  "octagon",
  "triangle",
  "pentagon",
  "star",
  "tag",
  "arrow",
]);

/** Resolves what colour a node actually renders in — an explicit
 *  `style.color` (a named swatch or a raw hex), a diagram-type accent for
 *  the kinds that adopt one, or `undefined` for the plain CSS-driven default
 *  look (the amber decision, the green database, …).
 *
 *  Shared by the live canvas (nodes.tsx) and the rehearsal sketch
 *  (RehearsalOverlay.tsx) so a node's colour is never resolved two different
 *  ways — a sketch that filled in a different colour than the node's real
 *  one would flash to the actual colour the instant the rehearsal hands off
 *  to the live canvas, undermining the one thing a "reveal" is supposed to
 *  do (show you the real result, not a placeholder that then changes). */
export function resolveNodeColor(
  kind: NodeKind,
  color: string | null | undefined,
  hasImage: boolean,
  diagramType?: string,
): ResolvedColor | undefined {
  const key = typeof color === "string" ? color : null;
  if (key && key in NODE_COLORS) return NODE_COLORS[key];
  if (key?.startsWith("#")) {
    const rgb = hexRgb(key);
    if (rgb) {
      // Full-strength, same as the named swatches: the picked colour is the
      // fill itself, not lightened into a tint. Luma is read off that same
      // fill (not some other mix of it), so the dark/light ink split it
      // drives actually matches what's behind the text.
      const luma = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
      return {
        bg: key,
        line: mixToward(rgb, 0, 0.35),
        ink: luma > 150 ? "#1e293b" : "#ffffff",
      };
    }
  }
  if (diagramType && !hasImage && TINTED_KINDS.has(kind)) {
    return TYPE_DEFAULT[diagramType];
  }
  return undefined;
}
