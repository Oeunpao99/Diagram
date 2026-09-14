import {
  Handle,
  Position,
  useReactFlow,
  useStoreApi,
  type NodeProps,
} from "@xyflow/react";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import type { FlowNode } from "../api/adapter";
import type { NodeKind } from "../api/types";
import { queueSkipNextDocFit } from "../lib/docFit";
import { useDiagram } from "../store/useDiagram";
import { ICON_CATALOG } from "./iconCatalog";

/** Key -> icon component, so a node's `icon` string resolves in one lookup
 *  instead of scanning the whole catalogue on every render. */
const ICON_BY_KEY = new Map(ICON_CATALOG.map((asset) => [asset.key, asset.Icon]));

/** Shape family per node kind. Everything else is CSS. */
const SHAPE: Record<NodeKind, string> = {
  start: "pill",
  end: "pill",
  process: "box",
  decision: "diamond",
  document: "doc",
  data: "para",
  database: "cylinder",
  actor: "actor",
  system: "box",
  service: "box",
  queue: "para",
  cloud: "cloud",
  note: "note",
};

/** Per-node colour palette. Picked in the selection toolbar and stored in
 *  `node.style.color`; undefined keeps the default theme look. A raw `#hex`
 *  is also accepted for arbitrary custom colours.
 *
 *  Full-strength fill, not a pastel tint — `bg` is the saturated colour
 *  itself (what used to live in `line`), `line` is a darker shade of that
 *  same hue for the border, and `ink` is white so it reads against the
 *  now-solid background, the same treatment the start/end pills already use. */
export const NODE_COLORS: Record<
  string,
  { bg: string; line: string; ink: string }
> = {
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

function mixToward(
  rgb: [number, number, number],
  target: number,
  amount: number,
): string {
  const mixed = rgb.map((ch) => Math.round(ch + (target - ch) * amount));
  const [r, g, b] = mixed;
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Each diagram family gets its own laid-back accent palette, so a process
 *  flow, an org chart and a network read as different "worlds" at a glance
 *  even before you look at the shapes. Only applies when the user hasn't
 *  pinned an explicit colour on the node. */
const TYPE_DEFAULT: Record<string, { bg: string; line: string; ink: string }> =
  {
    process_flow: { bg: "#f2effc", line: "#7a6be0", ink: "#2c2360" },
    swimlane: { bg: "#eef3fc", line: "#4f7fce", ink: "#22406f" },
    architecture: { bg: "#eef1f6", line: "#4f637c", ink: "#1f2c3d" },
    network: { bg: "#e6f3f4", line: "#2b8a94", ink: "#145760" },
    sequence: { bg: "#f8f0de", line: "#b0781f", ink: "#5c3f0c" },
    er: { bg: "#fae9f1", line: "#b84b78", ink: "#5c213e" },
    data_flow: { bg: "#e2f4ec", line: "#1d9a6c", ink: "#10503a" },
    org_chart: { bg: "#faece3", line: "#c1763a", ink: "#5c2e0e" },
    mind_map: { bg: "#fae8e6", line: "#c6574f", ink: "#5c201b" },
  };

/** Kinds that adopt the family accent — the "meat" boxes. The rest stay
 *  semantic: start/end pills, the amber decision, green data/DB, actors and
 *  dashed notes. */
const TINTED_KINDS: ReadonlySet<NodeKind> = new Set([
  "process",
  "system",
  "service",
  "cloud",
  "document",
  "queue",
]);

function nodeColor(data: FlowNode["data"], diagramType?: string) {
  const key = typeof data.style?.color === "string" ? data.style.color : null;
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
  if (diagramType && !data.imageUrl && TINTED_KINDS.has(data.kind)) {
    return TYPE_DEFAULT[diagramType];
  }
  return undefined;
}

type ResizeCorner = "tl" | "tr" | "bl" | "br";

const RESIZE_HANDLES: {
  key: ResizeCorner;
  sx: number;
  sy: number;
  cursor: string;
}[] = [
  { key: "tl", sx: -1, sy: -1, cursor: "nwse-resize" },
  { key: "tr", sx: 1, sy: -1, cursor: "nesw-resize" },
  { key: "bl", sx: -1, sy: 1, cursor: "nesw-resize" },
  { key: "br", sx: 1, sy: 1, cursor: "nwse-resize" },
];

const MIN_WIDTH = 48;
const MIN_HEIGHT = 36;

function ResizeCorners({
  onStart,
}: {
  onStart: (
    handle: (typeof RESIZE_HANDLES)[number],
    event: ReactPointerEvent<HTMLElement>,
  ) => void;
}) {
  return (
    <>
      {RESIZE_HANDLES.map((handle) => (
        <i
          key={handle.key}
          role="presentation"
          className={`node__corner node__corner--${handle.key} nodrag`}
          style={{ cursor: handle.cursor }}
          onPointerDown={(event) => onStart(handle, event)}
        />
      ))}
    </>
  );
}

/** Renames a node in place — used both by double-click-to-edit and, for
 *  brand-new text/shape drops, to jump straight into editing. */
function commitLabel(id: string, label: string) {
  const trimmed = label.trim();
  if (!trimmed) return; // an empty label reads as "still loading"; keep the old one
  const current = useDiagram.getState().doc;
  useDiagram.getState().setDoc(
    {
      ...current,
      nodes: current.nodes.map((n) =>
        n.id === id ? { ...n, label: trimmed } : n,
      ),
    },
    { silent: true },
  );
}

export function DiagramNode({ id, data, selected }: NodeProps<FlowNode>) {
  const shape = SHAPE[data.kind] ?? "box";
  const diagramType = useDiagram((s) => s.doc.diagram_type);
  const color = nodeColor(data, diagramType);
  const textOnly = data.style?.textOnly === true;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label);
  const inputRef = useRef<HTMLInputElement>(null);
  const { setNodes } = useReactFlow<FlowNode>();
  // Hooks only run during render — grabbed here, then read via
  // store.getState() from inside the pointermove closure below, which fires
  // from a native window listener outside React's render cycle entirely.
  const store = useStoreApi();

  // Live resize drag: size + position update straight through React Flow while
  // the pointer moves, then land in the doc once on release (so edges and
  // autosave see one clean change, exactly like a node drag).
  const resizing = useRef<{
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    atX: number;
    atY: number;
    sx: number;
    sy: number;
    w: number;
    h: number;
  } | null>(null);

  const finishResize = () => {
    const drag = resizing.current;
    resizing.current = null;
    if (!drag) return;
    queueSkipNextDocFit();
    const current = useDiagram.getState().doc;
    useDiagram.getState().setDoc(
      {
        ...current,
        nodes: current.nodes.map((n) =>
          n.id === id
            ? {
                ...n,
                size: {
                  width: Math.max(MIN_WIDTH, drag.w),
                  height: Math.max(MIN_HEIGHT, drag.h),
                },
              }
            : n,
        ),
      },
      { silent: true },
    );
  };

  const beginResize = (
    handle: (typeof RESIZE_HANDLES)[number],
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    event.stopPropagation();
    if (useDiagram.getState().busy) return;
    const node = useDiagram.getState().doc.nodes.find((n) => n.id === id);
    if (!node) return;
    const startX = event.clientX;
    const startY = event.clientY;
    resizing.current = {
      startX,
      startY,
      startW: data.width,
      startH: data.height,
      atX: node.position.x,
      atY: node.position.y,
      sx: handle.sx,
      sy: handle.sy,
      w: data.width,
      h: data.height,
    };

    const move = (pointer: PointerEvent) => {
      pointer.preventDefault();
      const drag = resizing.current;
      if (!drag) return;
      const zoom = store.getState().transform[2] || 1;
      const dx = (pointer.clientX - drag.startX) / zoom;
      const dy = (pointer.clientY - drag.startY) / zoom;
      const w = Math.max(MIN_WIDTH, Math.round(drag.startW + drag.sx * dx));
      const h = Math.max(MIN_HEIGHT, Math.round(drag.startH + drag.sy * dy));
      const px =
        drag.sx === -1 ? Math.round(drag.atX + (drag.startW - w)) : drag.atX;
      const py =
        drag.sy === -1 ? Math.round(drag.atY + (drag.startH - h)) : drag.atY;
      drag.w = w;
      drag.h = h;
      setNodes((nodes) =>
        nodes.map((n) =>
          n.id === id
            ? {
                ...n,
                position: { x: px, y: py },
                data: { ...n.data, width: w, height: h },
              }
            : n,
        ),
      );
    };

    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      finishResize();
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  useEffect(() => {
    if (editing) {
      setDraft(data.label);
      // Autofocus needs a tick — the input has only just mounted.
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [editing, data.label]);

  const finishEditing = (commit: boolean) => {
    if (commit) commitLabel(id, draft);
    setEditing(false);
  };

  const borderStyle = data.style?.borderStyle;
  const opacity = data.style?.opacity;
  const fontSize = data.style?.fontSize;
  const NodeIcon = typeof data.icon === "string" ? ICON_BY_KEY.get(data.icon) : undefined;
  // Only when the user actually picked a colour (not a diagram-type default
  // tint) — see awsIcons.tsx: this is what tells a branded AWS badge icon to
  // drop its fixed category colour and follow the node's instead, the same
  // way every plain icon already does via `currentColor`.
  const iconAccent = typeof data.style?.color === "string" ? color?.ink : undefined;

  return (
    <div
      className={`node node--${shape} node--kind-${data.kind} ${textOnly ? "node--text-only" : ""} ${selected ? "is-selected" : ""} ${data.justAdded ? "node--just-added" : ""}`}
      style={{
        width: data.width,
        height: data.height,
        ...(color && {
          background: color.bg,
          borderColor: color.line,
          color: color.ink,
        }),
        ...(typeof borderStyle === "string" &&
          borderStyle !== "solid" && {
            borderStyle: borderStyle as "dashed" | "dotted",
          }),
        ...(typeof opacity === "number" && { opacity }),
        ...(typeof fontSize === "number" && { fontSize }),
      }}
      title={data.description ?? undefined}
      onDoubleClick={(event) => {
        if (data.imageUrl) return; // nothing to rename — the label isn't shown
        event.stopPropagation();
        setEditing(true);
      }}
    >
      <Handle type="target" position={Position.Left} className="node__port" />
      <Handle
        type="target"
        position={Position.Top}
        className="node__port"
        id="t"
      />
      {data.imageUrl ? (
        <img
          className="node__image"
          src={data.imageUrl}
          alt=""
          draggable={false}
        />
      ) : editing ? (
        <input
          ref={inputRef}
          className="node__label-input nodrag"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => finishEditing(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              finishEditing(true);
            } else if (event.key === "Escape") {
              event.preventDefault();
              finishEditing(false);
            }
          }}
        />
      ) : (
        <>
          {/* An unknown key (the catalogue moved on, or the model invented
              one) simply renders no icon rather than breaking the node. */}
          {NodeIcon && (
            <span className="node__icon" aria-hidden="true">
              <NodeIcon size={17} strokeWidth={1.7} color={iconAccent} />
            </span>
          )}
          <span className="node__label">{data.label}</span>
        </>
      )}
      <Handle type="source" position={Position.Right} className="node__port" />
      <Handle
        type="source"
        position={Position.Bottom}
        className="node__port"
        id="b"
      />
      {selected && <ResizeCorners onStart={beginResize} />}
    </div>
  );
}

export function LaneNode({ data }: NodeProps<FlowNode>) {
  return (
    <div
      className="lane lane--group-label"
      style={{ width: data.width, height: data.height }}
    >
      <div className="lane__title">{data.label}</div>
    </div>
  );
}

/** The diagram's title and summary, drawn as a heading above the flow — a
 *  title block, the way a technical drawing has one, rather than a fact only
 *  visible in the top bar's editable field. */
export function TitleBlock({ data }: NodeProps<FlowNode>) {
  if (!data.title) return null;
  return (
    <div className="title-block" style={{ width: data.width }}>
      <h2 className="title-block__title">{data.title}</h2>
      {data.summary && <p className="title-block__summary">{data.summary}</p>}
    </div>
  );
}

export const nodeTypes = {
  diagram: DiagramNode,
  lane: LaneNode,
  title: TitleBlock,
};
