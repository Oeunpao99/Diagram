import type { NodeKind } from "../api/types";
import { Check, Copy, LinkIcon, Pencil, Trash, X } from "./icons";
import { NODE_COLORS } from "./nodes";

export interface StylePanelProps {
  shape: NodeKind;
  color: string | null;
  lineStyle: "solid" | "dashed" | "dotted";
  opacity: number;
  fontSize: number | null;
  onEdit: () => void;
  onDuplicate: () => void;
  onConnect: () => void;
  onDelete: () => void;
  onClose: () => void;
  onSetShape: (kind: NodeKind) => void;
  onSetColor: (color: string | null) => void;
  onSetLineStyle: (style: "solid" | "dashed" | "dotted") => void;
  onSetOpacity: (opacity: number) => void;
  onSetFontSize: (size: number | null) => void;
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

const LINE_STYLES: { key: "solid" | "dashed" | "dotted"; label: string }[] = [
  { key: "solid", label: "Solid" },
  { key: "dashed", label: "Dashed" },
  { key: "dotted", label: "Dotted" },
];

const FONT_SIZES: { px: number | null; label: string }[] = [
  { px: null, label: "Auto" },
  { px: 11, label: "11" },
  { px: 13, label: "13" },
  { px: 15, label: "15" },
  { px: 17, label: "17" },
  { px: 20, label: "20" },
];

const DEFAULT_HEX = "#0d9f6e";

function isCustomHex(color: string | null): color is string {
  return typeof color === "string" && !(color in NODE_COLORS);
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-line px-3.5 py-3">
      <p className="m-0 mb-2 text-[10.5px] font-[650] uppercase tracking-[0.06em] text-slate-soft">
        {title}
      </p>
      {children}
    </div>
  );
}

/** Docked right-side style panel for the current node selection — replaces
 *  the old floating pill toolbar so shape, colour, line and opacity all live
 *  in one place instead of splitting deeper options into flyouts. */
export function StylePanel({
  shape,
  color,
  lineStyle,
  opacity,
  fontSize,
  onEdit,
  onDuplicate,
  onConnect,
  onDelete,
  onClose,
  onSetShape,
  onSetColor,
  onSetLineStyle,
  onSetOpacity,
  onSetFontSize,
}: StylePanelProps) {
  return (
    <aside
      className="absolute right-0 top-0 bottom-0 z-[9] flex w-[240px] flex-col overflow-y-auto border-l border-line bg-surface shadow-2 animate-[sel-pop_140ms_ease]"
      aria-label="Shape style"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-line px-3.5 py-3">
        <h2 className="m-0 text-[12.5px] font-[650] text-ink">Style</h2>
        <button
          className="grid size-6 place-items-center rounded-md border-none bg-transparent text-slate-soft transition-colors hover:bg-paper hover:text-ink [&_svg]:size-3"
          onClick={onClose}
          aria-label="Close"
        >
          <X />
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 border-b border-line px-2 py-1.5">
        <button
          className="inline-flex flex-1 items-center justify-center gap-[5px] rounded-md border-none bg-transparent px-2 py-1.5 text-[11.5px] font-[550] text-slate hover:bg-paper hover:text-ink [&_svg]:size-3"
          onClick={onEdit}
        >
          <Pencil />
          Edit
        </button>
        <button
          className="inline-flex flex-1 items-center justify-center gap-[5px] rounded-md border-none bg-transparent px-2 py-1.5 text-[11.5px] font-[550] text-slate hover:bg-paper hover:text-ink [&_svg]:size-3"
          onClick={onDuplicate}
        >
          <Copy />
          Copy
        </button>
        <button
          className="inline-flex flex-1 items-center justify-center gap-[5px] rounded-md border-none bg-transparent px-2 py-1.5 text-[11.5px] font-[550] text-slate hover:bg-paper hover:text-ink [&_svg]:size-3"
          onClick={onConnect}
        >
          <LinkIcon />
          Link
        </button>
        <button
          className="inline-flex flex-1 items-center justify-center gap-[5px] rounded-md border-none bg-transparent px-2 py-1.5 text-[11.5px] font-[550] text-slate hover:bg-red-soft hover:text-red [&_svg]:size-3"
          onClick={onDelete}
        >
          <Trash />
        </button>
      </div>

      <Section title="Shape">
        <div className="grid grid-cols-3 gap-1">
          {SHAPES.map((option) => (
            <button
              key={option.kind}
              className={`grid h-10 place-items-center rounded-lg border text-slate transition-[background,color,border-color] hover:bg-paper hover:text-ink [&_svg]:size-[18px] ${shape === option.kind ? "border-green-line bg-green-soft text-green-strong" : "border-transparent"}`}
              title={option.label}
              onClick={() => onSetShape(option.kind)}
            >
              <ShapeGlyph kind={option.kind} />
            </button>
          ))}
        </div>
      </Section>

      <Section title="Color">
        <div className="grid grid-cols-5 gap-1.5">
          <button
            className={`relative grid size-[34px] place-items-center rounded-lg border border-transparent text-slate-soft transition hover:scale-105 [&_svg]:size-3 [&_svg]:stroke-[2.4] ${color === null ? "shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--green)]" : "bg-paper shadow-[inset_0_0_0_1.5px_var(--line-strong)]"}`}
            title="Default (no colour)"
            onClick={() => onSetColor(null)}
          >
            <span className="absolute h-[1.5px] w-4 -rotate-45 bg-slate-soft" />
            {color === null && <Check />}
          </button>
          {SHAPE_PALETTE.map((key) => {
            const swatch = NODE_COLORS[key];
            return (
              <button
                key={key}
                className={`relative grid size-[34px] place-items-center rounded-lg border text-white transition hover:scale-105 [&_svg]:size-3 [&_svg]:stroke-[2.4] ${color === key ? "shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--green)]" : "shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]"}`}
                style={{ background: swatch.bg, borderColor: swatch.line }}
                title={key}
                onClick={() => onSetColor(key)}
              >
                {color === key && <Check />}
              </button>
            );
          })}
        </div>
        <label
          className="group mt-2 flex cursor-pointer items-center gap-2 rounded-md p-1.5 text-[11.5px] font-semibold text-slate hover:bg-paper [&_svg]:ml-auto [&_svg]:size-3 [&_svg]:text-green-strong"
          title="Custom colour"
        >
          <input
            type="color"
            className="color-custom__input"
            value={isCustomHex(color) ? color : DEFAULT_HEX}
            onChange={(event) => onSetColor(event.target.value)}
            aria-label="Custom colour"
          />
          <span className="transition-colors group-hover:text-ink">
            Custom…
          </span>
          {isCustomHex(color) && <Check />}
        </label>
      </Section>

      <Section title="Line">
        <div className="grid grid-cols-3 gap-1">
          {LINE_STYLES.map((option) => (
            <button
              key={option.key}
              className={`rounded-md border px-1 py-[7px] text-[11px] font-[550] transition-colors ${lineStyle === option.key ? "border-green-line bg-green-soft text-green-strong" : "border-line text-slate hover:bg-paper hover:text-ink"}`}
              onClick={() => onSetLineStyle(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Font size">
        <div className="grid grid-cols-3 gap-1">
          {FONT_SIZES.map((option) => (
            <button
              key={option.label}
              className={`rounded-md border px-1 py-[7px] text-[11px] font-[550] transition-colors ${fontSize === option.px ? "border-green-line bg-green-soft text-green-strong" : "border-line text-slate hover:bg-paper hover:text-ink"}`}
              onClick={() => onSetFontSize(option.px)}
            >
              {option.label}
              {option.px !== null && (
                <span className="ml-0.5 text-[9px]">px</span>
              )}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Opacity">
        <div className="flex items-center gap-2.5">
          <input
            type="range"
            min={20}
            max={100}
            step={5}
            value={Math.round(opacity * 100)}
            onChange={(event) => onSetOpacity(Number(event.target.value) / 100)}
            className="min-w-0 flex-1"
            aria-label="Opacity"
          />
          <span className="w-9 shrink-0 text-right text-[11.5px] font-[550] tabular-nums text-ink">
            {Math.round(opacity * 100)}%
          </span>
        </div>
      </Section>
    </aside>
  );
}
