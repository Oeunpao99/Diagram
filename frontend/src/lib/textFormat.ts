import type { CSSProperties } from "react";

/** Rich formatting for one piece of wedge/hub text (a title or a
 *  description) — lives in `node.style.titleFormat` / `.descFormat`, the
 *  same free-form `style` bag every other per-node override already uses.
 *  Every field is optional and unset means "inherit the default look". */
export interface TextFormat {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: "left" | "center" | "right";
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  background?: string;
  borderColor?: string;
}

/** Curated font choices — unset (`""`) keeps the app's own default stack. */
export const FONT_FAMILIES: { value: string; label: string }[] = [
  { value: "", label: "Default" },
  { value: "Georgia, 'Times New Roman', serif", label: "Serif" },
  { value: "var(--font-mono)", label: "Monospace" },
  { value: "'Kantumruy Pro', sans-serif", label: "Khmer" },
];

/** Turns the flags above into inline CSS, shared by the static text and the
 *  input/textarea shown while editing so formatting never "flashes" between
 *  the two. A background or border colour gets padding/radius too, so it
 *  reads as an actual chip rather than a color bleeding past the glyphs. */
export function textFormatStyle(fmt: TextFormat | undefined): CSSProperties {
  if (!fmt) return {};
  const chip = Boolean(fmt.background || fmt.borderColor);
  return {
    fontWeight: fmt.bold ? 700 : undefined,
    fontStyle: fmt.italic ? "italic" : undefined,
    textDecoration: fmt.underline ? "underline" : undefined,
    textAlign: fmt.align,
    fontFamily: fmt.fontFamily || undefined,
    fontSize: fmt.fontSize,
    color: fmt.color,
    background: fmt.background,
    border: fmt.borderColor ? `1px solid ${fmt.borderColor}` : undefined,
    borderRadius: chip ? 4 : undefined,
    padding: chip ? "1px 4px" : undefined,
  };
}
