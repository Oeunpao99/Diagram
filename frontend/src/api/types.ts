/** Mirrors backend/app/schemas/diagram.py. Keep the two in step. */

export type NodeKind =
  | "start"
  | "end"
  | "process"
  | "decision"
  | "document"
  | "data"
  | "database"
  | "actor"
  | "system"
  | "service"
  | "queue"
  | "cloud"
  | "note";

export type EdgeStyle = "solid" | "dashed" | "dotted" | "animated";

/** Connector routing used by React Flow when drawing a link line. */
export type EdgeCurve = "smoothstep" | "step" | "bezier" | "straight";
export type Direction = "LR" | "RL" | "TB" | "BT";

export type DiagramType =
  | "process_flow"
  | "swimlane"
  | "architecture"
  | "network"
  | "sequence"
  | "er"
  | "data_flow"
  | "org_chart"
  | "mind_map";

export interface DiagramNode {
  id: string;
  label: string;
  kind: NodeKind;
  description?: string | null;
  lane?: string | null;
  position: { x: number; y: number };
  size: { width: number; height: number };
  style?: Record<string, unknown>;
  icon?: string | null;
  image_url?: string | null;
  locked?: boolean;
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  label?: string | null;
  style: EdgeStyle;
  condition?: string | null;
  bidirectional?: boolean;
  /** Connector shape; undefined keeps the default smoothstep routing. */
  curve?: EdgeCurve | null;
  /** Stroke colour, a hex string; undefined/null keeps the theme default. */
  color?: string | null;
  /** Stroke width in pixels; undefined/null keeps the 1.5 default. */
  width?: number | null;
}

export interface Lane {
  id: string;
  label: string;
  order: number;
  color?: string | null;
}

export interface DiagramDoc {
  title: string;
  diagram_type: DiagramType;
  direction: Direction;
  summary?: string | null;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  lanes: Lane[];
  meta: Record<string, unknown>;
}

export interface Issue {
  level: "error" | "warning" | "info";
  category: "structural" | "business" | "visual";
  message: string;
  node_ids: string[];
  edge_ids: string[];
  fixable: boolean;
}

export interface ValidationReport {
  ok: boolean;
  node_count: number;
  edge_count: number;
  lane_count: number;
  issues: Issue[];
}

export interface ImprovedPrompt {
  original: string;
  improved: string;
  missing_information: string[];
  recommended_type: DiagramType;
  recommended_template_slug: string | null;
  reasoning: string | null;
}

export interface GenerateResult {
  diagram_id: string | null;
  doc: DiagramDoc;
  validation: ValidationReport;
  notes: string[];
}

export interface EditResult {
  doc: DiagramDoc;
  changes: string[];
  validation: ValidationReport;
}

export interface Template {
  id: string;
  name: string;
  slug: string;
  category: string;
  diagram_type: DiagramType;
  description: string | null;
  keywords: string[];
  data: DiagramDoc;
}

export const emptyDoc = (): DiagramDoc => ({
  title: "Untitled diagram",
  diagram_type: "process_flow",
  direction: "LR",
  nodes: [],
  edges: [],
  lanes: [],
  meta: {},
});

/** Templates are stored as nearly-raw dicts: nodes may lack `position`/`size`
 *  and non-swimlane entries skip `lanes` entirely. Fill every field so the
 *  adapter and layout engine never read a missing lane or coordinate. */
export function normalizeDoc(raw: Partial<DiagramDoc>): DiagramDoc {
  const base = emptyDoc();
  return {
    ...base,
    ...raw,
    title: raw.title ?? base.title,
    diagram_type: raw.diagram_type ?? base.diagram_type,
    direction: raw.direction ?? base.direction,
    summary: raw.summary ?? null,
    lanes: raw.lanes ?? [],
    edges: (raw.edges ?? []).map((edge) => ({
      ...edge,
      label: edge.label ?? null,
      style: edge.style ?? "solid",
      condition: edge.condition ?? null,
      bidirectional: edge.bidirectional ?? false,
      curve: edge.curve ?? null,
      color: edge.color ?? null,
      width: edge.width ?? null,
    })),
    nodes: (raw.nodes ?? []).map((node) => ({
      ...node,
      position: node.position ?? { x: 0, y: 0 },
      size: node.size ?? { width: 180, height: 64 },
      description: node.description ?? null,
      lane: node.lane ?? null,
      image_url: node.image_url ?? null,
      icon: node.icon ?? null,
      locked: node.locked ?? false,
    })),
    meta: raw.meta ?? {},
  };
}

/* --- auth ---------------------------------------------------------------- */

export type Theme = "system" | "light" | "dark";
export type Accent = "emerald" | "violet" | "blue" | "amber" | "rose";

export interface User {
  id: string;
  email: string;
  name: string;
  theme: Theme;
  accent: Accent;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}
