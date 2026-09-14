import { useEffect, useRef, useState, type ReactNode } from "react";

import { EDGE_DASH } from "../api/adapter";
import type { EdgeArrow, EdgeCurve, EdgeStyle } from "../api/types";
import { NODE_COLORS } from "./nodes";
import { Check, Palette, Trash, TypeIcon } from "./icons";

export interface EdgeToolbarProps {
  x: number;
  y: number;
  curve: EdgeCurve;
  color: string | null;
  lineStyle: EdgeStyle;
  width: number | null;
  startArrow: EdgeArrow;
  endArrow: EdgeArrow;
  label: string;
  labelColor: string | null;
  labelFontSize: number | null;
  onDelete: () => void;
  onSetCurve: (curve: EdgeCurve) => void;
  onSetColor: (color: string | null) => void;
  onSetStyle: (style: EdgeStyle) => void;
  onSetWidth: (width: number | null) => void;
  onSetStartArrow: (arrow: EdgeArrow) => void;
  onSetEndArrow: (arrow: EdgeArrow) => void;
  onSetLabel: (label: string) => void;
  onSetLabelColor: (color: string | null) => void;
  onSetLabelFontSize: (size: number | null) => void;
}

const FONT_SIZES: { px: number | null; label: string }[] = [
  { px: null, label: "10 (default)" },
  { px: 9, label: "9 px" },
  { px: 11, label: "11 px" },
  { px: 12, label: "12 px" },
  { px: 14, label: "14 px" },
];

/* ----------------------------------------------------------- controls */

const CURVES: { curve: EdgeCurve; label: string }[] = [
  { curve: "smoothstep", label: "Smooth" },
  { curve: "step", label: "Step" },
  { curve: "straight", label: "Straight" },
  { curve: "bezier", label: "Curved" },
];

const LINE_STYLES: { style: EdgeStyle; label: string }[] = [
  { style: "solid", label: "Solid" },
  { style: "dashed", label: "Dashed" },
  { style: "dotted", label: "Dotted" },
  { style: "dashdot", label: "Dash-dot" },
  { style: "longdash", label: "Long dash" },
  { style: "animated", label: "Animated" },
];

const ARROWS: { arrow: EdgeArrow; label: string }[] = [
  { arrow: "none", label: "None" },
  { arrow: "arrow", label: "Open" },
  { arrow: "triangle", label: "Solid" },
  { arrow: "circle", label: "Circle" },
  { arrow: "diamond", label: "Diamond" },
];

const WIDTHS: { px: number | null; label: string }[] = [
  { px: null, label: "1.5 (default)" },
  { px: 1, label: "1 px" },
  { px: 2, label: "2 px" },
  { px: 3, label: "3 px" },
  { px: 4, label: "4 px" },
  { px: 5, label: "5 px" },
];

const DEFAULT_HEX = "#0d9f6e";
const SWATCHES: string[] = ["teal", "emerald", "blue", "indigo", "violet", "fuchsia", "rose", "orange", "amber", "slate"].map(
  (key) => NODE_COLORS[key].line,
);

function swatchKey(hex: string): string {
  return SWATCHES.find((swatch) => swatch.toLowerCase() === hex.toLowerCase()) ?? hex;
}

function isCustomHex(color: string | null): color is string {
  return typeof color === "string" && !SWATCHES.some((s) => s.toLowerCase() === color.toLowerCase());
}

const glyph = {
  viewBox: "0 0 24 24",
  width: 20,
  height: 20,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function CurveGlyph({ curve }: { curve: EdgeCurve }) {
  switch (curve) {
    case "step":
      return (
        <svg {...glyph}>
          <path d="M3 14h8M11 14v-7h10" />
          <path d="m17 4 4 3-4 3" />
        </svg>
      );
    case "straight":
      return (
        <svg {...glyph}>
          <path d="M4 14h13" />
          <path d="m13 11 4 3-4 3" />
        </svg>
      );
    case "bezier":
      return (
        <svg {...glyph}>
          <path d="M4 9.5C9 12 15 6.5 20 11" />
          <path d="m16 8.5 4 2.5-4 2.5" />
        </svg>
      );
    default:
      return (
        <svg {...glyph}>
          <path d="M4 15C9 4.5 15 15 20 9.5" />
          <path d="m16 7.5 4 2-4 2.5" />
        </svg>
      );
  }
}

function LineGlyph({ style, width = 1.7 }: { style: EdgeStyle; width?: number }) {
  return (
    <svg
      viewBox="0 0 24 12"
      width={28}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth={style === "dotted" ? Math.max(3, width) : width}
      strokeLinecap="round"
      strokeDasharray={EDGE_DASH[style]}
      aria-hidden="true"
    >
      <path d="M2 6h20" />
    </svg>
  );
}

function ArrowGlyph({ arrow }: { arrow: EdgeArrow }) {
  switch (arrow) {
    case "none":
      return (
        <svg {...glyph}>
          <path d="M3 12h16" />
        </svg>
      );
    case "arrow":
      return (
        <svg {...glyph}>
          <path d="M3 12h14" />
          <path d="m13 7 6 5-6 5" />
        </svg>
      );
    case "circle":
      return (
        <svg {...glyph}>
          <path d="M3 12h11" />
          <circle cx="18" cy="12" r="3.4" fill="currentColor" stroke="none" />
        </svg>
      );
    case "diamond":
      return (
        <svg {...glyph}>
          <path d="M3 12h9" />
          <path d="M14 12 18 8l4 4-4 4z" fill="currentColor" stroke="none" />
        </svg>
      );
    default:
      return (
        <svg {...glyph}>
          <path d="M3 12h14" />
          <path d="M17 7 21 12 17 17 13 12z" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}

function PopupLabel({ children }: { children: string }) {
  return (
    <div className="px-1 pb-[7px] pt-0.5 text-[10.5px] font-[650] uppercase tracking-[0.06em] text-slate-soft">
      {children}
    </div>
  );
}

function ToolbarButton({
  open,
  onToggle,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <button
      className={`inline-flex items-center gap-[5px] rounded-md border-none bg-transparent px-2 py-1 text-[11.5px] font-[550] text-slate hover:bg-paper hover:text-ink [&_svg]:size-3.5 ${open ? "bg-paper text-ink" : ""}`}
      onClick={onToggle}
      aria-expanded={open}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------- toolbar */

export function EdgeToolbar({
  x,
  y,
  curve,
  color,
  lineStyle,
  width,
  startArrow,
  endArrow,
  label,
  labelColor,
  labelFontSize,
  onDelete,
  onSetCurve,
  onSetColor,
  onSetStyle,
  onSetWidth,
  onSetStartArrow,
  onSetEndArrow,
  onSetLabel,
  onSetLabelColor,
  onSetLabelFontSize,
}: EdgeToolbarProps) {
  const [open, setOpen] = useState<"curve" | "color" | "style" | "width" | "arrow" | "text" | null>(
    null,
  );
  const [labelDraft, setLabelDraft] = useState(label);
  const rootRef = useRef<HTMLDivElement>(null);

  // The label input is local state while the popup is open — otherwise every
  // keystroke round-trips through the doc and re-lays-out the edge under the
  // user's own cursor. Committed on blur/Enter, and re-synced whenever a
  // different edge (a new `label`) gets selected.
  useEffect(() => setLabelDraft(label), [label]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(null);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const close = () => setOpen(null);
  const toggle = (which: "curve" | "color" | "style" | "width" | "arrow" | "text") =>
    setOpen((v) => (v === which ? null : which));
  const commitLabel = () => {
    if (labelDraft !== label) onSetLabel(labelDraft);
  };

  return (
    <div
      ref={rootRef}
      className="absolute z-[9] flex animate-[sel-pop_140ms_ease] items-center gap-0.5 whitespace-nowrap rounded-[9px] border border-line bg-surface p-[3px] shadow-2"
      role="toolbar"
      aria-label="Connector actions"
      style={{ left: x, top: y - 10, transform: "translate(-50%, -100%)" }}
    >
      <div className="relative inline-flex">
        <ToolbarButton open={open === "curve"} onToggle={() => toggle("curve")}>
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" aria-hidden="true">
            <path d="M4 15C9 4.5 15 15 20 9.5" />
          </svg>
          Shape
        </ToolbarButton>
        {open === "curve" && (
          <div className="absolute bottom-[calc(100%+8px)] left-0 z-[12] w-[168px] animate-[sel-pop_140ms_ease] rounded-[11px] border border-line bg-surface p-[7px] shadow-3">
            <PopupLabel>Connector shape</PopupLabel>
            <div className="grid grid-cols-2 gap-1">
              {CURVES.map((option) => (
                <button
                  key={option.curve}
                  className={`inline-flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-[11.5px] font-[600] text-slate transition-[background,color,border-color] hover:bg-paper hover:text-ink [&_svg]:size-5 ${curve === option.curve ? "border-green-line bg-green-soft text-green-strong" : "border-transparent"}`}
                  title={option.label}
                  onClick={() => {
                    onSetCurve(option.curve);
                    close();
                  }}
                >
                  <CurveGlyph curve={option.curve} />
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="relative inline-flex">
        <ToolbarButton open={open === "color"} onToggle={() => toggle("color")}>
          <Palette />
          Colour
        </ToolbarButton>
        {open === "color" && (
          <div className="absolute bottom-[calc(100%+8px)] left-0 z-[12] w-[176px] animate-[sel-pop_140ms_ease] rounded-[11px] border border-line bg-surface p-[7px] shadow-3">
            <PopupLabel>Line colour</PopupLabel>
            <div className="grid grid-cols-4 gap-[7px]">
              <button
                className={`relative grid size-[30px] place-items-center rounded-lg border border-transparent text-slate-soft transition hover:scale-105 [&_svg]:size-3 [&_svg]:stroke-[2.4] ${color === null ? "shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--green)]" : "bg-paper shadow-[inset_0_0_0_1.5px_var(--line-strong)]"}`}
                title="Default (no colour)"
                onClick={() => {
                  onSetColor(null);
                  close();
                }}
              >
                <span className="absolute h-[1.5px] w-4 -rotate-45 bg-slate-soft" />
                {color === null && <Check />}
              </button>
              {SWATCHES.map((hex) => (
                <button
                  key={hex}
                  className={`relative grid size-[30px] place-items-center rounded-lg border text-white transition hover:scale-105 [&_svg]:size-3 [&_svg]:stroke-[2.4] ${color?.toLowerCase() === hex.toLowerCase() ? "shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--green)]" : "shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]"}`}
                  style={{ background: hex, borderColor: hex }}
                  title={swatchKey(hex)}
                  onClick={() => {
                    onSetColor(hex);
                    close();
                  }}
                >
                  {color?.toLowerCase() === hex.toLowerCase() && <Check />}
                </button>
              ))}
            </div>
            <label className="group mt-2 flex cursor-pointer items-center gap-2 border-t border-line p-2 text-[11.5px] font-semibold text-slate [&_svg]:ml-auto [&_svg]:size-3 [&_svg]:text-green-strong" title="Custom colour">
              <input
                type="color"
                className="color-custom__input"
                value={isCustomHex(color) ? color : DEFAULT_HEX}
                onChange={(event) => onSetColor(event.target.value)}
                aria-label="Custom colour"
              />
              <span className="transition-colors group-hover:text-ink group-focus-within:text-ink">Custom…</span>
              {isCustomHex(color) && <Check />}
            </label>
          </div>
        )}
      </div>

      <div className="relative inline-flex">
        <ToolbarButton open={open === "text"} onToggle={() => toggle("text")}>
          <TypeIcon />
          Text
        </ToolbarButton>
        {open === "text" && (
          <div className="absolute bottom-[calc(100%+8px)] left-0 z-[12] w-[190px] animate-[sel-pop_140ms_ease] rounded-[11px] border border-line bg-surface p-[7px] shadow-3">
            <PopupLabel>Label text</PopupLabel>
            <input
              className="mb-2 w-full rounded-md border border-line bg-paper px-2 py-1.5 text-[12px] text-ink outline-none focus:border-green"
              value={labelDraft}
              placeholder="No label"
              onChange={(event) => setLabelDraft(event.target.value)}
              onBlur={commitLabel}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitLabel();
                  close();
                }
              }}
            />

            <PopupLabel>Text size</PopupLabel>
            <div className="mb-2 grid grid-cols-3 gap-0.5">
              {FONT_SIZES.map((option) => (
                <button
                  key={option.label}
                  className={`rounded-md border px-1 py-1 text-[10.5px] font-[600] transition-colors ${(labelFontSize ?? null) === option.px ? "border-green-line bg-green-soft text-green-strong" : "border-transparent text-slate hover:bg-paper hover:text-ink"}`}
                  title={option.label}
                  onClick={() => onSetLabelFontSize(option.px)}
                >
                  {option.px === null ? "Default" : option.px}
                </button>
              ))}
            </div>

            <PopupLabel>Text colour</PopupLabel>
            <div className="grid grid-cols-4 gap-[7px]">
              <button
                className={`relative grid size-[26px] place-items-center rounded-lg border border-transparent text-slate-soft transition hover:scale-105 [&_svg]:size-3 [&_svg]:stroke-[2.4] ${labelColor === null ? "shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--green)]" : "bg-paper shadow-[inset_0_0_0_1.5px_var(--line-strong)]"}`}
                title="Default"
                onClick={() => onSetLabelColor(null)}
              >
                <span className="absolute h-[1.5px] w-4 -rotate-45 bg-slate-soft" />
                {labelColor === null && <Check />}
              </button>
              {SWATCHES.map((hex) => (
                <button
                  key={hex}
                  className={`relative grid size-[26px] place-items-center rounded-lg border text-white transition hover:scale-105 [&_svg]:size-3 [&_svg]:stroke-[2.4] ${labelColor?.toLowerCase() === hex.toLowerCase() ? "shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--green)]" : "shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]"}`}
                  style={{ background: hex, borderColor: hex }}
                  title={swatchKey(hex)}
                  onClick={() => onSetLabelColor(hex)}
                >
                  {labelColor?.toLowerCase() === hex.toLowerCase() && <Check />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="relative inline-flex">
        <ToolbarButton open={open === "style"} onToggle={() => toggle("style")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeDasharray={EDGE_DASH[lineStyle]} aria-hidden="true">
            <path d="M3 12h18" />
          </svg>
          Style
        </ToolbarButton>
        {open === "style" && (
          <div className="absolute bottom-[calc(100%+8px)] left-0 z-[12] w-[132px] animate-[sel-pop_140ms_ease] rounded-[11px] border border-line bg-surface p-[7px] shadow-3">
            <PopupLabel>Line style</PopupLabel>
            <div className="grid gap-0.5">
              {LINE_STYLES.map((option) => (
                <button
                  key={option.style}
                  className={`flex items-center gap-2.5 rounded-lg border px-2 py-1.5 text-[11.5px] font-[600] text-slate transition-[background,color,border-color] hover:bg-paper hover:text-ink ${lineStyle === option.style ? "border-green-line bg-green-soft text-green-strong" : "border-transparent"}`}
                  title={option.label}
                  onClick={() => {
                    onSetStyle(option.style);
                    close();
                  }}
                >
                  <LineGlyph style={option.style} width={2} />
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="relative inline-flex">
        <ToolbarButton open={open === "arrow"} onToggle={() => toggle("arrow")}>
          <ArrowGlyph arrow={endArrow} />
          Arrow
        </ToolbarButton>
        {open === "arrow" && (
          <div className="absolute bottom-[calc(100%+8px)] left-0 z-[12] w-[176px] animate-[sel-pop_140ms_ease] rounded-[11px] border border-line bg-surface p-[7px] shadow-3">
            <PopupLabel>Start</PopupLabel>
            <div className="mb-2 grid grid-cols-5 gap-0.5">
              {ARROWS.map((option) => (
                <button
                  key={option.arrow}
                  className={`grid place-items-center rounded-lg border px-1 py-1.5 text-slate transition-[background,color,border-color] hover:bg-paper hover:text-ink [&_svg]:size-[18px] ${startArrow === option.arrow ? "border-green-line bg-green-soft text-green-strong" : "border-transparent"}`}
                  title={option.label}
                  onClick={() => onSetStartArrow(option.arrow)}
                >
                  <ArrowGlyph arrow={option.arrow} />
                </button>
              ))}
            </div>

            <PopupLabel>End</PopupLabel>
            <div className="grid grid-cols-5 gap-0.5">
              {ARROWS.map((option) => (
                <button
                  key={option.arrow}
                  className={`grid place-items-center rounded-lg border px-1 py-1.5 text-slate transition-[background,color,border-color] hover:bg-paper hover:text-ink [&_svg]:size-[18px] ${endArrow === option.arrow ? "border-green-line bg-green-soft text-green-strong" : "border-transparent"}`}
                  title={option.label}
                  onClick={() => onSetEndArrow(option.arrow)}
                >
                  <ArrowGlyph arrow={option.arrow} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="relative inline-flex">
        <ToolbarButton open={open === "width"} onToggle={() => toggle("width")}>
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden="true">
            <path d="M3 12h18" />
          </svg>
          Thickness
        </ToolbarButton>
        {open === "width" && (
          <div className="absolute bottom-[calc(100%+8px)] left-0 z-[12] w-[148px] animate-[sel-pop_140ms_ease] rounded-[11px] border border-line bg-surface p-[7px] shadow-3">
            <PopupLabel>Line thickness</PopupLabel>
            <div className="grid gap-0.5">
              {WIDTHS.map((option) => (
                <button
                  key={option.label}
                  className={`inline-flex items-center gap-2.5 rounded-lg border px-2 py-1.5 text-[11.5px] font-[600] text-slate transition-[background,color,border-color] hover:bg-paper hover:text-ink ${(width ?? null) === option.px ? "border-green-line bg-green-soft text-green-strong" : "border-transparent"}`}
                  title={option.label}
                  onClick={() => {
                    onSetWidth(option.px);
                    close();
                  }}
                >
                  <span className="w-7 text-[10.5px] font-[650] text-slate">
                    {option.px === null ? "1.5" : option.px}
                  </span>
                  <LineGlyph style="solid" width={option.px ?? 1.5} />
                  <span className="text-slate-soft">{option.px === null ? "default" : "px"}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <span className="w-px self-stretch bg-line" />
      <button className="inline-flex items-center gap-[5px] rounded-md border-none bg-transparent px-2 py-1 text-[11.5px] font-[550] text-slate hover:bg-red-soft hover:text-red [&_svg]:size-3" onClick={onDelete}>
        <Trash />
        Delete
      </button>
    </div>
  );
}
