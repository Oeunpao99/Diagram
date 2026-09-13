import { useEffect, useRef, useState } from "react";

import type { NodeKind } from "../api/types";
import { NODE_COLORS } from "./nodes";
import { Check, Copy, LinkIcon, Palette, Pencil, Square, Trash } from "./icons";

export interface SelectionToolbarProps {
  x: number;
  y: number;
  shape: NodeKind;
  color: string | null;
  onEdit: () => void;
  onDuplicate: () => void;
  onConnect: () => void;
  onDelete: () => void;
  onSetShape: (kind: NodeKind) => void;
  onSetColor: (color: string | null) => void;
}

const SHAPES: { kind: NodeKind; label: string }[] = [
  { kind: "process", label: "Box" },
  { kind: "decision", label: "Decision" },
  { kind: "document", label: "Document" },
  { kind: "data", label: "Data" },
  { kind: "database", label: "Database" },
  { kind: "start", label: "Start" },
  { kind: "cloud", label: "Cloud" },
  { kind: "note", label: "Note" },
  { kind: "actor", label: "Actor" },
];

function ShapeGlyph({ kind }: { kind: NodeKind }) {
  const common = {
    viewBox: "0 0 24 24",
    width: 18,
    height: 18,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (kind) {
    case "decision":
      return (
        <svg {...common}>
          <path d="M12 3l7 9-7 9-7-9 7-9Z" />
        </svg>
      );
    case "document":
      return (
        <svg {...common}>
          <path d="M6 3h8l4 4v14H6V3Z" />
          <path d="M14 3v4h4M9 12h6M9 16h6" />
        </svg>
      );
    case "data":
      return (
        <svg {...common}>
          <path d="M4 6l6-3 10 3v12l-6 3-6-3 6-3 6-3-10-3-6 3V6Z" />
        </svg>
      );
    case "database":
      return (
        <svg {...common}>
          <ellipse cx="12" cy="5.5" rx="7" ry="3" />
          <path d="M5 5.5v13c0 1.7 3.1 3 7 3s7-1.3 7-3v-13" />
          <path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
        </svg>
      );
    case "start":
    case "end":
      return (
        <svg {...common}>
          <rect x="4" y="6" width="16" height="12" rx="6" />
        </svg>
      );
    case "cloud":
      return (
        <svg {...common}>
          <path d="M7 18h10a4 4 0 0 0 .7-7.9A5.5 5.5 0 0 0 7.2 9.6 3.5 3.5 0 0 0 7 18Z" />
        </svg>
      );
    case "note":
      return (
        <svg {...common}>
          <path d="M6 3h9l3 3v15H6V3Z" />
          <path d="M15 3v3h3M9 12h6M9 16h5" />
        </svg>
      );
    case "actor":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3" />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="14" rx="2.5" />
        </svg>
      );
  }
}

const SHAPE_PALETTE: (keyof typeof NODE_COLORS)[] = [
  "teal",
  "emerald",
  "blue",
  "indigo",
  "violet",
  "fuchsia",
  "rose",
  "orange",
  "amber",
  "slate",
];

const DEFAULT_HEX = "#0d9f6e";

function isCustomHex(color: string | null): color is string {
  return typeof color === "string" && !(color in NODE_COLORS);
}

export function SelectionToolbar({
  x,
  y,
  shape,
  color,
  onEdit,
  onDuplicate,
  onConnect,
  onDelete,
  onSetShape,
  onSetColor,
}: SelectionToolbarProps) {
  const [open, setOpen] = useState<"shape" | "color" | null>(null);
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

  return (
    <div
      ref={rootRef}
      className="absolute z-[9] flex animate-[sel-pop_140ms_ease] items-center gap-0.5 whitespace-nowrap rounded-[9px] border border-line bg-surface p-[3px] shadow-2"
      role="toolbar"
      aria-label="Node actions"
      style={{ left: x, top: y - 10, transform: "translate(-50%, -100%)" }}
    >
      <button className="inline-flex items-center gap-[5px] rounded-md border-none bg-transparent px-2 py-1 text-[11.5px] font-[550] text-slate hover:bg-paper hover:text-ink [&_svg]:size-3" onClick={onEdit}>
        <Pencil />
        Edit
      </button>
      <button className="inline-flex items-center gap-[5px] rounded-md border-none bg-transparent px-2 py-1 text-[11.5px] font-[550] text-slate hover:bg-paper hover:text-ink [&_svg]:size-3" onClick={onDuplicate}>
        <Copy />
        Duplicate
      </button>

      <div className="relative inline-flex">
        <button
          className={`inline-flex items-center gap-[5px] rounded-md border-none bg-transparent px-2 py-1 text-[11.5px] font-[550] text-slate hover:bg-paper hover:text-ink [&_svg]:size-3 ${open === "shape" ? "bg-paper text-ink" : ""}`}
          onClick={() => setOpen((v) => (v === "shape" ? null : "shape"))}
          aria-expanded={open === "shape"}
        >
          <Square />
          Shape
        </button>
        {open === "shape" && (
          <div className="absolute bottom-[calc(100%+8px)] left-0 z-[12] w-[156px] animate-[sel-pop_140ms_ease] rounded-[11px] border border-line bg-surface p-[7px] shadow-3">
            <div className="px-1 pb-[7px] pt-0.5 text-[10.5px] font-[650] uppercase tracking-[0.06em] text-slate-soft">
              Change shape
            </div>
            <div className="grid grid-cols-3 gap-0.5">
              {SHAPES.map((option) => (
                <button
                  key={option.kind}
                  className={`grid h-9 place-items-center rounded-lg border text-slate transition-[background,color,border-color] hover:bg-paper hover:text-ink [&_svg]:size-[18px] ${shape === option.kind ? "border-green-line bg-green-soft text-green-strong" : "border-transparent"}`}
                  title={option.label}
                  onClick={() => {
                    onSetShape(option.kind);
                    close();
                  }}
                >
                  <ShapeGlyph kind={option.kind} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="relative inline-flex">
        <button
          className={`inline-flex items-center gap-[5px] rounded-md border-none bg-transparent px-2 py-1 text-[11.5px] font-[550] text-slate hover:bg-paper hover:text-ink [&_svg]:size-3 ${open === "color" ? "bg-paper text-ink" : ""}`}
          onClick={() => setOpen((v) => (v === "color" ? null : "color"))}
          aria-expanded={open === "color"}
        >
          <Palette />
          Color
        </button>
        {open === "color" && (
          <div className="absolute bottom-[calc(100%+8px)] left-0 z-[12] w-[150px] animate-[sel-pop_140ms_ease] rounded-[11px] border border-line bg-surface p-[7px] shadow-3">
            <div className="px-1 pb-[7px] pt-0.5 text-[10.5px] font-[650] uppercase tracking-[0.06em] text-slate-soft">
              Node color
            </div>
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
              {SHAPE_PALETTE.map((key) => {
                const swatch = NODE_COLORS[key];
                return (
                  <button
                    key={key}
                    className={`relative grid size-[30px] place-items-center rounded-lg border text-white transition hover:scale-105 [&_svg]:size-3 [&_svg]:stroke-[2.4] ${color === key ? "shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--green)]" : "shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]"}`}
                    style={{ background: swatch.bg, borderColor: swatch.line }}
                    title={key}
                    onClick={() => {
                      onSetColor(key);
                      close();
                    }}
                  >
                    {color === key && <Check />}
                  </button>
                );
              })}
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

      <span className="w-px self-stretch bg-line" />
      <button className="inline-flex items-center gap-[5px] rounded-md border-none bg-transparent px-2 py-1 text-[11.5px] font-[550] text-slate hover:bg-paper hover:text-ink [&_svg]:size-3" onClick={onConnect}>
        <LinkIcon />
        Connect
      </button>
      <button className="inline-flex items-center gap-[5px] rounded-md border-none bg-transparent px-2 py-1 text-[11.5px] font-[550] text-slate hover:bg-red-soft hover:text-red [&_svg]:size-3" onClick={onDelete}>
        <Trash />
        Delete
      </button>
    </div>
  );
}