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
  | "note"
  | "wedge"
  | "hub"
  | "circle"
  | "hexagon"
  | "octagon"
  | "triangle"
  | "pentagon"
  | "star"
  | "tag"
  | "arrow";

export type EdgeStyle = "solid" | "dashed" | "dotted" | "dashdot" | "longdash" | "animated";

/** Connector routing used by React Flow when drawing a link line. */
export type EdgeCurve = "smoothstep" | "step" | "bezier" | "straight";

/** Marker drawn at one end of a connector. */
export type EdgeArrow = "none" | "arrow" | "triangle" | "circle" | "diamond";
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
  | "mind_map"
  | "tree"
  | "radial";

export interface DiagramNode {
  id: string;
  label: string;
  kind: NodeKind;
  description?: string | null;
  lane?: string | null;
  group?: string | null;
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
  /** React Flow handle id the link leaves from; null = default (Right port). */
  source_handle?: string | null;
  /** React Flow handle id the link lands on; null = default (Left port). */
  target_handle?: string | null;
  label?: string | null;
  style: EdgeStyle;
  condition?: string | null;
  /** @deprecated superseded by start_arrow/end_arrow; kept for older saved diagrams. */
  bidirectional?: boolean;
  /** Marker at the source end; null/undefined defers to `bidirectional`. */
  start_arrow?: EdgeArrow | null;
  /** Marker at the target end; null/undefined defaults to a filled triangle. */
  end_arrow?: EdgeArrow | null;
  /** Connector shape; undefined keeps the default smoothstep routing. */
  curve?: EdgeCurve | null;
  /** Stroke colour, a hex string; undefined/null keeps the theme default. */
  color?: string | null;
  /** Stroke width in pixels; undefined/null keeps the 1.5 default. */
  width?: number | null;
  /** Label text colour, a hex string; undefined/null keeps the theme default. */
  label_color?: string | null;
  /** Label text size in pixels; undefined/null keeps the 10px default. */
  label_font_size?: number | null;
}

export interface Lane {
  id: string;
  label: string;
  order: number;
  color?: string | null;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A nested container. Unlike a Lane (a flat band perpendicular to the flow),
 *  a group nests to arbitrary depth via `parent` and takes its shape from what
 *  it holds — `rect` is derived by the backend layout, never authored. */
export interface Group {
  id: string;
  label: string;
  parent?: string | null;
  collapsed?: boolean;
  rect?: Rect | null;
}

export interface DiagramDoc {
  title: string;
  diagram_type: DiagramType;
  direction: Direction;
  summary?: string | null;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  lanes: Lane[];
  groups: Group[];
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
  group_count: number;
  issues: Issue[];
}

export interface ImprovedPrompt {
  original: string;
  /** True when the message is (trying to be) a diagram request. False for a
   *  greeting / small talk / thanks — then only `chat_reply` matters and the
   *  structured-analysis card is skipped. */
  is_diagram_request: boolean;
  /** Plain conversational reply for a non-diagram message, null otherwise. */
  chat_reply: string | null;
  improved: string;
  missing_information: string[];
  recommended_type: DiagramType | null;
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

export interface RouteResult {
  intent: "modify" | "ask";
  answer: string | null;
}

/** Actions the agent hands back for the browser to run — the ones that live
 *  in the canvas rather than the document. Document-level tools are applied
 *  server-side and arrive as an updated `doc`. */
export type ClientActionTool = "undo" | "redo" | "fit_view" | "zoom_in" | "zoom_out" | "select";

export interface AgentAction {
  tool: ClientActionTool;
  args: { ids?: string[] };
}

export interface AgentResult {
  /** "ask" answers in chat; "act" applied tool calls; "rewrite" went through
   *  the whole-document edit agent. */
  intent: "ask" | "act" | "rewrite";
  answer: string | null;
  /** Null when nothing about the document changed (a question, or an action
   *  that only touched the canvas). */
  doc: DiagramDoc | null;
  changes: string[];
  /** Steps the agent wanted but couldn't take. Shown to the user so a
   *  half-applied instruction doesn't read as a complete one. */
  warnings: string[];
  client_actions: AgentAction[];
  validation: ValidationReport | null;
}

/** One item of a live progress plan — see AgentStreamEvent below. */
export interface AgentPlanStep {
  id: string;
  label: string;
}

/** One earlier line of the conversation, sent along with a new chat message
 *  so a short reply ("all", "yes", "the second one") can resolve against
 *  the agent's own previous question instead of it re-asking. */
export interface ChatTurn {
  role: "user" | "ai";
  text: string;
}

/** One SSE event from the streaming /ai/agent/stream endpoint. `plan`
 *  announces one or more steps that are now known — a run can send this
 *  more than once (a layout step, say, only becomes knowable after the
 *  tool calls it depends on have actually run), so steps accumulate rather
 *  than replace. `step` reports that a given step id is done, with the real
 *  text for it. `result` carries the full AgentResult and is the last real
 *  event before the stream closes. */
export type AgentStreamEvent =
  | { type: "plan"; steps: AgentPlanStep[] }
  | { type: "step"; id: string; label: string }
  | { type: "result"; result: AgentResult }
  | { type: "error"; message: string };

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
  groups: [],
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
    groups: (raw.groups ?? []).map((group) => ({
      ...group,
      parent: group.parent ?? null,
      collapsed: group.collapsed ?? false,
      rect: group.rect ?? null,
    })),
    edges: (raw.edges ?? []).map((edge) => ({
      ...edge,
      label: edge.label ?? null,
      style: edge.style ?? "solid",
      condition: edge.condition ?? null,
      bidirectional: edge.bidirectional ?? false,
      start_arrow: edge.start_arrow ?? null,
      end_arrow: edge.end_arrow ?? null,
      source_handle: edge.source_handle ?? null,
      target_handle: edge.target_handle ?? null,
      curve: edge.curve ?? null,
      color: edge.color ?? null,
      width: edge.width ?? null,
      label_color: edge.label_color ?? null,
      label_font_size: edge.label_font_size ?? null,
    })),
    nodes: (raw.nodes ?? []).map((node) => ({
      ...node,
      position: node.position ?? { x: 0, y: 0 },
      size: node.size ?? { width: 180, height: 64 },
      description: node.description ?? null,
      lane: node.lane ?? null,
      group: node.group ?? null,
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
  // Null for a Telegram-only account — that provider never hands back an
  // email address at all.
  email: string | null;
  name: string;
  theme: Theme;
  accent: Accent;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

/** One line of the Copilot chat attached to a diagram — see useDiagram.ts's
 *  `messages`. `id` is a client-generated key (never reconciled against the
 *  server's own row id — nothing here edits or targets one message by id
 *  after the fact, only appends and bulk-clears). `changes`/`warnings`
 *  mirror a finished edit's checklist card so a restored message renders
 *  the same way it did live, not as plain markdown bullets. */
export interface ChatMessage {
  id: string;
  role: "user" | "ai";
  text: string;
  changes?: string[];
  warnings?: string[];
  created_at: string;
}

/** The Telegram Login Widget's callback payload, forwarded to the backend
 *  as-is — every field here (plus `hash`) is part of what gets verified
 *  server-side. See https://core.telegram.org/widgets/login */
export interface TelegramAuthPayload {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

/* --- saved diagrams ------------------------------------------------------- */

/** The compact row the /diagrams list returns — enough for a picker. */
export interface DiagramListItem {
  id: string;
  title: string;
  diagram_type: string;
  is_favorite: boolean;
  project_id: string | null;
  updated_at: string;
}

/** A folder of related diagrams. */
export interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string;
  diagram_count: number;
  created_at: string;
}

/** Full record from GET/POST/PATCH /diagrams. `data` is the stored doc. */
export interface DiagramOut {
  id: string;
  project_id: string | null;
  title: string;
  diagram_type: string;
  direction: string;
  source_prompt: string | null;
  improved_prompt: string | null;
  tags: string[];
  is_favorite: boolean;
  current_version: number;
  created_at: string;
  updated_at: string;
  data: Partial<DiagramDoc>;
}
