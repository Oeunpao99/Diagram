import { MarkerType, type Edge, type Node } from "@xyflow/react";

import type { DiagramDoc, DiagramNode, NodeKind } from "./types";

export interface NewNodeSpec {
  id: string;
  label: string;
  kind: NodeKind;
  position: { x: number; y: number };
  description?: string | null;
  lane?: string | null;
  imageUrl?: string | null;
  size?: { width: number; height: number };
}

/** A complete DiagramNode with defaults, for canvas insertions (assets, drops). */
export function makeNode(spec: NewNodeSpec): DiagramNode {
  return {
    id: spec.id,
    label: spec.label,
    kind: spec.kind,
    description: spec.description ?? null,
    lane: spec.lane ?? null,
    position: spec.position,
    size: spec.size ?? (spec.imageUrl ? { width: 200, height: 140 } : { width: 170, height: 64 }),
    style: {},
    icon: null,
    image_url: spec.imageUrl ?? null,
    locked: false,
  };
}

export interface FlowNodeData extends Record<string, unknown> {
  label: string;
  kind: NodeKind;
  description?: string | null;
  lane?: string | null;
  imageUrl?: string | null;
  width: number;
  height: number;
}

export type FlowNode = Node<FlowNodeData, "diagram" | "lane">;

/** doc -> React Flow. Lanes become non-interactive background bands. */
export function toFlow(doc: DiagramDoc): { nodes: FlowNode[]; edges: Edge[] } {
  const nodes: FlowNode[] = [];

  const thickness = Number(doc.meta?.lane_thickness ?? 0);
  const span = Number(doc.meta?.lane_span ?? 0);
  const axis = (doc.meta?.lane_axis as string) ?? "y";

  if (doc.lanes?.length && thickness) {
    [...doc.lanes]
      .sort((a, b) => a.order - b.order)
      .forEach((lane, index) => {
        const along = index * thickness;
        nodes.push({
          id: `lane__${lane.id}`,
          type: "lane",
          draggable: false,
          selectable: false,
          focusable: false,
          zIndex: -1,
          position: axis === "y" ? { x: 0, y: along } : { x: along, y: 0 },
          data: {
            label: lane.label,
            kind: "note",
            width: axis === "y" ? span : thickness,
            height: axis === "y" ? thickness : span,
          },
          style: {
            width: axis === "y" ? span : thickness,
            height: axis === "y" ? thickness : span,
          },
        });
      });
  }

  for (const node of doc.nodes) {
    nodes.push({
      id: node.id,
      type: "diagram",
      position: { x: node.position.x, y: node.position.y },
      draggable: !node.locked,
      data: {
        label: node.label,
        kind: node.kind,
        description: node.description,
        lane: node.lane,
        imageUrl: node.image_url,
        width: node.size.width,
        height: node.size.height,
      },
    });
  }

  const edges: Edge[] = doc.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label ?? edge.condition ?? undefined,
    type: "smoothstep",
    animated: edge.style === "animated",
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    markerStart: edge.bidirectional
      ? { type: MarkerType.ArrowClosed, width: 16, height: 16 }
      : undefined,
    style: edge.style === "dashed" ? { strokeDasharray: "5 4" } : undefined,
    labelBgPadding: [6, 3] as [number, number],
    labelBgBorderRadius: 3,
  }));

  return { nodes, edges };
}

/** React Flow -> doc. Manual drags land back in the document here. */
export function fromFlow(doc: DiagramDoc, nodes: FlowNode[], edges: Edge[]): DiagramDoc {
  const positions = new Map(nodes.map((n) => [n.id, n.position]));
  const live = new Set(nodes.filter((n) => n.type === "diagram").map((n) => n.id));

  const nextNodes: DiagramNode[] = nodes
    .filter((n) => n.type === "diagram")
    .map((n) => {
      const original = doc.nodes.find((d) => d.id === n.id);
      return {
        ...(original ?? {
          id: n.id,
          style: {},
          locked: false,
          description: null,
          image_url: null,
          icon: null,
        }),
        id: n.id,
        label: n.data.label,
        kind: n.data.kind,
        description: n.data.description ?? null,
        lane: n.data.lane ?? null,
        position: positions.get(n.id) ?? { x: 0, y: 0 },
        size: { width: n.data.width, height: n.data.height },
      } as DiagramNode;
    });

  return {
    ...doc,
    nodes: nextNodes,
    edges: edges
      .filter((e) => live.has(e.source) && live.has(e.target))
      .map((e) => {
        const original = doc.edges.find((d) => d.id === e.id);
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          label: typeof e.label === "string" ? e.label : (original?.label ?? null),
          style: original?.style ?? (e.animated ? "animated" : "solid"),
          condition: original?.condition ?? null,
          bidirectional: original?.bidirectional ?? false,
        };
      }),
  };
}
