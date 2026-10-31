import { Background, BackgroundVariant, ReactFlow } from "@xyflow/react";
import { useMemo } from "react";

import { toFlow } from "../../api/adapter";
import type { DiagramDoc } from "../../api/types";
import { FlowEdge } from "../../components/FlowEdge";
import { nodeTypes } from "../../components/nodes";

const edgeTypes = { smoothstep: FlowEdge };

/** A read-only canvas built from the editor's own pieces — the same node
 *  renderers, edge router, theme tokens and dotted grid. `revealed` shows
 *  only the first N nodes (and the links between them) so a diagram can be
 *  drawn in step by step. */
export function DemoCanvas({ doc, revealed }: { doc: DiagramDoc; revealed?: number }) {
  const flow = useMemo(() => toFlow(doc), [doc]);
  const limit = revealed ?? doc.nodes.length;
  const shown = new Set(doc.nodes.slice(0, limit).map((node) => node.id));

  const nodes = flow.nodes
    .filter((node) => node.type === "diagram")
    .map((node) => ({
      ...node,
      draggable: false,
      selectable: false,
      focusable: false,
      style: {
        opacity: shown.has(node.id) ? 1 : 0,
        transform: shown.has(node.id) ? undefined : "scale(0.94)",
        transition: "opacity 0.35s ease",
      },
    }));

  const edges = flow.edges.map((edge) => {
    const on = shown.has(edge.source) && shown.has(edge.target);
    return {
      ...edge,
      label: on ? edge.label : undefined,
      style: { ...edge.style, opacity: on ? 1 : 0, transition: "opacity 0.35s ease" },
    };
  });

  return (
    <div className="pointer-events-none h-full w-full" aria-hidden="true">
      <ReactFlow
        key={doc.title}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        proOptions={{ hideAttribution: true }}
        minZoom={0.1}
        fitView
        fitViewOptions={{ padding: 0.14 }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.2}
          style={{ background: "var(--paper)" }}
        />
      </ReactFlow>
    </div>
  );
}
