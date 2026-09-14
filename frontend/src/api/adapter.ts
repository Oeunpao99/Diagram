import { MarkerType, type Edge, type EdgeMarkerType, type Node } from "@xyflow/react";

import type {
  DiagramDoc,
  DiagramNode,
  EdgeArrow,
  EdgeCurve,
  EdgeStyle,
  NodeKind,
} from "./types";

/** Line dash patterns, shared with the connector toolbar's own previews so
 *  the popup glyphs always match what actually renders on the canvas. */
export const EDGE_DASH: Record<EdgeStyle, string | undefined> = {
  solid: undefined,
  dashed: "5 4",
  dotted: "1.5 5",
  dashdot: "6 2.5 1.5 2.5",
  longdash: "10 5",
  animated: "7 6",
};

/** IDs of the custom `<marker>` defs rendered once by Canvas (circle/diamond
 *  aren't in React Flow's built-in MarkerType, so these are hand-rolled SVG
 *  markers referenced by id; see the defs for the matching shapes). */
const CUSTOM_MARKER_ID: Partial<Record<EdgeArrow, string>> = {
  circle: "edge-marker-circle",
  diamond: "edge-marker-diamond",
};

/** Resolves one end's arrow choice to whatever React Flow's `markerEnd` /
 *  `markerStart` prop expects: its own coloured MarkerType for arrow/triangle,
 *  or a bare fragment id into our custom defs for circle/diamond — React Flow
 *  wraps a string marker in `url('#…')` itself, so passing an already-wrapped
 *  "url(#id)" here would double-wrap it into a dead reference — or undefined
 *  for no marker at all. */
function markerFor(
  arrow: EdgeArrow,
  color: string | undefined,
): EdgeMarkerType | undefined {
  const customId = CUSTOM_MARKER_ID[arrow];
  if (customId) return customId;
  if (arrow === "arrow") return { type: MarkerType.Arrow, width: 16, height: 16, color };
  if (arrow === "triangle") return { type: MarkerType.ArrowClosed, width: 16, height: 16, color };
  return undefined;
}

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
  /** Key into ICON_CATALOG — a small glyph drawn beside the label, the way a
   *  service/architecture diagram names what a box actually is. Unlike
   *  `imageUrl` (which replaces the label entirely with a standalone image
   *  node), this sits alongside the label on a normal node. */
  icon?: string | null;
  style?: DiagramNode["style"];
  width: number;
  height: number;
  /** Set for exactly one sync — the one where an edit introduced this node —
   *  so it can get a brief "just landed" highlight. Never persisted. */
  justAdded?: boolean;
  /** Only set on the synthetic "title" node — the diagram's title/summary,
   *  drawn as a heading above the flow instead of living only in the top
   *  bar's title field. */
  title?: string;
  summary?: string | null;
}

export type FlowNode = Node<FlowNodeData, "diagram" | "lane" | "title">;

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
        icon: node.icon,
        style: node.style,
        width: node.size.width,
        height: node.size.height,
      },
    });
  }

  // A heading drawn on the canvas itself, not just in the top bar's title
  // field — `summary` in particular is generated on every AI diagram but,
  // until this, never shown anywhere. Sits above whatever's topmost (a node,
  // or a lane band starting at y=0), pans and zooms with the diagram, and
  // exports with it since it's a real node, not an HTML overlay.
  if (doc.nodes.length > 0) {
    const minX = Math.min(...doc.nodes.map((n) => n.position.x));
    const minY = Math.min(0, ...doc.nodes.map((n) => n.position.y));
    nodes.push({
      id: "title__block",
      type: "title",
      draggable: false,
      selectable: false,
      focusable: false,
      zIndex: -1,
      position: { x: minX, y: minY - 130 },
      data: {
        label: "",
        kind: "note",
        title: doc.title,
        summary: doc.summary,
        width: 480,
        height: 90,
      },
    });
  }

  const edges: Edge[] = doc.edges.map((edge) => {
    const stroke = edge.color ?? undefined;
    const strokeWidth = edge.width ?? undefined;
    const type: Record<EdgeCurve, string> = {
      smoothstep: "smoothstep",
      step: "step",
      straight: "straight",
      bezier: "default",
    };
    // Null start/end arrows defer to the legacy `bidirectional` flag (older
    // saved diagrams) / the historical always-on end triangle.
    const startArrow = edge.start_arrow ?? (edge.bidirectional ? "triangle" : "none");
    const endArrow = edge.end_arrow ?? "triangle";
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.source_handle ?? undefined,
      targetHandle: edge.target_handle ?? undefined,
      label: edge.label ?? edge.condition ?? undefined,
      type: edge.curve ? type[edge.curve] : "smoothstep",
      animated: edge.style === "animated",
      markerEnd: markerFor(endArrow, stroke),
      markerStart: markerFor(startArrow, stroke),
      style: {
        ...(EDGE_DASH[edge.style] && edge.style !== "animated"
          ? { strokeDasharray: EDGE_DASH[edge.style] }
          : {}),
        ...(stroke ? { stroke } : {}),
        ...(strokeWidth ? { strokeWidth } : {}),
      },
      // React Flow renders the label as its own SVG <text>, styled
      // separately from the path above — this is the only way to give a
      // label its own colour/size independent of the line's.
      labelStyle: {
        ...(edge.label_color ? { fill: edge.label_color } : {}),
        ...(edge.label_font_size ? { fontSize: edge.label_font_size } : {}),
      },
      labelBgPadding: [6, 3] as [number, number],
      labelBgBorderRadius: 3,
    };
  });

  return { nodes, edges };
}

/** React Flow -> doc. Manual drags land back in the document here. */
export function fromFlow(
  doc: DiagramDoc,
  nodes: FlowNode[],
  edges: Edge[],
): DiagramDoc {
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
          source_handle: e.sourceHandle ?? original?.source_handle ?? null,
          target_handle: e.targetHandle ?? original?.target_handle ?? null,
          label: typeof e.label === "string" ? e.label : (original?.label ?? null),
          style: original?.style ?? (e.animated ? "animated" : "solid"),
          condition: original?.condition ?? null,
          bidirectional: original?.bidirectional ?? false,
          start_arrow: original?.start_arrow ?? null,
          end_arrow: original?.end_arrow ?? null,
          curve,
          color: typeof e.style?.stroke === "string" ? e.style.stroke : (original?.color ?? null),
          width:
            typeof e.style?.strokeWidth === "number"
              ? e.style.strokeWidth
              : (original?.width ?? null),
          label_color:
            typeof e.labelStyle?.fill === "string"
              ? e.labelStyle.fill
              : (original?.label_color ?? null),
          label_font_size:
            typeof e.labelStyle?.fontSize === "number"
              ? e.labelStyle.fontSize
              : (original?.label_font_size ?? null),
        };
      }),
  };
}
