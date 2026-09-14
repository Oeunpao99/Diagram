import { useEffect, useRef, useState, type ReactNode } from "react";

import type { EdgeCurve, EdgeStyle } from "../api/types";
import { NODE_COLORS } from "./nodes";
import { Check, Palette, Trash } from "./icons";

export interface EdgeToolbarProps {
  x: number;
  y: number;
  curve: EdgeCurve;
  color: string | null;
  lineStyle: EdgeStyle;
  width: number | null;
  onDelete: () => void;
  onSetCurve: (curve: EdgeCurve) => void;
  onSetColor: (color: string | null) => void;
  onSetStyle: (style: EdgeStyle) => void;
  onSetWidth: (width: number | null) => void;
}

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
  { style: "animated", label: "Animated" },
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

function LineGlyph({
  style,
  width = 1.7,
  strokeDasharray,
}: {
  style: EdgeStyle;
  width?: number;
  strokeDasharray?: string;
}) {
  const dashed = style === "animated" ? "7 6" : style === "dotted" ? "0.5 7" : strokeDasharray;
  return (
    <svg
      viewBox="0 0 24 12"
      width={28}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth={style === "dotted" ? Math.max(3, width) : width}
      strokeLinecap={style === "dotted" ? "round" : "round"}
      strokeDasharray={dashed}
      aria-hidden="true"
    >
      <path d="M2 6h20" />
    </svg>
  );
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
  onDelete,
  onSetCurve,
  onSetColor,
  onSetStyle,
  onSetWidth,
}: EdgeToolbarProps) {
  const [open, setOpen] = useState<"curve" | "color" | "style" | "width" | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(null);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const close = () => setOpen(null);
  const toggle = (which: "curve" | "color" | "style" | "width") =>
    setOpen((v) => (v === which ? null : which));

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
        <ToolbarButton open={open === "style"} onToggle={() => toggle("style")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeDasharray={lineStyle === "dashed" ? "6 4" : lineStyle === "dotted" ? "1 6" : undefined} aria-hidden="true">
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
