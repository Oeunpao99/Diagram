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
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import type { FlowNode } from "../api/adapter";
import type { NodeKind } from "../api/types";
import { queueSkipNextDocFit } from "../lib/docFit";
import { NODE_COLORS, resolveNodeColor } from "../lib/nodeColor";
import { textFormatStyle, type TextFormat } from "../lib/textFormat";
import { useDiagram } from "../store/useDiagram";
import { wedgeIconAnchor, wedgeLeader, wedgePathD, type WedgeGeometry } from "../lib/wedgePath";
import { ICON_CATALOG } from "./iconCatalog";

// Re-exported for EdgeToolbar.tsx / StylePanel.tsx, which already import the
// palette from here rather than the shared lib directly.
export { NODE_COLORS };

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
  system: "component",
  service: "component",
  queue: "queue",
  cloud: "cloud",
  note: "note",
  wedge: "wedge",
  hub: "hub",
  circle: "circle",
  hexagon: "hexagon",
  octagon: "octagon",
  triangle: "triangle",
  pentagon: "pentagon",
  star: "star",
  tag: "tag",
  arrow: "arrow",
};

function nodeColor(data: FlowNode["data"], diagramType?: string) {
  const color = typeof data.style?.color === "string" ? data.style.color : null;
  return resolveNodeColor(data.kind, color, !!data.imageUrl, diagramType);
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

/** Same, for `description` — unlike the label, an empty value is a legitimate
 *  "clear it" rather than a "still loading" sentinel, so blank is allowed. */
function commitDescription(id: string, description: string) {
  const trimmed = description.trim();
  const current = useDiagram.getState().doc;
  useDiagram.getState().setDoc(
    {
      ...current,
      nodes: current.nodes.map((n) =>
        n.id === id ? { ...n, description: trimmed || null } : n,
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
  // Wedge-only: its description renders as real on-canvas text (every other
  // kind only ever shows it as a hover tooltip), so it's the one place a
  // description needs its own independent edit target, separate from the
  // label above it.
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState(data.description ?? "");
  const descRef = useRef<HTMLTextAreaElement>(null);
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

  useEffect(() => {
    if (editingDesc) {
      setDescDraft(data.description ?? "");
      requestAnimationFrame(() => descRef.current?.select());
    }
  }, [editingDesc, data.description]);

  // A node dropped by double-click-on-canvas carries a one-shot `autoEdit`
  // flag from Canvas's doc-sync: open its label editor immediately so the
  // user can just start typing. The flag lives in Canvas's *controlled* node
  // props, so this effect must not try to clear it via setNodes — writing to
  // React Flow's internal store would fight the parent's controlled `nodes`
  // prop and loop (each write gets reconciled back from the prop, re-firing
  // this effect). A local ref only ever opens the editor once per mount.
  const autoOpened = useRef(false);
  useEffect(() => {
    if (!data.autoEdit || autoOpened.current) return;
    autoOpened.current = true;
    setEditing(true);
  }, [data.autoEdit]);

  const finishEditing = (commit: boolean) => {
    if (commit) commitLabel(id, draft);
    setEditing(false);
  };

  const finishEditingDesc = (commit: boolean) => {
    if (commit) commitDescription(id, descDraft);
    setEditingDesc(false);
  };

  const borderStyle = data.style?.borderStyle;
  const opacity = data.style?.opacity;
  const fontSize = data.style?.fontSize;
  const NodeIcon = typeof data.icon === "string" ? ICON_BY_KEY.get(data.icon) : undefined;
  // Only when the user actually picked a colour (not a diagram-type default
  // tint) — every plain (lucide-react) icon in the catalog follows the node
  // via `currentColor`. The AWS/Azure official service icons (awsServiceIcons
  // / azureServiceIcons) don't take a `color` prop at all and silently ignore
  // this — their artwork is fixed by the providers' icon usage terms, which
  // is also why this app never offers to recolour them.
  const iconAccent = typeof data.style?.color === "string" ? color?.ink : undefined;

  if (shape === "wedge") {
    const s = data.style ?? {};
    const geo: WedgeGeometry | null =
      typeof s.startAngle === "number" && typeof s.endAngle === "number"
        ? {
            centerX: Number(s.centerX ?? 0),
            centerY: Number(s.centerY ?? 0),
            startAngle: Number(s.startAngle),
            endAngle: Number(s.endAngle),
            innerRadius: Number(s.innerRadius ?? 0),
            outerRadius: Number(s.outerRadius ?? 0),
            labelRadius: Number(s.labelRadius ?? 0),
            labelSide: s.labelSide === "left" ? "left" : "right",
          }
        : null;
    // Layout hasn't computed this wedge's angle/radius yet (the instant
    // after a template lands, before autoLayout resolves) — nothing sane to
    // draw, so render nothing rather than a stray full-size box.
    if (!geo) return null;

    const badgeRadius = 18;
    const fill = color?.bg ?? "#94a3b8";
    const stroke = color?.line ?? "#475569";
    const iconAnchor = wedgeIconAnchor(geo);
    const { from: leaderFrom, to: leaderTo } = wedgeLeader(geo);
    const onRight = geo.labelSide === "right";
    const labelStyle = {
      top: leaderTo.y,
      ...(onRight ? { left: leaderTo.x } : { right: data.width - leaderTo.x }),
    };
    const titleFormat = data.style?.titleFormat as TextFormat | undefined;
    const descFormat = data.style?.descFormat as TextFormat | undefined;
    const titleFormatStyle = textFormatStyle(titleFormat);
    const descFormatStyle = textFormatStyle(descFormat);

    // Capture, not bubble — see the comment on the default branch's own
    // handler below for why locked nodes need this. Handlers live on the
    // specific leaf elements (arc, title, description) rather than one
    // shared wrapper handler, so double-clicking the description edits
    // *that* — not the label — even though both sit inside the same
    // positioned label box.
    const editLabelOnDoubleClick = (event: ReactMouseEvent) => {
      event.stopPropagation();
      setEditing(true);
    };
    const editDescOnDoubleClick = (event: ReactMouseEvent) => {
      event.stopPropagation();
      setEditingDesc(true);
    };

    return (
      <div
        className={`node node--wedge ${selected ? "is-selected" : ""} ${data.justAdded ? "node--just-added" : ""}`}
        style={{ width: data.width, height: data.height }}
        title={data.description ?? undefined}
      >
        <svg className="node__wedge-svg" onDoubleClickCapture={editLabelOnDoubleClick}>
          <path d={wedgePathD(geo)} fill={fill} stroke={stroke} strokeWidth={1.5} />
          <line
            x1={leaderFrom.x}
            y1={leaderFrom.y}
            x2={leaderTo.x}
            y2={leaderTo.y}
            stroke={stroke}
            strokeWidth={1.5}
          />
        </svg>
        <div
          className="node__wedge-badge"
          style={{
            left: iconAnchor.x - badgeRadius,
            top: iconAnchor.y - badgeRadius,
            width: badgeRadius * 2,
            height: badgeRadius * 2,
            borderColor: stroke,
          }}
        >
          {NodeIcon && <NodeIcon size={16} strokeWidth={1.8} color={stroke} />}
        </div>
        {editing ? (
          <input
            ref={inputRef}
            className="node__wedge-label-input nodrag"
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
            style={{ ...labelStyle, ...titleFormatStyle }}
          />
        ) : (
          <div
            className={`node__wedge-label ${onRight ? "node__wedge-label--right" : "node__wedge-label--left"}`}
            style={labelStyle}
          >
            <div
              className="node__wedge-label-title"
              onDoubleClickCapture={editLabelOnDoubleClick}
              style={titleFormatStyle}
            >
              {data.label}
            </div>
            {editingDesc ? (
              <textarea
                ref={descRef}
                className="node__wedge-desc-input nodrag"
                rows={3}
                value={descDraft}
                onChange={(event) => setDescDraft(event.target.value)}
                onBlur={() => finishEditingDesc(true)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    finishEditingDesc(false);
                  }
                  // Enter is left alone — a description is free text and
                  // reasonably wants real line breaks, unlike the one-line label.
                }}
                style={descFormatStyle}
              />
            ) : (
              data.description && (
                <div
                  className="node__wedge-label-desc"
                  onDoubleClickCapture={editDescOnDoubleClick}
                  style={descFormatStyle}
                >
                  {data.description}
                </div>
              )
            )}
          </div>
        )}
      </div>
    );
  }

  // Only a hub ever carries this — the shared `Color`/`Line`/`Font size`
  // sections in StylePanel are hidden for it in favour of the same "Title
  // text" section a wedge gets, since a hub is really just this same shared
  // box shape with one piece of rich text on it.
  const hubTitleFormat =
    shape === "hub" ? textFormatStyle(data.style?.titleFormat as TextFormat | undefined) : undefined;

  return (
    <>
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
      // Capture, not bubble — see the wedge branch above for why: a locked
      // (non-draggable) node's bubble-phase dblclick never reaches React's
      // root dispatcher, so hub (also locked) needs this exact same fix.
      // Harmless for every draggable kind too, so there's no need to branch.
      onDoubleClickCapture={(event) => {
        if (data.imageUrl) return; // nothing to rename — the label isn't shown
        event.stopPropagation();
        setEditing(true);
      }}
    >
      {/* Text/label nodes have no connector ports — they're captions, not
          shapes you link into the flow, so no dots to drag a connection from
          (or toward). Rendering nothing beats hiding by CSS: NodeRenderer
          only ever produces a handle for a rendered <Handle>, so an
          unrendered port is also a non-connectable one. */}
      {!textOnly && (
        <>
          <Handle type="target" position={Position.Left} className="node__port" />
          <Handle
            type="target"
            position={Position.Top}
            className="node__port"
            id="t"
          />
        </>
      )}
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
          style={hubTitleFormat}
        />
      ) : (
        <>
          {/* An unknown key (the catalogue moved on, or the model invented
              one) simply renders no icon rather than breaking the node. */}
          {NodeIcon && (
            <span className="node__icon" aria-hidden="true">
              <NodeIcon size={18} strokeWidth={1.7} color={iconAccent} />
            </span>
          )}
          <span className="node__label" style={hubTitleFormat}>
            {data.label}
          </span>
        </>
      )}
      {!textOnly && (
        <>
          <Handle type="source" position={Position.Right} className="node__port" />
          <Handle
            type="source"
            position={Position.Bottom}
            className="node__port"
            id="b"
          />
        </>
      )}
      </div>
      {/* The corners are a sibling of `.node`, not a child of it. clip-path —
          the diamond, and every palette clip shape — clips the whole element's
          paint, handles included, so as children they were invisible and
          dead (the box corners sit outside every polygon). As a sibling they
          land on the wrapper's containing box, which is exactly the node box,
          so they sit in the same corners and stay draggable on every shape. */}
      {selected && <ResizeCorners onStart={beginResize} />}
    </>
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

/** A nested boundary box — a VNet, a subnet, an account. The body is
 *  `pointer-events: none` in CSS so a container spanning half the canvas never
 *  swallows clicks meant for the nodes drawn on top of it; only the header
 *  strip is interactive. */
export function GroupNode({ id, data, selected }: NodeProps<FlowNode>) {
  const depth = typeof data.depth === "number" ? data.depth : 0;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) {
      setDraft(data.label);
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [editing, data.label]);

  const commit = (save: boolean) => {
    const trimmed = draft.trim();
    if (save && trimmed) {
      const current = useDiagram.getState().doc;
      useDiagram.getState().setDoc(
        {
          ...current,
          groups: (current.groups ?? []).map((g) =>
            g.id === id.replace(/^group__/, "") ? { ...g, label: trimmed } : g,
          ),
        },
        { silent: true },
      );
    }
    setEditing(false);
  };

  return (
    <div
      className={`group-box ${selected ? "is-selected" : ""}`}
      data-depth={Math.min(depth, 4)}
      style={{ width: data.width, height: data.height }}
    >
      <div
        className="group-box__header"
        onDoubleClick={(event) => {
          event.stopPropagation();
          setEditing(true);
        }}
      >
        {editing ? (
          <input
            ref={inputRef}
            className="group-box__input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => commit(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter") commit(true);
              if (event.key === "Escape") commit(false);
              event.stopPropagation();
            }}
            // The header is the drag handle; a pointer-down here would start
            // dragging the container instead of placing the caret.
            onPointerDown={(event) => event.stopPropagation()}
          />
        ) : (
          data.label
        )}
      </div>
    </div>
  );
}

export const nodeTypes = {
  diagram: DiagramNode,
  lane: LaneNode,
  title: TitleBlock,
  group: GroupNode,
};
