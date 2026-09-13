import { Handle, Position, type NodeProps } from "@xyflow/react";

import type { FlowNode } from "../api/adapter";
import type { NodeKind } from "../api/types";

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

export function DiagramNode({ data, selected }: NodeProps<FlowNode>) {
  const shape = SHAPE[data.kind] ?? "box";
  return (
    <div
      className={`node node--${shape} node--kind-${data.kind} ${selected ? "is-selected" : ""}`}
      style={{ width: data.width, height: data.height }}
      title={data.description ?? undefined}
    >
      <Handle type="target" position={Position.Left} className="node__port" />
      <Handle type="target" position={Position.Top} className="node__port" id="t" />
      {data.imageUrl ? (
        <img className="node__image" src={data.imageUrl} alt="" draggable={false} />
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