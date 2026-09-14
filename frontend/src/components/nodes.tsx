import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useEffect, useRef, useState } from "react";

import type { FlowNode } from "../api/adapter";
import type { NodeKind } from "../api/types";
import { useDiagram } from "../store/useDiagram";

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
 *  is also accepted for arbitrary custom colours. */
export const NODE_COLORS: Record<string, { bg: string; line: string; ink: string }> = {
  teal: { bg: "#d8f2ef", line: "#0d9488", ink: "#0b423d" },
  emerald: { bg: "#d9f2e7", line: "#0d9f6e", ink: "#0a4a36" },
  blue: { bg: "#e3ecfc", line: "#2563eb", ink: "#173b78" },
  indigo: { bg: "#e4e2fb", line: "#4f46e5", ink: "#2a2268" },
  violet: { bg: "#ece9fd", line: "#6d5ae0", ink: "#33246b" },
  fuchsia: { bg: "#fae3fb", line: "#c026d3", ink: "#73177e" },
  rose: { bg: "#fbe3e0", line: "#c4372f", ink: "#6b140f" },
  orange: { bg: "#fbeddd", line: "#ea7a10", ink: "#6b3006" },
  amber: { bg: "#fcf0d8", line: "#b06f0e", ink: "#5a3a06" },
  slate: { bg: "#e7ebf0", line: "#5b6b7b", ink: "#1e293b" },
};

function hexRgb(hex: string): [number, number, number] | null {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixToward(rgb: [number, number, number], target: number, amount: number): string {
  const mixed = rgb.map((ch) => Math.round(ch + (target - ch) * amount));
  const [r, g, b] = mixed;
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function nodeColor(data: FlowNode["data"]) {
  const key = typeof data.style?.color === "string" ? data.style.color : null;
  if (key && key in NODE_COLORS) return NODE_COLORS[key];
  if (key?.startsWith("#")) {
    const rgb = hexRgb(key);
    if (rgb) {
      const luma = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
      return {
        bg: mixToward(rgb, 255, 0.8),
        line: key,
        ink: luma > 150 ? "#1e293b" : "#ffffff",
      };
    }
  }
  return undefined;
}

function ResizeCorners() {
  return (
    <>
      <i className="node__corner node__corner--tl" />
      <i className="node__corner node__corner--tr" />
      <i className="node__corner node__corner--bl" />
      <i className="node__corner node__corner--br" />
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
      nodes: current.nodes.map((n) => (n.id === id ? { ...n, label: trimmed } : n)),
    },
    { silent: true },
  );
}

export function DiagramNode({ id, data, selected }: NodeProps<FlowNode>) {
  const shape = SHAPE[data.kind] ?? "box";
  const color = nodeColor(data);
  const textOnly = data.style?.textOnly === true;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label);
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div
      className={`node node--${shape} node--kind-${data.kind} ${textOnly ? "node--text-only" : ""} ${selected ? "is-selected" : ""} ${data.justAdded ? "node--just-added" : ""}`}
      style={{
        width: data.width,
        height: data.height,
        ...(color && { background: color.bg, borderColor: color.line, color: color.ink }),
      }}
      title={data.description ?? undefined}
      onDoubleClick={(event) => {
        if (data.imageUrl) return; // nothing to rename — the label isn't shown
        event.stopPropagation();
        setEditing(true);
      }}
    >
      <Handle type="target" position={Position.Left} className="node__port" />
      <Handle type="target" position={Position.Top} className="node__port" id="t" />
      {data.imageUrl ? (
        <img className="node__image" src={data.imageUrl} alt="" draggable={false} />
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
        <span className="node__label">{data.label}</span>
      )}
      <Handle type="source" position={Position.Right} className="node__port" />
      <Handle type="source" position={Position.Bottom} className="node__port" id="b" />
      {selected && <ResizeCorners />}
    </div>
  );
}

export function LaneNode({ data }: NodeProps<FlowNode>) {
  return (
    <div className="lane lane--group-label" style={{ width: data.width, height: data.height }}>
      <div className="lane__title">{data.label}</div>
    </div>
  );
}

export const nodeTypes = { diagram: DiagramNode, lane: LaneNode };