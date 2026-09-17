import type { NodeKind } from "../api/types";
import { FONT_FAMILIES, type TextFormat } from "../lib/textFormat";
import { AlignCenter, AlignLeft, AlignRight, Check, Copy, LinkIcon, Pencil, Trash, X } from "./icons";
import { NODE_COLORS } from "./nodes";

export interface StylePanelProps {
  shape: NodeKind;
  color: string | null;
  lineStyle: "solid" | "dashed" | "dotted";
  opacity: number;
  fontSize: number | null;
  titleFormat: TextFormat;
  descFormat: TextFormat;
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
  onSetTitleFormat: (patch: Partial<TextFormat>) => void;
  onSetDescFormat: (patch: Partial<TextFormat>) => void;
}

const SHAPES: { kind: NodeKind; label: string }[] = [
  { kind: "process", label: "Box" },
  { kind: "decision", label: "Decision" },
  { kind: "document", label: "Document" },
  { kind: "data", label: "Data" },
  { kind: "database", label: "Database" },
  { kind: "queue", label: "Queue" },
  { kind: "start", label: "Start" },
  { kind: "end", label: "End" },
  { kind: "actor", label: "Actor" },
  { kind: "service", label: "Service" },
  { kind: "system", label: "System" },
  { kind: "cloud", label: "Cloud" },
  { kind: "note", label: "Note" },
  { kind: "circle", label: "Circle" },
  { kind: "hexagon", label: "Hexagon" },
  { kind: "octagon", label: "Octagon" },
  { kind: "triangle", label: "Triangle" },
  { kind: "pentagon", label: "Pentagon" },
  { kind: "star", label: "Star" },
  { kind: "tag", label: "Tag" },
  { kind: "arrow", label: "Arrow" },
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
    case "queue":
      return (
        <svg {...common}>
          <rect x="3" y="7" width="18" height="10" rx="5" />
          <path d="M9 7v10M15 7v10" />
        </svg>
      );
    case "circle":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
        </svg>
      );
    case "hexagon":
      return (
        <svg {...common}>
          <path d="M12 3.5 19.2 8v8L12 20.5 4.8 16V8L12 3.5Z" />
        </svg>
      );
    case "octagon":
      return (
        <svg {...common}>
          <path d="M8.3 3.5h7.4L20.5 8.3v7.4L15.7 20.5H8.3L3.5 15.7V8.3L8.3 3.5Z" />
        </svg>
      );
    case "triangle":
      return (
        <svg {...common}>
          <path d="M12 4.5 21 19.5H3L12 4.5Z" />
        </svg>
      );
    case "pentagon":
      return (
        <svg {...common}>
          <path d="M12 3.5 20.5 9.5 17.2 20H6.8L3.5 9.5 12 3.5Z" />
        </svg>
      );
    case "star":
      return (
        <svg {...common}>
          <path d="m12 3 2.7 5.9 6.3.6-4.7 4.3 1.3 6.2L12 16.9l-5.6 3.1 1.3-6.2L3 9.5l6.3-.6Z" />
        </svg>
      );
    case "tag":
      return (
        <svg {...common}>
          <path d="M3 4h11l6 8-6 8H3Z" />
          <circle cx="6.5" cy="12" r="1.3" />
        </svg>
      );
    case "arrow":
      return (
        <svg {...common}>
          <path d="M3 7h11l7 5-7 5H3Z" />
        </svg>
      );
    case "service":
    case "system":
      return (
        <svg {...common}>
          <rect x="7" y="5" width="14" height="14" rx="2" />
          <rect x="3" y="8" width="5" height="3" rx="1" />
          <rect x="3" y="14" width="5" height="3" rx="1" />
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

const TOGGLE_BTN =
  "grid h-7 w-7 place-items-center rounded-md border text-[12px] font-[700] transition-colors [&_svg]:size-3.5";
const TOGGLE_ON = "border-green-line bg-green-soft text-green-strong";
const TOGGLE_OFF = "border-line text-slate hover:bg-paper hover:text-ink";

/** A field's own colour override: a checkbox that turns it on/off plus the
 *  same raw `<input type="color">` swatch the Color section above already
 *  uses — unchecked clears the key entirely rather than storing a colour
 *  nobody asked to apply. */
function ColorField({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value: string | undefined;
  fallback: string;
  onChange: (next: string | undefined) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-1 text-[11.5px] font-[550] text-slate">
      <input
        type="checkbox"
        checked={value !== undefined}
        onChange={(event) => onChange(event.target.checked ? fallback : undefined)}
      />
      <span className="flex-1">{label}</span>
      {value !== undefined && (
        <input
          type="color"
          className="color-custom__input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={label}
        />
      )}
    </label>
  );
}

/** Rich formatting for one piece of wedge/hub text — everything in the
 *  reference screenshot that's actually worth the wiring: font, weight/
 *  style/decoration, size, alignment, and three independent colour
 *  overrides (text, a background chip, a border around that chip). */
function TextFormatSection({
  title,
  value,
  onChange,
}: {
  title: string;
  value: TextFormat;
  onChange: (patch: Partial<TextFormat>) => void;
}) {
  return (
    <Section title={title}>
      <select
        className="mb-2 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-[11.5px] font-[550] text-ink"
        value={value.fontFamily ?? ""}
        onChange={(event) => onChange({ fontFamily: event.target.value || undefined })}
        aria-label={`${title} font`}
      >
        {FONT_FAMILIES.map((f) => (
          <option key={f.label} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      <div className="mb-2 flex items-center gap-1">
        <button
          className={`${TOGGLE_BTN} ${value.bold ? TOGGLE_ON : TOGGLE_OFF}`}
          aria-pressed={!!value.bold}
          title="Bold"
          onClick={() => onChange({ bold: !value.bold })}
        >
          B
        </button>
        <button
          className={`${TOGGLE_BTN} ${value.italic ? TOGGLE_ON : TOGGLE_OFF} italic`}
          aria-pressed={!!value.italic}
          title="Italic"
          onClick={() => onChange({ italic: !value.italic })}
        >
          I
        </button>
        <button
          className={`${TOGGLE_BTN} ${value.underline ? TOGGLE_ON : TOGGLE_OFF} underline`}
          aria-pressed={!!value.underline}
          title="Underline"
          onClick={() => onChange({ underline: !value.underline })}
        >
          U
        </button>
        <div className="mx-0.5 h-5 w-px bg-line" />
        {(
          [
            { key: "left", Icon: AlignLeft },
            { key: "center", Icon: AlignCenter },
            { key: "right", Icon: AlignRight },
          ] as const
        ).map(({ key, Icon }) => (
          <button
            key={key}
            className={`${TOGGLE_BTN} ${value.align === key ? TOGGLE_ON : TOGGLE_OFF}`}
            aria-pressed={value.align === key}
            title={`Align ${key}`}
            onClick={() => onChange({ align: value.align === key ? undefined : key })}
          >
            <Icon />
          </button>
        ))}
      </div>

      <label className="mb-2 flex items-center gap-2 text-[11.5px] font-[550] text-slate">
        <span className="flex-1">Size</span>
        <input
          type="number"
          min={8}
          max={48}
          className="w-14 rounded-md border border-line bg-surface px-1.5 py-1 text-right text-[11.5px] text-ink"
          placeholder="Auto"
          value={value.fontSize ?? ""}
          onChange={(event) => {
            const n = event.target.value === "" ? undefined : Number(event.target.value);
            onChange({ fontSize: n && n > 0 ? n : undefined });
          }}
        />
        <span className="text-[9px] text-slate-soft">px</span>
      </label>

      <ColorField
        label="Text colour"
        value={value.color}
        fallback="#10171a"
        onChange={(color) => onChange({ color })}
      />
      <ColorField
        label="Background"
        value={value.background}
        fallback="#fde68a"
        onChange={(background) => onChange({ background })}
      />
      <ColorField
        label="Border"
        value={value.borderColor}
        fallback="#cfd7da"
        onChange={(borderColor) => onChange({ borderColor })}
      />
    </Section>
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
  titleFormat,
  descFormat,
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
  onSetTitleFormat,
  onSetDescFormat,
}: StylePanelProps) {
  // A wedge/hub isn't a shape you switch between, has no dashed/dotted arc
  // concept, and gets richer per-field text controls below instead of one
  // flat size — so those three generic sections give way to "Title text"
  // (both kinds) and "Description text" (wedge only, hub never shows one).
  const isRadial = shape === "wedge" || shape === "hub";
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

      {!isRadial && (
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
      )}

      {isRadial && (
        <TextFormatSection title="Title text" value={titleFormat} onChange={onSetTitleFormat} />
      )}
      {shape === "wedge" && (
        <TextFormatSection title="Description text" value={descFormat} onChange={onSetDescFormat} />
      )}

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

      {shape !== "wedge" && (
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
      )}

      {!isRadial && (
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
      )}

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
