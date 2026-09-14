import { MarkerType, type Edge, type Node } from "@xyflow/react";

import type { DiagramDoc, DiagramNode, EdgeCurve, EdgeStyle, NodeKind } from "./types";

export interface NewNodeSpec {
  id: string;
  label: string;
  kind: NodeKind;
  position: { x: number; y: number };
  description?: string | null;
  lane?: string | null;
  imageUrl?: string | null;
  size?: { width: number; height: number };
  style?: Record<string, unknown>;
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
    style: spec.style ?? {},
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
  style?: DiagramNode["style"];
  width: number;
  height: number;
  /** Set for exactly one sync — the one where an edit introduced this node —
   *  so it can get a brief "just landed" highlight. Never persisted. */
  justAdded?: boolean;
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
        style: node.style,
        width: node.size.width,
        height: node.size.height,
      },
    });
  }

  const edges: Edge[] = doc.edges.map((edge) => {
    // Line pattern dash arrays. "animated" rides React Flow's own animated
    // dash; the rest get an explicit strokeDasharray.
    const dash: Record<EdgeStyle, string | undefined> = {
      solid: undefined,
      dashed: "5 4",
      dotted: "1.5 5",
      animated: undefined,
    };
    const stroke = edge.color ?? undefined;
    const strokeWidth = edge.width ?? undefined;
    const type: Record<EdgeCurve, string> = {
      smoothstep: "smoothstep",
      step: "step",
      straight: "straight",
      bezier: "default",
    };
    const marker = { type: MarkerType.ArrowClosed, width: 16, height: 16, color: stroke };
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label ?? edge.condition ?? undefined,
      type: edge.curve ? type[edge.curve] : "smoothstep",
      animated: edge.style === "animated",
      markerEnd: marker,
      markerStart: edge.bidirectional ? marker : undefined,
      style: {
        ...(dash[edge.style] ? { strokeDasharray: dash[edge.style] } : {}),
        ...(stroke ? { stroke } : {}),
        ...(strokeWidth ? { strokeWidth } : {}),
      },
      labelBgPadding: [6, 3] as [number, number],
      labelBgBorderRadius: 3,
    };
  });

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
        // Reverse the React Flow -> doc curve mapping ("default" is bezier.
        // React Flow only emits a `type` we set, so a plain default empty
        // edge that was never styled simply stays null.)
        const curve =
          e.type === "default"
            ? ("bezier" as const)
            : e.type === "smoothstep" || e.type === "step" || e.type === "straight"
              ? (e.type as EdgeCurve)
              : (original?.curve ?? null);
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          label: typeof e.label === "string" ? e.label : (original?.label ?? null),
          style: original?.style ?? (e.animated ? "animated" : "solid"),
          condition: original?.condition ?? null,
          bidirectional: original?.bidirectional ?? false,
          curve,
          color: typeof e.style?.stroke === "string" ? e.style.stroke : (original?.color ?? null),
          width:
            typeof e.style?.strokeWidth === "number" ? e.style.strokeWidth : (original?.width ?? null),
        };
      }),
  };
}
